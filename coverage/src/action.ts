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
import * as os from "os";
import * as fs from "fs";

const EXEC_EVENT = "exec";

export class CoverageAction {
  private _output: ActionOutput;
  private _context: ActionContext;
  private _executor: CommandExecutor;
  private _installer: Installer;
  private _settings: Settings;
  private _emitter: EventEmitter = new EventEmitter();

  static createNull({
    output = new StubbedOutput(),
    context = new StubbedActionContext(),
    executor = new StubbedCommandExecutor(),
    installer,
    settings = Settings.createNull(),
  }: {
    output?: ActionOutput;
    context?: ActionContext;
    executor?: CommandExecutor;
    installer?: Installer;
    settings?: Settings;
  } = {}): CoverageAction {
    return new CoverageAction({
      output,
      context,
      executor,
      installer: installer || Installer.createNull(settings.getVersion()),
      settings,
    });
  }

  constructor({
    output = actionsCore,
    context = actionsGithub.context,
    executor = actionsExec,
    installer,
    settings = Settings.create(),
  }: {
    output?: ActionOutput;
    context?: ActionContext;
    executor?: CommandExecutor;
    installer?: Installer;
    settings?: Settings;
  } = {}) {
    this._output = output;
    this._context = context;
    this._executor = executor;
    this._installer = installer || Installer.create(settings.getVersion());
    this._settings = settings;
  }

  async run(): Promise<void> {
    if (!this.validate()) {
      return;
    }

    try {
      await this._installer.install();
    } catch (error) {
      const errorMessage = error instanceof Error ? `: ${error.message}.` : ".";
      this.warnOrThrow([
        `Error installing Qlty CLI${errorMessage} Please check the action's inputs. If you are using a 'cli-version', make sure it is correct.`,
      ]);
      return;
    }

    this._output.info(`PATH: ${process.env.PATH}`);
    const expectedPath = this.getQltyBin();
    this._output.info(`Expected Qlty binary path: ${expectedPath}`);
    if (!fs.existsSync(expectedPath)) {
      this._output.info(`Qlty binary not found at: ${expectedPath}`);
    }

    let uploadArgs = await this.buildArgs();
    const files = await this._settings.getFiles();

    if (files.length === 0) {
      if (this._settings.input.files.includes(" ")) {
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

    this._output.info(`Checking if file exists: ${files[0]}`);

    if (!fs.existsSync(files[0])) {
      this._output.warning(`File not found: ${files[0]}`);
    } else {
      this._output.info(`File exists. Logging contents:`);
      const fileContents = fs.readFileSync(files[0], "utf-8");
      this._output.info(fileContents);
    }

    uploadArgs = uploadArgs.concat(files);

    const token = await this._settings.getToken();
    this._output.setSecret(token);

    let qlytOutput = "";

    try {
      const env = {
        ...process.env,
        QLTY_COVERAGE_TOKEN: token,
      };

      this._output.info(`Platform: ${os.platform()}`);
      this._output.info(`Qlty Binary: ${this.getQltyBin()}`);
      this._output.info(`Environment Variables: ${JSON.stringify(env)}`);
      this._output.info(
        `Command: ${[this.getQltyBin(), ...uploadArgs].join(" ")}`
      );
      this._output.info(`Files: ${files.join(", ")}`);

      this._emitter.emit(EXEC_EVENT, {
        command: [this.getQltyBin(), ...uploadArgs],
        env,
      });
      this._output.info(
        `Running: ${[this.getQltyBin(), ...uploadArgs].join(" ")}`
      );

      try {
        await this._executor.exec(this.getQltyBin(), ["--version"], {
          env,
          listeners: {
            stdout: (data: Buffer) => {
              const output = data.toString();
              qlytOutput += output;
              this._output.info(`Captured stdout: ${output}`);
            },
            stderr: (data: Buffer) => {
              const errorOutput = data.toString();
              qlytOutput += errorOutput;
              this._output.warning(`Captured stderr: ${errorOutput}`);
            },
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? `: ${error.message}.` : ".";
        this._output.warning(
          `Error running Qlty CLI${errorMessage} Please check the action's inputs.`
        );
      }

      await this._executor.exec(this.getQltyBin(), uploadArgs, {
        env,
        listeners: {
          stdout: (data: Buffer) => {
            const output = data.toString();
            qlytOutput += output;
            this._output.info(`Captured stdout: ${output}`);
          },
          stderr: (data: Buffer) => {
            const errorOutput = data.toString();
            qlytOutput += errorOutput;
            this._output.warning(`Captured stderr: ${errorOutput}`);
          },
        },
      });
    } catch {
      this.warnOrThrow([
        "Error uploading coverage. Output from the Qlty CLI follows:",
        qlytOutput,
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

  async buildArgs(): Promise<string[]> {
    const uploadArgs = ["coverage", "publish"];

    if (this._settings.input.verbose) {
      uploadArgs.push("--print");
    }

    if (this._settings.input.addPrefix) {
      uploadArgs.push("--transform-add-prefix", this._settings.input.addPrefix);
    }

    if (this._settings.input.stripPrefix) {
      uploadArgs.push(
        "--transform-strip-prefix",
        this._settings.input.stripPrefix
      );
    }

    if (this._settings.input.tag) {
      uploadArgs.push("--tag", this._settings.input.tag);
    }

    if (this._settings.input.totalPartsCount) {
      uploadArgs.push(
        "--total-parts-count",
        this._settings.input.totalPartsCount.toString()
      );
    }

    const payload = this._context.payload;

    // Github doesn't provide the head's sha for PRs, so we need to extract it from the event's payload
    // https://github.com/orgs/community/discussions/26325
    // https://www.kenmuse.com/blog/the-many-shas-of-a-github-pull-request/
    if (payload.pull_request) {
      uploadArgs.push(
        "--override-commit-sha",
        payload.pull_request["head"].sha
      );
      uploadArgs.push("--override-branch", payload.pull_request["head"].ref);
    }

    if (this._settings.input.skipMissingFiles) {
      uploadArgs.push("--skip-missing-files");
    }

    return uploadArgs;
  }

  trackOutput() {
    return OutputTracker.create<{
      command: string;
      env: Record<string, string>;
    }>(this._emitter, EXEC_EVENT);
  }

  private getQltyBin(): string {
    return os.platform() === "win32" ? "qlty.exe" : "qlty";
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
