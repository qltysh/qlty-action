import * as tc from "@actions/tool-cache";
import * as core from "@actions/core";
import os from "os";
import path from "node:path";
import EventEmitter from "node:events";

import type { ToolCache, OperatingSystem, ActionOutput } from "./interfaces.js";
import type { AttestationVerifier } from "./attestation.js";
import { GhAttestationVerifier } from "./attestation.js";
import { planDownload, type DownloadPlan } from "./platform.js";
import OutputTracker from "./output-tracker.js";
import {
  StubbedOperatingSystem,
  StubbedToolCache,
  StubbedOutput,
  StubbedAttestationVerifier,
  type AttestationBehavior,
} from "./stubs.js";

const DOWNLOAD_EVENT = "download";

export interface InstallerOptions {
  version?: string | undefined;
}

export interface NullInstallerOptions {
  platform?: string | undefined;
  arch?: string | undefined;
  version?: string | undefined;
  downloadError?: boolean | undefined;
  attestationBehavior?: AttestationBehavior | undefined;
}

export class Installer {
  private _os: OperatingSystem;
  private _output: ActionOutput;
  private _tc: ToolCache;
  private _attestationVerifier: AttestationVerifier;
  private _emitter: EventEmitter = new EventEmitter();
  private _version: string | undefined;

  static create(token: string, options?: InstallerOptions): Installer {
    return new Installer(
      os,
      core,
      tc,
      new GhAttestationVerifier(token),
      options?.version,
    );
  }

  static createNull(options: NullInstallerOptions = {}): Installer {
    const {
      platform = "linux",
      arch = "x64",
      version,
      downloadError = false,
      attestationBehavior = "success",
    } = options;

    return new Installer(
      new StubbedOperatingSystem(platform, arch),
      new StubbedOutput(),
      new StubbedToolCache(downloadError),
      new StubbedAttestationVerifier(attestationBehavior),
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

  trackOutput(): OutputTracker<string> {
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

    const archivePath = await this._tc.downloadTool(download.url);

    // Verify attestation
    this._output.info("Verifying sigstore attestation...");
    const attestationResult = await this._attestationVerifier.verify(
      archivePath,
      "qltysh",
    );

    if (!attestationResult.success) {
      if (attestationResult.skipped) {
        // Skipped verification - warn but proceed
        const warningDetails = attestationResult.error
          ? ` ${attestationResult.error}`
          : "";
        this._output.warning(
          "Sigstore attestation verification was skipped." +
            warningDetails +
            " For enhanced security, ensure the GitHub CLI is available and the github-token input is provided.",
          { title: "Attestation Verification Skipped" },
        );
      } else {
        // Real verification failure - fatal
        this._output.setFailed(
          `Sigstore attestation verification failed: ${attestationResult.error ?? "Unknown error"}`,
        );
        return null;
      }
    } else {
      this._output.info("Attestation verified successfully");
    }

    let extractedFolder;

    if (download.fileType === "zip") {
      extractedFolder = await this._tc.extractZip(archivePath);
    } else {
      extractedFolder = await this._tc.extractTar(archivePath, undefined, "x");
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
    return planDownload(this._os, this._version);
  }
}
