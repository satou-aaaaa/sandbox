# 開発ガイド — kensetsu-kyoka-toolkit（外部開発者向け）

version: 0.1 / 2026-09 作成

## 0. このガイドの目的

本プロジェクトの開発を外部の開発者に委託するにあたり、環境構築・コーディング規約・
Git運用・進め方を統一するためのガイド。`docs/REQUIREMENTS.md`（要件）・
`docs/DESIGN.md`（設計）とあわせて読むこと。

> 契約条件（報酬・納期・知的財産権の帰属・秘密保持等）は本書の対象外。
> これらは発注者・受注者間で別途書面（業務委託契約書等）により合意すること。
> 契約書の作成・レビューが必要な場合は、行政書士・弁護士等の専門家に
> 相談することを推奨する（本書はその代替ではない）。

## 1. 開発環境構築

### 1.1 必要なもの

- Node.js v24.15.0以上（`engines` に指定。2026年10月・#204で22系から引き上げ。`node -v` で確認。`.nvmrc` があるので
  nvm利用者は `nvm install` で24系の最新を入れて切り替えられる。`nvm use` は手元にある古い24系を選ぶことがあるので、`node -v` で24.15.0以上か確かめる）
- npm（Node.jsに同梱）
- Git
- エディタ（VS Code推奨。JSDocの型補完・型チェックがそのまま効く）

### 1.2 セットアップ手順

準備は `bash scripts/setup.sh` の1コマンド（Node.js の版の確認・`npm ci`・pre-commit フックの有効化・E2E のブラウザ。何度実行してもよい。Windows は Git Bash で）。
Claude Code のクラウドセッションでは `.claude/settings.json` のフックが自動で実行する。

```bash
git clone <リポジトリURL>
cd kensetsu-kyoka-toolkit   # または実際のディレクトリ名
bash scripts/setup.sh
npm run typecheck           # JSDocの型チェック（tsc --noEmit。ビルドは行わない）
npm run lint                # ESLintによる静的チェック
npm test                    # 全テストが成功することを確認（正確な件数は実行結果を参照）
npm run gen:eligibility     # 要件判定のサンプル実行
npm run gen:youshiki1       # 様式第一号サマリーのdocx生成サンプル
npm run web                 # インテイク用Webフォームを起動（任意）
```

`npm test` が失敗する場合、まずNode.jsのバージョンを確認すること
（`engines` の要件〈v24.15.0以上〉を満たさないと、jsdomを使うテストが失敗する場合がある）。
利用可能な全スクリプトは `README.md` の「セットアップ」節を参照。

セットアップ後、以下を一度だけ実行してシークレット混入チェックの
pre-commitフックを有効化すること（`hooks/` 参照。追加の依存パッケージは
不要で、`git` コマンドのみで動作する）。

```bash
git config core.hooksPath hooks
```

なお `npm run check-secrets` で、ステージ済みの差分だけでなくリポジトリ全体
（HEAD時点の全ファイル）を対象に同じチェックを手動実行できる。CIでも
このコマンドを実行しており（`.github/workflows/test.yml`）、ローカルの
pre-commitフックが未設定・バイパスされた場合の二重の安全網としている。

### 1.3 生成物の確認方法

`scripts/generate-youshiki1-sample.js` を実行すると `out/` ディレクトリに
`.docx` ファイルが生成される（`.gitignore` により `out/` はコミット対象外）。
Microsoft Word、LibreOffice Writer等で開いて内容を確認すること。

## 2. コーディング規約

### 2.1 言語・構文

- **TypeScriptのコンパイル・ビルドステップは導入しない**。プレーンJavaScript
  （ESM, `"type": "module"`）＋JSDocコメントで型を表現する
  （`docs/DESIGN.md` 1章の設計原則を参照）。`.js`ファイルを`.ts`に置き換える、
  または`tsc`でのトランスパイルを実行フローに挟む変更は行わないこと。
  なお `tsconfig.json`（`checkJs: true` / `noEmit: true`）による**型チェックのみ**は
  ADR-0007で導入済みで、これはビルドステップではない（`npm run typecheck`）。
