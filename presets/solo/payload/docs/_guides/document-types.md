# 文書の種別・配置・状態

新規作成、状態変更、仕様と計画の整理時に、一覧と対象種別の節を参照します。

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

`draft` は未確認・作成途中です。未確認の初版はdraftにし、確定事項として扱いません。

## index

冒頭に目的別の案内を置き、全体像、環境構築、機能仕様、設計理由へ実在する文書の相対リンクで案内します。自動生成範囲の外を編集し、全文書を手動で列挙する必要はありません。目次は現行文書・下書き・進行中の変更案を分け、完了計画・置き換え済み・廃止文書は自動生成される `_history.md` から探せます。

## overview

目的・利用者・利用シナリオ・非対象を説明し、機能一覧から現行specへリンクします。未決定の機能はplanで扱います。

## architecture

現在の全体構成、責務・境界、主要な処理の流れを説明します。コードを読めば分かる詳細の転載は避けます。

## glossary

ドメイン用語とコード上の識別子の対応を記録します。

## spec

現在有効な合意済みの振る舞い・制約を記述します。利用例、正常時・例外時の振る舞い、継続して満たす受け入れ条件を含め、必要なADRやguideへリンクします。検証の実行結果や完了チェックはplanへ記録します。新規specのdraftは初版の整理・確認用で、将来の変更案の置き場にはしません。

## adr

判断の背景・選択肢・理由・影響を記録します。既存の最大番号+1を4桁で採番します。`accepted` は判断の採用を意味し、実装完了の証明ではありません。

acceptedのADR本文は原則維持します。判断を変更する場合は新しいADRを作り、`supersedes` に旧ADRのIDを指定します。新ADRの採用時に旧ADRのstatusをsupersededへ変更し、updatedを更新します。下書きの提案だけで旧ADRを失効させません。

## plan

新機能や仕様変更の案、変更前後の振る舞い、合意の根拠、作業と進捗、実行した検証と結果、未実施項目、現行文書への反映状況を記録します。合意した変更は実装・検証後に現行specへ反映します。

作業・必要な検証・文書反映が完了したらdoneにして `docs/plans/archive/` へ移動します。未解決の差分は解消するか、明示的に別作業へ引き継ぎます。移動元へのリンクと、移動した本文内の相対リンクの両方を更新します。

## guide

現在使える手順について、前提、実行手順、成功の確認方法を揃えます。

## note

調査結果と根拠、適用範囲を記録し、確定仕様と区別します。
