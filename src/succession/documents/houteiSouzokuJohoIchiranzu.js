/**
 * 法定相続情報一覧図の記載内容サマリー生成。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】不動産登記規則第247条1項により、
 * 法定相続情報一覧図には次の情報の記載が必須。
 * 一号: 被相続人の氏名、生年月日、最後の住所及び死亡の年月日
 * 二号: 相続開始の時における同順位の相続人の氏名、生年月日及び被相続人との続柄
 * 同条3項1号により、作成の年月日を記載し申出人が記名する必要がある。
 * 同条4項により、相続人の住所を記載する場合は住所を証する書面の添付が必要。
 *
 * 【重要】本サマリーは記載内容の確認用に過ぎず、法務局が公表する正式な
 * 一覧図の様式（家系図形式のレイアウト）には対応していない。実際の申出には
 * 正式様式への清書、戸籍謄本等の必要書類一式の収集・添付、登記所への
 * 申出書提出が別途必要であり、これらは本モジュールの対象外である
 * （`docs/DESIGN_souzoku-support.md` 9章）。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildHeaderedTable,
  buildBulletList,
  orNotEntered,
  writeDocxFile,
} from "../../core/documents/common.js";

const FORMAT_NOTICE =
  "本サマリーは記載内容（氏名・生年月日・続柄等）の確認用であり、法務局が公表する正式な" +
  "法定相続情報一覧図の様式（家系図形式のレイアウト）には対応していません。実際に登記所へ" +
  "申出を行う際は、正式様式への清書、被相続人の出生時からの戸籍謄本等一式の収集・添付、" +
  "申出書の作成・提出が必要です（不動産登記規則第247条）。";

const ZOKUGARA_APPROXIMATION_NOTICE =
  "続柄の表示は「子」「直系尊属」「兄弟姉妹」等の大分類であり、代襲相続人（孫・甥姪等）の" +
  "正確な続柄（例:「孫（代襲相続人）」）までは自動判定していません。正式な一覧図作成時は、" +
  "戸籍謄本に基づき正確な続柄を記載してください。";

/**
 * `family`（children・ascendants・siblings・その代襲相続人を含む）を
 * 再帰的に走査し、personIdからHeirCandidateInputを引けるMapを作る。
 * @param {import('../types.js').FamilyStructureInput} family
 * @returns {Map<string, import('../types.js').HeirCandidateInput>}
 */
function flattenHeirCandidates(family) {
  /** @type {Map<string, import('../types.js').HeirCandidateInput>} */
  const map = new Map();
  /** @param {import('../types.js').HeirCandidateInput} candidate */
  function visit(candidate) {
    map.set(candidate.personId, candidate);
    for (const s of candidate.substitutes ?? []) visit(s);
  }
  for (const c of [...(family.children ?? []), ...(family.ascendants ?? []), ...(family.siblings ?? [])]) {
    visit(c);
  }
  return map;
}

/**
 * @param {import('../types.js').FamilyStructureInput} family
 * @returns {[string, string][]}
 */
export function resolveDecedentRows(family) {
  return [
    ["氏名", orNotEntered(family.decedentName)],
    ["生年月日", orNotEntered(family.decedentBirthDateIso)],
    ["最後の住所", orNotEntered(family.decedentLastAddress)],
    ["死亡の年月日", orNotEntered(family.decedentDeathDateIso)],
  ];
}

/**
 * `HeirShareResult.relation`（4区分の大まかな分類）から、一覧図に記載する
 * 続柄のおおまかな表示文言を導出する。代襲相続人か本来の順位の相続人かの
 * 区別まではrelationだけでは判別できないため、「（代襲相続人を含む）」を
 * 添えて注意を促す近似表示とする（正確な続柄は戸籍で確認のうえ、正式様式
 * 作成時に反映すること）。
 * @param {import('../types.js').HeirResultRelation} relation
 * @returns {string}
 */
function approximateZokugara(relation) {
  switch (relation) {
    case "spouse":
      return "配偶者";
    case "child-line":
      return "子（代襲相続人を含む）";
    case "ascendant":
      return "直系尊属";
    case "sibling-line":
      return "兄弟姉妹（代襲相続人を含む）";
    default:
      return "（要確認）";
  }
}

/**
 * @param {import('../types.js').FamilyStructureInput} family
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @returns {string[][]}
 */
export function resolveHeirRows(family, heirsResult) {
  const candidatesById = flattenHeirCandidates(family);
  return heirsResult.heirs.map((heir) => {
    const candidate = heir.personId === "spouse" ? undefined : candidatesById.get(heir.personId);
    return [
      orNotEntered(heir.label ?? (heir.personId === "spouse" ? "配偶者" : heir.personId)),
      orNotEntered(candidate?.birthDate),
      approximateZokugara(heir.relation),
    ];
  });
}

/**
 * @param {import('../types.js').FamilyStructureInput} family
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @returns {Document}
 */
export function buildHouteiSouzokuJohoIchiranzuDocument(family, heirsResult) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("法定相続情報一覧図 — 記載内容サマリー"),
          buildDisclaimerParagraph(),
          ...buildBulletList("様式についての重要な注意事項", [FORMAT_NOTICE], { warning: true }),
          buildLabeledTable(resolveDecedentRows(family)),
          buildHeaderedTable(["氏名", "生年月日", "被相続人との続柄"], resolveHeirRows(family, heirsResult)),
          ...buildBulletList("続柄表示についての確認事項", [ZOKUGARA_APPROXIMATION_NOTICE], { warning: true }),
        ],
      },
    ],
  });
}

/**
 * @param {import('../types.js').FamilyStructureInput} family
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @param {string} outPath
 */
export async function writeHouteiSouzokuJohoIchiranzuDocx(family, heirsResult, outPath) {
  await writeDocxFile(buildHouteiSouzokuJohoIchiranzuDocument(family, heirsResult), outPath);
}
