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
  const CUSTOMER_SHA = "0123456789abcdef0123456789abcdef01234567";

  class CoverageError extends ReportableError {
    constructor(message: string, exitCode?: number) {
      super(message, "cli_failed", exitCode);
      this.name = "CoverageError";
    }
  }

  let envelopes: string[];
  let githubSha: string | undefined;

  beforeEach(() => {
    envelopes = [];
    githubSha = process.env["GITHUB_SHA"];
    process.env["GITHUB_SHA"] = CUSTOMER_SHA;

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
    if (githubSha === undefined) {
      delete process.env["GITHUB_SHA"];
    } else {
      process.env["GITHUB_SHA"] = githubSha;
    }
  });

  async function capture(error: unknown): Promise<Record<string, unknown>> {
    Sentry.captureException(error);
    await Sentry.flush(2000);

    expect(envelopes).toHaveLength(1);
    const envelope = envelopes[0] ?? "";
    for (const text of [SECRET, CUSTOMER, CUSTOMER_SHA, os.homedir()]) {
      expect(envelope).not.toContain(text);
    }

    const lines = envelope.split("\n");
    const eventIndex = lines.findIndex(
      (line) => line.startsWith("{") && JSON.parse(line).type === "event",
    );
    return JSON.parse(lines[eventIndex + 1] ?? "{}");
  }

  test("carries the class, kind and exit code, not the message", async () => {
    const event = await capture(
      new CoverageError(
        `Error executing coverage command. Output from the Qlty CLI follows:; Token: ${SECRET}`,
        99,
      ),
    );

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
    expect(event["tags"]).toEqual({
      action: "coverage",
      "error.kind": "cli_failed",
      "cli.exit_code": "99",
    });
    expect(Object.keys(event["contexts"] as object).sort()).toEqual([
      "os",
      "runtime",
    ]);

    const [exception] = (event["exception"] as { values: object[] }).values;
    expect(exception).toMatchObject({
      type: "CoverageError",
      value: "cli_failed",
      mechanism: { type: "generic", handled: true },
    });

    const frames = (
      exception as { stacktrace: { frames: Record<string, unknown>[] } }
    ).stacktrace.frames;
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(
        Object.keys(frame).every((key) =>
          ["filename", "function", "lineno", "colno", "in_app"].includes(key),
        ),
      ).toBe(true);
      expect(frame["filename"]).not.toMatch(/[/\\]/);
    }
  });

  test("leaves out the exit code when the CLI did not run", async () => {
    const event = await capture(new CoverageError("spawn ENOENT"));

    expect(event["tags"]).toEqual({
      action: "coverage",
      "error.kind": "cli_failed",
    });
  });

  test("carries only the class of any other error", async () => {
    const event = await capture(new TypeError(`fetch ${SECRET} failed`));

    expect(event["tags"]).toEqual({ action: "coverage" });
    const [exception] = (event["exception"] as { values: object[] }).values;
    expect(exception).toMatchObject({ type: "TypeError" });
    expect(exception).not.toHaveProperty("value");
  });
});
