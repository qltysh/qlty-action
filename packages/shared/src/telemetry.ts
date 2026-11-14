import * as Sentry from "@sentry/node";
import type {
  ErrorEvent,
  Exception,
  NodeOptions,
  StackFrame,
} from "@sentry/node";
import path from "node:path";
import { ReportableError } from "./errors.js";

const SENTRY_DSN =
  "https://76f58a921c9d8561646a586e7d9df772@o4506826106929152.ingest.us.sentry.io/4506826142646272";

type Env = Record<string, string | undefined>;

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
 */
export function sentryOptions(
  action: string,
  version: string | null,
): NodeOptions {
  return {
    dsn: SENTRY_DSN,
    // Without a release, the SDK uses GITHUB_SHA, the customer's commit.
    release: `qlty-action-${action}@${version ?? "unknown"}`,
    // The default integrations add breadcrumbs, HTTP request URLs, a session
    // on every run, and details about the runner's machine.
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      Sentry.nodeContextIntegration({
        app: false,
        device: false,
        culture: false,
        cloudResource: false,
      }),
    ],
    includeServerName: false,
    sendDefaultPii: false,
    sendClientReports: false,
    maxBreadcrumbs: 0,
    beforeSend: (event, hint) =>
      minimalEvent(event, hint.originalException, action),
    beforeSendTransaction: () => null,
  };
}

export function startTelemetry(action: string, version: string | null): void {
  Sentry.init(sentryOptions(action, version));
}

export async function reportError(error: unknown): Promise<void> {
  Sentry.captureException(error);
  await closeTelemetry();
}

export async function closeTelemetry(): Promise<void> {
  await Sentry.close(2000);
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
export function minimalEvent(
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
    if (reportable.exitCode !== undefined) {
      tags["cli.exit_code"] = String(reportable.exitCode);
    }
  }

  // The thrown error is the last value; earlier values are its causes.
  const values = event.exception?.values ?? [];
  const exceptions = values.map((value, index) =>
    minimalException(
      value,
      index === values.length - 1 ? reportable?.kind : undefined,
    ),
  );

  const { os, runtime } = event.contexts ?? {};
  const contexts: NonNullable<ErrorEvent["contexts"]> = {};
  if (os) {
    contexts.os = os;
  }
  if (runtime) {
    contexts["runtime"] = runtime;
  }

  return {
    ...kept,
    type: undefined,
    exception: { values: exceptions },
    tags,
    contexts,
  };
}

function minimalException(
  exception: Exception,
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
  if (exception.stacktrace?.frames) {
    minimal.stacktrace = {
      frames: exception.stacktrace.frames.map(minimalFrame),
    };
  }

  return minimal;
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
