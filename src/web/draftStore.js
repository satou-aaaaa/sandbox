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
 *
 * 【世代バックアップ（Issue #183・ADR-0020）】`upsertDraft`・`removeDraft`は
 * `clientStore.js` と同様、書き戻す直前に `../core/reminders/backup.js` の
 * `backupBeforeWrite` を呼び、書き換え前の内容を `data/backup/` 配下へ
 * 世代バックアップする。
 *
 * 【下書きの有効期限警告（Issue #183）】作成から一定日数（既定30日。
 * `DRAFT_STALE_THRESHOLD_DAYS`）を超えた下書きは、一覧画面で「古い下書き」
 * として警告表示する（`isDraftStale`）。自動削除はしない（削除は常に人手操作）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { withFileLock } from "../core/reminders/fileLock.js";
import { backupBeforeWrite } from "../core/reminders/backup.js";

export const DEFAULT_DRAFTS_PATH = "data/drafts.json";

/** 下書きを「古い」として警告する閾値（日数）。推奨デフォルト値であり、発注者が調整できる。 */
export const DRAFT_STALE_THRESHOLD_DAYS = 30;

/**
 * @typedef {"construction" | "kobutsu" | "nouchi-tenyo"} DraftLicenseCategory 下書きの許可種別
 *   （フォームの種類。#73で追加。既存レコードに`licenseCategory`が無い場合は
 *   建設業許可として扱う。他の許可種別のフォームにはこの識別子で判別する
 *   仕組みが無いと「続きから入力」が誤った種別のフォームを開いてしまうため）
 */

/**
 * @typedef {Object} DraftRecord 下書き1件分
 * @property {string} id 下書きID（crypto.randomUUID()で発行）
 * @property {string} savedAt 保存日時（ISO 8601）
 * @property {DraftLicenseCategory} [licenseCategory] 下書きの許可種別（省略時は"construction"扱い）
 * @property {import('../licenses/construction/eligibility/types.js').ApplicantProfile
 *   | import('../licenses/kobutsu/eligibility/types.js').KobutsuApplicantProfile
 *   | import('../licenses/nouchi-tenyo/eligibility/types.js').NouchiTenyoApplicantProfile} profile
 */

/**
 * 下書きの許可種別を返す（旧レコードで`licenseCategory`が無い場合は建設業許可扱い）。
 * @param {DraftRecord} draft
 * @returns {DraftLicenseCategory}
 */
export function getDraftLicenseCategory(draft) {
  return draft.licenseCategory ?? "construction";
}

/**
 * 下書きが「古い」（作成からの経過日数が `thresholdDays` を超えている）かどうかを判定する。
 * 一覧画面での警告表示にのみ使う（自動削除はしない。削除は常に人手操作）。
 *
 * @param {DraftRecord} draft
 * @param {number} [thresholdDays] 既定は `DRAFT_STALE_THRESHOLD_DAYS`（30日）
 * @param {Date} [now] テスト用に基準日時を差し替え可能
 * @returns {boolean}
 */
export function isDraftStale(draft, thresholdDays = DRAFT_STALE_THRESHOLD_DAYS, now = new Date()) {
  const savedAt = new Date(draft.savedAt);
  if (Number.isNaN(savedAt.getTime())) return false;
  const elapsedDays = (now.getTime() - savedAt.getTime()) / (24 * 60 * 60 * 1000);
  return elapsedDays > thresholdDays;
}

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
 * @param {DraftRecord["profile"]} profile
 * @param {DraftLicenseCategory} [licenseCategory] 省略時は"construction"
 * @param {string} [id] 省略時は新規作成
 * @param {string} [filePath]
 * @returns {Promise<DraftRecord>} 保存した下書き（発行/確定したidを含む）
 */
export async function upsertDraft(profile, licenseCategory, id, filePath = DEFAULT_DRAFTS_PATH) {
  return withFileLock(filePath, async () => {
    const drafts = await loadDrafts(filePath);
    const draftId = id || crypto.randomUUID();
    const record = { id: draftId, savedAt: new Date().toISOString(), licenseCategory: licenseCategory ?? "construction", profile };

    const index = drafts.findIndex((d) => d.id === draftId);
    if (index >= 0) {
      drafts.splice(index, 1, record);
    } else {
      drafts.push(record);
    }
    await backupBeforeWrite(filePath);
    await saveDrafts(drafts, filePath);
    return record;
  });
}

/**
 * 下書きを1件削除する。
 * @param {string} id
 * @param {string} [filePath]
 * @returns {Promise<DraftRecord[]>} 更新後の一覧
 */
export async function removeDraft(id, filePath = DEFAULT_DRAFTS_PATH) {
  return withFileLock(filePath, async () => {
    const drafts = await loadDrafts(filePath);
    const filtered = drafts.filter((d) => d.id !== id);
    await backupBeforeWrite(filePath);
    await saveDrafts(filtered, filePath);
    return filtered;
  });
}
