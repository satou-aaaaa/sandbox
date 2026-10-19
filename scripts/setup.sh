#!/usr/bin/env bash
# 開発の準備を1コマンドで行う。人も、どの AI も同じ手順で動かせるようにするためのもの。何度実行してもよい。
#   使い方: bash scripts/setup.sh   （Windows は Git Bash で）
# docs/DEVELOPMENT_GUIDE.md 1.2 の「npm install」と「git config core.hooksPath hooks」をまとめたもの。
# Claude Code のクラウドセッションでは .claude/settings.json の SessionStart フックが自動で呼ぶ。
# CI の Setup check（共通部品 satou-aaaaa/shared-workflows）が、まっさらな環境でこれが通るかを確かめる。
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "✗ $*" >&2; exit 1; }
# 環境変数をクラウドセッションの以後のコマンドに渡す（ほかの環境では何もしない）
session_env() { if [ -n "${CLAUDE_ENV_FILE:-}" ]; then echo "export $1" >> "$CLAUDE_ENV_FILE"; fi; }

# Node.js v24.15.0 以上（package.json の engines。.nvmrc は 24）
node_ok() { command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>24||(a===24&&b>=15)?0:1)'; }
if ! node_ok; then
  # 版が足りず nvm があれば、.nvmrc の版を入れる（Claude Code のクラウドは /opt/nvm にある）
  NVM_DIR=${NVM_DIR:-$HOME/.nvm}; [ -s "$NVM_DIR/nvm.sh" ] || NVM_DIR=/opt/nvm
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    set +u; export NVM_DIR; . "$NVM_DIR/nvm.sh"; nvm install "$(cat .nvmrc)" >/dev/null; set -u
    session_env "PATH=\"$(dirname "$(command -v node)"):\$PATH\""
  fi
fi
node_ok || fail "Node.js v24.15.0 以上が要る（今は $(node -v 2>/dev/null || echo なし)。nvm なら nvm install）"

# 依存（agent/ は開発運用ツールで、使うときだけ cd agent && npm ci）。node_modules が lock より新しければ飛ばす
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund
fi

# 秘密の混入を止める pre-commit フック（hooks/）
git config core.hooksPath hooks

# E2E（Playwright）のブラウザ。PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 の環境（Claude Code のクラウドなど）は入っているものを使う
if [ "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" = 1 ]; then
  if [ -x /opt/pw-browsers/chromium ]; then session_env "CHROMIUM_PATH=/opt/pw-browsers/chromium"; fi
else
  npx playwright install chromium
fi

echo "✓ 準備できた。次は: npm test"
