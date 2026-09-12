/**
 * M4の土台: クライアントの許可情報をローカルのJSONファイルに保存・読込する。
 *
 * 【重要】保存されるデータには顧客名・許可年月日等が含まれうる。外部への送信は
 * 一切行わない（NFR-4）。保存先（既定: data/clients.json）は .gitignore で
 * 除外しており、実データをリポジトリにコミットしないこと（NFR-5）。
 * データベース等は導入せず、単一のJSONファイルによる素朴な永続化に留める
 * （個人の副業運用を想定した最小構成。DEVELOPMENT_GUIDE.md 6章の方針）。
 */
import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CLIENTS_PATH = "data/clients.json";

/**
 * クライアント一覧を読み込む。ファイルが存在しない場合は空配列を返す
 * （初回利用時にエラーにしないため）。
 *
 * @param {string} [filePath]
 * @returns {Promise<import('./reminderDigest.js').ClientLicenseRecord[]>}
 */
export async function loadClients(filePath = DEFAULT_CLIENTS_PATH) {
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
 * クライアント一覧をJSONファイルへ書き出す。出力先ディレクトリが
 * 存在しない場合は自動作成する。
 *
 * @param {import('./reminderDigest.js').ClientLicenseRecord[]} clients
 * @param {string} [filePath]
 */
export async function saveClients(clients, filePath = DEFAULT_CLIENTS_PATH) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(clients, null, 2) + "\n", "utf8");
}

/**
 * クライアントを1件追加・更新する（同名クライアントが既にあれば上書きする）。
 * @param {import('./reminderDigest.js').ClientLicenseRecord} record
 * @param {string} [filePath]
 * @returns {Promise<import('./reminderDigest.js').ClientLicenseRecord[]>} 更新後の一覧
 */
export async function upsertClient(record, filePath = DEFAULT_CLIENTS_PATH) {
  const clients = await loadClients(filePath);
  const index = clients.findIndex((c) => c.clientName === record.clientName);
  if (index >= 0) {
    clients[index] = record;
  } else {
    clients.push(record);
  }
  await saveClients(clients, filePath);
  return clients;
}

/**
 * クライアントを1件削除する（案件完了時などに使用）。
 * @param {string} clientName
 * @param {string} [filePath]
 * @returns {Promise<import('./reminderDigest.js').ClientLicenseRecord[]>} 更新後の一覧
 */
export async function removeClient(clientName, filePath = DEFAULT_CLIENTS_PATH) {
  const clients = await loadClients(filePath);
  const filtered = clients.filter((c) => c.clientName !== clientName);
  await saveClients(filtered, filePath);
  return filtered;
}
