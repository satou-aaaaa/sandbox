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
 */
import fs from "node:fs/promises";
import path from "node:path";
import { withFileLock } from "./fileLock.js";

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
 * 場合は `upsertClientLicense` を使うこと）。CSVの一括取込
 * （`scripts/import-clients-csv.js`）等、レコード全体が確定している場合に使う。
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
    await saveClients(clients, filePath);
    return clients;
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
    await saveClients(filtered, filePath);
    return filtered;
  });
}
