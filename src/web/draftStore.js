/**
 * インテイクフォームの入力途中のデータ（下書き）をローカルのJSONファイルに
 * 保存・読込する。
 *
 * 長い入力フォームを一度に埋めきれない場合に備え、途中で保存して後から
 * 続きを入力できるようにする（M3のインテイクフォームの使い勝手向上）。
 *
 * clientStore.js と同じ設計方針を踏襲する: DBは使わず単一のJSONファイルに
 * 保存する（既定: data/drafts.json）。実データ（顧客の氏名等）を含みうるため
 * data/ は .gitignore で除外している（NFR-4/NFR-5）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const DEFAULT_DRAFTS_PATH = "data/drafts.json";

/**
 * @typedef {Object} DraftRecord 下書き1件分
 * @property {string} id 下書きID（crypto.randomUUID()で発行）
 * @property {string} savedAt 保存日時（ISO 8601）
 * @property {import('../eligibility/types.js').ApplicantProfile} profile
 */

/**
 * 下書き一覧を読み込む。ファイルが存在しない場合は空配列を返す。
 * @param {string} [filePath]
 * @returns {Promise<DraftRecord[]>}
 */
export async function loadDrafts(filePath = DEFAULT_DRAFTS_PATH) {
  let text;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error(`${filePath} の内容が配列ではありません`);
  }
  return data;
}

/**
 * 下書き一覧をJSONファイルへ書き出す。
 * @param {DraftRecord[]} drafts
 * @param {string} [filePath]
 */
export async function saveDrafts(drafts, filePath = DEFAULT_DRAFTS_PATH) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(drafts, null, 2) + "\n", "utf8");
}

/**
 * 指定IDの下書きを1件取得する。存在しない場合は undefined を返す。
 * @param {string} id
 * @param {string} [filePath]
 * @returns {Promise<DraftRecord | undefined>}
 */
export async function getDraft(id, filePath = DEFAULT_DRAFTS_PATH) {
  const drafts = await loadDrafts(filePath);
  return drafts.find((d) => d.id === id);
}

/**
 * 下書きを保存する。id を指定すれば既存の下書きを上書き更新し、
 * 指定しなければ新規のIDを発行して追加する。
 *
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @param {string} [id] 省略時は新規作成
 * @param {string} [filePath]
 * @returns {Promise<DraftRecord>} 保存した下書き（発行/確定したidを含む）
 */
export async function upsertDraft(profile, id, filePath = DEFAULT_DRAFTS_PATH) {
  const drafts = await loadDrafts(filePath);
  const draftId = id || crypto.randomUUID();
  const record = { id: draftId, savedAt: new Date().toISOString(), profile };

  const index = drafts.findIndex((d) => d.id === draftId);
  if (index >= 0) {
    drafts[index] = record;
  } else {
    drafts.push(record);
  }
  await saveDrafts(drafts, filePath);
  return record;
}

/**
 * 下書きを1件削除する。
 * @param {string} id
 * @param {string} [filePath]
 * @returns {Promise<DraftRecord[]>} 更新後の一覧
 */
export async function removeDraft(id, filePath = DEFAULT_DRAFTS_PATH) {
  const drafts = await loadDrafts(filePath);
  const filtered = drafts.filter((d) => d.id !== id);
  await saveDrafts(filtered, filePath);
  return filtered;
}
