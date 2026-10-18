# メタデータとリンク

新規作成、メタデータ・リンクの編集、該当する検証エラーの解消時に参照します。

## フロントマター

通常のMarkdownには次の必須項目を記載します。`_`・`.` 始まりのファイル／ディレクトリと、明示的に対象外にした文書は管理対象外です。

```yaml
---
id: spec-user-auth
title: ログインの仕様
type: spec
status: active
summary: メールとパスワードによるログイン、失敗時の応答、セッションの有効期限を定義する。
tags: [auth]
related: []
created: 2026-10-19
updated: 2026-10-19
---
```

- `id`：一意の英小文字・数字・ハイフン。移動や改名でも維持します。基本文書は `index` / `overview` / `architecture` / `glossary`、その他は `spec-<slug>`、`adr-NNNN`、`plan-<slug>` 等を使います。
- `title`：本文の見出しと揃えます。
- `type` / `status`：[文書種別ガイド](./document-types.md) の対象種別の値。
- `summary`：何が書かれているかを具体的に表す1〜2文、200文字以内。読む対象の判断に使います。本文冒頭は内容を理解するための要点を説明します。
- `created` / `updated`：有効な `YYYY-MM-DD`。
- `tags`（任意）：機能やテーマの分類。同じ機能では既存のタグを再利用します。typeをタグでも繰り返す必要はありません。
- `related`（任意）：本文の流れに含めにくい関連文書のID配列。本文リンクと二重登録する必要はありません。
- `supersedes`（ADR専用）：置き換える旧ADRのID。自身・ADR以外・循環を指定できません。置き換え手順は [ADR節](./document-types.md#adr) を参照します。

## 本文リンクと関連ID

本文リンクは `[説明](./path.md)` 形式の相対Markdownリンクとし、wikilinkは使いません。参照先・参照元はツールで計算するため、逆リンクを手書きしません。本文リンク、related、supersedesの意味は区別します。
