import type { ExecOptions } from "@actions/exec";
import type { OperatingSystem, ToolCache, ActionOutput } from "./interfaces.js";
import type {
  AttestationResult,
  AttestationVerifier,
  CommandRunner,
} from "./attestation.js";

export type AttestationBehavior =
  | "success"
  | "fail"
  | "unavailable"
  | "gh-missing";

export interface StubbedCommandResult {
  exitCode?: number;
  output?: string;
  spawnError?: string;
}

export class StubbedGhRunner implements CommandRunner {
  calls: {
    command: string;
    args: string[];
    env: Record<string, string> | undefined;
  }[] = [];

  constructor(
    private responses: {
      version?: StubbedCommandResult;
      verify?: StubbedCommandResult;
    } = {},
  ) {}

  async exec(
    command: string,
    args: string[],
    options: ExecOptions,
  ): Promise<number> {
    this.calls.push({ command, args, env: options.env });
    const response =
      args[0] === "--version"
        ? (this.responses.version ?? {
            output: "gh version 2.97.0 (2026-07-31)\n",
          })
        : (this.responses.verify ?? {});
    if (response.spawnError) {
      throw new Error(response.spawnError);
    }
    if (response.output) {
      options.listeners?.stdout?.(Buffer.from(response.output));
    }
    return response.exitCode ?? 0;
  }
}

export class StubbedAttestationVerifier implements AttestationVerifier {
  verifiedFiles: string[] = [];
  constructor(private behavior: AttestationBehavior = "success") {}

  async verify(filePath: string): Promise<AttestationResult> {
    this.verifiedFiles.push(filePath);
    switch (this.behavior) {
      case "success":
        return { success: true };
      case "fail":
        return { success: false, kind: "rejected", error: "Stubbed failure" };
      case "unavailable":
        return { success: false, kind: "unavailable", error: "Stubbed outage" };
      case "gh-missing":
        return {
          success: false,
          skipped: true,
          error: "GitHub CLI (gh) is not installed.",
        };
    }
  }
}

export class StubbedOperatingSystem implements OperatingSystem {
  private _platform: string;
  private _arch: string;

  constructor(platform = "linux", arch = "x64") {
    this._platform = platform;
    this._arch = arch;
  }

  platform(): string {
    return this._platform;
  }

  arch(): string {
    return this._arch;
  }
}

export class StubbedToolCache implements ToolCache {
  downloads: string[] = [];
  raiseError: boolean = false;

  constructor(raiseError?: boolean) {
    this.raiseError = raiseError ?? false;
  }

  async downloadTool(url: string): Promise<string> {
    if (this.raiseError) {
      throw new Error("download error");
    } else {
      this.downloads.push(url);
      return `downloadTool[${url}]`;
    }
  }

  async extractTar(
    file: string,
    _dest?: string,
    _options?: string,
  ): Promise<string> {
    return `extractTar[${file} dest=${_dest} options=${_options}]`;
  }

  async extractZip(
    file: string,
    _dest?: string,
    _options?: string,
  ): Promise<string> {
    return `extractZip[${file} dest=${_dest} options=${_options}]`;
  }

  async cacheDir(
    folder: string,
    _tool: string,
    _version: string,
  ): Promise<string> {
    return `cacheDir[${folder}]`;
  }
}

export class StubbedOutput implements ActionOutput {
  failures: string[] = [];
  paths: string[] = [];
  infos: string[] = [];
  warnings: { message: string; title?: string | undefined }[] = [];

  info(message: string): void {
    this.infos.push(message);
  }

  warning(message: string | Error, properties?: { title?: string }): void {
    const warning: { message: string; title?: string | undefined } = {
      message: message instanceof Error ? message.message : message,
    };
    if (properties?.title !== undefined) {
      warning.title = properties.title;
    }
    this.warnings.push(warning);
  }

  setFailed(message: string): void {
    this.failures.push(message);
  }

  addPath(p: string): void {
    this.paths.push(p);
  }
}
