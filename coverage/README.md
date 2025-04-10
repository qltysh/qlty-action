# Coverage qlty-action

A GitHub Action for running code coverage analysis using the qlty tool.

## Configuration

### Coverage Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `coverage-token` | Authentication token for coverage submission | Yes | - |
| `files` | Files to process (supports glob patterns and comma-separated paths) | Yes | - |
| `verbose` | Display debug logs along with coverage data | No | `false` |
| `add-prefix` | Prefix to add to file paths | No | - |
| `strip-prefix` | Prefix to remove from file paths | No | - |
| `skip-errors` | Continue execution even if errors occur | No | `true` |
| `skip-missing-files` | Files not in the directory are skipped | No | `false` |
| `tag` | Tag to associate with the coverage data | No | - |

### Coverage Analysis

```yaml
- name: Run Coverage Analysis
  uses: qltysh/qlty-action/coverage@main
  with:
    coverage-token: ${{ secrets.COVERAGE_TOKEN }}
    files: path/to/coverage/lcov.info

# Multiple files with glob pattern
- name: Run Coverage with Multiple Files
  uses: qltysh/qlty-action/coverage@main
  with:
    coverage-token: ${{ secrets.COVERAGE_TOKEN }}
    files: path/to/coverage/*.json,other/path/to/coverage/*.json
```
