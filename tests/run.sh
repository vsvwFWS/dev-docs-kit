#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINTER="$REPO_ROOT/presets/solo/payload/.agents/skills/docs-sync/scripts/docs_lint.mjs"

# Node.js バイナリの検出
find_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  for candidate in \
    "$HOME/.local/share/fnm"/*/bin/node \
    "$HOME/.fnm"/*/bin/node \
    "$HOME/.nvm/versions/node"/*/bin/node \
    "$HOME/.volta/bin/node" \
    "$HOME/.asdf/shims/node" \
    "$HOME/.cache/ms-playwright-go"/*/node; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

NODE_BIN="$(find_node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "[ERROR] Node.js binary not found." >&2
  exit 1
fi

echo "Using Node.js: $NODE_BIN ($("$NODE_BIN" --version))"

# 1. Payload 初期状態の検証（docs/index.md 単体でエラーゼロであること）
echo "==> [Test 1/4] Validating initial payload docs..."
"$NODE_BIN" "$LINTER" --docs-dir "$REPO_ROOT/presets/solo/payload/docs"

# 2. Node.js による総合テストスイート（正常系・異常系・モジュール import・manifest 検証）
echo "==> [Test 2/4] Running comprehensive Node.js test suite..."
"$NODE_BIN" "$REPO_ROOT/tests/test_suite.mjs"

# 3. テンプレート検証（一時ディレクトリに全テンプレートを展開して検証）
echo "==> [Test 3/4] Validating all templates..."
TMP_TPL_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_TPL_DIR"' EXIT

cp -r "$REPO_ROOT/presets/solo/payload/docs" "$TMP_TPL_DIR/docs"
mkdir -p "$TMP_TPL_DIR/docs/specs" "$TMP_TPL_DIR/docs/adr" "$TMP_TPL_DIR/docs/plans" "$TMP_TPL_DIR/docs/notes" "$TMP_TPL_DIR/docs/guides"

cp "$TMP_TPL_DIR/docs/_templates/overview.md" "$TMP_TPL_DIR/docs/overview.md"
cp "$TMP_TPL_DIR/docs/_templates/architecture.md" "$TMP_TPL_DIR/docs/architecture.md"
cp "$TMP_TPL_DIR/docs/_templates/glossary.md" "$TMP_TPL_DIR/docs/glossary.md"
cp "$TMP_TPL_DIR/docs/_templates/spec.md" "$TMP_TPL_DIR/docs/specs/feature-name.md"
cp "$TMP_TPL_DIR/docs/_templates/adr.md" "$TMP_TPL_DIR/docs/adr/0001-sample.md"
cp "$TMP_TPL_DIR/docs/_templates/plan.md" "$TMP_TPL_DIR/docs/plans/2026-10-17-task-slug.md"
cp "$TMP_TPL_DIR/docs/_templates/note.md" "$TMP_TPL_DIR/docs/notes/topic-slug.md"
cp "$TMP_TPL_DIR/docs/_templates/guide.md" "$TMP_TPL_DIR/docs/guides/topic-slug.md"

"$NODE_BIN" "$LINTER" --docs-dir "$TMP_TPL_DIR/docs" --index

# 4. 導入（INSTALL）シミュレーションと冪等性テスト
echo "==> [Test 4/4] Simulating installation and idempotency in a dummy repo..."
"$NODE_BIN" "$REPO_ROOT/tests/test_install_sim.mjs"

echo ""
echo "All tests passed successfully!"
