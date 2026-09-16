/**
 * 相続案件（`SuccessionCaseRecord`）のローカルJSON永続化。
 *
 * 既存の`src/core/reminders/clientStore.js`・`src/portal/caseStore.js`と
 * 同じ設計パターン（単一JSONファイル・`fs.readFile`/`writeFile`・
 * ディレクトリ自動作成・`withFileLock`によるread-modify-writeの直列化）を
 * 踏襲する（`docs/DESIGN_souzoku-support.md` 4.4節）。
 *
 * `upsertCase`は、`familyStructure`が更新されるたびに`calcLegalHeirs`を
 * 呼び直し、`lastCalculatedResult`を上書きする（呼び出し側が計算結果の
 * 再計算を忘れないようにするため、更新関数の内部で自動的に再計算する）。
 *
 * 【重要】保存されるデータには相続人・被相続人の氏名等の個人情報が含まれる。
 * 外部への送信は一切行わない（NFR-4）。`data/`は.gitignoreで除外しており、
 * 実データをリポジトリにコミットしないこと（NFR-5）。マイナンバー等の
 * 機微情報は型定義上そもそも保持できない（NFR-S2）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { withFileLock } from "../core/reminders/fileLock.js";
import { calcLegalHeirs } from "./heirs/calcLegalHeirs.js";

export const DEFAULT_SUCCESSION_CASES_PATH = "data/succession-cases.json";

/**
 * @param {string} filePath
 * @returns {Promise<any[]>}
 */
async function loadJsonArray(filePath) {
  let text;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return [];
    throw err;
  }
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error(`${filePath} の内容が配列ではありません`);
  }
  return data;
}

/**
 * @param {any[]} records
 * @param {string} filePath
 */
async function saveJsonArray(records, filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(records, null, 2) + "\n", "utf8");
}

/**
 * 相続案件の一覧を読み込む。ファイルが存在しない場合は空配列を返す。
 * @param {string} [filePath]
 * @returns {Promise<import('./types.js').SuccessionCaseRecord[]>}
 */
export async function loadCases(filePath = DEFAULT_SUCCESSION_CASES_PATH) {
  return loadJsonArray(filePath);
}

/**
 * 相続案件の一覧をJSONファイルへ書き出す。
 * @param {import('./types.js').SuccessionCaseRecord[]} cases
 * @param {string} [filePath]
 */
export async function saveCases(cases, filePath = DEFAULT_SUCCESSION_CASES_PATH) {
  await saveJsonArray(cases, filePath);
}

/**
 * 案件を1件、追加・上書きする（同じ`caseId`が既にあれば置き換える）。
 * `familyStructure`から`calcLegalHeirs`を自動的に再計算し、
 * `lastCalculatedResult`を常に最新の状態に保つ。
 * @param {import('./types.js').SuccessionCaseRecord} record
 * @param {string} [filePath]
 * @returns {Promise<import('./types.js').SuccessionCaseRecord[]>} 更新後の一覧
 */
export async function upsertCase(record, filePath = DEFAULT_SUCCESSION_CASES_PATH) {
  return withFileLock(filePath, async () => {
    const cases = await loadCases(filePath);
    const recalculated = { ...record, lastCalculatedResult: calcLegalHeirs(record.familyStructure) };
    const index = cases.findIndex((c) => c.caseId === record.caseId);
    if (index >= 0) {
      cases[index] = recalculated;
    } else {
      cases.push(recalculated);
    }
    await saveCases(cases, filePath);
    return cases;
  });
}

/**
 * 案件を1件削除する。
 * @param {string} caseId
 * @param {string} [filePath]
 * @returns {Promise<import('./types.js').SuccessionCaseRecord[]>} 更新後の一覧
 */
export async function removeCase(caseId, filePath = DEFAULT_SUCCESSION_CASES_PATH) {
  return withFileLock(filePath, async () => {
    const cases = await loadCases(filePath);
    const filtered = cases.filter((c) => c.caseId !== caseId);
    await saveCases(filtered, filePath);
    return filtered;
  });
}
