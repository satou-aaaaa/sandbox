/**
 * クライアントの許可情報を data/clients.json に登録・更新するCLI。
 * 実データを扱うため、data/ ディレクトリは .gitignore で除外している。
 *
 * 【M7: 複数許可対応（ADR-0008）】同じ<クライアント名>を指定して実行すると
 * 「そのクライアントへの許可の追加・更新」になる（--license-id が既存の
 * 許可と一致すればその許可を上書き、一致しなければ新しい許可として追記する。
 * 既存の他の許可はそのまま保持され、クロバーされない）。決算日・連絡先は
 * クライアント（会社）単位の情報のため、省略すると既存の値を保持する
 * （新規クライアントの場合は未設定のまま）。
 *
 * 【許可種別ごとの追加情報（kobutsuDetail等）】2026年9月・ベストプラクティス
 * 監査で判明した既知の未実装（docs/ARCHITECTURE.md参照）を解消し、
 * --license-category と種別ごとの詳細フラグに対応した。省略時は
 * これまでどおり "construction"（建設業許可）として扱う（既存の呼び出し元
 * との後方互換性を維持）。
 *
 * 使い方:
 *   node scripts/add-client.js "<クライアント名>" --license-id <許可ID>
 *     [--license-category construction|kobutsu|sanpai|minpaku|gijinkoku|keiei-jiko-shinsa]
 *     [--grant-date <許可年月日YYYY-MM-DD>] [--license-type 一般|特定]
 *     [--fiscal-year-end <事業年度終了日YYYY-MM-DD>] [--contact-email <連絡先メールアドレス>]
 *     [--kobutsu-grant-date <YYYY-MM-DD>] [--kobutsu-last-change-date <YYYY-MM-DD>] [--kobutsu-closure-date <YYYY-MM-DD>]
 *     [--sanpai-validity-years 5|7] [--sanpai-koushu-completion-date <YYYY-MM-DD>]
 *     [--minpaku-notification-date <YYYY-MM-DD>]
 *     [--gijinkoku-expiry-date <YYYY-MM-DD>] [--gijinkoku-period-type 3月|1年|3年|5年]
 *     [--keiei-latest-kijunbi <YYYY-MM-DD>] [--keiei-latest-kekka-tsuchibi <YYYY-MM-DD>]
 *     [--keiei-latest-sougou-hyoutei <数値>] [--keiei-target-gyoshu <業種1,業種2,...>]
 *     [--keiei-y-bunseki-status 未申請|申請中|結果受領済み]
 *     [--nouchi-article 4条|5条] [--nouchi-grant-date <YYYY-MM-DD>]
 *     [--nouchi-construction-start-deadline <YYYY-MM-DD>] [--nouchi-construction-start-reported true|false]
 *     [--nouchi-completion-report-deadline <YYYY-MM-DD>] [--nouchi-completion-reported true|false]
 *
 * --grant-date は建設業許可・産廃許可（license.grantDateIsoをリマインド計算に
 * 使う種別）のみ必須。古物商許可・民泊届出・技人国ビザは各<種別>Detailの
 * 日付フィールドがリマインド計算の起点になるため、--grant-date は不要（省略可）。
 *
 * 例（新規クライアント。建設業許可。従来どおりの使い方）:
 *   node scripts/add-client.js "サンプル建設" --license-id 般-建築工事業 --grant-date 2024-04-01 --fiscal-year-end 2026-03-31 --contact-email info@example.com
 *
 * 例（既存クライアントに2件目の許可を追加。会社単位の情報は省略すれば既存値を保持）:
 *   node scripts/add-client.js "サンプル建設" --license-id 特-とび土工工事業 --grant-date 2025-06-01 --license-type 特定
 *
 * 例（古物商許可。書換申請の起点日を記録）:
 *   node scripts/add-client.js "サンプル質店" --license-id 古物商 --license-category kobutsu --kobutsu-last-change-date 2026-09-01
 *
 * 例（産廃許可。優良認定で有効期間7年）:
 *   node scripts/add-client.js "サンプル運輸" --license-id 産廃収集運搬 --license-category sanpai --grant-date 2024-04-01 --sanpai-validity-years 7 --sanpai-koushu-completion-date 2024-04-01
 *
 * 例（民泊届出）:
 *   node scripts/add-client.js "サンプル民泊" --license-id 民泊届出 --license-category minpaku --minpaku-notification-date 2026-06-01
 *
 * 例（技人国ビザ。在留カード記載の満了日を記録）:
 *   node scripts/add-client.js "サンプルITソリューションズ" --license-id 技人国-山田 --license-category gijinkoku --gijinkoku-expiry-date 2029-03-31 --gijinkoku-period-type 3年
 *
 * 例（経審。既存の建設業許可クライアントに追加する想定。直近の審査基準日を記録）:
 *   node scripts/add-client.js "サンプル建設" --license-id 経審 --license-category keiei-jiko-shinsa --keiei-latest-kijunbi 2025-03-31 --keiei-target-gyoshu とび・土工工事業,管工事業 --keiei-y-bunseki-status 結果受領済み
 *
 * 例（農地転用許可。工事着手期限を記録。既存の建設業許可クライアントに追加する想定）:
 *   node scripts/add-client.js "サンプル建設" --license-id 農地転用-資材置場 --license-category nouchi-tenyo --nouchi-article 4条 --nouchi-construction-start-deadline 2027-03-31
 */
