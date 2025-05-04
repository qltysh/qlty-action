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
    options?: actionsExec.ExecOptions
  ): Promise<number> {
    if (this.throwError) {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from("STDOUT\n"));
      }

      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from("STDERR\n"));
      }

      throw new Error("Command execution failed");
    } else {
      return 0;
    }
  }
}
