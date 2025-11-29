import * as core from "@actions/core";
import { Installer } from "./installer.js";

export async function run(): Promise<void> {
  try {
    const installer = Installer.create();
    const result = await installer.install();

    if (!result) {
      process.exit(1);
    }

    core.info(`Qlty CLI installed successfully: ${result}`);
  } catch (error) {
    core.setFailed(
      `Installation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
