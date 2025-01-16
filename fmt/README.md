# Fmt qlty-action

A GitHub Action for running automated formatting using the qlty tool.

## Configuration

### Fmt Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `commit` | Commit changes after fmt | false | false |

### Code Formatting

```yaml
- name: Format Code
  uses: qltysh/qlty-action/fmt@main
  with:
    commit: false
```
