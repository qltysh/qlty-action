import { setTag } from "@sentry/node";

// The part of the Sentry API the action uses. Tags go to Sentry, so a value
// must never contain a token, a path or other customer data.
export interface Telemetry {
  setTag(key: string, value: string): void;
}

// A named import rather than the Sentry namespace, so esbuild can still drop
// the parts of @sentry/node the action doesn't use.
export const sentryTelemetry: Telemetry = { setTag };

export class StubbedTelemetry implements Telemetry {
  tags: Record<string, string> = {};

  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }
}
