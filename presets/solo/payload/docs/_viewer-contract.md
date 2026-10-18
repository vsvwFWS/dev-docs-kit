# ビューアー連携のデータ契約

Markdownとフロントマターが正本です。ビューアーは検索、機能別表示、関連・参照元、文書の状態、検証エラーを補助します。ビューアーだけに分類・関係を保存しません。

## 利用方法

Node.js側で `parseDocument`・`loadDocsGraph`・`validateDocs`・`generateIndexContent` をimportできます。ファイル読み込みはNode.jsに依存するため、ブラウザーにはJSONへ変換した結果を渡してください。CLIでも取得できます。

```bash
node .agents/skills/docs-sync/scripts/docs_lint.mjs --json
```

`--index` を付けた場合だけ、目次と必要な履歴目次を更新します。通常の `--json` は読み取り専用です。

## JSON出力（formatVersion: 1）

既存の `valid`・`errors`・`warnings`・`documentCount`・`indexUpdated`・`documents` を維持し、`formatVersion` と `edges` を追加しています。docsディレクトリが存在しないエラーではdocumentCountは省略されます。

各documents要素の既存項目は `file`（docs相対パス）、`frontmatter`、`backlinks`、`supersededBy` です。新しい `referenceBacklinks` は本文リンクから算出する参照元ID配列です。本文はCLI出力には含みません。Node.jsのloadDocsGraphが返すdocumentsにはbodyと行番号付きlinksも含まれます。

```json
{
  "sourceId": "spec-login",
  "targetId": "adr-0001",
  "kind": "references"
}
```

edgesのkindは次の3種類です。

| kind | 正本 | 逆方向の情報 |
|---|---|---|
| related | フロントマターのrelated | backlinks（従来どおりrelated専用） |
| references | 本文の相対Markdownリンク | referenceBacklinks |
| supersedes | フロントマターのsupersedes | supersededBy |

同一のsourceId・targetId・kindは一件にまとめます。relatedとreferencesは別の関係として併存します。リンクのフラグメントは文書間の関係ではまとめます。IDが重複する文書への・文書からの関係は生成せず、DUPLICATE_IDで診断します。存在しないIDやリンクは検証結果に残し、推測して結び付けません。

本文リンクはインライン形式 `[説明](./path.md)` を対象とし、コード・HTMLコメント中のリンクは除外します。外部URL、同一文書内の `#見出し`、画像・コード等の管理対象外ファイル、excludedFilesの文書にはID間のedgeを作りません。ローカルファイルの存在チェックは行いますが、見出しアンカー、外部URLの到達性、参照形式リンクの解決は対象外です。

loadDocsGraphの既存のdocsDir・documents・byId・duplicateIdsは維持し、edgesとconfigを追加しています。configはexcludedFilesと設定のerrorsを持ちます。既存の引数とexportを維持します。

## 表示と編集

- tagsで機能・テーマを絞り込み、typeで文書種別を切り替えます。同じ機能のタグ表記は既存値を候補にします。
- draftは未確認、planは変更案・作業、noteは調査結果として表示します。acceptedのADRを「実装済み」と表示しません。
- done・superseded・deprecatedは履歴としてまとめ、supersededByから後継を案内します。
- 更新日は編集日です。Lint成功は構造が検証を通ったことだけを示し、本文の正しさを保証しません。
- メタデータ編集は同じMarkdownへ書き戻し、未知の独自項目は追加しません。保存後に同じ検証を実行します。
- IDはファイル移動でも維持します。本文の相対リンクの修復は別の編集作業です。このスクリプトは自動修復しません。

`docs/index.md` の目的別案内は人間・AIが維持し、マーカー内だけを生成します。`docs/_history.md` は必要時に生成され、通常の文書グラフに含まれません。既存の履歴ページ本文がある場合もマーカー外を保持します。本文・分類・状態・関係のいずれも、専用ビューアーなしで確認できることを維持してください。
