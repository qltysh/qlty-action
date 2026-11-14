# Qlty Install Action

Installs the [Qlty CLI](https://github.com/qltysh/qlty) and adds it to `PATH`. Before installing it, the action verifies the CLI's attestation itself, without the GitHub CLI (`gh`), and fails the step if it can't. See [Verifying the Qlty CLI](../coverage/README.md#verifying-the-qlty-cli).

## Usage

```yaml
steps:
  - uses: qltysh/qlty-action/install@v2
  - run: qlty --version
```

## Inputs

| Input                | Description                                                                                                          | Required | Default               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | --------------------- |
| `github-token`       | GitHub token for looking up the Qlty CLI's attestation on github.com                                                 | No       | `${{ github.token }}` |
| `verify-attestation` | Verify the Qlty CLI's attestation before installing it. Set to `false` only if verification can't run on your runner | No       | `true`                |
