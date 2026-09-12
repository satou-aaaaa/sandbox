/**
 * クライアント一覧（data/clients.json）とCSVの相互変換。
 *
 * 表計算ソフト（Excel等）でのバックアップ・一括確認・一括登録を目的とする。
 * RFC4180準拠の最小限のCSVエンコード/デコードを自前で実装しており、
 * 外部パッケージには依存しない（NFR-1のビルドレス方針・依存最小化を踏襲）。
 */

/** CSVの列順（エクスポート・インポート双方で共通）。 */
const COLUMNS = ["clientName", "grantDateIso", "fiscalYearEndIso", "contactEmail"];

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
 * クライアント一覧をCSV文字列に変換する。
 * @param {import('./reminderDigest.js').ClientLicenseRecord[]} clients
 * @returns {string}
 */
export function clientsToCsv(clients) {
  const lines = [COLUMNS.join(",")];
  for (const client of clients) {
    lines.push(COLUMNS.map((key) => escapeCsvField(client[key])).join(","));
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
 * `clientName` が空の行は不正なデータとみなしスキップする
 * （エラーで止めず、読み込めた分だけ返す方針。DESIGN.md 6章のエラー
 * ハンドリング方針を踏襲）。
 *
 * @param {string} text
 * @returns {import('./reminderDigest.js').ClientLicenseRecord[]}
 */
export function clientsFromCsv(text) {
  const rows = parseCsvRows(text).filter((r) => !(r.length === 1 && r[0] === ""));
  if (rows.length === 0) return [];

  const [header, ...dataRows] = rows;
  const records = [];

  for (const row of dataRows) {
    /** @type {Record<string, string>} */
    const record = {};
    header.forEach((key, index) => {
      const value = row[index];
      if (value) record[key] = value;
    });
    if (record.clientName && record.grantDateIso) {
      records.push(record);
    }
  }

  return records;
}
