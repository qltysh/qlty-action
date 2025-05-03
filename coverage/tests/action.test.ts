import { CoverageAction, StubbedActionContext } from "src/action";
import { Installer } from "src/installer";
import { Settings, StubbedFileSystem } from "src/settings";
import { StubbedCommandExecutor } from "src/util/exec";
import { StubbedOutput } from "src/util/output";

describe("CoverageAction", () => {
  describe("validaiton errors", async () => {
    test("logs warnings shen skip-errors is true", async () => {
      const { output, action } = createTrackedAction({
        executor: new StubbedCommandExecutor({ throwError: true }),
        settings: Settings.createNull({
          // Invalid configuration:
          "coverage-token": "",
          token: "",
          oidc: false,
          files: "info.lcov",
          "skip-errors": true,
        }),
      });

      await action.run();
      expect(output.warnings).toEqual([
        "Error validating action input:",
        "Either 'oidc' or 'token' must be provided.",
        "Please check the action's inputs.",
      ]);
    });

    test("raises errors shen skip-errors is false", async () => {
      const { action } = createTrackedAction({
        executor: new StubbedCommandExecutor({ throwError: true }),
        settings: Settings.createNull({
          // Invalid configuration:
          "coverage-token": "",
          token: "",
          oidc: false,
          files: "info.lcov",
          "skip-errors": false,
        }),
      });

      await expect(action.run()).rejects.toThrow();
    });

    test("logs warnings no paths found", async () => {
      const { output, action } = createTrackedAction({
        executor: new StubbedCommandExecutor({ throwError: true }),
        settings: Settings.createNull({
          oidc: true,
          files: "",
          "skip-errors": true,
        }),
      });

      await action.run();
      expect(output.warnings).toEqual([
        "No code coverage data files were found. Please check the action's inputs.",
        "If you are using a pattern, make sure it is correct.",
        "If you are using a file, make sure it exists.",
      ]);
    });
  });

  test("runs qlty coverage publish", async () => {
    const { action, commands } = createTrackedAction({
      settings: Settings.createNull({
        "coverage-token": "qltcp_1234567890",
        files: "info.lcov",
      }),
      context: { payload: {} },
    });
    await action.run();
    const executedCommands = commands.clear();
    expect(executedCommands.length).toBe(1);

    const command = executedCommands[0];
    expect(command?.command).toEqual([
      "qlty",
      "coverage",
      "publish",
      "info.lcov",
    ]);
  });

  test("adds arguments based on inputs", async () => {
    const { action, commands } = createTrackedAction({
      settings: Settings.createNull({
        "coverage-token": "qltcp_DEADBEEF10",
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

    const executedCommands = commands.clear();
    expect(executedCommands.length).toBe(1);

    const command = executedCommands[0];
    expect(command?.command).toEqual([
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
    ]);
    expect(command?.env).toMatchObject({
      QLTY_COVERAGE_TOKEN: "qltcp_DEADBEEF10",
      QLTY_CI_UPLOADER_TOOL: "qltysh/qlty-action",
    });
    expect(command?.env["QLTY_CI_UPLOADER_VERSION"]).toMatch(
      /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?$/,
    );
  });

  test("uses the payload for the PR head SHA and ref", async () => {
    const { action, commands } = createTrackedAction({
      settings: Settings.createNull({
        "coverage-token": "qltcp_1234567890",
        files: "info.lcov",
      }),
    });
    await action.run();

    const executedCommands = commands.clear();
    expect(executedCommands.length).toBe(1);
    const command = executedCommands[0];
    expect(command?.command).toEqual([
      "qlty",
      "coverage",
      "publish",
      "--override-commit-sha",
      "test-sha",
      "--override-branch",
      "test-ref",
      "info.lcov",
    ]);
  });

  describe("error handling", () => {
    test("throws an error if qlty fails when skip-errors is false", async () => {
      const { action } = createTrackedAction({
        executor: new StubbedCommandExecutor({ throwError: true }),
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "info.lcov",
          "skip-errors": false,
        }),
      });

      await expect(action.run()).rejects.toThrow();
    });

    test("logs a warning if qlty fails when skip-errors is true", async () => {
      const { output, action } = createTrackedAction({
        executor: new StubbedCommandExecutor({ throwError: true }),
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "info.lcov",
          "skip-errors": true,
        }),
      });

      await action.run();
      expect(output.warnings).toContain(
        "Error uploading coverage. Output from the Qlty CLI follows:",
      );
    });

    test("handles installer error when skip-errors is true", async () => {
      const { output, action } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "info.lcov",
          "skip-errors": true,
        }),
        installer: Installer.createNull(undefined, true),
      });

      await action.run();
      expect(output.warnings).toEqual([
        "Error installing Qlty CLI: download error. Please check the action's inputs. If you are using a 'cli-version', make sure it is correct.",
      ]);
    });

    test("handles empty files array with spaces in the files input", async () => {
      const { output, action } = createTrackedAction({
        settings: Settings.createNull(
          {
            "coverage-token": "qltcp_1234567890",
            files: "file1.lcov file2.lcov",
            "skip-errors": true,
          },
          new StubbedFileSystem([]),
        ),
      });

      await action.run();
      expect(output.warnings).toEqual([
        "No code coverage data files were found. Please check the action's inputs.",
        "NOTE: To specify multiple files, use a comma or newline separated list NOT spaces.",
        "If you are using a pattern, make sure it is correct.",
        "If you are using a file, make sure it exists.",
      ]);
    });
  });

  function createTrackedAction({
    settings = Settings.createNull(),
    context = new StubbedActionContext(),
    executor = new StubbedCommandExecutor(),
    output = new StubbedOutput(),
    installer = Installer.createNull(undefined),
  } = {}) {
    const action = CoverageAction.createNull({
      output,
      settings,
      context,
      executor,
      installer,
    });
    const commands = action.trackOutput();
    return { commands, action, output };
  }
});