- 新しい公開関数・型には必ずJSDocコメントを付与する
  （`@param` / `@returns` / 型定義の `@typedef` を含む）。既存ファイル
  （`src/licenses/construction/eligibility/rules/*.js` 等）のコメントスタイルを参考にすること。
  `npm run typecheck` がCIで実行されるため、型注釈が不正確だとCIが失敗する。
- import/exportは常にESM構文（`import`/`export`）を使う。`require` は使わない
  （`src/licenses/construction/documents/youshiki1.js` の `writeYoushiki1Docx` 内のように、
  Node組み込みモジュールを動的import `await import("node:fs/promises")`
  する形は許容される既存パターン）。

### 2.2 コメント・メッセージの言語

- コード内コメント、エラーメッセージ、判定結果の理由文字列（`reasons`/`warnings`）は
  すべて日本語で統一する。

### 2.3 法令根拠の明記

- 判定ロジック・期限計算ロジックを新規実装・変更する場合、根拠となる
  法令・公式情報源（国交省ページ等）のURLをファイル冒頭のコメントに記載する
  （既存の `src/licenses/<種別>/eligibility/*.js` の慣習を踏襲）。

### 2.4 ファイル構成のパターン

- 「1要件・1機能＝1ファイル」の粒度を維持する（`src/licenses/construction/eligibility/rules/` のように）。
- 様式生成モジュールを追加する場合は `docs/DESIGN.md` 5.8.1節の
  命名規則・関数構成（`build<様式名>Document` / `write<様式名>Docx`）に従う。

### 2.5 データ型の扱い

- 申請者データの型は各許可種別の `eligibility/types.js`（建設業許可は `src/licenses/construction/eligibility/types.js`）を唯一の情報源とする。
  同じ意味のデータに対して別モジュールで別の型を新設しない。
  型を拡張する場合はこのファイルに追記する。

### 2.6 重要な設計判断はADRとして記録する

- 「変更してはならない前提」（`docs/DESIGN.md` 1章）に関わる決定や、
  複数の選択肢を比較検討した上で採用したアーキテクチャ上の決定は、
  `docs/adr/` にArchitecture Decision Record（ADR）として残す。
  書き方・命名規則は `docs/adr/README.md` を参照。
- 単純なバグ修正や、既存の設計原則に沿った機能追加ではADRは不要。
  「なぜAではなくBを選んだか」を将来説明する必要がありそうな決定のみ対象とする。

### 2.7 ディレクトリ構成の詳細（CLAUDE.md から移設）

AGENTS.md には1行ずつの要約だけを置き、各モジュールの説明はここに置く。

