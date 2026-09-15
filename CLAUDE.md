# CLAUDE.md

kensetsu-kyoka-toolkit（建設業許可・古物商許可の自動化ツールキット）での作業ガイド。
詳細はこのファイルからリンクする各ドキュメントを参照すること。このファイル自体は
索引・要点集であり、内容が重複した場合は元ドキュメント（`docs/DESIGN.md` 等）を正とする。

## プロジェクトの性質

- 行政書士の副業を「最終レビューと押印だけ」に絞り込むための個人開発ツール。
  発注者（ユーザー）自身が唯一の実利用者兼レビュアー。
- **人手レビュー必須**: 判定・書類生成を自動化しても、押印・提出前の最終確認は
  常に人間が行う前提を崩さない。自動提出・自動押印機能は追加しない。
- 詳細な背景は [`README.md`](README.md) と [`docs/PROPOSAL.md`](docs/PROPOSAL.md) を参照。

## 変更してはならない前提（`docs/DESIGN.md` 1章）

実装を進める前に、以下に抵触しないか必ず確認すること。抵触しそうな場合は
実装を進めず、まずユーザーに確認する。

1. **ビルドレス構成を維持する**: TypeScriptのコンパイルステップを導入しない。
   型はJSDocコメントで表現し、`node` で直接実行できる状態を保つ
   （`tsconfig.json` の `checkJs`/`noEmit` による型チェックのみはOK。ADR-0007）。
2. **外部送信をしない**: 個人情報・財務情報をローカル環境の外へ送信する処理
   （HTTPリクエスト等）を、明示的な要件がない限り実装しない。
   `npm run web` のサーバーも `127.0.0.1` のみで待受（`0.0.0.0` 等に変更しない）。
3. **法令根拠を明記する**: 判定・期限計算ロジックの新規実装・変更時は、
   根拠となる法令・公式情報源のURLをファイル冒頭コメントに記載する。
4. データはすべて単一JSONファイル（`data/clients.json` 等）にローカル保存。
   データベースは導入しない（ADR-0003）。`data/` はコミット対象外（NFR-5）。

## ディレクトリ構成（実体。M11でコア抽出済み）

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
  documents/                     様式（youshiki*.js）生成モジュール（建設業許可分）
  web/                           インテイク用Webフォーム（建設業許可のみ・ローカルホスト限定）
test/          node --test のユニットテスト（1ファイル1モジュール対応が基本）
scripts/       動作確認用サンプル・CLIスクリプト（gen:*, client:*, reminders）
docs/          設計方針・アーキテクチャドキュメント（下記参照）
```

> 注意: `docs/DESIGN.md` 3章のディレクトリ構成図はM11のコア抽出（`src/core/` +
> `src/licenses/<種別>/`）以前の記述が残っており実体と一部ずれている。
> 5章以降のモジュール詳細設計は新パスで更新済み。実際のパスは上記か `src/` を
> 直接確認すること。

## ドキュメント索引

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — アーキテクチャ方針の要約
- [`docs/DESIGN.md`](docs/DESIGN.md) — 技術設計書（建設業許可）。モジュール詳細設計の一次情報源
- [`docs/DESIGN_kobutsu-core.md`](docs/DESIGN_kobutsu-core.md) — 技術設計書（コア抽出＋古物商許可）
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) / [`docs/REQUIREMENTS_kobutsu-core.md`](docs/REQUIREMENTS_kobutsu-core.md) — 要件定義書
- [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) — 環境構築・コーディング規約・Git運用（本ファイルはこの要点集）
- [`docs/adr/`](docs/adr/) — アーキテクチャ決定記録。「なぜそう決めたか」はここを見る
- [`docs/BEST_PRACTICES_AUDIT.md`](docs/BEST_PRACTICES_AUDIT.md) — セキュリティ・CI運用の棚卸し
- [`CHANGELOG.md`](CHANGELOG.md) — マイルストーン単位の変更履歴

## コーディング規約（要点。詳細は `docs/DEVELOPMENT_GUIDE.md` 2章）

- 素のJavaScript（ESM）＋JSDoc。`.ts` 化・トランスパイル導入はしない。
- コード内コメント・エラーメッセージ・判定理由文字列（`reasons`/`warnings`）は**日本語**で統一。
- 新しい公開関数・型には JSDoc（`@param`/`@returns`/`@typedef`）を必ず付与する。
  `npm run typecheck` がCIで型注釈の不整合を検出する。
- 申請者データの型は各許可種別の `eligibility/types.js` を単一の情報源とする。
  様式ごと・機能ごとに別の型を新設しない（ADR-0002の方針。古物商許可にも適用）。
- 「1要件・1機能＝1ファイル」の粒度を維持する（`src/licenses/*/eligibility/rules/` 等）。
- 様式生成モジュールは `build<様式名>Document(profile)` / `write<様式名>Docx(profile, outPath)`
  の2関数構成に統一し、判定ロジック（合否・reasons・warnings）は
  `eligibility/rules/*.js` を再利用する（様式側で再実装しない）。
- エラーハンドリング方針: 不正・欠落データは可能な限りエラーで止めず、
  スキップ／フォールバックして処理を続ける（例: CSV不正行のスキップ、
  未知のクエリパラメータで全件表示にフォールバック）。ただし判定ロジックの
  合否そのものを曖昧にフォールバックさせない。

## テスト（詳細は ADR-0011・ADR-0012, `docs/DESIGN.md` 7章）

```bash
npm test                    # node --test（ユニット・アクセシビリティ）。コミット前に必ず通すこと
npm run test:coverage       # 行・分岐カバレッジ付き（テキスト出力）
npm run test:coverage:html  # カバレッジHTMLレポート生成（coverage/index.html。すぐ見たい時はこちら）
npm run test:mutation       # Stryker（数分〜数十分。CIには含まれない。大きな変更の節目で手動実行）
npm run test:e2e            # Playwright（実ブラウザ。初回は npx playwright install chromium が必要）
npm run typecheck           # tsc --noEmit（JSDoc型チェック）
npm run lint                # ESLint（eslint-plugin-securityによる静的セキュリティ解析を含む）
```

- テストは `test/` に1モジュール1ファイル対応で配置し、`node --test` で実行する
  （Jest/Vitest等の外部フレームワークは導入しない）。
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

## Git運用（詳細は `docs/DEVELOPMENT_GUIDE.md` 3章）

- コミットメッセージは日本語・簡潔に。ドキュメント変更には `docs:` 等の接頭辞を推奨（必須ではない）。
- `main` へ直接pushする場合は事前に `npm test` を通す。
- 重要な設計判断（「変更してはならない前提」に関わる決定・選択肢比較の末の
  アーキテクチャ決定）は `docs/adr/` にADRとして残す。単純なバグ修正や
  既存方針に沿った機能追加では不要。

## セキュリティ（詳細は `docs/DEVELOPMENT_GUIDE.md` 6章）

- 顧客の氏名・住所・財務情報等の実データをコード・テスト・コミット・PR説明文に
  含めない。動作確認は必ずダミーデータで行う。
- `hooks/check-secrets.mjs`（pre-commitフック。`git config core.hooksPath hooks` で有効化）が
  APIキー・秘密鍵らしき文字列の混入を検知する。`npm run check-secrets` でリポジトリ全体も手動チェック可能。
