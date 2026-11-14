import * as core from "@actions/core";
import {
  closeTelemetry,
  reportError,
  resolveTelemetry,
  startTelemetry,
} from "@qltysh-action/shared/telemetry";
import { CoverageAction } from "./action";
import Version from "./version";

const telemetry = resolveTelemetry(core.getInput("telemetry"), process.env);
if (telemetry.warning) {
  core.warning(telemetry.warning);
}
if (telemetry.enabled) {
  startTelemetry("coverage", Version.readVersion());
}

new CoverageAction().run().then(
  async () => {
    await closeTelemetry();
    process.exit(0);
  },
  async (error) => {
    core.setFailed(`Action failed with error: ${error.name}: ${error.message}`);
    await reportError(error);
    process.exit(1);
  },
);
