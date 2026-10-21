import * as actionsExec from "@actions/exec";

export interface AttestationResult {
  success: boolean;
  skipped?: boolean;
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
    const unusable = await this.unusableGhReason();
    if (unusable) {
      return { success: false, skipped: true, error: unusable };
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

    if (exitCode === 0) {
      return { success: true };
    }

    const detail = output.includes("HTTP 404")
      ? "No attestation was found for this archive."
      : output.trim() || "Verification failed.";
    return {
      success: false,
      error: `gh exited with code ${exitCode}. ${detail}`,
    };
  }

  private async unusableGhReason(): Promise<string | null> {
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
      return "GitHub CLI (gh) is not installed.";
    }

    const match = output.match(/gh version (\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      return "GitHub CLI (gh) did not report its version.";
    }

    const version = match.slice(1, 4).map(Number);
    if (isOlder(version, MINIMUM_GH_VERSION)) {
      return `GitHub CLI (gh) ${version.join(".")} is older than ${MINIMUM_GH_VERSION.join(".")}.`;
    }

    return null;
  }
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
