/**
 * 会社設立サポート案件（IncorporationCaseRecord）を
 * data/incorporation-cases.json に登録・更新するCLI。
 *
 * 使い方:
 *   node scripts/incorporation-case-add.js "<caseId>" --client-name <依頼者氏名>
 *     --company-type 株式会社|合同会社 --company-name <商号>
 *     --purpose <目的1> [--purpose <目的2> ...] --head-office <本店所在地>
 *     --capital <設立時財産価額> --founder <氏名>:<住所>:<出資額>[:<設立時株式数>] [--founder ...]
 *     [--contact-email <連絡先メールアドレス>] [--fiscal-year-end <事業年度末日>]
 *     [--public-notice-method <公告方法>] [--total-issued-shares <発行可能株式総数>]
 *     [--status ヒアリング中|定款起案中|認証待ち|払込待ち|司法書士へ引継ぎ済み|完了]
 *     [--ninsho-yotei <定款認証予約日YYYY-MM-DD>] [--funso-kigen <払込期限YYYY-MM-DD>]
 *     [--funso-kanryo <払込完了日YYYY-MM-DD>] [--handoff <司法書士引継ぎ日YYYY-MM-DD>]
 *     [--notes "<メモ>"]
 *
 * 例（株式会社）:
 *   node scripts/incorporation-case-add.js case-001 --client-name "サンプル太郎" --company-type 株式会社 --company-name "サンプル商事株式会社" --purpose "ソフトウェアの開発及び販売" --head-office "東京都サンプル区" --capital 3000000 --founder "サンプル太郎:東京都サンプル区1-2-3:3000000:30"
 *
 * 例（合同会社。定款認証は不要なためninsho-yoteiは指定しない）:
 *   node scripts/incorporation-case-add.js case-002 --client-name "サンプル花子" --company-type 合同会社 --company-name "サンプル工房合同会社" --purpose "雑貨の製造及び販売" --head-office "大阪府サンプル市" --capital 1000000 --founder "サンプル花子:大阪府サンプル市4-5-6:1000000"
 */
import { upsertCase } from "../src/incorporation/caseStore.js";

const USAGE = [
  '使い方: node scripts/incorporation-case-add.js "<caseId>" --client-name <依頼者氏名> ' +
    "--company-type 株式会社|合同会社 --company-name <商号> --purpose <目的> [--purpose <目的> ...] " +
    "--head-office <本店所在地> --capital <設立時財産価額> " +
    "--founder <氏名>:<住所>:<出資額>[:<設立時株式数>] [--founder ...]",
  "任意フラグ: [--contact-email <アドレス>] [--fiscal-year-end <事業年度末日>] " +
    "[--public-notice-method <公告方法>] [--total-issued-shares <発行可能株式総数>] " +
    "[--status ヒアリング中|定款起案中|認証待ち|払込待ち|司法書士へ引継ぎ済み|完了] " +
    "[--ninsho-yotei <YYYY-MM-DD>] [--funso-kigen <YYYY-MM-DD>] [--funso-kanryo <YYYY-MM-DD>] " +
    "[--handoff <YYYY-MM-DD>] [--notes \"<メモ>\"]",
  "同じ<caseId>を指定すると、その案件の更新になります。",
  "合同会社は定款認証が不要のため、--ninsho-yoteiを指定しても記録されません（会社法上、持分会社は認証対象外）。",
].join("\n");

const [, , caseId, ...rest] = process.argv;

/** @type {Record<string, string[]>} */
const multiOptions = {};
/** @type {Record<string, string>} */
const options = {};
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i];
  const value = rest[i + 1];
  if (!key || !key.startsWith("--") || value === undefined) {
    console.error(USAGE);
    process.exit(1);
  }
  const name = key.slice(2);
  if (name === "purpose" || name === "founder") {
    multiOptions[name] = [...(multiOptions[name] ?? []), value];
  } else {
    options[name] = value;
  }
}

const capitalAmount = Number(options["capital"]);
if (
  !caseId ||
  !options["client-name"] ||
  !options["company-type"] ||
  !options["company-name"] ||
  !multiOptions["purpose"]?.length ||
  !options["head-office"] ||
  !options["capital"] ||
  Number.isNaN(capitalAmount) ||
  !multiOptions["founder"]?.length
) {
  console.error(USAGE);
  process.exit(1);
}

const companyType = options["company-type"];
if (companyType !== "株式会社" && companyType !== "合同会社") {
  console.error(`--company-typeは株式会社または合同会社を指定してください（指定値: ${companyType}）`);
  process.exit(1);
}

/** @type {import('../src/incorporation/types.js').FounderInput[]} */
const founders = multiOptions["founder"].map((raw) => {
  const [name, address, investmentAmountRaw, investedSharesRaw] = raw.split(":");
  const investmentAmount = Number(investmentAmountRaw);
  if (!name || !address || Number.isNaN(investmentAmount)) {
    console.error(`--founderの形式が不正です（<氏名>:<住所>:<出資額>[:<設立時株式数>]。指定値: ${raw}）`);
    process.exit(1);
  }
  /** @type {import('../src/incorporation/types.js').FounderInput} */
  const founder = { name, address, investmentAmount };
  if (investedSharesRaw) founder.investedShares = Number(investedSharesRaw);
  return founder;
});

/** @type {import('../src/incorporation/types.js').TeikanInput} */
const teikan = {
  companyType,
  companyName: options["company-name"],
  businessPurposes: multiOptions["purpose"],
  headOfficeLocation: options["head-office"],
  capitalAmount,
  founders,
};
if (options["fiscal-year-end"]) teikan.fiscalYearEndMonth = options["fiscal-year-end"];
if (companyType === "株式会社") {
  if (options["public-notice-method"]) teikan.publicNoticeMethod = options["public-notice-method"];
  if (options["total-issued-shares"]) teikan.totalIssuedShares = Number(options["total-issued-shares"]);
} else if (options["public-notice-method"] || options["total-issued-shares"] || options["ninsho-yotei"]) {
  console.warn("⚠ 合同会社では--public-notice-method・--total-issued-shares・--ninsho-yoteiは使用されません（定款認証・株式発行の概念が無いため無視します）");
}

/** @type {import('../src/incorporation/types.js').IncorporationCaseRecord} */
const caseRecord = {
  caseId,
  clientName: options["client-name"],
  teikan,
  status: /** @type {import('../src/incorporation/types.js').IncorporationCaseRecord["status"]} */ (options["status"] ?? "ヒアリング中"),
};
if (options["contact-email"]) caseRecord.contactEmail = options["contact-email"];
if (companyType === "株式会社" && options["ninsho-yotei"]) caseRecord.ninshoYoteiIso = options["ninsho-yotei"];
if (options["funso-kigen"]) caseRecord.funsoKigenIso = options["funso-kigen"];
if (options["funso-kanryo"]) caseRecord.funsoKanryoIso = options["funso-kanryo"];
if (options["handoff"]) caseRecord.handoffToShihoshoshiIso = options["handoff"];
if (options["notes"]) caseRecord.notes = options["notes"];

const cases = await upsertCase(caseRecord);
console.log(`登録しました: ${teikan.companyName}（caseId: ${caseId}、登録済み案件数: ${cases.length}）`);
