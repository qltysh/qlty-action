import { CoverageAction, StubbedActionContext } from "src/action";
import { Installer } from "src/installer";
import { FileSystem, Settings, StubbedFileSystem } from "src/settings";
import { StubbedCommandExecutor } from "src/util/exec";
import { StubbedOutput } from "src/util/output";

describe("CoverageAction", () => {
  describe("validation errors", async () => {
    test("logs warnings when skip-errors is true", async () => {
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

    test("logs unknown error when output from execution is empty", async () => {
      const { output, action } = createTrackedAction({
        executor: new StubbedCommandExecutor({
          throwError: true,
          stdout: "",
          stderr: "",
          errorMessage: "Crazy unknown error condition happened",
        }),
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "info.lcov",
          "skip-errors": true,
        }),
      });

      await action.run();
      expect(output.warnings).toEqual([
        "Unexpected error executing coverage command:",
        "Crazy unknown error condition happened",
      ]);
    });

    test("raises errors when skip-errors is false", async () => {
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
        settings: Settings.createNull(
          {
            oidc: true,
            files: "some/non-existent/file",
            "skip-errors": true,
          },
          FileSystem.createNull([]), // returns no files
        ),
      });

      await action.run();
      expect(output.warnings).toEqual([
        "No code coverage data files were found. Please check the action's inputs.",
        "If you are using a pattern, make sure it is correct.",
        "If you are using a file, make sure it exists.",
      ]);
    });
  });

  describe("publish command", () => {
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
        "--no-validate",
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
          format: "simplecov",
          verbose: true,
          "dry-run": true,
          incomplete: true,
          name: "test-name",
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
        "--dry-run",
        "--add-prefix",
        "prefix",
        "--strip-prefix",
        "strip",
        "--format",
        "simplecov",
        "--tag",
        "test-tag",
        "--total-parts-count",
        "5",
        "--skip-missing-files",
        "--incomplete",
        "--name",
        "test-name",
        "--no-validate",
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
        "--no-validate",
        "info.lcov",
      ]);
    });

    test("adds incomplete flag when incomplete is true", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "info.lcov",
          incomplete: true,
        }),
        context: { payload: {} },
      });
      await action.run();

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.command).toContain("--incomplete");
    });

    test("adds name argument when name is provided", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "info.lcov",
          name: "custom-name",
        }),
        context: { payload: {} },
      });
      await action.run();

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.command).toContain("--name");
      expect(command?.command).toContain("custom-name");
    });

    test("adds validate flag when validate is true", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "info.lcov",
          validate: true,
        }),
        context: { payload: {} },
      });
      await action.run();

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.command).toContain("--validate");
    });

    test("adds --output-dir when RUNNER_TEMP env var is present", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "info.lcov",
        }),
        context: { payload: {} },
        env: { RUNNER_TEMP: "/tmp/runner" },
      });
      await action.run();

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.command).toContain("--output-dir");
      expect(command?.command).toContain("/tmp/runner");
    });

    test("adds validate-file-threshold flag when validate is true and threshold is set", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "info.lcov",
          validate: true,
          "validate-file-threshold": "80",
        }),
        context: { payload: {} },
      });
      await action.run();

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.command).toContain("--validate");
      expect(command?.command).toContain("--validate-file-threshold");
      expect(command?.command).toContain("80");
    });

    test("allows dry-run without token or OIDC", async () => {
      const { action, commands, output } = createTrackedAction({
        settings: Settings.createNull({
          token: "",
          "coverage-token": "",
          oidc: false,
          files: "info.lcov",
          "dry-run": true,
        }),
        context: { payload: {} },
      });
      await action.run();

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.command).toContain("--dry-run");
      expect(command?.env?.["QLTY_COVERAGE_TOKEN"]).toBeUndefined();
      expect(output.warnings.length).toBe(0); // No warnings should be generated
    });
  });

  describe("complete command", () => {
    test("runs qlty coverage complete with basic arguments", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          command: "complete",
        }),
        context: { payload: {} },
      });
      await action.run();
      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);

      const command = executedCommands[0];
      expect(command?.command).toEqual(["qlty", "coverage", "complete"]);
    });

    test("adds tag argument when tag is provided", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          command: "complete",
          tag: "test-tag",
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
        "complete",
        "--tag",
        "test-tag",
      ]);
    });

    test("uses the payload for the PR head SHA", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          command: "complete",
        }),
      });
      await action.run();

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.command).toEqual([
        "qlty",
        "coverage",
        "complete",
        "--override-commit-sha",
        "test-sha",
      ]);
    });

    test("sets environment variables correctly", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          command: "complete",
        }),
        context: { payload: {} },
      });
      await action.run();

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.env).toMatchObject({
        QLTY_COVERAGE_TOKEN: "qltcp_1234567890",
        QLTY_CI_UPLOADER_TOOL: "qltysh/qlty-action",
      });
      expect(command?.env["QLTY_CI_UPLOADER_VERSION"]).toMatch(
        /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?$/,
      );
    });

    test("handles token from oidc", async () => {
      const { action, commands } = createTrackedAction({
        settings: Settings.createNull({
          oidc: true,
          command: "complete",
        }),
        context: { payload: {} },
      });
      await action.run();

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.env["QLTY_COVERAGE_TOKEN"]).toBe(
        "oidc-token:audience=https://qlty.sh",
      );
    });

    test("does not fail when validate flag is true with complete command", async () => {
      // Since validate defaults to true in action.yml, it should be ignored for complete command
      // rather than causing a validation error
      const { action, commands, output } = createTrackedAction({
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          command: "complete",
          validate: true,
        }),
        context: { payload: {} },
      });

      await action.run();

      expect(output.warnings).toEqual([]);

      const executedCommands = commands.clear();
      expect(executedCommands.length).toBe(1);
      const command = executedCommands[0];
      expect(command?.command).toEqual(["qlty", "coverage", "complete"]);
      expect(command?.command).not.toContain("--validate");
      expect(command?.command).not.toContain("--no-validate");
    });

    test("throws an error if qlty fails when skip-errors is false", async () => {
      const { action } = createTrackedAction({
        executor: new StubbedCommandExecutor({ throwError: true }),
        settings: Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          command: "complete",
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
          command: "complete",
          "skip-errors": true,
        }),
      });

      await action.run();
      expect(output.warnings).toEqual([
        "Error executing coverage command. Output from the Qlty CLI follows:",
        "STDOUT\nSTDERR\n",
      ]);
    });
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
      expect(output.warnings).toEqual([
        "Error executing coverage command. Output from the Qlty CLI follows:",
        "STDOUT\nSTDERR\n",
      ]);
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
    env = {},
  } = {}) {
    const action = CoverageAction.createNull({
      output,
      settings,
      context,
      executor,
      installer,
      env,
    });
    const commands = action.trackOutput();
    return { commands, action, output };
  }
});
