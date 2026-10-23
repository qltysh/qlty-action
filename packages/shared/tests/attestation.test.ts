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

  test("rejects when gh finds no attestation for the archive", async () => {
    const runner = new StubbedGhRunner({
      verify: {
        exitCode: 1,
        output:
          "Error: HTTP 404: Not Found (https://api.github.com/orgs/qltysh/attestations/sha256:abc?per_page=30&predicate_type=https%3A%2F%2Fslsa.dev%2Fprovenance%2Fv1)\n",
      },
    });
    const result = await createVerifier(runner).verify("qlty.tar.xz", "qltysh");
    expect(result).toEqual({
      success: false,
      kind: "rejected",
      error:
        "gh exited with code 1. No attestation was found for this archive.",
    });
  });

  test.each([
    {
      name: "a tampered signature or a policy mismatch",
      output: 'Error: verifying with issuer "sigstore.dev"',
    },
    {
      name: "an empty attestation list",
      output: "Error: no attestations found",
    },
    {
      name: "attestations that all fail",
      output: "Error: no attestations were verified",
    },
    {
      name: "text it does not recognize",
      output: "Error: something a future gh might say",
    },
  ])("rejects on $name", async ({ output }) => {
    const runner = new StubbedGhRunner({
      verify: { exitCode: 1, output: `${output}\n` },
    });
    const result = await createVerifier(runner).verify("qlty.tar.xz", "qltysh");
    expect(result).toEqual({
      success: false,
      kind: "rejected",
      error: `gh exited with code 1. ${output}`,
    });
  });

  test.each([
    {
      name: "a bad token",
      exitCode: 1,
      output:
        "Error: HTTP 401: Bad credentials (https://api.github.com/orgs/qltysh/attestations/sha256:abc?per_page=30)",
    },
    {
      name: "a rate limit",
      exitCode: 1,
      output:
        "Error: HTTP 403: API rate limit exceeded for installation ID 1. (https://api.github.com/orgs/qltysh/attestations/sha256:abc)",
    },
    {
      name: "a GitHub API outage",
      exitCode: 1,
      output:
        "Error: HTTP 502: Bad Gateway (https://api.github.com/orgs/qltysh/attestations/sha256:abc)",
    },
    {
      name: "an unreachable GitHub API",
      exitCode: 1,
      output:
        'Error: Get "https://api.github.com/orgs/qltysh/attestations/sha256:abc?per_page=30": dial tcp 140.82.112.5:443: connect: connection refused',
    },
    {
      name: "an unreachable bundle store",
      exitCode: 1,
      output:
        'Error: failed to fetch bundle with URL: failed to fetch bundle with URL: request to fetch bundle from URL failed: Get "https://tmaproduction.blob.core.windows.net/attestations/1/2026/10/22/1.json.sn?sig=x": Bad Gateway',
    },
    {
      name: "an unreachable Sigstore TUF repository",
      exitCode: 1,
      output:
        "Error: failed to choose verifier based on provided bundle issuer: public good verifier is not available (initialization may have failed)",
    },
    {
      name: "no reachable trust roots",
      exitCode: 1,
      output:
        "Error: error creating Sigstore verifier: no valid Sigstore verifiers could be initialized",
    },
    {
      name: "no token",
      exitCode: 4,
      output:
        "To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.",
    },
  ])(
    "reports verification unavailable on $name",
    async ({ exitCode, output }) => {
      const runner = new StubbedGhRunner({
        verify: { exitCode, output: `${output}\n` },
      });
      const result = await createVerifier(runner).verify(
        "qlty.tar.xz",
        "qltysh",
      );
      expect(result).toEqual({
        success: false,
        kind: "unavailable",
        error: `gh exited with code ${exitCode}. ${output}`,
      });
    },
  );

  test("reports verification unavailable when gh cannot be started", async () => {
    const runner = new StubbedGhRunner({
      verify: { spawnError: "spawn gh EAGAIN" },
    });
    const result = await createVerifier(runner).verify("qlty.tar.xz", "qltysh");
    expect(result).toEqual({
      success: false,
      kind: "unavailable",
      error: "spawn gh EAGAIN",
    });
  });

  function createVerifier(
    runner: StubbedGhRunner,
    env: Record<string, string> = {},
  ): GhAttestationVerifier {
    return new GhAttestationVerifier("token", { runner, env });
  }
});
