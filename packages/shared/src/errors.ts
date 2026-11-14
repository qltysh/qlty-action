/**
 * The failures an action reports to Qlty's error tracking. Each is a fixed
 * label, so a report never carries text from the CLI or the runner.
 */
export type FailureKind =
  | "invalid_input"
  | "install_failed"
  | "attestation_unavailable"
  | "no_coverage_files"
  | "cli_failed"
  | "cli_start_failed";

/**
 * An error whose kind, and the Qlty CLI's exit code when the CLI ran, can be
 * reported. Its message is never reported, because it can hold CLI output.
 */
export class ReportableError extends Error {
  readonly kind: FailureKind;
  readonly exitCode: number | undefined;

  constructor(message: string, kind: FailureKind, exitCode?: number) {
    super(message);
    this.name = "ReportableError";
    this.kind = kind;
    this.exitCode = exitCode;
  }
}
