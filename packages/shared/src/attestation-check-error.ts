// A step of the attestation check that could not complete. `unavailable`
// means a service it needs was down or unreachable, so trying later may work.
export class AttestationCheckError extends Error {
  readonly unavailable: boolean;

  constructor(message: string, { unavailable }: { unavailable: boolean }) {
    super(message);
    this.name = "AttestationCheckError";
    this.unavailable = unavailable;
  }
}
