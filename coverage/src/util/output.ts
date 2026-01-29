export interface ActionOutput {
  addPath(path: string): void;
  setSecret(secret: string): void;
  setFailed(message: string): void;
  info(message: string): void;
  warning(message: string | Error, properties?: { title?: string }): void;
  error(message: string): void;
}

export class StubbedOutput implements ActionOutput {
  secrets: string[] = [];
  paths: string[] = [];
  failures: string[] = [];
  infos: string[] = [];
  errors: string[] = [];
  warnings: { message: string; title?: string | undefined }[] = [];

  addPath(path: string): void {
    this.paths.push(path);
  }

  setSecret(secret: string): void {
    this.secrets.push(secret);
  }

  setFailed(message: string): void {
    this.failures.push(message);
  }

  info(message: string): void {
    this.infos.push(message);
  }

  warning(message: string | Error, properties?: { title?: string }): void {
    const warning: { message: string; title?: string | undefined } = {
      message: message instanceof Error ? message.message : message,
    };
    if (properties?.title !== undefined) {
      warning.title = properties.title;
    }
    this.warnings.push(warning);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}
