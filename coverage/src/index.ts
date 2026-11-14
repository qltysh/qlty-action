import { runAction } from "@qltysh-action/shared/telemetry";
import { CoverageAction } from "./action";

// eslint-disable-next-line @typescript-eslint/no-floating-promises
runAction("coverage", () => new CoverageAction().run());
