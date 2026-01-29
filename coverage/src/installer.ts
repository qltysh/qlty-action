// Re-export from shared installer package
export {
  Installer,
  type InstallerOptions,
  type NullInstallerOptions,
  GhAttestationVerifier,
  type AttestationResult,
  type AttestationVerifier,
  planDownload,
  type DownloadPlan,
  type FileType,
  type ToolCache,
  type OperatingSystem,
  StubbedAttestationVerifier,
  StubbedOperatingSystem,
  StubbedToolCache,
  type AttestationBehavior,
  OutputTracker,
} from "@qltysh-action/shared";
