import * as actionsExec from "@actions/exec";

// Why the check didn't run. These values go to telemetry, so keep them fixed
// strings with no versions, paths or other details from the runner.
export type AttestationSkipReason =
  | "gh-missing"
  | "gh-too-old"
  | "gh-version-unknown";

export interface AttestationResult {
  success: boolean;
  skipped?: AttestationSkipReason;
  unavailable?: boolean;
  error?: string;
}

export interface AttestationVerifier {
  verify(filePath: string, owner: string): Promise<AttestationResult>;
}

export interface CommandRunner {
  exec(
    command: string,
    args: string[],
    options: actionsExec.ExecOptions,
  ): Promise<number>;
}

// gh 2.49.0 through 2.66.x can exit 0 when no attestation matches (CVE-2025-25204).
const MINIMUM_GH_VERSION = [2, 67, 0];

// gh exits 1 for most failures, so only its output tells an outage from a rejected archive.
const UNAVAILABLE_OUTPUT = [
  /HTTP 5\d\d\b/,
  /HTTP 429\b/,
  /rate limit exceeded/i,
  /timeout|deadline exceeded/i,
  /connection (reset|refused)/i,
  /\bEOF\b/,
  /stream error/i,
  /no such host|server misbehaving|name resolution/i,
  /network is unreachable|no route to host/i,
  /error creating Sigstore verifier/,
];

export class GhAttestationVerifier implements AttestationVerifier {
  private token: string;
  private runner: CommandRunner;
  private env: NodeJS.ProcessEnv;

  constructor(
    token: string,
    {
      runner = actionsExec,
      env = process.env,
    }: { runner?: CommandRunner; env?: NodeJS.ProcessEnv } = {},
  ) {
    this.token = token;
    this.runner = runner;
    this.env = env;
  }

  async verify(filePath: string, owner: string): Promise<AttestationResult> {
    const unusable = await this.unusableGh();
    if (unusable) {
      return { success: false, ...unusable };
    }

    const env: Record<string, string> = { GH_TOKEN: this.token };
    for (const [key, value] of Object.entries(this.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    let output = "";
    let exitCode: number;
    try {
      exitCode = await this.runner.exec(
        "gh",
        [
          "attestation",
          "verify",
          filePath,
          "--owner",
          owner,
          "--hostname",
          "github.com",
        ],
        {
          ignoreReturnCode: true,
          env,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message || "Verification failed" };
    }

    return ghVerifyResult(exitCode, output);
  }

  private async unusableGh(): Promise<{
    skipped: AttestationSkipReason;
    error: string;
  } | null> {
    let output = "";
    try {
      await this.runner.exec("gh", ["--version"], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });
    } catch {
      return {
        skipped: "gh-missing",
        error: "GitHub CLI (gh) is not installed.",
      };
    }

    const match = output.match(/gh version (\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      return {
        skipped: "gh-version-unknown",
        error: "GitHub CLI (gh) did not report its version.",
      };
    }

    const version = match.slice(1, 4).map(Number);
    if (isOlder(version, MINIMUM_GH_VERSION)) {
      return {
        skipped: "gh-too-old",
        error: `GitHub CLI (gh) ${version.join(".")} is older than ${MINIMUM_GH_VERSION.join(".")}.`,
      };
    }

    return null;
  }
}

// Turns the exit code and output of `gh attestation verify` into a result.
function ghVerifyResult(exitCode: number, output: string): AttestationResult {
  if (exitCode === 0) {
    return { success: true };
  }

  if (output.includes("HTTP 404")) {
    return {
      success: false,
      error: `gh exited with code ${exitCode}. No attestation was found for this archive.`,
    };
  }

  const error = `gh exited with code ${exitCode}. ${output.trim() || "Verification failed."}`;
  if (UNAVAILABLE_OUTPUT.some((pattern) => pattern.test(output))) {
    return { success: false, unavailable: true, error };
  }
  return { success: false, error };
}

function isOlder(version: number[], minimum: number[]): boolean {
  for (const [i, min] of minimum.entries()) {
    const part = version[i] ?? 0;
    if (part !== min) {
      return part < min;
    }
  }
  return false;
}
