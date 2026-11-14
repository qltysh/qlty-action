# Fmt qlty-action

A GitHub Action for running automated formatting using the qlty tool.

## Configuration

### Fmt Action Inputs

| Input                | Description                                                                                                                                                                                      | Required | Default               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------- |
| `commit`             | Commit changes after fmt                                                                                                                                                                         | false    | false                 |
| `github-token`       | GitHub token for looking up the Qlty CLI's attestation on github.com                                                                                                                             | false    | `${{ github.token }}` |
| `verify-attestation` | Verify the Qlty CLI's attestation before installing it. Set to `false` only if verification can't run on your runner. See [Verifying the Qlty CLI](../coverage/README.md#verifying-the-qlty-cli) | false    | true                  |

### Code Formatting

```yaml
- name: Format Code
  uses: qltysh/qlty-action/fmt@v2
  with:
    commit: false
```
