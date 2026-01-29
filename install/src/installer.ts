import * as tc from "@actions/tool-cache";
import * as core from "@actions/core";
import * as actionsExec from "@actions/exec";
import os from "os";
import path from "node:path";

type FileType = "tar.xz" | "zip";

interface DownloadPlan {
  url: string;
  fileType: FileType;
  target: string;
  binaryName: string;
  extractComponent: string | null;
}

// Attestation interfaces
export interface AttestationResult {
  success: boolean;
  error?: string;
}

export interface AttestationVerifier {
  verify(filePath: string, owner: string): Promise<AttestationResult>;
}

export class GhAttestationVerifier implements AttestationVerifier {
  constructor(private token: string) {}

  async verify(filePath: string, owner: string): Promise<AttestationResult> {
    let output = "";
    try {
      await actionsExec.exec(
        "gh",
        ["attestation", "verify", filePath, "--owner", owner],
        {
          env: {
            ...process.env,
            GH_TOKEN: this.token,
          },
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString();
            },
            stderr: (data: Buffer) => {
              output += data.toString();
            },
          },
        },
      );
      return { success: true };
    } catch {
      return { success: false, error: output || "Verification failed" };
    }
  }
}

export class StubbedAttestationVerifier implements AttestationVerifier {
  verifiedFiles: string[] = [];
  constructor(private shouldFail = false) {}

  async verify(filePath: string): Promise<AttestationResult> {
    this.verifiedFiles.push(filePath);
    return this.shouldFail
      ? { success: false, error: "Stubbed failure" }
      : { success: true };
  }
}

// OS interface
export interface OperatingSystem {
  platform(): string;
  arch(): string;
}

// ToolCache interface
export interface ToolCache {
  downloadTool(url: string): Promise<string>;
  extractTar(file: string, dest?: string, options?: string): Promise<string>;
  extractZip(file: string, dest?: string): Promise<string>;
  cacheDir(folder: string, tool: string, version: string): Promise<string>;
}

// ActionOutput interface
export interface ActionOutput {
  info(message: string): void;
  setFailed(message: string): void;
  addPath(path: string): void;
}

// Stubbed implementations for testing
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
    return `extractTar[${file}]`;
  }

  async extractZip(file: string, _dest?: string): Promise<string> {
    return `extractZip[${file}]`;
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

  info(message: string): void {
    this.infos.push(message);
  }

  setFailed(message: string): void {
    this.failures.push(message);
  }

  addPath(p: string): void {
    this.paths.push(p);
  }
}

// Main Installer class
export class Installer {
  private _os: OperatingSystem;
  private _output: ActionOutput;
  private _tc: ToolCache;
  private _attestationVerifier: AttestationVerifier;

  static create(token: string): Installer {
    return new Installer(os, core, tc, new GhAttestationVerifier(token));
  }

  static createNull(
    platform = "linux",
    arch = "x64",
    attestationShouldFail = false,
    downloadError = false,
  ): Installer {
    return new Installer(
      new StubbedOperatingSystem(platform, arch),
      new StubbedOutput(),
      new StubbedToolCache(downloadError),
      new StubbedAttestationVerifier(attestationShouldFail),
    );
  }

  constructor(
    os: OperatingSystem,
    output: ActionOutput,
    toolCache: ToolCache,
    attestationVerifier: AttestationVerifier,
  ) {
    this._os = os;
    this._output = output;
    this._tc = toolCache;
    this._attestationVerifier = attestationVerifier;
  }

  async install(): Promise<string | null> {
    const download = this.planDownload();

    if (!download) {
      this._output.setFailed(
        `Unsupported platform/architecture: ${this._os.platform()}/${this._os.arch()}`,
      );
      return null;
    }

    this._output.info(`Downloading Qlty CLI from ${download.url}`);
    const archivePath = await this._tc.downloadTool(download.url);

    // Verify attestation (fatal on failure)
    this._output.info("Verifying sigstore attestation...");
    const attestationResult = await this._attestationVerifier.verify(
      archivePath,
      "qltysh",
    );

    if (!attestationResult.success) {
      this._output.setFailed(
        `Sigstore attestation verification failed: ${attestationResult.error ?? "Unknown error"}`,
      );
      return null;
    }
    this._output.info("Attestation verified successfully");

    // Extract
    let extractedFolder;
    if (download.fileType === "zip") {
      extractedFolder = await this._tc.extractZip(archivePath);
    } else {
      extractedFolder = await this._tc.extractTar(archivePath, undefined, "x");
    }

    const cachedPath = await this._tc.cacheDir(
      extractedFolder,
      "qlty",
      "latest",
    );

    let binPath = cachedPath;
    if (download.extractComponent) {
      binPath = [binPath, path.sep, download.extractComponent].join("");
    }

    this._output.addPath(binPath);
    return download.binaryName;
  }

  planDownload(): DownloadPlan | null {
    const platform = this._os.platform();
    const arch = this._os.arch();

    let target: string;
    let fileType: FileType;

    if (platform === "linux" && arch === "x64") {
      target = "x86_64-unknown-linux-gnu";
      fileType = "tar.xz";
    } else if (platform === "linux" && arch === "arm64") {
      target = "aarch64-unknown-linux-gnu";
      fileType = "tar.xz";
    } else if (platform === "darwin" && arch === "x64") {
      target = "x86_64-apple-darwin";
      fileType = "tar.xz";
    } else if (platform === "darwin" && arch === "arm64") {
      target = "aarch64-apple-darwin";
      fileType = "tar.xz";
    } else if (platform === "win32" && arch === "x64") {
      target = "x86_64-pc-windows-msvc";
      fileType = "zip";
    } else {
      return null;
    }

    return {
      url: `https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-${target}.${fileType}`,
      fileType,
      target,
      binaryName: platform === "win32" ? "qlty.exe" : "qlty",
      extractComponent: platform === "win32" ? null : `qlty-${target}`,
    };
  }
}
