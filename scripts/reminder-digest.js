/**
 * data/clients.json に登録済みの実クライアントについて、
 * リマインド・ダイジェストを表示するCLI。
 *
 * ダミーデータでの動作確認は generate-reminder-digest-sample.js を使うこと。
 * 実クライアントの登録・削除は scripts/add-client.js / remove-client.js を使う。
 *
 * 使い方:
 *   npm run reminders                    # 標準出力にのみダイジェストを表示（従来どおり）
 *   npm run reminders -- --out <path>    # 標準出力に加えて、同じ内容をファイルにも書き出す
 *   npm run reminders -- --help          # この使い方を表示して終了
 *
 * --out はUTF-8（BOM無し）でファイルへ書き込む。OSの標準リダイレクト
 * （例: `npm run reminders > digest.txt`）でも代替できるが、Windows の
 * PowerShellではリダイレクト時の既定の文字コードがUTF-16になる場合があり、
 * 文字化けの原因になりうる（issue #75）。--out を使えば常にUTF-8で
 * 書き込まれるため、この注意点は実質的に解消される。
 *
 * 外部（メールサーバー等）への送信は行わない（ADR-0004）。--out はあくまで
 * ローカルファイルへの書き出しであり、OSのタスクスケジューラ/cron等と
 * 組み合わせてローカルで確認する運用を想定している。
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { loadClients } from "../src/core/reminders/clientStore.js";
import { buildReminderDigest, filterDueAlerts, formatReminderDigest, buildReminderMailtoUrl } from "../src/core/reminders/digest.js";
import { registerConstructionLicense } from "../src/licenses/construction/index.js";
import { registerKobutsuLicense } from "../src/licenses/kobutsu/index.js";
import { registerSanpaiLicense } from "../src/licenses/sanpai/index.js";
import { registerMinpakuLicense } from "../src/licenses/minpaku/index.js";
import { registerGijinkokuModule } from "../src/licenses/gijinkoku/index.js";
import { registerKeieiJikoShinsaLicense } from "../src/licenses/keiei-jiko-shinsa/index.js";
import { registerNouchiTenyoLicense } from "../src/licenses/nouchi-tenyo/index.js";
import { registerInshokutenEigyoLicense } from "../src/licenses/inshokuten-eigyo/index.js";
import { registerTokuteiGinouModule } from "../src/licenses/tokutei-ginou/index.js";

const USAGE = [
  "使い方: node scripts/reminder-digest.js [--out <path>]",
  "  --out <path>  ダイジェストと同じ内容をUTF-8（BOM無し）でファイルにも書き出す（省略時は標準出力のみ）",
  "  --help        この使い方を表示して終了する",
].join("\n");

const { values: options } = parseArgs({
  args: process.argv.slice(2),
  options: {
    out: { type: "string" },
    help: { type: "boolean" },
  },
  strict: true,
  allowPositionals: false,
});

if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

// 各許可種別アドオンをコアへ登録する。リマインドを計算する前に必ず実行する
// 必要がある（docs/DESIGN_kobutsu-core.md 5.6節）。
// 【修正】従来はregisterConstructionLicense()のみが呼ばれており、
// registerKobutsuLicense()の呼び出しが漏れていたため、data/clients.jsonに
// 古物商許可（kobutsuDetail設定済み）のクライアントを登録していても
// このCLIでは書換申請・返納期限のリマインドが一切表示されない不具合が
// あった（実データには影響しないが、機能として欠落していた）。
registerConstructionLicense();
registerKobutsuLicense();
registerSanpaiLicense();
registerMinpakuLicense();
registerGijinkokuModule();
registerKeieiJikoShinsaLicense();
registerNouchiTenyoLicense();
registerInshokutenEigyoLicense();
registerTokuteiGinouModule();

const clients = await loadClients();

// --out で書き出す内容は、通常の標準出力での整形結果（formatReminderDigestの
// 出力。クライアント未登録時はその旨のメッセージ）と一致させる。
// メール下書きリンクの一覧は補助情報のため、ファイルには含めない。
let digestText;

if (clients.length === 0) {
  digestText = "登録済みのクライアントがありません。scripts/add-client.js で追加してください。";
  console.log(digestText);
} else {
  const alerts = buildReminderDigest(clients);
  digestText = formatReminderDigest(alerts);
  console.log(digestText);

  const mailtoLinks = filterDueAlerts(alerts)
    .map((alert) => ({ alert, mailtoUrl: buildReminderMailtoUrl(alert) }))
    .filter((item) => item.mailtoUrl);

  if (mailtoLinks.length > 0) {
    console.log("\n# メール下書きリンク（連絡先登録済みのもののみ。クリック/コピーして開いてください）\n");
    for (const { alert, mailtoUrl } of mailtoLinks) {
      console.log(`- [${alert.clientName}] ${alert.label}: ${mailtoUrl}`);
    }
  }
}

if (options.out) {
  // Node.jsのfs.writeFileは"utf8"指定時にBOMを付与しない（Windows PowerShellの
  // リダイレクト時とは異なり、常にBOM無しUTF-8で書き込まれる。issue #75）。
  await writeFile(options.out, digestText, "utf8");
  // 標準出力（digestText）と内容を一致させるため、書き出し確認メッセージは
  // 標準エラー出力に流す。
  console.error(`\nダイジェストをファイルに書き出しました: ${options.out}`);
}
