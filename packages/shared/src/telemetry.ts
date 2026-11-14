import * as core from "@actions/core";
import * as Sentry from "@sentry/node";
import type { ErrorEvent, Exception, NodeOptions } from "@sentry/node";
import { errorText, ReportableError } from "./errors.js";
import { isAttestationOutcome, type AttestationOutcome } from "./installer.js";
import Version from "./version.js";

const SENTRY_DSN =
  "https://76f58a921c9d8561646a586e7d9df772@o4506826106929152.ingest.us.sentry.io/4506826142646272";

type Env = Record<string, string | undefined>;

const ATTESTATION_TAG = "attestation";

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

/**
 * Records the outcome of the Qlty CLI's attestation check. An error report
 * sent later in the run carries it. A run that succeeds still sends nothing.
 */
export function recordAttestation(outcome: AttestationOutcome): void {
  Sentry.setTag(ATTESTATION_TAG, outcome);
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
 * Sentry options that send only the error's class, its failure kind, the
 * CLI's exit code and the attestation check's outcome, plus the action's name
 * and version and the runner's OS and Node.js version, with no stack trace.
 * Nothing is sent when the step succeeds.
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
  // Set by recordAttestation. Any value other than a known outcome is dropped.
  const attestation = event.tags?.[ATTESTATION_TAG];
  if (isAttestationOutcome(attestation)) {
    tags[ATTESTATION_TAG] = attestation;
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
      values: [minimalException(thrown, reportable?.kind)],
    };
  }

  return minimal;
}

// No stack trace is sent. The SDK parses frames out of `error.stack`, which
// starts with the error's message, so any message line containing "at "
// becomes a frame, and messages can hold CLI output. Without frames, Sentry
// groups reports by their type and kind.
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

  return minimal;
}
