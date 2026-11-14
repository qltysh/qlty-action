import type { IncomingHttpHeaders } from "node:http";
import { Readable } from "node:stream";
import type { OperatingSystem, ToolCache, ActionOutput } from "./interfaces.js";
import type { AttestationResult, AttestationVerifier } from "./attestation.js";
import type { HttpResponse, HttpTransport } from "./http.js";

export type AttestationBehavior = "success" | "fail" | "unavailable";

export class StubbedAttestationVerifier implements AttestationVerifier {
  verifiedFiles: string[] = [];
  constructor(private behavior: AttestationBehavior = "success") {}

  async verify(filePath: string): Promise<AttestationResult> {
    this.verifiedFiles.push(filePath);
    switch (this.behavior) {
      case "success":
        return {
          success: true,
          digest: "0123abcd",
          signer:
            "https://github.com/qltysh/qlty/.github/workflows/build.yml@refs/heads/main",
        };
      case "fail":
        return { success: false, unavailable: false, error: "Stubbed failure" };
      case "unavailable":
        return { success: false, unavailable: true, error: "Stubbed outage" };
    }
  }
}

export interface StubbedHttpResponse {
  statusCode?: number;
  headers?: IncomingHttpHeaders;
  body?: string | Buffer;
  error?: Error;
}

// Answers each URL with its stubbed response, or the next one when the URL
// has a list. Any other URL gets `fallback`, by default a 404.
export class StubbedHttpTransport implements HttpTransport {
  requests: { url: string; headers: Record<string, string> }[] = [];

  constructor(
    private responses: Record<
      string,
      StubbedHttpResponse | StubbedHttpResponse[]
    > = {},
    private fallback: StubbedHttpResponse = { statusCode: 404 },
  ) {}

  async get(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<HttpResponse> {
    this.requests.push({ url, headers });
    const stubbed = this.responses[url];
    const response =
      (Array.isArray(stubbed) ? stubbed.shift() : stubbed) ?? this.fallback;
    if (response.error) {
      throw response.error;
    }
    return {
      statusCode: response.statusCode ?? 200,
      headers: response.headers ?? {},
      body: Readable.from([Buffer.from(response.body ?? "")]),
    };
  }
}

export class StubbedOperatingSystem implements OperatingSystem {
  private _platform: string;
  private _arch: string;

  constructor(platform = "linux", arch = "x64") {
    this._platform = platform;
    this._arch = arch;
  }

  platform(): string {
    return this._platform;
  }

  arch(): string {
    return this._arch;
  }
}

export class StubbedToolCache implements ToolCache {
  downloads: string[] = [];
  raiseError: boolean = false;

  constructor(raiseError?: boolean) {
    this.raiseError = raiseError ?? false;
  }

  async downloadTool(url: string): Promise<string> {
    if (this.raiseError) {
      throw new Error("download error");
    } else {
      this.downloads.push(url);
      return `downloadTool[${url}]`;
    }
  }

  async extractTar(
    file: string,
    _dest?: string,
    _options?: string,
  ): Promise<string> {
    return `extractTar[${file} dest=${_dest} options=${_options}]`;
  }

  async extractZip(
    file: string,
    _dest?: string,
    _options?: string,
  ): Promise<string> {
    return `extractZip[${file} dest=${_dest} options=${_options}]`;
  }

  async cacheDir(
    folder: string,
    _tool: string,
    _version: string,
  ): Promise<string> {
    return `cacheDir[${folder}]`;
  }
}

export class StubbedOutput implements ActionOutput {
  failures: string[] = [];
  paths: string[] = [];
  infos: string[] = [];
  warnings: { message: string; title?: string | undefined }[] = [];

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

  setFailed(message: string): void {
    this.failures.push(message);
  }

  addPath(p: string): void {
    this.paths.push(p);
  }
}