import { upsertClientLicense } from "../src/core/reminders/clientStore.js";

const LICENSE_CATEGORIES = ["construction", "kobutsu", "sanpai", "minpaku", "gijinkoku", "keiei-jiko-shinsa", "nouchi-tenyo"];
// license.grantDateIso をリマインド計算にそのまま使う種別のみ必須とする
// （kobutsu/minpaku/gijinkokuは各<種別>Detailの日付が起点のため不要）。
const CATEGORIES_REQUIRING_GRANT_DATE = ["construction", "sanpai"];

const USAGE = [
  '使い方: node scripts/add-client.js "<クライアント名>" --license-id <許可ID> ' +
    "[--license-category construction|kobutsu|sanpai|minpaku|gijinkoku|keiei-jiko-shinsa|nouchi-tenyo] " +
    "[--grant-date <許可年月日YYYY-MM-DD>] [--license-type 一般|特定] " +
    "[--fiscal-year-end <事業年度終了日YYYY-MM-DD>] [--contact-email <連絡先メールアドレス>]",
  "種別ごとの追加フラグ:",
  "  kobutsu: [--kobutsu-grant-date <YYYY-MM-DD>] [--kobutsu-last-change-date <YYYY-MM-DD>] [--kobutsu-closure-date <YYYY-MM-DD>]",
  "  sanpai:  [--sanpai-validity-years 5|7] [--sanpai-koushu-completion-date <YYYY-MM-DD>]",
  "  minpaku: [--minpaku-notification-date <YYYY-MM-DD>]",
  "  gijinkoku: [--gijinkoku-expiry-date <YYYY-MM-DD>] [--gijinkoku-period-type 3月|1年|3年|5年]",
  "  keiei-jiko-shinsa: [--keiei-latest-kijunbi <YYYY-MM-DD>] [--keiei-latest-kekka-tsuchibi <YYYY-MM-DD>] [--keiei-latest-sougou-hyoutei <数値>] [--keiei-target-gyoshu <業種1,業種2,...>] [--keiei-y-bunseki-status 未申請|申請中|結果受領済み]",
  "  nouchi-tenyo: [--nouchi-article 4条|5条] [--nouchi-grant-date <YYYY-MM-DD>] [--nouchi-construction-start-deadline <YYYY-MM-DD>] [--nouchi-construction-start-reported true|false] [--nouchi-completion-report-deadline <YYYY-MM-DD>] [--nouchi-completion-reported true|false]",
  "同じ<クライアント名>を指定すると、そのクライアントへの許可の追加・更新になります",
  "（--license-idが既存の許可と一致すれば上書き、一致しなければ追記します）。",
  "--grant-dateは建設業許可・産廃許可のみ必須（他の種別は各Detailの日付が起点のため不要）。",
  "keiei-jiko-shinsaは建設業許可（licenseCategory: \"construction\"）を既に保有するクライアントへの追加を前提とします。",
].join("\n");

const [, , clientName, ...rest] = process.argv;

/** @type {Record<string, string>} */
const options = {};
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i];
  const value = rest[i + 1];
  if (!key || !key.startsWith("--") || value === undefined) {
    console.error(USAGE);
    process.exit(1);
  }
  options[key.slice(2)] = value;
}

