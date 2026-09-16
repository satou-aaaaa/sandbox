/**
 * 事業の実施の方法（事業計画書）の記載内容サマリー。運搬車両の一覧を
 * 表形式で出力する（工事経歴書=youshiki2.jsで確立したbuildHeaderedTableの
 * パターンを再利用）。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildSubHeading,
  buildHeaderedTable,
  writeDocxFile,
} from "../../../core/documents/common.js";

const VEHICLE_TABLE_HEADERS = ["車両の種類", "登録番号", "飛散・流出防止措置"];

/**
 * @param {import('../eligibility/types.js').VehicleInput[]} vehicles
 * @returns {string[][]}
 */
export function resolveVehicleRows(vehicles) {
  return (vehicles ?? []).map((v) => [v.vehicleType, v.plateNumber, v.hasSpillPreventionMeasures ? "○" : "要確認"]);
}

/**
 * @param {import('../eligibility/types.js').SanpaiApplicantProfile} profile
 * @returns {Document}
 */
export function buildJigyokeikakushoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("事業の実施の方法（事業計画書） — 内容サマリー"),
          buildDisclaimerParagraph(),
          buildSubHeading("運搬車両一覧"),
          buildHeaderedTable(VEHICLE_TABLE_HEADERS, resolveVehicleRows(profile.vehicles)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').SanpaiApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeJigyokeikakushoDocx(profile, outPath) {
  await writeDocxFile(buildJigyokeikakushoDocument(profile), outPath);
}
