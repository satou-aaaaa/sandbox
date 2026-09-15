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

- Node.js v20以上（`engines` に指定。`node -v` で確認。`.nvmrc` があるので
  nvm利用者は `nvm use` で揃えられる）
- npm（Node.jsに同梱）
- Git
- エディタ（VS Code推奨。JSDocの型補完・型チェックがそのまま効く）

### 1.2 セットアップ手順

```bash
git clone <リポジトリURL>
cd kensetsu-kyoka-toolkit   # または実際のディレクトリ名
npm install
npm run typecheck           # JSDocの型チェック（tsc --noEmit。ビルドは行わない）
npm run lint                # ESLintによる静的チェック
npm test                    # 全テスト（現時点で326件）が成功することを確認
npm run gen:eligibility     # 要件判定のサンプル実行
npm run gen:youshiki1       # 様式第一号サマリーのdocx生成サンプル
npm run web                 # インテイク用Webフォームを起動（任意）
```

`npm test` が失敗する場合、まずNode.jsのバージョンを確認すること
（v20未満だと `node --test` の挙動が異なる場合がある）。
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
  `npm test` を実行する（Node.js 20.x / 22.x × ubuntu-latest / windows-latest
  の計4通りで実行。開発機がWindowsであるためWindows環境も対象に含めている）。
  ローカルでの確認を代替するものではないが、レビュー時の安全網として機能する。

### 3.3 コミットメッセージ

- 日本語で簡潔に、変更内容が分かるように書く（既存コミット例:
  `建設業許可 自動化プロダクトの雛形を追加`,
  `docs: ソフトウェア開発提案書(PROPOSAL.md)を追加` のように、
  ドキュメント変更には `docs:` 等の接頭辞を付けることを推奨するが必須ではない）。

### 3.4 プルリクエスト

- 発注者（レビュー担当）へのレビュー依頼はGitHub上のプルリクエストで行うことを推奨する。
  マイルストーン単位（例: M2完了時点）でまとめてPRを作成し、
  `docs/REQUIREMENTS.md` 7章の受け入れ基準に沿って発注者がレビューする想定。

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
