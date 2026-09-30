// scripts/reminder-digest.js（npm run reminders）のCLIとしての振る舞いを検証する。
// digest.js自体の計算・整形ロジックのテストは test/reminderDigest.test.js を参照。
// ここでは「--outでファイルにも書き出せるか」「標準出力と内容が一致するか」
// 「--helpが使い方を表示して終了するか」をCLIを実際に起動して確認する
// （issue #75）。data/clients.json は一時ディレクトリを作業ディレクトリに
// 指定して読ませる（実データには一切触れない）。
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { buildReminderDigest, formatReminderDigest } from "../src/core/reminders/digest.js";
import { registerConstructionLicense } from "../src/licenses/construction/index.js";

registerConstructionLicense();

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.resolve(import.meta.dirname, "..", "scripts", "reminder-digest.js");

/** @returns {Promise<string>} 一時ディレクトリのパス（data/clients.jsonの配置先） */
async function makeTmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "kensetsu-kyoka-toolkit-reminder-digest-cli-"));
}

test("--out未指定の場合は従来どおり標準出力のみで、ファイルは作成されない", async () => {
  const tmpDir = await makeTmpDir();
  try {
    const { stdout } = await execFileAsync("node", [SCRIPT_PATH], { cwd: tmpDir });
    assert.match(stdout, /登録済みのクライアントがありません/);
    await assert.rejects(fs.access(path.join(tmpDir, "digest.txt")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("--out <path>: クライアント未登録時も、標準出力と同じ内容をファイルに書き出す", async () => {
  const tmpDir = await makeTmpDir();
  const outPath = path.join(tmpDir, "digest.txt");
  try {
    const { stdout } = await execFileAsync("node", [SCRIPT_PATH, "--out", outPath], { cwd: tmpDir });
    const fileContent = await fs.readFile(outPath, "utf8");
    assert.equal(fileContent, "登録済みのクライアントがありません。scripts/add-client.js で追加してください。");
    assert.equal(stdout.trim(), fileContent.trim());
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("--out <path>: クライアント登録済みの場合、formatReminderDigestの出力と一致する内容をUTF-8（BOM無し）で書き出す", async () => {
  const tmpDir = await makeTmpDir();
  const outPath = path.join(tmpDir, "digest.txt");
  const clients = [{ clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] }];
  await fs.mkdir(path.join(tmpDir, "data"), { recursive: true });
  await fs.writeFile(path.join(tmpDir, "data", "clients.json"), JSON.stringify(clients), "utf8");

  try {
    const { stdout } = await execFileAsync("node", [SCRIPT_PATH, "--out", outPath], { cwd: tmpDir });

    const expected = formatReminderDigest(buildReminderDigest(clients));
    const fileBuffer = await fs.readFile(outPath);
    const fileContent = fileBuffer.toString("utf8");

    assert.equal(fileContent, expected);
    // 標準出力は同じダイジェスト本文で始まる（後続でメール下書きリンクの
    // 案内が続く場合があるため、ファイル内容との一致は前方一致で確認する）。
    assert.ok(stdout.startsWith(expected), "標準出力はファイルと同じダイジェスト本文で始まるはず");
    // Windows PowerShellのリダイレクトと異なり、UTF-16やBOM付きUTF-8にはならない
    // （先頭3バイトがBOM=EF BB BFでないこと）。
    assert.notEqual(fileBuffer[0], 0xef);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("--help: 使い方を表示して終了する（ファイルは何も書き出さない）", async () => {
  const { stdout } = await execFileAsync("node", [SCRIPT_PATH, "--help"]);
  assert.match(stdout, /使い方: node scripts\/reminder-digest\.js/);
  assert.match(stdout, /--out/);
});

test("不正なオプションを指定した場合はエラーで終了する（parseArgsのstrictモード）", async () => {
  await assert.rejects(execFileAsync("node", [SCRIPT_PATH, "--unknown-option"]));
});
