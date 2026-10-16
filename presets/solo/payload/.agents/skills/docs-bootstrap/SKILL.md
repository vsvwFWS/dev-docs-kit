---
name: docs-bootstrap
description: >-
  開発ドキュメントが未整備の既存リポジトリで、コードベースを調査して overview, architecture,
  glossary の初版を生成するときに使う。repository-name 導入直後や「既存のコードから設計書を作って」
  と頼まれたときに使用する。
---

# `docs-bootstrap` スキル（既存コードからの初期ドキュメント生成）

このスキルは、既存のコードベースを調査・分析し、プロジェクトの基本ドキュメント3種（`docs/overview.md`, `docs/architecture.md`, `docs/glossary.md`）の初版を作成します。

## 手順

### 1. コードベースの調査
以下のファイル・構造を順番に確認し、システムの全体像を把握します。
1. **ルート設定・説明**: `README.md`, `AGENTS.md`, パッケージ定義（`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml` など）
2. **ディレクトリ構造**: トップレベルおよび `src/` や `app/` 配下のモジュール分割
3. **エントリーポイントと主要モデル**: メインの起動ファイル、ルーティング定義、データベーススキーマや中核となる型定義

### 2. 基本ドキュメント3種の生成
`docs/_templates/` 内のテンプレートを元に、以下の3ファイルを作成します（既に存在する場合は、勝手に上書きせず内容を統合するかユーザーに確認してください）。

1. **`docs/overview.md`** (`id: overview`, `type: overview`)
   - プロジェクトの目的、主要機能、動作環境を記述します。
   - コードからは判断できないビジネス背景や「やらないこと（Non-Goals）」など、推測を含む箇所には `<!-- TODO(human): 推測を含むため要確認 -->` コメントを添えてください。
2. **`docs/architecture.md`** (`id: architecture`, `type: architecture`)
   - 採用されている技術スタック、モジュール・ディレクトリの責務一覧、および主要な処理の流れを Mermaid 図付きで記述します。
3. **`docs/glossary.md`** (`id: glossary`, `type: glossary`)
   - コード内で使われている主要なドメイン用語・型名・概念を抽出し、日本語表記と英語識別子の対応表を作成します。

> **ステータスの設定**: 初版生成時は `status: draft`（または確実な場合は `active`）とし、`created` / `updated` に当日の日付を設定します。

### 3. 目次（`docs/index.md`）の更新と検証
3ファイルの作成後、以下のスクリプトを実行して `docs/index.md` に反映し、フロントマターとリンクに不備がないことを確認します。

```bash
node .agents/skills/docs-sync/scripts/docs_lint.mjs --index
```

### 4. ユーザーへの報告
生成した3ファイルの概要と、`<!-- TODO(human): ... -->` を付けた要確認箇所をリストアップしてユーザーに報告してください。