```
src/
  core/                          許可種別に依存しない共通コア
    eligibility/                 要件判定の集約・共通型
    documents/                   docx生成の共通ヘルパー
    reminders/                   期限計算・クライアント永続化・CSV変換・ダイジェスト集約
  licenses/
    construction/                建設業許可アドオン（法定5要件・都道府県固有ルール合成・
                                  リマインド）
    kobutsu/                     古物商許可アドオン（欠格事由・営業所/管理者要件・
                                  書類生成・変更届リマインド）
    sanpai/                      産業廃棄物収集運搬業許可アドオン（欠格事由・講習修了・
                                  経理的基礎・書類生成・更新/講習修了証期限リマインド）
    minpaku/                     住宅宿泊事業（民泊）届出アドオン（欠格事由・必要書類チェック・
                                  書類生成・定期報告リマインド）
    gijinkoku/                   在留資格「技術・人文知識・国際業務」申請支援アドオン（学歴/実務
                                  経験・報酬要件、書類生成、在留期間満了リマインド。他の
                                  モジュールより専門性・リスクが高い分野のため強調文言を全出力に付与）
    keiei-jiko-shinsa/           経営事項審査（経審）申請支援アドオン（建設業許可保有の確認・
                                  評価項目の入力完備性チェック〈評点計算なし〉・書類生成・
                                  年次反復型リマインド。同一クライアントの建設業許可を参照する）
    nouchi-tenyo/                農地転用許可アドオン（立地基準/一般基準の判定、書類生成、
                                  「条件履行期限型」リマインド。更新の概念が無く、許可条件の
                                  履行期限を追跡し履行済み記録で自動的にリマインドが消える）
    inshokuten-eigyo/            飲食店営業許可アドオン（施設基準・食品衛生責任者設置要件の
                                  判定、書類生成、可変期間〈5〜8年〉満了リマインド。HACCPに
                                  沿った衛生管理は許可要件ではなく継続義務であることを全出力に
                                  明記）
    tokutei-ginou/               特定技能1号申請支援アドオン（対象19分野の分野別サブ
                                  レジストリ、技能水準/日本語能力/所属機関基準/支援体制の
                                  判定、書類生成、在留期間満了＋通算5年上限接近警告の
                                  リマインド。gijinkoku同様、専門性・リスクが高い分野の
                                  ため強調文言を全出力に付与）
  portal/                        BtoB下請けケース管理ポータル（許可種別アドオンではない
                                  独立ドメイン。元請/案件管理・書類生成・納期リマインド）
  incorporation/                 会社設立サポート（許可種別アドオンではない独立ドメイン。
                                  定款・発起人決定書サマリー生成、定款認証予約日/出資金
                                  払込期限リマインド。登記申請〈司法書士の独占業務〉に
                                  類する様式は一切実装しない）
  succession/                    相続関連（遺言書・遺産分割協議書）支援（許可種別アドオン
                                  でも要件判定でもない独立ドメイン。法定相続人・法定相続分
                                  の自動計算〈民法900条・901条〉、財産目録/協議書/自筆証書
                                  遺言文案の生成、相続放棄/相続税申告/遺留分侵害額請求の
                                  期限リマインド。争いの有無・遺留分該当性等の法的評価は
                                  自動判定せず必ず人手確認を促す。マイナンバー等の機微情報
                                  は型定義上保持しない）
  documents/                     様式（youshiki*.js）生成モジュール（建設業許可分）
  web/                           インテイク用Webフォーム（建設業許可・古物商許可・
                                  農地転用許可対応。古物商許可は個人申請のみ・
                                  ローカルホスト限定）
agent/         Issue自律処理ループ（Agent SDK。開発運用ツールでアプリ本体ではない。
               依存は`agent/package.json`に分離。PR作成・リスクに応じた自動マージ・事後リバート。押印/提出は人手。ADR-0017）
test/          node --test のユニットテスト（1ファイル1モジュール対応が基本）
features/      Cucumber.js（BDD/Gherkin）の受け入れ基準（`.feature`・
               `step_definitions/`。2026年9月・ADR-0016で例外的に導入。
               対象は法令根拠が特に重要な判定ロジックに限定する）
scripts/       動作確認用サンプル・CLIスクリプト（gen:*, client:*, reminders。
               portal/incorporation/succession等の独立ドメインは
               `<ドメイン>:case-add` / `<ドメイン>:reminders` 系で統一）
docs/          設計方針・アーキテクチャドキュメント（下記参照）
```

### 2.8 テストの方針と各テストの約束ごと（CLAUDE.md から移設）

```bash
npm test                    # node --test（ユニット・アクセシビリティ・カオス・契約）。コミット前に必ず通すこと
npm run test:coverage       # 行・分岐カバレッジ付き（テキスト出力）
npm run test:coverage:html  # カバレッジHTMLレポート生成（coverage/index.html。すぐ見たい時はこちら）
npm run test:mutation       # Stryker（数分〜数十分。PRのCIには含まれず、weekly-mutation.yml が毎週実行。ADR-0018）
npm run test:e2e            # Playwright（実ブラウザ。初回は npx playwright install chromium が必要）
npm run test:bdd            # Cucumber.js（Gherkin/BDD。features/。ADR-0016参照。npm testには含まれず、nightly.yml が毎晩実行）
npm run test:load           # autocannon（同時アクセス下でのエラー・タイムアウト有無を確認）
npm run typecheck           # tsc --noEmit（JSDoc型チェック）
npm run lint                # ESLint（eslint-plugin-securityによる静的セキュリティ解析を含む）
npm run scaffold:module -- <名前> "<和名>"   # 新しい許可種別アドオンの雛形（判定ロジックは作らない）
npm run changelog:draft     # CHANGELOG用の下書きをgit履歴から標準出力へ（人が編集して取り込む）
npm run changelog:aggregate -- --section "## 見出し"  # changelog.d/*.md の断片をCHANGELOG.mdへ集約（取り込み後は断片を削除。詳細はDEVELOPMENT_GUIDE.md 3.6）
npm run reminders:daily     # 期限の日次点検。全文は out/ にだけ保存、標準出力は件数と最短期限のみ（名前は出さない）
npm run gen:review-pack     # 押印前レビューパック（判定理由・警告・期限を1枚のdocxに）のサンプル出力
```

