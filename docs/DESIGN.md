# 設計書 — kensetsu-kyoka-toolkit（建設業許可 自動化ツールキット）

version: 0.1 / 2026-09 作成
対応する要件: `docs/REQUIREMENTS.md`

## 1. 設計原則

開発を委託する上で、以下の原則は**変更してはならない前提**として扱うこと。
変更が必要だと考えた場合は、実装を進める前に発注者に確認すること。

1. **人手レビューを唯一の必須ステップとして残す**: ④人手レビュー・職印押印の工程を
   自動化・省略する機能（自動押印、自動提出など）を追加しない。判定結果・生成書類には
   常に「最終確認は行政書士本人が行う」ことが分かる表示・注記を含める。
2. **ビルドレス構成を維持する**: TypeScriptのコンパイルステップを導入しない。
   型情報はJSDocコメントで表現し、`node` コマンドで直接実行できる状態を保つ。
3. **外部送信をしない**: 顧客の個人情報・財務情報を扱うため、これらをローカル環境の
   外へ送信する処理（HTTPリクエスト等）を、明示的な要件がない限り実装しない。
4. **法令根拠を明記する**: 判定ロジック・期限計算ロジックには、根拠となる法令・
   公式情報源へのURLをコメントとして残す。

## 2. 全体アーキテクチャ

```
① インテイク（顧客からの情報収集）
        ↓
② 要件判定エンジン（src/eligibility/）
        ↓  ← ここで不足があれば申請前に顧客へフィードバック
③ 書類自動生成（src/documents/）
        ↓
④ 人手レビュー・職印押印 ★唯一、自動化できない必須ステップ
        ↓
⑤ 提出（JCIP電子申請 or 印刷パッケージ）
        ↓
⑥ 更新リマインドエンジン（src/reminders/）→ ①へ戻る（次回更新・決算変更届）
```

②③⑥が本プロジェクトの実装対象。①④⑤は行政書士本人（発注者）が人手で行う工程であり、
ソフトウェアの対象範囲外（①のうちデータ入力の型・受け渡し方法のみが実装対象）。

## 3. ディレクトリ構成

```
src/
  eligibility/
    types.js          申請者データのJSDoc型定義（唯一の情報源）
    engine.js          5要件をまとめて判定し、総合結果とレポートを生成
    rules/
      keieiGyomuKanri.js    要件1: 経営業務管理体制
      senninGijutsusha.js   要件2: 専任技術者（営業所単位）
      zaisanKiso.js         要件3: 財産的基礎
      kekkaku.js             要件4: 欠格要件
      seijitsusei.js         要件5: 誠実性
  documents/
    common.js           様式生成モジュール共通のdocxヘルパー（見出し・注記・表・箇条書き）
    youshiki1.js        様式第一号のdocx生成
    youshiki6.js        様式第六号（役員等の一覧表）のdocx生成
    youshiki7.js        様式第七号（経営業務管理責任者証明書）のdocx生成
    youshiki8.js        様式第八号（専任技術者証明書）のdocx生成（営業所ごとにセクション分け）
    youshiki20-2.js     様式第二十号の二（誓約書）のdocx生成
  reminders/
    renewalSchedule.js  5年更新・決算変更届の期限計算
    reminderDigest.js   複数クライアントのリマインドを集計・整形（M4の土台。送信は行わない）
    clientStore.js      クライアント情報をdata/clients.jsonへ読み書きするローカル永続化層
  web/
    server.js           インテイク用の簡易Webフォーム（M3）のHTTPサーバー
    formPage.js          入力フォーム画面（HTML/CSS/JS）
    resultPage.js         判定結果・生成書類ダウンロード画面
    reminderPage.js       登録済みクライアントのリマインド・ダイジェスト表示画面（読み取り専用）
    htmlUtils.js          HTMLエスケープ等の共通ヘルパー
test/
  eligibility.test.js    要件判定エンジンのユニットテスト
  renewalSchedule.test.js 期限計算のユニットテスト
  reminderDigest.test.js  リマインド・ダイジェストのユニットテスト
  clientStore.test.js     クライアント永続化層のユニットテスト
  documents.test.js      書類生成モジュール（様式第一号・六号・七号・八号・二十号の二）のユニットテスト
  web.test.js            Webフォームサーバーの結合テスト
scripts/
  sampleProfile.js                書類生成サンプル共通のダミー ApplicantProfile
  generate-eligibility-sample.js  要件判定のサンプル実行
  generate-youshiki1-sample.js    様式第一号サマリーのdocx生成サンプル
  generate-youshiki6-sample.js    様式第六号サマリーのdocx生成サンプル
  generate-youshiki7-sample.js    様式第七号サマリーのdocx生成サンプル
  generate-youshiki8-sample.js    様式第八号サマリーのdocx生成サンプル
  generate-youshiki20-2-sample.js 様式第二十号の二サマリーのdocx生成サンプル
  generate-reminder-digest-sample.js 複数クライアントのリマインド・ダイジェスト出力サンプル（ダミーデータ）
  add-client.js                   実クライアントをdata/clients.jsonへ登録・更新するCLI
  remove-client.js                実クライアントをdata/clients.jsonから削除するCLI
  reminder-digest.js               data/clients.jsonの実クライアントについてダイジェストを表示するCLI
docs/
  ARCHITECTURE.md   アーキテクチャ方針の要約（本書のダイジェスト版）
  PROPOSAL.md       ビジネス背景・ロードマップ
  REQUIREMENTS.md   要件定義書
  DESIGN.md         本書
  DEVELOPMENT_GUIDE.md  開発環境構築・コーディング規約・Git運用
```

