import * as tc from "@actions/tool-cache";
import * as core from "@actions/core";
import os from "os";
import path from "node:path";
import EventEmitter from "node:events";

import type { ToolCache, OperatingSystem, ActionOutput } from "./interfaces.js";
import type { AttestationVerifier } from "./attestation.js";
import { SigstoreAttestationVerifier } from "./attestation.js";
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

// Only workflows in this GitHub organization can sign a Qlty CLI attestation.
const ATTESTATION_OWNER = "qltysh";

export class AttestationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttestationError";
  }
}

export class AttestationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttestationUnavailableError";
  }
}

export interface InstallerOptions {
  version?: string | undefined;
  // Defaults to true. False installs the Qlty CLI without verifying it.
  verifyAttestation?: boolean | undefined;
}

export interface NullInstallerOptions {
  platform?: string | undefined;
  arch?: string | undefined;
  version?: string | undefined;
  downloadError?: boolean | undefined;
  attestationBehavior?: AttestationBehavior | undefined;
  verifyAttestation?: boolean | undefined;
}

export class Installer {
  private _os: OperatingSystem;
  private _output: ActionOutput;
  private _tc: ToolCache;
  private _attestationVerifier: AttestationVerifier;
  private _emitter: EventEmitter = new EventEmitter();
  private _version: string | undefined;
  private _verifyAttestation: boolean;

  static create(token: string, options: InstallerOptions = {}): Installer {
    return new Installer(
      os,
      core,
      tc,
      SigstoreAttestationVerifier.create(token),
      options.version,
      options.verifyAttestation ?? true,
    );
  }

  static createNull(options: NullInstallerOptions = {}): Installer {
    const {
      platform = "linux",
      arch = "x64",
      version,
      downloadError = false,
      attestationBehavior = "success",
      verifyAttestation = true,
    } = options;

    return new Installer(
      new StubbedOperatingSystem(platform, arch),
      new StubbedOutput(),
      new StubbedToolCache(downloadError),
      new StubbedAttestationVerifier(attestationBehavior),
      version,
      verifyAttestation,
    );
  }

  constructor(
    os: OperatingSystem,
    output: ActionOutput,
    toolCache: ToolCache,
    attestationVerifier: AttestationVerifier,
    version?: string,
    verifyAttestation = true,
  ) {
    this._os = os;
    this._output = output;
    this._tc = toolCache;
    this._attestationVerifier = attestationVerifier;
    this._version = version;
    this._verifyAttestation = verifyAttestation;
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

    await this.verifyAttestation(archivePath);

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

  // Throws unless the archive's attestation verifies, so an unverified Qlty
  // CLI is never extracted or added to PATH. verify-attestation: false is the
  // only way past it.
  private async verifyAttestation(archivePath: string): Promise<void> {
    if (!this._verifyAttestation) {
      this._output.warning(
        "Skipped verifying the Qlty CLI's attestation because verify-attestation is false, so this run uses a Qlty CLI that was not verified.",
        { title: "Attestation verification turned off" },
      );
      return;
    }

    this._output.info(
      "Verifying the Qlty CLI's Sigstore attestation in the action (no GitHub CLI needed)...",
    );
    const result = await this._attestationVerifier.verify(
      archivePath,
      ATTESTATION_OWNER,
    );

    if (result.success) {
      this._output.info(
        `Verified the Qlty CLI: SLSA provenance for sha256:${result.digest}, signed by ${result.signer}`,
      );
    } else if (result.unavailable) {
      throw new AttestationUnavailableError(
        `Sigstore attestation verification could not finish, so the Qlty CLI was not installed: ${asSentence(result.error)} To install without verifying, set verify-attestation: false.`,
      );
    } else {
      throw new AttestationError(
        `Sigstore attestation verification failed: ${result.error}`,
      );
    }
  }

  planDownload(): DownloadPlan | null {
    return planDownload(this._os, this._version);
  }
}

function asSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
