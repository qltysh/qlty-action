# Review instructions

This is qlty-action, the GitHub Actions people run in their own CI to install the Qlty CLI, run `qlty fmt` and upload coverage, with their own tokens or OIDC.

@review-common.md

## Also Important here

A change that breaks existing workflows (inputs, outputs, defaults, the Node runtime), weakens download or attestation verification, exposes tokens, or sends tokens or customer data to Sentry or other telemetry is Important. A missing test for download, checksum or attestation verification, or for token and OIDC handling, is Important too.
