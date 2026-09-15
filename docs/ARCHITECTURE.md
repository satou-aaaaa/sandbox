# アーキテクチャ方針

> 本書はアーキテクチャ方針の要約版。外部開発者への委託にあたっては、
> [`docs/REQUIREMENTS.md`](REQUIREMENTS.md)（要件定義書）、
> [`docs/DESIGN.md`](DESIGN.md)（技術設計書・モジュール詳細）、
> [`docs/DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md)（開発環境構築・コーディング規約・Git運用）
> もあわせて参照すること。

## 全体パイプライン

```
① インテイク（顧客からの情報収集）
        ↓
② 要件判定エンジン（src/core/eligibility/ + src/licenses/<種別>/eligibility/）
        ↓  ← ここで不足があれば申請前に顧客へフィードバック
③ 書類自動生成（src/core/documents/ + src/licenses/<種別>/documents/）
        ↓
④ 人手レビュー・職印押印 ★唯一、自動化できない必須ステップ
        ↓
⑤ 提出（JCIP電子申請 or 印刷パッケージ）
        ↓
⑥ 更新リマインドエンジン（src/core/reminders/ + src/licenses/<種別>/reminders/）→ ①へ戻る（次回更新・決算変更届等）
```

行政書士の独占業務（有償での官公署提出書類の作成・提出代理）は④の人手レビューに
集約されるよう設計している。①②③⑥をどれだけ自動化しても、④を省略することは
2026年の行政書士法改正下では違法になる（詳細は Obsidian Vault の
`15-行政書士/副業サービス構想.md` を参照）。

このパイプライン自体は許可種別（建設業許可・古物商許可等）によらず共通である
という発見をもとに、2026年9月に「許可種別非依存の共通コア（`src/core/`）＋
許可種別ごとの薄いアドオン（`src/licenses/<種別>/`）」という構造に整理する
リファクタリングを行った（`docs/DESIGN_kobutsu-core.md`参照）。コア側は
「建設業」「古物商」といった固有の許可種別名・法令名を一切知らない設計にして
おり、新しい許可種別を追加する際はアドオンを1つ追加してコアへ登録するだけで
済むことを、古物商許可モジュール（M11）の実装を通じて検証した。

## なぜ TypeScript ではなく JSDoc + 素のJavaScriptか

副業として平日夜間・週末にメンテナンスすることを想定し、ビルドステップ
（tsc等のコンパイル）を挟まずに `node` コマンドで直接実行できる構成にしている。
JSDocの型注釈により、VS Code等のエディタでは型補完・型チェックがほぼ
TypeScriptと同等に効く。

プロジェクトの規模が育ってきたため、`tsconfig.json`（`checkJs: true` /
`noEmit: true`）による型チェックをCIに導入済み（`npm run typecheck`）。
これは「コンパイル・ビルドステップを増やさずに型チェックだけ行う」もので、
`.js`ファイルを`.ts`に置き換えるものではない。詳細は
[ADR-0007](adr/0007-checkjs-type-checking.md) を参照。

## モジュール構成

M11（`docs/DESIGN_kobutsu-core.md`）で、許可種別に依存しない共通コア
（`src/core/`）と、許可種別ごとのアドオン（`src/licenses/<種別>/`）に
整理した。コア側は「建設業」「古物商」等の固有の許可種別名・法令名を
一切含まない設計にしている。

### 共通コア（`src/core/`）

- `src/core/eligibility/types.js` — 要件判定の共通型（`RequirementCheckResult`・`EligibilityResult`・`ConsistencyWarning`）。許可種別固有の巨大な型（`ApplicantProfile`等）は各アドオン側に置く
- `src/core/eligibility/aggregate.js` — 個別の判定結果配列から総合判定・レポートの共通部分を集約する許可種別非依存のロジック
- `src/core/documents/common.js` — 様式生成モジュール共通のdocxヘルパー（見出し・赤字注記・表・箇条書き・ファイル書き出し）
- `src/core/reminders/scheduleTypes.js` — 許可種別ごとのリマインド・スケジュール計算関数を登録・取得するレジストリ（`prefectureRules.js`と同じパターン）
- `src/core/reminders/dateUtils.js` — 許可種別に依存しない日数計算（`daysUntil`）
- `src/core/reminders/digest.js` — 複数クライアント（1クライアントが複数許可を保有可能、`ClientRecord`/`LicenseEntry`、ADR-0008）のリマインドを`scheduleTypes.js`経由で集計・整形、残日数バケット分類、メール下書きURL生成（M4・M7。実送信は行わない）
- `src/core/reminders/clientStore.js` — クライアント情報を `data/clients.json` へ読み書きするローカル永続化層（DB不使用。旧形式データ・`licenseCategory`未設定データの自動移行に対応）
- `src/core/reminders/clientCsv.js` — クライアント一覧とCSVの相互変換（1行＝1許可。バックアップ・一括登録用。外部パッケージ不使用）

### 建設業許可アドオン（`src/licenses/construction/`）

- `eligibility/types.js` — `ApplicantProfile`等、建設業許可固有のJSDoc型定義（要件判定・書類生成の入出力の唯一の情報源）
- `eligibility/rules/*.js` — 法定5要件それぞれの判定ロジック（1要件=1ファイル）
- `eligibility/engine.js` — 5要件（＋登録済みの都道府県固有要件）をまとめて判定し、総合結果とレポートを生成（集約部分はコアの`aggregate.js`を再利用）
- `eligibility/prefectureRules.js` — 都道府県固有の追加要件を登録・合成する仕組み（M6の土台。具体的な要件は未登録）
- `eligibility/consistencyChecks.js` — 入力内容のルールベース整合性チェック（M7。合否判定には影響しない付加情報。外部AI APIは使わない）
- `documents/youshiki1.js`・`youshiki2.js`（工事経歴書、M8）・`youshiki6.js`・`youshiki7.js`・`youshiki8.js`・`youshiki16.js`（完成工事原価報告書、M10）・`youshiki20-2.js`・`youshiki25-14.js`（経審総括表、M9） — 各様式のdocx自動生成
- `reminders/renewalSchedule.js` — 5年更新（早期検討180日前・準備開始60日前・法定期限30日前の3段階、M7）・決算変更届の期限計算
- `index.js` — `registerConstructionLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント

### 古物商許可アドオン（`src/licenses/kobutsu/`。M11新規・第2のパイロット）

- `eligibility/types.js` — `KobutsuApplicantProfile`等、古物商許可固有のJSDoc型定義
- `eligibility/kekkaku.js` — 古物営業法第4条の欠格事由（一号〜九号）の判定
- `eligibility/eigyosho.js` — 営業所・管理者要件（第13条）の判定
- `eligibility/engine.js` — 上記2要件をまとめて判定（集約部分はコアの`aggregate.js`を再利用）
- `documents/shinseisho.js`（許可申請書）・`seiyakusho.js`（誓約書）・`rirekisho.js`（略歴書） — 各様式のdocx自動生成
- `reminders/changeSchedule.js` — 書換申請（変更日から14日以内）・許可証返納（廃業日から10日以内）の期限計算、変更届出（3日以内）の即時警告
- `index.js` — `registerKobutsuLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 法人申請・Webフォーム対応・整合性チェックは対象外（`docs/REQUIREMENTS_kobutsu-core.md` 4.6節）

### Web・共通

- `src/web/server.js` — インテイク用の簡易Webフォーム（M3。建設業許可のみ対応）＋リマインド表示・残日数フィルタ（`/reminders`、M7）＋下書き保存（`/drafts`）＋CSVダウンロード（`/clients.csv`）。node:http のみで実装し、127.0.0.1のみで待受
- `src/web/draftStore.js` — インテイクフォームの入力途中データを `data/drafts.json` へ読み書きするローカル永続化層（DB不使用）
- `test/` — `node --test` で実行するユニットテスト（外部テストランナー不要）
- `scripts/` — 動作確認用のサンプル実行スクリプト（`sampleProfile.js`・`sampleKobutsuProfile.js`が各許可種別共通のダミーデータ）

## 既知の未実装・今後の拡張ポイント

- 正式な様式（国交省・都道府県指定のレイアウト）への完全準拠したPDF/docx出力
  （現状は内容確認用のサマリー表のみ）
- 様式第二十号の二（誓約書）は本ツールが判定に用いる欠格要件6項目のみを確認しており、
  建設業法第8条の全14号への完全対応はしていない
- JCIP外部インターフェイス仕様書に沿ったデータ連携（電子申請の自動化）。
  仕様書の存在・概要（XML形式、2026年9月時点でv1.3が公開）は調査済みだが、
  行政書士登録・対象都道府県の確定・仕様書本文の精査が完了するまでは
  実装しない方針（`docs/adr/0006-jcip-integration-deferred.md`）
- 都道府県ごとの提出書類・様式差異の吸収（本ツールはまず自都道府県分から
  着手する想定）。「共通要件＋都道府県固有要件」を合成する仕組み自体は
  実装済み（`src/licenses/construction/eligibility/prefectureRules.js`、`docs/adr/0005-*.md`）だが、
  対象都道府県が未確定のため、具体的な追加要件は1件も登録されていない
- 更新リマインドの通知チャネル（メール等）との連携。`src/core/reminders/digest.js` で
  「今どのリマインドが必要か」の計算・整形、`clientStore.js` によるローカル
  永続化までは実装済みだが、実際の自動送信機能は未実装
  （外部サービス連携の要否を含め要検討）
- 古物商許可のWebフォーム対応（`src/web/`は建設業許可専用のまま）・
  整合性チェック（建設業許可の`consistencyChecks.js`相当）・法人申請対応
  （`docs/DESIGN_kobutsu-core.md` 9章「今後の拡張ポイント」参照）
- Webフォーム（M3）は単一プロセス・単一ユーザーのローカル利用を想定した最小構成。
  クライアント情報は単一JSONファイル（`data/clients.json`）で管理しており、
  本格的なデータベース・認証・複数ユーザー対応は範囲外

## 法的な前提（重要）

- このツールの判定結果は「申請前のセルフチェック・一次スクリーニング」であり、
  最終的な適格性の判断・書類作成・提出の責任は、登録された行政書士本人が負う。
- 試験合格・行政書士登録が完了するまで、このツールを使って有償で
  書類作成・提出代理を行うことはできない。

## Git CLI ワークフロー

このリポジトリの操作（コミット・push等）は、GUIツール（Forkなど）ではなく
`git` CLI（Git CMD）で完結させる運用に統一している。
