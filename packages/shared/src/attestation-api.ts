import { AttestationCheckError } from "./attestation-check-error.js";
import {
  errorMessage,
  isTransientNetworkError,
  readBody,
  type HttpResponse,
  type HttpTransport,
} from "./http.js";
import { decompressSnappy } from "./snappy.js";

// The lookup always goes to github.com, where the Qlty CLI's attestations
// are, even on GitHub Enterprise Server runners.
export const GITHUB_API_URL = "https://api.github.com";

const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 16 * 1024 * 1024;

export interface AttestationSource {
  // Returns the Sigstore bundles, as JSON, of every attestation GitHub has
  // for the digest. They are not verified yet.
  fetchBundles(owner: string, digest: string): Promise<unknown[]>;
}

export class GitHubAttestationApi implements AttestationSource {
  constructor(
    private token: string,
    private http: HttpTransport,
  ) {}

  async fetchBundles(owner: string, digest: string): Promise<unknown[]> {
    const url = `${GITHUB_API_URL}/orgs/${encodeURIComponent(owner)}/attestations/sha256:${digest}?per_page=100`;

    const response = await this.request(url);
    const body = await this.read(response);
    const status = response.statusCode;
    if (status === 404) {
      throw new AttestationCheckError(
        "GitHub has no attestation for this archive (HTTP 404).",
        { unavailable: false },
      );
    }
    if (status === 401) {
      // The API needs a token even for public attestations, and a GitHub
      // Enterprise Server token doesn't work on github.com.
      throw new AttestationCheckError(
        `The GitHub attestations API returned HTTP 401: ${apiMessage(body)}. Set github-token to a github.com token.`,
        { unavailable: false },
      );
    }
    if (status !== 200) {
      throw new AttestationCheckError(
        `The GitHub attestations API returned HTTP ${status}: ${apiMessage(body)}`,
        { unavailable: isOutage(response, body) },
      );
    }

    const attestations = parseAttestations(body);
    const bundles: unknown[] = [];
    for (const attestation of attestations) {
      if (isRecord(attestation["bundle"])) {
        bundles.push(attestation["bundle"]);
      } else if (typeof attestation["bundle_url"] === "string") {
        bundles.push(await this.fetchBundle(attestation["bundle_url"]));
      }
    }
    return bundles;
  }

  private async request(url: string): Promise<HttpResponse> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    try {
      return await this.http.get(url, headers);
    } catch (error) {
      throw networkError("api.github.com", error);
    }
  }

  private async read(response: HttpResponse): Promise<Buffer> {
    try {
      return await readBody(response.body, MAX_RESPONSE_BYTES);
    } catch (error) {
      throw networkError("api.github.com", error);
    }
  }

  // The bundle_url is a presigned storage URL, so it gets no token.
  private async fetchBundle(bundleUrl: string): Promise<unknown> {
    const host = hostOf(bundleUrl);
    let response: HttpResponse;
    let body: Buffer;
    try {
      response = await this.http.get(bundleUrl);
      body = await readBody(response.body, MAX_BUNDLE_BYTES);
    } catch (error) {
      throw networkError(host, error);
    }
    if (response.statusCode !== 200) {
      throw new AttestationCheckError(
        `Downloading an attestation bundle from ${host} returned HTTP ${response.statusCode}.`,
        { unavailable: isOutage(response, body) },
      );
    }
    try {
      return JSON.parse(
        decompressSnappy(body, MAX_BUNDLE_BYTES).toString("utf8"),
      ) as unknown;
    } catch (error) {
      throw new AttestationCheckError(
        `The attestation bundle from ${host} is not valid: ${errorMessage(error)}`,
        { unavailable: false },
      );
    }
  }
}

function parseAttestations(body: Buffer): Record<string, unknown>[] {
  let json: unknown;
  try {
    json = JSON.parse(body.toString("utf8"));
  } catch {
    json = undefined;
  }
  const attestations = isRecord(json) ? json["attestations"] : undefined;
  if (!Array.isArray(attestations)) {
    throw new AttestationCheckError(
      "The GitHub attestations API returned a response without an attestations list.",
      { unavailable: false },
    );
  }
  return attestations.filter(isRecord);
}

function isOutage(response: HttpResponse, body: Buffer): boolean {
  const status = response.statusCode;
  if (status >= 500 || status === 429) {
    return true;
  }
  return (
    status === 403 &&
    (response.headers["x-ratelimit-remaining"] === "0" ||
      response.headers["retry-after"] !== undefined ||
      /rate limit/i.test(apiMessage(body)))
  );
}

function apiMessage(body: Buffer): string {
  try {
    const json: unknown = JSON.parse(body.toString("utf8"));
    if (isRecord(json) && typeof json["message"] === "string") {
      return json["message"];
    }
  } catch {
    // Not JSON, such as an HTML error page from a proxy.
  }
  return "no error message";
}

function networkError(host: string, error: unknown): AttestationCheckError {
  return new AttestationCheckError(
    `Could not reach ${host}: ${errorMessage(error)}`,
    { unavailable: isTransientNetworkError(error) },
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "the bundle URL";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
