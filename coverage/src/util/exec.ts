import * as actionsExec from "@actions/exec";

export interface CommandExecutor {
  exec(
    command: string,
    args?: string[],
    options?: actionsExec.ExecOptions,
  ): Promise<number>;
}

export class StubbedCommandExecutor implements CommandExecutor {
  async exec(
    _command: string,
    _args?: string[],
    _options?: actionsExec.ExecOptions,
  ): Promise<number> {
    return 0;
  }
}
