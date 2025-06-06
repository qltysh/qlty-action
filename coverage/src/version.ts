import path from "path";
import * as nodeFs from "fs";

export default class Version {
  static readVersion(
    fileSystem?: SyncFileSystem,
    logger: Logger = console,
  ): string | null {
    // This is coded defensively if there is an error reading the version
    // because it is non-critical debugging information.
    try {
      const fs = fileSystem ?? nodeFs;
      const packageJsonPath = path.join(__dirname, "../package.json");
      const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);
      return packageJson.version;
    } catch (error) {
      logger.error("Error reading version from package.json:", error);
      return null;
    }
  }
}

interface SyncFileSystem {
  readFileSync: (path: string, encoding: string) => string;
}

interface Logger {
  error: (message: string, ...args: unknown[]) => void;
}
