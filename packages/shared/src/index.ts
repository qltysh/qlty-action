// Main exports
export {
  AttestationError,
  AttestationUnavailableError,
  Installer,
  type InstallerOptions,
  type NullInstallerOptions,
} from "./installer.js";

// Attestation
export {
  SigstoreAttestationVerifier,
  type AttestationResult,
  type AttestationVerifier,
} from "./attestation.js";
export {
  GitHubAttestationApi,
  GITHUB_API_URL,
  type AttestationSource,
} from "./attestation-api.js";
export { AttestationCheckError } from "./attestation-check-error.js";
export {
  HttpFetcher,
  SigstoreTrustedRoot,
  SIGSTORE_TUF_URL,
  type TrustedRootSource,
} from "./trusted-root.js";
export {
  ActionsHttpTransport,
  type HttpResponse,
  type HttpTransport,
} from "./http.js";
export { decompressSnappy, SnappyError } from "./snappy.js";

// Platform detection
export { planDownload, type DownloadPlan, type FileType } from "./platform.js";

// Interfaces
export type { ToolCache, OperatingSystem, ActionOutput } from "./interfaces.js";

// Test stubs
export {
  StubbedAttestationVerifier,
  StubbedHttpTransport,
  StubbedOperatingSystem,
  StubbedToolCache,
  StubbedOutput,
  type AttestationBehavior,
  type StubbedHttpResponse,
} from "./stubs.js";

// Output tracker
export { default as OutputTracker } from "./output-tracker.js";
