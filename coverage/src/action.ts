import { Installer } from "./installer";
import { Settings } from "./settings";
import * as actionsExec from "@actions/exec";
import * as actionsCore from "@actions/core";
import * as actionsGithub from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";
import { ActionOutput, StubbedOutput } from "./util/output";
import { CommandExecutor, StubbedCommandExecutor } from "./util/exec";
import OutputTracker from "./util/output_tracker";
import EventEmitter from "node:events";
import Version from "./version";

const EXEC_EVENT = "exec";

type ProcessEnv = Record<string, string | undefined>;

export class CoverageAction {
  private _output: ActionOutput;
  private _context: ActionContext;
  private _executor: CommandExecutor;
  private _installer: Installer;
  private _settings: Settings;
  private _emitter: EventEmitter = new EventEmitter();
  private _env: ProcessEnv;

  static createNull({
    output = new StubbedOutput(),
    context = new StubbedActionContext(),
    executor = new StubbedCommandExecutor(),
    installer,
    settings = Settings.createNull(),
    env = process.env,
  }: {
    output?: ActionOutput;
    context?: ActionContext;
    executor?: CommandExecutor;
    installer?: Installer;
    settings?: Settings;
    env?: ProcessEnv;
  } = {}): CoverageAction {
    return new CoverageAction({
      output,
      context,
      executor,
      installer: installer || Installer.createNull(settings.getVersion()),
      settings,
      env,
    });
  }

  constructor({
    output = actionsCore,
    context = actionsGithub.context,
    executor = actionsExec,
    installer,
    settings = Settings.create(),
    env = process.env,
  }: {
    output?: ActionOutput;
    context?: ActionContext;
    executor?: CommandExecutor;
    installer?: Installer;
    settings?: Settings;
    env?: ProcessEnv;
  } = {}) {
    this._output = output;
    this._context = context;
    this._executor = executor;
    this._installer = installer || Installer.create(settings.getVersion());
    this._settings = settings;
    this._env = env;
  }

  async run(): Promise<void> {
    if (!this.validate()) {
      return;
    }

    let qltyBinary = null;

    try {
      qltyBinary = await this._installer.install();
    } catch (error) {
      const errorMessage = error instanceof Error ? `: ${error.message}.` : ".";
      this.warnOrThrow([
        `Error installing Qlty CLI${errorMessage} Please check the action's inputs. If you are using a 'cli-version', make sure it is correct.`,
      ]);
      return;
    }

    if (!qltyBinary) {
      return;
    }

    if (this._settings.input.command === "complete") {
      await this.runComplete(qltyBinary);
    } else {
      await this.runPublish(qltyBinary);
    }
  }

  async runPublish(qltyBinary: string): Promise<void> {
    let uploadArgs = this.buildPublishArgs();
    const files = await this._settings.getFiles();

    if (files.length === 0) {
      if (this._settings.input.files?.includes(" ")) {
        this.warnOrThrow([
          "No code coverage data files were found. Please check the action's inputs.",
          "NOTE: To specify multiple files, use a comma or newline separated list NOT spaces.",
          "If you are using a pattern, make sure it is correct.",
          "If you are using a file, make sure it exists.",
        ]);
      } else {
        this.warnOrThrow([
          "No code coverage data files were found. Please check the action's inputs.",
          "If you are using a pattern, make sure it is correct.",
          "If you are using a file, make sure it exists.",
        ]);
      }

      return;
    }

    uploadArgs = uploadArgs.concat(files);

    const token = await this._settings.getToken();
    if (token) {
      this._output.setSecret(token);
    }

    let qltyOutput = "";

    try {
      const env: Record<string, string> = {
        ...this._env,
        QLTY_CI_UPLOADER_TOOL: "qltysh/qlty-action",
        QLTY_CI_UPLOADER_VERSION: Version.readVersion() || "",
      };

      if (token) {
        env["QLTY_COVERAGE_TOKEN"] = token;
      }

      this._emitter.emit(EXEC_EVENT, {
        command: [qltyBinary, ...uploadArgs],
        env,
      });
      this._output.info(`Running: ${[qltyBinary, ...uploadArgs].join(" ")}`);

      await this._executor.exec(qltyBinary, uploadArgs, {
        env,
        listeners: {
          stdout: (data: Buffer) => {
            qltyOutput += data.toString();
          },
          stderr: (data: Buffer) => {
            qltyOutput += data.toString();
          },
        },
      });
    } catch (error) {
      this.outputCoverageError(qltyOutput, error);
    }
  }

