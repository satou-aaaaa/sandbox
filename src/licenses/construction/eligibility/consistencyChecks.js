/**
 * 入力内容の整合性チェック（ルールベース、M7）
 *
 * 競合調査で識別した「AIによる記載ミス・添付漏れの自動チェック」を、
 * NFR-4（顧客データの外部送信禁止）を守った上でルールベースの静的チェックとして
 * 実現するモジュール。`src/licenses/construction/eligibility/rules/*.js` の法定5要件判定とは明確に分離し、
 * ここで検出した内容は**合否判定に一切影響しない「気づき」情報**として扱う（FR-6.4）。
 *
 * 参照: docs/REQUIREMENTS.md §4.6（FR-6.1〜FR-6.4）、docs/DESIGN.md §5.16
 *
 * @typedef {import('./types.js').ConsistencyWarning} ConsistencyWarning
 * @typedef {import('./types.js').ApplicantProfile} ApplicantProfile
 */

/**
 * 実務経験年数等の「年数」フィールドについて、負の値または非現実的に大きい値を
 * 入力ミスの疑いとして扱うしきい値（FR-6.2）。
 *
 * 人間の実務キャリアの年数として現実的にありえない値として80年を採用する
 * （生涯現役で働いたとしても80年を超える実務経験年数は通常発生しないため）。
 * あくまでルールベースの簡易チェックであり、80年という値に法的根拠はない。
 */
const MAX_PLAUSIBLE_YEARS = 80;

/**
 * 年数が入力ミスの疑いがあるか（負の値、または非現実的に大きい値）を判定する。
 * @param {unknown} value
 * @returns {boolean}
 */
function isImplausibleYearValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return false;
  return value < 0 || value > MAX_PLAUSIBLE_YEARS;
}

/**
 * FR-6.1: 代表者氏名と経営業務管理責任者（証明を受ける者）の氏名が異なる場合、
 * 裏付け書類（役員選任の辞令等）の確認を促す注記を出す。
 *
 * 代表者と経営業務管理責任者が別人であること自体は違法ではない（経営業務管理責任者は
 * 代表者以外の役員が務めることも法令上認められている）ため、エラーではなく
 * 「確認を促す」注記として扱う。
 *
 * @param {ApplicantProfile} profile
 * @returns {ConsistencyWarning[]}
 */
function checkRepresentativeNameConsistency(profile) {
  const representativeName = profile.representativeName;
  const responsibleName = profile.keieiGyomuKanri?.responsibleName;

  if (!representativeName || !responsibleName) return [];
  if (representativeName === responsibleName) return [];

  return [
    {
      key: "representativeNameMismatch",
      message:
        `代表者氏名（${representativeName}）と経営業務管理責任者（${responsibleName}）の氏名が異なります。` +
        "別人であること自体は問題ありませんが、役員選任の辞令等の裏付け書類が揃っているか念のためご確認ください。",
    },
  ];
}

/**
 * FR-6.2: 実務経験年数等の数値項目が負の値、または明らかに非現実的な大きさ
 * （入力ミスの疑い）である場合に、どのフィールドが疑わしいかを示す注記を出す。
 *
 * @param {ApplicantProfile} profile
 * @returns {ConsistencyWarning[]}
 */
