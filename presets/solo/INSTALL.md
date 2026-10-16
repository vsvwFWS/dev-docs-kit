# `solo` プリセット導入・更新手順書（エージェント実行用）

このドキュメントは、AIコーディングエージェント（Codex / Antigravity CLI 等）が対象リポジトリへ `repository-name` の `solo` プリセットを導入またはアップデートするための実行手順書です。

ユーザーから「この `INSTALL.md` に従って導入して」と指示された場合、以下のステップを順番に実行してください。

---

## ステップ 1: 取得元（`SOURCE_DIR`）の準備

まず、`presets/solo/` のファイル一式をローカルで読み取れる状態にします。

1. **ローカルパスが指定された場合**
   - 指定されたディレクトリ内の `presets/solo` を `SOURCE_DIR` とします。
2. **GitHub URL が指定された場合**
   - 一時ディレクトリを作成し、リポジトリを shallow clone します。
     ```bash
     TEMP_DIR=$(mktemp -d)
     git clone --depth 1 <指定されたGitHubリポジトリURL> "$TEMP_DIR"
     ```
   - サンドボックス制限でネットワークアクセスがブロックされた場合は、ユーザーにコマンド実行の承認（ネットワーク許可）を求めるか、Web 取得ツールで `presets/solo/manifest.yaml` に記載された各ファイルを `raw.githubusercontent.com` から取得してください。
   - `$TEMP_DIR/presets/solo` を `SOURCE_DIR` とします。

---

## ステップ 2: 対象リポジトリの事前調査

対象リポジトリ（カレントワークスペース）の現在の状態を調査します。

1. `SOURCE_DIR/manifest.yaml` を読み込み、バージョンと配布対象ファイル一覧を確認します。
2. 対象リポジトリ内の以下のファイルの有無と内容を確認します。
   - `.agents/repository-name.lock.json`（過去に導入済みか、バージョンはいくつか）
   - `AGENTS.md`（既存のルールがあるか、`<!-- repository-name:solo:start` マーカーが既にあるか）
   - `docs/` ディレクトリ（既存のドキュメントが存在するか）
   - `.agents/skills/` ディレクトリ
   - `.vscode/extensions.json`, `.vscode/settings.json`

---

## ステップ 3: 導入計画の提示とユーザー承認

ファイルを書き換える前に、以下の形式で導入・更新計画をユーザーに提示し、確認を取ってください（ユーザーが最初から「確認なしで即時適用して」と指示している場合を除く）。

- **新規作成されるファイル**: （例: `docs/index.md`, `docs/_conventions.md`, `.agents/skills/...`）
- **上書き更新されるファイル（`policy: overwrite`）**: （アップデート時）
- **ブロック統合されるファイル（`policy: merge-block`）**: `AGENTS.md`
- **スキップ（保持）されるファイル（`policy: create-only`）**: 既に `docs/index.md` がある場合など
- **既存の `docs/` 文書がある場合の確認**:
  - 既存の Markdown ファイルは一切削除・上書きしません。
  - 導入後に既存文書へフロントマターを付与して `docs/index.md` に統合するかどうか、ユーザーの希望を確認してください。
- **`.vscode/` 設定（`optional: true`）**: 導入するかどうかを確認してください（迷う場合は導入を推奨）。

---

## ステップ 4: ファイルの配置と統合

`SOURCE_DIR/manifest.yaml` の各エントリに従い、ポリシーごとに処理します。

### 1. `policy: overwrite`
- `SOURCE_DIR/<src>` を対象リポジトリの `<dest>` へコピー（親ディレクトリがなければ作成）します。

### 2. `policy: create-only`
- 対象リポジトリに `<dest>` が**存在しない場合のみ**、`SOURCE_DIR/<src>` をコピーします。
- 既に存在する場合は変更せずそのまま残します。
- 新規作成した `docs/index.md` 内の `created` / `updated` の日付を当日の日付（`YYYY-MM-DD`）に更新します。

### 3. `policy: merge-block`（`AGENTS.md`）
- `SOURCE_DIR/payload/AGENTS.block.md` の内容を読み込みます。
- 対象リポジトリに `AGENTS.md` が存在しない場合：
  - `# AGENTS.md\n\n` の見出しに続けて `AGENTS.block.md` の内容を書き込みます。
- 対象リポジトリに `AGENTS.md` が存在し、`<!-- repository-name:solo:start` から `<!-- repository-name:solo:end -->` までのマーカーブロックが**既にある場合**：
  - マーカー開始行からマーカー終了行までを、新しい `AGENTS.block.md` の内容で置換します（マーカー外の既存記述は一切変更しない）。
- 対象リポジトリに `AGENTS.md` が存在し、マーカーが**まだない場合**：
  - 既存の `AGENTS.md` の末尾に空行を1行挟んで `AGENTS.block.md` の内容を追記します。

### 4. `policy: merge-json`（`.vscode/extensions.json`, `.vscode/settings.json`）
- 対象ファイルが存在しない場合はそのままコピーします。
- 既に存在する場合は、既存の JSON キーや `recommendations` 配列の要素を消さずに、不足している推奨拡張機能・設定項目だけをマージします。

---

## ステップ 5: ロックファイル（`.agents/repository-name.lock.json`）の記録

導入・更新したバージョンと取得元を記録するため、対象リポジトリの `.agents/repository-name.lock.json` を作成（または更新）します。

```json
{
  "preset": "solo",
  "version": "0.1.1",
  "source": "<GitHub URL またはローカルパス>",
  "installedAt": "<YYYY-MM-DD>"
}
```

---

## ステップ 6: 動作確認（Lint 実行）とクリーンアップ

1. 一時ディレクトリ（`TEMP_DIR`）を作成していた場合は削除します。
2. 導入された検証スクリプトを実行し、初期状態のドキュメント（`docs/index.md`）が正常に検証を通ることを確認します。

```bash
node .agents/skills/docs-sync/scripts/docs_lint.mjs
```

3. ユーザーに導入完了を報告し、続けて既存コードから初期ドキュメント（`overview.md`, `architecture.md`, `glossary.md`）を生成するかどうか（`docs-bootstrap` スキルの実行）を提案してください。
