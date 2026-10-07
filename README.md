# kensetsu-kyoka-toolkit

[![Test](https://github.com/satou-aaaaa/sandbox/actions/workflows/test.yml/badge.svg)](https://github.com/satou-aaaaa/sandbox/actions/workflows/test.yml)

建設業許可を皮切りに、許認可・法務系の要件判定・書類生成・更新リマインドを
ソフトウェアで仕組み化するツールキット（開発中）。現在は建設業許可・古物商許可
ほか許可種別ごとのアドオン9種と、許可種別に依存しない独立ドメイン3種を実装している
（一覧は [できること](#できること現時点) を参照）。

行政書士を副業として行うにあたり、「自分の関与を最終レビューと押印だけに絞り込む」ことを
目標に開発している。経緯・市場調査・分野選定の理由は非公開のメモ（Obsidian Vault）に
残しており、本リポジトリには含まれない。

> ⚠ 行政書士は登録制の独占業務です。試験合格・行政書士会への登録が完了するまで、
> このツールを使って有償で書類作成・提出代理を行うことはできません。
> 現段階ではあくまで「登録後すぐに使える状態を準備しておく」ための開発です。

> ℹ️ 本リポジトリは公開リポジトリです。ライセンスは `package.json` の
> `"license": "UNLICENSED"` のとおり（LICENSEファイルを設置していないため
> 著作権法上の権利は既定ですべて留保されます）。外部からの再利用・
> Issue・Pull Requestの受け入れは想定していません（脆弱性報告のみ
> [`SECURITY.md`](SECURITY.md) の手順で受け付けます）。

## できること（現時点）

共通の骨組み（許可種別によらず概ね共通）:

- **要件判定エンジン**: 許可種別ごとの法定要件を入力データから機械的にチェックし、不足点を洗い出す
- **書類生成**: 申請内容サマリーをdocxとして自動生成（すべて内容確認・下書き用。正式提出様式ではない）
- **更新リマインド・ダイジェスト**: 満了日・提出期限を自動計算し、複数クライアント分をまとめて
  期限が近い順にレポート化。クライアント情報は `data/clients.json` 等（コミット対象外）にローカル保存
  （実際のメール等自動送信は未実装。連絡先登録済みなら下書きを開くリンクを表示するのみ）
- **インテイク用Webフォーム**: 対応する許可種別（下表参照）はブラウザから入力・下書き保存・
  未入力項目の事前チェック・書類生成をワンストップで実行可能（ローカルホストのみで動作）
- **クライアント一覧のCSVエクスポート/インポート**: 表計算ソフトでの一括確認・バックアップに利用可能

建設業許可では、対象都道府県確定時に固有要件を追加できる合成の仕組み（現時点で具体的な要件は
未登録。[次のステップ](#次のステップ)参照）も用意している。

### モジュール一覧

許可種別ごとのアドオン（`src/licenses/`）:

| モジュール | 概要 | ドキュメント |
|---|---|---|
| 建設業許可 | 法定5要件（経営業務管理体制・専任技術者・財産的基礎・欠格要件・誠実性）の判定、8様式のdocx生成（経審用の様式第二十五号の十四を含む）、5年更新＋決算変更届リマインド、Webフォーム対応 | [DESIGN.md](docs/DESIGN.md) / [REQUIREMENTS.md](docs/REQUIREMENTS.md) |
| 古物商許可 | 欠格事由（古物営業法第4条）・営業所/管理者要件（第13条）の判定、3様式のdocx生成、変更届/書換申請/許可証返納リマインド、Webフォーム対応（個人申請のみ。法人は欠格判定のみ対応） | [DESIGN_kobutsu-core.md](docs/DESIGN_kobutsu-core.md) |
| 産業廃棄物収集運搬業許可 | 欠格事由・講習修了・経理的基礎・運搬施設要件の判定、2様式のdocx生成、更新（5年/優良認定7年）・講習修了証期限リマインド | [DESIGN_sanpai-core.md](docs/DESIGN_sanpai-core.md) |
| 住宅宿泊事業（民泊）届出 | 欠格事由（住宅宿泊事業法第4条）・必要書類充足チェック、3様式のdocx生成、定期報告（暦日固定）リマインド | [DESIGN_minpaku-core.md](docs/DESIGN_minpaku-core.md) |
| 在留資格「技術・人文知識・国際業務」 | 学歴/実務経験・報酬要件の判定、2様式のdocx生成、在留期間満了リマインド。専門性・リスクが高い分野のため強調文言を全出力に付与 | [DESIGN_gijinkoku-core.md](docs/DESIGN_gijinkoku-core.md) |
| 経営事項審査（経審） | 建設業許可保有の確認、評価項目の入力完備性チェック（評点計算なし）、3様式のdocx生成、年次反復型リマインド。同一クライアントの建設業許可を参照 | [DESIGN_keiei-jiko-shinsa-core.md](docs/DESIGN_keiei-jiko-shinsa-core.md) |
| 農地転用許可 | 立地基準（自己申告に基づく一次判定）/一般基準の判定、2様式のdocx生成、条件履行期限型リマインド、Webフォーム対応 | [DESIGN_nouchi-tenyo-core.md](docs/DESIGN_nouchi-tenyo-core.md) |
| 飲食店営業許可 | 施設基準/食品衛生責任者設置要件の判定、2様式のdocx生成、可変期間（自治体ごとに5〜8年）満了リマインド | [DESIGN_inshokuten-eigyo-core.md](docs/DESIGN_inshokuten-eigyo-core.md) |
| 特定技能1号 | 対象19分野の分野別判定（技能水準/日本語能力/所属機関基準/支援体制）、3様式のdocx生成、在留期間満了＋通算5年上限接近警告リマインド。gijinkoku同様、強調文言を全出力に付与 | [DESIGN_tokutei-ginou-core.md](docs/DESIGN_tokutei-ginou-core.md) |

許可種別アドオンではない独立ドメイン:

| モジュール | 概要 | ドキュメント |
|---|---|---|
| BtoB下請けケース管理ポータル | 元請行政書士・案件の管理、見積書・請求書のdocx生成、納期リマインド、月次請求サマリー生成 | [DESIGN_uketsuke-portal.md](docs/DESIGN_uketsuke-portal.md) |
| 会社設立サポート | 定款・発起人決定書（合同会社は代表社員の互選書）サマリーのdocx生成、定款認証予約日/払込期限リマインド。登記申請書（司法書士の独占業務）は対象外 | [DESIGN_kaisha-secchi-support.md](docs/DESIGN_kaisha-secchi-support.md) |
| 相続関連（遺言書・遺産分割協議書）支援 | 法定相続人・法定相続分の自動計算（民法900条・901条）、財産目録/協議書/自筆証書遺言文案のdocx生成、相続放棄/相続税申告/遺留分侵害額請求の期限リマインド。争いの有無等の法的評価は自動判定しない | [DESIGN_souzoku-support.md](docs/DESIGN_souzoku-support.md) |

各モジュールの法令根拠・判定ロジックの詳細は、上表のリンク先（`docs/DESIGN_*.md`・
対になる`docs/REQUIREMENTS_*.md`）を参照。全体のアーキテクチャ方針は
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) を参照。

外部の開発者にソフトウェア開発を委託する場合は、以下のドキュメントもあわせて参照すること。

- [`docs/PROPOSAL.md`](docs/PROPOSAL.md) — ビジネス背景・開発ロードマップ
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
npm run test:bdd            # Gherkin/BDDシナリオを実行（Cucumber.js。features/。ADR-0016参照）
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
npm run gen:portal-monthly-seikyusho # 下請けポータル: 月次請求サマリーのdocx生成サンプル
npm run gen:incorporation-teikan             # 会社設立サポート: 定款サマリー（株式会社・合同会社）のdocx生成サンプル
npm run gen:incorporation-hokininketteisho   # 会社設立サポート: 発起人決定書サマリーのdocx生成サンプル
npm run gen:incorporation-daihyoshaingosensho # 会社設立サポート: 代表社員の互選書サマリー（合同会社）のdocx生成サンプル
npm run gen:incorporation-reminder-digest    # 会社設立サポート: 定款認証予約日/払込期限リマインドのダイジェスト出力サンプル
npm run gen:succession-heirs                 # 相続支援: 法定相続人・法定相続分の試算サンプル実行
npm run gen:succession-documents             # 相続支援: 財産目録/遺産分割協議書/自筆証書遺言文案のdocx生成サンプル
npm run gen:gijinkoku-eligibility        # 技人国ビザの要件判定サンプル実行
npm run gen:gijinkoku-ninteishinseisho   # 認定証明書交付申請書サマリーのdocx生成サンプル
npm run gen:gijinkoku-henkoshinseisho    # 在留資格変更許可申請書サマリーのdocx生成サンプル
npm run gen:gijinkoku-checklist          # 添付書類チェックリストのdocx生成サンプル
npm run gen:keiei-jiko-shinsa-eligibility  # 経審の準備状況確認サンプル実行
npm run gen:keiei-jiko-shinsa-keieikibo    # 経営規模等評価申請書サマリーのdocx生成サンプル
npm run gen:keiei-jiko-shinsa-bunseki      # 経営状況分析申請書サマリーのdocx生成サンプル
npm run gen:keiei-jiko-shinsa-checklist    # 必要書類チェックリストのdocx生成サンプル
npm run gen:nouchi-tenyo-eligibility      # 農地転用許可の要件判定サンプル実行
npm run gen:nouchi-tenyo-shinseisho       # 許可申請書サマリーのdocx生成サンプル
npm run gen:nouchi-tenyo-jigyokeikakusho  # 事業計画書（資金調達内訳）サマリーのdocx生成サンプル
npm run gen:inshokuten-eigyo-eligibility  # 飲食店営業許可の要件判定サンプル実行
npm run gen:inshokuten-eigyo-shinseisho   # 営業許可申請書サマリーのdocx生成サンプル
npm run gen:inshokuten-eigyo-checklist    # 添付書類チェックリスト・手続きの流れ案内のdocx生成サンプル
npm run gen:tokutei-ginou-eligibility        # 特定技能1号の要件判定サンプル実行
npm run gen:tokutei-ginou-ninteishinseisho   # 認定申請書サマリーのdocx生成サンプル
npm run gen:tokutei-ginou-henkoshinseisho    # 在留資格変更許可申請書サマリーのdocx生成サンプル
npm run gen:tokutei-ginou-shienkeikakusho    # 支援計画書サマリーのdocx生成サンプル
npm run gen:tokutei-ginou-checklist          # 添付書類チェックリストのdocx生成サンプル
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

古物商許可・産廃許可・民泊届出・技人国ビザのクライアント（各`<種別>Detail`が
リマインド計算の起点になる）は、`add-client.js` の `--license-category` と
種別ごとの詳細フラグ（`--kobutsu-*`・`--sanpai-*`・`--minpaku-*`・
`--gijinkoku-*`。使い方はスクリプト冒頭のコメント参照）で登録できる。
建設業許可以外を指定する場合、`--grant-date` は種別によっては不要
（建設業許可・産廃許可のみ必須。他の種別は`<種別>Detail`の日付が
リマインドの起点のため）。

```bash
npm run client:add -- "サンプル質店" --license-id 古物商 --license-category kobutsu --kobutsu-last-change-date 2026-09-01
```
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
npm run portal:case-status -- "case-001" 完了 2026-09-18   # ステータス更新（受付/作業中/納品待ち/完了/保留）。完了時は完了日を指定（省略時は本日）
npm run portal:reminders                            # 未完了案件の納期リマインドを表示
npm run portal:monthly-seikyusho -- "sample-law-office" 2026-09   # 指定した元請の当月完了分をまとめた月次請求サマリーをdocx生成
```

データは `data/partners.json`・`data/cases.json`（いずれもコミット対象外）に
ローカル保存される。外部への送信は行わない。見積書・請求書のdocx生成は
`npm run gen:mitsumorisho`・`npm run gen:seikyusho`、月次請求サマリーは
`npm run gen:portal-monthly-seikyusho`（いずれもサンプルデータ）を参照。

### 会社設立サポートモジュールを使う

株式会社・合同会社の設立に際して必要な定款・発起人決定書の記載内容
サマリー生成、定款認証予約日・出資金払込期限のリマインドを行う、
BtoB下請けポータルと同じく許可種別とは独立した業務ドメイン
（`src/incorporation/`）。**設立登記の申請は司法書士の独占業務であり、
本モジュールは対象としない**（登記申請書に類する様式は一切生成しない）。

```bash
npm run incorporation:case-add -- "case-001" --client-name "サンプル太郎" --company-type 株式会社 --company-name "サンプル商事株式会社" --purpose "ソフトウェアの開発及び販売" --head-office "東京都サンプル区" --capital 3000000 --founder "サンプル太郎:東京都サンプル区1-2-3:3000000:30"
npm run incorporation:reminders                     # 未完了案件の定款認証予約日/払込期限リマインドを表示
```

データは `data/incorporation-cases.json`（コミット対象外）にローカル保存
される。外部への送信は行わない。定款・発起人決定書・代表社員の互選書
サマリーのdocx生成は`npm run gen:incorporation-teikan`・
`npm run gen:incorporation-hokininketteisho`・
`npm run gen:incorporation-daihyoshaingosensho`（サンプルデータ）を参照。

### 相続関連（遺言書・遺産分割協議書）支援モジュールを使う

法定相続人・法定相続分の自動計算（民法900条・901条）、相続税の基礎控除額
の目安表示（相続税法15条）、財産目録・遺産分割協議書・自筆証書遺言文案の
docx生成、相続放棄・相続税申告・遺留分侵害額請求の期限リマインドを行う、
許可種別とは独立した業務ドメイン（`src/succession/`）。**相続人間の争いの
有無は自動判定しません**。必ず人手で確認した結果を`--has-dispute`で
記録してください。**相続税額そのものの計算・申告は税理士の職域**であり、
基礎控除額の目安表示はあくまで参考値です。

```bash
npm run succession:case-add -- "case-001" --death-date 2026-06-01 --case-label "サンプル家 相続手続き" --has-spouse true --spouse-alive true --child "child-1:長男:生存" --child "child-2:長女:生存"
npm run succession:reminders                        # 未完了案件の相続放棄/相続税申告/遺留分侵害額請求の期限リマインドを表示
```

データは `data/succession-cases.json`（コミット対象外）にローカル保存
される。外部への送信は行わない。マイナンバー等の機微個人情報は入力
データモデル自体に存在しない。財産目録・協議書・自筆証書遺言文案の
docx生成は `npm run gen:succession-documents`（サンプルデータ）を参照。

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

### 古物商許可のWebフォームを使う

```bash
npm run web
# → http://127.0.0.1:3000/kobutsu をブラウザで開く
```

建設業許可のフォーム（`/`）のヘッダーにあるリンクからも遷移できる。
個人申請のみに対応（法人申請〈役員一覧〉の入力UIは、書類生成側が
法人申請に未対応のため意図的に設けていない）。送信すると要件判定結果と
許可申請書・誓約書・略歴書の3様式分のdocxが生成され、結果画面から
ダウンロードできる。下書き保存機能（`/drafts`）も建設業許可と共通で
利用できる（`DraftRecord.licenseCategory`で許可種別を判別する。
2026年9月・#73）。

### 農地転用許可のWebフォームを使う

```bash
npm run web
# → http://127.0.0.1:3000/nouchi-tenyo をブラウザで開く
```

建設業許可のフォーム（`/`）のヘッダーにあるリンクからも遷移できる。
送信すると要件判定結果と農地転用許可申請書・事業計画書の2様式分のdocxが
生成され、結果画面からダウンロードできる。下書き保存機能（`/drafts`）も
建設業許可・古物商許可と共通で利用できる。

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
    gijinkoku/             在留資格「技術・人文知識・国際業務」申請支援アドオン（学歴/実務経験・
                           報酬要件の判定、専攻/職務関連性の自己申告確認、2様式のdocx生成、
                           在留期間満了リマインド。一次スクリーニングの強調文言を全出力に付与）
    keiei-jiko-shinsa/     経営事項審査（経審）申請支援アドオン（建設業許可保有の確認、
                           評価項目の入力完備性チェック〈評点計算はしない〉、3様式のdocx生成、
                           年次反復型の有効期限リマインド。同一クライアントの建設業許可を参照する）
    nouchi-tenyo/          農地転用許可アドオン（立地基準/一般基準の判定、2様式のdocx生成、
                           工事着手/完了報告期限を追跡する「条件履行期限型」リマインド）
    inshokuten-eigyo/      飲食店営業許可アドオン（施設基準/食品衛生責任者設置要件の判定、
                           2様式のdocx生成、可変期間〈5〜8年〉の満了リマインド。HACCPは
                           許可要件ではなく継続義務である旨を全出力に明記）
    tokutei-ginou/         特定技能1号申請支援アドオン（対象19分野の分野別サブレジストリ、
                           技能水準/日本語能力/所属機関基準/支援体制の判定、3様式の
                           docx生成、在留期間満了＋通算5年上限接近警告のリマインド。
                           一次スクリーニングの強調文言を全出力に付与）
  portal/                  BtoB下請けケース管理ポータル（許可種別アドオンではない独立ドメイン。
                           元請行政書士/案件の永続化・見積書/請求書のdocx生成・納期リマインド）
  incorporation/           会社設立サポート（許可種別アドオンではない独立ドメイン。定款/
                           発起人決定書サマリーのdocx生成・定款認証予約日/払込期限リマインド。
                           登記申請〈司法書士の独占業務〉に類する様式は一切実装しない）
  succession/              相続関連（遺言書・遺産分割協議書）支援（許可種別アドオンでも
                           要件判定でもない独立ドメイン。法定相続人・法定相続分の自動計算
                           〈民法900条・901条〉、財産目録/協議書/自筆証書遺言文案のdocx生成、
                           相続放棄/相続税申告/遺留分侵害額請求の期限リマインド。争いの
                           有無等の法的評価は自動判定しない）
  web/                     インテイク用の簡易Webフォーム（建設業許可・古物商許可・
                           農地転用許可対応。3許可種別とも下書き保存に対応。
                           ローカルホストのみ）
test/            node --test で実行するユニットテスト（アクセシビリティ・カオス・契約テスト含む）
e2e/             Playwrightで実行するE2Eテスト（実ブラウザでの操作確認）
load/            autocannonで実行する負荷テスト
schemas/         契約テスト用のJSON Schema定義
scripts/         動作確認用サンプルスクリプト
agent/           Issue自律処理ループ（Agent SDK）。開発運用ツールでアプリ本体ではない。
                 依存は agent/package.json に分離。PR作成・リスクに応じた自動マージ・事後リバート。押印/提出は人手（ADR-0017）
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
