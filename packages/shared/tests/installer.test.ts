import path from "node:path";
import {
  Installer,
  StubbedOperatingSystem,
  StubbedToolCache,
  StubbedOutput,
  StubbedAttestationVerifier,
} from "../src/index.js";

describe("Installer", () => {
  test("installs linux x86", async () => {
    const { output, downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("linux", "x64"),
    });
    const qltyBinary = await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-unknown-linux-gnu.tar.xz",
    ]);
    expect(qltyBinary).toEqual("qlty");
    expect(output.paths).toEqual([
      `cacheDir[extractTar[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-unknown-linux-gnu.tar.xz] dest=undefined options=x]]${path.sep}qlty-x86_64-unknown-linux-gnu`,
    ]);
  });

  test("installs linux arm64", async () => {
    const { output, downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("linux", "arm64"),
    });
    const qltyBinary = await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-unknown-linux-gnu.tar.xz",
    ]);
    expect(qltyBinary).toEqual("qlty");
    expect(output.paths).toEqual([
      `cacheDir[extractTar[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-unknown-linux-gnu.tar.xz] dest=undefined options=x]]${path.sep}qlty-aarch64-unknown-linux-gnu`,
    ]);
  });

  test("installs darwin x64", async () => {
    const { output, downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("darwin", "x64"),
    });
    const qltyBinary = await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-apple-darwin.tar.xz",
    ]);
    expect(qltyBinary).toEqual("qlty");
    expect(output.paths).toEqual([
      `cacheDir[extractTar[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-apple-darwin.tar.xz] dest=undefined options=x]]${path.sep}qlty-x86_64-apple-darwin`,
    ]);
  });

  test("installs darwin arm64", async () => {
    const { output, downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("darwin", "arm64"),
    });
    const qltyBinary = await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-apple-darwin.tar.xz",
    ]);
    expect(qltyBinary).toEqual("qlty");
    expect(output.paths).toEqual([
      `cacheDir[extractTar[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-apple-darwin.tar.xz] dest=undefined options=x]]${path.sep}qlty-aarch64-apple-darwin`,
    ]);
  });

  test("installs windows x64", async () => {
    const { output, downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("win32", "x64"),
    });
    const qltyBinary = await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-pc-windows-msvc.zip",
    ]);
    expect(qltyBinary).toEqual("qlty.exe");
    expect(output.paths).toEqual([
      `cacheDir[extractZip[downloadTool[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-pc-windows-msvc.zip] dest=undefined options=undefined]]`,
    ]);
  });

  test("installs specific version", async () => {
    const { downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("linux", "x64"),
      version: "1.2.3",
    });
    await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/v1.2.3/qlty-x86_64-unknown-linux-gnu.tar.xz",
    ]);
  });

  test("rejects unknown OS", async () => {
    const { output, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("unknown", "unknown"),
    });
    await installer.install();
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
      await expect(installer.install()).rejects.toMatchObject({
        name: "AttestationError",
        kind: "rejected",
        message: "Sigstore attestation verification failed: Stubbed failure",
      });
      expect(output.paths).toEqual([]);
    });

    test("fails with the unavailable kind when verification cannot run", async () => {
      const { output, installer } = createTrackedInstaller({
        os: new StubbedOperatingSystem("linux", "x64"),
        attestationVerifier: new StubbedAttestationVerifier("unavailable"),
      });
      await expect(installer.install()).rejects.toMatchObject({
        name: "AttestationError",
        kind: "unavailable",
        message:
          "Sigstore attestation verification was unavailable: Stubbed outage",
      });
      expect(output.paths).toEqual([]);
    });

    test("treats a failure without a kind as rejected", async () => {
      const installer = new Installer(
        new StubbedOperatingSystem("linux", "x64"),
        new StubbedOutput(),
        new StubbedToolCache(),
        { verify: async () => ({ success: false, error: "Legacy failure" }) },
      );
      await expect(installer.install()).rejects.toMatchObject({
        kind: "rejected",
        message: "Sigstore attestation verification failed: Legacy failure",
      });
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

    test("warns that the run is unverified but installs when gh is missing", async () => {
      const { output, downloads, installer } = createTrackedInstaller({
        os: new StubbedOperatingSystem("linux", "x64"),
        attestationVerifier: new StubbedAttestationVerifier("gh-missing"),
      });
      const result = await installer.install();
      expect(result).toBe("qlty");
      expect(downloads.clear()).toHaveLength(1);
      expect(output.failures).toEqual([]);
      expect(output.warnings).toEqual([
        {
          title: "Attestation Verification Skipped",
          message:
            "Sigstore attestation verification was skipped, so this run is unverified. GitHub CLI (gh) is not installed. Install GitHub CLI 2.67.0 or later to verify the Qlty CLI.",
        },
      ]);
    });
  });

  function createTrackedInstaller({
    toolCache = new StubbedToolCache(),
    os = new StubbedOperatingSystem(),
    output = new StubbedOutput(),
    attestationVerifier = new StubbedAttestationVerifier("success"),
    version = undefined,
  }: {
    toolCache?: StubbedToolCache;
    os?: StubbedOperatingSystem;
    output?: StubbedOutput;
    attestationVerifier?: StubbedAttestationVerifier;
    version?: string;
  } = {}) {
    const installer = new Installer(
      os,
      output,
      toolCache,
      attestationVerifier,
      version,
    );
    const downloads = installer.trackOutput();
    return { installer, downloads, output, attestationVerifier };
  }
});
