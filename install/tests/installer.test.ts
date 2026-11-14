import path from "node:path";
import {
  Installer,
  StubbedOperatingSystem,
  StubbedToolCache,
  StubbedOutput,
  StubbedAttestationVerifier,
} from "../src/installer.js";

describe("Installer", () => {
  test("installs linux x86", async () => {
    const { output, toolCache, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("linux", "x64"),
    });
    const qltyBinary = await installer.install();
    expect(toolCache.downloads).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-unknown-linux-gnu.tar.xz",
    ]);
    expect(qltyBinary).toEqual("qlty");
    expect(output.paths).toEqual([
      `cacheDir[extractTar[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-unknown-linux-gnu.tar.xz] dest=undefined options=x]]${path.sep}qlty-x86_64-unknown-linux-gnu`,
    ]);
  });

  test("installs linux arm64", async () => {
    const { output, toolCache, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("linux", "arm64"),
    });
    const qltyBinary = await installer.install();
    expect(toolCache.downloads).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-unknown-linux-gnu.tar.xz",
    ]);
    expect(qltyBinary).toEqual("qlty");
    expect(output.paths).toEqual([
      `cacheDir[extractTar[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-unknown-linux-gnu.tar.xz] dest=undefined options=x]]${path.sep}qlty-aarch64-unknown-linux-gnu`,
    ]);
  });

  test("installs darwin x64", async () => {
    const { output, toolCache, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("darwin", "x64"),
    });
    const qltyBinary = await installer.install();
    expect(toolCache.downloads).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-apple-darwin.tar.xz",
    ]);
    expect(qltyBinary).toEqual("qlty");
    expect(output.paths).toEqual([
      `cacheDir[extractTar[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-apple-darwin.tar.xz] dest=undefined options=x]]${path.sep}qlty-x86_64-apple-darwin`,
    ]);
  });

  test("installs darwin arm64", async () => {
    const { output, toolCache, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("darwin", "arm64"),
    });
    const qltyBinary = await installer.install();
    expect(toolCache.downloads).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-apple-darwin.tar.xz",
    ]);
    expect(qltyBinary).toEqual("qlty");
    expect(output.paths).toEqual([
      `cacheDir[extractTar[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-apple-darwin.tar.xz] dest=undefined options=x]]${path.sep}qlty-aarch64-apple-darwin`,
    ]);
  });

  test("installs windows x64", async () => {
    const { output, toolCache, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("win32", "x64"),
    });
    const qltyBinary = await installer.install();
    expect(toolCache.downloads).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-pc-windows-msvc.zip",
    ]);
    expect(qltyBinary).toEqual("qlty.exe");
    expect(output.paths).toEqual([
      `cacheDir[extractZip[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-pc-windows-msvc.zip] dest=undefined options=undefined]]`,
    ]);
  });

  test("rejects unknown OS", async () => {
    const { output, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("unknown", "unknown"),
    });
    const result = await installer.install();
    expect(result).toBeNull();
    expect(output.failures).toEqual([
      "Unsupported platform/architecture: unknown/unknown",
    ]);
  });

  describe("Attestation verification", () => {
    test("fails when attestation verification fails", async () => {
      const { output, installer } = createTrackedInstaller({
        os: new StubbedOperatingSystem("linux", "x64"),
        attestationVerifier: new StubbedAttestationVerifier("fail"),
      });
      await expect(installer.install()).rejects.toThrow(
        "Sigstore attestation verification failed: Stubbed failure",
      );
      expect(output.paths).toEqual([]);
    });

    test("succeeds when attestation passes", async () => {
      const attestationVerifier = new StubbedAttestationVerifier("success");
      const { installer } = createTrackedInstaller({
        os: new StubbedOperatingSystem("linux", "x64"),
        attestationVerifier,
      });
      const result = await installer.install();
      expect(result).toBe("qlty");
      expect(attestationVerifier.verifiedFiles).toHaveLength(1);
    });

    test("verifies the downloaded archive path", async () => {
      const attestationVerifier = new StubbedAttestationVerifier("success");
      const { installer } = createTrackedInstaller({
        os: new StubbedOperatingSystem("linux", "x64"),
        attestationVerifier,
      });
      await installer.install();
      expect(attestationVerifier.verifiedFiles[0]).toContain("downloadTool[");
    });

    test("installs without verifying when verify-attestation is false", async () => {
      const attestationVerifier = new StubbedAttestationVerifier("fail");
      const { output, installer } = createTrackedInstaller({
        os: new StubbedOperatingSystem("linux", "x64"),
        attestationVerifier,
        verifyAttestation: false,
      });
      const result = await installer.install();
      expect(result).toBe("qlty");
      expect(output.paths).toHaveLength(1);
      expect(attestationVerifier.verifiedFiles).toEqual([]);
      expect(output.warnings).toEqual([
        {
          title: "Attestation verification turned off",
          message:
            "Skipped verifying the Qlty CLI's attestation because verify-attestation is false, so this run uses a Qlty CLI that was not verified.",
        },
      ]);
    });

    test("logs the check that verified the CLI", async () => {
      const { output, installer } = createTrackedInstaller({
        os: new StubbedOperatingSystem("linux", "x64"),
      });
      await installer.install();
      expect(output.infos).toEqual([
        "Verifying the Qlty CLI's Sigstore attestation in the action (no GitHub CLI needed)...",
        "Verified the Qlty CLI: SLSA provenance for sha256:0123abcd, signed by https://github.com/qltysh/qlty/.github/workflows/build.yml@refs/heads/main",
      ]);
      expect(output.warnings).toEqual([]);
    });

    test("verifies unless verify-attestation is false", async () => {
      await expect(
        Installer.createNull({ attestationBehavior: "fail" }).install(),
      ).rejects.toThrow("Sigstore attestation verification failed");
    });
  });

  function createTrackedInstaller({
    toolCache = new StubbedToolCache(),
    os = new StubbedOperatingSystem(),
    output = new StubbedOutput(),
    attestationVerifier = new StubbedAttestationVerifier("success"),
    verifyAttestation = true,
  }: {
    toolCache?: StubbedToolCache;
    os?: StubbedOperatingSystem;
    output?: StubbedOutput;
    attestationVerifier?: StubbedAttestationVerifier;
    verifyAttestation?: boolean;
  } = {}) {
    const installer = new Installer(
      os,
      output,
      toolCache,
      attestationVerifier,
      undefined,
      verifyAttestation,
    );
    return { installer, toolCache, output, attestationVerifier };
  }
});
