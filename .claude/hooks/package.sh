#!/bin/bash

# PostToolUse hook: runs `npm run package` for the affected workspace
# when source files are edited, keeping dist/ bundles up to date.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.command // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Resolve to a path relative to the repo root
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
REL_PATH="${FILE_PATH#"$REPO_ROOT"/}"

# Map file paths to workspaces that need repackaging
workspaces_to_package=""

case "$REL_PATH" in
  coverage/src/*|coverage/package.json|coverage/tsconfig.json)
    workspaces_to_package="coverage"
    ;;
  fmt/src/*|fmt/package.json|fmt/tsconfig.json)
    workspaces_to_package="fmt"
    ;;
  install/src/*|install/package.json|install/tsconfig.json)
    workspaces_to_package="install"
    ;;
  packages/shared/*)
    workspaces_to_package="coverage fmt install"
    ;;
esac

if [ -z "$workspaces_to_package" ]; then
  exit 0
fi

for ws in $workspaces_to_package; do
  echo "Packaging ${ws}..." >&2
  (cd "$REPO_ROOT/$ws" && npm run package --silent 2>&1) >&2 || {
    echo "ERROR: npm run package failed for ${ws}" >&2
    exit 2
  }
done

exit 0
