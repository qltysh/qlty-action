# Qlty Install Action

Installs the [Qlty CLI](https://github.com/qltysh/qlty) and adds it to `PATH`. Before installing the CLI, the action checks its attestation with the GitHub CLI (`gh`). Without `gh` 2.67.0 or later where the step runs, which in a `container:` job means inside the container, the action logs a warning and installs the CLI unverified. See [Verifying the Qlty CLI](../README.md#verifying-the-qlty-cli).

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
