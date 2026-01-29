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
      const result = await installer.install();
      expect(result).toBeNull();
      expect(output.failures).toEqual([
        "Sigstore attestation verification failed: Stubbed failure",
      ]);
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

    test("warns but proceeds when gh CLI is not authenticated", async () => {
      const { output, installer } = createTrackedInstaller({
        os: new StubbedOperatingSystem("linux", "x64"),
        attestationVerifier: new StubbedAttestationVerifier("auth-failure"),
      });
      const result = await installer.install();
      expect(result).toBe("qlty");
      expect(output.failures).toEqual([]);
      expect(output.warnings).toHaveLength(1);
      expect(output.warnings[0]?.title).toBe(
        "Attestation Verification Skipped",
      );
      expect(output.warnings[0]?.message).toContain("not authenticated");
    });
  });

  function createTrackedInstaller({
    toolCache = new StubbedToolCache(),
    os = new StubbedOperatingSystem(),
    output = new StubbedOutput(),
    attestationVerifier = new StubbedAttestationVerifier("success"),
  }: {
    toolCache?: StubbedToolCache;
    os?: StubbedOperatingSystem;
    output?: StubbedOutput;
    attestationVerifier?: StubbedAttestationVerifier;
  } = {}) {
    const installer = new Installer(os, output, toolCache, attestationVerifier);
    return { installer, toolCache, output, attestationVerifier };
  }
});
