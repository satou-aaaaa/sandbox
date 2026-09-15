/**
 * カオスエンジニアリング（障害注入テスト）。
 *
 * 【なぜ導入したか】これまでのテストはすべて「正常に動く入力・環境」を前提に
 * 検証してきた。しかし実運用では、ディスク容量不足・ファイルの破損・
 * 複数の書き込みが同時に発生する等、想定外の状況が起こりうる。特に本ツールは
 * 今後ローカル限定ではなくなる可能性があり（複数拠点・複数利用者が同時に
 * アクセスする形態への発展）、こうした状況が起こる頻度は今後高まりうる。
 * 「システムに障害を意図的に注入し、それでも壊れずに振る舞えるか」を
 * 確認するのがカオスエンジニアリングの考え方であり、本ファイルでは
 * インフラ層（サーバーやネットワークを実際に落とす）ではなく、
 * アプリケーション層の障害注入（依存先であるファイルシステムの失敗・
 * 同時書き込みの競合）に絞って検証する（大規模分散システム向けの
 * Chaos Monkey等のインフラ層ツールは、単一プロセスのローカルツールという
 * 現在の構成には適合しないため導入しない）。
 *
 * 【実際に発見したバグ】本テスト作成の過程で、`upsertClient`等の
 * read-modify-write（読み込み→変更→書き込み）方式の関数が、同時に
 * 呼び出されると片方の変更が失われる（lost update）競合状態を実際に
 * 再現した。`src/core/reminders/fileLock.js`（プロセス内の簡易ミューテックス）
 * を導入して修正済み。以下のテストはその修正の回帰テストを兼ねる。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { loadClients, upsertClient, upsertClientLicense, removeClient } from "../src/core/reminders/clientStore.js";
import { loadDrafts, upsertDraft } from "../src/web/draftStore.js";

/** @returns {Promise<{ filePath: string, dir: string }>} */
async function tempPath(prefix) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-chaos-${prefix}-`));
  return { filePath: path.join(dir, "data.json"), dir };
}

test("カオス: upsertClientを異なる2クライアントに対して同時に呼んでも、両方の登録が失われない（lost update競合の回帰テスト）", async () => {
  const { filePath, dir } = await tempPath("race-upsert-client");
  try {
    await Promise.all([
      upsertClient({ clientName: "A社", licenses: [{ licenseId: "既定", grantDateIso: "2024-01-01" }] }, filePath),
      upsertClient({ clientName: "B社", licenses: [{ licenseId: "既定", grantDateIso: "2024-01-01" }] }, filePath),
    ]);
    const clients = await loadClients(filePath);
    assert.deepEqual(
      clients.map((c) => c.clientName).sort(),
      ["A社", "B社"]
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("カオス: 同一クライアントへの許可追加を10件同時に呼んでも、すべての許可が失われずに残る", async () => {
  const { filePath, dir } = await tempPath("race-upsert-license");
  try {
    const calls = Array.from({ length: 10 }, (_, i) =>
      upsertClientLicense("並行テスト建設", { licenseId: `許可${i}`, grantDateIso: "2024-01-01" }, {}, filePath)
    );
    await Promise.all(calls);

    const clients = await loadClients(filePath);
    assert.equal(clients.length, 1);
    assert.equal(clients[0].licenses.length, 10, "10件の許可すべてが残っているはず（競合で失われていないこと）");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("カオス: 登録と削除がほぼ同時に発生しても、最終的な状態に矛盾が生じない", async () => {
  const { filePath, dir } = await tempPath("race-upsert-remove");
  try {
    await upsertClient({ clientName: "削除対象社", licenses: [{ licenseId: "既定", grantDateIso: "2024-01-01" }] }, filePath);

    await Promise.all([
      upsertClient({ clientName: "残存社", licenses: [{ licenseId: "既定", grantDateIso: "2024-01-01" }] }, filePath),
      removeClient("削除対象社", filePath),
    ]);

    const clients = await loadClients(filePath);
    const names = clients.map((c) => c.clientName);
    // 「残存社」の追加は必ず残っているはず。「削除対象社」の削除操作の
    // 実行順（登録操作の前か後か）はPromise.allでは保証されないが、
    // いずれの順でもデータが矛盾なく1つの一貫した状態になっていることを確認する
    // （クラッシュしない・重複しない・意図しない値に化けない）。
    assert.ok(names.includes("残存社"));
    assert.equal(new Set(names).size, names.length, "重複したクライアントが生じていないこと");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("カオス: 下書きの同時保存でも、両方の下書きが失われない（draftStore.jsの回帰テスト）", async () => {
  const { filePath, dir } = await tempPath("race-draft");
  try {
    await Promise.all([
      upsertDraft({ applicantName: "下書きA" }, undefined, filePath),
      upsertDraft({ applicantName: "下書きB" }, undefined, filePath),
    ]);
    const drafts = await loadDrafts(filePath);
    assert.equal(drafts.length, 2);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("カオス: クライアントファイルが破損（JSONとして不正）していても、サイレントにデータを失わずエラーを投げる", async () => {
  const { filePath, dir } = await tempPath("corrupted");
  try {
    // ディスク書き込み中の電源断・プロセスクラッシュ等で発生しうる、
    // 途中で切れた不正なJSON（書き込みが完了しなかった状態を模擬）。
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '[{"clientName": "テスト建設", "licenses": [{"licenseId":', "utf8");

    // 不正なデータを「空配列」等にサイレントにフォールバックしてしまうと、
    // 見かけ上正常に動いているように見えて実際には全クライアントの
    // リマインド情報が失われる、という最悪のシナリオになる。
    // 必ず例外を投げて「読み込みに失敗した」ことを呼び出し元に伝えるべき、
    // という期待を明文化する。
    await assert.rejects(() => loadClients(filePath));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("カオス: ディスク書き込みが失敗（ENOSPC等）しても、プロセス全体がクラッシュせず、呼び出し元がエラーとして捕捉できる", async (t) => {
  const { filePath, dir } = await tempPath("write-failure");
  try {
    const fsPromises = await import("node:fs/promises");
    const enospcError = Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" });
    t.mock.method(fsPromises.default, "writeFile", async () => {
      throw enospcError;
    });

    await assert.rejects(
      () => upsertClient({ clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2024-01-01" }] }, filePath),
      /ENOSPC/
    );

    // モックを解除した後、通常通りの書き込みが引き続き行えることを確認する
    // （ロック機構が、失敗した操作によって永久に詰まってしまわないことの確認。
    // src/core/reminders/fileLock.js が前段の失敗を握りつぶして後続を
    // ブロックしないよう実装している点の回帰テスト）。
    t.mock.restoreAll();
    const clients = await upsertClient(
      { clientName: "テスト建設2", licenses: [{ licenseId: "既定", grantDateIso: "2024-01-01" }] },
      filePath
    );
    assert.equal(clients.length, 1);
    assert.equal(clients[0].clientName, "テスト建設2");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
