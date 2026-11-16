<div align="left" id="top">
<a href="https://qlty.sh"><img alt="Qlty" src="https://cdn.brandfetch.io/idGrC4YgF4/theme/dark/idPHbenxLP.svg?c=1bxid64Mup7aczewSAYMX&t=1734797742010" height="75"></a>
</div>

## Integrate Qlty into your GitHub Actions workflows

[![Maintainability](https://qlty.sh/badges/50c320fb-5b97-4e5d-9c5e-8808dfbf0c6f/maintainability.svg)](https://qlty.sh/gh/qltysh/projects/qlty-action)
[![Code Coverage](https://qlty.sh/badges/50c320fb-5b97-4e5d-9c5e-8808dfbf0c6f/test_coverage.svg?v=2)](https://qlty.sh/gh/qltysh/projects/qlty-action)
[![Unit Tests](https://github.com/qltysh/qlty-action/actions/workflows/tests.yml/badge.svg)](https://github.com/qltysh/qlty-action/actions/workflows/tests.yml)
[![Latest release](https://img.shields.io/github/v/release/qltysh/qlty-action?v=3)](https://github.com/qltysh/qlty-action/releases)
[![docs.qlty.sh](https://img.shields.io/badge/docs-docs.qlty.sh-08b2b7)](https://docs.qlty.sh)

### What is Qlty?

[Qlty CLI](https://github.com/qltysh/qlty) is a multi-language code quality tool for linting, auto-formatting, maintainability, security, and coverage with support for 70+ static analysis tools for 40+ languages and technologies.

The Qlty CLI is **completely free for all use**, including for commercial projects, with no limits on contributors.

### What is this project?

This is a collection of reusable GitHub Actions to make it easy to integrate Qlty into your continuous integration workflows.

---

## 🖥️ Requirements

The `qltysh/qlty-action/coverage` action requires a free account on [Qlty Cloud](https://qlty.sh) for code coverage reporting.

The other actions use the Qlty CLI and do not require Qlty Cloud.

---

## ▶️ Actions

| Action                                                                                         | Purpose                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [qltysh/qlty-action/coverage](https://github.com/qltysh/qlty-action/tree/main/coverage#readme) | Upload code coverage data to [Qlty Cloud](https://qlty.sh) |
| [qltysh/qlty-action/install](https://github.com/qltysh/qlty-action/tree/main/install)          | Install the Qlty CLI onto your CI runner                   |
| [qltysh/qlty-action/fmt](https://github.com/qltysh/qlty-action/tree/main/fmt#readme)           | Auto-format your code                                      |

---

## Verifying the Qlty CLI

Before the coverage, fmt and install actions run the Qlty CLI, they check its Sigstore attestation with the [GitHub CLI](https://cli.github.com/) (`gh`):

- If the check rejects the CLI, for example because no attestation matches the downloaded archive, the step fails and the CLI doesn't run.
- If the check can't finish because GitHub or Sigstore is unavailable, the CLI doesn't run either. The fmt and install steps fail. The coverage step fails only when `skip-errors` is false; see [What `skip-errors` covers](coverage/README.md#what-skip-errors-covers).
- If `gh` 2.67.0 or later isn't available where the step runs, the check can't run. The action logs a "Qlty CLI Not Verified" warning and runs the CLI anyway, whatever `skip-errors` is set to. The unverified CLI runs with access to the job's tokens and secrets.

### Installing `gh`

GitHub-hosted runners include `gh`. Self-hosted runners and `container:` jobs often don't:

- On a self-hosted runner, install `gh` on the runner.
- In a `container:` job, the step runs inside the container, so `gh` on the runner's host isn't used. Install `gh` in the container image or in an earlier step.

See the GitHub CLI [installation instructions](https://github.com/cli/cli#installation). On Linux, use GitHub's package repository as described in [Installing gh on Linux](https://github.com/cli/cli/blob/trunk/docs/install_linux.md): some distributions' own `gh` packages are older than 2.67.0.

---

## 🛟 Help or Feedback

- [Get Started](https://qlty.sh/) with Qlty Cloud
- Read the [documentation](https://docs.qlty.sh)
- Join our [Discord](https://qlty.sh/discord) chat
- [Community support](https://github.com/orgs/qltysh/discussions/categories/q-a) via GitHub Discussions
- [Feature requests](https://github.com/orgs/qltysh/discussions/categories/feedback) via GitHub Discussions
- [Bug reports](https://github.com/qltysh/qlty-action/issues/new/choose) via GitHub Issues

---

## ⚖️ License

This reusable GitHub Action is provided under the [MIT License](https://github.com/qltysh/qlty-action/blob/main/LICENSE.md).

Qlty CLI is published under a Fair Source license. As Fair Source, the Qlty CLI is free to use (including in commercial contexts), modify, and distribute in accordance with its license.

More details are available [in the qltysh/qlty repository](https://github.com/qltysh/qlty/blob/main/LICENSE.md).

---