## 4. データモデル

すべての型は `src/eligibility/types.js` にJSDoc `@typedef` として定義されている。
**この型定義がデータモデルの唯一の正（single source of truth）であり、
様式生成モジュールを含む全モジュールがこの型を再利用する。様式ごとに
個別の入力型を新設しないこと**（FR-2.7 に対応）。

### 4.1 ApplicantProfile（申請者の総合入力データ）

| フィールド | 型 | 説明 |
|---|---|---|
| applicantName | string | 申請者名（会社名 or 個人名） |
| keieiGyomuKanri | KeieiGyomuKanriInput | 経営業務管理体制の入力 |
| senninGijutsushaList | SenninGijutsushaInput[] | 営業所ごとの専任技術者情報 |
| zaisanKiso | ZaisanKisoInput | 財産的基礎の入力 |
| kekkaku | KekkakuInput | 欠格要件の入力 |
| seijitsusei | SeijitsuseiInput | 誠実性の入力 |
| representativeName | string（任意） | 代表者氏名（M2で書類生成用に追加） |
| address | string（任意） | 主たる営業所の所在地（M2で書類生成用に追加） |
| prefecture | string（任意） | 許可行政庁となる都道府県名（M2で書類生成用に追加） |
| applicationDate | string（任意） | 申請年月日（YYYY-MM-DD。M2で書類生成用に追加） |
| constructionTypes | string[]（任意） | 許可を受けようとする建設業の種類（M2で書類生成用に追加） |
| officers | OfficerInput[]（任意） | 役員等の一覧（M2・様式第六号用に追加） |

全体の許可区分（一般/特定）は様式生成時、`zaisanKiso.licenseType` を正として用いる
（申請全体で1つの区分に定まるため、様式ごとに別フィールドへ二重定義しない）。

`keieiGyomuKanri` には様式第七号用に `responsibleName`（証明を受ける者の氏名）・
`responsibleTitle`（地位又は役名）を、`senninGijutsushaList` の各要素には
様式第八号用に `personName`（当該営業所の専任技術者氏名）を、それぞれ
オプションフィールドとして追加している（既存フィールドの意味は変更していない）。

### 4.2 KeieiGyomuKanriInput

