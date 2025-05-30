export interface ActionOutput {
  addPath(path: string): void;
  setSecret(secret: string): void;
  setFailed(message: string): void;
  info(message: string): void;
  warning(message: string): void;
}

export class StubbedOutput implements ActionOutput {
  secrets: string[] = [];
  paths: string[] = [];
  failures: string[] = [];
  infos: string[] = [];
  warnings: string[] = [];

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

  warning(message: string): void {
    this.warnings.push(message);
  }
}
