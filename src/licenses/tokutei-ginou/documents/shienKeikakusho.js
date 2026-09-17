/**
 * 1号特定技能外国人支援計画書の記載内容サマリー（義務的支援10項目の
 * 実施方法、自社実施か委託かの別）。
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

const MANDATORY_SUPPORT_LABELS = [
  "事前ガイダンスの提供",
  "出入国時の送迎",
  "住居確保・生活契約支援",
  "生活オリエンテーションの実施",
  "公的手続への同行",
  "日本語学習機会の提供",
  "相談・苦情への対応",
  "日本人との交流促進",
  "転職支援（受入れ機関都合の離職時）",
  "定期的な面談・行政機関への通報",
];

/**
 * @param {import('../eligibility/types.js').ShienTaiseiInput} shienTaisei
 * @returns {[string, string][]}
 */
export function resolveShienKeikakushoRows(shienTaisei) {
  return [
    ["支援計画の実施方法", orNotEntered(shienTaisei.shienMethod)],
    ["委託先の登録支援機関名", orNotEntered(shienTaisei.registeredSupportOrgName)],
    ["支援責任者の選任", shienTaisei.hasShienSekininsha ? "選任済み" : "未選任"],
    ["支援担当者の選任", shienTaisei.hasShienTantousha ? "選任済み" : "未選任"],
  ];
}

/**
 * @param {import('../eligibility/types.js').ShienTaiseiInput} shienTaisei
 * @returns {string[]}
 */
export function resolveMandatorySupportStatus(shienTaisei) {
  return MANDATORY_SUPPORT_LABELS.map((label, i) => `${shienTaisei.mandatorySupportItemsCovered[i] ? "○" : "×"} ${label}`);
}

/**
 * @param {import('../eligibility/types.js').ShienTaiseiInput} shienTaisei
 * @returns {Document}
 */
export function buildShienKeikakushoDocument(shienTaisei) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("1号特定技能外国人支援計画書 — 記載内容サマリー"),
          buildDisclaimerParagraph(),
          ...buildBulletList("重要な注意事項", [TOKUTEI_GINOU_SCREENING_NOTICE], { warning: true }),
          buildLabeledTable(resolveShienKeikakushoRows(shienTaisei)),
          ...buildBulletList("義務的支援10項目のカバー状況", resolveMandatorySupportStatus(shienTaisei)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').ShienTaiseiInput} shienTaisei
 * @param {string} outPath
 */
export async function writeShienKeikakushoDocx(shienTaisei, outPath) {
  await writeDocxFile(buildShienKeikakushoDocument(shienTaisei), outPath);
}
