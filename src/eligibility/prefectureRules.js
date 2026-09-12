/**
 * 都道府県固有の追加要件を登録・適用するための仕組み（M6の土台）。
 *
 * 【重要】このファイル自体は特定の都道府県の実際の法的要件を一切含まない。
 * 対象都道府県が発注者側で確定し（docs/REQUIREMENTS.md 8章）、固有要件の
 * 内容が判明した時点で、`registerPrefectureRules()` を使って
 * `src/eligibility/prefectures/<都道府県名>.js` のような別モジュールとして
 * 追加すること。既存の共通5要件モジュール（`src/eligibility/rules/*.js`）は
 * 直接改変しない（docs/DESIGN.md §9「M6 複数都道府県対応」の方針を実装したもの）。
 *
 * ApplicantProfile には既に `prefecture`（都道府県名）フィールドがあるため
 * （M2で書類生成用に追加）、これをそのままキーとして再利用する。
 */

/**
 * @typedef {(profile: import('./types.js').ApplicantProfile) => import('./types.js').RequirementCheckResult[]} PrefectureCheckFn
 */

/** @type {Map<string, PrefectureCheckFn>} */
const registry = new Map();

/**
 * 都道府県固有の追加要件チェック関数を登録する。
 * 同じ都道府県名で再登録した場合は上書きする。
 *
 * @param {string} prefecture 都道府県名（ApplicantProfile.prefecture と一致させる）
 * @param {PrefectureCheckFn} checkFn プロフィールを受け取り、追加のRequirementCheckResult[]を返す関数
 */
export function registerPrefectureRules(prefecture, checkFn) {
  registry.set(prefecture, checkFn);
}

/**
 * 指定した都道府県に登録済みのチェック関数を取得する。
 * 未登録、または prefecture が未入力の場合は undefined を返す
 * （＝共通5要件のみで判定する、既存のM1〜M4の挙動を維持する）。
 *
 * @param {string | undefined} prefecture
 * @returns {PrefectureCheckFn | undefined}
 */
export function getPrefectureRules(prefecture) {
  return prefecture ? registry.get(prefecture) : undefined;
}

/**
 * 登録内容をすべて消去する。テストでの後片付け専用
 * （本番コードから呼ぶことは想定していない）。
 */
export function clearPrefectureRules() {
  registry.clear();
}
