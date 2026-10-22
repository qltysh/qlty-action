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
    { exitCode: 1, output: "error creating Sigstore verifier" },
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

  function createVerifier(
    runner: StubbedGhRunner,
    env: Record<string, string> = {},
  ): GhAttestationVerifier {
    return new GhAttestationVerifier("token", { runner, env });
  }
});
