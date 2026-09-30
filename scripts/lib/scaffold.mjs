/**
 * 新しい許可種別アドオンの雛形を作る純粋関数（ファイルは書かない。書き込みは scripts/scaffold-module.mjs）。
 *
 * 作るのは「骨組み」だけで、判定ロジック・法令根拠は含めない。法令根拠URLの場所には
 * `TODO(法令根拠)` を置き、test/invariants.test.js が残っていれば失敗させる（人が原文を確認して埋める）。
 * 既存アドオン（例: kobutsu）と同じ構成・命名・登録方式に揃える（CLAUDE.md「コーディング規約」）。
 */

/**
 * @param {string} name ケバブケースのモジュール名（例: `shokuhin-hanbai`）
 * @returns {string} キャメルケース（例: `shokuhinHanbai`）
 */
export function toCamel(name) {
  return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/**
 * @param {string} name
 * @returns {string} パスカルケース（例: `ShokuhinHanbai`）
 */
export function toPascal(name) {
  const c = toCamel(name);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * @param {string} name ケバブケースのモジュール名
 * @param {string} label 日本語の名称（例: 食品販売業許可）
 * @returns {Record<string, string>} リポジトリルートからの相対パス → ファイル内容
 */
export function buildScaffold(name, label) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) throw new Error(`モジュール名はケバブケースの英小文字で指定してください: ${name}`);
  if (!label.trim()) throw new Error("日本語の名称を指定してください");
  const camel = toCamel(name);
  const pascal = toPascal(name);
  const base = `src/licenses/${name}`;
  const legalTodo = "TODO(法令根拠): 根拠となる法令・公式情報源のURLをここに記載する（原文を確認した日付も添える）";

  /** @type {Record<string, string>} */
  const files = {};

  files[`${base}/eligibility/types.js`] = `/**
 * ${label}の申請者データの型定義（JSDoc）。単一の情報源とし、様式ごと・機能ごとに別の型を作らない（ADR-0002）。
 *
 * @typedef {Object} ${pascal}ApplicantProfile
 * @property {string} applicantName 申請者名
 * @property {${pascal}Kekkaku} kekkaku 欠格事由の該当状況
 *
 * @typedef {Object} ${pascal}Kekkaku
 * @property {boolean} hasDisqualification 欠格事由に該当するか（TODO: 法令の条文に沿って項目を分ける）
 */

export {};
`;

  files[`${base}/eligibility/kekkaku.js`] = `/**
 * ${label}の欠格事由を判定する（1要件・1ファイル）。
 *
 * ${legalTodo}
 *
 * @param {import('./types.js').${pascal}Kekkaku} kekkaku
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function check${pascal}Kekkaku(kekkaku) {
  /** @type {string[]} */
  const reasons = [];
  /** @type {string[]} */
  const warnings = [];
  if (kekkaku.hasDisqualification) {
    reasons.push("欠格事由に該当します（TODO: 該当条文と理由を具体的に書く）");
  } else {
    reasons.push("欠格事由に該当しません");
  }
  return {
    key: "kekkaku",
    label: "欠格事由",
    passed: !kekkaku.hasDisqualification,
    reasons,
    warnings,
  };
}
`;

  files[`${base}/eligibility/engine.js`] = `import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { check${pascal}Kekkaku } from "./kekkaku.js";

/**
 * ${label}の要件をまとめて判定する。
 *
 * 判定結果はあくまで「申請前のセルフチェック・要件充足の一次スクリーニング」であり、
 * 最終的な適格性の判断と申請書類への責任は、登録行政書士本人が負う。
 *
 * @param {import('./types.js').${pascal}ApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluate${pascal}Eligibility(profile) {
  const checks = [check${pascal}Kekkaku(profile.kekkaku)];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
}

/**
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function format${pascal}EligibilityReport(result) {
  const lines = ["# ${label} 要件判定結果", "", ...formatChecksSection(result.checks)];
  lines.push(result.eligible ? "総合判定: 全要件を満たします（最終確認は人手で行うこと）" : ["総合判定: 未充足の要件があります", ...result.blockingIssues.map((i) => \`- \${i}\`)].join("\\n"));
  return lines.join("\\n");
}
`;

  files[`${base}/index.js`] = `/**
 * ${label}アドオンをコアへ登録するエントリポイント。
 * 更新・変更のリマインドを計算するより前に、この関数を呼ぶこと
 * （scripts/reminder-digest.js と src/web/ の登録箇所にも追加する）。
 *
 * ${legalTodo}
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";

/**
 * @param {import('../../core/reminders/digest.js').LicenseEntry} _license
 * @returns {import('../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
function ${camel}ScheduleFn(_license) {
  return []; // TODO: 期限の起点（満了日固定・変更トリガー型など。ADR-0014・0015）に応じて実装する
}

export function register${pascal}License() {
  registerScheduleFn("${name}", ${camel}ScheduleFn);
}
`;

  files[`test/${camel}Engine.test.js`] = `import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate${pascal}Eligibility } from "../src/licenses/${name}/eligibility/engine.js";

const okProfile = () => ({ applicantName: "テスト太郎", kekkaku: { hasDisqualification: false } });

test("evaluate${pascal}Eligibility: 欠格事由が無ければ eligible=true", () => {
  const result = evaluate${pascal}Eligibility(okProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.blockingIssues.length, 0);
});

test("evaluate${pascal}Eligibility: 欠格事由に該当すれば eligible=false", () => {
  const profile = okProfile();
  profile.kekkaku.hasDisqualification = true;
  const result = evaluate${pascal}Eligibility(profile);
  assert.equal(result.eligible, false);
  assert.equal(result.blockingIssues.length, 1);
});
`;

  files[`docs/DESIGN_${name}-core.md`] = `# 設計書 — ${label}モジュール

version: 0.1 / 雛形（scripts/scaffold-module.mjs で生成。内容は人が埋める）
対応する要件定義書: \`docs/REQUIREMENTS_${name}-core.md\`

> 章立て・記法は \`docs/DESIGN_kobutsu-core.md\` に合わせる。共通の設計原則
> （ビルドレス・外部送信なし・人手レビュー必須）は \`docs/DESIGN.md\` 1章を継承する。

## 1. 設計原則

- TODO: このモジュール固有の原則（あれば）

## 2. 法令根拠

- ${legalTodo}

## 3. 判定ロジック

- \`src/licenses/${name}/eligibility/\` に1要件・1ファイルで置く
- TODO: 要件ごとの判定方法

## 4. リマインド

- TODO: 期限の起点のパターン（ADR-0014・0015）

## 改訂履歴

- 0.1: 雛形を生成
`;

  files[`docs/REQUIREMENTS_${name}-core.md`] = `# 要件定義書 — ${label}モジュール

version: 0.1 / 雛形（scripts/scaffold-module.mjs で生成。内容は人が埋める）
対応する設計書: \`docs/DESIGN_${name}-core.md\`

## 1. 背景と目的

- TODO: 誰のどの業務を、どこまで自動化するか（「最終レビューと押印だけ」に絞る）

## 2. スコープ

- TODO: 対象とする手続き・対象外とする手続き（独占業務との境界を含む）

## 3. 機能要件

- TODO

## 4. 非機能要件

- 外部送信をしない・実データをコミットしない（\`docs/REQUIREMENTS.md\` のNFRを継承）

## 改訂履歴

- 0.1: 雛形を生成
`;

  return files;
}

/**
 * 雛形を作ったあとに人が行う作業の一覧。
 * @param {string} name
 * @param {string} label
 * @returns {string[]}
 */
export function followUpChecklist(name, label) {
  return [
    `test/docsConsistency.test.js の MODULE_DOCS に "licenses/${name}": "${name}-core" を追加する`,
    `CLAUDE.md のディレクトリ構成に ${name}/ の説明（${label}）を追加する`,
    `scripts/reminder-digest.js と src/web/ で register${toPascal(name)}License() を呼ぶ`,
    "TODO(法令根拠) を、原文を確認したURLに置き換える（残っていると npm test が失敗する）",
    `docs/DESIGN_${name}-core.md・docs/REQUIREMENTS_${name}-core.md の TODO を埋める`,
    `判定ロジックを実装し、test/${toCamel(name)}Engine.test.js を拡充する`,
  ];
}
