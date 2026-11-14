import fs from "node:fs";
import {
  AttestationCheckError,
  GitHubAttestationApi,
  StubbedHttpTransport,
  type StubbedHttpResponse,
} from "../src/index.js";

const DIGEST =
  "6e941b93b01f18df4263497cf5531c78651719fda1f8ef382d4b60b59785941e";
const API_URL = `https://api.github.com/orgs/qltysh/attestations/sha256:${DIGEST}?per_page=100`;
const BUNDLE_URL =
  "https://tmaproduction.blob.core.windows.net/attestations/37724576/2025/07/10/8570712.json.sn?sig=REDACTED";

describe("GitHubAttestationApi", () => {
  test("returns the inline bundles from github.com, sending the token", async () => {
    const http = new StubbedHttpTransport({
      [API_URL]: { body: fixture("attestations-qlty-v0.555.0.json") },
    });
    const bundles = await new GitHubAttestationApi("token", http).fetchBundles(
      "qltysh",
      DIGEST,
    );

    expect(bundles).toEqual([inlineBundle()]);
    expect(http.requests).toEqual([
      {
        url: API_URL,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          Authorization: "Bearer token",
        },
      },
    ]);
  });

  test("sends no Authorization header without a token", async () => {
    const http = new StubbedHttpTransport({
      [API_URL]: { body: fixture("attestations-qlty-v0.555.0.json") },
    });
    await new GitHubAttestationApi("", http).fetchBundles("qltysh", DIGEST);
    expect(http.requests[0]?.headers).not.toHaveProperty("Authorization");
  });

  test("downloads a bundle GitHub only links to, without the token", async () => {
    const http = new StubbedHttpTransport({
      [API_URL]: { body: pointerOnlyResponse() },
      [BUNDLE_URL]: { body: fixture("bundle-qlty-v0.555.0.snappy") },
    });
    const bundles = await new GitHubAttestationApi("token", http).fetchBundles(
      "qltysh",
      DIGEST,
    );

    expect(bundles).toEqual([inlineBundle()]);
    expect(http.requests[1]).toEqual({ url: BUNDLE_URL, headers: {} });
  });

  test("rejects an archive GitHub has no attestation for", async () => {
    const http = new StubbedHttpTransport({
      [API_URL]: { statusCode: 404, body: '{"message":"Not Found"}' },
    });
    await expect(fetchBundles(http)).rejects.toEqual(
      new AttestationCheckError(
        "GitHub has no attestation for this archive (HTTP 404).",
        { unavailable: false },
      ),
    );
  });

  test("asks for a github.com token when GitHub rejects the token", async () => {
    const http = new StubbedHttpTransport({
      [API_URL]: { statusCode: 401, body: '{"message":"Bad credentials"}' },
    });
    await expect(fetchBundles(http)).rejects.toMatchObject({
      unavailable: false,
      message:
        "The GitHub attestations API returned HTTP 401: Bad credentials. Set github-token to a github.com token.",
    });
  });

  test.each<[string, StubbedHttpResponse]>([
    ["HTTP 500", { statusCode: 500, body: '{"message":"Server Error"}' }],
    ["HTTP 502", { statusCode: 502, body: "<html>Bad Gateway</html>" }],
    ["HTTP 503", { statusCode: 503 }],
    ["HTTP 429", { statusCode: 429 }],
    [
      "an exhausted rate limit",
      { statusCode: 403, headers: { "x-ratelimit-remaining": "0" } },
    ],
    [
      "a secondary rate limit",
      { statusCode: 403, headers: { "retry-after": "60" } },
    ],
    [
      "a rate limit message",
      {
        statusCode: 403,
        body: '{"message":"API rate limit exceeded for installation ID 1."}',
      },
    ],
  ])("reports %s as unavailable", async (_, response) => {
    const http = new StubbedHttpTransport({ [API_URL]: response });
    await expect(fetchBundles(http)).rejects.toMatchObject({
      unavailable: true,
      message: expect.stringContaining(
        `The GitHub attestations API returned HTTP ${response.statusCode}`,
      ),
    });
  });

  test.each<[string, StubbedHttpResponse]>([
    [
      "HTTP 403",
      { statusCode: 403, body: '{"message":"Resource not accessible"}' },
    ],
    ["HTTP 301", { statusCode: 301 }],
    ["a body that isn't JSON", { body: "<html>proxy login</html>" }],
    ["JSON without attestations", { body: '{"message":"hi"}' }],
  ])("rejects %s", async (_, response) => {
    const http = new StubbedHttpTransport({ [API_URL]: response });
    await expect(fetchBundles(http)).rejects.toMatchObject({
      unavailable: false,
    });
  });

  test.each([
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
  ])("reports %s as unavailable", async (code) => {
    const http = new StubbedHttpTransport({
      [API_URL]: { error: errorWithCode(`connect ${code}`, code) },
    });
    await expect(fetchBundles(http)).rejects.toMatchObject({
      unavailable: true,
      message: `Could not reach api.github.com: connect ${code}`,
    });
  });

  test("reports a socket timeout as unavailable", async () => {
    const http = new StubbedHttpTransport({
      [API_URL]: { error: new Error("Request timeout: /orgs/qltysh") },
    });
    await expect(fetchBundles(http)).rejects.toMatchObject({
      unavailable: true,
    });
  });

  test("reports a proxy that cannot connect as unavailable", async () => {
    const cause = errorWithCode(
      "connect ECONNREFUSED 127.0.0.1:9",
      "ECONNREFUSED",
    );
    const error = errorWithCode(
      "tunneling socket could not be established",
      "ECONNRESET",
    );
    error.cause = cause;
    const http = new StubbedHttpTransport({ [API_URL]: { error } });
    await expect(fetchBundles(http)).rejects.toMatchObject({
      unavailable: true,
    });
  });

  test.each([
    "CERT_HAS_EXPIRED",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ])(
    "fails on the TLS error %s instead of reporting an outage",
    async (code) => {
      const http = new StubbedHttpTransport({
        [API_URL]: { error: errorWithCode("certificate problem", code) },
      });
      await expect(fetchBundles(http)).rejects.toMatchObject({
        unavailable: false,
        message: `Could not reach api.github.com: certificate problem (${code})`,
      });
    },
  );

  test("reports a bundle download outage without the signed URL", async () => {
    const http = new StubbedHttpTransport({
      [API_URL]: { body: pointerOnlyResponse() },
      [BUNDLE_URL]: { statusCode: 503 },
    });
    const error = await fetchBundles(http).catch((e: unknown) => e);
    expect(error).toMatchObject({
      unavailable: true,
      message:
        "Downloading an attestation bundle from tmaproduction.blob.core.windows.net returned HTTP 503.",
    });
  });

  test("rejects a bundle download that isn't Snappy data", async () => {
    const http = new StubbedHttpTransport({
      [API_URL]: { body: pointerOnlyResponse() },
      [BUNDLE_URL]: { body: "not snappy" },
    });
    await expect(fetchBundles(http)).rejects.toMatchObject({
      unavailable: false,
      message: expect.stringContaining(
        "The attestation bundle from tmaproduction.blob.core.windows.net is not valid:",
      ),
    });
  });

  test("skips attestations with neither a bundle nor a bundle URL", async () => {
    const http = new StubbedHttpTransport({
      [API_URL]: { body: '{"attestations":[{"bundle":null}]}' },
    });
    await expect(fetchBundles(http)).resolves.toEqual([]);
  });
});

function fetchBundles(http: StubbedHttpTransport): Promise<unknown[]> {
  return new GitHubAttestationApi("token", http).fetchBundles("qltysh", DIGEST);
}

function inlineBundle(): unknown {
  return JSON.parse(fixture("attestations-qlty-v0.555.0.json").toString())
    .attestations[0].bundle;
}

function pointerOnlyResponse(): string {
  return JSON.stringify({
    attestations: [{ bundle: null, bundle_url: BUNDLE_URL }],
  });
}

function errorWithCode(
  message: string,
  code: string,
): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function fixture(name: string): Buffer {
  return fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
}
