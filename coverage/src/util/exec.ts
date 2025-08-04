import * as actionsExec from "@actions/exec";

export interface CommandExecutor {
  exec(
    command: string,
    args?: string[],
    options?: actionsExec.ExecOptions,
  ): Promise<number>;
}

export class StubbedCommandExecutor implements CommandExecutor {
  private throwError: boolean;
  private errorMessage: string = "Command execution failed";
  private stdout: string = "STDOUT\n";
  private stderr: string = "STDERR\n";

  constructor({
    throwError,
    stdout,
    stderr,
    errorMessage,
  }: {
    throwError?: boolean;
    stdout?: string;
    stderr?: string;
    errorMessage?: string;
  } = {}) {
    this.throwError = !!throwError;

    if (stdout !== undefined) {
      this.stdout = stdout;
    }

    if (stderr !== undefined) {
      this.stderr = stderr;
    }

    if (errorMessage !== undefined) {
      this.errorMessage = errorMessage;
    }
  }

  async exec(
    _command: string,
    _args?: string[],
    options?: actionsExec.ExecOptions,
  ): Promise<number> {
    if (this.throwError) {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(this.stdout));
      }

      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from(this.stderr));
      }

      throw new Error(this.errorMessage);
    } else {
      return 0;
    }
  }
}
