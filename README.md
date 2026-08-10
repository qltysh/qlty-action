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

> [!TIP]
> For additional security, you can pin actions to a specific commit SHA instead of a tag:
> ```yaml
> uses: qltysh/qlty-action/coverage@a1b2c3d4e5f6...
> ```
> See [GitHub's documentation](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) for more information.

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
