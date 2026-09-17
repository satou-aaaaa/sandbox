import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

import { createServer, startServer } from "../src/web/server.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";
import { buildSampleKobutsuProfile } from "../scripts/sampleKobutsuProfile.js";
import { buildSampleNouchiTenyoProfile } from "../scripts/sampleNouchiTenyoProfile.js";
import { saveClients } from "../src/core/reminders/clientStore.js";
import { upsertDraft, loadDrafts } from "../src/web/draftStore.js";

/** テスト用にランダムポートでサーバーを起動し、baseURLを返す。 */
async function startTestServer() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kensetsu-kyoka-toolkit-web-test-"));
  const outDir = path.join(tmpDir, "out");
  const clientsPath = path.join(tmpDir, "clients.json");
  const draftsPath = path.join(tmpDir, "drafts.json");
  const server = createServer({ outDir, clientsPath, draftsPath });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    outDir,
    clientsPath,
    draftsPath,
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

    // 実際に7様式分のdocxがディスクに生成されていることを確認する。
    const sessions = await fs.readdir(ctx.outDir);
    assert.equal(sessions.length, 1);
    const files = await fs.readdir(path.join(ctx.outDir, sessions[0]));
    assert.equal(files.length, 7);
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

test("GET /kobutsu は古物商許可インテイクフォームのHTMLを返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/kobutsu`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /古物商許可 申請者情報インテイク/);
    assert.match(html, /id="kobutsuForm"/);
  } finally {
    await ctx.close();
  }
});

test("POST /kobutsu/submit は判定結果と書類ダウンロードリンクを含む結果画面を返す（建設業許可とは異なる判定文言を使う）", async () => {
  const ctx = await startTestServer();
  try {
    const profile = buildSampleKobutsuProfile();
    const body = new URLSearchParams({ profileJson: JSON.stringify(profile) });
    const res = await fetch(`${ctx.baseUrl}/kobutsu/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /要件判定結果/);
    assert.match(html, /○ 要件を充足/); // 建設業許可の「5要件すべて充足」ではなく古物商許可専用の文言
    assert.match(html, /\/download\/[^"]+\/shinseisho\.docx/);
    assert.match(html, /href="\/kobutsu"/); // 「新しい申請者情報を入力する」リンクは/kobutsuへ戻る

    // 実際に3様式分のdocxがディスクに生成されていることを確認する。
    const sessions = await fs.readdir(ctx.outDir);
    assert.equal(sessions.length, 1);
    const files = await fs.readdir(path.join(ctx.outDir, sessions[0]));
    assert.equal(files.length, 3);
  } finally {
    await ctx.close();
  }
});

test("POST /kobutsu/submit の判定結果は評価エンジンと一致する（不合格ケース）", async () => {
  const ctx = await startTestServer();
  try {
    const profile = buildSampleKobutsuProfile();
    profile.kekkaku.isAddressUnknown = true; // 欠格事由に該当させる
    const body = new URLSearchParams({ profileJson: JSON.stringify(profile) });
    const res = await fetch(`${ctx.baseUrl}/kobutsu/submit`, {
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

test("POST /kobutsu/submit で profileJson が無ければ400を返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/kobutsu/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    assert.equal(res.status, 400);
  } finally {
    await ctx.close();
  }
});

test("GET /nouchi-tenyo は農地転用許可インテイクフォームのHTMLを返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/nouchi-tenyo`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /農地転用許可 申請者情報インテイク/);
    assert.match(html, /id="nouchiTenyoForm"/);
  } finally {
    await ctx.close();
  }
});

