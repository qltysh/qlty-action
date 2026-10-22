# Qlty Install Action

Installs the [Qlty CLI](https://github.com/qltysh/qlty) and adds it to `PATH`. The action checks the CLI's attestation with the GitHub CLI (`gh`) 2.67.0 or later before installing it; see [Verifying the Qlty CLI](../coverage/README.md#verifying-the-qlty-cli).

## Usage

```yaml
steps:
  - uses: qltysh/qlty-action/install@v2
  - run: qlty --version
```

## Inputs

| Input          | Description                                        | Required | Default               |
| -------------- | -------------------------------------------------- | -------- | --------------------- |
| `github-token` | GitHub token for sigstore attestation verification | No       | `${{ github.token }}` |