- **設計前提の機械検査**: `test/invariants.test.js`（ビルドレス・外部送信なし・127.0.0.1待受・DB無し・
  `data/`未コミット・判定ロジック冒頭の法令根拠URL）と `test/docsConsistency.test.js`（モジュールと設計書の対応・
  AGENTS.mdの構成・ADR索引）が `npm test` で走る。法令根拠URLは全ロジックに記載済み（2026-09-30に条文を再確認）。
  法令に基づかないファイル（算術ヘルパー・レジストリ等）だけ `test/fixtures/legal-basis-exempt.json` に理由つきで免除し、
  `legal-basis-baseline.json`（未了分の基準線）は空。**新規ロジックはURLを書く**（基準線・免除への逃げは不可。ADR-0018）。
  新モジュールは `npm run scaffold:module` で作ると、`docs/`・`MODULE_DOCS`・AGENTS.md の更新漏れも検知できる。
- テストは `test/` に1モジュール1ファイル対応で配置し、`node --test` で実行する
  （Jest/Vitest等の外部フレームワークは導入しない）。**例外**: Gherkin/BDDに
  限定してCucumber.jsを導入している（`features/`。発注者の明示的な依頼に
  よるもの。ADR-0016参照）。新しい判定ロジックにGherkinシナリオを追加する
  義務はなく、法令根拠が特に重要なモジュールに絞って任意で追加する。
- Property-based testing（`fast-check`）は「入力の組み合わせが実質無限で、
  性質を明確に言語化できる」純粋関数（日付計算・CSV往復変換・HTMLエスケープ等）
  に限定して既存テストファイル末尾に追記する。専用ファイルに分離しない。乱用しない。
- ミューテーションテストの対象は要件判定・欠格事由判定・日付/金額計算・CSV変換など
  「間違えると実害が大きい」ロジックのみ（`stryker.config.mjs` 参照）。
  書類生成・Web表示は対象外（branch coverage拡充で個別対応する前提）。
- アクセシビリティテスト（`test/accessibility.test.js`）はaxe-core + jsdomで
  `src/web/*Page.js` のHTMLを検証する。
- E2Eテスト（Playwright）は `test/` ではなく `e2e/` に配置する
  （`node --test` が `test/` 配下の.jsファイルを命名規則に関わらず自動検出し
  衝突するため）。スコープは実ブラウザでの疎通確認（golden path）に限定し、
  判定ロジックの網羅は単体テスト側に委ねる。
- カオステスト（`test/chaos.test.js`）は依存先（ファイルシステム）の障害・
  同時実行の競合をアプリケーション層で直接注入する。`data/clients.json`等への
  read-modify-write操作は必ず `src/core/reminders/fileLock.js` の
  `withFileLock` で包むこと（同時呼び出しでの lost update を防ぐため。
  過去に実際にこの競合バグが見つかった経緯がある）。
- 契約テスト（`test/contract.test.js`）は `schemas/client-record.schema.json`
  （JSON Schema）で `ClientRecord`/`LicenseEntry` の形を検証する。
  `digest.js` のJSDoc型定義を変更した場合はスキーマ側も追従させること。
- 負荷テスト（`load/web-server.load.js`）はautocannonで同時アクセス時の
  エラー・タイムアウト有無のみを確認し、具体的な性能閾値は判定しない
  （閾値を決めるだけの実運用データがまだ無いため）。

## 3. Git運用ルール

### 3.1 リポジトリ

- GitHub: `satou-aaaaa/sandbox`（プライベートリポジトリ）
- 発注者から招待を受けてアクセス権を取得すること

### 3.2 ブランチ運用

- 機能追加・修正は `main` から作業用ブランチを切って行うことを推奨する
  （例: `feature/youshiki6`, `fix/renewal-schedule`）。
- 小規模な副業プロジェクトのため、厳密なブランチ保護ルールは設定していない。
  ただし `main` へ直接pushする場合は、事前に `npm test` を通してからにすること。
