/**
 * 押印前レビューパック（許可種別に依存しない共通の1枚まとめ）。
 *
 * 要件判定の結果（各要件の合否・reasons・warnings・整合性の気づき）、期限、生成した書類の一覧を、
 * 最終レビューの入口として1つのdocxにまとめる。**合否は再計算しない**（判定ロジックは各許可種別の
 * eligibility/ が単一の情報源。渡された EligibilityResult をそのまま並べるだけ）。
 * これは下書き・確認用であり、押印・提出の判断と責任は登録行政書士本人にある（自動押印・自動提出はしない）。
 */
import { Document, Paragraph, TextRun } from "docx";
import {
  A4_PAGE_PROPERTIES,
  FONT,
  buildBulletList,
  buildDisclaimerParagraph,
  buildHeaderedTable,
  buildLabeledTable,
  buildSubHeading,
  buildTitleHeading,
  orNotEntered,
  writeDocxFile,
} from "./common.js";

/**
 * @typedef {Object} ReviewPackInput
 * @property {string} title 手続きの名称（例: 古物商許可申請）
 * @property {string} applicantLabel 申請者の表示名
 * @property {import('../eligibility/types.js').EligibilityResult} eligibility 要件判定の結果（再計算しない）
 * @property {{label: string, dueDateIso: string}[]} [deadlines] 関連する期限
 * @property {string[]} [documentLabels] 生成・準備した書類の名称
 * @property {string} generatedDateIso 作成日（YYYY-MM-DD）
 */

/** 押印・提出の前に、人が必ず確認する項目（許可種別に共通）。 */
export const PRE_SEAL_CHECKLIST = [
  "入力内容を、原本書類（登記簿・住民票・免許証等）と突き合わせた",
  "下の「要確認事項」の一つ一つを、実際に確認・解消した",
  "根拠となる法令・様式が最新であることを確認した（法令ウォッチャーの未対応Issueが無いか）",
  "正式様式へ転記した内容と、生成サマリーが一致している",
  "押印・提出は、登録行政書士本人が行う（自動化しない）",
];

/**
 * 表示用の文字列へ解決する（docxを組み立てる前段。テストしやすいよう分けている）。
 * @param {ReviewPackInput} input
 */
export function resolveReviewPack(input) {
  const { eligibility } = input;
  const unmet = eligibility.checks.filter((c) => !c.passed).map((c) => ({ label: c.label, reasons: c.reasons.filter((r) => r) }));
  const warnings = eligibility.checks.flatMap((c) => c.warnings.map((w) => `[${c.label}] ${w}`));
  const consistency = (eligibility.consistencyWarnings ?? []).map((w) => w.message);
  const checkRows = eligibility.checks.map((c) => [c.passed ? "○" : "×", c.label, c.reasons.filter((r) => r).join(" / ") || "（理由の記載なし）"]);
  const deadlines = [...(input.deadlines ?? [])].sort((a, b) => a.dueDateIso.localeCompare(b.dueDateIso)).map((d) => [d.dueDateIso, d.label]);
  return {
    verdict: eligibility.eligible ? "全要件を満たす（一次スクリーニング）" : "未充足の要件あり",
    unmet,
    warnings,
    consistency,
    checkRows,
    deadlines,
    documentLabels: input.documentLabels ?? [],
    actionCount: unmet.length + warnings.length + consistency.length,
  };
}

/**
 * @param {ReviewPackInput} input
 * @returns {Document}
 */
export function buildReviewPackDocument(input) {
  const r = resolveReviewPack(input);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading(`押印前レビューパック — ${input.title}`),
          buildDisclaimerParagraph(),
          buildLabeledTable([
            ["申請者", orNotEntered(input.applicantLabel)],
            ["作成日", input.generatedDateIso],
            ["一次スクリーニング", r.verdict],
            ["確認が必要な項目数", `${r.actionCount} 件`],
          ]),
          buildSubHeading("要件ごとの判定"),
          buildHeaderedTable(["合否", "要件", "理由"], r.checkRows, { columnWidths: [900, 2600, 6138] }),
          ...buildBulletList("未充足の要件（要対応）", r.unmet.map((u) => `${u.label}: ${u.reasons.join(" / ")}`), { warning: true }),
          ...buildBulletList("要確認事項（要件は満たすが、確認・追加書類が必要な点）", r.warnings, { warning: true }),
          ...buildBulletList("入力内容の整合性の気づき（合否には影響しません）", r.consistency, { warning: true }),
          ...(r.deadlines.length > 0 ? [buildSubHeading("関連する期限"), buildHeaderedTable(["期限日", "内容"], r.deadlines)] : []),
          ...buildBulletList("生成・準備した書類", r.documentLabels),
          buildSubHeading("押印前の確認（人が行う）"),
          ...PRE_SEAL_CHECKLIST.map((item) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `□ ${item}`, font: FONT, size: 20 })] })),
        ],
      },
    ],
  });
}

/**
 * @param {ReviewPackInput} input
 * @param {string} outPath
 */
export async function writeReviewPackDocx(input, outPath) {
  await writeDocxFile(buildReviewPackDocument(input), outPath);
}
