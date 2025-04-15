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

const settingsSchema = z.object({
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

type SettingsInput = z.input<typeof settingsSchema>;
export type SettingsData = z.output<typeof settingsSchema>;

const OIDC_AUDIENCE = "https://qlty.sh";

export class Settings {
  private _data: SettingsData;
  private _fs: FileSystem;

  static create(input: ActionInput = core, fs = FileSystem.create()): Settings {
    return new Settings({
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
    });
  }

  static createNull(input: Partial<SettingsInput> = {}): Settings {
    const fullInput = {
      files: input.files || "**/coverage/**",
      addPrefix: input.addPrefix || "",
      stripPrefix: input.stripPrefix || "",
      skipErrors: input.skipErrors || false,
      skipMissingFiles: input.skipMissingFiles || false,
      tag: input.tag || "",
      totalPartsCount: input.totalPartsCount || "",
      oidc: input.oidc || false,
      coverageToken: input.coverageToken || "",
      verbose: input.verbose || false,
    };
    return new Settings(fullInput, FileSystem.createNull());
  }

  constructor(data: SettingsInput, fs: FileSystem = FileSystem.create()) {
    this._data = settingsSchema.parse(data);
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
    const globber = await glob.create(patterns);
    return await globber.glob();
  }
}

export class StubbedFileSystem implements FileSystem {
  async globPatterns(patterns: string): Promise<string[]> {
    return patterns
      .split("\n")
      .map((pattern) => pattern.trim())
      .filter(Boolean);
  }
}
