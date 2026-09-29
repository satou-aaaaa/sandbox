/**
 * 排他ロック（ファイルベース）。定期実行が重なって同じIssueを二重に処理するのを防ぐ。
 * 判定ロジックは policy.js の isLockStale（純粋関数）に置く。
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isLockStale } from "./policy.js";

/** @param {number} pid */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM は「存在するが権限がない」＝生きている
    return /** @type {any} */ (err).code === "EPERM";
  }
}

/**
 * ロックを取得する。残骸なら奪い取って取得する。
 * @param {string} file
 * @returns {boolean} 取得できたか（他の実行が進行中ならfalse）
 */
export function acquireLock(file) {
  mkdirSync(dirname(file), { recursive: true });
  const mine = JSON.stringify({ pid: process.pid, startedAt: Date.now() });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(file, mine, { flag: "wx" });
      return true;
    } catch (err) {
      if (/** @type {any} */ (err).code !== "EEXIST") throw err;
    }
    /** @type {{pid: number, startedAt: number} | null} */
    let info;
    try {
      info = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      info = null; // 壊れたロックは残骸として扱う
    }
    if (!isLockStale(info, Date.now(), isAlive)) return false;
    try {
      unlinkSync(file);
    } catch {
      /* 他の実行が先に奪った場合は、次の試行で再判定する */
    }
  }
  return false;
}

/** @param {string} file 自分が取得したロックを解放する */
export function releaseLock(file) {
  try {
    const info = JSON.parse(readFileSync(file, "utf8"));
    if (info.pid === process.pid) unlinkSync(file);
  } catch {
    /* 既に無ければ何もしない */
  }
}
