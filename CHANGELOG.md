# Changelog

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
