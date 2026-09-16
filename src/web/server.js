/**
 * M3: インテイク用の簡易Webフォームを提供するローカルHTTPサーバー。
 *
 * 【設計方針】
 * - Express等のフレームワークは導入せず、Node.js標準の node:http のみで実装する
 *   （NFR-1: ビルドレス構成・依存追加の最小化）。
 * - 127.0.0.1（ローカルホスト）のみで待受し、ネットワーク上には公開しない
 *   （NFR-4: 個人情報を外部へ送信しない設計の一環。同一マシン内で完結させる）。
 * - 申請者情報はブラウザ側でApplicantProfile型のJSONに組み立てられ、
 *   通常のフォームPOST（application/x-www-form-urlencoded）の1フィールドとして
 *   送信される（src/web/formPage.js 参照）。サーバー側は多重定義を避けるため
 *   このJSONをそのままevaluateEligibility/書類生成モジュールに渡す。
 * - `/reminders` は data/clients.json（src/core/reminders/clientStore.js）に
 *   登録済みのクライアントについて更新リマインドを表示する読み取り専用画面。
 *   クライアントの登録・削除はCLI（scripts/add-client.js等）で行う想定であり、
 *   このサーバー自体にクライアント登録用のフォームは持たせていない
 *   （許可日が確定するのは申請intakeより後の工程であり、ライフサイクルが
 *   異なるため、意図的にワークフローを混在させていない）。
 * - `/clients.csv` は登録済みクライアントのCSVダウンロード（読み取り専用。
 *   /reminders と同じくCLIでの登録・削除運用を変えるものではない）。
 * - `/drafts` はインテイクフォームの入力途中データ（下書き。
 *   src/web/draftStore.js）の一覧・保存・再開・削除を扱う。長い入力を
 *   中断しても後で続きから入力できるようにするための機能で、/submit
 *   （最終的な書類生成）とは独立した別データとして保存する。
 * - 最小限のアクセスログ（メソッド・パス・ステータス・所要時間）を
 *   console.log に出力する（NFR-4に沿い、外部ログ収集サービスへは送信しない）。
 *   申請者情報（POSTボディ）は氏名・財務情報等を含みうるため、意図的に
 *   ログへ出力しない。
 *
 * 起動: `node src/web/server.js`（または `npm run web`）
 */
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { evaluateEligibility, formatEligibilityReport } from "../licenses/construction/eligibility/engine.js";
import { writeYoushiki1Docx } from "../documents/youshiki1.js";
import { writeYoushiki2Docx } from "../documents/youshiki2.js";
import { writeYoushiki6Docx } from "../documents/youshiki6.js";
import { writeYoushiki7Docx } from "../documents/youshiki7.js";
import { writeYoushiki8Docx } from "../documents/youshiki8.js";
import { writeYoushiki16Docx } from "../documents/youshiki16.js";
import { writeYoushiki20_2Docx } from "../documents/youshiki20-2.js";
import { loadClients, DEFAULT_CLIENTS_PATH } from "../core/reminders/clientStore.js";
import {
  buildReminderDigest,
  filterDueAlerts,
  formatReminderDigest,
  bucketizeAlerts,
} from "../core/reminders/digest.js";
import { clientsToCsv } from "../core/reminders/clientCsv.js";
import { loadDrafts, getDraft, upsertDraft, removeDraft, DEFAULT_DRAFTS_PATH } from "./draftStore.js";
import { renderFormPage } from "./formPage.js";
import { renderResultPage } from "./resultPage.js";
import { renderReminderPage } from "./reminderPage.js";
import { renderDraftsPage } from "./draftsPage.js";
import { escapeHtml } from "./htmlUtils.js";
import { registerConstructionLicense } from "../licenses/construction/index.js";
import { registerKobutsuLicense } from "../licenses/kobutsu/index.js";
import { registerSanpaiLicense } from "../licenses/sanpai/index.js";
import { registerMinpakuLicense } from "../licenses/minpaku/index.js";
import { registerGijinkokuModule } from "../licenses/gijinkoku/index.js";
import { registerKeieiJikoShinsaLicense } from "../licenses/keiei-jiko-shinsa/index.js";
import { registerNouchiTenyoLicense } from "../licenses/nouchi-tenyo/index.js";

// 各許可種別アドオンをコアへ登録する。/reminders・/clients.csv 等が
// リマインドを計算する前に必ず実行されている必要があるため、モジュール
// 読み込み時（トップレベル）で行う（docs/DESIGN_kobutsu-core.md 5.6節）。
// 【修正】従来はregisterConstructionLicense()のみが呼ばれており、
// registerKobutsuLicense()の呼び出しが漏れていたため、古物商許可の
// クライアントは/remindersページに書換申請・返納期限のリマインドが
// 一切表示されない不具合があった。
registerConstructionLicense();
registerKobutsuLicense();
registerSanpaiLicense();
registerMinpakuLicense();
registerGijinkokuModule();
registerKeieiJikoShinsaLicense();
registerNouchiTenyoLicense();