| フィールド | 型 | 説明 |
|---|---|---|
| yearsAsResponsibleOfficer | number | 経営業務管理責任者としての経験年数 |
| yearsAsQuasiResponsibleOfficer | number | 準ずる地位での経験年数 |
| yearsAsAssistant | number | 補佐する業務での経験年数 |
| isOfficerFor2Years | boolean | 直近2年以上、常勤役員等の地位にあるか |
| assistantSupportYears | {finance, labor, operations: number} | 財務・労務・運営の補佐者配置年数 |
| hasSocialInsurance | boolean | 社会保険（健保・厚生年金・雇用保険）加入の有無 |

### 4.3 SenninGijutsushaInput（営業所単位）

| フィールド | 型 | 説明 |
|---|---|---|
| officeName | string | 対象営業所名 |
| licenseType | "一般" \| "特定" | 許可区分 |
| hasNationalLicense | boolean | 該当国家資格等の保有有無 |
| isDesignatedCourseGraduate | boolean | 指定学科卒業か |
| educationLevel | "高卒" \| "大卒" \| "その他" \| null | 学歴区分 |
| yearsOfPracticalExperience | number | 指定学科卒業者としての実務経験年数 |
| yearsOfGeneralExperience | number | 学歴不問の実務経験年数（10年要件用） |
| yearsOfSupervisoryExperience | number | 指導監督的実務経験年数（特定建設業用） |

### 4.4 ZaisanKisoInput

| フィールド | 型 | 説明 |
|---|---|---|
| licenseType | "一般" \| "特定" | 許可区分 |
| netAssets | number | 自己資本額（円） |
| fundingCapacity | number | 資金調達能力（円） |
| hasFiveYearsContinuousOperation | boolean | 直近5年間の継続営業実績有無 |
| capitalAmount | number | 資本金の額（円。特定建設業判定用） |
| deficitRatio | number | 欠損の額 ÷ 資本金（%。特定建設業判定用） |
| currentRatio | number | 流動比率（%。特定建設業判定用） |

### 4.5 KekkakuInput（欠格要件・6フラグ）

`isUndischargedBankrupt` / `hadLicenseRevokedWithin5Years` /
`hasCriminalRecordWithin5Years` / `isBoryokudanMemberOrWithin5Years` /
`hasMentalImpairmentAffectingDuties` / `hasFalseOrOmittedStatement`
（すべて boolean。1つでも true なら不合格）

### 4.6 SeijitsuseiInput

`hasNoDishonestActRisk`（boolean）、`notes`（string, 任意）

### 4.7 共通の出力型

- **RequirementCheckResult**: `{key, label, passed, reasons[], warnings[]}` — 個別要件の判定結果
- **EligibilityResult**: `{eligible, checks: RequirementCheckResult[], blockingIssues[]}` — 総合判定結果

様式生成モジュールもこの `RequirementCheckResult` 形式に準じたログ・警告表現を
踏襲すること（一貫性のため）。

## 5. モジュール詳細設計

### 5.1 `src/eligibility/rules/keieiGyomuKanri.js` — 経営業務管理体制

令和2年10月の建設業法改正により、単一の「経営業務管理責任者」要件から
複数の経験パスで満たせる要件に緩和されている。4つの独立したルート（OR条件）＋
社会保険加入（AND条件、必須）で判定する。

| ルート | 条件 |
|---|---|
| A | 経営業務管理責任者としての経験が5年以上 |
| B | 準ずる地位（経営権限の委任を受けた者等）としての経験が5年以上 |
| C | 補佐する業務としての経験が6年以上 |
| D | 直近2年以上役員等の地位 **かつ** 財務・労務・運営の補佐者をそれぞれ5年以上配置 |

判定式: `(A or B or C or D) and hasSocialInsurance`

ルートDが該当した場合、組織図・辞令等の裏付け書類が必要である旨の warning を返す。

### 5.2 `src/eligibility/rules/senninGijutsusha.js` — 専任技術者

営業所ごとに判定し（`checkSenninGijutsushaForOffice`）、全営業所の結果を
`checkSenninGijutsusha` で集約する（1つでも不合格な営業所があれば全体も不合格）。

判定順序（優先順にOR評価）:

1. 該当する国家資格等を保有 → 即合格
2. 指定学科卒業 **かつ** （高卒で実務経験5年以上 **または** 大卒で実務経験3年以上）
3. 学歴不問の実務経験が10年以上