const licenseCategory = options["license-category"] ?? "construction";
if (!LICENSE_CATEGORIES.includes(licenseCategory)) {
  console.error(`不正な--license-categoryです: ${licenseCategory}（指定可能: ${LICENSE_CATEGORIES.join("、")}）`);
  console.error(USAGE);
  process.exit(1);
}

const grantDateRequired = CATEGORIES_REQUIRING_GRANT_DATE.includes(licenseCategory);
if (!clientName || !options["license-id"] || (grantDateRequired && !options["grant-date"])) {
  console.error(USAGE);
  process.exit(1);
}

/** @type {import('../src/core/reminders/digest.js').LicenseEntry} */
const license = { licenseId: options["license-id"], licenseCategory };
if (options["grant-date"]) license.grantDateIso = options["grant-date"];
if (options["license-type"]) {
  license.licenseType = /** @type {"一般" | "特定"} */ (options["license-type"]);
}

if (licenseCategory === "kobutsu") {
  /** @type {import('../src/licenses/kobutsu/reminders/changeSchedule.js').KobutsuLicenseDetail} */
  const detail = {};
  if (options["kobutsu-grant-date"]) detail.grantDateIso = options["kobutsu-grant-date"];
  if (options["kobutsu-last-change-date"]) detail.lastRecordedChangeDateIso = options["kobutsu-last-change-date"];
  if (options["kobutsu-closure-date"]) detail.closureDateIso = options["kobutsu-closure-date"];
  if (Object.keys(detail).length > 0) /** @type {any} */ (license).kobutsuDetail = detail;
} else if (licenseCategory === "sanpai") {
  /** @type {import('../src/licenses/sanpai/reminders/renewalAndKoushuSchedule.js').SanpaiLicenseDetail} */
  const detail = {};
  if (options["sanpai-validity-years"]) {
    const years = Number(options["sanpai-validity-years"]);
    if (years !== 5 && years !== 7) {
      console.error(`--sanpai-validity-yearsは5または7を指定してください（指定値: ${options["sanpai-validity-years"]}）`);
      process.exit(1);
    }
    detail.validityYears = years;
  }
  if (options["sanpai-koushu-completion-date"]) detail.koushuCompletionDateIso = options["sanpai-koushu-completion-date"];
  if (Object.keys(detail).length > 0) /** @type {any} */ (license).sanpaiDetail = detail;
} else if (licenseCategory === "minpaku") {
  /** @type {import('../src/licenses/minpaku/reminders/periodicReportSchedule.js').MinpakuLicenseDetail} */
  const detail = {};
  if (options["minpaku-notification-date"]) detail.notificationDateIso = options["minpaku-notification-date"];
  if (Object.keys(detail).length > 0) /** @type {any} */ (license).minpakuDetail = detail;
} else if (licenseCategory === "gijinkoku") {
  /** @type {import('../src/licenses/gijinkoku/reminders/zairyuKikanSchedule.js').GijinkokuLicenseDetail} */
  const detail = {};
  if (options["gijinkoku-expiry-date"]) detail.expiryDateIso = options["gijinkoku-expiry-date"];
  if (options["gijinkoku-period-type"]) {
    const validPeriods = ["3月", "1年", "3年", "5年"];
    if (!validPeriods.includes(options["gijinkoku-period-type"])) {
      console.error(`--gijinkoku-period-typeは${validPeriods.join("、")}のいずれかを指定してください`);
      process.exit(1);
    }
    detail.periodType = /** @type {"3月" | "1年" | "3年" | "5年"} */ (options["gijinkoku-period-type"]);
  }
  if (Object.keys(detail).length > 0) /** @type {any} */ (license).gijinkokuDetail = detail;
} else if (licenseCategory === "keiei-jiko-shinsa") {
  /** @type {import('../src/licenses/keiei-jiko-shinsa/reminders/annualCycleSchedule.js').KeieiJikoShinsaDetail} */
  const detail = {};
  if (options["keiei-latest-kijunbi"]) detail.latestKijunbiIso = options["keiei-latest-kijunbi"];
  if (options["keiei-latest-kekka-tsuchibi"]) detail.latestKekkaTsuchibiIso = options["keiei-latest-kekka-tsuchibi"];
  if (options["keiei-latest-sougou-hyoutei"]) {
    const hyoutei = Number(options["keiei-latest-sougou-hyoutei"]);
    if (Number.isNaN(hyoutei)) {
      console.error(`--keiei-latest-sougou-hyouteiは数値を指定してください（指定値: ${options["keiei-latest-sougou-hyoutei"]}）`);
      process.exit(1);
    }
    detail.latestSougouHyoutei = hyoutei;
  }
  if (options["keiei-target-gyoshu"]) detail.targetGyoshu = options["keiei-target-gyoshu"].split(",");
  if (options["keiei-y-bunseki-status"]) {
    const validStatuses = ["未申請", "申請中", "結果受領済み"];
    if (!validStatuses.includes(options["keiei-y-bunseki-status"])) {
      console.error(`--keiei-y-bunseki-statusは${validStatuses.join("、")}のいずれかを指定してください`);
      process.exit(1);
    }
    detail.yBunsekiStatus = /** @type {"未申請" | "申請中" | "結果受領済み"} */ (options["keiei-y-bunseki-status"]);
  }
  if (Object.keys(detail).length > 0) /** @type {any} */ (license).keieiJikoShinsaDetail = detail;
} else if (licenseCategory === "nouchi-tenyo") {
  /** @type {import('../src/licenses/nouchi-tenyo/reminders/conditionDeadlineSchedule.js').NouchiTenyoLicenseDetail} */
  const detail = {};
  if (options["nouchi-article"]) {
    const validArticles = ["4条", "5条"];
    if (!validArticles.includes(options["nouchi-article"])) {
      console.error(`--nouchi-articleは${validArticles.join("、")}のいずれかを指定してください`);
      process.exit(1);
    }
    detail.article = /** @type {"4条" | "5条"} */ (options["nouchi-article"]);
  }
  if (options["nouchi-grant-date"]) detail.grantDateIso = options["nouchi-grant-date"];
  if (options["nouchi-construction-start-deadline"]) detail.constructionStartDeadlineIso = options["nouchi-construction-start-deadline"];
  if (options["nouchi-construction-start-reported"]) detail.constructionStartReported = options["nouchi-construction-start-reported"] === "true";
  if (options["nouchi-completion-report-deadline"]) detail.completionReportDeadlineIso = options["nouchi-completion-report-deadline"];
  if (options["nouchi-completion-reported"]) detail.completionReported = options["nouchi-completion-reported"] === "true";
  if (Object.keys(detail).length > 0) /** @type {any} */ (license).nouchiTenyoDetail = detail;
}

