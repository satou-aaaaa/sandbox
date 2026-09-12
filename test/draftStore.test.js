import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { loadDrafts, saveDrafts, upsertDraft, getDraft, removeDraft } from "../src/web/draftStore.js";

/** テスト用に一時ファイルパスを発行する。 */
async function tempDraftsPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kensetsu-kyoka-toolkit-draftstore-test-"));
  return { filePath: path.join(dir, "drafts.json"), dir };
}

test("loadDrafts: ファイルが存在しない場合は空配列を返す", async () => {
  const { filePath, dir } = await tempDraftsPath();
  try {
    assert.deepEqual(await loadDrafts(filePath), []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("saveDrafts → loadDrafts の往復でデータが保持される", async () => {
  const { filePath, dir } = await tempDraftsPath();
  try {
    const original = [{ id: "abc", savedAt: "2026-09-12T00:00:00.000Z", profile: { applicantName: "テスト建設" } }];
    await saveDrafts(original, filePath);
    assert.deepEqual(await loadDrafts(filePath), original);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertDraft: idを指定しない場合は新規IDを発行して追加する", async () => {
  const { filePath, dir } = await tempDraftsPath();
  try {
    const record = await upsertDraft({ applicantName: "テスト建設" }, undefined, filePath);
    assert.ok(record.id);
    assert.equal(record.profile.applicantName, "テスト建設");
    const drafts = await loadDrafts(filePath);
    assert.equal(drafts.length, 1);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("upsertDraft: 既存のidを指定すると上書き更新する（重複追加しない）", async () => {
  const { filePath, dir } = await tempDraftsPath();
  try {
    const first = await upsertDraft({ applicantName: "テスト建設" }, undefined, filePath);
    const second = await upsertDraft({ applicantName: "更新後の名前" }, first.id, filePath);
    assert.equal(second.id, first.id);
    const drafts = await loadDrafts(filePath);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].profile.applicantName, "更新後の名前");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("getDraft: 指定idの下書きを返す。存在しなければundefined", async () => {
  const { filePath, dir } = await tempDraftsPath();
  try {
    const record = await upsertDraft({ applicantName: "テスト建設" }, undefined, filePath);
    assert.equal((await getDraft(record.id, filePath)).profile.applicantName, "テスト建設");
    assert.equal(await getDraft("no-such-id", filePath), undefined);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("loadDrafts: 配列でないJSONの場合はエラーを投げる", async () => {
  const { filePath, dir } = await tempDraftsPath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ not: "an array" }), "utf8");
    await assert.rejects(() => loadDrafts(filePath));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("removeDraft: 指定idの下書きのみ削除する", async () => {
  const { filePath, dir } = await tempDraftsPath();
  try {
    const a = await upsertDraft({ applicantName: "A社" }, undefined, filePath);
    await upsertDraft({ applicantName: "B社" }, undefined, filePath);
    const remaining = await removeDraft(a.id, filePath);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].profile.applicantName, "B社");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
