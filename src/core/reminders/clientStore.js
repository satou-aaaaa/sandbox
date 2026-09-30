/**
 * M4の土台: クライアントの許可情報をローカルのJSONファイルに保存・読込する。
 *
 * 【重要】保存されるデータには顧客名・許可年月日等が含まれうる。外部への送信は
 * 一切行わない（NFR-4）。保存先（既定: data/clients.json）は .gitignore で
 * 除外しており、実データをリポジトリにコミットしないこと（NFR-5）。
 * データベース等は導入せず、単一のJSONファイルによる素朴な永続化に留める
 * （個人の副業運用を想定した最小構成。DEVELOPMENT_GUIDE.md 6章の方針）。
 *
 * 【M7: 複数許可対応（ADR-0008）】「クライアント（会社単位）」と
 * 「許可（1件単位）」を分離した `ClientRecord` / `LicenseEntry` モデルを扱う
 * （詳細は `./digest.js` の型定義・`docs/adr/0008-multi-license-client-model.md`
 * を参照）。旧形式（1クライアント＝1許可。トップレベルに `grantDateIso` を持つ）
 * の `data/clients.json` は `loadClients()` が読み込み時にその場で新形式へ
 * 変換する（lazy migration。専用の移行スクリプトは用意しない）。
 *
 * 【世代バックアップ（Issue #183・ADR-0020）】`withFileLock` で保護された
 * 書き込み系関数（`upsertClient`・`upsertClientLicense`・`importClients`・
 * `removeClient`）は、実際に書き戻す直前に `./backup.js` の
 * `backupBeforeWrite` を呼び、書き換え前の内容を `data/backup/` 配下へ
 * 世代バックアップする。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { withFileLock } from "./fileLock.js";
import { backupBeforeWrite } from "./backup.js";

export const DEFAULT_CLIENTS_PATH = "data/clients.json";

/** 旧形式（1クライアント＝1許可）から移行する際、既定で割り当てる許可ID。 */
const DEFAULT_LICENSE_ID = "既定";

/**
 * 読み込んだ1要素が旧形式（トップレベルに `grantDateIso` を持ち、`licenses`
 * 配列を持たない）かどうかを判定し、旧形式であれば新形式の `ClientRecord`
 * へその場で変換する（lazy migration。ADR-0008参照）。既に新形式の場合は
 * 変換せずそのまま返す。
 *
 * @param {unknown} client
 * @returns {import('./digest.js').ClientRecord}
 */
function migrateClientIfNeeded(client) {
  if (
    client &&
    typeof client === "object" &&
    !Array.isArray(/** @type {any} */ (client).licenses) &&
    "grantDateIso" in client
  ) {
    const { grantDateIso, ...companyFields } = /** @type {any} */ (client);
    return {
      ...companyFields,
      licenses: [{ licenseId: DEFAULT_LICENSE_ID, grantDateIso }],
    };
  }
  return /** @type {import('./digest.js').ClientRecord} */ (client);
}

/**
 * 各許可の `licenseCategory` が未設定の場合、"construction" を補う
 * （本開発以前に保存された既存データはすべて建設業許可であるため）。
 * `migrateClientIfNeeded` とは独立したステップにすることで、「旧形式から
 * 変換された場合」「既に新形式だった場合」の両方に漏れなく適用する
 * （docs/DESIGN_kobutsu-core.md 5.4節の設計レビューで判明した、片方の
 * 経路にしか適用されない実装ミスを避けるため）。
 *
 * @param {import('./digest.js').ClientRecord} client
 * @returns {import('./digest.js').ClientRecord}
 */
function applyLicenseCategoryDefault(client) {
  return {
    ...client,
    licenses: client.licenses.map((l) => ({ licenseCategory: "construction", ...l })),
  };
}

