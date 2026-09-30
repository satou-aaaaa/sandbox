/**
 * data/clients.json・data/drafts.json の手動世代バックアップCLI（Issue #183）。
 *
 * 通常は `withFileLock` 経由の書き込みの都度、自動的にバックアップが作成される
 * （`src/core/reminders/backup.js`）。本スクリプトは、書き込みを伴わない
 * タイミングでの手動バックアップや、バックアップ一覧の確認に使う。
 *
 * 使い方:
 *   npm run data:backup            バックアップ一覧を表示する（対象ファイルごと）
 *   npm run data:backup -- --now   今すぐバックアップを1件作成する（直近7世代を超えた分は自動削除）
 */
import { DEFAULT_CLIENTS_PATH } from "../src/core/reminders/clientStore.js";
import { DEFAULT_DRAFTS_PATH } from "../src/web/draftStore.js";
import { backupBeforeWrite, listBackups } from "../src/core/reminders/backup.js";

const TARGETS = [
  { label: "クライアント", filePath: DEFAULT_CLIENTS_PATH },
  { label: "下書き", filePath: DEFAULT_DRAFTS_PATH },
];

const mode = process.argv[2];

if (mode === "--now") {
  for (const { label, filePath } of TARGETS) {
    const backupPath = await backupBeforeWrite(filePath);
    if (backupPath) {
      console.log(`${label}（${filePath}）: バックアップを作成しました → ${backupPath}`);
    } else {
      console.log(`${label}（${filePath}）: 対象ファイルがまだ存在しないためスキップしました`);
    }
  }
} else if (mode === undefined) {
  for (const { label, filePath } of TARGETS) {
    const backups = await listBackups(filePath);
    console.log(`${label}（${filePath}）: バックアップ${backups.length}件`);
    backups.forEach((b, i) => console.log(`  [${i}] ${b.path}${b.createdAtIso ? `（${b.createdAtIso}）` : ""}`));
  }
  console.log("\n今すぐバックアップを作成するには: npm run data:backup -- --now");
  console.log("復元するには: npm run data:restore -- <clients|drafts> <世代番号（0が最新）>");
} else {
  console.error("使い方: npm run data:backup [-- --now]");
  process.exit(1);
}
