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
  warnings: { message: string; title?: string }[] = [];

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
    this.warnings.push({
      message: message instanceof Error ? message.message : message,
      title: properties?.title,
    });
  }

  error(message: string): void {
    this.errors.push(message);
  }
}
