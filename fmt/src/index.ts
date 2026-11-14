/**
 * The entrypoint for the action.
 */
import { runAction } from "@qltysh-action/shared/telemetry";
import { run } from "./main";

// eslint-disable-next-line @typescript-eslint/no-floating-promises
runAction("fmt", run);