function checkYearFieldPlausibility(profile) {
  /** @type {ConsistencyWarning[]} */
  const warnings = [];

  /**
   * @param {string} key
   * @param {string} label
   * @param {unknown} value
   */
  const pushIfImplausible = (key, label, value) => {
    if (!isImplausibleYearValue(value)) return;
    warnings.push({
      key,
      message: `${label}の値が「${value}」となっており、入力ミスの疑いがあります（負の値、または${MAX_PLAUSIBLE_YEARS}年を超える値）。ご確認ください。`,
    });
  };

  const keiei = profile.keieiGyomuKanri;
  if (keiei) {
    pushIfImplausible(
      "keieiGyomuKanri.yearsAsResponsibleOfficer",
      "経営業務管理責任者としての経験年数",
      keiei.yearsAsResponsibleOfficer,
    );
    pushIfImplausible(
      "keieiGyomuKanri.yearsAsQuasiResponsibleOfficer",
      "経営業務管理責任者に準ずる地位での経験年数",
      keiei.yearsAsQuasiResponsibleOfficer,
    );
    pushIfImplausible(
      "keieiGyomuKanri.yearsAsAssistant",
      "経営業務管理責任者を補佐する業務での経験年数",
      keiei.yearsAsAssistant,
    );
    if (keiei.assistantSupportYears) {
      pushIfImplausible(
        "keieiGyomuKanri.assistantSupportYears.finance",
        "財務管理の補佐経験年数",
        keiei.assistantSupportYears.finance,
      );
      pushIfImplausible(
        "keieiGyomuKanri.assistantSupportYears.labor",
        "労務管理の補佐経験年数",
        keiei.assistantSupportYears.labor,
      );
      pushIfImplausible(
        "keieiGyomuKanri.assistantSupportYears.operations",
        "業務運営の補佐経験年数",
        keiei.assistantSupportYears.operations,
      );
    }
  }

  for (const [index, entry] of (profile.senninGijutsushaList ?? []).entries()) {
    const officeLabel = entry.officeName ? `${entry.officeName}（${index + 1}件目）` : `${index + 1}件目の営業所`;
    pushIfImplausible(
      `senninGijutsushaList[${index}].yearsOfPracticalExperience`,
      `専任技術者（${officeLabel}）の指定学科卒業者としての実務経験年数`,
      entry.yearsOfPracticalExperience,
    );
    pushIfImplausible(
      `senninGijutsushaList[${index}].yearsOfGeneralExperience`,
      `専任技術者（${officeLabel}）の実務経験年数（10年要件）`,
      entry.yearsOfGeneralExperience,
    );
    pushIfImplausible(
      `senninGijutsushaList[${index}].yearsOfSupervisoryExperience`,
      `専任技術者（${officeLabel}）の指導監督的実務経験年数`,
      entry.yearsOfSupervisoryExperience,
    );
  }

  return warnings;
}

/**
 * FR-6.3: 同一人物が複数営業所の専任技術者として重複登録されている場合、
 * 専任性（原則1営業所専任）に関する確認を促す注記を出す。
 *
 * 専任技術者は原則として1つの営業所に専任で配置される必要があるため、
 * 同一人物が異なる営業所に重複して登録されているのは入力ミス、または
 * 制度上の誤解の可能性がある。ハードエラーとはせず、行政書士・申請者に
 * ダブルチェックを促す注記として扱う。
 *
 * @param {ApplicantProfile} profile
 * @returns {ConsistencyWarning[]}
 */
function checkSenninGijutsushaExclusivity(profile) {
  /** @type {Map<string, Set<string>>} personName -> officeName の集合 */
  const officesByPerson = new Map();

  for (const entry of profile.senninGijutsushaList ?? []) {
    const personName = entry.personName;
    if (!personName) continue;
    const offices = officesByPerson.get(personName) ?? new Set();
    if (entry.officeName) offices.add(entry.officeName);
    officesByPerson.set(personName, offices);
  }

  /** @type {ConsistencyWarning[]} */
  const warnings = [];
  for (const [personName, offices] of officesByPerson) {
    if (offices.size < 2) continue;
    warnings.push({
      key: "senninGijutsushaDuplicatePerson",
      message:
        `${personName} が複数の営業所（${[...offices].join("、")}）の専任技術者として登録されています。` +
        "専任技術者は原則1営業所専任であるため、重複登録でないか行政書士・申請者双方でご確認ください。",
    });
  }

  return warnings;
}

/**
 * `profile` に対して整合性チェック（FR-6.1〜FR-6.3）をすべて実行し、
 * 検出した注記をまとめて返す。合否判定（`evaluateEligibility` の
 * eligible/checks/blockingIssues）には一切影響を与えない（FR-6.4）。
 *
 * @param {ApplicantProfile} profile
 * @returns {ConsistencyWarning[]}
 */
export function checkConsistency(profile) {
  return [
    ...checkRepresentativeNameConsistency(profile),
    ...checkYearFieldPlausibility(profile),
    ...checkSenninGijutsushaExclusivity(profile),
  ];
}
