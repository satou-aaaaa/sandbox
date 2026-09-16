/**
 * 相続案件（SuccessionCaseRecord）を data/succession-cases.json に
 * 登録・更新するCLI。
 *
 * 家族構成は簡易化のため、次の形式で子・直系尊属・兄弟姉妹を指定する
 * （代襲相続人・詳細なフラグの設定はこのCLIでは対応しない。より複雑な
 * ケースはdata/succession-cases.jsonを直接編集するか、専用スクリプトを
 * 別途作成すること）。
 *
 * 使い方:
 *   node scripts/succession-case-add.js "<caseId>" --death-date <死亡日YYYY-MM-DD>
 *     [--case-label "<案件名>"] [--known-date <相続開始を知った日YYYY-MM-DD>]
 *     [--has-spouse true|false] [--spouse-alive true|false]
 *     [--child "<personId>:<label>:生存/死亡"] [--child ...]
 *     [--status 遺産分割協議書作成中|自筆証書遺言作成支援中|完了|保留]
 *     [--has-dispute true|false] [--notes "<メモ>"]
 *
 * 例（配偶者と子2人。争いなし）:
 *   node scripts/succession-case-add.js case-001 --death-date 2026-06-01 --case-label "サンプル家 相続手続き" --has-spouse true --spouse-alive true --child "child-1:長男:生存" --child "child-2:長女:生存"
 *
 * 【重要】相続人間の争いの有無（--has-dispute）は自動判定しません。
 * 発注者が人手で確認した結果を必ず入力してください（NFR-S1）。
 */
import { upsertCase } from "../src/succession/caseStore.js";

const USAGE = [
  '使い方: node scripts/succession-case-add.js "<caseId>" --death-date <死亡日YYYY-MM-DD> ' +
    '[--case-label "<案件名>"] [--known-date <YYYY-MM-DD>] [--has-spouse true|false] [--spouse-alive true|false] ' +
    '[--child "<personId>:<label>:生存/死亡"] [--child ...] ' +
    "[--status 遺産分割協議書作成中|自筆証書遺言作成支援中|完了|保留] " +
    '[--has-dispute true|false] [--notes "<メモ>"]',
  "同じ<caseId>を指定すると、その案件の更新になります（familyStructureからlastCalculatedResultが自動再計算されます）。",
  "相続人間の争いの有無（--has-dispute）は自動判定しません。必ず人手で確認した結果を入力してください（NFR-S1）。",
].join("\n");

const [, , caseId, ...rest] = process.argv;

/** @type {Record<string, string[]>} */
const multiOptions = {};
/** @type {Record<string, string>} */
const options = {};
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i];
  const value = rest[i + 1];
  if (!key || !key.startsWith("--") || value === undefined) {
    console.error(USAGE);
    process.exit(1);
  }
  const name = key.slice(2);
  if (name === "child") {
    multiOptions[name] = [...(multiOptions[name] ?? []), value];
  } else {
    options[name] = value;
  }
}

if (!caseId || !options["death-date"]) {
  console.error(USAGE);
  process.exit(1);
}

/** @type {import('../src/succession/types.js').HeirCandidateInput[]} */
const children = (multiOptions["child"] ?? []).map((raw) => {
  const [personId, label, aliveRaw] = raw.split(":");
  if (!personId) {
    console.error(`--childの形式が不正です（<personId>:<label>:生存/死亡。指定値: ${raw}）`);
    process.exit(1);
  }
  /** @type {import('../src/succession/types.js').HeirCandidateInput} */
  const child = { personId, isAlive: aliveRaw !== "死亡" };
  if (label) child.label = label;
  return child;
});

const hasSpouse = options["has-spouse"] === "true";

/** @type {import('../src/succession/types.js').FamilyStructureInput} */
const familyStructure = {
  caseId,
  decedentDeathDateIso: options["death-date"],
  hasSpouse,
  children,
  ascendants: [],
  siblings: [],
};
if (hasSpouse) familyStructure.spouseIsAlive = options["spouse-alive"] === "true";
if (options["known-date"]) familyStructure.decedentDeathKnownDateIso = options["known-date"];

/** @type {import('../src/succession/types.js').SuccessionCaseRecord} */
const caseRecord = {
  caseId,
  decedentDeathDateIso: options["death-date"],
  familyStructure,
  status: /** @type {import('../src/succession/types.js').SuccessionCaseRecord["status"]} */ (
    options["status"] ?? "遺産分割協議書作成中"
  ),
  hasDisputeAmongHeirs: options["has-dispute"] === "true",
};
if (options["case-label"]) caseRecord.caseLabel = options["case-label"];
if (options["known-date"]) caseRecord.decedentDeathKnownDateIso = options["known-date"];
if (options["notes"]) caseRecord.notes = [options["notes"]];

const cases = await upsertCase(caseRecord);
const saved = cases.find((c) => c.caseId === caseId);
console.log(
  `登録しました: ${caseRecord.caseLabel ?? caseId}（法定相続パターン: ${saved?.lastCalculatedResult?.pattern ?? "不明"}、` +
    `登録済み案件数: ${cases.length}）`
);