test("POST /nouchi-tenyo/submit は判定結果と書類ダウンロードリンクを含む結果画面を返す", async () => {
  const ctx = await startTestServer();
  try {
    const profile = buildSampleNouchiTenyoProfile();
    const body = new URLSearchParams({ profileJson: JSON.stringify(profile) });
    const res = await fetch(`${ctx.baseUrl}/nouchi-tenyo/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /要件判定結果/);
    assert.match(html, /○ 要件を充足/);
    assert.match(html, /\/download\/[^"]+\/shinseisho\.docx/);
    assert.match(html, /href="\/nouchi-tenyo"/); // 「新しい申請者情報を入力する」リンクは/nouchi-tenyoへ戻る

    // 実際に2様式分のdocxがディスクに生成されていることを確認する。
    const sessions = await fs.readdir(ctx.outDir);
    assert.equal(sessions.length, 1);
    const files = await fs.readdir(path.join(ctx.outDir, sessions[0]));
    assert.equal(files.length, 2);
  } finally {
    await ctx.close();
  }
});

test("POST /nouchi-tenyo/submit の判定結果は評価エンジンと一致する（不合格ケース）", async () => {
  const ctx = await startTestServer();
  try {
    const profile = buildSampleNouchiTenyoProfile();
    profile.ricchiKijun = { nouchiKubun: "農用地区域内農地" }; // 立地基準を不合格にする
    const body = new URLSearchParams({ profileJson: JSON.stringify(profile) });
    const res = await fetch(`${ctx.baseUrl}/nouchi-tenyo/submit`, {
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

test("POST /nouchi-tenyo/submit で profileJson が無ければ400を返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/nouchi-tenyo/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    assert.equal(res.status, 400);
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

test("/download は存在しないファイルなら404を返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/download/no-such-session/youshiki1.docx`);
    assert.equal(res.status, 404);
  } finally {
    await ctx.close();
  }
});

