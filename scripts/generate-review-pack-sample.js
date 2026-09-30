/**
 * 押印前レビューパックのサンプル（ダミーデータ。建設業許可の判定結果を使う）。
 * 出力: out/review-pack-sample.docx
 */
import { evaluateEligibility } from "../src/licenses/construction/eligibility/engine.js";
import { writeReviewPackDocx } from "../src/core/documents/reviewPack.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

const profile = buildSampleApplicantProfile();
const eligibility = evaluateEligibility(profile);

await writeReviewPackDocx(
  {
    title: "建設業許可申請（サンプル）",
    applicantLabel: profile.applicantName,
    eligibility,
    deadlines: [{ label: "許可の有効期間満了（更新申請は満了の30日前まで）", dueDateIso: "2031-03-31" }],
    documentLabels: ["様式第一号 申請書サマリー", "様式第七号 経営業務管理責任者証明書サマリー", "様式第八号 専任技術者証明書サマリー"],
    generatedDateIso: new Date().toISOString().slice(0, 10),
  },
  "out/review-pack-sample.docx",
);

console.log("wrote out/review-pack-sample.docx");
