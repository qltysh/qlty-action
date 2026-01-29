import * as tc from "@actions/tool-cache";
import * as core from "@actions/core";
import * as actionsExec from "@actions/exec";
import os from "os";
import EventEmitter from "node:events";
import OutputTracker from "./util/output_tracker";
import { ActionOutput, StubbedOutput } from "./util/output";
import path from "node:path";

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

const DOWNLOAD_EVENT = "download";

type FileType = "tar.xz" | "zip";

interface DownloadPlan {
  url: string;
  fileType: FileType;
  target: string;
  version: string;
  binaryName: string;
  extractComponent: string | null;
}

export class Installer {
  private _os: OperatingSystem;
  private _output: ActionOutput;
  private _tc: ToolCache;
  private _attestationVerifier: AttestationVerifier;
  private _emitter: EventEmitter = new EventEmitter();
  private _version: string | undefined;

  static create(token: string, version?: string): Installer {
    return new Installer(os, core, tc, new GhAttestationVerifier(token), version);
  }

  static createNull(
    version?: string,
    raiseDownloadError?: boolean,
    attestationShouldFail?: boolean,
  ): Installer {
    return new Installer(
      new StubbedOperatingSystem(),
      new StubbedOutput(),
      new StubbedToolCache(raiseDownloadError),
      new StubbedAttestationVerifier(attestationShouldFail),
      version,
    );
  }

  constructor(
    os: OperatingSystem,
    output: ActionOutput,
    toolCache: ToolCache,
    attestationVerifier: AttestationVerifier,
    version?: string,
  ) {
    this._os = os;
    this._output = output;
    this._tc = toolCache;
    this._attestationVerifier = attestationVerifier;
    this._version = version;
  }

  trackOutput() {
    return OutputTracker.create<string>(this._emitter, DOWNLOAD_EVENT);
  }

  async install(): Promise<string | null> {
    const download = this.planDownload();

    if (!download) {
      this._output.setFailed(
        `Unsupported platform/architecture: ${this._os.platform()}/${this._os.arch()}`,
      );
      return null;
    }

    const tarPath = await this._tc.downloadTool(download.url);

    // Verify attestation (fatal on failure)
    this._output.info("Verifying sigstore attestation...");
    const attestationResult = await this._attestationVerifier.verify(
      tarPath,
      "qltysh",
    );

    if (!attestationResult.success) {
      this._output.setFailed(
        `Sigstore attestation verification failed: ${attestationResult.error ?? "Unknown error"}`,
      );
      return null;
    }
    this._output.info("Attestation verified successfully");

    let extractedFolder;

    if (download.fileType === "zip") {
      extractedFolder = await this._tc.extractZip(tarPath);
    } else {
      extractedFolder = await this._tc.extractTar(tarPath, undefined, "x");
    }

    const cachedPath = await this._tc.cacheDir(
      extractedFolder,
      "qlty",
      download.version,
    );
    this._emitter.emit(DOWNLOAD_EVENT, download.url);

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

    let target;
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

    const versionPath = this._version ? `v${this._version}` : "latest";

    return {
      url: `https://qlty-releases.s3.amazonaws.com/qlty/${versionPath}/qlty-${target}.${fileType}`,
      fileType,
      target,
      version: versionPath,
      binaryName: platform === "win32" ? "qlty.exe" : "qlty",
      extractComponent: platform === "win32" ? null : `qlty-${target}`,
    };
  }
}

export interface ToolCache {
  downloadTool(url: string): Promise<string>;
  extractTar(file: string, dest?: string, options?: string): Promise<string>;
  extractZip(file: string, dest?: string, options?: string): Promise<string>;
  cacheDir(folder: string, tool: string, version: string): Promise<string>;
}

export interface OperatingSystem {
  platform(): string;
  arch(): string;
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
    this.raiseError = raiseError || false;
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