test("POST /drafts で profileJson が無ければ400を返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    assert.equal(res.status, 400);
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

test("POST /submit はリクエストボディが上限サイズ(5MB)を超えると接続を切断する（DoS対策）", async () => {
  const ctx = await startTestServer();
  try {
    // MAX_BODY_BYTES（5MB）を超える巨大なボディを送る。
    const hugeBody = "profileJson=" + "a".repeat(6 * 1024 * 1024);
    await assert.rejects(() =>
      fetch(`${ctx.baseUrl}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: hugeBody,
      })
    );

    // 切断後もサーバー自体は正常に動作し続けることを確認する。
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

test("startServer: ランダムポート（0指定）でリッスンし、実際にリクエストへ応答できる", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kensetsu-kyoka-toolkit-startserver-test-"));
  const server = startServer({
    port: 0,
    outDir: path.join(tmpDir, "out"),
    clientsPath: path.join(tmpDir, "clients.json"),
    draftsPath: path.join(tmpDir, "drafts.json"),
  });
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("`node src/web/server.js` として直接実行するとPORT環境変数のポートで実際に起動する（エントリポイント分岐の網羅）", async () => {
  // createServer/startServerを単体でimportして呼ぶ既存のテストとは異なり、
  // `npm run web` が実際に使うエントリポイント（ファイル末尾の自己実行ガード）
  // 自体を、子プロセスとして本当に起動することで検証する。
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kensetsu-kyoka-toolkit-direct-exec-test-"));
  const port = 39812;
  const serverPath = path.resolve("src/web/server.js");
  const child = spawn(process.execPath, [serverPath], {
    cwd: tmpDir, // 既定のdata/・out/相対パスが実プロジェクトを汚さないよう隔離する
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("タイムアウト: 起動メッセージが出力されませんでした")), 10000);
      const onData = (chunk) => {
        output += chunk.toString();
        if (output.includes("起動しました")) {
          clearTimeout(timer);
          child.stdout.off("data", onData);
          resolve();
        }
      };
      child.stdout.on("data", onData);
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`サーバープロセスが起動前に終了しました（code: ${code}）`)));
    });
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /申請者情報インテイク/);
  } finally {
    // Windowsではプロセスがcwdとして掴んでいるディレクトリを、終了前に
    // 削除しようとするとEBUSYになるため、終了を待ってから削除する。
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill();
    });
    await fs.rm(tmpDir, { recursive: true, force: true });
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
    await saveClients(
      [{ clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] }],
      ctx.clientsPath
    );
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
      [
        {
          clientName: "テスト建設",
          contactEmail: "info@example.com",
          licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }],
        },
      ],
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
    await saveClients(
      [{ clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] }],
      ctx.clientsPath
    );
    const res = await fetch(`${ctx.baseUrl}/reminders`);
    const html = await res.text();
    assert.doesNotMatch(html, /連絡が必要な件（メール下書きを開く）/);
  } finally {
    await ctx.close();
  }
});

test("GET /reminders: 複数許可を持つクライアントのメール下書きリンクには許可IDを表示する（M7）", async () => {
  const ctx = await startTestServer();
  try {
    // 同じクライアントが2つの許可を持ち、どちらも期限超過（licenseIdが異なる
    // 以外は表示内容が同じ）になるようにする。リンク文言だけで区別できることを確認する。
    await saveClients(
      [
        {
          clientName: "テスト建設",
          contactEmail: "info@example.com",
          licenses: [
            { licenseId: "般-建築工事業", grantDateIso: "2015-04-01" },
            { licenseId: "般-電気工事業", grantDateIso: "2015-04-01" },
          ],
        },
      ],
      ctx.clientsPath
    );
    const res = await fetch(`${ctx.baseUrl}/reminders`);
    const html = await res.text();
    assert.match(html, /テスト建設（許可: 般-建築工事業）/);
    assert.match(html, /テスト建設（許可: 般-電気工事業）/);
  } finally {
    await ctx.close();
  }
});

test("GET /reminders: クエリパラメータなしの場合は従来どおり全件を表示する（M7でも変更なし）", async () => {
  const ctx = await startTestServer();
  try {
    // 満了間近（30日以内）のクライアントと、まだ十分先（6ヶ月超）のクライアントを混在させる。
    await saveClients(
      [
        { clientName: "まもなく建設", licenses: [{ licenseId: "既定", grantDateIso: "2021-08-01" }] }, // 満了2026-07-31付近 → 期限超過寄り
        { clientName: "余裕建設", licenses: [{ licenseId: "既定", grantDateIso: "2030-01-01" }] }, // 満了はずっと先
      ],
      ctx.clientsPath
    );
    const res = await fetch(`${ctx.baseUrl}/reminders`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /登録クライアント数: 2件/);
    assert.match(html, /まもなく建設/);
    assert.match(html, /余裕建設/); // フィルタなしなので両方表示される
    assert.match(html, /<strong>すべて<\/strong>/); // 「すべて」がアクティブ表示
  } finally {
    await ctx.close();
  }
});

test("GET /reminders?range=overdue: 期限超過のクライアントのみ表示する", async () => {
  const ctx = await startTestServer();
  try {
    await saveClients(
      [
        { clientName: "期限切れ建設", licenses: [{ licenseId: "既定", grantDateIso: "2015-04-01" }] }, // 満了はとっくに過ぎている
        { clientName: "余裕建設", licenses: [{ licenseId: "既定", grantDateIso: "2030-01-01" }] }, // 満了はずっと先
      ],
      ctx.clientsPath
    );
    const res = await fetch(`${ctx.baseUrl}/reminders?range=overdue`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /期限切れ建設/);
    assert.doesNotMatch(html, /余裕建設/); // 期限超過ではないクライアントは表示されない
    assert.match(html, /<strong>期限超過<\/strong>/); // 「期限超過」がアクティブ表示
  } finally {
    await ctx.close();
  }
});

test("GET /reminders?range=6m-plus: 6ヶ月超のクライアントのみ表示する", async () => {
  const ctx = await startTestServer();
  try {
    await saveClients(
      [
        { clientName: "期限切れ建設", licenses: [{ licenseId: "既定", grantDateIso: "2015-04-01" }] }, // 満了はとっくに過ぎている
        { clientName: "余裕建設", licenses: [{ licenseId: "既定", grantDateIso: "2030-01-01" }] }, // 満了はずっと先
      ],
      ctx.clientsPath
    );
    const res = await fetch(`${ctx.baseUrl}/reminders?range=6m-plus`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /余裕建設/);
    assert.doesNotMatch(html, /期限切れ建設/);
    assert.match(html, /<strong>6ヶ月超<\/strong>/);
  } finally {
    await ctx.close();
  }
});

test("GET /reminders?range=不正な値: 不正な値はフォールバックして全件表示する", async () => {
  const ctx = await startTestServer();
  try {
    await saveClients(
      [{ clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] }],
      ctx.clientsPath
    );
    const res = await fetch(`${ctx.baseUrl}/reminders?range=not-a-real-range`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /テスト建設/);
    assert.match(html, /<strong>すべて<\/strong>/); // 不正な値は「すべて」扱いにフォールバック
  } finally {
    await ctx.close();
  }
});

test("GET /clients.csv: 登録済みクライアントをCSVとして返す（1行＝1許可。M7・ADR-0008）", async () => {
  const ctx = await startTestServer();
  try {
    await saveClients(
      [
        {
          clientName: "テスト建設",
          licenses: [
            { licenseId: "般-建築工事業", grantDateIso: "2024-04-01" },
            { licenseId: "特-とび土工工事業", licenseType: "特定", grantDateIso: "2025-06-01" },
          ],
        },
      ],
      ctx.clientsPath
    );
    const res = await fetch(`${ctx.baseUrl}/clients.csv`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/csv/);
    const text = await res.text();
    assert.match(text, /^clientName,licenseId,licenseCategory,licenseType,grantDateIso,fiscalYearEndIso,contactEmail/);
    assert.match(text, /テスト建設,般-建築工事業,construction,,2024-04-01/);
    assert.match(text, /テスト建設,特-とび土工工事業,construction,特定,2025-06-01/); // 2件目の許可も1行として出力される
  } finally {
    await ctx.close();
  }
});

test("GET /drafts: 下書きが無い場合はその旨を表示する", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/drafts`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /保存済みの下書きはありません/);
  } finally {
    await ctx.close();
  }
});

test("POST /drafts: 下書きを新規保存し、保存済み通知と共にフォームを再表示する", async () => {
  const ctx = await startTestServer();
  try {
    const profile = buildSampleApplicantProfile();
    const body = new URLSearchParams({ profileJson: JSON.stringify(profile), draftId: "" });
    const res = await fetch(`${ctx.baseUrl}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /下書きを保存しました/);
    // フォームの初期値は INITIAL_PROFILE として埋め込まれ、ブラウザ側JSで
    // 各inputへ反映される（SSRではvalue属性として出力しない設計のため、
    // 埋め込みJSONに正しい値が含まれることを確認する）。
    assert.match(html, /"applicantName":"サンプル建設株式会社"/);

    const drafts = await loadDrafts(ctx.draftsPath);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].profile.applicantName, "サンプル建設株式会社");
  } finally {
    await ctx.close();
  }
});

test("POST /drafts: 既存のdraftIdを指定すると新規作成せず上書き更新する", async () => {
  const ctx = await startTestServer();
  try {
    const first = await upsertDraft(buildSampleApplicantProfile(), undefined, ctx.draftsPath);
    const updatedProfile = { ...buildSampleApplicantProfile(), applicantName: "更新後の名前" };
    const body = new URLSearchParams({ profileJson: JSON.stringify(updatedProfile), draftId: first.id });
    await fetch(`${ctx.baseUrl}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const drafts = await loadDrafts(ctx.draftsPath);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].profile.applicantName, "更新後の名前");
  } finally {
    await ctx.close();
  }
});

test("GET /drafts/<id>: 下書きの内容でフォームを事前入力する", async () => {
  const ctx = await startTestServer();
  try {
    const record = await upsertDraft(buildSampleApplicantProfile(), undefined, ctx.draftsPath);
    const res = await fetch(`${ctx.baseUrl}/drafts/${record.id}`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /"applicantName":"サンプル建設株式会社"/);
    assert.match(html, new RegExp(`id="draftId" value="${record.id}"`));
  } finally {
    await ctx.close();
  }
});

test("GET /drafts/<id>: 存在しない下書きは404を返す", async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/drafts/no-such-id`);
    assert.equal(res.status, 404);
  } finally {
    await ctx.close();
  }
});

test("POST /drafts/<id>/delete: 指定した下書きのみ削除する", async () => {
  const ctx = await startTestServer();
  try {
    const a = await upsertDraft(buildSampleApplicantProfile(), undefined, ctx.draftsPath);
    await upsertDraft({ ...buildSampleApplicantProfile(), applicantName: "B社" }, undefined, ctx.draftsPath);

    const res = await fetch(`${ctx.baseUrl}/drafts/${a.id}/delete`, { method: "POST" });
    assert.equal(res.status, 200);

    const drafts = await loadDrafts(ctx.draftsPath);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].profile.applicantName, "B社");
  } finally {
    await ctx.close();
  }
});
