import { GhAttestationVerifier, StubbedGhRunner } from "../src/index.js";

describe("GhAttestationVerifier", () => {
  test("verifies when gh exits 0", async () => {
    const runner = new StubbedGhRunner({ verify: { exitCode: 0 } });
    const result = await createVerifier(runner).verify("qlty.tar.xz", "qltysh");
    expect(result).toEqual({ success: true });
  });

  test("passes the archive, owner and github.com hostname to gh", async () => {
    const runner = new StubbedGhRunner({ verify: { exitCode: 0 } });
    await createVerifier(runner, { GH_HOST: "ghes.example.com" }).verify(
      "qlty.tar.xz",
      "qltysh",
    );
    expect(runner.calls[1]).toMatchObject({
      command: "gh",
      args: [
        "attestation",
        "verify",
        "qlty.tar.xz",
        "--owner",
        "qltysh",
        "--hostname",
        "github.com",
      ],
      env: { GH_TOKEN: "token", GH_HOST: "ghes.example.com" },
    });
  });

  test("skips when gh is not installed", async () => {
    const runner = new StubbedGhRunner({
      version: { spawnError: "Unable to locate executable file: gh" },
    });
    const result = await createVerifier(runner).verify("qlty.tar.xz", "qltysh");
    expect(result).toEqual({
      success: false,
      skipped: true,
      error: "GitHub CLI (gh) is not installed.",
    });
  });

  test.each(["2.66.0", "2.45.0"])(
    "skips without verifying when gh %s is older than 2.67.0",
    async (version) => {
      const runner = new StubbedGhRunner({
        version: { output: `gh version ${version} (2025-01-01)\n` },
        verify: { exitCode: 0 },
      });
      const result = await createVerifier(runner).verify(
        "qlty.tar.xz",
        "qltysh",
      );
      expect(result).toEqual({
        success: false,
        skipped: true,
        error: `GitHub CLI (gh) ${version} is older than 2.67.0.`,
      });
      expect(runner.calls).toHaveLength(1);
    },
  );

  test("fails when gh finds no attestation for the archive", async () => {
    const runner = new StubbedGhRunner({
      verify: {
        exitCode: 1,
        output:
          "Error: HTTP 404: Not Found (https://api.github.com/orgs/qltysh/attestations/sha256:abc)\n",
      },
    });
    const result = await createVerifier(runner).verify("qlty.tar.xz", "qltysh");
    expect(result).toEqual({
      success: false,
      error:
        "gh exited with code 1. No attestation was found for this archive.",
    });
  });

  test.each([
    { exitCode: 1, output: "HTTP 401: Bad credentials" },
    { exitCode: 1, output: "Error: no attestations found" },
    { exitCode: 1, output: 'Error: verifying with issuer "sigstore.dev"' },
    {
      exitCode: 1,
      output:
        'Error: Get "https://api.github.com/orgs/qltysh/attestations/sha256:abc": tls: failed to verify certificate: x509: certificate signed by unknown authority',
    },
    {
      exitCode: 4,
      output: "To get started with GitHub CLI, please run: gh auth login",
    },
    { exitCode: 127, output: "gh: not found" },
  ])("fails when gh exits $exitCode", async ({ exitCode, output }) => {
    const runner = new StubbedGhRunner({
      verify: { exitCode, output: `${output}\n` },
    });
    const result = await createVerifier(runner).verify("qlty.tar.xz", "qltysh");
    expect(result).toEqual({
      success: false,
      error: `gh exited with code ${exitCode}. ${output}`,
    });
  });

  test.each([
    "Error: HTTP 500: Internal Server Error (https://api.github.com/orgs/qltysh/attestations/sha256:abc)",
    "Error: HTTP 502: 502 Bad Gateway (https://api.github.com/orgs/qltysh/attestations/sha256:abc)",
    "Error: HTTP 503: Service Unavailable (https://api.github.com/orgs/qltysh/attestations/sha256:abc)",
    "Error: HTTP 429: Too Many Requests (https://api.github.com/orgs/qltysh/attestations/sha256:abc)",
    "Error: HTTP 403: API rate limit exceeded for installation ID 1. (https://api.github.com/orgs/qltysh/attestations/sha256:abc)",
    'Error: Get "https://api.github.com/orgs/qltysh/attestations/sha256:abc": net/http: request canceled while waiting for connection (Client.Timeout exceeded while awaiting headers)',
    'Error: Get "https://api.github.com/orgs/qltysh/attestations/sha256:abc": read tcp 10.0.0.2:50000->140.82.112.6:443: read: connection reset by peer',
    'Error: Get "https://api.github.com/orgs/qltysh/attestations/sha256:abc": EOF',
    'Error: Get "https://api.github.com/orgs/qltysh/attestations/sha256:abc": stream error: stream ID 1; INTERNAL_ERROR; received from peer',
    'Error: Get "https://api.github.com/orgs/qltysh/attestations/sha256:abc": dial tcp: lookup api.github.com on 127.0.0.53:53: server misbehaving',
    "error creating Sigstore verifier: no valid Sigstore verifiers could be initialized",
  ])("reports the check as unavailable when gh prints %s", async (output) => {
    const runner = new StubbedGhRunner({
      verify: { exitCode: 1, output: `${output}\n` },
    });
    const result = await createVerifier(runner).verify("qlty.tar.xz", "qltysh");
    expect(result).toEqual({
      success: false,
      unavailable: true,
      error: `gh exited with code 1. ${output}`,
    });
  });

  function createVerifier(
    runner: StubbedGhRunner,
    env: Record<string, string> = {},
  ): GhAttestationVerifier {
    return new GhAttestationVerifier("token", { runner, env });
  }
});
