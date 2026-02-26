#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MIN_MAJOR=3
MIN_MINOR=11

is_supported_python() {
  local py_bin="$1"
  "$py_bin" - <<'PY' >/dev/null 2>&1
import sys
sys.exit(0 if sys.version_info >= (3, 11) else 1)
PY
}

candidate_paths=(
  "$ROOT_DIR/.venv/bin/python"
  "$ROOT_DIR/venv/bin/python"
  "$ROOT_DIR/../.venv/bin/python"
  "/opt/homebrew/bin/python3"
)

for candidate in "${candidate_paths[@]}"; do
  if [[ -x "$candidate" ]] && is_supported_python "$candidate"; then
    echo "$candidate"
    exit 0
  fi
done

for cmd_name in python3 python; do
  if command -v "$cmd_name" >/dev/null 2>&1; then
    resolved="$(command -v "$cmd_name")"
    if is_supported_python "$resolved"; then
      echo "$resolved"
      exit 0
    fi
  fi
done

echo "No compatible python interpreter found (need >= ${MIN_MAJOR}.${MIN_MINOR})." >&2
echo "Current python3: $(command -v python3 2>/dev/null || echo 'not found')" >&2
if command -v python3 >/dev/null 2>&1; then
  echo "Current python3 version: $(python3 --version 2>/dev/null || echo 'unknown')" >&2
fi
echo "Suggestion: create a project venv with Python 3.11+ and install deps:" >&2
echo "  cd agents_backend" >&2
echo "  /opt/homebrew/bin/python3 -m venv .venv" >&2
echo "  . .venv/bin/activate && pip install -e ." >&2
exit 1
