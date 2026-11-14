import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import seeds from "@sigstore/tuf/seeds.json" with { type: "json" };
import { BaseFetcher, Updater } from "tuf-js";
// tuf-js stops walking root versions only on this error class, and doesn't
// export it from its index.
import { DownloadHTTPError } from "tuf-js/dist/error.js";
import { AttestationCheckError } from "./attestation-check-error.js";
import { errorMessage, isTlsError, type HttpTransport } from "./http.js";

export const SIGSTORE_TUF_URL = "https://tuf-repo-cdn.sigstore.dev";
const TRUSTED_ROOT_TARGET = "trusted_root.json";

// The TUF root of trust for Sigstore's public-good instance that
// @sigstore/tuf ships. TUF updates from it to the current root.
const SIGSTORE_TUF_ROOT = Buffer.from(
  seeds[SIGSTORE_TUF_URL]["root.json"],
  "base64",
);

export interface TrustedRootSource {
  load(): Promise<TrustedRoot>;
}

// Fetches Sigstore's current trusted root (its Fulcio CAs, Rekor and CT log
// keys) over TUF, in a fresh cache each run.
export class SigstoreTrustedRoot implements TrustedRootSource {
  constructor(
    private http: HttpTransport,
    private tempDir: string,
    private tufRoot: Buffer = SIGSTORE_TUF_ROOT,
  ) {}

  async load(): Promise<TrustedRoot> {
    let dir: string | undefined;
    try {
      dir = await fs.mkdtemp(path.join(this.tempDir, "qlty-sigstore-tuf-"));
      const json = await this.fetchTrustedRoot(dir);
      return TrustedRoot.fromJSON(JSON.parse(json));
    } catch (error) {
      // As with the GitHub API, a TLS error fails the check instead of
      // counting as an outage.
      throw new AttestationCheckError(
        `Could not load Sigstore's trusted root from ${new URL(SIGSTORE_TUF_URL).host}: ${errorMessage(error)}`,
        { unavailable: !isTlsError(error) },
      );
    } finally {
      if (dir) {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
  }

  private async fetchTrustedRoot(dir: string): Promise<string> {
    const targetDir = path.join(dir, "targets");
    await fs.mkdir(targetDir);
    await fs.writeFile(path.join(dir, "root.json"), this.tufRoot);

    const updater = new Updater({
      metadataBaseUrl: SIGSTORE_TUF_URL,
      metadataDir: dir,
      targetBaseUrl: `${SIGSTORE_TUF_URL}/targets`,
      targetDir,
      fetcher: new HttpFetcher(this.http),
    });
    const target = await updater.getTargetInfo(TRUSTED_ROOT_TARGET);
    if (!target) {
      throw new Error(`The TUF repository has no ${TRUSTED_ROOT_TARGET}.`);
    }
    const file = await updater.downloadTarget(target);
    return fs.readFile(file, "utf8");
  }
}

export class HttpFetcher extends BaseFetcher {
  constructor(private http: HttpTransport) {
    super();
  }

  async fetch(url: string): Promise<ReadableStream<Uint8Array<ArrayBuffer>>> {
    const response = await this.http.get(url);
    if (response.statusCode !== 200) {
      response.body.resume();
      throw new DownloadHTTPError(
        `Downloading ${url} returned HTTP ${response.statusCode}`,
        response.statusCode,
      );
    }
    return Readable.toWeb(response.body) as ReadableStream<
      Uint8Array<ArrayBuffer>
    >;
  }
}