- GitHub Actions（`.github/workflows/test.yml`）が push・PR時に自動で
  `npm test` を実行する（Node.js 24.x / 26.x × ubuntu-latest / windows-latestのうち、windowsは24.xのみ
  の計3通りで実行。開発機がWindowsであるためWindows環境も対象に含めている）。
  ローカルでの確認を代替するものではないが、レビュー時の安全網として機能する。
- `test.yml` の末尾に、マトリクスの全セルの結果を集約する固定名のジョブ
  `ci-required` を用意している（#229）。ブランチ保護（GitHub UI）の必須
  ステータスチェックは、マトリクスの個別ジョブ名（`test (ubuntu-latest, 24.x)`等）
  ではなく、この `ci-required` 1つに向けること。これにより、マトリクスの
  組み合わせを変更しても、必須チェックの設定を直す必要がなくなる
  （過去にマトリクス変更時にこの設定漏れでマージが長時間ブロックされた
  経緯がある。設定の変更自体はコードからはできないため、発注者がGitHub UIで
  行う）。

### 3.3 コミットメッセージ

- 日本語で簡潔に、変更内容が分かるように書く（既存コミット例:
  `建設業許可 自動化プロダクトの雛形を追加`,
  `docs: ソフトウェア開発提案書(PROPOSAL.md)を追加` のように、
  ドキュメント変更には `docs:` 等の接頭辞を付けることを推奨するが必須ではない）。

### 3.4 プルリクエスト

- 発注者（レビュー担当）へのレビュー依頼はGitHub上のプルリクエストで行うことを推奨する。
  マイルストーン単位（例: M2完了時点）でまとめてPRを作成し、
  `docs/REQUIREMENTS.md` 7章の受け入れ基準に沿って発注者がレビューする想定。

### 3.5 リリース（`git tag` + GitHub Releases）

- 変更履歴の一次情報源は`CHANGELOG.md`であり、原則これで十分（区切りが
  欲しい場合の任意運用）。マイルストーン完了等、区切りを付けたい場合のみ
  以下を行う:
  - `package.json`の`version`を更新し、`git tag vX.Y.Z`を付与して
    `git push origin vX.Y.Z`でpush
  - GitHub Releasesで当該タグに対応するリリースを作成し、本文には
    `CHANGELOG.md`の該当セクションを転記する（実データ・実クライアント名を
    含めないこと。6章参照）
- 毎回のマイルストーンで機械的にタグを打つ運用は求めない
  （`docs/BEST_PRACTICES_AUDIT.md`参照。CHANGELOG.mdでの記録を基本とする）。

### 3.6 CHANGELOGの断片化運用（`changelog.d/`。Issue #230）

`CHANGELOG.md`は冒頭に新しい記載を追記する運用のため、複数のPR（人・運用
エージェント・別セッション）が同時に冒頭を編集すると衝突しやすい
（実際にPR #86で2回手動解消した経緯がある）。これを避けるため、**PRの
段階では`CHANGELOG.md`本体を直接編集せず**、断片ファイルに1件だけ書く。

- **断片ファイルの書式・置き場所**: `changelog.d/<PR番号または識別子>.md`。
  1ファイル＝1件の変更。中身はCHANGELOG.mdにそのまま貼り付けられる断片
  （リスト項目1つを想定。見出し`## ...`は書かない）。同じPRで複数件書く
  場合は`231-2.md`のように連番を付ける。書式の詳細は
  `changelog.d/_TEMPLATE.md`（集約対象外。ファイル名が`_`または`.`で
  始まるファイルは`scripts/aggregate-changelog.mjs`が無視する）を参照。
- **集約**: マイルストーンやサイクルの区切りで、断片を`CHANGELOG.md`の
  指定セクションへ集約する。

  ```bash
  npm run changelog:aggregate -- --section "## 見出し（2026年10月・#230）"
  ```

  指定した見出しが`CHANGELOG.md`に既存なら、その節の末尾に追記する
  （同一サイクル内で複数回実行しても取り込み済みの内容は壊さない）。
  見出しが新規なら、一番新しい位置（先頭の既存セクションの直前）に
  新しい節として挿入する。`--section`を省略すると
  `## 変更履歴断片の集約（YYYY年M月）`を既定の見出しにする。
  集約すると、取り込んだ断片ファイルは既定で削除される
  （`--dry-run`で結果を標準出力に表示するだけに留められる。
  `--keep-fragments`でCHANGELOG.mdは更新しつつ断片ファイルは残せる）。
  空ファイル・内容が重複する断片は（エラーで止めず）スキップし、
  その旨を標準エラー出力に警告する。
