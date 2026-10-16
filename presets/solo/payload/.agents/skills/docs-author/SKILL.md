---
name: docs-author
description: >-
  docs/ 配下に開発ドキュメント（spec, adr, plan, note, guide, overview, architecture, glossary）を
  新規作成するときに使う。新機能の仕様策定、設計判断の記録（ADR）、実装計画（plan）の作成、
  調査メモや手順書の保存を求められたとき、またはそれらが必要だと判断したときに使用する。
---

# `docs-author` スキル（新規ドキュメント作成）

このスキルは、`docs/_conventions.md` の規約に従って新しい開発ドキュメントを作成し、目次ハブ（`docs/index.md`）へ登録します。

## 手順

### 1. 既存ドキュメントと規約の確認
1. `docs/index.md` を読み、既に同じテーマの文書が存在しないか、関連付けるべき文書（`related` の候補）がどれかを確認します。
2. 必要に応じて `docs/_conventions.md` と `docs/glossary.md` を確認し、用語を統一します。

### 2. 種別（`type`）・ファイルパス・ID の決定

作成する文書の目的に応じて、以下のテンプレートと配置先を選びます。

| `type` | コピー元テンプレート | 配置先パス | `id` の形式 | 初期 `status` |
|---|---|---|---|---|
| `spec` | `docs/_templates/spec.md` | `docs/specs/<slug>.md` | `spec-<slug>` | `draft` または `active` |
| `adr` | `docs/_templates/adr.md` | `docs/adr/NNNN-<slug>.md` | `adr-NNNN` | `draft` または `accepted` |
| `plan` | `docs/_templates/plan.md` | `docs/plans/YYYY-MM-DD-<slug>.md` | `plan-<slug>` | `active` |
| `note` | `docs/_templates/note.md` | `docs/notes/<slug>.md` | `note-<slug>` | `active` |
| `guide` | `docs/_templates/guide.md` | `docs/guides/<slug>.md` | `guide-<slug>` | `active` |
| `overview` | `docs/_templates/overview.md` | `docs/overview.md` | `overview` | `active` |
| `architecture` | `docs/_templates/architecture.md` | `docs/architecture.md` | `architecture` | `active` |
| `glossary` | `docs/_templates/glossary.md` | `docs/glossary.md` | `glossary` | `active` |

- **ADR の連番採番**: `docs/adr/` 内の既存ファイルを確認し、最大の番号 + 1（初回は `0001`）を4桁ゼロ埋めで採番します。
- **過去の ADR を置き換える場合**: 新しい ADR のフロントマターに `supersedes: adr-XXXX` を設定し、置き換えられた旧 ADR 側の `status` を `superseded` に変更します。

### 3. フロントマターと本文の記述
1. 対応するテンプレートをベースにファイルを作成します。
2. フロントマターの以下を確実に埋めます：
   - `id`, `title`, `type`, `status`
   - `summary`: **200文字以内で「何が書かれているか」を具体的に要約**（テンプレートの汎用文のまま残さないこと）
   - `related`: 関連する他ドキュメントの `id` 配列（実在する `id` のみ指定）
   - `created`, `updated`: 当日の日付（`YYYY-MM-DD`）
3. 本文を日本語で具体的に記述します。図を入れる場合は Mermaid コードブロックを使用し、他ドキュメントへの参照は相対パスの Markdown リンクで記述します。

### 4. 目次（`docs/index.md`）の更新と Lint 検証
ファイルを作成したら、以下のコマンドを実行して `docs/index.md` を自動更新し、フロントマターやリンクにエラーがないことを検証します。

```bash
node .agents/skills/docs-sync/scripts/docs_lint.mjs --index
```

エラーが表示された場合は、エラーが 0 件になるまで修正してください。
