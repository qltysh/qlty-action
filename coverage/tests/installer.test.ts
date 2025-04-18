import {
  Installer,
  StubbedOperatingSystem,
  StubbedToolCache,
} from "src/installer";
import { StubbedOutput } from "src/util/output";

describe("Installer", () => {
  test("installs linux x86", async () => {
    const { downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("linux", "x64"),
    });
    await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-unknown-linux-gnu.tar.xz",
    ]);
  });

  test("installs linux arm64", async () => {
    const { downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("linux", "arm64"),
    });
    await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-unknown-linux-gnu.tar.xz",
    ]);
  });

  test("installs darwin x64", async () => {
    const { downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("darwin", "x64"),
    });
    await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-apple-darwin.tar.xz",
    ]);
  });

  test("installs darwin arm64", async () => {
    const { downloads, installer } = createTrackedInstaller({
      os: new StubbedOperatingSystem("darwin", "arm64"),
    });
    await installer.install();
    expect(downloads.clear()).toEqual([
      "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-aarch64-apple-darwin.tar.xz",
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

  test("adds to the $PATH", async () => {
    const { output, installer } = createTrackedInstaller();
    await installer.install();
    expect(output.paths).toEqual([
      "cached[extracted[downloaded[https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-unknown-linux-gnu.tar.xz] dest=undefined options=x]]/qlty-x86_64-unknown-linux-gnu",
    ]);
  });

  function createTrackedInstaller({
    toolCache = new StubbedToolCache(),
    os = new StubbedOperatingSystem(),
    output = new StubbedOutput(),
    version = undefined,
  }: {
    toolCache?: StubbedToolCache;
    os?: StubbedOperatingSystem;
    output?: StubbedOutput;
    version?: string;
  } = {}) {
    const installer = new Installer(os, output, toolCache, version);
    const downloads = installer.trackOutput();
    return { installer, downloads, output };
  }
});
