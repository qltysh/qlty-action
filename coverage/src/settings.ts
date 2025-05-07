import { z, ZodAny, ZodType } from "zod";
import * as core from "@actions/core";
import * as glob from "@actions/glob";

interface GetInputOptions {
  required?: boolean;
}

interface InputProvider {
  getInput(name: string, options?: GetInputOptions): string;
  getBooleanInput(name: string, options?: GetInputOptions): boolean;
  getIDToken(audience: string): Promise<string>;
}

interface ActionInputKeys {
  files: string;
  "add-prefix": string;
  "strip-prefix": string;
  "skip-errors": boolean;
  "skip-missing-files": boolean;
  tag: string;
  "total-parts-count": string;
  oidc: boolean;
  token: string;
  "coverage-token": string;
  verbose: boolean;
  "cli-version": string;
  format: string;
  "dry-run": boolean;
  incomplete: boolean;
  name: string;
  validate: boolean;
  "validate-file-threshold": string;
}

function preprocessBlanks(zType: ZodType): ZodType {
  return z.preprocess((val) => {
    if (val === "" || val === null) {
      return undefined;
    }
    return val;
  }, zType);
}

// NOTE: These formats need to be kept in sync with action.yml
// which in turn needs to be kept in sync with the CLI
const formatEnum = z.enum([
  "clover",
  "cobertura",
  "coverprofile",
  "jacoco",
  "lcov",
  "qlty",
  "simplecov",
]);

const settingsParser = z.object({
  token: preprocessBlanks(z.string().optional()),
  coverageToken: preprocessBlanks(z.string().optional()),
  files: z.string().trim(),
  addPrefix: preprocessBlanks(z.string().optional()),
  stripPrefix: preprocessBlanks(z.string().optional()),
  skipErrors: z.boolean(),
  skipMissingFiles: z.boolean(),
  tag: preprocessBlanks(z.string().optional()),
  totalPartsCount: preprocessBlanks(z.coerce.number().int().gte(1).optional()),
  oidc: z.boolean(),
  verbose: z.boolean(),
  cliVersion: preprocessBlanks(z.string().optional()),
  format: preprocessBlanks(formatEnum.optional()),
  dryRun: z.boolean(),
  incomplete: z.boolean(),
  name: preprocessBlanks(z.string().optional()),
  validate: z.boolean(),
  validateFileThreshold: preprocessBlanks(
    z.coerce.number().gte(1).lte(100).optional(),
  ),
});

export type SettingsOutput = z.output<typeof settingsParser>;

const OIDC_AUDIENCE = "https://qlty.sh";
const COVERAGE_TOKEN_REGEX = /^(qltcp_|qltcw_)[a-zA-Z0-9]{10,}$/;

export class Settings {
  private _data: SettingsOutput;
  private _input: InputProvider;
  private _fs: FileSystem;

  static create(
    input: InputProvider = core,
    fs = FileSystem.create(),
  ): Settings {
    return new Settings(
      settingsParser.parse({
        files: input.getInput("files", { required: true }).trim(),
        addPrefix: input.getInput("add-prefix"),
        stripPrefix: input.getInput("strip-prefix"),
        skipErrors: input.getBooleanInput("skip-errors"),
        skipMissingFiles: input.getBooleanInput("skip-missing-files"),
        tag: input.getInput("tag"),
        totalPartsCount: input.getInput("total-parts-count"),
        oidc: input.getBooleanInput("oidc"),
        coverageToken: input.getInput("coverage-token"),
        token: input.getInput("token"),
        verbose: input.getBooleanInput("verbose"),
        cliVersion: input.getInput("cli-version"),
        format: input.getInput("format"),
        dryRun: input.getBooleanInput("dry-run"),
        incomplete: input.getBooleanInput("incomplete"),
        name: input.getInput("name"),
        validate: input.getBooleanInput("validate"),
        validateFileThreshold: input.getInput("validate-file-threshold"),
      }),
      input,
      fs,
    );
  }

  static createNull(
    input: Partial<ActionInputKeys> = {},
    fs = FileSystem.createNull(),
  ): Settings {
    return Settings.create(new StubbedInputProvider(input), fs);
  }

  constructor(data: SettingsOutput, input: InputProvider, fs: FileSystem) {
    this._data = data;
    this._input = input;
    this._fs = fs;
  }

