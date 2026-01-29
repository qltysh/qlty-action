import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://76f58a921c9d8561646a586e7d9df772@o4506826106929152.ingest.us.sentry.io/4506826142646272",
  tracesSampleRate: 1.0,
});

import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { Installer } from "@qltysh-action/shared";

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
  const githubToken = core.getInput("github-token");
  const installer = Installer.create(githubToken);
  const qltyBinary = await installer.install();

  if (!qltyBinary) {
    throw new FmtError("Failed to install Qlty CLI");
  }

  let qltyOutput = "";

  try {
    await exec("qlty", ["fmt", "--all"], {
      listeners: {
        stdout: (data: Buffer) => {
          qltyOutput += data.toString();
        },
        stderr: (data: Buffer) => {
          qltyOutput += data.toString();
        },
      },
    });
  } catch {
    throw new FmtError(qltyOutput);
  }
}
