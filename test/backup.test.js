import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import {
  backupBeforeWrite,
  listBackups,
  restoreFromBackup,
  defaultBackupDir,
  DEFAULT_GENERATIONS,
} from "../src/core/reminders/backup.js";

/** @returns {Promise<{ filePath: string, dir: string }>} */
async function tempFilePath(prefix, name = "clients.json") {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-backup-test-${prefix}-`));
  return { filePath: path.join(dir, name), dir };
}

test("DEFAULT_GENERATIONS は7世代", () => {
  assert.equal(DEFAULT_GENERATIONS, 7);
});

test("defaultBackupDir: 対象ファイルと同じディレクトリの backup/ を返す", () => {
  assert.equal(defaultBackupDir("data/clients.json"), path.join("data", "backup"));
});

test("backupBeforeWrite: 対象ファイルが存在しない場合は何もせずundefinedを返す", async () => {
  const { filePath, dir } = await tempFilePath("no-file");
  try {
    const result = await backupBeforeWrite(filePath);
    assert.equal(result, undefined);
    const backups = await listBackups(filePath);
    assert.deepEqual(backups, []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("backupBeforeWrite: 既存ファイルをbackup/配下へコピーする", async () => {
  const { filePath, dir } = await tempFilePath("copy");
  try {
    await fs.writeFile(filePath, JSON.stringify([{ clientName: "テスト建設" }]), "utf8");
    const backupPath = await backupBeforeWrite(filePath);
    assert.ok(backupPath);
    assert.equal(path.dirname(backupPath), defaultBackupDir(filePath));
    const backedUp = JSON.parse(await fs.readFile(backupPath, "utf8"));
    assert.deepEqual(backedUp, [{ clientName: "テスト建設" }]);
    // 元ファイルはそのまま残っている
    assert.ok(
      JSON.parse(await fs.readFile(filePath, "utf8"))[0].clientName === "テスト建設"
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("backupBeforeWrite: 直近N世代を超えた古いバックアップを自動削除する", async () => {
  const { filePath, dir } = await tempFilePath("prune");
  try {
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(filePath, JSON.stringify([{ n: i }]), "utf8");
      await backupBeforeWrite(filePath, { generations: 3 });
    }
    const backups = await listBackups(filePath);
    assert.equal(backups.length, 3, "直近3世代だけが残っているはず");
    // このテストでは「書き込み→backupBeforeWrite」の順で10回呼んでいるため、
    // 各世代は呼び出し時点の最新内容（n=i）を保持する。直近3世代（n=7,8,9）だけが
    // 残り、先頭（最新）は最後に書き込んだ n=9 のはず。
    const latest = JSON.parse(await fs.readFile(backups[0].path, "utf8"));
    assert.equal(latest[0].n, 9);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("backupBeforeWrite: generationsを指定しない場合は既定の7世代を使う", async () => {
  const { filePath, dir } = await tempFilePath("default-generations");
  try {
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(filePath, JSON.stringify([{ n: i }]), "utf8");
      await backupBeforeWrite(filePath);
    }
    const backups = await listBackups(filePath);
    assert.equal(backups.length, DEFAULT_GENERATIONS);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("listBackups: バックアップが無い場合は空配列を返す（backup/ ディレクトリ自体が無くてもエラーにならない）", async () => {
  const { filePath, dir } = await tempFilePath("empty-list");
  try {
    assert.deepEqual(await listBackups(filePath), []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("listBackups: 新しい順（直近世代が先頭）に返し、作成日時をISO形式で復元できる", async () => {
  const { filePath, dir } = await tempFilePath("order");
  try {
    await fs.writeFile(filePath, JSON.stringify([{ n: 1 }]), "utf8");
    await backupBeforeWrite(filePath);
    await new Promise((r) => setTimeout(r, 5));
    await fs.writeFile(filePath, JSON.stringify([{ n: 2 }]), "utf8");
    await backupBeforeWrite(filePath);

    const backups = await listBackups(filePath);
    assert.equal(backups.length, 2);
    assert.ok(backups[0].createdAtIso > backups[1].createdAtIso, "先頭が最新であること");
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(backups[0].createdAtIso));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("restoreFromBackup: 指定した世代の内容でファイルを上書きし、復元前の内容も退避する", async () => {
  const { filePath, dir } = await tempFilePath("restore");
  try {
    await fs.writeFile(filePath, JSON.stringify([{ n: "v1" }]), "utf8");
    await backupBeforeWrite(filePath); // v1をバックアップ
    await fs.writeFile(filePath, JSON.stringify([{ n: "v2" }]), "utf8");
    await backupBeforeWrite(filePath); // v2をバックアップ
    await fs.writeFile(filePath, JSON.stringify([{ n: "v3-破損" }]), "utf8"); // v3は未バックアップの最新（例: 誤って壊した状態）

    // v2（直近世代=0）から復元する
    const restoredFrom = await restoreFromBackup(filePath, 0);
    assert.ok(restoredFrom.includes("backup"));

    const restored = JSON.parse(await fs.readFile(filePath, "utf8"));
    assert.equal(restored[0].n, "v2");

    // 復元前のv3の内容も、通常のバックアップとして退避されているはず
    const backups = await listBackups(filePath);
    const backedUpContents = await Promise.all(backups.map((b) => fs.readFile(b.path, "utf8")));
    assert.ok(
      backedUpContents.some((c) => JSON.parse(c)[0].n === "v3-破損"),
      "復元前の内容（v3）も失われず退避されているはず"
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("restoreFromBackup: 1つ前の世代（generationsAgo=1）からも復元できる", async () => {
  const { filePath, dir } = await tempFilePath("restore-older");
  try {
    await fs.writeFile(filePath, JSON.stringify([{ n: "v1" }]), "utf8");
    await backupBeforeWrite(filePath);
    await fs.writeFile(filePath, JSON.stringify([{ n: "v2" }]), "utf8");
    await backupBeforeWrite(filePath);
    await fs.writeFile(filePath, JSON.stringify([{ n: "v3" }]), "utf8");

    await restoreFromBackup(filePath, 1);
    const restored = JSON.parse(await fs.readFile(filePath, "utf8"));
    assert.equal(restored[0].n, "v1");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("restoreFromBackup: 存在しない世代を指定するとエラーを投げる", async () => {
  const { filePath, dir } = await tempFilePath("restore-missing");
  try {
    await fs.writeFile(filePath, JSON.stringify([{ n: "v1" }]), "utf8");
    await backupBeforeWrite(filePath);
    await assert.rejects(() => restoreFromBackup(filePath, 5), /復元対象のバックアップが見つかりません/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("restoreFromBackup: 対象ファイル・ディレクトリ自体がまだ存在しない場合でも復元できる（世代ディレクトリの自動作成）", async () => {
  const { filePath, dir } = await tempFilePath("restore-fresh-dir");
  try {
    await fs.writeFile(filePath, JSON.stringify([{ n: "v1" }]), "utf8");
    await backupBeforeWrite(filePath);
    await fs.rm(filePath); // 誤ってファイル自体を削除してしまった状況を模擬

    await restoreFromBackup(filePath, 0);
    const restored = JSON.parse(await fs.readFile(filePath, "utf8"));
    assert.equal(restored[0].n, "v1");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
