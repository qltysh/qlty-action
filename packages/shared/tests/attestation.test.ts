import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { isWorkflowOf } from "../src/attestation.js";
import {
  AttestationCheckError,
  decompressSnappy,
  GitHubAttestationApi,
  SigstoreAttestationVerifier,
  StubbedHttpTransport,
  type AttestationSource,
  type TrustedRootSource,
} from "../src/index.js";

const QLTY_V0_555_0_DIGEST =
  "6e941b93b01f18df4263497cf5531c78651719fda1f8ef382d4b60b59785941e";
const QLTY_V0_669_0_DIGEST =
  "f8d49a94857379b82663ac6a15c5b304baa659a15b01c3e0d292af1e8acae4ad";
const GH_V2_104_0_DIGEST =
  "98cb101ad87dbbd3f6b2f2bfcbd43197ccd07643140121d8a9cfaa91eadbc24e";
const QLTY_SIGNER =
  "https://github.com/qltysh/qlty/.github/workflows/build.yml@refs/heads/main";

describe("SigstoreAttestationVerifier", () => {
  test("verifies the SLSA provenance of a Qlty CLI archive", async () => {
    const verifier = createVerifier(qltyBundles("v0.555.0"));
    const result = await verifier.verifyDigest(QLTY_V0_555_0_DIGEST, "qltysh");
    expect(result).toEqual({
      success: true,
      digest: QLTY_V0_555_0_DIGEST,
      signer: QLTY_SIGNER,
    });
  });

  test("passes over GitHub's release attestation to verify the provenance", async () => {
    const bundles = qltyBundles("v0.669.0");
    expect(bundles.map(predicateType)).toEqual([
      "https://in-toto.io/attestation/release/v0.2",
      "https://slsa.dev/provenance/v1",
    ]);
    const result = await createVerifier(bundles).verifyDigest(
      QLTY_V0_669_0_DIGEST,
      "qltysh",
    );
    expect(result).toMatchObject({ success: true, signer: QLTY_SIGNER });
  });

  test("verifies a bundle GitHub serves only from bundle_url", async () => {
    const http = new StubbedHttpTransport({
      [`https://api.github.com/orgs/cli/attestations/sha256:${GH_V2_104_0_DIGEST}?per_page=100`]:
        { body: fixture("attestations-gh-v2.104.0.json") },
      "https://tmaproduction.blob.core.windows.net/attestations/212613049/2026/11/12/66847463.json.sn?sig=REDACTED":
        { body: fixture("bundle-gh-v2.104.0-0.snappy") },
      "https://tmaproduction.blob.core.windows.net/attestations/212613049/2026/11/12/66846719.json.sn?sig=REDACTED":
        { body: fixture("bundle-gh-v2.104.0-1.snappy") },
    });
    const verifier = new SigstoreAttestationVerifier(
      new GitHubAttestationApi("token", http),
      new StaticTrustedRoot(),
    );

    const result = await verifier.verifyDigest(GH_V2_104_0_DIGEST, "cli");
    expect(result).toMatchObject({
      success: true,
      signer: expect.stringMatching(/^https:\/\/github\.com\/cli\/cli\//),
    });
  });

  test("hashes the file it is given", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qlty-attestation-"));
    const file = path.join(dir, "qlty.tar.xz");
    fs.writeFileSync(file, "archive contents");
    const source = new RecordingAttestationSource();

    await new SigstoreAttestationVerifier(
      source,
      new StaticTrustedRoot(),
    ).verify(file, "qltysh");

    expect(source.requests).toEqual([
      {
        owner: "qltysh",
        digest: createHash("sha256").update("archive contents").digest("hex"),
      },
    ]);
    fs.rmSync(dir, { recursive: true });
  });

  test("fails when it cannot read the archive", async () => {
    const result = await createVerifier([]).verify(
      path.join(os.tmpdir(), "qlty-missing-archive.tar.xz"),
      "qltysh",
    );
    expect(result).toMatchObject({
      success: false,
      unavailable: false,
      error: expect.stringContaining("Could not read the archive:"),
    });
  });

  test("rejects an archive no attestation names", async () => {
    const otherDigest = "0".repeat(64);
    const result = await createVerifier(qltyBundles("v0.555.0")).verifyDigest(
      otherDigest,
      "qltysh",
    );
    expect(result).toEqual({
      success: false,
      unavailable: false,
      error: `GitHub has 1 attestation for this archive (sha256:${otherDigest}), and none is SLSA provenance for it.`,
    });
  });

  test("rejects an archive with only a release attestation", async () => {
    const [releaseAttestation] = qltyBundles("v0.669.0");
    const result = await createVerifier([releaseAttestation]).verifyDigest(
      QLTY_V0_669_0_DIGEST,
      "qltysh",
    );
    expect(result).toMatchObject({
      success: false,
      unavailable: false,
      error: expect.stringContaining("and none is SLSA provenance for it."),
    });
  });

  test("rejects provenance signed by another owner's workflow", async () => {
    const bundles = [0, 1].map((i) =>
      JSON.parse(
        decompressSnappy(
          fixture(`bundle-gh-v2.104.0-${i}.snappy`),
          1 << 24,
        ).toString("utf8"),
      ),
    );
    const result = await createVerifier(bundles).verifyDigest(
      GH_V2_104_0_DIGEST,
      "qltysh",
    );
    expect(result).toMatchObject({
      success: false,
      unavailable: false,
      error: expect.stringMatching(
        /did not pass verification: It was signed by https:\/\/github\.com\/cli\/cli\/.*, not a workflow in https:\/\/github\.com\/qltysh\.$/,
      ),
    });
  });

  test("rejects a certificate whose source repository owner differs", async () => {
    // The signer check ignores case, as gh's does, but the owner extension
    // must match exactly.
    const result = await createVerifier(qltyBundles("v0.555.0")).verifyDigest(
      QLTY_V0_555_0_DIGEST,
      "QLTYSH",
    );
    expect(result).toMatchObject({
      success: false,
      unavailable: false,
      error: expect.stringContaining(
        "Its certificate names the source repository owner https://github.com/qltysh, not https://github.com/QLTYSH.",
      ),
    });
  });

  test("rejects provenance whose signed statement was changed", async () => {
    const forgedDigest = "1".repeat(64);
    const [bundle] = qltyBundles("v0.555.0") as [
      { dsseEnvelope: { payload: string } },
    ];
    const envelope = bundle.dsseEnvelope;
    const statement = JSON.parse(
      Buffer.from(envelope.payload, "base64").toString("utf8"),
    );
    statement.subject.push({ name: "qlty", digest: { sha256: forgedDigest } });
    envelope.payload = Buffer.from(JSON.stringify(statement)).toString(
      "base64",
    );

    const result = await createVerifier([bundle]).verifyDigest(
      forgedDigest,
      "qltysh",
    );
    expect(result).toMatchObject({
      success: false,
      unavailable: false,
      error: expect.stringContaining("did not pass verification"),
    });
  });

  test("rejects provenance whose certificate Sigstore's trusted root did not issue", async () => {
    const trustedRoot = trustedRootFixture();
    trustedRoot.certificateAuthorities = [];
    const verifier = new SigstoreAttestationVerifier(
      new RecordingAttestationSource(qltyBundles("v0.555.0")),
      new StaticTrustedRoot(trustedRoot),
    );

    const result = await verifier.verifyDigest(QLTY_V0_555_0_DIGEST, "qltysh");
    expect(result).toMatchObject({
      success: false,
      unavailable: false,
      error: expect.stringContaining("did not pass verification"),
    });
  });

  test.each([true, false])(
    "passes on whether the attestation lookup was unavailable (%s)",
    async (unavailable) => {
      const verifier = new SigstoreAttestationVerifier(
        new RecordingAttestationSource(
          new AttestationCheckError("lookup failed", { unavailable }),
        ),
        new StaticTrustedRoot(),
      );
      const result = await verifier.verifyDigest(
        QLTY_V0_555_0_DIGEST,
        "qltysh",
      );
      expect(result).toEqual({
        success: false,
        unavailable,
        error: "lookup failed",
      });
    },
  );

  test("reports when the trusted root is unavailable", async () => {
    const verifier = new SigstoreAttestationVerifier(
      new RecordingAttestationSource(qltyBundles("v0.555.0")),
      new StaticTrustedRoot(
        new AttestationCheckError("TUF is down", { unavailable: true }),
      ),
    );
    const result = await verifier.verifyDigest(QLTY_V0_555_0_DIGEST, "qltysh");
    expect(result).toEqual({
      success: false,
      unavailable: true,
      error: "TUF is down",
    });
  });

  test("fails on an unexpected error", async () => {
    const verifier = new SigstoreAttestationVerifier(
      new RecordingAttestationSource(new Error("something broke")),
      new StaticTrustedRoot(),
    );
    const result = await verifier.verifyDigest(QLTY_V0_555_0_DIGEST, "qltysh");
    expect(result).toEqual({
      success: false,
      unavailable: false,
      error: "something broke",
    });
  });
});