// 他種別向けのフラグが誤って指定されていないか軽く確認する（気づきのための警告に留め、処理は止めない）。
const OTHER_CATEGORY_FLAG_PREFIXES = {
  kobutsu: "kobutsu-",
  sanpai: "sanpai-",
  minpaku: "minpaku-",
  gijinkoku: "gijinkoku-",
  "keiei-jiko-shinsa": "keiei-",
  "nouchi-tenyo": "nouchi-",
};
for (const [category, prefix] of Object.entries(OTHER_CATEGORY_FLAG_PREFIXES)) {
  if (category === licenseCategory) continue;
  const mismatched = Object.keys(options).filter((k) => k.startsWith(prefix));
  if (mismatched.length > 0) {
    console.warn(
      `⚠ --license-category ${licenseCategory} が指定されていますが、${category}向けのフラグ（${mismatched.map((k) => `--${k}`).join("、")}）が指定されているため無視します`
    );
  }
}

/** @type {{ fiscalYearEndIso?: string, contactEmail?: string }} */
const companyInfo = {};
if (options["fiscal-year-end"]) companyInfo.fiscalYearEndIso = options["fiscal-year-end"];
if (options["contact-email"]) companyInfo.contactEmail = options["contact-email"];

const clients = await upsertClientLicense(clientName, license, companyInfo);
const client = clients.find((c) => c.clientName === clientName);
console.log(
  `登録しました: ${clientName} / 許可ID: ${license.licenseId}（種別: ${licenseCategory}）` +
    `（登録済みクライアント数: ${clients.length}、${clientName}の保有許可数: ${client ? client.licenses.length : 0}）`
);
