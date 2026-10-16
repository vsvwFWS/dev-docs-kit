# 開発ドキュメント規約 (`_conventions.md`)

このファイルは、`docs/` 配下の開発ドキュメントを AI エージェントと人間の双方が迷わず作成・保守するためのルールを定義します。
（先頭が `_` で始まるファイル・ディレクトリはメタ管理用のため、フロントマター検証の対象外です）

---

## 1. ドキュメント種別（`type`）と配置場所

アンダースコア（`_`）で始まらないすべての Markdown ファイルは、以下のいずれかの `type` を持ちます。

| `type` | 配置パス | ID の命名規則 | 役割 | 使える `status` |
|---|---|---|---|---|
| `index` | `docs/index.md` | `index` | 全文書の目次ハブ（MOC） | `active` |
| `overview` | `docs/overview.md` | `overview` | プロジェクトの目的・スコープ・非ゴール・主要機能 | `draft`, `active`, `deprecated` |
| `architecture` | `docs/architecture.md`（肥大化時は `docs/architecture/<slug>.md`） | `architecture`（または `arch-<slug>`） | システム全体構成、モジュール境界、データフロー、技術スタック | `draft`, `active`, `deprecated` |
| `glossary` | `docs/glossary.md` | `glossary` | ドメイン用語とコード上の識別子の対応表 | `draft`, `active`, `deprecated` |
| `spec` | `docs/specs/<slug>.md` | `spec-<slug>` | 機能仕様（要件、受け入れ条件、インターフェース） | `draft`, `active`, `deprecated` |
| `adr` | `docs/adr/NNNN-<slug>.md`（4桁連番、例: `0001-use-jwt.md`） | `adr-NNNN`（例: `adr-0001`） | 設計判断の記録（なぜその選択肢を採ったか） | `draft`, `accepted`, `superseded`, `deprecated` |
| `plan` | `docs/plans/YYYY-MM-DD-<slug>.md`（完了後は `docs/plans/archive/` へ移動） | `plan-<slug>` | 実装計画と作業ログ | `draft`, `active`, `done` |
| `guide` | `docs/guides/<slug>.md` | `guide-<slug>` | 環境構築、デプロイ、運用手順などの How-to | `draft`, `active`, `deprecated` |
| `note` | `docs/notes/<slug>.md` | `note-<slug>` | 調査メモ、ベンチマーク結果、ハマりどころの知見 | `draft`, `active`, `deprecated` |

---

## 2. YAML フロントマター仕様

すべてのドキュメントの先頭に以下の YAML フロントマターを記載します。
機械処理用のキーと列挙値（`type`, `status`）は**英語**とし、`title`, `summary`, `tags` は**日本語・英語どちらでも記述可能**です。

```yaml
---
id: spec-user-auth
title: ユーザー認証機能の仕様
type: spec
status: active
summary: >-
  メールアドレスとパスワードによるログイン、および JWT トークン発行・更新の仕様と受け入れ条件を定義する。
tags: [auth, 認証, security]
related: [architecture, adr-0001]
created: 2026-10-17
updated: 2026-10-17
---
```

### 各フィールドのルール
- **`id`**（必須）: リポジトリ内で一意の識別子。英小文字・数字・ハイフンのみ（`^[a-z0-9]+(-[a-z0-9]+)*$`）。ファイルを移動・リネームしても `id` は変えないでください。
- **`title`**（必須）: 文書のタイトル。本文の `# 見出し` と揃えます。
- **`type`**（必須）: 上記9種類のいずれか。
- **`status`**（必須）: `type` ごとに許可された状態値（詳細は `_schema/frontmatter.schema.json` 参照）。
- **`summary`**（必須）: **1〜2文（200文字以内）の要約**。AIエージェントが `index.md` を見て全文を読むべきか判断するための最重要フィールドです。「何が書いてあるか」を具体的に書いてください。
- **`tags`**（任意）: 検索・分類用のタグ配列（日本語・英語可）。
- **`related`**（任意）: 関連する他ドキュメントの `id` の配列（例: `[spec-login, adr-0001]`）。片方向に書いておけば、逆リンク（Backlinks）はツール側で自動計算されます。
- **`supersedes`**（任意・`adr` 専用）: 過去の ADR を置き換える場合、旧 ADR の `id`（例: `adr-0001`）を指定します。同時に旧 ADR 側の `status` を `superseded` に更新してください。
- **`created` / `updated`**（必須）: `YYYY-MM-DD` 形式の日付。内容を変更したら `updated` を当日に更新します。

---

## 3. 執筆・分割・リンクの原則

1. **1ファイル1テーマ（Atomic Notes）**
   - 1つの文書には1つの機能または1つの判断だけを書きます。
   - `architecture.md` や `spec` が **300行** を超えたら、サブセクションを別ファイルに切り出し、`related` と相対リンクで繋いでください。
2. **標準 Markdown 相対リンクの使用**
   - 本文中で他のドキュメントを参照するときは、VSCode や GitHub でそのまま開けるよう相対パスの Markdown リンク（例: `[ADR-0001](../adr/0001-use-jwt.md)`）を使用します。`[[wikilink]]` は使用しません。
3. **人間が直接編集する場合**
   - 人間が手直しする際は、本文の編集と `updated` 日付の更新だけで構いません。リンク整合性や `index.md` の更新は、後からエージェントに「`docs-sync` を実行して」と頼むか、`node .agents/skills/docs-sync/scripts/docs_lint.mjs --index` を実行すれば自動で揃います。

---

## 4. 図表の記述ルール

1. **ダイアグラムは Mermaid を第一選択とする**
   - フローチャート、シーケンス図、状態遷移図、ER 図は Markdown 内の ` ```mermaid ` コードブロックで記述します。
   - **構文エラー防止**: ノードのラベルに括弧 `()` や記号を含む場合は、必ずダブルクォートで囲んでください（例: `A["認証サーバー (JWT)"]`）。
2. **人間がレイアウトを微調整したい複雑な図は `.drawio.svg`**
   - `docs/assets/<name>.drawio.svg` として保存し、Markdown からは `![説明](./assets/<name>.drawio.svg)` で参照します。
3. **巨大な表は外部ファイル化する**
   - 50行を超えるような設定一覧やデータ定義表は、YAML または CSV ファイルとして分離し、Markdown からリンクしてください。