- **`npm run changelog:draft`との違い**: 既存の`changelog:draft`
  （`scripts/changelog-draft.mjs`）は`git`の履歴から下書きを**標準出力へ
  出すだけ**で、`CHANGELOG.md`・`changelog.d/`のどちらも書き換えない
  （文面は人が判断して転記する）。一方、`changelog:aggregate`は各PRが
  既に`changelog.d/`へ積んだ**確定済みの断片**を、実際に`CHANGELOG.md`
  へ書き込み、取り込んだ断片ファイルを削除する。前者は「下書き作成」、
  後者は「断片の本採用」であり、役割は別物。
- **並行PRが衝突しない理由**: 2つのPRが同時に`changelog.d/`へ断片を
  追加しても、ファイル名（PR番号）が異なる限り同一ファイルを編集しない
  ため、Gitレベルでコンフリクトしない（`test/aggregateChangelog.test.js`
  の該当テストを参照）。集約（`CHANGELOG.md`本体の書き換え）は、通常
  マイルストーン単位でまとめて1回行う人手操作のため、そこでの衝突は
  従来よりずっと起きにくい。

## 4. 進め方・コミュニケーション

- マイルストーン単位（`docs/PROPOSAL.md` 6章のM1〜M6）で区切って開発を進める。
  M1〜M3は完了、M4（通知連携）はリマインドの計算・永続化・mailto下書きまで
  完了している（実際の自動送信は未着手）。M6（複数都道府県対応・JCIP連携）は、
  対象都道府県が確定した際に拡張できる「仕組み」（`prefectureRules.js`、
  ADR-0005）とJCIP公開情報の調査（ADR-0006）までは完了しているが、
  具体的な都道府県固有要件・自動連携コードは未着手。次のM5（試験運用）は
  行政書士登録の完了、M6の本体着手は対象都道府県の確定が、それぞれの
  前提条件となる（`docs/PROPOSAL.md` 5章・7章参照）。M7（競合調査に基づく
  機能拡張。リマインドの3段階化・クライアントの複数許可対応・入力内容の
  整合性チェック）は完了（`docs/DESIGN.md` §5.14〜5.16、ADR-0008）。
  M8（経営事項審査対応）はフェーズ1（工事経歴書のdocx生成）まで完了。
  評点計算・財務諸表は対象外（`docs/DESIGN.md` §5.17、ADR-0009）。
  M9（経営規模等評価申請書・総合評定値請求書の総括表生成）も完了
  （`docs/DESIGN.md` §5.18）。M10（完成工事原価報告書のdocx生成）も完了
  （`docs/DESIGN.md` §5.19、ADR-0010）。別紙一〜三・経営状況分析申請書・
  貸借対照表・損益計算書本体・株主資本等変動計算書・注記表は引き続き対象外。
  2026年9月には既存機能のテスト分岐網羅率を重点的に強化した（法定要件判定の
  未検証だった分岐、`escapeHtml`・docx共通ヘルパーの直接テスト、Webフォームの
  ブラウザ側JavaScriptをjsdomで実行するテストを追加。さらに`npm run test:coverage`
  の残り分岐（`formatEligibilityReport`・リマインド区分表示・エラーレスポンス系
  ルート等）も洗い出して追加した。138件→200件、分岐網羅率は約88%→約92%。
  詳細は`docs/DESIGN.md` 7章）。M11（許認可自動化コア抽出＋古物商許可
  モジュール）も完了し、建設業許可専用だった実装を「許可種別非依存の
  共通コア（`src/core/`）＋許可種別ごとのアドオン（`src/licenses/<種別>/`）」
  に整理した上で、第2のパイロットとして古物商許可（欠格事由・営業所/管理者
  要件の判定、許可申請書・誓約書・略歴書のdocx生成、変更届・書換申請
  リマインド）を新規実装した（`docs/DESIGN_kobutsu-core.md`・
  `docs/REQUIREMENTS_kobutsu-core.md`）。個人申請のみが対象で、法人申請・
  Webフォーム対応・整合性チェックは引き続き対象外。200件→260件。
