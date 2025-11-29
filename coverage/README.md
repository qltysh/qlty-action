<div align="left" id="top">
<a href="https://qlty.sh"><img alt="Qlty" src="https://cdn.brandfetch.io/idGrC4YgF4/theme/dark/idPHbenxLP.svg?c=1bxid64Mup7aczewSAYMX&t=1734797742010" height="75"></a>
</div>

## What is Qlty?

[Qlty](https://qlty.sh) is a multi-language code quality tool for linting, auto-formatting, maintainability, security, and coverage with support for 70+ static analysis tools for 40+ languages and technologies.

## What is this GitHub Action?

This GitHub Action uploads code coverage data from your GitHub Actions workflow to Qlty Cloud for reporting.

[![Maintainability](https://qlty.sh/badges/50c320fb-5b97-4e5d-9c5e-8808dfbf0c6f/maintainability.svg)](https://qlty.sh/gh/qltysh/projects/qlty-action)
[![Code Coverage](https://qlty.sh/badges/50c320fb-5b97-4e5d-9c5e-8808dfbf0c6f/test_coverage.svg?v=2)](https://qlty.sh/gh/qltysh/projects/qlty-action)
[![Unit Tests](https://github.com/qltysh/qlty-action/actions/workflows/tests.yml/badge.svg)](https://github.com/qltysh/qlty-action/actions/workflows/tests.yml)
[![Latest release](https://img.shields.io/github/v/release/qltysh/qlty-action?v=3)](https://github.com/qltysh/qlty-action/releases)
[![docs.qlty.sh](https://img.shields.io/badge/docs-docs.qlty.sh-08b2b7)](https://docs.qlty.sh)

---

## ✨ Key Features

### Code Coverage on Qlty Cloud

|     | Feature                    | Advantage                                             |
| --- | -------------------------- | ----------------------------------------------------- |
| 🚦  | Line coverage              | Total coverage of projects, folders, and files        |
| ➕  | Diff coverage              | Coverage of new or changed lines in the diff          |
| ⭐  | Coverage ratings           | Easy to read A through F letter grades                |
| 🟢  | Coverage gates             | Pass / fail statuses baased on configurable rules     |
| 💬  | Pull request reviews       | Code review comments summarizing coverage             |
| 🏷️  | Coverage tags              | Report on unit test coverage and integration coverage |
| 🔀  | Server-side report merging | Combined reports without juggling data files          |

### Coverage Uploader GitHub Action

|     | Feature                    | Advantage                                          |
| --- | -------------------------- | -------------------------------------------------- |
| 🔑  | OpenID Connect (OIDC)      | Authentication with no tokens to install or rotate |
| 🔀  | Client-side report merging | Upload multiple coverage datafiles with globs      |
| 🔧  | Path fixing                | Adjust paths as needed for accurate results        |

---

## 🚀 Quick Start

1. Create an account on [Qlty Cloud](https://qlty.sh)
2. Add your repository as a project
3. Update your GitHub Actions workflow to upload code coverage:

```yaml
# ... Generate code coverage data from test execution ...

- uses: qltysh/qlty-action/coverage@v2
  with:
    oidc: true
    files: lcov.info
```

> [!NOTE]
> This uses OpenID Connect (OIDC) for authentication which avoids the need to install a Repository Secret in GitHub Actions.
>
> As an alternative to OIDC, you can obtain a Workspace or Project-level coverage tokens. See Examples below for more.

> [!TIP]
> For additional security, you can pin this action to a specific commit SHA instead of a tag:
> ```yaml
> uses: qltysh/qlty-action/coverage@a1b2c3d4e5f6...
> ```
> See [GitHub's documentation](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) for more information.

---

## 🖥️ Requirements

To use this coverage uploader, you need an accounton [Qlty Cloud](https://qlty.sh) which offers code coverage reporting.

The Qlty Cloud offers free plans, including for commercial projects, with no limits on contributors.

---

## ⚙️ Inputs

| Input                     | Description                                                                                                                                                                                                            | Required | Default   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------- |
| `token`                   | Coverage token for coverage submission. Required unless using `oidc`                                                                                                                                                   | No       | -         |
| `files`                   | Files to process (supports glob patterns and comma-separated paths)                                                                                                                                                    | Yes\*    | -         |
| `oidc`                    | Use OpenID Connect (OIDC) for authentication instead of a coverage token. [Learn more](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect) | No       | `false`   |
| `command`                 | The command to execute (`publish` or `complete`). Use `complete` to mark coverage collection as complete.                                                                                                              | No       | `publish` |
| `format`                  | The format of the coverage data (options: clover, cobertura, coverprofile, jacoco, lcov, qlty, simplecov)                                                                                                              | No       | -         |
| `total-parts-count`       | The total number of coverage uploads that qlty cloud should expect                                                                                                                                                     | No       |           |
| `verbose`                 | Display debug logs along with coverage data                                                                                                                                                                            | No       | `false`   |
| `add-prefix`              | Prefix to add to file paths                                                                                                                                                                                            | No       | -         |
| `strip-prefix`            | Prefix to remove from file paths                                                                                                                                                                                       | No       | -         |
| `skip-errors`             | If coverage upload fails, do not fail the CI build occur                                                                                                                                                               | No       | `true`    |
| `skip-missing-files`      | Files not in the directory are skipped                                                                                                                                                                                 | No       | `false`   |
| `tag`                     | Tag to associate with the coverage data                                                                                                                                                                                | No       | -         |
| `cli-version`             | Specific version of the Qlty CLI to use (e.g., '1.0.1'). If not specified, will install the latest version.                                                                                                            | No       |           |
| `dry-run`                 | Run in dry run mode without uploading coverage data                                                                                                                                                                    | No       | `false`   |
| `incomplete`              | Mark the coverage data as incomplete                                                                                                                                                                                   | No       | `false`   |
| `name`                    | Name to identify this coverage upload                                                                                                                                                                                  | No       | -         |
| `validate`                | Validate the coverage data                                                                                                                                                                                             | No       | `false`   |
| `validate-file-threshold` | Custom threshold percentage for validation (0-100). Only applies when validate is used.                                                                                                                                | No       | -         |

\*Required when command is 'publish'. Not applicable when command is 'complete'.

---

## 📚 Examples

### Upload using a coverage token

```yaml
- uses: qltysh/qlty-action/coverage@v2
  with:
    token: ${{ secrets.QLTY_COVERAGE_TOKEN }}
    files: lcov.info
```

### Uploading multiple reports with a glob

```yaml
- uses: qltysh/qlty-action/coverage@v2
  with:
    oidc: true
    files: path/to/coverage/*.json,other/path/to/coverage/*.json
```

### Upload with tags

```yaml
- uses: qltysh/qlty-action/coverage@v2
  with:
    oidc: true
    files: lcov.info
    tag: units
```

### Mark coverage collection as complete

```yaml
# After uploading all coverage files in separate steps or jobs
- uses: qltysh/qlty-action/coverage@v2
  with:
    oidc: true
    command: complete
    tag: units
```

### Example repositories

We provide example repositories as templates with code coverage for common languages:

| Language                                                   | GitHub Actions                                                                                                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Go](https://github.com/qltysh/example-go)                 | [![Build](https://github.com/qltysh/example-go/actions/workflows/main.yml/badge.svg)](https://github.com/qltysh/example-go/actions/workflows/main.yml)                 |
| [Java](https://github.com/qltysh/example-java)             | [![Build](https://github.com/qltysh/example-java/actions/workflows/main.yml/badge.svg)](https://github.com/qltysh/example-java/actions/workflows/main.yml)             |
| [JavaScript](https://github.com/qltysh/example-javascript) | [![Build](https://github.com/qltysh/example-javascript/actions/workflows/main.yml/badge.svg)](https://github.com/qltysh/example-javascript/actions/workflows/main.yml) |
| [Kotlin](https://github.com/qltysh/example-kotlin)         | [![Build](https://github.com/qltysh/example-kotlin/actions/workflows/main.yml/badge.svg)](https://github.com/qltysh/example-kotlin/actions/workflows/main.yml)         |
| [PHP](https://github.com/qltysh/example-php)               | [![Build](https://github.com/qltysh/example-php/actions/workflows/main.yml/badge.svg)](https://github.com/qltysh/example-php/actions/workflows/main.yml)               |
| [Python](https://github.com/qltysh/example-python)         | [![Build](https://github.com/qltysh/example-python/actions/workflows/main.yml/badge.svg)](https://github.com/qltysh/example-python/actions/workflows/main.yml)         |
| [Ruby](https://github.com/qltysh/example-ruby)             | [![Build](https://github.com/qltysh/example-ruby/actions/workflows/main.yml/badge.svg)](https://github.com/qltysh/example-ruby/actions/workflows/main.yml)             |
| [Rust](https://github.com/qltysh/example-rust)             | [![Build](https://github.com/qltysh/example-rust/actions/workflows/main.yml/badge.svg)](https://github.com/qltysh/example-rust/actions/workflows/main.yml)             |
| [TypeScript](https://github.com/qltysh/example-typescript) | [![Build](https://github.com/qltysh/example-typescript/actions/workflows/main.yml/badge.svg)](https://github.com/qltysh/example-typescript/actions/workflows/main.yml) |

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

This repository is provided under the [MIT License](https://github.com/qltysh/qlty-action/blob/main/LICENSE.md).

---
