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
    installer = Installer.createNull(),
    settings = Settings.createNull(),
  }: {
    output?: ActionOutput;
    context?: ActionContext;
    executor?: CommandExecutor;
    installer?: Installer;
    settings?: Settings;
  } = {}): CoverageAction {
    console.log("CoverageAction.createNull", settings);
    return new CoverageAction({
      output,
      context,
      executor,
      installer,
      settings,
    });
  }

  constructor({
    output = actionsCore,
    context = actionsGithub.context,
    executor = actionsExec,
    installer = Installer.create(),
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
    this._installer = installer;
    this._settings = settings;
    console.log("Settings", this._settings);
  }

  async run(): Promise<void> {
    if (!this._settings.validate()) {
      return;
    }

    await this._installer.install();

    const uploadArgs = await this.buildArgs();
    const token = await this._settings.getToken();
    this._output.setSecret(token);

    let qlytOutput = "";
    try {
      this._emitter.emit(EXEC_EVENT, ["qlty", ...uploadArgs]);
      await this._executor.exec("qlty", uploadArgs, {
        env: {
          ...process.env,
          QLTY_COVERAGE_TOKEN: token,
        },
        listeners: {
          stdout: (data: Buffer) => {
            qlytOutput += data.toString();
          },
          stderr: (data: Buffer) => {
            qlytOutput += data.toString();
          },
        },
      });
    } catch {
      if (this._settings.input.skipErrors) {
        this._output.warning(
          "Error uploading coverage, skipping due to skip-errors"
        );
        this._output.warning("Output:");
        this._output.warning(qlytOutput);
      } else {
        throw new CoverageUploadError(qlytOutput);
      }
    }
  }

  async buildArgs(): Promise<string[]> {
    let uploadArgs = ["coverage", "publish"];

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

    const files = await this._settings.getFiles();
    console.log(files);
    return uploadArgs.concat(files);
  }

  trackOutput() {
    return OutputTracker.create<string[]>(this._emitter, EXEC_EVENT);
  }
}

export class CoverageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoverageUploadError";
  }
}

interface ActionContext {
  payload: WebhookPayload;
}

class StubbedActionContext implements ActionContext {
  get payload(): WebhookPayload {
    return {
      action: "",
      installation: {
        id: 0,
        account: {
          login: "",
          id: 0,
        },
        repositories: [],
      },
      sender: {
        type: "",
        login: "",
        id: 0,
      },
    };
  }
}