- 対象都道府県・対象様式の詳細（レイアウト・記載要領）が発注者側で未確定の場合、
  着手前に発注者へ確認すること（`docs/REQUIREMENTS.md` 8章の前提条件を参照）。
- 実装方針で `docs/DESIGN.md` に明記されていない判断が必要になった場合
  （例: 様式固有のデータ項目をどう型に落とし込むか）は、実装を進める前に
  発注者に相談すること。特に1章の設計原則（人手レビュー必須・ビルドレス構成・
  外部送信禁止）に抵触しそうな場合は必ず確認すること。

## 5. 受け入れ・検収の進め方

1. 開発者が `npm run typecheck` と `npm run lint`・`npm test` を実行し、
   型チェック・静的解析・全テストが成功することを確認する
   （GitHub Actionsでも自動実行されるため、PR画面のチェック結果でも確認できる）
2. PRテンプレート（`.github/pull_request_template.md`）のセルフレビュー観点
   （Google eng-practicesの12項目: 設計・機能性・複雑性・テスト・命名・
   コメント・スタイル・一貫性・ドキュメント・全行・文脈・良い点）を一通り確認する
3. `docs/REQUIREMENTS.md` 7章の受け入れ基準（M2）を1項目ずつ自己チェックする
4. 生成されたdocxサンプルを発注者に共有し、内容・注記表示を確認してもらう
5. 発注者が `docs/ARCHITECTURE.md`（および必要なら `docs/DESIGN.md`）の
   記述が実装と一致しているかを確認する
6. 問題なければ `main` にマージ（またはPRを承認）し、当該マイルストーンを完了とする

## 6. セキュリティ・情報管理

- 顧客の氏名・住所・財務情報等の実データを、コード・テスト・コミット・
  Issue・PRの説明文のいずれにも含めないこと。動作確認には必ずダミーデータを使う。
- APIキー・トークン等の秘匿情報が将来的に必要になった場合（例: M6でのJCIP連携）、
  `.env` 等の環境変数で管理し、`.gitignore` で除外されていることを確認する
  （現状の `.gitignore` に `.env` / `.env.local` は追加済み）。
- `hooks/check-secrets.mjs`（pre-commitフック。有効化は1.2節参照）が、
  ステージ済みの変更にAPIキー・秘密鍵らしき文字列が含まれていないかを
  コミット前に簡易チェックする。誤検知時は `git commit --no-verify` で
  バイパスできるが、実データの混入を必ず確認してから使うこと。
- 本プロジェクトは個人の副業運用であり、大規模な組織的セキュリティ体制は
  前提としていない。過剰な設計（大掛かりな認証基盤の導入等）は避け、
  シンプルな構成を維持すること。

### 6.1 顧客データの取り扱い方針（バックアップ・保持期間・暗号化。Issue #183・ADR-0020）

- **ディスク暗号化が前提**: `data/clients.json`・`data/drafts.json` はいずれも
  平文JSONで保存される。アプリ自体は暗号化・復号を行わないため、
  **OSのディスク暗号化（Windowsの BitLocker、macOSの FileVault 等）を
  有効にしておくこと**を運用の前提とする。
- **世代バックアップ**: 書き込みの都度、書き換え前の内容が
  `data/backup/` 配下へ直近7世代だけ自動保存される
  （`src/core/reminders/backup.js`）。ファイル破損・誤操作時は
  `npm run data:restore -- <clients|drafts> [世代番号]` で復元できる。
  一覧は `npm run data:backup` で確認できる。世代数は推奨デフォルト値であり、
  必要なら `backupBeforeWrite`/`restoreFromBackup` の `generations` 引数で
  調整できる（詳細はADR-0020）。
- **クライアント本体データの自動削除はしない**: 自動的に削除されるのは
  `backup/` 配下の古い世代のみ。`clients.json`・`drafts.json` 本体を
  自動的に消す機能は無く、削除は常に `npm run client:remove` 等の
  人手操作で行う。
