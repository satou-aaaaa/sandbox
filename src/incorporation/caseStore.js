/**
 * 会社設立サポート案件（`IncorporationCaseRecord`）のローカルJSON永続化。
 *
 * 既存の`src/core/reminders/clientStore.js`・`src/portal/caseStore.js`と
 * 同じ設計パターン（単一JSONファイル・`fs.readFile`/`writeFile`・
 * ディレクトリ自動作成・`withFileLock`によるread-modify-writeの直列化）を
 * 踏襲する（`docs/DESIGN_kaisha-secchi-support.md` 4.1節）。
 *
 * 【重要】保存されるデータには依頼者の氏名・出資額等が含まれうる。
 * 外部への送信は一切行わない（NFR-4）。`data/`は.gitignoreで除外しており、
 * 実データをリポジトリにコミットしないこと（NFR-5）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { withFileLock } from "../core/reminders/fileLock.js";

export const DEFAULT_CASES_PATH = "data/incorporation-cases.json";

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
 * 会社設立サポート案件の一覧を読み込む。ファイルが存在しない場合は空配列を返す。
 * @param {string} [filePath]
 * @returns {Promise<import('./types.js').IncorporationCaseRecord[]>}
 */
export async function loadCases(filePath = DEFAULT_CASES_PATH) {
  return loadJsonArray(filePath);
}

/**
 * 会社設立サポート案件の一覧をJSONファイルへ書き出す。
 * @param {import('./types.js').IncorporationCaseRecord[]} cases
 * @param {string} [filePath]
 */
export async function saveCases(cases, filePath = DEFAULT_CASES_PATH) {
  await saveJsonArray(cases, filePath);
}

/**
 * 案件を1件、追加・上書きする（同じ`caseId`が既にあれば置き換える）。
 * @param {import('./types.js').IncorporationCaseRecord} record
 * @param {string} [filePath]
 * @returns {Promise<import('./types.js').IncorporationCaseRecord[]>} 更新後の一覧
 */
export async function upsertCase(record, filePath = DEFAULT_CASES_PATH) {
  return withFileLock(filePath, async () => {
    const cases = await loadCases(filePath);
    const index = cases.findIndex((c) => c.caseId === record.caseId);
    if (index >= 0) {
      cases[index] = record;
    } else {
      cases.push(record);
    }
    await saveCases(cases, filePath);
    return cases;
  });
}

/**
 * 案件を1件削除する。
 * @param {string} caseId
 * @param {string} [filePath]
 * @returns {Promise<import('./types.js').IncorporationCaseRecord[]>} 更新後の一覧
 */
export async function removeCase(caseId, filePath = DEFAULT_CASES_PATH) {
  return withFileLock(filePath, async () => {
    const cases = await loadCases(filePath);
    const filtered = cases.filter((c) => c.caseId !== caseId);
    await saveCases(filtered, filePath);
    return filtered;
  });
}
