import * as actionsExec from "@actions/exec";

export interface CommandExecutor {
  exec(
    command: string,
    args?: string[],
    options?: actionsExec.ExecOptions,
  ): Promise<number>;
}

// Behaves like @actions/exec: a nonzero exit code rejects unless
// ignoreReturnCode is set, and a command that cannot start always rejects.
export class StubbedCommandExecutor implements CommandExecutor {
  private exitCode: number = 0;
  private startError: string | undefined;
  private stdout: string = "STDOUT\n";
  private stderr: string = "STDERR\n";

  constructor({
    exitCode,
    startError,
    stdout,
    stderr,
  }: {
    exitCode?: number;
    startError?: string;
    stdout?: string;
    stderr?: string;
  } = {}) {
    if (exitCode !== undefined) {
      this.exitCode = exitCode;
    }

    this.startError = startError;

    if (stdout !== undefined) {
      this.stdout = stdout;
    }

    if (stderr !== undefined) {
      this.stderr = stderr;
    }
  }

  async exec(
    command: string,
    _args?: string[],
    options?: actionsExec.ExecOptions,
  ): Promise<number> {
    if (this.startError !== undefined) {
      throw new Error(this.startError);
    }

    if (this.exitCode === 0) {
      return 0;
    }

    if (options?.listeners?.stdout) {
      options.listeners.stdout(Buffer.from(this.stdout));
    }

    if (options?.listeners?.stderr) {
      options.listeners.stderr(Buffer.from(this.stderr));
    }

    if (!options?.ignoreReturnCode) {
      throw new Error(
        `The process '${command}' failed with exit code ${this.exitCode}`,
      );
    }

    return this.exitCode;
  }
}