  async runComplete(qltyBinary: string): Promise<void> {
    const completeArgs = this.buildCompleteArgs();

    const token = await this._settings.getToken();
    if (token) {
      this._output.setSecret(token);
    }

    let qltyOutput = "";

    try {
      const env: Record<string, string> = {
        ...this._env,
        QLTY_CI_UPLOADER_TOOL: "qltysh/qlty-action",
        QLTY_CI_UPLOADER_VERSION: Version.readVersion() || "",
      };

      if (token) {
        env["QLTY_COVERAGE_TOKEN"] = token;
      }

      this._emitter.emit(EXEC_EVENT, {
        command: [qltyBinary, ...completeArgs],
        env,
      });
      this._output.info(`Running: ${[qltyBinary, ...completeArgs].join(" ")}`);

      await this._executor.exec(qltyBinary, completeArgs, {
        env,
        listeners: {
          stdout: (data: Buffer) => {
            qltyOutput += data.toString();
          },
          stderr: (data: Buffer) => {
            qltyOutput += data.toString();
          },
        },
      });
    } catch (error) {
      this.outputCoverageError(qltyOutput, error);
    }
  }

  outputCoverageError(qltyOutput: string, error: unknown): void {
    if (qltyOutput) {
      this.warnOrThrow([
        `Error executing coverage command. Output from the Qlty CLI follows:`,
        qltyOutput,
      ]);
    } else {
      let errorMessage = "";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      this.warnOrThrow([
        `Unexpected error executing coverage command:`,
        errorMessage,
      ]);
    }
  }

  validate(): boolean {
    const errors = this._settings.validate();

    if (errors.length > 0) {
      this.warnOrThrow([
        "Error validating action input:",
        ...errors,
        "Please check the action's inputs.",
      ]);
      return false;
    }

    return true;
  }

  warnOrThrow(messages: string[]): void {
    if (this._settings.input.skipErrors) {
      for (const message of messages) {
        this._output.warning(message);
      }
    } else {
      throw new CoverageError(messages.join("; "));
    }
  }

  buildCompleteArgs(): string[] {
    const completeArgs = ["coverage", "complete"];

    if (this._settings.input.tag) {
      completeArgs.push("--tag", this._settings.input.tag);
    }

    completeArgs.push(...this.getOverrideCommitArgs());

    return completeArgs;
  }

  buildPublishArgs(): string[] {
    const uploadArgs = ["coverage", "publish"];

    if (this._settings.input.verbose) {
      uploadArgs.push("--print");
    }

    if (this._settings.input.dryRun) {
      uploadArgs.push("--dry-run");
    }

    if (this._settings.input.addPrefix) {
      uploadArgs.push("--add-prefix", this._settings.input.addPrefix);
    }

    if (this._settings.input.stripPrefix) {
      uploadArgs.push("--strip-prefix", this._settings.input.stripPrefix);
    }

    if (this._settings.input.format) {
      uploadArgs.push("--format", this._settings.input.format);
    }

    if (this._settings.input.tag) {
      uploadArgs.push("--tag", this._settings.input.tag);
    }

    if (this._settings.input.totalPartsCount) {
      uploadArgs.push(
        "--total-parts-count",
        this._settings.input.totalPartsCount.toString(),
      );
    }

    uploadArgs.push(...this.getOverrideCommitArgs());

    const payload = this._context.payload;
    if (payload.pull_request) {
      uploadArgs.push("--override-branch", payload.pull_request["head"].ref);
    }

    if (this._settings.input.skipMissingFiles) {
      uploadArgs.push("--skip-missing-files");
    }

    if (this._settings.input.incomplete) {
      uploadArgs.push("--incomplete");
    }

    if (this._settings.input.name) {
      uploadArgs.push("--name", this._settings.input.name);
    }

    if (this._settings.input.validate) {
      uploadArgs.push("--validate");

      if (this._settings.input.validateFileThreshold) {
        uploadArgs.push(
          "--validate-file-threshold",
          this._settings.input.validateFileThreshold.toString(),
        );
      }
    }

    if (this._env["RUNNER_TEMP"]) {
      uploadArgs.push("--output-dir", this._env["RUNNER_TEMP"]);
    }

    return uploadArgs;
  }

  // Github doesn't provide the head's sha for PRs, so we need to extract it from the event's payload
  // https://github.com/orgs/community/discussions/26325
  // https://www.kenmuse.com/blog/the-many-shas-of-a-github-pull-request/
  private getOverrideCommitArgs(): string[] {
    const payload = this._context.payload;
    const args: string[] = [];
    if (payload.pull_request) {
      args.push("--override-commit-sha", payload.pull_request["head"].sha);
    }
    return args;
  }

  trackOutput() {
    return OutputTracker.create<{
      command: string;
      env: Record<string, string>;
    }>(this._emitter, EXEC_EVENT);
  }
}

export class CoverageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoverageError";
  }
}

interface ActionContext {
  payload: WebhookPayload;
}

export class StubbedActionContext implements ActionContext {
  get payload(): WebhookPayload {
    return {
      pull_request: {
        number: 1,
        head: {
          sha: "test-sha",
          ref: "test-ref",
        },
      },
    };
  }
}
