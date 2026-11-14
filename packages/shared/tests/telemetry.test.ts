import * as Sentry from "@sentry/node";
import os from "node:os";
import { ReportableError } from "../src/errors.js";
import { resolveTelemetry, sentryOptions } from "../src/telemetry.js";

describe("resolveTelemetry", () => {
  test.each(["", "true", "True", "TRUE", " true "])("is on for %j", (input) => {
    const env: Record<string, string> = {};

    expect(resolveTelemetry(input, env)).toEqual({ enabled: true });
    expect(env).toEqual({});
  });

  test.each(["false", "False", "FALSE"])(
    "is off for %j and turns off the CLI's telemetry",
    (input) => {
      const env: Record<string, string> = { QLTY_TELEMETRY: "all" };

      expect(resolveTelemetry(input, env)).toEqual({ enabled: false });
      expect(env).toEqual({ QLTY_TELEMETRY: "off" });
    },
  );

  test("is off when the job sets QLTY_TELEMETRY=off", () => {
    const env: Record<string, string> = { QLTY_TELEMETRY: "off" };

    expect(resolveTelemetry("true", env)).toEqual({ enabled: false });
    expect(env).toEqual({ QLTY_TELEMETRY: "off" });
  });

  test("leaves other QLTY_TELEMETRY values to the CLI", () => {
    const env: Record<string, string> = { QLTY_TELEMETRY: "errors" };

    expect(resolveTelemetry("true", env)).toEqual({ enabled: true });
    expect(env).toEqual({ QLTY_TELEMETRY: "errors" });
  });

  test("is off with a warning for an unrecognized value", () => {
    const env: Record<string, string> = {};

    expect(resolveTelemetry("no", env)).toEqual({
      enabled: false,
      warning:
        'The telemetry input must be true or false, not "no". Telemetry is off.',
    });
    expect(env).toEqual({ QLTY_TELEMETRY: "off" });
  });
});

describe("Sentry events", () => {
  const SECRET = "qltcp_secret_token";
  const CUSTOMER = "customer-org/customer-repo";
  const CUSTOMER_PATH = "/home/jdoe/work/customer-repo/coverage/lcov.info";
  const CUSTOMER_SHA = "0123456789abcdef0123456789abcdef01234567";
  const CUSTOMER_ENVIRONMENT = "customer-staging-pr-42";

  // CLI output as it appears in a CoverageError message. Lines containing
  // "at " are what the SDK's stack parser would turn into frames.
  const CLI_OUTPUT = [
    "Error executing coverage command. Output from the Qlty CLI follows:",
    `    Token: ${SECRET}`,
    `    0: Failed to parse coverage file at ${CUSTOMER_PATH} (os error 2)`,
    `    1: No such file or directory at ${CUSTOMER}/src/billing.ts:42:7`,
    "        at printAcmeNode (/home/jdoe/work/customer-repo/node_modules/acme/index.js:42:17)",
  ].join("\n");

  // Variables a customer's job can set that the SDK would otherwise read.
  const JOB_ENV: Record<string, string> = {
    GITHUB_SHA: CUSTOMER_SHA,
    SENTRY_ENVIRONMENT: CUSTOMER_ENVIRONMENT,
    SENTRY_SPOTLIGHT: "1",
  };

  // Text that must never appear anywhere in what is sent.
  const FORBIDDEN = [
    SECRET,
    CUSTOMER,
    CUSTOMER_PATH,
    CUSTOMER_SHA,
    CUSTOMER_ENVIRONMENT,
    "os error",
    "printAcmeNode",
    // A home directory of "/" would match any path.
    ...(os.homedir().length > 1 ? [os.homedir()] : []),
  ];

  class CoverageError extends ReportableError {
    constructor(message: string, exitCode?: number) {
      super(message, "cli_failed", exitCode);
      this.name = "CoverageError";
    }
  }

  let envelopes: string[];
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    envelopes = [];
    savedEnv = {};
    for (const [name, value] of Object.entries(JOB_ENV)) {
      savedEnv[name] = process.env[name];
      process.env[name] = value;
    }

    Sentry.init({
      ...sentryOptions("coverage", "2.6.0"),
      transport: (options) =>
        Sentry.createTransport(options, async (request) => {
          envelopes.push(
            typeof request.body === "string"
              ? request.body
              : new TextDecoder().decode(request.body),
          );
          return { statusCode: 200 };
        }),
    });

    // What the actions used to attach to every event.
    Sentry.setTag("repository.full_name", CUSTOMER);
    Sentry.setContext("CI", {
      run_url: `https://github.com/${CUSTOMER}/actions/runs/1`,
    });
    Sentry.setUser({ id: CUSTOMER });
    Sentry.setExtra("output", SECRET);
  });

  afterEach(async () => {
    await Sentry.close(2000);
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  async function capture(error: unknown): Promise<Record<string, unknown>> {
    Sentry.captureException(error);
    await Sentry.flush(2000);

    expect(envelopes).toHaveLength(1);
    const envelope = envelopes[0] ?? "";
    for (const text of FORBIDDEN) {
      expect(envelope).not.toContain(text);
    }

    const lines = envelope.split("\n");
    const eventIndex = lines.findIndex(
      (line) => line.startsWith("{") && JSON.parse(line).type === "event",
    );
    return JSON.parse(lines[eventIndex + 1] ?? "{}");
  }

  test("carries the class, kind and exit code, not the message", async () => {
    const event = await capture(new CoverageError(CLI_OUTPUT, 99));

    expect(Object.keys(event).sort()).toEqual([
      "contexts",
      "environment",
      "event_id",
      "exception",
      "level",
      "platform",
      "release",
      "sdk",
      "tags",
      "timestamp",
    ]);
    expect(event["release"]).toBe("qlty-action-coverage@2.6.0");
    expect(event["environment"]).toBe("production");
    expect(event["tags"]).toEqual({
      action: "coverage",
      "error.kind": "cli_failed",
      "cli.exit_code": "99",
    });
    expect(Object.keys(event["contexts"] as object).sort()).toEqual([
      "os",
      "runtime",
    ]);
    expect(
      (event["sdk"] as { integrations: string[] }).integrations,
    ).not.toContain("Spotlight");

    // No stacktrace: the SDK would parse frames out of the message.
    expect(event["exception"]).toEqual({
      values: [
        {
          type: "CoverageError",
          value: "cli_failed",
          mechanism: { type: "generic", handled: true },
        },
      ],
    });
  });

  test("leaves out the exit code when the CLI did not run", async () => {
    const event = await capture(new CoverageError("spawn ENOENT"));

    expect(event["tags"]).toEqual({
      action: "coverage",
      "error.kind": "cli_failed",
    });
  });

  test("carries only the class of any other error", async () => {
    const event = await capture(new TypeError(CLI_OUTPUT));

    expect(event["tags"]).toEqual({ action: "coverage" });
    expect(event["exception"]).toEqual({
      values: [
        { type: "TypeError", mechanism: { type: "generic", handled: true } },
      ],
    });
  });
});
