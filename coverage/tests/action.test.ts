import { CoverageAction, StubbedActionContext } from "src/action";
import { Settings } from "src/settings";

describe("CoverageAction", () => {
  test("runs qlty coverage publish", async () => {
    const { action, commands } = createTrackedAction({
      settings: Settings.createNull({
        "coverage-token": "test-token",
        files: "info.lcov",
      }),
      context: { payload: {} },
    });
    await action.run();
    expect(commands.clear()).toEqual([
      ["qlty", "coverage", "publish", "info.lcov"],
    ]);
  });

  test("adds arguments based on inputs", async () => {
    const { action, commands } = createTrackedAction({
      settings: Settings.createNull({
        "coverage-token": "test-token",
        files: "info.lcov",
        "skip-missing-files": true,
        "total-parts-count": "5",
        tag: "test-tag",
        "add-prefix": "prefix",
        "strip-prefix": "strip",
        verbose: true,
      }),
      context: { payload: {} },
    });
    await action.run();
    expect(commands.clear()).toEqual([
      [
        "qlty",
        "coverage",
        "publish",
        "--print",
        "--transform-add-prefix",
        "prefix",
        "--transform-strip-prefix",
        "strip",
        "--tag",
        "test-tag",
        "--total-parts-count",
        "5",
        "--skip-missing-files",
        "info.lcov",
      ],
    ]);
  });

  test("uses the payload for the PR head SHA and ref", async () => {
    const { action, commands } = createTrackedAction({
      settings: Settings.createNull({
        "coverage-token": "test-token",
        files: "info.lcov",
      }),
    });
    await action.run();
    expect(commands.clear()).toEqual([
      [
        "qlty",
        "coverage",
        "publish",
        "--override-commit-sha",
        "test-sha",
        "--override-branch",
        "test-ref",
        "info.lcov",
      ],
    ]);
  });

  function createTrackedAction({
    settings = Settings.createNull(),
    context = new StubbedActionContext(),
  } = {}) {
    const action = CoverageAction.createNull({ settings, context });
    const commands = action.trackOutput();
    return { commands, action };
  }
});