export const DEFAULT_OUT_DIR = "out/web";
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB（フォーム入力のみを想定した余裕のある上限）

/** 各様式生成モジュールの一覧。順序は表示順を兼ねる。 */
const DOCUMENT_TARGETS = [
  { label: "様式第一号（建設業許可申請書）", filename: "youshiki1.docx", write: writeYoushiki1Docx },
  { label: "様式第二号（工事経歴書）", filename: "youshiki2.docx", write: writeYoushiki2Docx },
  { label: "様式第六号（役員等の一覧表）", filename: "youshiki6.docx", write: writeYoushiki6Docx },
  { label: "様式第七号（経営業務管理責任者証明書）", filename: "youshiki7.docx", write: writeYoushiki7Docx },
  { label: "様式第八号（専任技術者証明書）", filename: "youshiki8.docx", write: writeYoushiki8Docx },
  { label: "様式第十六号の一部（完成工事原価報告書）", filename: "youshiki16.docx", write: writeYoushiki16Docx },
  { label: "様式第二十号の二（誓約書）", filename: "youshiki20-2.docx", write: writeYoushiki20_2Docx },
];

/**
 * ApplicantProfile から様式すべてのdocxサマリーを生成する（DOCUMENT_TARGETS参照）。
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @param {string} sessionDir
 * @returns {Promise<{ label: string, filename: string }[]>}
 */
async function generateAllDocuments(profile, sessionDir) {
  const results = [];
  for (const target of DOCUMENT_TARGETS) {
    await target.write(profile, path.join(sessionDir, target.filename));
    results.push({ label: target.label, filename: target.filename });
  }
  return results;
}

/**
 * リクエストボディを文字列として読み取る（サイズ上限つき）。
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<string>}
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    /** @type {Buffer[]} */
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("リクエストボディが上限サイズを超えています"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} statusCode
 * @param {string} html
 */
function respondHtml(res, statusCode, html) {
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

/**
 * out/web/<sessionId>/<filename> 形式のダウンロードリクエストを処理する。
 * パストラバーサル対策として、解決後のパスが outDir 配下にあることを必ず確認する。
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} outDir
 */
async function serveDownload(req, res, outDir) {
  const relPath = decodeURIComponent((req.url ?? "").slice("/download/".length));
  const outDirResolved = path.resolve(outDir);
  const resolved = path.resolve(outDirResolved, relPath);

  if (resolved !== outDirResolved && !resolved.startsWith(outDirResolved + path.sep)) {
    respondHtml(res, 403, "<h1>Forbidden</h1>");
    return;
  }

  let data;
  try {
    data = await fs.readFile(resolved);
  } catch {
    respondHtml(res, 404, "<h1>Not Found</h1>");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${path.basename(resolved)}"`,
  });
  res.end(data);
}

/**
 * インテイクフォームのHTTPサーバー（未起動）を作成する。
 * テストから `outDir` を差し替えられるよう、起動処理とは分離している。
 *
 * @param {{ outDir?: string, clientsPath?: string, draftsPath?: string }} [options]
 * @returns {import('node:http').Server}
 */