上記いずれかを満たし、かつ `licenseType === "特定"` の場合は追加で
「指導監督的実務経験（4,500万円以上の工事）2年以上」が必須（この条件を
満たさない場合、他の条件を満たしていても全体としては不合格になる）。

合格した営業所には、資格者証・卒業証明書・実務経験証明書等の
裏付け書類準備を促す warning を必ず付与する。

### 5.3 `src/eligibility/rules/zaisanKiso.js` — 財産的基礎

`licenseType` によって判定方法が完全に分岐する。

- **一般建設業**（3ルートのOR）:
  - 自己資本500万円以上
  - 資金調達能力500万円以上
  - 直近5年間の継続営業実績
- **特定建設業**（3条件すべてのAND、一般より厳格）:
  - 欠損比率（欠損額 ÷ 資本金）が20%以下
  - 流動比率が75%以上
  - 資本金2,000万円以上 **かつ** 自己資本4,000万円以上

一般と特定で「OR条件」と「AND条件」という判定方式そのものが異なる点が
本モジュールの実装上の要注意点。特定建設業の場合は、3条件それぞれの
合否を個別に reasons に出力し、どの条件で不合格になったかが分かるようにしている。

### 5.4 `src/eligibility/rules/kekkaku.js` — 欠格要件

6項目のネガティブリスト形式。1つでも該当すれば不合格。新規の様式・要件を
追加する際にこの形式（フラグ配列 → filter → 該当項目を reasons に列挙）は
横展開しやすいパターンなので踏襲すること。

### 5.5 `src/eligibility/rules/seijitsusei.js` — 誠実性

定量的に判定できない性質上、自己申告フラグ（`hasNoDishonestActRisk`）を
そのまま合否に反映しつつ、**合格した場合でも必ず** 「本ツールの結果を
鵜呑みにせず本人が個別確認すること」という warning を付与する設計。
このパターン（機械判定に限界がある要件では、結果によらず注意喚起を出す）は
他の主観的要件を追加する場合にも踏襲すること。

### 5.6 `src/eligibility/engine.js` — 統合エンジン

5つのルールモジュールを呼び出し、`checks` 配列にまとめ、
`eligible = checks.every(passed)` で総合判定する。`blockingIssues` は
不合格の要件についてラベルと理由を結合した文字列の配列。

`formatEligibilityReport` はMarkdown風のプレーンテキストレポートを生成する
（CLI表示・ログ・議事メモ用）。書類生成モジュール（5.8節）はこのレポートとは
別に、docx形式で出力する点に注意（テキストレポートとdocxは別の出力経路）。

### 5.7 `src/reminders/renewalSchedule.js` — 更新リマインド

- `addMonthsClamped(date, months)`（非公開ヘルパー）: 日付にUTC基準で月単位の
  オフセットを加算する。対象月に同じ日が存在しない場合（例: 1/31 + 1ヶ月は
  2月31日が存在しない）は対象月の**末日に丸める**。`Date.setMonth()` を
  素朴に使うと月がロールオーバーする既知のバグ（例: 12/31 + 4ヶ月が
  誤って5/1になる）があり、これを避けるために導入されている。
  **今後、期限計算ロジックを追加・変更する場合は、必ずこの関数を再利用し、
  同様のロールオーバーバグを作り込まないこと。**
- `calcLicenseExpiry(grantDateIso)`: 許可年月日+5年の前日（法令上「5年を
  経過する日の前日まで」が有効期間であるため、`-1日` する）
- `calcRenewalSchedule(grantDateIso)`: 満了日、60日前（準備開始推奨日）、
  30日前（最終締切）の3点セットを返す
- `calcKessanHenkoDeadline(fiscalYearEndIso)`: 事業年度終了日+4ヶ月
- `daysUntil(targetDateIso, fromDateIso?)`: 基準日から対象日までの残り日数
  （通知バッチ処理での「残り30日を切ったら送る」等の判定に使う想定）

