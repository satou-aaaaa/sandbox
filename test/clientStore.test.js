import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import {
  loadClients,
  saveClients,
  upsertClient,
  upsertClientLicense,
  removeClient,
} from "../src/core/reminders/clientStore.js";

/** テスト用に一時ファイルパスを発行する。 */
async function tempClientsPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kensetsu-kyoka-toolkit-clientstore-test-"));
  return { filePath: path.join(dir, "clients.json"), dir };
}

test("loadClients: ファイルが存在しない場合は空配列を返す", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    const clients = await loadClients(filePath);
    assert.deepEqual(clients, []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("saveClients → loadClients の往復でデータが保持される（新形式・複数許可含む）", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    const original = [
      {
        clientName: "テスト建設",
        fiscalYearEndIso: "2026-03-31",
        licenses: [
          { licenseId: "般-建築工事業", licenseCategory: "construction", grantDateIso: "2024-04-01" },
          { licenseId: "特-とび土工工事業", licenseCategory: "construction", licenseType: "特定", grantDateIso: "2025-06-01" },
        ],
      },
    ];
    await saveClients(original, filePath);
    const loaded = await loadClients(filePath);
    assert.deepEqual(loaded, original);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("loadClients: 旧形式（1クライアント＝1許可）を新形式へ自動変換する（lazy migration・FR-5.5）", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    const oldShape = [
      { clientName: "テスト建設", grantDateIso: "2020-04-01", fiscalYearEndIso: "2026-03-31", contactEmail: "a@example.com" },
      { clientName: "シンプル工業", grantDateIso: "2021-01-01" },
    ];
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(oldShape, null, 2), "utf8");

    const loaded = await loadClients(filePath);
    assert.equal(loaded.length, 2);

    assert.equal(loaded[0].clientName, "テスト建設");
    assert.equal(loaded[0].fiscalYearEndIso, "2026-03-31");
    assert.equal(loaded[0].contactEmail, "a@example.com");
    assert.deepEqual(loaded[0].licenses, [
      { licenseCategory: "construction", licenseId: "既定", grantDateIso: "2020-04-01" },
    ]);
    assert.equal("grantDateIso" in loaded[0], false); // トップレベルの旧フィールドは残らない

    assert.equal(loaded[1].clientName, "シンプル工業");
    assert.deepEqual(loaded[1].licenses, [
      { licenseCategory: "construction", licenseId: "既定", grantDateIso: "2021-01-01" },
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("loadClients: 既に新形式（licenses配列あり）の要素は形式変換をせず、licenseCategoryの補完のみ行う", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    const newShape = [{ clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] }];
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(newShape, null, 2), "utf8");

    const loaded = await loadClients(filePath);
    assert.deepEqual(loaded, [
      {
        clientName: "テスト建設",
        licenses: [{ licenseCategory: "construction", licenseId: "既定", grantDateIso: "2020-04-01" }],
      },
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClient: 新規クライアントは追加される", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    const clients = await upsertClient(
      { clientName: "A社", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] },
      filePath
    );
    assert.equal(clients.length, 1);
    assert.equal(clients[0].clientName, "A社");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClient: 同名クライアントはレコード全体が上書きされる（重複追加されない）", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClient({ clientName: "A社", licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] }, filePath);
    const clients = await upsertClient(
      { clientName: "A社", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] },
      filePath
    );
    assert.equal(clients.length, 1);
    assert.equal(clients[0].licenses.length, 1);
    assert.equal(clients[0].licenses[0].grantDateIso, "2024-04-01");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClient: 複数クライアントが登録済みの場合、名前が一致するクライアントだけが更新される（先頭以外を正しく検索できることの確認）", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClient({ clientName: "A社", licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] }, filePath);
    await upsertClient({ clientName: "B社", licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] }, filePath);
    const clients = await upsertClient(
      { clientName: "B社", licenses: [{ licenseId: "既定", grantDateIso: "2025-01-01" }] },
      filePath
    );
    assert.equal(clients.length, 2);
    const a = clients.find((c) => c.clientName === "A社");
    const b = clients.find((c) => c.clientName === "B社");
    assert.equal(a.licenses[0].grantDateIso, "2020-04-01"); // A社は変更されていない
    assert.equal(b.licenses[0].grantDateIso, "2025-01-01"); // B社のみ更新される
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClientLicense: 新規クライアントに許可を1件追加する", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    const clients = await upsertClientLicense(
      "A社",
      { licenseId: "般-建築工事業", grantDateIso: "2024-04-01" },
      {},
      filePath
    );
    assert.equal(clients.length, 1);
    assert.equal(clients[0].clientName, "A社");
    assert.deepEqual(clients[0].licenses, [{ licenseId: "般-建築工事業", grantDateIso: "2024-04-01" }]);
    // companyInfoを指定しない新規クライアントには、fiscalYearEndIso/contactEmailの
    // キー自体が存在しないはず（undefinedを明示代入しない）。
    assert.equal("fiscalYearEndIso" in clients[0], false);
    assert.equal("contactEmail" in clients[0], false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClientLicense: 既存クライアントに新しいlicenseIdの許可を追加しても既存の許可はクロバーされない", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClientLicense("A社", { licenseId: "般-建築工事業", grantDateIso: "2020-04-01" }, {}, filePath);
    const clients = await upsertClientLicense(
      "A社",
      { licenseId: "特-とび土工工事業", licenseType: "特定", grantDateIso: "2024-04-01" },
      {},
      filePath
    );
    assert.equal(clients.length, 1); // クライアントは1件のまま
    assert.equal(clients[0].licenses.length, 2); // 許可は2件に増える
    assert.ok(clients[0].licenses.some((l) => l.licenseId === "般-建築工事業"));
    assert.ok(clients[0].licenses.some((l) => l.licenseId === "特-とび土工工事業"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClientLicense: 複数クライアントが登録済みの場合、名前が一致するクライアントだけが更新される（先頭以外を正しく検索できることの確認）", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClientLicense("A社", { licenseId: "既定", grantDateIso: "2020-04-01" }, {}, filePath);
    await upsertClientLicense("B社", { licenseId: "既定", grantDateIso: "2020-04-01" }, {}, filePath);
    const clients = await upsertClientLicense("B社", { licenseId: "既定", grantDateIso: "2025-01-01" }, {}, filePath);
    assert.equal(clients.length, 2);
    const a = clients.find((c) => c.clientName === "A社");
    const b = clients.find((c) => c.clientName === "B社");
    assert.equal(a.licenses[0].grantDateIso, "2020-04-01"); // A社は変更されていない
    assert.equal(b.licenses[0].grantDateIso, "2025-01-01"); // B社のみ更新される
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClientLicense: 同じlicenseIdを指定した場合はその許可のみ上書きする", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClientLicense("A社", { licenseId: "般-建築工事業", grantDateIso: "2020-04-01" }, {}, filePath);
    await upsertClientLicense("A社", { licenseId: "特-とび土工工事業", grantDateIso: "2021-01-01" }, {}, filePath);
    const clients = await upsertClientLicense(
      "A社",
      { licenseId: "般-建築工事業", grantDateIso: "2024-04-01" },
      {},
      filePath
    );
    assert.equal(clients[0].licenses.length, 2); // 件数は変わらない
    const updated = clients[0].licenses.find((l) => l.licenseId === "般-建築工事業");
    assert.equal(updated.grantDateIso, "2024-04-01"); // 上書きされている
    const untouched = clients[0].licenses.find((l) => l.licenseId === "特-とび土工工事業");
    assert.equal(untouched.grantDateIso, "2021-01-01"); // 他の許可はそのまま
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClientLicense: companyInfoを指定するとクライアント単位の情報を上書きする（省略時は既存値を保持）", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClientLicense(
      "A社",
      { licenseId: "般-建築工事業", grantDateIso: "2020-04-01" },
      { fiscalYearEndIso: "2025-03-31", contactEmail: "old@example.com" },
      filePath
    );
    // 2件目の許可を追加。companyInfoは省略 → 既存値を維持するはず。
    const clients = await upsertClientLicense(
      "A社",
      { licenseId: "特-とび土工工事業", grantDateIso: "2024-04-01" },
      {},
      filePath
    );
    assert.equal(clients[0].fiscalYearEndIso, "2025-03-31");
    assert.equal(clients[0].contactEmail, "old@example.com");

    // 今度は明示的に上書き。
    const updated = await upsertClientLicense(
      "A社",
      { licenseId: "特-とび土工工事業", grantDateIso: "2024-04-01" },
      { fiscalYearEndIso: "2026-03-31" },
      filePath
    );
    assert.equal(updated[0].fiscalYearEndIso, "2026-03-31");
    assert.equal(updated[0].contactEmail, "old@example.com"); // 指定しなかった項目は保持される
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("removeClient: 指定した名前のクライアントのみ削除する", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClient({ clientName: "A社", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] }, filePath);
    await upsertClient({ clientName: "B社", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] }, filePath);
    const clients = await removeClient("A社", filePath);
    assert.deepEqual(
      clients.map((c) => c.clientName),
      ["B社"]
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("loadClients: ENOENT以外のエラー（例: ディレクトリを指定した場合）はそのまま再送出する", async () => {
  const { dir } = await tempClientsPath();
  try {
    // filePathとしてディレクトリそのものを渡し、EISDIR（ENOENT以外のエラー）を発生させる。
    await assert.rejects(() => loadClients(dir));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClientLicense: 既存クライアントのcontactEmailのみを更新できる", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClientLicense(
      "A社",
      { licenseId: "既定", grantDateIso: "2024-04-01" },
      { contactEmail: "old@example.com" },
      filePath
    );
    const clients = await upsertClientLicense(
      "A社",
      { licenseId: "既定", grantDateIso: "2024-04-01" },
      { contactEmail: "new@example.com" },
      filePath
    );
    assert.equal(clients[0].contactEmail, "new@example.com");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("loadClients: 配列でないJSONの場合はエラーを投げる", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ not: "an array" }), "utf8");
    // メッセージまで確認する（`Array.isArray`チェック自体が壊れて素通りしても、
    // その後の`.map`呼び出しで別のエラーが投げられてしまい、単なる
    // assert.rejects(fn)だけでは検出できないため）。
    await assert.rejects(() => loadClients(filePath), /の内容が配列ではありません/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
