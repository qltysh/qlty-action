import { z } from "zod";
import * as core from "@actions/core";
import * as glob from "@actions/glob";

interface GetInputOptions {
  required?: boolean;
}

interface ActionInput {
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

const stettingsParser = z.object({
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

type SettingsInput = z.input<typeof stettingsParser>;
export type SettingsOutput = z.output<typeof stettingsParser>;

const OIDC_AUDIENCE = "https://qlty.sh";

export class Settings {
  private _data: SettingsOutput;
  private _fs: FileSystem;

  static create(input: ActionInput = core, fs = FileSystem.create()): Settings {
    return Settings.parse(
      {
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
      },
      fs
    );
  }

  static createNull(input: Partial<ActionInputKeys> = {}): Settings {
    const fs = FileSystem.createNull();
    console.log("Settings.createNull: fs = ", fs);
    const settings = Settings.create(new StubbedInput(input), fs);
    console.log("Settings.createNull: settings = ", settings);
    return settings;
  }

  static parse(input: SettingsInput, fs: FileSystem) {
    const data = stettingsParser.parse(input);
    return new Settings(data, fs);
  }

  constructor(data: SettingsOutput, fs: FileSystem) {
    console.log("Settings.constructor: fs = ", fs);
    this._data = data;
    this._fs = fs;
  }

  validate(): boolean {
    if (!this._data.oidc && !this._data.coverageToken) {
      throw new Error("Either 'oidc' or 'coverage-token' must be provided.");
    } else {
      return true;
    }
  }

  async getToken(): Promise<string> {
    if (this._data.oidc) {
      return await core.getIDToken(OIDC_AUDIENCE);
    } else {
      if (!this._data.coverageToken) {
        throw new Error("Coverage token is required when 'oidc' is false.");
      } else {
        return this._data.coverageToken;
      }
    }
  }

  async getFiles() {
    let patterns: string[] = this._data.files
      .split(",")
      .map((file) => file.trim())
      .filter(Boolean);
    let expandedFiles = await this._fs.globPatterns(patterns.join("\n"));
    return this.sortedUnique(expandedFiles);
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
    console.log(`REAL globPatterns`);
    const globber = await glob.create(patterns);
    return await globber.glob();
  }
}

export class StubbedFileSystem implements FileSystem {
  async globPatterns(patterns: string): Promise<string[]> {
    console.log(`FAKE globPatterns`);
    return patterns
      .split("\n")
      .map((pattern) => pattern.trim())
      .filter(Boolean);
  }
}

export class StubbedInput implements ActionInput {
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
    return "fake-oidc-token";
  }
}
