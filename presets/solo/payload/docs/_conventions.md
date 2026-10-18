# 開発ドキュメント規約

人間が全体像と現在の仕様を理解でき、AIが必要な情報を選んで保守できる構成を維持します。Markdownを正本とし、ビューアーは検索・分類・状態・関係の表示を補助します。

## 読む入口と正本

- `index.md` の冒頭は目的別の案内です。全体像、環境構築、機能仕様、設計理由の順路を、存在する文書への相対リンクで案内します。AIもここから関連文書だけを読みます。
- `overview.md` の機能一覧から各仕様へ進み、仕様から関連するADRやガイドへ進めるようにします。
- 自動生成範囲の外に案内を書きます。全文書を手動で列挙する必要はありません。
- 目次では現行文書、下書き、進行中の変更案を分けます。完了計画・置き換え済み・廃止文書は自動生成する `_history.md` から探せます。
- 同じ説明は一か所を正本とし、ほかはリンクします。作業ログを現行仕様の代わりにしません。

## 文書の役割と配置

| type | 配置 | 役割 | status |
|---|---|---|---|
| index | `docs/index.md` | 目的別の入口・自動一覧 | active |
| overview | `docs/overview.md` | 目的・利用者・機能・非対象 | draft, active, deprecated |
| architecture | `docs/architecture.md`、分割時 `docs/architecture/<slug>.md` | 現在の構成・責務・境界・処理の流れ | draft, active, deprecated |
| glossary | `docs/glossary.md` | ドメイン用語と識別子の対応 | draft, active, deprecated |
| spec | `docs/specs/<slug>.md` | 現在有効な合意済みの振る舞い・制約 | draft, active, deprecated |
| adr | `docs/adr/NNNN-<slug>.md` | 判断の背景・選択肢・理由・影響 | draft, accepted, superseded, deprecated |
| plan | `docs/plans/YYYY-MM-DD-<slug>.md`、完了後 `archive/` | 変更案・作業・進捗・検証結果 | draft, active, done |
| guide | `docs/guides/<slug>.md` | 現在使える環境構築・運用等の手順 | draft, active, deprecated |
| note | `docs/notes/<slug>.md` | 調査結果と根拠。確定仕様とは区別 | draft, active, deprecated |

`draft` は未確認・作成途中であり、確定事項として扱いません。`accepted` のADRは判断の採用を意味し、実装完了の証明ではありません。新機能や仕様変更の案はplanに置き、実装・検証後に現行specへ反映します。新規specのdraftは初版の整理・確認用で、将来の変更案の置き場ではありません。

外部から見える振る舞い、重要な制約・判断、繰り返し使う手順を優先して文書化します。軽微な修正ごとに一式を作らず、概要と入口から必要な文書だけ増やします。

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
- `type` / `status`：上表の値。詳細は [スキーマ](./_schema/frontmatter.schema.json) を参照。
- `summary`：何が書かれているかを具体的に表す1〜2文、200文字以内。読む対象の判断に使います。本文冒頭は内容を理解するための要点を説明します。
- `created` / `updated`：有効な `YYYY-MM-DD`。内容変更時にupdatedを更新します。編集日は、内容の正しさや検証済みであることの証明には使いません。
- `tags`（任意）：機能やテーマの分類。同じ機能では既存のタグを再利用します。typeをタグでも繰り返す必要はありません。
- `related`（任意）：本文の流れに含めにくい関連文書のID配列。本文リンクと二重登録する必要はありません。
- `supersedes`（ADR専用）：置き換える旧ADRのID。自身・ADR以外・循環を指定できません。採用時に旧ADRをsupersededへ変更します。下書きの提案だけで旧ADRを失効させません。

acceptedのADR本文は原則維持し、変更する判断は新しいADRに記録します。旧ADRのstatus・updatedの更新は可能です。

## 本文の品質

- 冒頭で対象・要点・適用範囲を短く説明します。抽象的な説明には具体例を添えます。
- specは利用例、正常時・例外時の振る舞い、継続して満たす受け入れ条件を記述します。検証の実行結果や完了チェックはplanに記録します。
- architectureは全体構成、責務・境界、主要な処理の流れを説明します。コードを読めば分かる詳細の転載は避けます。
- guideは前提、手順、成功の確認方法を揃えます。
- 不明な事項・推測は本文の「未確認事項」に明示し、HTMLコメントだけに隠しません。根拠となるコード・テスト・資料には相対リンク等を添えます。
- テンプレートの該当しない項目や例は削除します。空欄を埋めるために説明を創作しません。
- 1ファイル1テーマを目安にします。300行を超えたら分割を検討し、分割後も親文書に全体像の要約と詳細へのリンクを残します。

## リンク・図・表

本文リンクは `[説明](./path.md)` 形式の相対Markdownリンクとし、wikilinkは使いません。参照先・参照元はツールで計算するため、逆リンクを手書きしません。本文リンク、related、supersedesの意味は区別します。

図はMermaidを基本とし、記号を含むノードラベルはダブルクォートで囲みます。人間が細かく調整する図は `docs/assets/<name>.drawio.svg` に保存できます。長いセルは文章に戻し、50行を超える一覧はCSVやYAMLへの分離を検討します。

## 既存文書の段階的な取り込み

`_config.json` の `excludedFiles` に、まだ管理対象にしない既存Markdownをdocs相対パスで個別指定します。既定値は空配列です。

```json
{"excludedFiles": ["legacy/setup.md", "old-design.md"]}
```

ワイルドカード・ディレクトリ・docs外のパス・index.mdの指定はできません。除外文書はそのまま保持され、メタデータ検証・自動一覧・IDグラフから外れます。通常の本文リンクで参照でき、リンク先ファイルの存在は検証します。取り込む際はメタデータを整えてから対象外一覧から外します。

## 更新と確認

変更が合意済みか、実装の不具合か、意図が不明かを区別し、不具合や不明点に合わせて仕様を変更しません。文書更新後は以下を実行します。

```bash
node .agents/skills/docs-sync/scripts/docs_lint.mjs --index
```

このコマンドは目次を更新して構造を検証します。リンクの自動修復や内容の正しさの保証は行いません。AIは根拠・用語・重複・仕様との差分を確認し、人間は目的・判断・仕様が意図に合うか確認します。ビューアー連携は [データ契約](./_viewer-contract.md) を参照してください。
