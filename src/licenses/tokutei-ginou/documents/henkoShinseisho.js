/**
 * 在留資格変更許可申請書の記載内容サマリー。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】入管法第20条により、在留資格を
 * 有する外国人（既に日本国内にいる者）は、現に有する在留資格から別の
 * 在留資格への変更を申請できる（1項）。法務大臣は、提出書類により
 * 変更を適当と認めるに足りる相当の理由があるときに限り許可できる（3項）。
 * 技能水準・日本語能力・所属機関基準・支援体制の判定基準は、新規招へい
 * （認定証明書交付申請。`ninteiShinseisho.js`）と同一であり、既存の判定
 * ロジックをそのまま再利用する（`eligibility/types.js`のコメント参照。
 * gijinkoku-coreの`henkoShinseisho.js`と同型）。
 *
 * 他モジュールと同じ3関数パターンを踏襲するが、`buildDisclaimerParagraph`の
 * 直後に本モジュール専用の一次スクリーニング強調文言（NFR-T2）も併記する
 * （`ninteiShinseisho.js`と同じ設計）。
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
} from "../../../core/documents/common.js";
import { TOKUTEI_GINOU_SCREENING_NOTICE } from "../eligibility/disclaimer.js";
import { getField } from "../eligibility/fieldRegistry.js";

/**
 * @param {import('../eligibility/types.js').TokuteiGinouApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveHenkoShinseishoRows(profile) {
  const field = getField(profile.ginouShiken.fieldKey);
  return [
    ["外国人本人の氏名", orNotEntered(profile.applicantName)],
    ["国籍", orNotEntered(profile.nationality)],
    ["現に有する在留資格", orNotEntered(profile.currentStatusOfResidence)],
    ["現に有する在留資格の在留期限", orNotEntered(profile.currentZairyuKikanMatsuIso)],
    ["変更後の在留資格", "特定技能1号"],
    ["特定産業分野", orNotEntered(field?.fieldLabel ?? profile.ginouShiken.fieldKey)],
    ["特定技能所属機関名", orNotEntered(profile.shozokuKikanKijun?.companyName)],
    ["従事する職務内容", orNotEntered(profile.jobDescription)],
    ["提示年収", `${profile.shozokuKikanKijun.offeredSalaryAnnual.toLocaleString()}円`],
    ["支援計画の実施方法", orNotEntered(profile.shienTaisei?.shienMethod)],
  ];
}

/**
 * @param {import('../eligibility/types.js').TokuteiGinouApplicantProfile} profile
 * @returns {Document}
 */
export function buildHenkoShinseishoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("在留資格変更許可申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          ...buildBulletList("重要な注意事項", [TOKUTEI_GINOU_SCREENING_NOTICE], { warning: true }),
          buildLabeledTable(resolveHenkoShinseishoRows(profile)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').TokuteiGinouApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeHenkoShinseishoDocx(profile, outPath) {
  await writeDocxFile(buildHenkoShinseishoDocument(profile), outPath);
}
