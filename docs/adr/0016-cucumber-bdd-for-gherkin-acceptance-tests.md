# 0016. Gherkin/BDDの受け入れ基準用にCucumber.jsを例外的に導入する

Status: Accepted
Date: 2026-09-18

## Context（背景）

発注者（行政書士）から、Gherkin記法によるBDD（振る舞い駆動開発）を
テストに導入してほしいという明示的な依頼があった。

Gherkin記法（`機能`/`シナリオ`/`前提`/`もし`/`ならば`等の自然文でシナリオを
書く記法）を実行するには、`.feature`ファイルをパースしてステップ定義に
紐づける専用のランナーが必要であり、事実上Cucumber（今回は
`@cucumber/cucumber`、いわゆるCucumber.js）の導入を意味する。

一方、`CLAUDE.md`の「テスト」節には次の既存方針がある。

> テストは `test/` に1モジュール1ファイル対応で配置し、`node --test` で
> 実行する（Jest/Vitest等の外部フレームワークは導入しない）。

Cucumber.jsはJest/Vitestと同種の「外部テストフレームワーク」であり、
文言上はこの既存方針に反する。導入前にこの抵触を発注者に明示したところ
（本ツールのシステムプロンプト上の運用ルールに基づく確認）、「Cucumber.js
を新規導入する」という回答を得た。

## Decision（決定）

Gherkin/BDDに限定した例外として、`@cucumber/cucumber`をdevDependencyとして
導入する。

- `.feature`ファイルは`features/`直下に配置する（Cucumber標準の既定探索先）
- ステップ定義は`features/step_definitions/`にESM（`import`）で書く。
  本プロジェクトは`"type": "module"`のため、Cucumber CLIには
  レガシーな`--require`ではなく`--import`（`cucumber.js`設定ファイルの
  `import`キー）を使う
- 日本語の鉤括弧（「...」）で文字列を囲む書き方に対応するため、
  Cucumber標準の`{string}`（ASCII引用符のみ対応）とは別に、
  `features/support/parameter_types.js`で独自の`{quoted}`パラメータ型を
  定義する
- ステップ定義からは、既存の`eligibility/rules/*.js`等の判定関数を
  そのまま呼び出す（判定ロジックを二重に実装しない。CLAUDE.mdの
  コーディング規約「判定ロジックはeligibility/rules/*.jsを再利用する」を
  Gherkin層にも適用する）
- 既存の`npm test`（`node --test`。コミット前に必ず通す）には含めず、
  `npm run test:bdd`として独立させる。CIには任意の追加ステップとして
  含めるかは別途判断する（本ADR作成時点では未追加）
- `docs/adr/0001-buildless-javascript.md`（ビルドレス構成）には抵触しない。
  Cucumber.jsはトランスパイル・バンドルを行わず、素のESM
  ステップ定義ファイルをそのまま実行するランナーであるため

対象範囲は、まず`src/licenses/construction/eligibility/rules/kekkaku.js`
（建設業法第8条の欠格要件。10項目の明確な法令根拠を持つルールベースの
判定）を最初の実例として`features/construction-kekkaku.feature`に実装した。
他の欠格事由判定モジュール（古物商許可等）への展開は、この実例が
実際に発注者にとって有用と確認できてから追って判断する（時期尚早な
全モジュール展開は避ける。ADR-0009等で採ってきた「小さく作って検証する」
方針を踏襲）。

## Consequences（影響）

**メリット**:
- 行政書士本人が、プログラムを読まなくても「どの法令要件がどう判定
  されるか」を自然文のシナリオとして直接確認できる。既存のユニット
  テスト（`test/eligibility.test.js`等）は開発者向けの検証であり、
  発注者自身が判定ロジックの網羅性を照合する手段としては敷居が高かった
- シナリオの各行が法令の号立てに対応しているため、条文の改正時に
  「どのシナリオを見直すべきか」が既存のユニットテストより直感的に
  分かる

**デメリット・トレードオフ**:
- テストの実行系統が`node --test`（ユニット）・Playwright（E2E）・
  Cucumber.js（BDD）の3種類に増え、`docs/DEVELOPMENT_GUIDE.md`・
  `README.md`で運用ルールを維持するコストが増える
- Gherkinのシナリオとステップ定義の対応関係が二重管理になる
  （フィーチャーファイルの日本語文言とステップ定義の正規表現/
  Cucumber Expressionを両方保守する必要がある）。これはBDDに
  内在するコストであり、対象を「法令根拠が特に重要な判定ロジック」
  に絞ることで最小化する
- `npm test`に含めていないため、コミット前チェックを徹底しても
  BDDシナリオの failure に気づかない可能性がある。当面は手動実行
  （`npm run test:bdd`）に委ね、実例が増えてきた段階でCI組み込みを
  再検討する

**見直しのトリガー**: 発注者が実際にGherkinシナリオを読む/更新する運用が
定着しなかった場合、または対象モジュールが1〜2件のまま増えない場合は、
本ADRを見直し、Cucumber.js自体の維持コストと得られる価値を再評価する。
