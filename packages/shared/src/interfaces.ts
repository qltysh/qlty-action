export interface ToolCache {
  downloadTool(url: string): Promise<string>;
  extractTar(file: string, dest?: string, options?: string): Promise<string>;
  extractZip(file: string, dest?: string, options?: string): Promise<string>;
  cacheDir(folder: string, tool: string, version: string): Promise<string>;
}

export interface OperatingSystem {
  platform(): string;
  arch(): string;
}

export interface ActionOutput {
  addPath(path: string): void;
  setFailed(message: string): void;
  info(message: string): void;
  warning(message: string | Error, properties?: { title?: string }): void;
}