describe("isWorkflowOf", () => {
  test.each([
    QLTY_SIGNER,
    "https://github.com/qltysh/qlty/.github/workflows/release.yml@refs/tags/v1.0.0",
    "https://github.com/QLTYSH/qlty/.github/workflows/build.yml@refs/heads/main",
  ])("accepts %s", (signer) => {
    expect(isWorkflowOf(signer, "qltysh")).toBe(true);
  });

  test.each([
    "https://github.com/qltysh-evil/qlty/.github/workflows/build.yml@refs/heads/main",
    "https://github.com/evil/qltysh/.github/workflows/build.yml@refs/heads/main",
    "https://github.com/qltysh/../evil/qlty/.github/workflows/build.yml@refs/heads/main",
    "https://user@github.com/qltysh/qlty/.github/workflows/build.yml@refs/heads/main",
    "https://github.com.evil.example/qltysh/qlty/.github/workflows/build.yml@refs/heads/main",
    "http://github.com/qltysh/qlty/.github/workflows/build.yml@refs/heads/main",
    "https://gitlab.com/qltysh/qlty/.github/workflows/build.yml@refs/heads/main",
    "https://github.com/qltysh",
    "",
    "not a url",
  ])("rejects %s", (signer) => {
    expect(isWorkflowOf(signer, "qltysh")).toBe(false);
  });
});

