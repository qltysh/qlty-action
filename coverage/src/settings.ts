import { z } from "zod";
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
  "coverage-token": string;
  verbose: boolean;
}

const settingsParser = z.object({
  files: z.string().trim(),
  addPrefix: z.string().transform((val) => (val === "" ? undefined : val)),
  stripPrefix: z.string().transform((val) => (val === "" ? undefined : val)),
  skipErrors: z.boolean(),
  skipMissingFiles: z.boolean(),
  tag: z.string().transform((val) => (val === "" ? undefined : val)),
  totalPartsCount: z.string().transform((val) => {
    if (val === "") return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }),
  oidc: z.boolean(),
  coverageToken: z.string().transform((val) => (val === "" ? undefined : val)),
  verbose: z.boolean(),
});

export type SettingsOutput = z.output<typeof settingsParser>;

const OIDC_AUDIENCE = "https://qlty.sh";

export class Settings {
  private _data: SettingsOutput;
  private _input: InputProvider;
  private _fs: FileSystem;

  static create(
    input: InputProvider = core,
    fs = FileSystem.create()
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
        verbose: input.getBooleanInput("verbose"),
      }),
      input,
      fs
    );
  }

  static createNull(
    input: Partial<ActionInputKeys> = {},
    fs = FileSystem.createNull()
  ): Settings {
    return Settings.create(new StubbedInputProvider(input), fs);
  }

  constructor(data: SettingsOutput, input: InputProvider, fs: FileSystem) {
    this._data = data;
    this._input = input;
    this._fs = fs;
  }

  validate(): boolean {
    if (!this._data.oidc && !this._data.coverageToken) {
      throw new Error("Either 'oidc' or 'coverage-token' must be provided.");
    }

    if (this._data.oidc && this._data.coverageToken) {
      throw new Error(
        "Both 'oidc' and 'coverage-token' cannot be provided at the same time."
      );
    }

    return true;
  }

  async getToken(): Promise<string> {
    if (this._data.oidc) {
      return await this._input.getIDToken(OIDC_AUDIENCE);
    } else {
      if (!this._data.coverageToken) {
        throw new Error("Coverage token is required when 'oidc' is false.");
      } else {
        return this._data.coverageToken;
      }
    }
  }

  async getFiles() {
    // throw new Error("getFiles is not implemented");
    // console.log(`getFiles called with: ${this._data.files}`);
    let patterns: string[] = this._data.files
      .split(",")
      .map((file) => file.trim())
      .filter(Boolean);
    let expandedFiles = await this._fs.globPatterns(patterns.join("\n"));
    return this.sortedUnique(expandedFiles);
    // return [];
  }

  get input() {
    return this._data;
  }

  private sortedUnique(files: string[]) {
    return Array.from(new Set(files)).sort();
  }
}

export class FileSystem {
  static create() {
    return new FileSystem();
  }

  static createNull() {
    return new StubbedFileSystem();
  }

  async globPatterns(patterns: string): Promise<string[]> {
    console.log(`Glob patterns called with: ${patterns}`);
    const globber = await glob.create(patterns);
    return await globber.glob();
  }
}

export class StubbedFileSystem implements FileSystem {
  async globPatterns(patterns: string): Promise<string[]> {
    console.log(`Stubbed globPatterns called with: ${patterns}`);
    return patterns
      .split("\n")
      .map((pattern) => pattern.trim())
      .filter(Boolean);
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
      verbose: data.verbose || false,
    };
  }

  getInput(name: keyof ActionInputKeys, _options?: GetInputOptions): string {
    return (this._data[name] || "").toString();
  }

  getBooleanInput(
    name: keyof ActionInputKeys,
    _options?: GetInputOptions
  ): boolean {
    return this._data[name] === true;
  }

  async getIDToken(audience: string): Promise<string> {
    return `oidc-token:audience=${audience}`;
  }
}
