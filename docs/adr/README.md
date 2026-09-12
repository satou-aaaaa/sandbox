# アーキテクチャ決定記録（ADR）

このディレクトリは、プロジェクトの重要な技術的決定とその背景を記録する
Architecture Decision Record（ADR）を管理する。

## なぜADRを書くのか

`docs/DESIGN.md` は「現在どうなっているか」を説明するが、
「なぜそれを選んだのか」「他にどんな選択肢を検討し、なぜ採用しなかったのか」
という意思決定の背景は時間とともに失われやすい。ADRはこの背景を
残すことで、後から仕様変更を検討する際に同じ議論を繰り返さずに済むように
するためのもの（`docs/BEST_PRACTICES_AUDIT.md` 参照）。

## 書き方

1. `template.md` をコピーし、`NNNN-短いタイトル.md`（4桁の連番、ケバブケース）
   という名前で保存する。
2. Status（Proposed / Accepted / Superseded by ADR-XXXX）、Context（背景・
   制約）、Decision（決定内容）、Consequences（メリット・デメリット・
   トレードオフ）を埋める。
3. 一度Acceptedになったら、内容を書き換えるのではなく、方針が変わった場合は
   新しいADRを書いて古い方に "Superseded by ADR-XXXX" と追記する
   （決定の変遷を追えるようにするため）。

## 一覧

| ADR | タイトル | ステータス |
|---|---|---|
| [0001](0001-buildless-javascript.md) | TypeScriptを使わずJSDoc + 素のJavaScriptで実装する | Accepted |
| [0002](0002-shared-applicant-profile-type.md) | 全様式生成モジュールでApplicantProfile型を共有する | Accepted |
| [0003](0003-json-file-persistence-over-database.md) | クライアント情報の永続化にデータベースではなく単一JSONファイルを使う | Accepted |
| [0004](0004-mailto-draft-over-auto-send.md) | 更新リマインドの通知はメール自動送信ではなくmailto:下書きに留める | Accepted |
| [0005](0005-prefecture-rule-composition.md) | 都道府県固有要件は共通5要件モジュールを改変せず、登録制の追加ルールとして合成する | Accepted |
| [0006](0006-jcip-integration-deferred.md) | JCIP自動連携は本フェーズで実装せず、公開情報の調査結果のみ記録する | Accepted |
| [0007](0007-checkjs-type-checking.md) | `tsconfig.json` の `checkJs` によるビルドレスな型チェック導入 | Accepted |
| [0008](0008-multi-license-client-model.md) | クライアントが複数の許可を保有できるデータモデルへ変更する | Accepted |
