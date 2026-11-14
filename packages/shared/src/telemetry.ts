import * as core from "@actions/core";
import * as Sentry from "@sentry/node";
import type {
  ErrorEvent,
  Exception,
  NodeOptions,
  StackFrame,
} from "@sentry/node";
import path from "node:path";
import { errorText, ReportableError } from "./errors.js";
import Version from "./version.js";

const SENTRY_DSN =
  "https://76f58a921c9d8561646a586e7d9df772@o4506826106929152.ingest.us.sentry.io/4506826142646272";

type Env = Record<string, string | undefined>;

/**
 * Runs an action. Reads the `telemetry` input first, so QLTY_TELEMETRY=off
 * reaches every CLI the action starts. If `run` throws, including while it
 * builds the action from its inputs, the step fails and, when telemetry is
 * on, the error is reported.
 */
export async function runAction(
  action: "coverage" | "fmt",
  run: () => Promise<void>,
): Promise<void> {
  const telemetry = resolveTelemetry(core.getInput("telemetry"), process.env);
  if (telemetry.warning) {
    core.warning(telemetry.warning);
  }
  if (telemetry.enabled) {
    Sentry.init(sentryOptions(action, Version.readVersion()));
  }

  let exitCode = 0;
  try {
    await run();
  } catch (error) {
    core.setFailed(`Action failed with error: ${errorText(error)}`);
    Sentry.captureException(error);
    exitCode = 1;
  }

  // Waits up to 2 seconds for a report to send; returns at once when
  // telemetry is off. The explicit exit code keeps a skip-errors: true step
  // passing after the installer has called setFailed.
  await Sentry.close(2000);
  process.exit(exitCode);
}

export interface TelemetrySetting {
  enabled: boolean;
  warning?: string;
}

/**
 * Reads the `telemetry` input. Telemetry is off when the input is false or
 * the job sets QLTY_TELEMETRY=off. When the input is false, this sets
 * QLTY_TELEMETRY=off in `env` so the Qlty CLI's own telemetry is off too.
 * An unrecognized value turns telemetry off.
 */
export function resolveTelemetry(input: string, env: Env): TelemetrySetting {
  const value = input.trim();

  if (["", "true", "True", "TRUE"].includes(value)) {
    return { enabled: env["QLTY_TELEMETRY"] !== "off" };
  }

  env["QLTY_TELEMETRY"] = "off";

  if (["false", "False", "FALSE"].includes(value)) {
    return { enabled: false };
  }

  return {
    enabled: false,
    warning: `The telemetry input must be true or false, not "${value}". Telemetry is off.`,
  };
}

/**
 * Sentry options that send only the error's class, its failure kind and the
 * CLI's exit code, plus the action's name and version and the runner's OS
 * and Node.js version. Nothing is sent when the step succeeds.
 *
 * Options the SDK would otherwise read from the job's environment are set
 * here, because the customer's job controls that environment.
 */
export function sentryOptions(
  action: string,
  version: string | null,
): NodeOptions {
  return {
    dsn: SENTRY_DSN,
    // Unset, these come from GITHUB_SHA (the customer's commit) and
    // SENTRY_ENVIRONMENT.
    release: `qlty-action-${action}@${version ?? "unknown"}`,
    environment: "production",
    // Unset, SENTRY_SPOTLIGHT sends each report to a second URL and
    // SENTRY_DEBUG prints the error's message to the job log.
    spotlight: false,
    debug: false,
    // The default integrations add breadcrumbs, HTTP request URLs, a session
    // on every run, and details about the runner's machine.
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      // Fail the step on an unhandled rejection, as Node does without
      // Sentry, instead of only logging it.
      Sentry.onUnhandledRejectionIntegration({ mode: "strict" }),
      Sentry.nodeContextIntegration({
        app: false,
        device: false,
        culture: false,
        cloudResource: false,
      }),
    ],
    // No integration needs the ESM loader hook, and registering it from the
    // CommonJS bundle fails after starting a worker thread.
    registerEsmLoaderHooks: false,
    includeServerName: false,
    sendDefaultPii: false,
    sendClientReports: false,
    maxBreadcrumbs: 0,
    beforeSend: (event, hint) =>
      minimalEvent(event, hint.originalException, action),
    beforeSendTransaction: () => null,
  };
}