日付はすべてUTC基準の `Date` オブジェクトで内部計算し、入出力は
`YYYY-MM-DD` のISO文字列に統一している。タイムゾーンに起因するズレを
避けるための意図的な設計であり、ローカルタイムでの `Date` 生成
（例: `new Date("2026-01-01")` をブラウザのローカルタイムとして解釈させる等）
に変更しないこと。

### 5.8 `src/documents/common.js` — 様式生成モジュール共通ヘルパー（M2で追加）

`docx` ライブラリを使い、A4サイズの `Document` を組み立てて `.docx` として
書き出す処理・見た目（グレー見出しの2列表、赤字の注記、警告付き箇条書き等）を
共通化したモジュール。すべての様式生成モジュールはここから
`buildTitleHeading` / `buildDisclaimerParagraph` / `buildLabeledTable` /
`buildBulletList` / `orNotEntered` / `writeDocxFile` 等を再利用し、
同じ見た目・同じ「未入力」判定ロジックのコードを様式ごとにコピーしない。

`writeDocxFile` は出力先ディレクトリ（`out/` 等）が存在しない場合に
自動作成してから書き込む。

### 5.9 様式生成モジュール（`src/documents/youshiki*.js`）

`docx` の `Document` を組み立てて `.docx` として書き出す。現状のスコープは
「正式様式のレイアウト再現」ではなく、「申請内容サマリー（下書き・確認用の
表形式）」であることが明記されている（ファイル冒頭のコメントおよび
生成される文書内の赤字注記の両方、`common.js` の `buildDisclaimerParagraph` により統一）。

各モジュールは `build<様式名>Document(profile)` と
`write<様式名>Docx(profile, outPath)` の2関数構成に統一している
（構築とI/Oの分離により、テストのしやすさ・将来的な出力形式の追加
（PDF化等）に対応しやすくしている）。入力はすべて要件判定エンジンと同じ
`ApplicantProfile` 型（FR-2.7 対応。§4.1参照）。

| モジュール | 対応様式 | 実装のポイント |
|---|---|---|
| `youshiki1.js` | 様式第一号（建設業許可申請書） | 基本情報の2列表のみ。`resolveYoushiki1Rows(profile)` で表示行を解決する純粋関数を分離しテスト容易性を確保 |
| `youshiki6.js` | 様式第六号（役員等の一覧表） | `profile.officers[]` を1名につき氏名・役名・生年月日の3行に展開。0件の場合はその旨の1行を返す |
| `youshiki7.js` | 様式第七号（経営業務管理責任者証明書） | `checkKeieiGyomuKanri` を再利用し、判定結果（`RequirementCheckResult`）の reasons/warnings をそのまま箇条書き表示。判定ロジックを再実装しない |
| `youshiki8.js` | 様式第八号（専任技術者証明書） | `senninGijutsushaList` の営業所ごとに `checkSenninGijutsushaForOffice` を呼び、見出し＋表＋根拠のセクションを繰り返す。正式提出は営業所ごとに分割する必要がある旨をコメントで明記 |
| `youshiki20-2.js` | 様式第二十号の二（誓約書） | `checkKekkaku` を再利用。本ツールが確認するのは欠格要件6項目のみで、建設業法第8条全14号の確認は行政書士本人が行う旨を警告として明示 |

いずれのモジュールも、判定ロジック（合否・reasons・warnings）は
`src/eligibility/rules/*.js` の既存関数をそのまま呼び出しており、
様式サマリー側で再実装していない。これにより要件判定エンジンと
様式サマリーの判定結果が食い違うことを防いでいる。

### 5.10 `src/web/` — インテイク用の簡易Webフォーム（M3）

FR-4.2（Webフォーム等のGUI入力）に対応するモジュール。CLI/スクリプトで
JSオブジェクトを直接組み立てる必要をなくし、ブラウザから
ApplicantProfileを入力→要件判定→書類サマリー生成までを一気に行える。

**設計上の制約（変更してはならない前提）**:

- Express等のフレームワークやビルドツールは導入しない。`node:http` のみで
  実装する（NFR-1のビルドレス方針を踏襲）
