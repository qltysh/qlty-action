import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://76f58a921c9d8561646a586e7d9df772@o4506826106929152.ingest.us.sentry.io/4506826142646272",
  tracesSampleRate: 1.0,
});

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import { exec } from "@actions/exec";
import os from "os";

class FmtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FmtError";
  }
}

export async function runWithTracing(): Promise<void> {
  return await Sentry.startSpan(
    {
      op: "execute",
      name: "qlty-action/fmt",
    },
    async () => {
      Sentry.setTag("provider", "github");
      Sentry.setTag(
        "repository.full_name",
        process.env["GITHUB_REPOSITORY"] || "unknown",
      );
      Sentry.setContext("CI", {
        run_id: process.env["GITHUB_RUN_ID"],
        run_url: `${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}/actions/runs/${process.env["GITHUB_RUN_ID"]}`,
      });

      run()
        .then(() => {
          Sentry.close(2000).then(function () {
            process.exit(0);
          });
        })
        .catch((error) => {
          core.setFailed(`Action failed with error: ${error.name}`);
          Sentry.addBreadcrumb({
            category: "qlty-fmt.log",
            level: "log",
            type: "error",
            message: error.message,
          });
          Sentry.captureException(error);
          Sentry.close(2000).then(function () {
            process.exit(1);
          });
        });
    },
  );
}

async function run(): Promise<void> {
  const platform = os.platform();
  const arch = os.arch();

  let platformArch;

  if (platform === "linux" && arch === "x64") {
    platformArch = "x86_64-unknown-linux-gnu";
  } else if (platform === "linux" && arch === "arm64") {
    platformArch = "aarch64-unknown-linux-gnu";
  } else if (platform === "darwin" && arch === "x64") {
    platformArch = "x86_64-apple-darwin";
  } else if (platform === "darwin" && arch === "arm64") {
    platformArch = "aarch64-apple-darwin";
  } else {
    core.setFailed(`Unsupported platform/architecture: ${platform}/${arch}`);
    return;
  }

  const downloadUrl = `https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-${platformArch}.tar.xz`;

  const downloadedPath = await tc.downloadTool(downloadUrl);

  // Verify attestation (fatal on failure)
  core.info("Verifying sigstore attestation...");
  let verifyOutput = "";
  try {
    await exec(
      "gh",
      ["attestation", "verify", downloadedPath, "--owner", "qltysh"],
      {
        listeners: {
          stdout: (data: Buffer) => {
            verifyOutput += data.toString();
          },
          stderr: (data: Buffer) => {
            verifyOutput += data.toString();
          },
        },
      },
    );
    core.info("Attestation verified successfully");
  } catch {
    throw new FmtError(
      `Sigstore attestation verification failed: ${verifyOutput || "Unknown error"}`,
    );
  }

  const extractedFolder = await tc.extractTar(downloadedPath, undefined, "x");

  const cachedPath = await tc.cacheDir(extractedFolder, "qlty", "latest");
  const binPath = `${cachedPath}/qlty-${platformArch}`;
  core.addPath(binPath);

  // const commit = core.getBooleanInput('commit')

  let qlytOutput = "";

  try {
    await exec("qlty", ["fmt", "--all"], {
      listeners: {
        stdout: (data: Buffer) => {
          qlytOutput += data.toString();
        },
        stderr: (data: Buffer) => {
          qlytOutput += data.toString();
        },
      },
    });
  } catch {
    throw new FmtError(qlytOutput);
  }
}
