import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import os from "node:os";
import { bundleFromJSON, type Bundle } from "@sigstore/bundle";
import type { X509Certificate } from "@sigstore/core";
import { Verifier, toSignedEntity, toTrustMaterial } from "@sigstore/verify";
import {
  GitHubAttestationApi,
  type AttestationSource,
} from "./attestation-api.js";
import { AttestationCheckError } from "./attestation-check-error.js";
import { ActionsHttpTransport, errorMessage } from "./http.js";
import { SigstoreTrustedRoot, type TrustedRootSource } from "./trusted-root.js";

export type AttestationResult =
  | { success: true; digest: string; signer: string }
  | { success: false; unavailable: boolean; error: string };

export interface AttestationVerifier {
  verify(filePath: string, owner: string): Promise<AttestationResult>;
}

const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1";
const IN_TOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";
const IN_TOTO_STATEMENT_TYPES = new Set([
  "https://in-toto.io/Statement/v1",
  "https://in-toto.io/Statement/v0.1",
]);
const GITHUB_ACTIONS_OIDC_ISSUER =
  "https://token.actions.githubusercontent.com";
// Fulcio's Source Repository Owner URI certificate extension. See
// https://github.com/sigstore/fulcio/blob/main/docs/oid-info.md
const OID_SOURCE_REPOSITORY_OWNER_URI = "1.3.6.1.4.1.57264.1.16";
const ASN1_UTF8_STRING = 12;

// Verifies the archive's GitHub artifact attestation with sigstore-js, in the
// action's own process, so it needs no GitHub CLI. It applies the policy of
// `gh attestation verify --owner <owner>`: SLSA provenance for the archive's
// digest, signed in a GitHub Actions workflow of a repository the owner owns,
// with a certificate from Sigstore's public-good Fulcio and a Rekor entry.
export class SigstoreAttestationVerifier implements AttestationVerifier {
  static create(
    token: string,
    env: NodeJS.ProcessEnv = process.env,
  ): SigstoreAttestationVerifier {
    const http = new ActionsHttpTransport();
    return new SigstoreAttestationVerifier(
      new GitHubAttestationApi(token, http),
      new SigstoreTrustedRoot(http, env["RUNNER_TEMP"] || os.tmpdir()),
    );
  }

  constructor(
    private attestations: AttestationSource,
    private trustedRoot: TrustedRootSource,
  ) {}

  async verify(filePath: string, owner: string): Promise<AttestationResult> {
    let digest: string;
    try {
      digest = await sha256File(filePath);
    } catch (error) {
      return failure(`Could not read the archive: ${errorMessage(error)}`);
    }
    return this.verifyDigest(digest, owner);
  }

  async verifyDigest(
    digest: string,
    owner: string,
  ): Promise<AttestationResult> {
    try {
      const bundles = await this.attestations.fetchBundles(owner, digest);
      const provenance = bundles.flatMap((json) => {
        const bundle = provenanceBundle(json, digest);
        return bundle ? [bundle] : [];
      });
      if (provenance.length === 0) {
        const count = `${bundles.length} attestation${bundles.length === 1 ? "" : "s"}`;
        return failure(
          `GitHub has ${count} for this archive (sha256:${digest}), and none is SLSA provenance for it.`,
        );
      }

      const verifier = new Verifier(
        toTrustMaterial(await this.trustedRoot.load()),
      );
      const rejections: string[] = [];
      for (const bundle of provenance) {
        try {
          const signer = verifyBundle(verifier, bundle, owner);
          return { success: true, digest, signer };
        } catch (error) {
          rejections.push(errorMessage(error));
        }
      }
      return failure(
        `The SLSA provenance for this archive (sha256:${digest}) did not pass verification: ${rejections.join("; ")}`,
      );
    } catch (error) {
      if (error instanceof AttestationCheckError) {
        return {
          success: false,
          unavailable: error.unavailable,
          error: error.message,
        };
      }
      return failure(errorMessage(error));
    }
  }
}

// Returns the bundle if it is a DSSE-signed in-toto statement of SLSA
// provenance that names the digest. This reads the payload before the
// signature is checked; verifyBundle then checks the signature over it.
function provenanceBundle(json: unknown, digest: string): Bundle | undefined {
  let bundle: Bundle;
  try {
    bundle = bundleFromJSON(json);
  } catch {
    return undefined;
  }
  if (bundle.content.$case !== "dsseEnvelope") {
    return undefined;
  }
  const envelope = bundle.content.dsseEnvelope;
  if (envelope.payloadType !== IN_TOTO_PAYLOAD_TYPE) {
    return undefined;
  }

  let statement: unknown;
  try {
    statement = JSON.parse(envelope.payload.toString("utf8"));
  } catch {
    return undefined;
  }
  if (
    !isRecord(statement) ||
    typeof statement["_type"] !== "string" ||
    !IN_TOTO_STATEMENT_TYPES.has(statement["_type"]) ||
    statement["predicateType"] !== SLSA_PROVENANCE_V1 ||
    !Array.isArray(statement["subject"])
  ) {
    return undefined;
  }

  const namesDigest = statement["subject"].some((subject: unknown) => {
    const digests = isRecord(subject) ? subject["digest"] : undefined;
    const sha256 = isRecord(digests) ? digests["sha256"] : undefined;
    return typeof sha256 === "string" && sha256.toLowerCase() === digest;
  });
  return namesDigest ? bundle : undefined;
}

// Throws unless the bundle verifies against Sigstore's trusted root and was
// signed by a GitHub Actions workflow in one of the owner's repositories.
// Returns the signing workflow.
function verifyBundle(
  verifier: Verifier,
  bundle: Bundle,
  owner: string,
): string {
  const entity = toSignedEntity(bundle);
  verifier.verify(entity, {
    extensions: { issuer: GITHUB_ACTIONS_OIDC_ISSUER },
  });

  if (entity.key.$case !== "certificate") {
    throw new Error("It is signed with a key, not a Sigstore certificate.");
  }
  const certificate = entity.key.certificate;

  const signer = certificate.subjectAltName ?? "";
  if (!isWorkflowOf(signer, owner)) {
    throw new Error(
      `It was signed by ${signer || "an unnamed identity"}, not a workflow in https://github.com/${owner}.`,
    );
  }

  const ownerUri = extensionText(certificate, OID_SOURCE_REPOSITORY_OWNER_URI);
  if (ownerUri !== `https://github.com/${owner}`) {
    throw new Error(
      `Its certificate names the source repository owner ${ownerUri ?? "(none)"}, not https://github.com/${owner}.`,
    );
  }

  return signer;
}

// gh matches the signer against (?i)^https://github.com/<owner>/. Parsing it
// as a URL also rejects dot segments and credentials.
export function isWorkflowOf(subjectAltName: string, owner: string): boolean {
  let url: URL;
  try {
    url = new URL(subjectAltName);
  } catch {
    return false;
  }
  return (
    url.origin === "https://github.com" &&
    url.username === "" &&
    url.password === "" &&
    url.pathname.toLowerCase().startsWith(`/${owner.toLowerCase()}/`)
  );
}

// Fulcio encodes its newer extensions as a DER UTF8String.
function extensionText(
  certificate: X509Certificate,
  oid: string,
): string | undefined {
  const value = certificate.extension(oid)?.valueObj.subs[0];
  if (!value?.tag.isUniversal() || value.tag.number !== ASN1_UTF8_STRING) {
    return undefined;
  }
  return value.value.toString("utf8");
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

function failure(error: string): AttestationResult {
  return { success: false, unavailable: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
