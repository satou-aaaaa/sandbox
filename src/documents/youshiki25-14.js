/**
 * 経営規模等評価申請書・総合評定値請求書（様式第二十五号の十四）の
 * 総括表（項番01〜20）自動生成モジュール（M9）。
 *
 * 経営事項審査（経審）の評点計算（X1・X2・Y・Z・W・総合評定値P）はこのモジュールの
 * 対象外。別紙一（工事種類別完成工事高等）・別紙二（技術職員名簿）・別紙三
 * （社会性等）、および財務諸表の提出が前提となる経営状況分析申請書
 * （様式第二十五号の八）も対象外（`docs/adr/0009-keishin-scope-documents-only.md`、
 * `docs/REQUIREMENTS.md` §4.7 FR-7.2参照）。
 *
 * 参照: 経営規模等評価申請書と総合評定値請求書の書き方（項番01〜20の記載要領。
 * 東京都都市整備局公開情報の引用）
 * https://www.kensetu.office-kamiyama-tokyo.com/blog-keishin-documents2/
 *
 * 【意図的に自動化していないこと】
 * - 市区町村コード（項番12）・大臣/知事コード（項番02）・業種ごとの許可区分
 *   コード（項番15）・経審対象業種のコード（項番16）は、記載要領の別表を
 *   参照する必要があるコード変換のため、本ツールでは行わない。
 * - 項番05（審査の種類）・項番06（決算月数）は、通常ケース（年1回の結果通知・
 *   12か月決算）の既定値を前提とする。特殊なケースは行政書士が確認すること。
 * - 項番19（技術職員名簿の合計人数）は専任技術者一覧からの参考値であり、
 *   別紙二（技術職員名簿）の正式な対象範囲とは異なりうる。
 *
 * 【重要】本様式は標準の6様式一括生成（GET /submit）には含めない。経審は
 * 新規許可申請とは別の手続きであり、すべての新規申請者が必要とするわけではない
 * ため、CLI経由の個別生成（scripts/generate-youshiki25-14-sample.js）のみとする。
 *
 * 実際の提出書類として使う前に、必ず行政書士本人が内容を確認し、
 * 国交省・都道府県が指定する正式様式に転記・整形すること。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildBulletList,
  orNotEntered,
  writeDocxFile,
} from "../core/documents/common.js";

/**
 * 金額（円）を表示用文字列に整形する（3桁区切り）。未入力の場合は（未入力）。
 * @param {number | undefined} amount
 * @returns {string}
 */
function formatAmount(amount) {
  if (typeof amount !== "number" || Number.isNaN(amount)) return orNotEntered(undefined);
  return `${amount.toLocaleString("ja-JP")}円`;
}

/**
 * 許可番号・許可年月日・許可行政庁の区分をまとめた表示用文字列を作る（項番02）。
 * @param {import('../eligibility/types.js').KeishinRequestInput} req
 * @returns {string}
 */
function formatLicenseInfo(req) {
  if (!req.licenseNumber && !req.licenseGrantDateIso && !req.licenseAuthorityType) {
    return orNotEntered(undefined);
  }
  const authority = req.licenseAuthorityType ? `${req.licenseAuthorityType}許可` : orNotEntered(undefined);
  return `${authority} ${orNotEntered(req.licenseNumber)}（${orNotEntered(req.licenseGrantDateIso)}）`;
}

/**
 * 自己資本額の算定方法（1期分／2期平均）に応じた表示行を組み立てる（項番17）。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {[string, string][]}
 */
function resolveNetAssetsRows(profile) {
  const req = profile.keishinRequest ?? {};
  const netAssets = profile.zaisanKiso?.netAssets;
  if (!req.useNetAssetsTwoYearAverage) {
    return [["自己資本額の算定方法", "1期分（審査基準日の決算額）"], ["自己資本額（審査基準日）", formatAmount(netAssets)]];
  }
  return [
    ["自己資本額の算定方法", "2期平均"],
    ["自己資本額（審査基準日）", formatAmount(netAssets)],
    ["自己資本額（前回申請時の審査基準日）", formatAmount(req.previousNetAssets)],
  ];
}

/**
 * ApplicantProfile から総括表（項番01〜20のうち様式固有項目）の表示行を解決する。
 * ApplicantProfile本体の既存項目（商号・代表者・所在地・資本金・対象業種）と
 * keishinRequestの様式固有項目を合成する。
 *
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveYoushiki25_14Rows(profile) {
  const req = profile.keishinRequest ?? {};

  return [
    ["商号又は名称", orNotEntered(profile.applicantName)],
    ["商号又は名称のフリガナ", orNotEntered(req.applicantNameKana)],
    ["代表者氏名", orNotEntered(profile.representativeName)],
    ["法人番号", orNotEntered(req.corporateNumber)],
    ["資本金の額", formatAmount(profile.zaisanKiso?.capitalAmount)],
    ["主たる営業所の所在地", orNotEntered(profile.address)],
    ["電話番号", orNotEntered(req.phoneNumber)],
    ["許可番号・許可年月日・許可行政庁", formatLicenseInfo(req)],
    ["前回申請時の許可番号（変更がある場合）", orNotEntered(req.previousLicenseNumber)],
    ["審査基準日", orNotEntered(req.reviewDateIso)],
    ["経審対象の建設業の種類", (profile.constructionTypes ?? []).join("、") || orNotEntered(undefined)],
    ...resolveNetAssetsRows(profile),
    ["営業利益（当期）", formatAmount(req.operatingProfit)],
    ["営業利益（前期）", formatAmount(req.previousOperatingProfit)],
    ["減価償却実施額（当期）", formatAmount(req.depreciationAmount)],
    ["減価償却実施額（前期）", formatAmount(req.previousDepreciationAmount)],
    ["技術職員数（専任技術者一覧からの参考値）", `${(profile.senninGijutsushaList ?? []).length}名`],
    ["経営状況分析を受けた機関名", orNotEntered(req.analysisOrganizationName)],
    ["分析機関番号", orNotEntered(req.analysisOrganizationNumber)],
  ];
}

/**
 * 経営規模等評価申請書・総合評定値請求書サマリーの Document オブジェクトを組み立てる。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {Document}
 */
export function buildYoushiki25_14Document(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("経営規模等評価申請書・総合評定値請求書（様式第二十五号の十四）— 総括表サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveYoushiki25_14Rows(profile)),
          ...buildBulletList(
            "確認事項（警告）",
            [
              "別紙一（工事種類別完成工事高等）・別紙二（技術職員名簿）・別紙三（社会性等）は本ツールでは生成していません。正式提出時は別途作成してください。",
              "経営状況分析申請書（様式第二十五号の八）は財務諸表の提出が前提となるため、本ツールの対象外です。",
              "市区町村コード・大臣/知事コード・業種ごとの許可区分コード等は、記載要領の別表を参照して正式な値に置き換えてください。",
              "技術職員数は専任技術者一覧から集計した参考値です。別紙二（技術職員名簿）の正式な対象範囲とは異なる場合があるため、必ず確認してください。",
              "項番05（審査の種類）・項番06（決算月数）は、年1回の結果通知・12か月決算という通常ケースを前提にしています。特殊なケースに該当する場合は必ず確認してください。",
            ],
            { warning: true }
          ),
        ],
      },
    ],
  });
}

/**
 * 経営規模等評価申請書・総合評定値請求書サマリーを .docx ファイルとして書き出す。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeYoushiki25_14Docx(profile, outPath) {
  await writeDocxFile(buildYoushiki25_14Document(profile), outPath);
}
