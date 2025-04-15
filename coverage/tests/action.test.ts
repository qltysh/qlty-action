import { CoverageAction } from "src/action";
import { Settings } from "src/settings";

describe("CoverageAction", () => {
  test("works", async () => {
    // const settings = Settings.createNull({
    //   coverageToken: "test-token",
    //   files: "**/coverage/**",
    // });
    // const action = CoverageAction.createNull({ settings });
    // const commands = action.trackOutput();
    const { action, commands } = createTrackedAction({
      settings: Settings.createNull({
        coverageToken: "test-token",
        files: "**/coverage/**",
      }),
    });
    await action.run();
    expect(commands.clear()).toEqual([
      ["qlty", "coverage", "publish", "**/coverage/**"],
    ]);
  });

  function createTrackedAction({ settings = Settings.createNull() } = {}) {
    const action = CoverageAction.createNull({ settings });
    const commands = action.trackOutput();
    return { commands, action };
  }
});
