import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { createServer } from "../src/web/server.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";
import { saveClients } from "../src/reminders/clientStore.js";

/** テスト用にランダムポートでサーバーを起動し、baseURLを返す。 */
async function startTestServer() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kensetsu-kyoka-toolkit-web-test-"));
  const outDir = path.join(tmpDir, "out");
  const clientsPath = path.join(tmpDir, "clients.json");
  const server = createServer({ outDir, clientsPath });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    outDir,
    clientsPath,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

test("GET / はインテイクフォームのHTMLを返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /申請者情報インテイク/);
    assert.match(html, /id="applicantForm"/);
  } finally {
    await ctx.close();
  }
});

test("POST /submit は判定結果と書類ダウンロードリンクを含む結果画面を返す", async () => {
  const ctx = await startTestServer();
  try {
    const profile = buildSampleApplicantProfile();
    const body = new URLSearchParams({ profileJson: JSON.stringify(profile) });
    const res = await fetch(`${ctx.baseUrl}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /要件判定結果/);
    assert.match(html, /5要件すべて充足/); // サンプルデータは全要件を満たすように作られている
    assert.match(html, /\/download\/[^"]+\/youshiki1\.docx/);

    // 実際に5様式分のdocxがディスクに生成されていることを確認する。
    const sessions = await fs.readdir(ctx.outDir);
    assert.equal(sessions.length, 1);
    const files = await fs.readdir(path.join(ctx.outDir, sessions[0]));
    assert.equal(files.length, 5);
  } finally {
    await ctx.close();
  }
});

test("POST /submit の判定結果は評価エンジン・書類生成モジュールと一致する（不合格ケース）", async () => {
  const ctx = await startTestServer();
  try {
    const profile = buildSampleApplicantProfile();
    profile.kekkaku.isBoryokudanMemberOrWithin5Years = true; // 欠格要件に該当させる
    const body = new URLSearchParams({ profileJson: JSON.stringify(profile) });
    const res = await fetch(`${ctx.baseUrl}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const html = await res.text();
    assert.match(html, /未充足の要件があります/);
  } finally {
    await ctx.close();
  }
});

test("生成されたdocxをダウンロードでき、有効なzip（docx）である", async () => {
  const ctx = await startTestServer();
  try {
    const profile = buildSampleApplicantProfile();
    const body = new URLSearchParams({ profileJson: JSON.stringify(profile) });
    const submitRes = await fetch(`${ctx.baseUrl}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const html = await submitRes.text();
    const match = html.match(/href="(\/download\/[^"]+\/youshiki1\.docx)"/);
    assert.ok(match, "youshiki1.docx へのダウンロードリンクが見つかりません");

    const downloadRes = await fetch(`${ctx.baseUrl}${match[1]}`);
    assert.equal(downloadRes.status, 200);
    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    assert.equal(buffer[0], 0x50); // "P"
    assert.equal(buffer[1], 0x4b); // "K"
  } finally {
    await ctx.close();
  }
});

test("/download はディレクトリトラバーサルを拒否する", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/download/${encodeURIComponent("../../etc/passwd")}`);
    assert.equal(res.status, 403);
  } finally {
    await ctx.close();
  }
});

test("POST /submit で profileJson が無ければ400を返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    assert.equal(res.status, 400);
  } finally {
    await ctx.close();
  }
});

test("POST /submit で profileJson が不正なJSONなら400を返す（サーバーが落ちない）", async () => {
  const ctx = await startTestServer();
  try {
    const body = new URLSearchParams({ profileJson: "{this is not json" });
    const res = await fetch(`${ctx.baseUrl}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    assert.equal(res.status, 400);

    // サーバーが引き続き正常応答できることを確認する。
    const followUp = await fetch(`${ctx.baseUrl}/`);
    assert.equal(followUp.status, 200);
  } finally {
    await ctx.close();
  }
});

test("存在しないパスは404を返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/no-such-path`);
    assert.equal(res.status, 404);
  } finally {
    await ctx.close();
  }
});

test("GET /reminders: クライアント未登録の場合はその旨を表示する", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/reminders`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /登録クライアント数: 0件/);
    assert.match(html, /対象のリマインドはありません/);
  } finally {
    await ctx.close();
  }
});

test("GET /reminders: data/clients.json相当のファイルに登録済みのクライアントを表示する", async () => {
  const ctx = await startTestServer();
  try {
    await saveClients([{ clientName: "テスト建設", grantDateIso: "2020-04-01" }], ctx.clientsPath);
    const res = await fetch(`${ctx.baseUrl}/reminders`);
    const html = await res.text();
    assert.match(html, /登録クライアント数: 1件/);
    assert.match(html, /テスト建設/);
    assert.match(html, /期限超過（至急確認してください）/); // 2020年許可なので期限超過のはず
  } finally {
    await ctx.close();
  }
});

test("GET /reminders: 連絡先メールアドレス登録済みのクライアントはメール下書きリンクが表示される", async () => {
  const ctx = await startTestServer();
  try {
    await saveClients(
      [{ clientName: "テスト建設", grantDateIso: "2020-04-01", contactEmail: "info@example.com" }],
      ctx.clientsPath
    );
    const res = await fetch(`${ctx.baseUrl}/reminders`);
    const html = await res.text();
    assert.match(html, /連絡が必要な件（メール下書きを開く）/);
    assert.match(html, /href="mailto:info@example\.com\?subject=/);
  } finally {
    await ctx.close();
  }
});

test("GET /reminders: 連絡先メールアドレス未登録の場合はメール下書きセクションを表示しない", async () => {
  const ctx = await startTestServer();
  try {
    await saveClients([{ clientName: "テスト建設", grantDateIso: "2020-04-01" }], ctx.clientsPath);
    const res = await fetch(`${ctx.baseUrl}/reminders`);
    const html = await res.text();
    assert.doesNotMatch(html, /連絡が必要な件（メール下書きを開く）/);
  } finally {
    await ctx.close();
  }
});
