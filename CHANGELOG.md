# 変更履歴

このファイルはマイルストーン単位での主要な変更を記録する。
[Keep a Changelog](https://keepachangelog.com/) の考え方を参考にしつつ、
本プロジェクトの開発体制（副業・個人運用）に合わせて簡略化している。
日付単位のリリースではなく `docs/PROPOSAL.md` のマイルストーン（M1〜）を
単位として記録する。

## テストの分岐網羅率強化（2026年9月）

コードレビューで見つかった過去の実バグ（工事経歴未収集、複数許可リマインド
表示不整合、いずれもPR #25）を踏まえ、`npm run test:coverage` の結果を
手がかりに分岐カバレッジの穴を系統的に洗い出し、埋めた。138件→200件
（2回に分けて実施。1回目で138件→191件、2回目で191件→200件）。

- 法定5要件判定ロジックの未検証だった分岐を追加（`test/eligibility.test.js`）:
  財産的基礎の一般建設業OR条件（自己資本・資金調達能力・継続営業実績の
  各ルートと境界値）、専任技術者の国家資格・指定学科卒業ルートと複数営業所
  集約判定、経営業務管理体制のルートB・C、欠格要件6フラグの個別検証など
- `src/web/htmlUtils.js` の `escapeHtml`（XSS対策の要）を直接テストする
  `test/htmlUtils.test.js` を新設。従来はWebフォームの結合テスト経由の
  間接検証のみだった
- `src/documents/common.js` の全様式共通ヘルパーを直接テストする
  `test/documentsCommon.test.js` を新設
- `renewalSchedule.js` にうるう年境界（許可日が2/29のケース等）のテストを追加
- Webフォーム（`src/web/formPage.js`）のブラウザ側JavaScript
  （`buildProfile()` 等）を、`jsdom`（新規devDependency）で実際に
  `<script>` を実行して検証する `test/formPageClient.test.js` を新設。
  これまでブラウザでの手動確認でしか検証できていなかった領域で、
  下書きからの復元→再送信の往復確認・任意項目の未入力/入力済み区別・
  未入力項目パネルのXSS対策も含む（詳細は`docs/DESIGN.md` 7章）
- 2回目の追加分: `src/eligibility/engine.js` の `formatEligibilityReport`
  （CLIレポート整形。合否まとめ・入力内容の確認事項セクションを含めて
  従来無テストだった）、リマインド・ダイジェストの「30日以内に期限が到来」
  区分見出し、様式第八号の営業所未入力時のdocx生成、`clientStore.js`・
  `draftStore.js`の「保存データが配列でない」異常系、Webサーバーの
  `/download`の404・`POST /drafts`のバリデーション400・`startServer()`の
  起動確認を追加
- 上記強化によりカバレッジは概ねライン99.7%・分岐92%まで向上（強化前は
  ライン98.5%・分岐88%で、特に法定要件判定モジュールの分岐網羅率が
  45〜75%台にとどまっていた）。残る未カバー分岐は、5MBボディサイズ上限
  超過時のリクエスト拒否（負荷が大きく実用上のリスクも低いため）や
  `node src/web/server.js`直接実行時のみ通るエントリポイント分岐など、
  意図的に許容している少数の箇所のみ

## M10: 財務諸表対応（完成工事原価報告書のみ・完了）

M9に続き、財務諸表（様式第十五号〜十七号）を調査した。貸借対照表・
損益計算書本体・株主資本等変動計算書・注記表は、法定の勘定科目分類
（国土交通大臣告示）の全体を一次資料で確認できなかったため対象外とし
（`docs/adr/0010-financial-statements-scope-kansei-kouji-genka-only.md`）、
完成工事原価報告書（様式第十六号の一部。材料費・労務費・外注費・経費の
4区分・6項目に固定）のみに限定して実装した。

- `src/documents/youshiki16.js` を追加。合計額（完成工事原価）を算出して
  表示する。損益計算書との整合性チェックは対象外のため注記に留めた
- `ApplicantProfile` に `completedConstructionCost: CompletedConstructionCostInput`
  （任意）を追加
- **標準の一括生成（`GET /submit`）に追加**（7様式に）。完成工事原価報告書は
  決算変更届・経審いずれでも必要になりうる書類であるため（経審専用手続きの
  `youshiki25-14.js`とは異なる）
- Webフォーム（`src/web/formPage.js`）にも入力セクションを実装と同じPRで
  追加した（M8で工事経歴のフォーム連携が漏れていた反省を踏まえた対応）

## コードレビューでの修正（2026年9月）

一通りの機能実装が一区切りついたタイミングでコードの見直しを行い、
以下の不備を発見・修正した。

- **バグ修正: Webフォームが工事経歴（様式第二号用）を収集していなかった**:
  M8で `src/documents/youshiki2.js` を6様式一括生成（`/submit`）に追加した際、
  `src/web/formPage.js`（ブラウザ側の入力フォーム）の更新が漏れており、
  Web経由で生成した様式第二号は常に「工事経歴が入力されていません」という
  空の状態になっていた（CLI/スクリプト経由の生成には影響なし）。役員・
  営業所と同じ行の追加・削除パターンで「工事経歴」入力セクションを追加し、
  `constructionHistory` を実際に送信できるようにした
- **表示の不整合修正: `/reminders`のメール下書きリンクに許可IDが表示されていなかった**:
  複数許可対応（M7・ADR-0008）で `formatLine`（CLI出力）・
  `buildReminderMailtoUrl`（メール本文）は許可ID（`licenseId`）を表示するよう
  対応済みだったが、`/reminders`ページの「連絡が必要な件」リンク一覧の
  表示文言だけ対応が漏れていた。1クライアントが複数許可を持ち、同じ内容・
  同じ期限のリマインドが並んだ場合に区別できなかった不備を修正した

## M9: 経営規模等評価申請書・総合評定値請求書対応（完了）

M8に続き、経審関連書類のうち経営規模等評価申請書・総合評定値請求書
（様式第二十五号の十四）の総括表（項番01〜20）を調査・実装した。調査の結果、
別紙一〜三（工事種類別完成工事高等・技術職員名簿・社会性等）は記載項目数が
多く、経営状況分析申請書（様式第二十五号の八）は財務諸表の提出が前提となる
手続きであることが判明したため、これらはFR-7.3（財務諸表対応）と合わせて
改めて検討することとし、本フェーズでは総括表のみに限定した。

- `src/documents/youshiki25-14.js` を追加。`ApplicantProfile` 本体の既存項目
  （商号・代表者・所在地・資本金・自己資本額・対象業種）を再利用しつつ、
  様式固有の追加項目（許可番号・審査基準日・営業利益・分析機関名等。新設した
  `KeishinRequestInput` 型）を合成してサマリーを生成する
- 市区町村コード・大臣/知事コード等のコード変換は行わず、記載要領の別表を
  参照するよう注記するに留めた（コード表は将来変更されうるため）
- **標準の6様式一括生成（`GET /submit`）には含めていない**: 経審は新規許可申請
  とは別の手続きであり、すべての新規申請者が必要とするわけではないため、
  `npm run gen:youshiki25-14` によるCLI個別生成のみとした

## M8: 経営事項審査（経審）書類準備支援（フェーズ1完了）

競合調査で識別した経審対応について、点数計算（X1・X2・Y・Z・W・総合評定値P）は
国が定期改定する換算表・法令上民間機関が算出するY点を扱う専門領域のため対象外とし、
既存M4のリマインド対象である決算変更届でも毎事業年度必要な工事経歴書（様式第二号）
のdocxサマリー生成に限定して着手した（`docs/adr/0009-keishin-scope-documents-only.md`）。

- `src/documents/youshiki2.js` を追加。元請を先に請負代金の額の大きい順に
  並べる並び順の解決までは自動化するが、掲載件数の絞り込み（経審・決算変更届で
  異なる選定基準）・消費税の税込税抜換算は自動化せず、確認を促す注記に留めた
- `src/documents/common.js` に複数列の一覧表を組み立てる `buildHeaderedTable`
  を追加（既存の`buildLabeledTable`は2列固定のため、工事経歴書のような
  可変列数の表には別関数として用意した。将来の財務諸表対応でも再利用を想定）
- `ApplicantProfile` に `constructionHistory: WorkRecordInput[]`（任意）を追加
- `GET /submit` の生成対象に様式第二号を追加（6様式に）

## M7: 競合調査に基づく機能拡張（完了）

構成・許認可更新期限管理ツール・AI活用事例等の競合調査（2026年9月実施）を
踏まえた3件の機能拡張。詳細は `docs/DESIGN.md` §5.14〜5.16、
`docs/adr/0008-multi-license-client-model.md` を参照。

- **リマインドの3段階化・一覧フィルタリング**: `calcRenewalSchedule` に
  満了180日前（早期検討）を追加（60日前・30日前の法定期限は変更なし）。
  `GET /reminders` に残日数（期限超過／1ヶ月以内／1〜3ヶ月／3〜6ヶ月／
  6ヶ月超）でのフィルタ表示を追加。CLI向け `formatReminderDigest` の
  出力形式は変更していない
- **クライアントの複数許可対応**: `ClientLicenseRecord`（1クライアント＝
  1許可）を `ClientRecord`/`LicenseEntry`（1クライアントが複数許可を保有
  可能）へ変更（`docs/adr/0008-multi-license-client-model.md`）。既存の
  `data/clients.json` は読み込み時に自動移行（lazy migration）。CSVは
  「1行＝1許可」形式に変更。決算変更届のリマインドはクライアントごとに
  1件のみ生成（重複防止）。`scripts/add-client.js` は既存クライアントへの
  許可追加に対応
- **入力内容の整合性チェック**: `src/eligibility/consistencyChecks.js` を
  新設。代表者氏名と経営業務管理責任者氏名の不一致、実務経験年数等の
  非現実的な値、専任技術者の複数営業所重複登録を検出し、`EligibilityResult`
  に `consistencyWarnings` として追加。合否判定（`eligible`）には一切
  影響しない。外部AI APIは使わずルールベースで実現（NFR-4）

## M6: 拡張（土台のみ・対象都道府県未確定のため保留中）

- **都道府県固有ルールの合成の仕組み**: `src/eligibility/prefectureRules.js`
  を追加。`registerPrefectureRules(prefecture, checkFn)` で都道府県固有の
  追加要件を登録すると、`evaluateEligibility` が共通5要件の判定結果に
  合成するようになった。未登録の都道府県（＝現時点のデフォルト）では
  従来どおり共通5要件のみで判定し、既存の挙動（M1〜M4）には影響しない
  （`docs/adr/0005-prefecture-rule-composition.md`）。対象都道府県が未確定の
  ため、具体的な追加要件は1件も登録していない
- **JCIP外部インターフェイス仕様の調査**: 国土交通省が公開する
  「電子申請システム外部インターフェース仕様書」（XML形式、2026年9月時点で
  v1.3）の所在・概要のみ調査。実際の自動連携コードは、行政書士登録の完了・
  対象都道府県の確定・仕様書本文の精査がすべて揃うまで実装しない
  （`docs/adr/0006-jcip-integration-deferred.md`）

## インテイクフォームの使い勝手改善（M3拡張）

- **下書き保存・再開**: 入力途中の `ApplicantProfile` を `data/drafts.json`
  へ保存し、後から続きを入力できる `src/web/draftStore.js` を追加。
  Webフォームに「下書きとして保存」ボタンと `/drafts`（一覧・削除）を追加
- **未入力項目の事前チェック表示**: 送信前にフォーム上で未入力の項目
  （代表者氏名・役員氏名・専任技術者氏名等）を一覧表示するようにした
  （送信自体はブロックしない、気づきのための表示）
- **クライアント一覧のCSVエクスポート/インポート**: `src/reminders/clientCsv.js`
  でRFC4180準拠のCSV変換を実装。CLI（`scripts/export-clients-csv.js` /
  `import-clients-csv.js`）と、Webの読み取り専用ダウンロード（`/clients.csv`）
  から利用できる。一括登録はCLI限定（`/reminders` の「表示専用」方針と一貫）

## M4: 通知連携（一部完了）

- クライアントの許可情報をローカルJSONファイル（`data/clients.json`）に
  保存・読込する `src/reminders/clientStore.js` を追加
- 更新準備・更新申請の最終締切・決算変更届のリマインドを集計・整形する
  `src/reminders/reminderDigest.js` を追加（`buildReminderDigest` /
  `filterDueAlerts` / `formatReminderDigest`）
- 連絡先メールアドレス（任意）を登録したクライアントについて、
  メール下書きを開く `mailto:` URLを生成する `buildReminderMailtoUrl` を追加
  （実際の自動送信は行わない）
- クライアントの登録・削除・確認用CLI（`scripts/add-client.js` /
  `remove-client.js` / `reminder-digest.js`）を追加
- Webフォームに `GET /reminders`（表示専用）を追加
- 実際のメール等の自動送信（SMTP・API連携）は未実装。送信チャネルの選定は
  発注者の意思決定事項として保留（`docs/DESIGN.md` §5.11参照）

## M3: インテイク簡易フォーム（完了）

- `node:http` のみで実装したローカルWebフォーム（`src/web/`）を追加。
  ブラウザからApplicantProfileを入力し、要件判定＋書類生成をワンストップで実行
- `127.0.0.1` のみで待受し、外部ネットワークには公開しない
- フォーム値はブラウザ側JavaScriptでApplicantProfile型のJSONに組み立ててから
  通常のフォームPOSTで送信する方式を採用（サーバー側の受け口を単純化）
- `/download` にパストラバーサル対策を実装

## M2: 主要様式フル対応（完了）

- 様式第六号（役員等の一覧表）・第七号（経営業務管理責任者証明書）・
  第八号（専任技術者証明書）・第二十号の二（誓約書）のdocx生成を追加
- 既存の様式第一号（`youshiki1.js`）を含む全様式生成モジュールが
  要件判定エンジンと同じ `ApplicantProfile` 型を入力とするようリファクタリング
  （FR-2.7対応。様式ごとのデータ二重定義を排除）
- 様式生成の共通ヘルパー（見出し・赤字注記・表・箇条書き）を
  `src/documents/common.js` に集約
- Node.js v24環境で `node --test <ディレクトリ>` が失敗する問題を確認し、
  `package.json` の `test` スクリプトを `node --test`（自動探索）に変更

## M1: 要件判定エンジンMVP（完了）

- 建設業許可の法定5要件（経営業務管理体制・専任技術者・財産的基礎・
  欠格要件・誠実性）の判定エンジンを実装
- 許可の有効期間満了日（5年）・決算変更届の提出期限（事業年度終了後4ヶ月）の
  計算ロジックを実装
- 様式第一号のdocxサマリー生成の試作を実装

## 開発基盤（継続的に追加）

- `tsconfig.json`（`checkJs: true` / `noEmit: true`）による型チェックを導入し、
  `npm run typecheck` としてCIに追加（`.js`ファイルはそのまま。ビルド・
  トランスパイルステップは追加していない。`docs/adr/0007-checkjs-type-checking.md`）
- ESLint（`eslint.config.js`、flat config）を導入し、`npm run lint` としてCIに
  追加（ビルドステップは増やしていない。導入時点でエラー0件）
- GitHub Actions（`.github/workflows/test.yml`）でpush・PR時に
  Node.js 20.x/22.xの2バージョンで `npm test` を自動実行
- Dependabot（`.github/dependabot.yml`）でnpm依存パッケージ・GitHub Actionsの
  更新PRを週次で自動作成
- `.gitattributes` で改行コードをLFに正規化し、開発環境間の差分揺れを防止
- `docs/BEST_PRACTICES_AUDIT.md` でセキュリティ・依存関係管理・テスト/CI・
  リポジトリ運用の観点から定期的に棚卸しする運用を開始