- **保持期間の目安**: 受任が完了した顧客データは、**受任終了後1年程度を
  目安に削除を検討する**（個人情報保護法の「利用目的を達成したときは
  遅滞なく消去する」努力義務の観点）。あくまで運用上の目安であり、
  具体的な年数・要否の最終判断は発注者（行政書士本人）が行うこと。
  自動削除の仕組みは用意していないため、削除する場合は
  `npm run client:remove` を手動で実行する。

#### Windowsでファイル権限（自分のみアクセス可）を確認する手順

Windows環境で運用する場合、`data/` フォルダに他のユーザーアカウントから
アクセスできてしまわないかを、次の手順で確認できる（コード側での制御は
行わないため、OSの権限設定に委ねる運用メモ）。

1. エクスプローラーで `data` フォルダを右クリック →「プロパティ」→
   「セキュリティ」タブを開く。
2. 「グループ名またはユーザー名」欄に、自分のアカウント以外の一般ユーザー
   グループ（`Users` 等）や `Everyone` が**フルコントロール/変更**権限で
   含まれていないかを確認する。含まれている場合は「編集」から該当エントリを
   選び、権限を外すか削除する（管理者アカウントとSYSTEMは通常そのままでよい）。
3. PowerShellでも確認できる: `icacls data` を実行し、表示されるACL一覧に
   自分のアカウント（および必要なら管理者）以外のエントリが無いことを見る。
4. ノートPC等、ディスク暗号化（BitLocker）が有効になっているかは
   「設定」→「プライバシーとセキュリティ」→「デバイスの暗号化」
   （または `manage-bde -status` をPowerShellで実行）で確認できる。

### 6.2 クラウドセッションの許可ドメイン（Issue #231）

Claude Code のクラウドセッションは、環境のネットワークポリシーで外部への
通信先を絞っている。法令根拠の一次資料（手引き・様式・条文）をエージェントが
自分で確認できるよう、パッケージマネージャーの既定リストに加えて、次の
公式情報源だけを許可する（最小権限。必要になったものだけ1つずつ足す）。

| ホスト | 何のために読むか |
|---|---|
| `www.keishicho.metro.tokyo.lg.jp` | 警視庁。古物商許可の申請の手引き・様式（#71） |
| `www.toshiseibi.metro.tokyo.lg.jp` | 東京都都市整備局。建設業許可の手引き（#81） |
| `laws.e-gov.go.jp` | e-Gov法令検索。法令の原文 |

- **読み取り専用**: 許可したホストへの通信は閲覧だけに使う。個人情報・
  財務情報は一切送らない（NFR-4）。クラウドセッションではダミーデータだけを扱う。
- **設定の場所**: リポジトリの外（環境の設定）にある。所有者が
  環境の Network access で Allowed domains に足す。
  「Allow package managers」（既定リスト）は残す。手順は
  <https://code.claude.com/docs/en/cloud-environments#network-access>。
- **足すとき**: 国交省（`www.mlit.go.jp`）や他県など、新しい公式情報源が
  必要になったら、環境の設定とこの表を同じ時に直す。改正を追いたいページは
  `docs/law-watch-extra.json` にも足す。
- 取得した手引き・条文の内容は、人が最終確認してから実装に反映する。

## 7. 参考ドキュメント一覧

| ファイル | 内容 |
|---|---|
| `README.md` | プロジェクト概要・セットアップ手順（利用者向け） |
| `docs/PROPOSAL.md` | ビジネス背景・開発ロードマップ（発注者向け提案書） |
| `docs/ARCHITECTURE.md` | アーキテクチャ方針の要約 |
| `docs/REQUIREMENTS.md` | 要件定義書 |
| `docs/DESIGN.md` | 技術設計書（モジュール詳細設計を含む。建設業許可分） |
| `docs/REQUIREMENTS_kobutsu-core.md` | 要件定義書（許認可自動化コア抽出＋古物商許可モジュール分） |
| `docs/DESIGN_kobutsu-core.md` | 技術設計書（同上） |
| `docs/DEVELOPMENT_GUIDE.md` | 本書 |
| `docs/BEST_PRACTICES_AUDIT.md` | セキュリティ・CI・リポジトリ運用のベストプラクティス棚卸し |
| `docs/adr/` | アーキテクチャ決定記録（ADR）。重要な設計判断の背景 |
| `CHANGELOG.md` | マイルストーン単位の変更履歴 |
