import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DownloadHTTPError } from "tuf-js/dist/error.js";
import {
  HttpFetcher,
  SigstoreTrustedRoot,
  StubbedHttpTransport,
  type StubbedHttpResponse,
} from "../src/index.js";

// Responses from tuf-repo-cdn.sigstore.dev, recorded at `recordedAt`. TUF
// metadata expires, so the tests run with the clock set to that time.
const recording: {
  recordedAt: string;
  tufRoot: string;
  responses: Record<string, { statusCode: number; body: string }>;
} = JSON.parse(fixture("tuf-sigstore.json").toString("utf8"));

describe("SigstoreTrustedRoot", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "qlty-trusted-root-"));
    vi.useFakeTimers({ now: new Date(recording.recordedAt), toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("loads Sigstore's trusted root over TUF", async () => {
    const http = recordedTransport();
    const root = await createTrustedRoot(http).load();

    expect(root).toEqual(
      expect.objectContaining({
        mediaType: "application/vnd.dev.sigstore.trustedroot+json;version=0.1",
      }),
    );
    expect(root.certificateAuthorities.length).toBeGreaterThan(0);
    expect(root.tlogs.length).toBeGreaterThan(0);
    expect(
      http.requests.every(({ url }) =>
        url.startsWith("https://tuf-repo-cdn.sigstore.dev/"),
      ),
    ).toBe(true);
  });

  test("removes its TUF cache afterwards", async () => {
    await createTrustedRoot(recordedTransport()).load();
    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  test("reports expired TUF metadata as unavailable", async () => {
    vi.setSystemTime(
      new Date(Date.parse(recording.recordedAt) + 60 * 24 * 60 * 60 * 1000),
    );
    await expect(
      createTrustedRoot(recordedTransport()).load(),
    ).rejects.toMatchObject({
      name: "AttestationCheckError",
      unavailable: true,
      message: expect.stringContaining(
        "Could not load Sigstore's trusted root from tuf-repo-cdn.sigstore.dev:",
      ),
    });
    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  test("rejects TUF metadata whose signature doesn't verify", async () => {
    const timestamp = "https://tuf-repo-cdn.sigstore.dev/timestamp.json";
    const json = JSON.parse(
      Buffer.from(recording.responses[timestamp]!.body, "base64").toString(),
    );
    json.signed.meta["snapshot.json"].version += 1;
    const http = recordedTransport({
      [timestamp]: { body: JSON.stringify(json) },
    });

    await expect(createTrustedRoot(http).load()).rejects.toMatchObject({
      name: "AttestationCheckError",
    });
  });

  test("reports a network error as unavailable", async () => {
    const http = new StubbedHttpTransport(
      {},
      {
        error: Object.assign(new Error("read ECONNRESET"), {
          code: "ECONNRESET",
        }),
      },
    );
    await expect(createTrustedRoot(http).load()).rejects.toMatchObject({
      unavailable: true,
      message:
        "Could not load Sigstore's trusted root from tuf-repo-cdn.sigstore.dev: read ECONNRESET",
    });
  });

  test("fails on a TLS error instead of reporting an outage", async () => {
    const http = new StubbedHttpTransport(
      {},
      {
        error: Object.assign(new Error("certificate has expired"), {
          code: "CERT_HAS_EXPIRED",
        }),
      },
    );
    await expect(createTrustedRoot(http).load()).rejects.toMatchObject({
      unavailable: false,
    });
  });

  function createTrustedRoot(http: StubbedHttpTransport): SigstoreTrustedRoot {
    return new SigstoreTrustedRoot(
      http,
      tempDir,
      Buffer.from(recording.tufRoot, "base64"),
    );
  }
});

describe("HttpFetcher", () => {
  test("streams a 200 response", async () => {
    const http = new StubbedHttpTransport({
      "https://example.test/a.json": { body: "contents" },
    });
    const bytes = await new HttpFetcher(http).downloadBytes(
      "https://example.test/a.json",
      100,
    );
    expect(bytes.toString()).toBe("contents");
  });

  test("throws tuf-js's DownloadHTTPError on other statuses", async () => {
    const http = new StubbedHttpTransport();
    const error = await new HttpFetcher(http)
      .downloadBytes("https://example.test/17.root.json", 100)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DownloadHTTPError);
    expect(error).toMatchObject({ statusCode: 404 });
  });

  test("stops at tuf-js's length limit", async () => {
    const http = new StubbedHttpTransport({
      "https://example.test/a.json": { body: "x".repeat(101) },
    });
    await expect(
      new HttpFetcher(http).downloadBytes("https://example.test/a.json", 100),
    ).rejects.toThrow("Max length reached");
  });
});

function recordedTransport(
  overrides: Record<string, StubbedHttpResponse> = {},
): StubbedHttpTransport {
  const responses: Record<string, StubbedHttpResponse> = {};
  for (const [url, { statusCode, body }] of Object.entries(
    recording.responses,
  )) {
    responses[url] = { statusCode, body: Buffer.from(body, "base64") };
  }
  return new StubbedHttpTransport({ ...responses, ...overrides });
}

function fixture(name: string): Buffer {
  return fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
}
