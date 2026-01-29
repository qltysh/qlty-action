import type { OperatingSystem } from "./interfaces.js";

export type FileType = "tar.xz" | "zip";

export interface DownloadPlan {
  url: string;
  fileType: FileType;
  target: string;
  version: string;
  binaryName: string;
  extractComponent: string | null;
}

export function planDownload(
  os: OperatingSystem,
  version?: string,
): DownloadPlan | null {
  const platform = os.platform();
  const arch = os.arch();

  let target;
  let fileType: FileType;

  if (platform === "linux" && arch === "x64") {
    target = "x86_64-unknown-linux-gnu";
    fileType = "tar.xz";
  } else if (platform === "linux" && arch === "arm64") {
    target = "aarch64-unknown-linux-gnu";
    fileType = "tar.xz";
  } else if (platform === "darwin" && arch === "x64") {
    target = "x86_64-apple-darwin";
    fileType = "tar.xz";
  } else if (platform === "darwin" && arch === "arm64") {
    target = "aarch64-apple-darwin";
    fileType = "tar.xz";
  } else if (platform === "win32" && arch === "x64") {
    target = "x86_64-pc-windows-msvc";
    fileType = "zip";
  } else {
    return null;
  }

  const versionPath = version ? `v${version}` : "latest";

  return {
    url: `https://qlty-releases.s3.amazonaws.com/qlty/${versionPath}/qlty-${target}.${fileType}`,
    fileType,
    target,
    version: versionPath,
    binaryName: platform === "win32" ? "qlty.exe" : "qlty",
    extractComponent: platform === "win32" ? null : `qlty-${target}`,
  };
}
