import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { loadClients, saveClients, upsertClient, removeClient } from "../src/reminders/clientStore.js";

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

test("saveClients → loadClients の往復でデータが保持される", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    const original = [{ clientName: "テスト建設", grantDateIso: "2024-04-01" }];
    await saveClients(original, filePath);
    const loaded = await loadClients(filePath);
    assert.deepEqual(loaded, original);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClient: 新規クライアントは追加される", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    const clients = await upsertClient({ clientName: "A社", grantDateIso: "2024-04-01" }, filePath);
    assert.equal(clients.length, 1);
    assert.equal(clients[0].clientName, "A社");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertClient: 同名クライアントは上書きされる（重複追加されない）", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClient({ clientName: "A社", grantDateIso: "2020-04-01" }, filePath);
    const clients = await upsertClient({ clientName: "A社", grantDateIso: "2024-04-01" }, filePath);
    assert.equal(clients.length, 1);
    assert.equal(clients[0].grantDateIso, "2024-04-01");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("removeClient: 指定した名前のクライアントのみ削除する", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await upsertClient({ clientName: "A社", grantDateIso: "2024-04-01" }, filePath);
    await upsertClient({ clientName: "B社", grantDateIso: "2024-04-01" }, filePath);
    const clients = await removeClient("A社", filePath);
    assert.deepEqual(
      clients.map((c) => c.clientName),
      ["B社"]
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("loadClients: 配列でないJSONの場合はエラーを投げる", async () => {
  const { filePath, dir } = await tempClientsPath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ not: "an array" }), "utf8");
    await assert.rejects(() => loadClients(filePath));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
