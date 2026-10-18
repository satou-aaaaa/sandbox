# CLAUDE.md

kensetsu-kyoka-toolkit（建設業許可・古物商許可などの自動化ツールキット）での作業ガイド（要点集）。
毎回のセッションで読まれるため短く保つ。詳細は `docs/DEVELOPMENT_GUIDE.md` 等を正とする。

## プロジェクトの性質

- 行政書士の副業を「最終レビューと押印だけ」に絞るための個人開発ツール。発注者（ユーザー）が唯一の実利用者兼レビュアー。
- **人手レビュー必須**: 押印・提出前の最終確認は常に人間。自動提出・自動押印機能は追加しない。
- 背景は [`README.md`](README.md)・[`docs/PROPOSAL.md`](docs/PROPOSAL.md)。

## 変更してはならない前提（`docs/DESIGN.md` 1章）

抵触しそうなら実装を進めず、まずユーザーに確認する。

1. **ビルドレス構成**: TypeScriptのコンパイルを導入しない。型はJSDoc、`node` で直接実行（`tsc --noEmit` の型チェックのみOK。ADR-0007）。
2. **外部送信をしない**: 個人情報・財務情報をローカル外へ送る処理を、明示的な要件なしに実装しない。`npm run web` は `127.0.0.1` のみで待受。
3. **法令根拠を明記する**: 判定・期限計算ロジックの新規・変更時は、根拠の法令・公式情報源URLをファイル冒頭コメントに書く。
4. データは単一JSONファイル（`data/clients.json` 等）にローカル保存。DBは導入しない（ADR-0003）。`data/` はコミットしない（NFR-5）。

## ディレクトリ構成（各モジュールの説明は `docs/DEVELOPMENT_GUIDE.md` 2.7）

```
src/core/            eligibility/ documents/ reminders/ — 許可種別に依存しない共通コア
src/licenses/        許可種別アドオン: construction/ kobutsu/ sanpai/ minpaku/ gijinkoku/
                     keiei-jiko-shinsa/ nouchi-tenyo/ inshokuten-eigyo/ tokutei-ginou/
                     （gijinkoku・tokutei-ginou は専門性・リスクが高く、全出力に強調文言を付与）
src/portal/          BtoB下請けケース管理（独立ドメイン）
src/incorporation/   会社設立サポート（登記申請＝司法書士の独占業務の様式は作らない）
src/succession/      相続支援（法的評価は自動判定せず人手確認。マイナンバー等は保持しない）
src/documents/       建設業許可の様式生成   src/web/  インテイク用Webフォーム（ローカル限定）
agent/               Issue自律処理ループ（開発運用ツール。ADR-0017）
test/  e2e/  features/  scripts/  docs/
```

## ドキュメント索引

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)・[`docs/DESIGN.md`](docs/DESIGN.md)・[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)（建設業許可。モジュール詳細設計の一次情報源）
- 他モジュールは `docs/DESIGN_<名前>.md` / `docs/REQUIREMENTS_<名前>.md` の対（`ls docs/DESIGN_*.md`）
- [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md)（環境構築・規約・テスト方針・Git運用）、[`docs/adr/`](docs/adr/)（なぜそう決めたか）
- [`docs/BEST_PRACTICES_AUDIT.md`](docs/BEST_PRACTICES_AUDIT.md)、[`SECURITY.md`](SECURITY.md)（脆弱性は公開Issueにしない）、[`CHANGELOG.md`](CHANGELOG.md)

## コーディング規約（詳細は `docs/DEVELOPMENT_GUIDE.md` 2章）

- 素のJavaScript（ESM）＋JSDoc。コメント・エラーメッセージ・`reasons`/`warnings` は**日本語**。
- 新しい公開関数・型には JSDoc（`@param`/`@returns`/`@typedef`）を付ける（`npm run typecheck` が検出）。
- 申請者データの型は各許可種別の `eligibility/types.js` を単一の情報源とする（ADR-0002）。
- 「1要件・1機能＝1ファイル」（`src/licenses/*/eligibility/rules/` 等）。
- 様式生成は `build<様式名>Document(profile)` / `write<様式名>Docx(profile, outPath)` の2関数。判定は `eligibility/rules/*.js` を再利用し、様式側で再実装しない。
- 不正・欠落データはスキップ／フォールバックして続ける。ただし判定の合否は曖昧にフォールバックさせない。
- リマインドの起点追加は、まず `registerScheduleFn` の契約を変えずに済むか検討する（ADR-0014・0015）。

## テスト（方針と約束ごとの全文は `docs/DEVELOPMENT_GUIDE.md` 2.8）

```bash
npm test            # コミット前に必ず通す（ユニット・a11y・カオス・契約・設計前提の機械検査）
npm run typecheck   # JSDoc型チェック
npm run lint        # ESLint（security プラグイン含む）
npm run scaffold:module -- <名前> "<和名>"   # 新モジュールの雛形
```

- 外部テストフレームワークは入れない（`node --test`。例外は Cucumber.js のみ、ADR-0016）。E2E は `e2e/` に置く。
- `npm test` の外で CI が回すもの: BDD（`test:bdd`）は `nightly.yml` で毎晩、mutation（`test:mutation`）は `weekly-mutation.yml` で毎週（どちらも必須チェック外。ADR-0018）。
- 新規の判定ロジックには法令根拠URLを書く（基準線・免除への逃げは不可。ADR-0018）。
- `data/clients.json` 等の read-modify-write は `src/core/reminders/fileLock.js` の `withFileLock` で包む。
- `digest.js` の型を変えたら `schemas/client-record.schema.json` も追従させる。

## Git運用（詳細は `docs/DEVELOPMENT_GUIDE.md` 3章）

- コミットメッセージは日本語・簡潔に。`main` へ直接pushする場合は事前に `npm test`。
- 「変更してはならない前提」に関わる決定・選択肢比較の末の決定は `docs/adr/` にADRを残す。

## セキュリティ（詳細は `docs/DEVELOPMENT_GUIDE.md` 6章）

- 顧客の実データ（氏名・住所・財務情報等）をコード・テスト・コミット・PR説明文に含めない。ダミーデータで確認する。
- `hooks/check-secrets.mjs`（`git config core.hooksPath hooks`）がAPIキー等の混入を検知する。`npm run check-secrets` で全体確認。
