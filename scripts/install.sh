#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
npm install

if [[ "${1:-}" == "--install-codex-skill" || "${INSTALL_CODEX_SKILL:-}" == "true" ]]; then
  CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
  SKILLS_DIR="$CODEX_HOME_DIR/skills"
  SOURCE_SKILL="$PROJECT_ROOT/skills/dify-workflow-generation"
  TARGET_SKILL="$SKILLS_DIR/dify-workflow-generation"

  if [ -d "$SOURCE_SKILL" ]; then
    mkdir -p "$SKILLS_DIR"
    rm -rf "$TARGET_SKILL"
    cp -R "$SOURCE_SKILL" "$TARGET_SKILL"
    echo "Installed Codex skill: $TARGET_SKILL"
  fi
else
  echo "Skipped Codex skill install. Use ./install.sh --install-codex-skill only for Codex setup."
fi

echo "Installed dependencies. Start with: ./scripts/start-mcp.sh"
