/**
 * `data/clients.json`・`data/drafts.json` 等、単一JSONファイルで永続化している
 * ローカルデータの世代バックアップ（Issue #183・ADR-0020）。
 *
 * 【方針】`withFileLock` で保護された書き込み処理の内部、新しい内容を書き出す
 * 直前に、書き換え前のファイル内容をタイムスタンプ付きで `backup/` 配下へ
 * コピーし、直近N世代だけを残して古いものを自動削除する。本モジュールは
 * ローカルファイルのコピー・削除のみを行い、外部送信は一切行わない
 * （DESIGN.md 1章の「外部送信をしない」前提に抵触しない）。
 *
 * 【スコープ外】クライアント本体データ（`clients.json`）を自動的に削除する
 * 機能は実装しない（データ消失リスクがあるため、削除は常に人手操作。
 * ここで行う「古い世代の自動削除」はあくまで `backup/` 配下の複製に対してのみ）。
 *
 * 【世代数・保存先の既定値】直近7世代・`<対象ファイルと同じディレクトリ>/backup/`
 * は推奨デフォルト値であり、発注者が実運用に応じて調整できる
 * （`docs/adr/0020-client-data-backup-and-retention-defaults.md` 参照）。
 *
 * 【法令根拠の対象外】本モジュールは許認可の要件判定・期限計算ロジックではなく、
 * データ保全のための補助機能のため、根拠法令URLの記載対象外
 * （`scripts/lib/legalBasis.mjs` の対象ディレクトリパターンにも合致しない）。
 */
import fs from "node:fs/promises";
import path from "node:path";

/** 既定の保持世代数。 */
export const DEFAULT_GENERATIONS = 7;

/**
 * 対象ファイルの既定バックアップ先（同じディレクトリの `backup/` サブディレクトリ）。
 * @param {string} filePath
 * @returns {string}
 */
export function defaultBackupDir(filePath) {
  return path.join(path.dirname(filePath), "backup");
}

/**
 * プロセス内で単調増加する連番（同一ミリ秒内に複数回バックアップが発生しても、
 * ファイル名の文字列比較が呼び出し順と一致するようにするための無しタイブレーカー）。
 * ランダム値ではなく連番にしているのは、`Date.now()` のミリ秒精度では
 * 高速な連続書き込み時にタイムスタンプが衝突しうるため、ソート順が
 * 実際の発生順と食い違わないようにするため（Issue #183のレビューで発見）。
 */
let sequenceCounter = 0;

/**
 * ファイル名に使えない文字（Windowsでは `:` 等）を含まず、ソート順が
 * 常に呼び出し順（＝時系列）と一致する文字列を作る。
 * @param {Date} [now]
 * @returns {string}
 */
function safeTimestamp(now = new Date()) {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  const seq = String(sequenceCounter++).padStart(8, "0");
  return `${iso}-${seq}`;
}

/**
 * `dir` 配下から、`base` + `-` で始まり `ext` で終わるバックアップファイル名を、
 * 古い順（ファイル名の昇順 = タイムスタンプの昇順）に列挙する。
 * ディレクトリが存在しない場合は空配列を返す。
 * @param {string} dir
 * @param {string} base
 * @param {string} ext
 * @returns {Promise<string[]>}
 */
async function listBackupFilenames(dir, base, ext) {
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return [];
    throw err;
  }
  const prefix = `${base}-`;
  return entries
    .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
    .sort();
}

/**
 * 直近N世代を超える古いバックアップを削除する。
 * @param {string} backupDir
 * @param {string} base
 * @param {string} ext
 * @param {number} generations
 * @returns {Promise<string[]>} 削除したファイルのパス一覧
 */
async function pruneOldBackups(backupDir, base, ext, generations) {
  const filenames = await listBackupFilenames(backupDir, base, ext);
  const excess = filenames.length - generations;
  if (excess <= 0) return [];
  const toDelete = filenames.slice(0, excess);
  await Promise.all(toDelete.map((f) => fs.unlink(path.join(backupDir, f))));
  return toDelete.map((f) => path.join(backupDir, f));
}

