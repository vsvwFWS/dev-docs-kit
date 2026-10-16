# AGENTS.md (repository-name 保守ルール)

このリポジトリは、他の開発リポジトリへ開発ドキュメントの仕組みを導入するためのプリセット集（テンプレート・スキル・検証スクリプト）を管理しています。

## 基本方針

1. **配布物（`presets/*/payload/`）の自己完結性**
   - `payload/` 配下のファイルは他のリポジトリへそのままコピーされます。
   - `payload/` 内のファイルから、このリポジトリ固有のパス（`docs/design/` や `tests/` など）へ依存・リンクしないでください。
2. **`docs_lint.mjs` のゼロ依存ポリシー**
   - `presets/solo/payload/.agents/skills/docs-sync/scripts/docs_lint.mjs` は、導入先リポジトリで `npm install` なしに `node` 単体で実行できるよう、Node.js 標準組み込みモジュール（`node:fs`, `node:path`, `node:url` など）のみで実装してください。
   - 同時に、外部のビューアー／エディターから ES Module として `import` できるよう、主要な解析・検証関数（`parseDocument`, `loadDocsGraph`, `validateDocs`, `generateIndexContent`）の `export` を維持してください。
3. **バージョンの更新**
   - `presets/<preset>/payload/` または `INSTALL.md` を変更した場合は、`presets/<preset>/manifest.yaml` の `version` と `payload/AGENTS.block.md` 内のバージョン表記を合わせて更新してください。
4. **変更後の検証**
   - テンプレート、スキーマ、スキル、`docs_lint.mjs`、`manifest.yaml` のいずれかを変更した後は、必ず以下のテストを実行してすべてパスすることを確認してください。

```bash
bash tests/run.sh
```
