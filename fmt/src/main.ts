import * as core from "@actions/core";
import { exec } from "@actions/exec";
import {
  type FailureKind,
  Installer,
  ReportableError,
} from "@qltysh-action/shared";
import {
  closeTelemetry,
  reportError,
  resolveTelemetry,
  startTelemetry,
} from "@qltysh-action/shared/telemetry";
import { readFileSync } from "node:fs";
import path from "node:path";

// Telemetry reports an FmtError's kind and exit code, never its message.
class FmtError extends ReportableError {
  constructor(message: string, kind: FailureKind, exitCode?: number) {
    super(message, kind, exitCode);
    this.name = "FmtError";
  }
}

export async function main(): Promise<void> {
  const telemetry = resolveTelemetry(core.getInput("telemetry"), process.env);
  if (telemetry.warning) {
    core.warning(telemetry.warning);
  }
  if (telemetry.enabled) {
    startTelemetry("fmt", readVersion());
  }

  try {
    await run();
  } catch (error) {
    core.setFailed(
      error instanceof FmtError
        ? `Action failed with error: ${error.name}`
        : `Action failed with error: ${errorText(error)}`,
    );
    await reportError(error);
    process.exit(1);
  }

  await closeTelemetry();
  process.exit(0);
}

async function run(): Promise<void> {
  const githubToken = core.getInput("github-token");
  const installer = Installer.create(githubToken);
  const qltyBinary = await installer.install();

  if (!qltyBinary) {
    throw new FmtError("Failed to install Qlty CLI", "install_failed");
  }

  let qltyOutput = "";
  let exitCode: number;

  try {
    // With ignoreReturnCode, exec resolves to the CLI's exit code instead of
    // throwing, and throws only when the CLI cannot start.
    exitCode = await exec("qlty", ["fmt", "--all"], {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          qltyOutput += data.toString();
        },
        stderr: (data: Buffer) => {
          qltyOutput += data.toString();
        },
      },
    });
  } catch (error) {
    throw new FmtError(
      `Could not run the Qlty CLI: ${errorText(error)}`,
      "cli_start_failed",
    );
  }

  if (exitCode !== 0) {
    throw new FmtError(qltyOutput, "cli_failed", exitCode);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : `${error}`;
}

function readVersion(): string | null {
  try {
    const packageJson = JSON.parse(
      readFileSync(path.join(__dirname, "../package.json"), "utf-8"),
    );
    return typeof packageJson.version === "string" ? packageJson.version : null;
  } catch {
    return null;
  }
}