  validate(): string[] {
    const errors = [];
    const coverageToken = this.getCoverageToken();

    // Skip token validation when in dry-run mode
    if (!this._data.dryRun) {
      if (!this._data.oidc && !coverageToken) {
        errors.push("Either 'oidc' or 'token' must be provided.");
      }

      if (this._data.oidc && coverageToken) {
        errors.push(
          "Both 'oidc' and 'token' cannot be provided at the same time.",
        );
      }

      if (coverageToken && !COVERAGE_TOKEN_REGEX.test(coverageToken)) {
        errors.push(
          "The provided token is invalid. It should begin with 'qltcp_' or 'qltcw_' followed by alphanumerics.",
        );
      }
    }

    // Check if validate-file-threshold is provided without enabling validate
    if (
      this._data.validateFileThreshold !== undefined &&
      !this._data.validate
    ) {
      errors.push(
        "'validate-file-threshold' requires 'validate' to be set to true.",
      );
    }

    return errors;
  }

  async getToken(): Promise<string | null> {
    if (this._data.dryRun) {
      if (this._data.oidc) {
        // When running in dry-run mode with oidc, we still generate an OIDC token
        // This ensures the workflow is authorized to use OIDC.
        return await this._input.getIDToken(OIDC_AUDIENCE);
      } else {
        const coverageToken = this.getCoverageToken();
        return coverageToken || null;
      }
    }

    if (this._data.oidc) {
      return await this._input.getIDToken(OIDC_AUDIENCE);
    } else {
      const coverageToken = this.getCoverageToken();

      if (!coverageToken) {
        throw new Error("'token' is required when 'oidc' is false.");
      } else {
        return coverageToken;
      }
    }
  }

  getVersion(): string | undefined {
    if (!this._data.cliVersion) {
      return undefined;
    }

    // Format version string (remove 'v' prefix if present)
    return this._data.cliVersion.startsWith("v")
      ? this._data.cliVersion.substring(1)
      : this._data.cliVersion;
  }

  async getFiles() {
    const patterns: string[] = this._data.files
      .split(",")
      .map((file) => file.trim())
      .filter(Boolean);
    const expandedFiles = await this._fs.globPatterns(patterns.join("\n"));
    return this.sortedUnique(expandedFiles);
  }

  get input() {
    return this._data;
  }

  // Handles getting the coverage token
  // from the `token` or deprecated `coverage-token` input
  private getCoverageToken() {
    if (this._data.token) {
      return this._data.token;
    } else {
      // Deprecated: token is preferred
      return this._data.coverageToken;
    }
  }

  private sortedUnique(files: string[]) {
    return Array.from(new Set(files)).sort();
  }
}

export class FileSystem {
  static create() {
    return new FileSystem();
  }

  static createNull(results?: string[]) {
    return new StubbedFileSystem(results);
  }

  async globPatterns(patterns: string): Promise<string[]> {
    const globber = await glob.create(patterns);
    return await globber.glob();
  }
}

export class StubbedFileSystem implements FileSystem {
  private results: string[] | undefined = [];

  constructor(results: string[] | undefined = undefined) {
    this.results = results;
  }

  async globPatterns(patterns: string): Promise<string[]> {
    if (this.results) {
      return this.results;
    } else {
      return patterns
        .split("\n")
        .map((pattern) => pattern.trim())
        .filter(Boolean);
    }
  }
}

export class StubbedInputProvider implements InputProvider {
  _data: ActionInputKeys;

  constructor(data: Partial<ActionInputKeys>) {
    this._data = {
      files: data.files || "",
      "add-prefix": data["add-prefix"] || "",
      "strip-prefix": data["strip-prefix"] || "",
      "skip-errors": data["skip-errors"] || false,
      "skip-missing-files": data["skip-missing-files"] || false,
      tag: data.tag || "",
      "total-parts-count": data["total-parts-count"] || "",
      oidc: data.oidc || false,
      "coverage-token": data["coverage-token"] || "",
      token: data.token || "",
      verbose: data.verbose || false,
      "cli-version": data["cli-version"] || "",
      format: data["format"] || "",
      "dry-run": data["dry-run"] || false,
      incomplete: data.incomplete || false,
      name: data.name || "",
      validate: data.validate || false,
      "validate-file-threshold": data["validate-file-threshold"] || "",
    };
  }

  getInput(name: keyof ActionInputKeys, _options?: GetInputOptions): string {
    return (this._data[name] || "").toString();
  }

  getBooleanInput(
    name: keyof ActionInputKeys,
    _options?: GetInputOptions,
  ): boolean {
    return this._data[name] === true;
  }

  async getIDToken(audience: string): Promise<string> {
    return `oidc-token:audience=${audience}`;
  }
}
