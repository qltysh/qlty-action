import { readFileSync } from "fs";
import { join } from "path";

export default class Version {
  static get VERSION(): string {
    const packageJsonPath = join(__dirname, "../package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);
    return packageJson.version;
  }
}