- サーバーは `127.0.0.1`（ローカルホスト）のみで待受する。`0.0.0.0` 等で
  ネットワークに公開する変更をしないこと（NFR-4: 個人情報を外部へ
  送信しない設計の一環）
- フォームの値はブラウザ側JavaScriptで `ApplicantProfile` 型と同じ構造の
  JSONに組み立ててから送信する（`profileJson` という1つのhiddenフィールド
  としてPOSTする）。サーバー側でbracket記法のフォームパース処理等を
  実装しないための意図的な単純化

**構成**:

- `createServer({ outDir })` — `http.Server` を構築する（未起動）。
  `outDir` を差し替え可能にしているのはテストのため（本番は `out/web/`）
- `startServer({ port, outDir })` — `createServer` を呼び、
  `127.0.0.1:<port>` で待受を開始する。`node src/web/server.js` として
  直接実行された場合のみ自動起動する（`import.meta.url` と
  `pathToFileURL(process.argv[1])` を比較。Windowsのパス区切り文字の
  違いを吸収するため `pathToFileURL` を使う）
- ルーティング: `GET /`（フォーム画面）、`POST /submit`
  （判定＋書類生成→結果画面）、`GET /download/<sessionId>/<filename>`
  （生成済みdocxのダウンロード）、`GET /reminders`（§5.11参照）
- `/submit` はセッションごとに `crypto.randomUUID()` でディレクトリを分け、
  5様式すべてのdocxを `outDir/<sessionId>/` に生成する。この動作は
  `src/documents/*.js` の各 `write<様式名>Docx` をそのまま呼ぶだけで、
  書類生成ロジック自体は一切再実装していない
- `/download` はパストラバーサル対策として、解決後のパスが `outDir` 配下に
  あることを必ず確認してから読み出す

**意図的にやらないこと**: 認証・セッション管理、HTTPS化。個人の副業運用での
ローカル利用を想定した最小構成であり、過剰な設計を避ける
（DEVELOPMENT_GUIDE.md 6章の方針）。インテイクフォーム自体（`/submit`）は
案件を永続化しない（送信のたびに独立したセッションとして書類を生成するのみ）。
複数クライアントの継続的な追跡が必要なM4（リマインド）については、
本格的なデータベースではなく単一のJSONファイル（`data/clients.json`）による
最小限の永続化を別途導入している（§5.11参照）。

### 5.11 `src/reminders/reminderDigest.js` — リマインド・ダイジェスト（M4の土台）

複数クライアントの許可情報（`ClientLicenseRecord[]`）から、更新準備・
更新申請の最終締切・決算変更届の3種のリマインドをまとめて計算し、
期限が近い順（期限超過を含む）に並べる。日付計算そのものは新規実装せず、
既存の `calcRenewalSchedule` / `calcKessanHenkoDeadline` / `daysUntil`
（§5.7）をそのまま再利用している。

**M4として実装していないこと（意図的）**: 実際のメール等の自動送信は
行わない。通知チャネル（メール・Slack・LINE等）の選定は外部サービス連携が
前提になり、NFR-2（追加の外部サービスを必須にしない）・NFR-4（個人情報を
外部送信しない）との整合を発注者が判断する必要があるため、本書の範囲では
「今どのリマインドが必要かを計算・整形する」ところまでに留めている。
`formatReminderDigest` の出力をCLIで確認し、必要な連絡を人手で行う運用を
当面の想定とする。

送信機能を追加する場合は、通知先（メールアドレス等）を `ClientLicenseRecord`
に追加した上で、`filterDueAlerts` で対象を絞り込み、選定した送信チャネルの
モジュールに渡す構成を推奨する（既存の判定・計算ロジックへの影響を局所化するため）。

**`src/reminders/clientStore.js`（永続化層）**: `ClientLicenseRecord[]` を
単一のJSONファイル（既定: `data/clients.json`）へ読み書きする。
`loadClients` はファイル未存在時に空配列を返す（初回利用時にエラーにしない
ため）。`data/` は `.gitignore` で除外しており、実クライアントデータを
リポジトリにコミットしないこと（NFR-5）。クライアントの登録・削除は
`scripts/add-client.js` / `scripts/remove-client.js` のCLIで行う想定。

