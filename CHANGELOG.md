# Changelog

## v2.2.0 (2025-08-11)

- Testing release process (no changes)

## v2.1.0 (2025-08-08)

### New

- support "dry-run" option for command `complete`

### Improved

- Use log level "error" instead of "warning" when a catastrophic error occurs but "skip-errors" is true

### Fixed

- Ignore "validate" option when command is "complete" (otherwise errors with invalid option)

## v2.0.0 (2025-08-05)

This release mirrors the breaking change we introduced in the qlty CLI proper: we now validate coverage data by default instead of uploading coverage data to qlty that qlty cannot use. Now you must opt out of this behavior whereas previously opt in.

What This Means for You:

- If coverage reporting is working as expected, you'll experience no impact. If you're uploading valid reports and seeing directory and file-level coverage metrics in Qlty, you don't need to do anything. (If your reports include mismatched paths, you'll see specific path errors listed within your CI output)
- Potential CI Build Failures: Once this change is implemented, if your current CI/CD pipeline uploads a report with mismatched paths, your builds will begin to fail when executing qlty coverage publish.
- Quick Fix for Build Failures: If your builds start failing and you need to get them passing immediately, you can temporarily add validate: false to the GitHub Action configuration. This will disable validation and allow your CI build to pass (though your coverage data will remain broken until you've uploaded a valid report).

We believe this change will significantly improve the accuracy and usability of your coverage data within Qlty. If you have any questions or require assistance, please don't hesitate to contact our support team.

## v1.2.0 (2025-08-04)

### Fixed

- Ensure correct commit sha provided from PRs for 'complete' action (#125)
- More robust error output in face of unknown errors (#121)
- Set output directory to RUNNER_TEMP (#110)

Thank you, @enell for your contribution!

## v1.1.1 (2025-06-25)

### Improved

- Make files arg optional for complete (#112)

## v1.1.0 (2025-05-15)

### New

- Add `cli-version` input to coverage action (#67)
- Add `format` input to coverage action (#85)
- Add `dry-run` input to coverage action (#88)
- Add `incomplete` input to coverage action (#89)
- Add `name` input to coverage action (#90)
- Add `validate` and `validate-file-threshold` inputs to coverage action (#95)
- Add `command` input to coverage action (#96)

### Improved

- Add support for Windows to coverage action (#87)
- Set `QLTY_CI_UPLOADER_TOOL` and `QLTY_CI_UPLOADER_VERSION` when running CLI (#86)
- Allow dry-run without authentication (#91)

## v1.0.0 (2025-04-17)

### New

- Release v1.0.0. Future releases will follow [Semantic Versioning](https://semver.org/)
