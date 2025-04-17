import * as actionsExec from "@actions/exec";

export interface CommandExecutor {
  exec(
    command: string,
    args?: string[],
    options?: actionsExec.ExecOptions
  ): Promise<number>;
}

export class StubbedCommandExecutor implements CommandExecutor {
  private throwError: boolean;

  constructor({ throwError }: { throwError?: boolean } = {}) {
    this.throwError = !!throwError;
  }

  async exec(
    _command: string,
    _args?: string[],
    _options?: actionsExec.ExecOptions
  ): Promise<number> {
    if (this.throwError) {
      throw new Error("Command execution failed");
    } else {
      return 0;
    }
  }
}