/**
 * `filePath` の書き換え前バックアップを1件作成し、直近 `generations` 世代
 * だけを残して古いものを削除する。`filePath` がまだ存在しない場合（初回の
 * 書き込み時等）は何もしない。
 *
 * @param {string} filePath 対象ファイル（例: "data/clients.json"）
 * @param {{ backupDir?: string, generations?: number }} [options]
 * @returns {Promise<string | undefined>} 作成したバックアップファイルのパス（作成しなかった場合は undefined）
 */
export async function backupBeforeWrite(filePath, options = {}) {
  const generations = options.generations ?? DEFAULT_GENERATIONS;
  const backupDir = options.backupDir ?? defaultBackupDir(filePath);

  try {
    await fs.access(filePath);
  } catch {
    // 元ファイルが無い（初回書き込み等）場合はバックアップ対象が無いため何もしない
    return undefined;
  }

  await fs.mkdir(backupDir, { recursive: true });
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const backupPath = path.join(backupDir, `${base}-${safeTimestamp()}${ext}`);
  await fs.copyFile(filePath, backupPath);

  await pruneOldBackups(backupDir, base, ext, generations);
  return backupPath;
}

/**
 * @typedef {Object} BackupEntry
 * @property {string} path バックアップファイルのパス
 * @property {string} [createdAtIso] ファイル名から読み取れる作成日時（ISO 8601相当。パース不能な場合はundefined）
 */

/**
 * `filePath` のバックアップ一覧を新しい順（直近世代が先頭）に返す。
 * @param {string} filePath
 * @param {string} [backupDir]
 * @returns {Promise<BackupEntry[]>}
 */
export async function listBackups(filePath, backupDir = defaultBackupDir(filePath)) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const filenames = await listBackupFilenames(backupDir, base, ext);
  return filenames
    .slice()
    .reverse()
    .map((f) => ({
      path: path.join(backupDir, f),
      createdAtIso: filenameToIso(f, base, ext),
    }));
}

/**
 * バックアップファイル名（`<base>-<timestamp>-<suffix><ext>`）から、
 * 表示用のISO 8601日時文字列を復元する。復元できない場合はundefined。
 * @param {string} filename
 * @param {string} base
 * @param {string} ext
 * @returns {string | undefined}
 */
function filenameToIso(filename, base, ext) {
  const middle = filename.slice(base.length + 1, filename.length - ext.length);
  const match = middle.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-\d{8}$/);
  if (!match) return undefined;
  const [, datePart, hh, mm, ss, ms] = match;
  return `${datePart}T${hh}:${mm}:${ss}.${ms}Z`;
}

/**
 * `filePath` を、直近 `generationsAgo` 番目（0 = 最新）のバックアップの内容で
 * 復元する。復元前に、現在の内容も通常のバックアップと同じ仕組みで退避する
 * （誤操作からの安全策。世代数の上限は超えない）。
 *
 * @param {string} filePath
 * @param {number} [generationsAgo] 0 = 最新のバックアップ
 * @param {{ backupDir?: string, generations?: number }} [options]
 * @returns {Promise<string>} 復元元として使ったバックアップファイルのパス
 */
export async function restoreFromBackup(filePath, generationsAgo = 0, options = {}) {
  const backupDir = options.backupDir ?? defaultBackupDir(filePath);
  const backups = await listBackups(filePath, backupDir);
  // generationsAgo の範囲外チェック（負数・非整数）は呼び出し元（data-restore.js）が行う。
  // ここでの添字アクセスは、外部入力が直接キーになるものではない。
  // eslint-disable-next-line security/detect-object-injection
  const target = backups[generationsAgo];
  if (!target) {
    throw new Error(
      `復元対象のバックアップが見つかりません（${filePath}, generationsAgo=${generationsAgo}, 現在のバックアップ数=${backups.length}）`
    );
  }

  // 上書き前に、復元対象の内容を読み込んでおく（直後の安全策バックアップの
  // 世代削除で、復元元ファイル自体が消えてしまう前に確保するため）。
  const content = await fs.readFile(target.path, "utf8");

  await backupBeforeWrite(filePath, options);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  return target.path;
}
