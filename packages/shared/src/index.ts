// Errors reported to Qlty's error tracking
export { errorText, ReportableError, type FailureKind } from "./errors.js";

// The action's own version, read from its package.json
export { default as Version } from "./version.js";

// Main exports
export {
  AttestationError,
  AttestationUnavailableError,
  Installer,
  type AttestationOutcome,
  type InstallerOptions,
  type NullInstallerOptions,
} from "./installer.js";

// Attestation
export {
  GhAttestationVerifier,
  type AttestationResult,
  type AttestationSkipReason,
  type AttestationVerifier,
  type CommandRunner,
} from "./attestation.js";

// Platform detection
export { planDownload, type DownloadPlan, type FileType } from "./platform.js";

// Interfaces
export type { ToolCache, OperatingSystem, ActionOutput } from "./interfaces.js";

// Test stubs
export {
  StubbedAttestationVerifier,
  StubbedGhRunner,
  StubbedOperatingSystem,
  StubbedToolCache,
  StubbedOutput,
  type AttestationBehavior,
} from "./stubs.js";

// Output tracker
export { default as OutputTracker } from "./output-tracker.js";
