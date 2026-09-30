/**
 * data/clients.json・data/drafts.json をバックアップ世代から復元するCLI（Issue #183）。
 *
 * クライアント本体データを自動的に削除する機能は無く（削除は常に人手操作）、
 * 本スクリプトはファイル破損・誤削除時の復旧専用。復元前の現在の内容も
 * 通常のバックアップと同じ仕組みで退避してから上書きする
 * （`src/core/reminders/backup.js` の `restoreFromBackup` 参照）。
 *
 * 使い方:
 *   node scripts/data-restore.js clients             バックアップ一覧を表示する（0が最新）
 *   node scripts/data-restore.js clients 0            直近世代（最新バックアップ）から復元する
 *   node scripts/data-restore.js drafts 2             3つ前の世代から復元する
 */
import { DEFAULT_CLIENTS_PATH } from "../src/core/reminders/clientStore.js";
import { DEFAULT_DRAFTS_PATH } from "../src/web/draftStore.js";
import { listBackups, restoreFromBackup } from "../src/core/reminders/backup.js";

/** @type {Record<string, string>} */
const TARGET_PATHS = { clients: DEFAULT_CLIENTS_PATH, drafts: DEFAULT_DRAFTS_PATH };

const [, , target, generationsArg] = process.argv;

if (!target || !(target in TARGET_PATHS)) {
  console.error("使い方: node scripts/data-restore.js <clients|drafts> [世代番号（0=最新。省略時は一覧表示のみ）]");
  process.exit(1);
}

const filePath = TARGET_PATHS[target];

if (generationsArg === undefined) {
  const backups = await listBackups(filePath);
  if (backups.length === 0) {
    console.log(`${filePath} のバックアップはまだありません。`);
  } else {
    console.log(`${filePath} のバックアップ一覧（0が最新）:`);
    backups.forEach((b, i) => console.log(`  [${i}] ${b.path}${b.createdAtIso ? `（${b.createdAtIso}）` : ""}`));
    console.log(`\n復元するには: node scripts/data-restore.js ${target} <世代番号>`);
  }
  process.exit(0);
}

const generationsAgo = Number(generationsArg);
if (!Number.isInteger(generationsAgo) || generationsAgo < 0) {
  console.error("世代番号は0以上の整数で指定すること（0が最新）");
  process.exit(1);
}

const restoredFrom = await restoreFromBackup(filePath, generationsAgo);
console.log(`${filePath} を復元しました（復元元: ${restoredFrom}）`);
console.log("復元前の内容も通常のバックアップとして退避済みです。内容を確認してください（押印・提出前の最終確認は必ず人手で行うこと）。");
