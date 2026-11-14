import type { AttestationOutcome } from "@qltysh-action/shared";
import { recordAttestation } from "@qltysh-action/shared/telemetry";

// Where the action reports the attestation check's outcome. Error reports
// carry it; a run that succeeds sends nothing.
export interface Telemetry {
  recordAttestation(outcome: AttestationOutcome): void;
}

export const sentryTelemetry: Telemetry = { recordAttestation };

export class StubbedTelemetry implements Telemetry {
  attestation: AttestationOutcome | undefined;

  recordAttestation(outcome: AttestationOutcome): void {
    this.attestation = outcome;
  }
}