export function createServer({
  outDir = DEFAULT_OUT_DIR,
  clientsPath = DEFAULT_CLIENTS_PATH,
  draftsPath = DEFAULT_DRAFTS_PATH,
} = {}) {
  return http.createServer(async (req, res) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      // メソッド・パス・ステータス・所要時間のみ記録する。
      // POSTボディ（申請者情報）には顧客の氏名・財務情報等が含まれうるため、
      // ここでは意図的に出力しない。
      console.log(`${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
    });

    const url = req.url ?? "/";

    try {
      if (req.method === "GET" && (url === "/" || url === "/index.html")) {
        respondHtml(res, 200, renderFormPage());
        return;
      }

      if (req.method === "GET" && (url === "/reminders" || url.startsWith("/reminders?"))) {
        // `?range=<key>` で一覧を絞り込む（M7・FR-3.7）。クエリパラメータ未指定
        // （＝`/reminders`）の場合は従来どおり全件を表示する。不正な値が
        // 指定された場合も同様に全件表示にフォールバックする（エラーにしない）。
        const requestedRange = new URL(url, "http://localhost").searchParams.get("range");
        const clients = await loadClients(clientsPath);
        const alerts = buildReminderDigest(clients);
        const buckets = bucketizeAlerts(alerts);
        const activeRange = requestedRange && Object.hasOwn(buckets, requestedRange) ? requestedRange : null;
        const displayedAlerts = activeRange ? buckets[activeRange] : alerts;
        const report = formatReminderDigest(displayedAlerts);
        respondHtml(
          res,
          200,
          renderReminderPage({
            report,
            clientCount: clients.length,
            actionableAlerts: filterDueAlerts(displayedAlerts),
            activeRange,
          })
        );
        return;
      }

      if (req.method === "GET" && url === "/clients.csv") {
        const clients = await loadClients(clientsPath);
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="clients.csv"',
        });
        res.end(clientsToCsv(clients));
        return;
      }

      if (req.method === "GET" && url === "/drafts") {
        const drafts = await loadDrafts(draftsPath);
        respondHtml(res, 200, renderDraftsPage({ drafts }));
        return;
      }

      if (req.method === "POST" && url === "/drafts") {
        const bodyText = await readRequestBody(req);
        const params = new URLSearchParams(bodyText);
        const profileJson = params.get("profileJson");
        const draftId = params.get("draftId") || undefined;
        if (!profileJson) {
          throw new Error("profileJson が送信されていません（フォームのJavaScriptが動作していない可能性があります）");
        }
        const profile = JSON.parse(profileJson);
        const record = await upsertDraft(profile, draftId, draftsPath);
        respondHtml(res, 200, renderFormPage({ profile: record.profile, draftId: record.id, savedNotice: true }));
        return;
      }

      if (req.method === "POST" && url.startsWith("/drafts/") && url.endsWith("/delete")) {
        const id = decodeURIComponent(url.slice("/drafts/".length, url.length - "/delete".length));
        await removeDraft(id, draftsPath);
        const drafts = await loadDrafts(draftsPath);
        respondHtml(res, 200, renderDraftsPage({ drafts }));
        return;
      }

      if (req.method === "GET" && url.startsWith("/drafts/")) {
        const id = decodeURIComponent(url.slice("/drafts/".length));
        const draft = await getDraft(id, draftsPath);
        if (!draft) {
          respondHtml(res, 404, "<h1>Not Found</h1><p>指定の下書きが見つかりません。</p>");
          return;
        }
        respondHtml(res, 200, renderFormPage({ profile: draft.profile, draftId: draft.id }));
        return;
      }

      if (req.method === "POST" && url === "/submit") {
        const bodyText = await readRequestBody(req);
        const params = new URLSearchParams(bodyText);
        const profileJson = params.get("profileJson");
        if (!profileJson) {
          throw new Error("profileJson が送信されていません（フォームのJavaScriptが動作していない可能性があります）");
        }
        /** @type {import('../licenses/construction/eligibility/types.js').ApplicantProfile} */
        const profile = JSON.parse(profileJson);

        const result = evaluateEligibility(profile);
        const report = formatEligibilityReport(profile, result);

        const sessionId = crypto.randomUUID();
        const sessionDir = path.join(outDir, sessionId);
        const files = await generateAllDocuments(profile, sessionDir);

        respondHtml(res, 200, renderResultPage({ profile, result, report, files, sessionId }));
        return;
      }

      if (req.method === "GET" && url.startsWith("/download/")) {
        await serveDownload(req, res, outDir);
        return;
      }

      respondHtml(res, 404, "<h1>Not Found</h1>");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respondHtml(res, 400, `<h1>エラー</h1><pre>${escapeHtml(message)}</pre>`);
    }
  });
}

/**
 * サーバーを起動し、ローカルホストで待ち受ける。
 * @param {{ port?: number, outDir?: string, clientsPath?: string, draftsPath?: string }} [options]
 * @returns {import('node:http').Server}
 */
export function startServer({ port = 3000, outDir, clientsPath, draftsPath } = {}) {
  const server = createServer({ outDir, clientsPath, draftsPath });
  server.listen(port, "127.0.0.1", () => {
    console.log(`kensetsu-kyoka-toolkit インテイクフォームを起動しました: http://127.0.0.1:${port}`);
    console.log("（ローカルホストのみで待受しています。外部ネットワークには公開されません）");
  });
  return server;
}

// `node src/web/server.js` として直接実行された場合のみサーバーを起動する
// （テストから import した場合は起動しない）。Windows のパス区切り文字の違いを
// 吸収するため、比較には pathToFileURL を使う。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  // OUT_DIR・CLIENTS_PATH・DRAFTS_PATH は、E2Eテスト（Playwright）が実データ
  // （data/clients.json・data/drafts.json・out/web/配下）を汚さずに一時
  // ディレクトリへ向けられるようにするための環境変数（playwright.config.mjs参照）。
  // 通常の `npm run web` 利用時は未設定のままでよく、その場合は既定値が使われる。
  startServer({
    port,
    outDir: process.env.OUT_DIR || undefined,
    clientsPath: process.env.CLIENTS_PATH || undefined,
    draftsPath: process.env.DRAFTS_PATH || undefined,
  });
}
