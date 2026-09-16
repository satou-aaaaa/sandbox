# kensetsu-kyoka-toolkit

[![Test](https://github.com/satou-aaaaa/sandbox/actions/workflows/test.yml/badge.svg)](https://github.com/satou-aaaaa/sandbox/actions/workflows/test.yml)

建設業許可の新規申請・更新業務を自動化するためのツールキット（開発中・雛形）。

行政書士を副業として行うにあたり、「自分の関与を最終レビューと押印だけに絞り込む」ことを
目標に、要件判定・書類生成・更新リマインドをソフトウェアで仕組み化するプロジェクト。
経緯・市場調査・分野選定の理由は Obsidian Vault の
`15-行政書士/副業サービス構想.md` を参照。

> ⚠ 行政書士は登録制の独占業務です。試験合格・行政書士会への登録が完了するまで、
> このツールを使って有償で書類作成・提出代理を行うことはできません。
> 現段階ではあくまで「登録後すぐに使える状態を準備しておく」ための開発です。

## できること（現時点）

- **要件判定エンジン**: 建設業許可の法定5要件（経営業務管理体制・専任技術者・財産的基礎・
  欠格要件・誠実性）を入力データから機械的にチェックし、不足点を洗い出す
- **書類生成**: 新規許可申請の優先様式（様式第一号・第二号・第六号・第七号・第八号・
  第十六号の一部＜完成工事原価報告書＞・第二十号の二）の申請内容サマリーをdocxとして
  自動生成（すべて内容確認・下書き用。正式提出様式ではない）
- **更新リマインド計算**: 許可の有効期間満了日（5年）、決算変更届の提出期限（事業年度終了後4ヶ月）を自動計算
- **リマインド・ダイジェスト**: 複数クライアント分のリマインドをまとめて集計し、期限が近い順にレポート化。
  クライアント情報は `data/clients.json`（コミット対象外）にローカル保存
  （実際のメール等自動送信は未実装。送信チャネルの選定が別途必要）
- **インテイク用Webフォーム**: ブラウザから申請者情報を入力し、要件判定と7様式のdocx生成をワンストップで実行
  （ローカルホストのみで動作。外部ネットワークには公開されない）
- **下書き保存・再開**: 入力途中のインテイクフォームを保存し、後から続きを入力できる
- **未入力項目の事前チェック**: 送信前に未入力の項目を一覧表示（送信は妨げない）
- **クライアント一覧のCSVエクスポート/インポート**: 表計算ソフトでの一括確認・バックアップに利用可能
- **都道府県固有ルールの合成の仕組み（M6の土台）**: 対象都道府県が確定した際に
  追加要件を組み込める仕組みを用意（現時点で具体的な要件は未登録。下記参照）
- **経営規模等評価申請書・総合評定値請求書の総括表生成（M9）**: 様式第二十五号の
  十四の総括表サマリーをdocxで自動生成（`npm run gen:youshiki25-14`）。経審は
  新規許可申請とは別の手続きのため、上記の7様式一括生成には含めていない。
  経審の評点計算・別紙一〜三・財務諸表は対象外（ADR-0009）
- **古物商許可モジュール（M11）**: 建設業許可専用だった実装を「許可種別非依存の
  共通コア（`src/core/`）＋許可種別ごとのアドオン（`src/licenses/<種別>/`）」に
  整理した上で、第2のパイロットとして新規実装。欠格事由（古物営業法第4条）・
  営業所/管理者要件（第13条）の判定、許可申請書・誓約書・略歴書のdocx生成、
  変更届・書換申請・許可証返納のリマインドに対応（CLI/スクリプト操作のみ。
  法人申請・Webフォーム対応は対象外。詳細は`docs/DESIGN_kobutsu-core.md`）
- **産業廃棄物収集運搬業許可モジュール**: コアの3例目のアドオンとして新規実装。
  欠格事由（廃棄物処理法第14条第5項第2号）・JWセンター講習修了・経理的基礎
  （直近期の債務超過チェック）・運搬施設要件の判定、許可申請書・事業計画書
  （運搬車両一覧）のdocx生成、許可更新（有効期間5年 or 優良認定で7年。
  施行令第6条の9）・講習修了証期限の2種のリマインドに対応。CLI/スクリプト
  操作のみ（詳細は`docs/DESIGN_sanpai-core.md`）
- **BtoB下請けケース管理ポータル**: 許可種別アドオンではなく、他の行政書士から
  下請けとして受注する業務を管理する独立した業務ドメイン（`src/portal/`）。
  元請行政書士・案件（受注日・納期・報酬・進捗ステータス）の登録・一覧、
  見積書・請求書のdocx生成、納期リマインドに対応。コアの許可レジストリ
  （`registerScheduleFn`）は使わず、docx共通ヘルパーとリマインド表示関数
  （`bucketizeAlerts`等）のみを再利用する設計（詳細は`docs/DESIGN_uketsuke-portal.md`）
- **住宅宿泊事業（民泊）届出モジュール**: コアの4例目のアドオンとして新規実装。
  届出制のため要件判定は「欠格事由（住宅宿泊事業法第4条）の確認」「必要書類の
  充足チェックリスト」「家主居住/不在型の確認」が中心。届出書・誓約書・
  必要書類チェックリストのdocx生成、定期報告（宿泊実績）の次回期限リマインドに
  対応。定期報告は施行規則第12条第2項により毎年2/4/6/8/10/12月15日の暦日
  固定制（届出日や報告実績には依存しない）。CLI/スクリプト操作のみ
  （詳細は`docs/DESIGN_minpaku-core.md`）

詳細な設計方針は [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) を参照。

外部の開発者にソフトウェア開発を委託する場合は、以下のドキュメント一式を参照すること。

- [`docs/PROPOSAL.md`](docs/PROPOSAL.md) — ビジネス背景・開発ロードマップ
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — 要件定義書（建設業許可分）
- [`docs/DESIGN.md`](docs/DESIGN.md) — 技術設計書（建設業許可分。モジュール詳細設計を含む）
- [`docs/REQUIREMENTS_kobutsu-core.md`](docs/REQUIREMENTS_kobutsu-core.md) — 要件定義書（許認可自動化コア抽出＋古物商許可モジュール分）
- [`docs/DESIGN_kobutsu-core.md`](docs/DESIGN_kobutsu-core.md) — 技術設計書（同上）
- [`docs/REQUIREMENTS_sanpai-core.md`](docs/REQUIREMENTS_sanpai-core.md) / [`docs/DESIGN_sanpai-core.md`](docs/DESIGN_sanpai-core.md) — 要件定義書・技術設計書（産業廃棄物収集運搬業許可モジュール分）
- [`docs/REQUIREMENTS_minpaku-core.md`](docs/REQUIREMENTS_minpaku-core.md) / [`docs/DESIGN_minpaku-core.md`](docs/DESIGN_minpaku-core.md) — 要件定義書・技術設計書（住宅宿泊事業届出モジュール分）
- [`docs/REQUIREMENTS_uketsuke-portal.md`](docs/REQUIREMENTS_uketsuke-portal.md) / [`docs/DESIGN_uketsuke-portal.md`](docs/DESIGN_uketsuke-portal.md) — 要件定義書・技術設計書（BtoB下請けケース管理ポータル分）
- [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) — 開発環境構築・コーディング規約・Git運用ガイド
- [`docs/BEST_PRACTICES_AUDIT.md`](docs/BEST_PRACTICES_AUDIT.md) — セキュリティ・CI・リポジトリ運用の棚卸しと今後の推奨事項
- [`docs/adr/`](docs/adr/) — アーキテクチャ決定記録（重要な設計判断の背景）
- [`CHANGELOG.md`](CHANGELOG.md) — マイルストーン単位の変更履歴

## セットアップ

```bash
npm install
npx playwright install chromium   # E2Eテスト用のブラウザバイナリを取得（初回のみ）
git config core.hooksPath hooks   # シークレット混入チェックのpre-commitフックを有効化（初回のみ）
npm run typecheck           # JSDocの型チェック（tsc --noEmit。ビルドは行わない）
npm run lint                # ESLintによる静的チェック（セキュリティ静的解析を含む）
npm test                    # ユニットテスト・アクセシビリティテスト・カオステスト・契約テストを実行
npm run test:coverage       # 行・分岐カバレッジ付きでユニットテストを実行
npm run test:coverage:html  # カバレッジをブラウザで見れるHTMLレポートとして生成（coverage/index.html）
npm run test:mutation       # ミューテーションテスト（Stryker。数分〜数十分かかるため随時実行）
npm run test:e2e            # E2Eテスト（Playwright。実際にブラウザで操作して確認）
npm run test:load           # 負荷テスト（autocannon。同時アクセス下での安定性を確認）
npm run gen:eligibility     # 要件判定のサンプル実行
npm run gen:youshiki1       # 様式第一号サマリーのdocx生成サンプル
npm run gen:youshiki2       # 様式第二号（工事経歴書）サマリーのdocx生成サンプル
npm run gen:youshiki6       # 様式第六号サマリーのdocx生成サンプル
npm run gen:youshiki7       # 様式第七号サマリーのdocx生成サンプル
npm run gen:youshiki8       # 様式第八号サマリーのdocx生成サンプル
npm run gen:youshiki16      # 様式第十六号の一部（完成工事原価報告書）サマリーのdocx生成サンプル
npm run gen:youshiki20-2    # 様式第二十号の二サマリーのdocx生成サンプル
npm run gen:youshiki25-14   # 様式第二十五号の十四（経審の総括表）サマリーのdocx生成サンプル（新規許可申請とは別の任意機能）
npm run gen:reminder-digest # 複数クライアントのリマインド・ダイジェスト出力サンプル（ダミーデータ）
npm run gen:kobutsu-eligibility  # 古物商許可の要件判定サンプル実行
npm run gen:kobutsu-shinseisho   # 古物商許可申請書サマリーのdocx生成サンプル
npm run gen:kobutsu-seiyakusho   # 誓約書サマリーのdocx生成サンプル
npm run gen:kobutsu-rirekisho    # 略歴書サマリーのdocx生成サンプル
npm run gen:sanpai-eligibility        # 産業廃棄物収集運搬業許可の要件判定サンプル実行
npm run gen:sanpai-shinseisho         # 許可申請書サマリーのdocx生成サンプル
npm run gen:sanpai-jigyokeikakusho    # 事業計画書（運搬車両一覧）サマリーのdocx生成サンプル
npm run gen:minpaku-eligibility  # 住宅宿泊事業届出の準備状況確認サンプル実行
npm run gen:minpaku-todokedesho  # 届出書サマリーのdocx生成サンプル
npm run gen:minpaku-seiyakusho   # 誓約書サマリーのdocx生成サンプル
npm run gen:minpaku-checklist    # 必要書類チェックリストのdocx生成サンプル
npm run gen:mitsumorisho             # 下請けポータル: 見積書サマリーのdocx生成サンプル
npm run gen:seikyusho                # 下請けポータル: 請求書サマリーのdocx生成サンプル
npm run gen:portal-reminder-digest   # 下請けポータル: 案件納期リマインドのダイジェスト出力サンプル
```

### 実クライアントのリマインドを管理する

```bash
npm run client:add "サンプル建設株式会社" -- --license-id 般-建築工事業 --grant-date 2021-10-21 --fiscal-year-end 2026-08-31 --contact-email info@example.com  # 登録・更新（建設業許可）
npm run client:remove "サンプル建設株式会社"                                       # 削除
npm run reminders                                                                   # ダイジェストを表示
npm run client:export                          # out/clients-export.csv へCSV出力（バックアップ用）
npm run client:import out/clients-export.csv   # CSVから一括登録・更新
```

データは `data/clients.json`（コミット対象外）にローカル保存される。外部への送信は行わない。
`npm run web` 起動中はブラウザの `/reminders` からも同じ内容を確認できる（表示専用）。

古物商許可のクライアント（書換申請・返納リマインド用の `kobutsuDetail`）・
産廃許可のクライアント（更新・講習修了証期限リマインド用の `sanpaiDetail`）・
民泊届出のクライアント（定期報告リマインド用の `minpakuDetail`）は、
`add-client.js` がまだ対応していないため、`data/clients.json` を直接編集して
`licenseCategory: "kobutsu"` と `kobutsuDetail`（`lastRecordedChangeDateIso`・
`closureDateIso`）、`licenseCategory: "sanpai"` と `sanpaiDetail`
（`validityYears`・`koushuCompletionDateIso`）、または
`licenseCategory: "minpaku"` と `minpakuDetail`（`notificationDateIso`）を
追加すること（`docs/ARCHITECTURE.md` 既知の未実装参照）。
連絡先メールアドレスを登録したクライアントについては、期限が近いリマインドに
「メール下書きを開く」リンクが表示される（クリックすると既定のメールソフトで
下書きが開くだけで、このツール自体がメールを送信することはない）。

生成された `.docx` は `out/`（コミット対象外）に出力される。Microsoft Word や
LibreOffice Writer 等で開いて内容を確認すること。

### BtoB下請けケース管理ポータルを使う

他の行政書士から下請けとして受注した書類作成業務を管理する、許可種別とは
独立した業務ドメイン（`src/portal/`）。許可のリマインド（`npm run reminders`）
とは別のコマンド・別のデータファイル（`data/partners.json`・`data/cases.json`）
として扱う。

```bash
npm run portal:partner-add -- "sample-law-office" "サンプル行政書士法人" --contact-name "田中 次郎" --contact-email tanaka@example.com
npm run portal:case-add -- "case-001" --partner-id sample-law-office --case-name "○○様 建設業許可新規申請 書類作成" --received-date 2026-09-01 --due-date 2026-10-15 --fee 80000 --license-category construction
npm run portal:case-status -- "case-001" 作業中   # ステータス更新（受付/作業中/納品待ち/完了/保留）
npm run portal:reminders                            # 未完了案件の納期リマインドを表示
```

データは `data/partners.json`・`data/cases.json`（いずれもコミット対象外）に
ローカル保存される。外部への送信は行わない。見積書・請求書のdocx生成は
`npm run gen:mitsumorisho`・`npm run gen:seikyusho`（サンプルデータ）を参照。

### Webフォームを使う

```bash
npm run web
# → http://127.0.0.1:3000 をブラウザで開く
```

ブラウザ上で申請者情報を入力して送信すると、要件判定結果と7様式分のdocxが
`out/web/<セッションID>/` に生成され、結果画面からダウンロードできる。
サーバーは `127.0.0.1`（ローカルホスト）のみで待受し、外部ネットワークには公開されない。
ポートは環境変数 `PORT` で変更できる（例: `PORT=4000 npm run web`）。

入力途中で保存したい場合は「下書きとして保存」ボタンを押すと `data/drafts.json`
（コミット対象外）に保存され、`/drafts` の一覧から「続きから入力」で再開できる。
フォーム内には、代表者氏名や役員・専任技術者の氏名など未入力の項目を
一覧表示する枠が表示される（あくまで気づきのための表示で、送信は妨げない）。

## ディレクトリ構成

```
src/
  core/                    許可種別に依存しない共通コア（要件判定の集約・docx共通ヘルパー・
                           リマインドのスケジュール方式レジストリ・クライアント永続化/CSV変換）
  licenses/
    construction/          建設業許可アドオン（法定5要件・都道府県固有ルール合成・8様式のdocx生成・
                           5年更新リマインド）
    kobutsu/               古物商許可アドオン（欠格事由・営業所/管理者要件・3様式のdocx生成・
                           変更届/書換申請リマインド）
    sanpai/                産業廃棄物収集運搬業許可アドオン（欠格事由・講習修了・経理的基礎・
                           運搬施設要件、2様式のdocx生成、更新/講習修了証期限リマインド）
    minpaku/               住宅宿泊事業（民泊）届出アドオン（欠格事由・必要書類チェック・
                           家主居住/不在型の確認、3様式のdocx生成、定期報告リマインド）
  portal/                  BtoB下請けケース管理ポータル（許可種別アドオンではない独立ドメイン。
                           元請行政書士/案件の永続化・見積書/請求書のdocx生成・納期リマインド）
  web/                     インテイク用の簡易Webフォーム（建設業許可のみ。下書き保存含む。
                           ローカルホストのみ）
test/            node --test で実行するユニットテスト（アクセシビリティ・カオス・契約テスト含む）
e2e/             Playwrightで実行するE2Eテスト（実ブラウザでの操作確認）
load/            autocannonで実行する負荷テスト
schemas/         契約テスト用のJSON Schema定義
scripts/         動作確認用サンプルスクリプト
docs/            設計方針・アーキテクチャドキュメント
```

## 次のステップ

- [ ] 実際に活動する都道府県のJCIP対応状況・gBizID要件を確認
- [ ] 対象都道府県の正式様式レイアウト・記載要領を入手し、正式様式に準拠した出力への拡張を検討（M6）
- [ ] 対象都道府県が確定次第、`src/licenses/construction/eligibility/prefectureRules.js` に固有要件を
      登録する（合成の仕組み自体はM6の土台として実装済み。`docs/adr/0005-*.md`）
- [ ] JCIP連携は行政書士登録・対象都道府県確定・仕様書本文の精査が揃うまで着手しない
      （公式ページの所在は調査済み。`docs/adr/0006-*.md`）
- [ ] 更新リマインドの通知チャネル（メール等）を決定し、実際の送信機能を実装
      （M4。集計・ローカル永続化・Web表示は実装済み）
- [ ] 行政書士登録後、実際のケースで試験運用しフィードバックを反映（M5）
