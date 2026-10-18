# repository-name

AIコーディングエージェント（Codex / Antigravity CLI など）と人間の双方が扱いやすい開発ドキュメント構成を、任意の開発リポジトリへ素早く導入するための設定・スキル・テンプレート集です。

---

## 特徴

1. **人間とAIが目的に応じて読める入口（案内 + Summary）**
   - 管理対象の文書に YAML フロントマター（`id`, `type`, `status`, `summary`, `related` など）を付与します。
   - 人間とAIは目次の目的別案内と要約から必要な文書へ進み、機能一覧から現行仕様・設計理由・手順を探せます。
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

### 導入直後にドキュメントの入口と概要を整える場合

導入が完了したあと、続けて以下のように指示すると、入口と概要を整え、必要に応じて構成・用語の文書を生成します。新規プロジェクトでは目的や利用シナリオから始めます。

```text
docs-bootstrap スキルを使って、このリポジトリの入口と概要、および理解に必要なドキュメントの初版を作成してください。
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
│       └── docs-bootstrap/SKILL.md  # 新規・既存の初期ドキュメント整備スキル
├── docs/
│   ├── index.md                     # MOC（目次ハブ。docs_lint.mjs --index で自動更新可能）
│   ├── _config.json                # 既存文書を段階的に取り込むための対象外一覧
│   ├── _viewer-contract.md         # JSON・参照グラフとビューアーの連携仕様
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

## 文書の品質とビューアー連携

現行仕様はspec、変更案と検証結果はplan、判断の理由はADRに分けます。同期時には合意済みの変更・実装の不具合・意図不明の差分を区別します。文書は必要なものだけ段階的に作ります。

目次は現行文書・下書き・進行中の計画を分け、完了計画などは必要時に生成する `docs/_history.md` へ集約します。本文リンク・related・supersedesを区別した参照グラフをJSONで取得できます。詳細は [ビューアー連携契約](./presets/solo/payload/docs/_viewer-contract.md) を参照してください。

[認証機能の文書例](./examples/auth-docs/index.md) で、全体像・現行仕様・設計理由・予定変更の読み分けを確認できます。Lintは構造を検証するもので、本文の意味や実装の正しさは別に確認します。
