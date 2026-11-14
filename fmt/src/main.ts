import * as core from "@actions/core";
import { exec } from "@actions/exec";
import {
  AttestationError,
  AttestationUnavailableError,
  errorText,
  type FailureKind,
  Installer,
  ReportableError,
} from "@qltysh-action/shared";

// Telemetry reports an FmtError's kind and exit code, never its message.
class FmtError extends ReportableError {
  constructor(message: string, kind: FailureKind, exitCode?: number) {
    super(message, kind, exitCode);
    this.name = "FmtError";
  }
}

export async function run(): Promise<void> {
  const installer = Installer.create(core.getInput("github-token"));
  let qltyBinary: string | null;

  try {
    qltyBinary = await installer.install();
  } catch (error) {
    if (error instanceof AttestationError) {
      throw error;
    }
    if (error instanceof AttestationUnavailableError) {
      throw new FmtError(error.message, "attestation_unavailable");
    }
    throw new FmtError(
      `Error installing Qlty CLI: ${errorText(error)}`,
      "install_failed",
    );
  }

  if (!qltyBinary) {
    throw new FmtError("Failed to install Qlty CLI", "install_failed");
  }

  // exec streams the CLI's output to the job log. With ignoreReturnCode, it
  // resolves to the CLI's exit code, or null when a signal stopped it, and
  // throws only when the CLI cannot start.
  let exitCode: number | null;
  try {
    exitCode = await exec("qlty", ["fmt", "--all"], { ignoreReturnCode: true });
  } catch (error) {
    throw new FmtError(
      `Could not run the Qlty CLI: ${errorText(error)}`,
      "cli_start_failed",
    );
  }

  if (exitCode === null) {
    throw new FmtError("qlty fmt was stopped by a signal", "cli_killed");
  }
  if (exitCode !== 0) {
    throw new FmtError(
      `qlty fmt exited with code ${exitCode}`,
      "cli_failed",
      exitCode,
    );
  }
}
