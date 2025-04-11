import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://76f58a921c9d8561646a586e7d9df772@o4506826106929152.ingest.us.sentry.io/4506826142646272",
  tracesSampleRate: 1.0,
});

import * as core from "@actions/core";

export async function runWithTracing(): Promise<void> {
  return await Sentry.startSpan(
    {
      op: "execute",
      name: "qlty-action/install",
    },
    async () => {
      Sentry.setTag("provider", "github");
      Sentry.setTag(
        "repository.full_name",
        process.env["GITHUB_REPOSITORY"] || "unknown"
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
          Sentry.captureException(error);
          Sentry.close(2000).then(function () {
            process.exit(1);
          });
        });
    }
  );
}

async function run(): Promise<void> {
  // TODO
}
