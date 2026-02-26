#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY_BIN="$($ROOT_DIR/scripts/_python.sh)"

cd "$ROOT_DIR"
export PYTHONNOUSERSITE=1

if ! "$PY_BIN" -c "import uvicorn" >/dev/null 2>&1; then
  echo "Missing dependency: uvicorn (python: $PY_BIN)" >&2
  echo "Install project deps in a Python 3.11+ venv:" >&2
  echo "  cd agents_backend" >&2
  echo "  /opt/homebrew/bin/python3 -m venv .venv" >&2
  echo "  . .venv/bin/activate" >&2
  echo "  pip install -e ." >&2
  exit 1
fi

exec "$PY_BIN" -m uvicorn agents.infrastructure.api:app --host 0.0.0.0 --port 8000 --app-dir src