/**
 * クライアント一覧を読み込む。ファイルが存在しない場合は空配列を返す
 * （初回利用時にエラーにしないため）。旧形式（1クライアント＝1許可）の
 * 要素が含まれる場合は、新形式（`licenses` 配列を持つ `ClientRecord`）へ
 * 自動的に変換してから返す（FR-5.5・lazy migration）。
 *
 * @param {string} [filePath]
 * @returns {Promise<import('./digest.js').ClientRecord[]>}
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
  return data.map(migrateClientIfNeeded).map(applyLicenseCategoryDefault);
}

/**
 * クライアント一覧をJSONファイルへ書き出す。出力先ディレクトリが
 * 存在しない場合は自動作成する。常に新形式（`ClientRecord`。`licenses` 配列）
 * で書き出す（旧形式では書き出さない）。
 *
 * @param {import('./digest.js').ClientRecord[]} clients
 * @param {string} [filePath]
 */
export async function saveClients(clients, filePath = DEFAULT_CLIENTS_PATH) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(clients, null, 2) + "\n", "utf8");
}

/**
 * クライアントを1件、丸ごと追加・上書きする（同名クライアントが既にあれば
 * `record` の内容で完全に置き換える。既存の `licenses` を部分的に保持したい
 * 場合は `upsertClientLicense`、CSV等の一括取込は既存データを保持する `importClients`
 * を使うこと）。レコード全体が確定している場合に使う。
 *
 * @param {import('./digest.js').ClientRecord} record
 * @param {string} [filePath]
 * @returns {Promise<import('./digest.js').ClientRecord[]>} 更新後の一覧
 */
export async function upsertClient(record, filePath = DEFAULT_CLIENTS_PATH) {
  return withFileLock(filePath, async () => {
    const clients = await loadClients(filePath);
    const index = clients.findIndex((c) => c.clientName === record.clientName);
    if (index >= 0) {
      clients[index] = record;
    } else {
      clients.push(record);
    }
    await backupBeforeWrite(filePath);
    await saveClients(clients, filePath);
    return clients;
  });
}

/**
 * 既存の許可1件に、取り込む許可の内容を上書きマージする。取り込み側に無い
 * プロパティ（許可種別ごとの `<種別>Detail` 等。CSVは持たない）は既存の値を保持する。
 * 許可種別（`licenseCategory`）が異なる場合は、別物とみなして取り込み側で置き換える
 * （古い種別の Detail を新しい種別に引き継がないため）。
 *
 * @param {import('./digest.js').LicenseEntry} existing
 * @param {import('./digest.js').LicenseEntry} incoming
 * @returns {import('./digest.js').LicenseEntry}
 */
function mergeLicense(existing, incoming) {
  const existingCategory = existing.licenseCategory ?? "construction";
  const incomingCategory = incoming.licenseCategory ?? "construction";
  if (existingCategory !== incomingCategory) return incoming;
  return { ...existing, ...incoming };
}

/**
 * CSV等の一括取込で得たクライアント一覧を、既存のクライアント一覧へマージして保存する。
 *
 * `upsertClient` が同名クライアントを丸ごと置き換えるのに対し、本関数は
 * 既存のデータを失わないよう次のようにマージする（#74。CSVは許可種別ごとの
 * `<種別>Detail` を持たないため、丸ごと置換すると Detail が黙って消え、
 * 変更届・更新期限などのリマインドが出なくなる問題があった）。
 * - 同名クライアント: 取り込み側に値があるクライアント単位の項目
 *   （`fiscalYearEndIso`・`contactEmail`）のみ上書きし、それ以外は既存を保持する。
 * - 同じ `licenseId` の許可: 取り込み側の項目で上書きし、取り込み側に無い項目
 *   （`<種別>Detail` 等）は既存を保持する。ただし `licenseCategory` が異なる場合は
 *   取り込み側で置き換える。
 * - 取り込み側に無い既存の許可: 削除せず保持する。
 * - 取り込み側の空欄は「値なし」であり、既存の値を空にする用途には使えない。
 * 一括取込全体を1回のファイルロックで囲み、read-modify-write の競合を防ぐ。
 *
 * @param {import('./digest.js').ClientRecord[]} records
 * @param {string} [filePath]
 * @returns {Promise<{ added: number, updated: number }>} 新規追加・既存更新の件数
 */