class RecordingAttestationSource implements AttestationSource {
  requests: { owner: string; digest: string }[] = [];

  constructor(private bundles: unknown[] | Error = []) {}

  async fetchBundles(owner: string, digest: string): Promise<unknown[]> {
    this.requests.push({ owner, digest });
    if (this.bundles instanceof Error) {
      throw this.bundles;
    }
    return structuredClone(this.bundles);
  }
}

class StaticTrustedRoot implements TrustedRootSource {
  constructor(private root: TrustedRoot | Error = trustedRootFixture()) {}

  async load(): Promise<TrustedRoot> {
    if (this.root instanceof Error) {
      throw this.root;
    }
    return this.root;
  }
}

function createVerifier(bundles: unknown[]): SigstoreAttestationVerifier {
  return new SigstoreAttestationVerifier(
    new RecordingAttestationSource(bundles),
    new StaticTrustedRoot(),
  );
}

function qltyBundles(version: string): unknown[] {
  const response = JSON.parse(
    fixture(`attestations-qlty-${version}.json`).toString("utf8"),
  );
  return response.attestations.map((a: { bundle: unknown }) => a.bundle);
}

function predicateType(bundle: unknown): string {
  const payload = (bundle as { dsseEnvelope: { payload: string } }).dsseEnvelope
    .payload;
  return JSON.parse(Buffer.from(payload, "base64").toString("utf8"))
    .predicateType;
}

function trustedRootFixture(): TrustedRoot {
  return TrustedRoot.fromJSON(
    JSON.parse(fixture("trusted_root.json").toString("utf8")),
  );
}

function fixture(name: string): Buffer {
  return fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
}
