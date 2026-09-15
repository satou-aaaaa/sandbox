/**
 * クライアント一覧（data/clients.json）とCSVの相互変換。
 *
 * 表計算ソフト（Excel等）でのバックアップ・一括確認・一括登録を目的とする。
 * RFC4180準拠の最小限のCSVエンコード/デコードを自前で実装しており、
 * 外部パッケージには依存しない（NFR-1のビルドレス方針・依存最小化を踏襲）。
 *
 * 【M7: 複数許可対応（ADR-0008）】CSVは「1行＝1許可」の非正規化形式にする。
 * `clientName` / `fiscalYearEndIso` / `contactEmail` は会社単位の列のため、
 * 同一クライアントの全行で同じ値を繰り返す。`licenseId` 列が無い（または
 * 空の）旧形式CSVは、後方互換のため `licenseId` を "既定" として読み込む。
 */

/**
 * CSVの列順（エクスポート・インポート双方で共通）。1行＝1許可（ADR-0008）。
 * 会社単位の列（clientName・fiscalYearEndIso・contactEmail）は同一クライアントの
 * 全行で値を繰り返す。
 * @type {string[]}
 */
const COLUMNS = ["clientName", "licenseId", "licenseType", "grantDateIso", "fiscalYearEndIso", "contactEmail"];

/** 旧形式CSV（licenseId列が無い）を読み込む際に割り当てる既定の許可ID。 */
const DEFAULT_LICENSE_ID = "既定";

/**
 * 1フィールドをCSV用にエスケープする。カンマ・ダブルクォート・改行を
 * 含む場合はダブルクォートで囲み、内部のダブルクォートは2つに置き換える。
 * @param {unknown} value
 * @returns {string}
 */
function escapeCsvField(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * クライアント一覧をCSV文字列に変換する（1行＝1許可）。
 * @param {import('../core/reminders/digest.js').ClientRecord[]} clients
 * @returns {string}
 */
export function clientsToCsv(clients) {
  const lines = [COLUMNS.join(",")];
  for (const client of clients) {
    for (const license of client.licenses) {
      /** @type {Record<string, unknown>} */
      const row = {
        clientName: client.clientName,
        licenseId: license.licenseId,
        licenseType: license.licenseType,
        grantDateIso: license.grantDateIso,
        fiscalYearEndIso: client.fiscalYearEndIso,
        contactEmail: client.contactEmail,
      };
      lines.push(COLUMNS.map((key) => escapeCsvField(row[key])).join(","));
    }
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * CSVテキストを行×列の文字列配列にパースする（RFC4180準拠の最小実装）。
 * ダブルクォートで囲まれたフィールド内のカンマ・改行・エスケープされた
 * ダブルクォート（""）を正しく扱う。
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // 次の \n とあわせて改行として扱うため、ここでは何もしない
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // 末尾に改行が無い場合の最終フィールド・行を回収する
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * CSVテキストからクライアント一覧を読み込む。
 * ヘッダー行の列名でマッピングするため、列の並び順が変わっていても読み込める。
 * `clientName` または `grantDateIso` が空の行は不正なデータとみなしスキップする
 * （エラーで止めず、読み込めた分だけ返す方針。DESIGN.md 6章のエラー
 * ハンドリング方針を踏襲）。
 *
 * 1行＝1許可の非正規化形式（ADR-0008）のため、同一 `clientName` の行は
 * 1つの `ClientRecord` にまとめ、各行を `licenses` の要素として集約する。
 * `licenseId` 列が無い（または空の）行は、後方互換のため `licenseId` を
 * "既定" として扱う（旧形式CSVの読み込み。FR-5.6）。
 *
 * @param {string} text
 * @returns {import('../core/reminders/digest.js').ClientRecord[]}
 */
export function clientsFromCsv(text) {
  const rows = parseCsvRows(text).filter((r) => !(r.length === 1 && r[0] === ""));
  if (rows.length === 0) return [];

  const [header, ...dataRows] = rows;
  /** @type {Map<string, import('../core/reminders/digest.js').ClientRecord>} */
  const clientsByName = new Map();
  /** @type {string[]} clientNameの初出順を保持するため */
  const order = [];

  for (const row of dataRows) {
    /** @type {Record<string, string>} */
    const record = {};
    header.forEach((key, index) => {
      const value = row[index];
      if (value) record[key] = value;
    });
    if (!record.clientName || !record.grantDateIso) continue;

    let client = clientsByName.get(record.clientName);
    if (!client) {
      client = { clientName: record.clientName, licenses: [] };
      // 会社単位の列は、同一クライアントの初出行の値を採用する
      // （同一クライアントの全行で同じ値が繰り返される前提。ADR-0008）。
      if (record.fiscalYearEndIso) client.fiscalYearEndIso = record.fiscalYearEndIso;
      if (record.contactEmail) client.contactEmail = record.contactEmail;
      clientsByName.set(record.clientName, client);
      order.push(record.clientName);
    }

    /** @type {import('../core/reminders/digest.js').LicenseEntry} */
    const license = {
      licenseId: record.licenseId || DEFAULT_LICENSE_ID,
      grantDateIso: record.grantDateIso,
    };
    if (record.licenseType) license.licenseType = /** @type {"一般" | "特定"} */ (record.licenseType);
    client.licenses.push(license);
  }

  return order.map((name) => /** @type {import('../core/reminders/digest.js').ClientRecord} */ (clientsByName.get(name)));
}