export async function importClients(records, filePath = DEFAULT_CLIENTS_PATH) {
  return withFileLock(filePath, async () => {
    const clients = await loadClients(filePath);
    let added = 0;
    let updated = 0;

    for (const incoming of records) {
      const index = clients.findIndex((c) => c.clientName === incoming.clientName);
      if (index < 0) {
        clients.push(incoming);
        added++;
        continue;
      }

      const existing = clients[index];
      const licenses = [...existing.licenses];
      for (const license of incoming.licenses) {
        const licenseIndex = licenses.findIndex((l) => l.licenseId === license.licenseId);
        if (licenseIndex >= 0) {
          licenses[licenseIndex] = mergeLicense(licenses[licenseIndex], license);
        } else {
          licenses.push(license);
        }
      }
      clients[index] = { ...existing, ...incoming, licenses };
      updated++;
    }

    await backupBeforeWrite(filePath);
    await saveClients(clients, filePath);
    return { added, updated };
  });
}

/**
 * クライアントの特定の許可（`license.licenseId`）だけを追加・更新する
 * （ADR-0008「既存クライアントへの許可追加」操作。`scripts/add-client.js` から使用）。
 *
 * - 該当クライアントが既に存在する場合: `licenseId` が一致する既存の許可が
 *   あればその内容を丸ごと置き換え、無ければ `licenses` へ追記する
 *   （＝既存の他の許可はそのまま保持され、クロバーされない）。
 * - 該当クライアントが存在しない場合: `licenses: [license]` の新規クライアント
 *   として追加する。
 *
 * `companyInfo`（決算日・連絡先。会社単位の属性）は指定したキーのみ上書きする。
 * 省略したキーは、既存クライアントであればその値を保持し、新規クライアント
 * であれば未設定のままにする。
 *
 * @param {string} clientName
 * @param {import('./digest.js').LicenseEntry} license 追加・更新する許可
 * @param {{ fiscalYearEndIso?: string, contactEmail?: string }} [companyInfo]
 * @param {string} [filePath]
 * @returns {Promise<import('./digest.js').ClientRecord[]>} 更新後の一覧
 */
export async function upsertClientLicense(clientName, license, companyInfo = {}, filePath = DEFAULT_CLIENTS_PATH) {
  return withFileLock(filePath, async () => {
    const clients = await loadClients(filePath);
    const index = clients.findIndex((c) => c.clientName === clientName);

    if (index >= 0) {
      const client = clients[index];
      if (companyInfo.fiscalYearEndIso !== undefined) client.fiscalYearEndIso = companyInfo.fiscalYearEndIso;
      if (companyInfo.contactEmail !== undefined) client.contactEmail = companyInfo.contactEmail;

      const licenseIndex = client.licenses.findIndex((l) => l.licenseId === license.licenseId);
      if (licenseIndex >= 0) {
        client.licenses[licenseIndex] = license;
      } else {
        client.licenses.push(license);
      }
    } else {
      /** @type {import('./digest.js').ClientRecord} */
      const newClient = { clientName, licenses: [license] };
      if (companyInfo.fiscalYearEndIso !== undefined) newClient.fiscalYearEndIso = companyInfo.fiscalYearEndIso;
      if (companyInfo.contactEmail !== undefined) newClient.contactEmail = companyInfo.contactEmail;
      clients.push(newClient);
    }

    await backupBeforeWrite(filePath);
    await saveClients(clients, filePath);
    return clients;
  });
}

/**
 * クライアントを1件削除する（案件完了時などに使用）。保有する許可の
 * 数に関わらず、クライアント（会社）単位で丸ごと削除する。
 * @param {string} clientName
 * @param {string} [filePath]
 * @returns {Promise<import('./digest.js').ClientRecord[]>} 更新後の一覧
 */
export async function removeClient(clientName, filePath = DEFAULT_CLIENTS_PATH) {
  return withFileLock(filePath, async () => {
    const clients = await loadClients(filePath);
    const filtered = clients.filter((c) => c.clientName !== clientName);
    await backupBeforeWrite(filePath);
    await saveClients(filtered, filePath);
    return filtered;
  });
}
