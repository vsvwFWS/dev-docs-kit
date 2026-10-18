<!-- repository-name:solo:start v0.2.0 (このブロックは自動管理されます。直接編集せず repository-name 側で更新してください) -->
## 開発ドキュメント（`docs/`）

このリポジトリの開発ドキュメントは `docs/` 配下にあり、AIエージェントと人間の双方で作成・保守します。

### 読む順序（コンテキスト節約の原則）
1. 作業を始める前にまず [`docs/index.md`](docs/index.md) を読み、各文書の `summary` を確認して、今回のタスクに関係する文書だけを全文読み込むこと。
2. ドメイン用語や命名は `docs/glossary.md`（存在する場合）に従うこと。新しい概念を導入したら追記すること。

### いつどのスキルを使うか
- **新機能の着手・仕様策定・実装計画・ADR の作成** → スキル `docs-author` を使う
- **実装の一段落・PR 作成前・計画完了時のドキュメント同期と検証** → スキル `docs-sync` を使う
- **新規・既存リポジトリの入口・概要と必要な初期文書を整えるとき** → スキル `docs-bootstrap` を使う

### 守るべきルール
- specは現行の合意済み仕様、変更案と検証結果はplanに記録すること。仕様との差分は合意済み変更・実装の不具合・意図不明に分け、実装に合わせて無条件に仕様を書き換えないこと。
- 下書き・未確認事項は本文でも明示すること。acceptedのADRは実装完了を意味しない。
- 必要な文書だけ段階的に作り、indexの目的別案内とoverviewの機能一覧から現行仕様へ進めるようにすること。
- `docs/` 配下の通常ドキュメント（`_`・`.` 始まりと `_config.json` の対象外文書を除く）には必ず YAML フロントマター（`id`, `title`, `type`, `status`, `summary`, `created`, `updated`）を付与すること。詳細な規約は [`docs/_conventions.md`](docs/_conventions.md) を参照。
- `status: accepted` の ADR（`docs/adr/`）は原則書き換えない。判断を変更する場合は新しい ADR を作成し、`supersedes` に旧 ADR の `id` を指定すること。
- 文書間の本文リンクは相対パスの標準 Markdown リンク（`[ラベル](./path.md)`）で記述し、`[[wikilink]]` は使わないこと。
- 図は原則として Mermaid コードブロックで記述すること。
- ドキュメントの作成・更新後は `node .agents/skills/docs-sync/scripts/docs_lint.mjs --index` を実行し、`index.md` の同期とエラーゼロを確認すること。
<!-- repository-name:solo:end -->
