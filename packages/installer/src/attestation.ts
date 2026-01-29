import * as actionsExec from "@actions/exec";

export interface AttestationResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export interface AttestationVerifier {
  verify(filePath: string, owner: string): Promise<AttestationResult>;
}

export class GhAttestationVerifier implements AttestationVerifier {
  constructor(private token: string) {}

  async verify(filePath: string, owner: string): Promise<AttestationResult> {
    let output = "";

    const env: Record<string, string> = { GH_TOKEN: this.token };
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    const exitCode = await actionsExec.exec(
      "gh",
      ["attestation", "verify", filePath, "--owner", owner],
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

    if (exitCode === 0) {
      return { success: true };
    }

    // Exit code 4 indicates authentication failure - treat as skipped, not fatal
    if (exitCode === 4) {
      return {
        success: false,
        skipped: true,
        error:
          "GitHub CLI not authenticated. Attestation verification skipped.",
      };
    }

    return { success: false, error: output || "Verification failed" };
  }
}
