import path from "node:path";
import {
  Installer,
  StubbedOperatingSystem,
  StubbedToolCache,
} from "src/installer";
import { StubbedOutput } from "src/util/output";

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
