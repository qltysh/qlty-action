// Main exports
export {
  Installer,
  type InstallerOptions,
  type NullInstallerOptions,
} from "./installer.js";

// Attestation
export {
  GhAttestationVerifier,
  type AttestationResult,
  type AttestationVerifier,
} from "./attestation.js";

// Platform detection
export { planDownload, type DownloadPlan, type FileType } from "./platform.js";

// Interfaces
export type { ToolCache, OperatingSystem, ActionOutput } from "./interfaces.js";

// Test stubs
export {
  StubbedAttestationVerifier,
  StubbedOperatingSystem,
  StubbedToolCache,
  StubbedOutput,
  type AttestationBehavior,
} from "./stubs.js";

// Output tracker
export { default as OutputTracker } from "./output-tracker.js";
