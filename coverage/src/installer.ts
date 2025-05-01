import * as tc from "@actions/tool-cache";
import * as core from "@actions/core";
import os from "os";
import EventEmitter from "node:events";
import fs from "fs";
import OutputTracker from "./util/output_tracker";
import { ActionOutput, StubbedOutput } from "./util/output";

const DOWNLOAD_EVENT = "download";

export class Installer {
  private _os: OperatingSystem;
  private _output: ActionOutput;
  private _tc: ToolCache;
  private _emitter: EventEmitter = new EventEmitter();
  private _version: string | undefined;

  static create(version?: string): Installer {
    return new Installer(os, core, tc, version);
  }

  static createNull(version?: string, raiseDownloadError?: boolean): Installer {
    return new Installer(
      new StubbedOperatingSystem(),
      new StubbedOutput(),
      new StubbedToolCache(raiseDownloadError),
      version,
    );
  }

  constructor(
    os: OperatingSystem,
    output: ActionOutput,
    toolCache: ToolCache,
    version?: string,
  ) {
    this._os = os;
    this._output = output;
    this._tc = toolCache;
    this._version = version;
  }

  trackOutput() {
    return OutputTracker.create<string>(this._emitter, DOWNLOAD_EVENT);
  }

  async install(): Promise<void> {
    const platform = this._os.platform();
    const arch = this._os.arch();

    let platformArch;
    let extension = "tar.xz";

    if (platform === "linux" && arch === "x64") {
      platformArch = "x86_64-unknown-linux-gnu";
    } else if (platform === "linux" && arch === "arm64") {
      platformArch = "aarch64-unknown-linux-gnu";
    } else if (platform === "darwin" && arch === "x64") {
      platformArch = "x86_64-apple-darwin";
    } else if (platform === "darwin" && arch === "arm64") {
      platformArch = "aarch64-apple-darwin";
    } else if (platform === "win32" && arch === "x64") {
      platformArch = "x86_64-pc-windows-msvc";
      extension = "zip";
    } else {
      this._output.setFailed(
        `Unsupported platform/architecture: ${platform}/${arch}`,
      );
      return;
    }

    const versionPath = this._version ? `v${this._version}` : "latest";

    const downloadUrl = `https://qlty-releases.s3.amazonaws.com/qlty/${versionPath}/qlty-${platformArch}.${extension}`;
    const tarPath = await this._tc.downloadTool(downloadUrl);
    let extractedFolder;
    if (extension === "zip") {
      extractedFolder = await this._tc.extractZip(tarPath, undefined);
    } else {
      extractedFolder = await this._tc.extractTar(tarPath, undefined, "x");
    }
    const cachedPath = await this._tc.cacheDir(
      extractedFolder,
      "qlty",
      versionPath,
    );
    this._emitter.emit(DOWNLOAD_EVENT, downloadUrl);
    this._output.info(`Download URL: ${downloadUrl}`);
    this._output.info(`Extracted folder: ${extractedFolder}`);
    this._output.info(`Cached path: ${cachedPath}`);
    const binPath = `${cachedPath}/qlty-${platformArch}`;
    this._output.info(`Binary path: ${binPath}`);
    if (!fs.existsSync(binPath)) {
      this._output.warning(`Binary not found at: ${binPath}`);
    }
    this._output.addPath(binPath);
  }
}

export interface ToolCache {
  downloadTool(url: string): Promise<string>;
  extractTar(file: string, dest?: string, options?: string): Promise<string>;
  cacheDir(folder: string, tool: string, version: string): Promise<string>;
  extractZip(file: string, dest?: string): Promise<string>;
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
      return `downloaded[${url}]`;
    }
  }

  async extractTar(
    file: string,
    _dest?: string,
    _options?: string,
  ): Promise<string> {
    return `extracted[${file} dest=${_dest} options=${_options}]`;
  }

  async extractZip(file: string, _dest?: string): Promise<string> {
    return `extracted[${file} dest=${_dest}]`;
  }

  async cacheDir(
    folder: string,
    _tool: string,
    _version: string,
  ): Promise<string> {
    return `cached[${folder}]`;
  }
}
