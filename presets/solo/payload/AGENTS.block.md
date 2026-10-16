<!-- repository-name:solo:start v0.1.1 (このブロックは自動管理されます。直接編集せず repository-name 側で更新してください) -->
## 開発ドキュメント（`docs/`）

このリポジトリの開発ドキュメントは `docs/` 配下にあり、AIエージェントと人間の双方で作成・保守します。

### 読む順序（コンテキスト節約の原則）
1. 作業を始める前にまず [`docs/index.md`](docs/index.md) を読み、各文書の `summary` を確認して、今回のタスクに関係する文書だけを全文読み込むこと。
2. ドメイン用語や命名は `docs/glossary.md`（存在する場合）に従うこと。新しい概念を導入したら追記すること。

### いつどのスキルを使うか
- **新機能の着手・仕様策定・実装計画・ADR の作成** → スキル `docs-author` を使う
- **実装の一段落・PR 作成前・計画完了時のドキュメント同期と検証** → スキル `docs-sync` を使う
- **既存コードから初期ドキュメント（overview / architecture / glossary）を生成するとき** → スキル `docs-bootstrap` を使う

### 守るべきルール
- `docs/` 配下の通常ドキュメント（`_` 始まりを除く）には必ず YAML フロントマター（`id`, `title`, `type`, `status`, `summary`, `created`, `updated`）を付与すること。詳細な規約は [`docs/_conventions.md`](docs/_conventions.md) を参照。
- `status: accepted` の ADR（`docs/adr/`）は原則書き換えない。判断を変更する場合は新しい ADR を作成し、`supersedes` に旧 ADR の `id` を指定すること。
- 文書間の本文リンクは相対パスの標準 Markdown リンク（`[ラベル](./path.md)`）で記述し、`[[wikilink]]` は使わないこと。
- 図は原則として Mermaid コードブロックで記述すること。
- ドキュメントの作成・更新後は `node .agents/skills/docs-sync/scripts/docs_lint.mjs --index` を実行し、`index.md` の同期とエラーゼロを確認すること。
<!-- repository-name:solo:end -->
