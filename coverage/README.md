# qlty-action/coverage

## Upload code coverage to Qlty from GitHub Actions in five minutes

This is a reusable GitHub Action to upload code coverage data to Qlty Cloud.  
Qlty Cloud provides code coverage analytics with commit status gates and trends.

## Usage

To upload code coverage to Qlty Cloud, follow these steps:

1. Obtain a code coverage upload token.

2. Generate code coverage data from your automated test builds in a supported format.

3. Add this `qlty-action/coverage` step to your GitHub Actions test workflow. Here is a simple example:

```yaml
# ...
- uses: qltysh/qlty-action/qlty-coverage@v1
  with:
    coverage-token: ${{ secrets.QLTY_COVERAGE_TOKEN }}
    files: ./coverage1.xml,./coverage2.xml
    flags: unit # Optional
    verbose: true # Optional, default is false
    skip-errors: false # Optional, default is true
```

4. Optionally enable commit statuses to pass or fail based on code coverage standards

## Inputs

| Parameter        | Description                                                  | Required | Default |
| ---------------- | ------------------------------------------------------------ | -------- | ------- |
| `coverage-token` | A Workspace or Project coverage upload token from Qlty Cloud | Yes      |         |
| `...`            | ...                                                          | Y/N      |         |

## Full Example

This is a full example GitHub Action workflow of a NodeJS project generate code coverage data and uploading it to Qlty Cloud:

```yaml
# Full workflow example
```

## Resources

- [Get Started](https://qlty.sh/) with Qlty Cloud
- [Documentation](https://docs.qlty.sh/what-is-qlty)
- [Join us on Discord](https://discord.gg/HeqCgap6)