const KEPT_EVENT_FIELDS = [
  "event_id",
  "timestamp",
  "platform",
  "level",
  "release",
  "environment",
  "sdk",
] as const;

type KeptEventFields = Pick<ErrorEvent, (typeof KEPT_EVENT_FIELDS)[number]>;

/**
 * Rebuilds the event from an allowlist, so anything the SDK or other code
 * adds, such as the error's message, is dropped.
 */
function minimalEvent(
  event: ErrorEvent,
  error: unknown,
  action: string,
): ErrorEvent {
  const kept = Object.fromEntries(
    KEPT_EVENT_FIELDS.filter((field) => event[field] !== undefined).map(
      (field) => [field, event[field]],
    ),
  ) as KeptEventFields;

  const reportable = error instanceof ReportableError ? error : undefined;
  const tags: Record<string, string> = { action };
  if (reportable) {
    tags["error.kind"] = reportable.kind;
    if (typeof reportable.exitCode === "number") {
      tags["cli.exit_code"] = String(reportable.exitCode);
    }
  }

  const { os, runtime } = event.contexts ?? {};
  const contexts: NonNullable<ErrorEvent["contexts"]> = {};
  if (os) {
    contexts.os = os;
  }
  if (runtime) {
    contexts["runtime"] = runtime;
  }

  const minimal: ErrorEvent = { ...kept, type: undefined, tags, contexts };

  // The thrown error is the last value.
  const thrown = event.exception?.values?.at(-1);
  if (thrown) {
    minimal.exception = {
      values: [minimalException(thrown, error, reportable?.kind)],
    };
  }

  return minimal;
}

function minimalException(
  exception: Exception,
  error: unknown,
  kind: string | undefined,
): Exception {
  const minimal: Exception = {};

  if (exception.type !== undefined) {
    minimal.type = exception.type;
  }
  if (kind !== undefined) {
    minimal.value = kind;
  }
  if (exception.mechanism) {
    minimal.mechanism = { type: exception.mechanism.type };
    if (exception.mechanism.handled !== undefined) {
      minimal.mechanism.handled = exception.mechanism.handled;
    }
  }

  const frames = stackFrames(error);
  if (frames.length > 0) {
    minimal.stacktrace = { frames: frames.map(minimalFrame) };
  }

  return minimal;
}

/**
 * Parses the thrown error's stack frames without its message. V8 starts
 * `error.stack` with the message, which can hold CLI output, and the SDK's
 * parser turns any message line containing "at " into a frame. The SDK's
 * own frames are not used for that reason.
 */
function stackFrames(error: unknown): StackFrame[] {
  if (!(error instanceof Error) || typeof error.stack !== "string") {
    return [];
  }

  const { stack, message } = error;
  const start = stack.indexOf(message);
  // The message was changed after the stack was captured, so there is no
  // safe place to cut.
  if (start === -1) {
    return [];
  }

  return Sentry.defaultStackParser(stack.slice(start + message.length));
}

function minimalFrame(frame: StackFrame): StackFrame {
  const minimal: StackFrame = {};

  // A self-hosted runner's path can include a user name, so keep only the
  // file name. path.win32 splits on both "/" and "\".
  if (frame.filename !== undefined) {
    minimal.filename = path.win32.basename(frame.filename);
  }
  if (frame.function !== undefined) {
    minimal.function = frame.function;
  }
  if (frame.lineno !== undefined) {
    minimal.lineno = frame.lineno;
  }
  if (frame.colno !== undefined) {
    minimal.colno = frame.colno;
  }
  if (frame.in_app !== undefined) {
    minimal.in_app = frame.in_app;
  }

  return minimal;
}
