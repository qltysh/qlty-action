# Fmt qlty-action

A GitHub Action for running automated formatting using the qlty tool.

Before running the Qlty CLI, the action checks its attestation with the GitHub CLI (`gh`) 2.67.0 or later. If the runner has no usable `gh`, the action logs a warning and runs the CLI unverified. See [Verifying the Qlty CLI](../coverage/README.md#verifying-the-qlty-cli).

## Configuration

### Fmt Action Inputs

| Input    | Description              | Required | Default |
| -------- | ------------------------ | -------- | ------- |
| `commit` | Commit changes after fmt | false    | false   |

### Code Formatting

```yaml
- name: Format Code
  uses: qltysh/qlty-action/fmt@v2
  with:
    commit: false
```
