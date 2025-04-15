import * as tc from "@actions/tool-cache";
import * as core from "@actions/core";
import os from "os";
import EventEmitter from "node:events";
import OutputTracker from "./util/output_tracker";
import { ActionOutput, StubbedOutput } from "./util/output";

const DOWNLOAD_EVENT = "download";

export class Installer {
  private _os: OperatingSystem;
  private _output: ActionOutput;
  private _tc: ToolCache;
  private _emitter: EventEmitter;

  static create(): Installer {
    return new Installer(os, core, tc);
  }

  static createNull(): Installer {
    return new Installer(
      new StubbedOperatingSystem(),
      new StubbedOutput(),
      new StubbedToolCache()
    );
  }

  constructor(os: OperatingSystem, output: ActionOutput, toolCache: ToolCache) {
    this._os = os;
    this._output = output;
    this._tc = toolCache;
    this._emitter = new EventEmitter();
  }

  trackOutput() {
    return OutputTracker.create<string>(this._emitter, DOWNLOAD_EVENT);
  }

  async install(): Promise<void> {
    const platform = this._os.platform();
    const arch = this._os.arch();

    let platformArch;

    if (platform === "linux" && arch === "x64") {
      platformArch = "x86_64-unknown-linux-gnu";
    } else if (platform === "linux" && arch === "arm64") {
      platformArch = "aarch64-unknown-linux-gnu";
    } else if (platform === "darwin" && arch === "x64") {
      platformArch = "x86_64-apple-darwin";
    } else if (platform === "darwin" && arch === "arm64") {
      platformArch = "aarch64-apple-darwin";
    } else {
      this._output.setFailed(
        `Unsupported platform/architecture: ${platform}/${arch}`
      );
      return;
    }

    const downloadUrl = `https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-${platformArch}.tar.xz`;
    const tarPath = await this._tc.downloadTool(downloadUrl);
    const extractedFolder = await this._tc.extractTar(tarPath, undefined, "x");
    const cachedPath = await this._tc.cacheDir(
      extractedFolder,
      "qlty",
      "latest"
    );
    this._emitter.emit(DOWNLOAD_EVENT, downloadUrl);
    const binPath = `${cachedPath}/qlty-${platformArch}`;
    this._output.addPath(binPath);
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

  async downloadTool(url: string): Promise<string> {
    this.downloads.push(url);
    return `downloaded[${url}]`;
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
