import * as tc from "@actions/tool-cache";
import * as core from "@actions/core";
import os from "os";
import EventEmitter from "node:events";
import OutputTracker from "./util/output_tracker";
import { ActionOutput, StubbedOutput } from "./util/output";

const DOWNLOAD_EVENT = "download";

interface DownloadPlan {
  url: string;
  fileType: "tar.xz" | "zip";
  target: string;
  version: string;
}

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
      version
    );
  }

  constructor(
    os: OperatingSystem,
    output: ActionOutput,
    toolCache: ToolCache,
    version?: string
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
    const download = this.planDownload();

    if (!download) {
      this._output.setFailed(
        `Unsupported platform/architecture: ${this._os.platform()}/${this._os.arch()}`
      );
      return;
    }

    const tarPath = await this._tc.downloadTool(download.url);
    const extractedFolder = await this._tc.extractTar(tarPath, undefined, "x");
    const cachedPath = await this._tc.cacheDir(
      extractedFolder,
      "qlty",
      download.version
    );
    this._emitter.emit(DOWNLOAD_EVENT, download.url);

    const binPath = `${cachedPath}/qlty-${download.target}`;
    this._output.addPath(binPath);
  }

  planDownload(): DownloadPlan | null {
    const platform = this._os.platform();
    const arch = this._os.arch();

    let target;

    if (platform === "linux" && arch === "x64") {
      target = "x86_64-unknown-linux-gnu";
    } else if (platform === "linux" && arch === "arm64") {
      target = "aarch64-unknown-linux-gnu";
    } else if (platform === "darwin" && arch === "x64") {
      target = "x86_64-apple-darwin";
    } else if (platform === "darwin" && arch === "arm64") {
      target = "aarch64-apple-darwin";
    } else {
      return null;
    }

    const versionPath = this._version ? `v${this._version}` : "latest";

    return {
      url: `https://qlty-releases.s3.amazonaws.com/qlty/${versionPath}/qlty-${target}.tar.xz`,
      fileType: "tar.xz",
      target,
      version: versionPath,
    };
  }
}

export interface ToolCache {
  downloadTool(url: string): Promise<string>;
  extractTar(file: string, dest?: string, options?: string): Promise<string>;
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
      return `downloaded[${url}]`;
    }
  }

  async extractTar(
    file: string,
    _dest?: string,
    _options?: string
  ): Promise<string> {
    return `extracted[${file} dest=${_dest} options=${_options}]`;
  }

  async cacheDir(
    folder: string,
    _tool: string,
    _version: string
  ): Promise<string> {
    return `cached[${folder}]`;
  }
}