**Webフォームとの連携**: `src/web/server.js` の `GET /reminders`
（`src/web/reminderPage.js`）が `data/clients.json` を読み込み、
`formatReminderDigest` の結果をブラウザで表示する。この画面は表示専用で、
クライアント登録用のフォームは持たない。理由は、許可日が確定するのは
インテイク（`/submit`）より後の工程であり、案件のライフサイクル段階が
異なるため、意図的にワークフローを混在させていない。

## 6. エラーハンドリング方針

- 現状、各判定関数は例外を投げず、`passed: false` と理由文字列で
  「判定できない／要件を満たさない」ことを表現する設計になっている
  （呼び出し側でtry/catchを必須にしない、CLI用途での使いやすさを優先）。
  この方針を維持すること。
- 入力データの型不備（必須フィールドの欠落等）についても、現状は
  明示的なバリデーション層を持たない。M2の範囲でバリデーションを追加する場合は、
  「エラーを投げて止める」のではなく「warningとして出力し、処理は継続する」
  方針を基本とする（人手レビュー工程で気づける設計を優先するため）。

## 7. テスト方針

- テストランナーは `node --test`（Node.js標準機能）。外部テストフレームワークを
  導入しない（NFR-1のビルドレス方針と整合させるため）。
- 既存テスト: `test/eligibility.test.js`（8件）、`test/renewalSchedule.test.js`（4件）、
  `test/documents.test.js`（15件。様式生成モジュールの「未入力」フォールバック・
  判定ロジック再利用・docx出力の3観点をカバー）、`test/web.test.js`（7件。
  ランダムポートでサーバーを起動し `fetch` で結合テストする。ダウンロードの
  パストラバーサル拒否、`/reminders` の表示も検証）、
  `test/reminderDigest.test.js`（8件。期限超過判定・複数クライアントの
  ソート順・区分別フォーマットを検証）、`test/clientStore.test.js`（6件。
  ファイル未存在時の空配列返却・保存/読込の往復・追加/更新/削除を検証）
- 新規モジュールを追加する場合、最低限次のケースをカバーすること
  - 正常系（すべての条件を満たすケース）
  - 境界値（年数・金額等の基準値ちょうど、基準値-1）
  - 異常系（必須条件を満たさないケース）
- 日付計算を新規に追加・変更する場合は、月末日・うるう年をまたぐケースを
  必ずテストに含めること（`addMonthsClamped` のバグ修正がこの観点から
  発見された実績があるため）

## 8. 非機能設計

- **機密データの扱い**: `ApplicantProfile` には顧客の氏名・住所・財務情報が
  含まれうる。サンプルスクリプト・テストコードでは必ずダミーデータを使用し、
  実データをリポジトリにコミットしないこと。
- **ログ出力**: 現状 `console.log` ベースのシンプルな出力のみ。外部ログ収集
  サービスへの送信は行わない（NFR-4）。
- **国際化**: 対応不要。日本語UI・日本語コメント固定でよい。

## 9. 今後の拡張ポイント（M2以降・設計時の留意点）

- **M3 Webフォーム化**: 実装済み（`src/web/`、§5.10参照）。`ApplicantProfile` 型と
  1対1対応するフォームをブラウザ側JavaScriptで組み立てる方式を採用した。
- **M4 通知連携**: リマインドの計算・整形（`src/reminders/reminderDigest.js`、
  §5.11参照）までは実装済み。実際の送信は外部サービス連携が前提になり、
  NFR-2（追加の外部サービスを必須にしない）・NFR-4（個人情報を外部送信
  しない）との整合を発注者と確認してから着手すること（送信チャネルの
  選定は本書の範囲外）。
- **M6 複数都道府県対応**: 都道府県固有の追加要件が判明した場合、
  既存の5要件モジュールを直接改変せず、都道府県固有ルールを別モジュールとして
  追加し、`engine.js` 側で「共通要件＋都道府県固有要件」を合成する構成に
  拡張することを推奨する（既存ロジックへの影響を局所化するため）。
