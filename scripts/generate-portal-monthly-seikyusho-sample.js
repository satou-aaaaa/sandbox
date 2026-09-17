import { filterCompletedCasesForMonth, writeMonthlySeikyushoDocx } from "../src/portal/documents/monthlySeikyusho.js";
import { buildSamplePartner, buildSampleCases } from "./samplePortalData.js";

const partner = buildSamplePartner();
const yearMonth = "2026-09";
const completedCases = filterCompletedCasesForMonth(buildSampleCases(), partner.partnerId, yearMonth);

await writeMonthlySeikyushoDocx(completedCases, partner, yearMonth, "out/portal-monthly-seikyusho-sample.docx");

console.log(`wrote out/portal-monthly-seikyusho-sample.docx（${yearMonth}分・${completedCases.length}件）`);
