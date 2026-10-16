# repository-name

AIコーディングエージェント（Codex / Antigravity CLI など）と人間の双方が扱いやすい開発ドキュメント構成を、任意の開発リポジトリへ素早く導入するための設定・スキル・テンプレート集です。

---

## 特徴

1. **AIのコンテキストを節約する階層設計（MOC + Summary）**
   - すべての文書に YAML フロントマター（`id`, `type`, `status`, `summary`, `related` など）を付与します。
   - エージェントは最初に目次ハブ（`docs/index.md`）の `summary` だけを読み、作業に関係する文書だけを全文読み込みます。
2. **Codex / Antigravity CLI 両対応の構成**
   - 常駐ルールは `AGENTS.md`、作業手順は `.agents/skills/<skill>/SKILL.md` に分離し、両エージェントが標準で認識できるディレクトリ構造を採用しています。
3. **外部パッケージ依存ゼロの Node.js 検証・同期スクリプト（`docs_lint.mjs`）**
   - `npm install` 不要で動作する単一ファイル（ESM）のリンター／インデックス生成器を同梱しています。
   - 将来ドキュメントビューアーやエディターを開発する際、パーサーやグラフ構築（逆リンク計算など）のモジュールとしてそのまま `import` できます。

---

## プリセット一覧

| プリセット | 対象規模 | 概要 |
|---|---|---|
| [`solo`](./presets/solo/) | 個人開発・小規模プロジェクト | 最小限の文書タイプ（overview, architecture, glossary, spec, adr, plan, note, guide）と3つのエージェントスキル（作成・同期・初期生成）を導入します。 |

---

## 導入方法（対象リポジトリのエージェントへの指示）

導入したい開発リポジトリで Codex または Antigravity CLI を起動し、以下のプロンプトを入力してください。新規導入・アップデートどちらも同じプロンプトで実行できます。

### GitHub から導入する場合

```text
https://github.com/OWNER/repository-name の presets/solo/INSTALL.md を読んで、このリポジトリに開発ドキュメントの仕組みを導入してください。
```

### ローカルパスから導入する場合

```text
/path/to/repository-name/presets/solo/INSTALL.md に従って、このリポジトリに開発ドキュメントの仕組みを導入してください。
```

### 導入直後に既存コードからドキュメント初版を作る場合

導入が完了したあと、続けて以下のように指示すると、コードベースを調査して `overview.md`, `architecture.md`, `glossary.md` の初版を生成します。

```text
docs-bootstrap スキルを使って、このリポジトリの基本ドキュメント（overview, architecture, glossary）の初版を作成してください。
```

---

## 導入される構成（`solo` プリセット）

対象リポジトリには以下のファイルが配置・統合されます。導入後は対象リポジトリ単体で完結し、普段の作業でこの `repository-name` リポジトリを参照し続ける必要はありません。

```text
<対象リポジトリ>/
├── AGENTS.md                        # 常駐ルール（マーカー付きブロックとして追記・更新）
├── .agents/
│   ├── repository-name.lock.json   # 導入プリセット・バージョンの記録
│   └── skills/
│       ├── docs-author/SKILL.md     # 新規ドキュメント作成スキル
│       ├── docs-sync/               # 実装後のドキュメント同期・検証スキル
│       │   ├── SKILL.md
│       │   └── scripts/docs_lint.mjs
│       └── docs-bootstrap/SKILL.md  # 既存コードからの初期ドキュメント生成スキル
├── docs/
│   ├── index.md                     # MOC（目次ハブ。docs_lint.mjs --index で自動更新可能）
│   ├── _conventions.md              # ドキュメント規約（人間・エージェント共通の正本）
│   ├── _schema/
│   │   └── frontmatter.schema.json  # フロントマターの JSON Schema
│   └── _templates/                  # 文書タイプ別の日本語テンプレート（8種）
└── .vscode/                         # 推奨拡張機能・設定（任意）
```

---

## このリポジトリ自身のディレクトリ構成

```text
repository-name/
├── README.md                        # このファイル
├── AGENTS.md                        # このリポジトリを保守するエージェント向けのルール
├── docs/
│   └── design/                      # 設計思想・背景ドキュメント
│       ├── principles.md            # PKM / Wiki 由来の情報整理原則
│       ├── diagrams.md              # 図表フォーマット選定方針
│       └── agent-mechanisms.md      # AGENTS.md / Skills / Script の役割分担
├── presets/
│   └── solo/
│       ├── INSTALL.md               # エージェントが実行する導入手順書
│       ├── manifest.yaml            # 配布ファイルと上書きポリシー定義
│       └── payload/                 # 対象リポジトリへ配置される実体一式
└── tests/
    ├── run.sh                       # テスト実行スクリプト
    └── fixtures/                    # 検証用の正常系・異常系ドキュメント
```

## テストの実行

```bash
bash tests/run.sh
```
