# 0007. `tsconfig.json` の `checkJs` によるビルドレスな型チェック導入

Status: Accepted
Date: 2026-09-12

## Context（背景）

ADR-0001でTypeScriptのコンパイルステップを導入しない方針を決めた際、
「見直しのトリガー」として、プロジェクトの規模が拡大しJSDocの目視確認では
型の不整合を見逃すリスクが無視できなくなった場合に `checkJs: true` の導入を
検討するとしていた。`docs/BEST_PRACTICES_AUDIT.md` の監査でも同様の指摘があり、
「独立したタスクとして着手する」ことを推奨していた。

M1〜M6の土台まで実装が進み、`src/` 配下のモジュール数・条件分岐が増えてきたため、
このタイミングで着手する。

## Decision（決定）

`typescript` と `@types/node` を開発依存として追加し、`tsconfig.json` で
`allowJs: true` / `checkJs: true` / `noEmit: true` / `strict: true` を設定する。
`npm run typecheck`（`tsc --noEmit`）としてCI（`.github/workflows/test.yml`）に
組み込む。**`.js` ファイルを `.ts` に置き換えることはせず、ビルド・トランスパイル
ステップは一切増やさない**（ADR-0001の前提を維持）。

型チェックの対象は `src/**/*.js` と `scripts/**/*.js` のみとし、`test/**/*.js`
は対象外とする。テストファイルはダミーデータ・部分的なオブジェクトを多用しており、
`strict` モードの null 安全性チェック（`possibly undefined` 等）と相性が悪く、
型エラーの大半がテスト用ダミーデータの型不足に起因する「実害のない指摘」に
なることを確認した。テストの正しさは `node --test` の実行結果自体が担保しており、
テストコードの型はそれと別に厳密化する価値が薄いと判断した。

導入にあたり、`src/` 側で実際に発見された型の不備（暗黙のany、`err.code` への
アクセス時の `unknown` 型、`req.url` の undefined 未考慮、docxの `Table`/`Paragraph`
混在配列の型不足等）はすべて修正済み。

## Consequences（影響）

- **メリット**: CIで型エラーを検出できるようになった（ADR-0001で「現状できて
  いない」としていたデメリットを解消）。JSDocコメントの型注釈の正確性が
  実行時ではなくCI時点で検証される
- **デメリット**: 新しい公開関数・変数を追加する際、JSDocの型注釈をより正確に
  書く必要がある（既存の規約 DEVELOPMENT_GUIDE.md 2.1節を実質的に強制する形になる）。
  `strict: true` の一部ルール（`useUnknownInCatchVariables` 等）に対応するための
  ボイラープレートが若干増える（例: `catch (err)` での型アサーション）
- **見直しのトリガー**: `test/` を対象外としたことで見逃す型不備が実害を出した場合、
  対象に含めるか個別に `// @ts-check` 除外コメントで対応するかを再検討する
