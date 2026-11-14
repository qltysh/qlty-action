# Fmt qlty-action

A GitHub Action for running automated formatting using the qlty tool.

Before running the Qlty CLI, the action checks its attestation with the GitHub CLI (`gh`) 2.67.0 or later. If the runner has no usable `gh`, the action logs a warning and runs the CLI unverified. See [Verifying the Qlty CLI](../coverage/README.md#verifying-the-qlty-cli).

## Configuration

### Fmt Action Inputs

| Input       | Description                                                                                                | Required | Default |
| ----------- | ---------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `commit`    | Commit changes after fmt                                                                                   | false    | false   |
| `telemetry` | Send Qlty an error report when the step fails. Set to `false` to send nothing. See [Telemetry](#telemetry) | false    | true    |

### Code Formatting

```yaml
- name: Format Code
  uses: qltysh/qlty-action/fmt@v2
  with:
    commit: false
```

## Telemetry

When the step fails, the action sends Qlty an error report, which we use to find problems in the action and the Qlty CLI. A step that succeeds sends nothing.

A report holds:

- The error's type, such as `FmtError`, and the kind of failure, such as `cli_failed` or `install_failed`.
- The Qlty CLI's exit code, when the CLI ran.
- The action's name and version.
- The runner's operating system and Node.js version.

A report never holds the output of `qlty fmt`, error messages, a stack trace, your repository's name, the run's URL, your commit, or the runner's hostname.

To send nothing, set `telemetry: false`:

```yaml
- name: Format Code
  uses: qltysh/qlty-action/fmt@v2
  with:
    telemetry: false
```

The Qlty CLI has its own telemetry, which the `QLTY_TELEMETRY` environment variable controls. `telemetry: false` also sets `QLTY_TELEMETRY=off` for the CLI that the action runs. Setting `QLTY_TELEMETRY: off` in the job's environment turns off both the action's error reports and the CLI's telemetry.
