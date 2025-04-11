#!/bin/bash
set -euo pipefail

curl -fsSL https://qlty.sh | bash

qlty_bin_dir="$HOME/.qlty/bin"
qlty_path="$qlty_bin_dir/qlty"

echo "${qlty_bin_dir}" >>"${GITHUB_PATH}"

(${qlty_path} version >/dev/null 2>&1) || echo "::warning::${qlty_path} does not exist!"