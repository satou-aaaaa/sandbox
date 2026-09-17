/**
 * 入力内容の整合性チェック（ルールベース）。
 *
 * 建設業許可の`consistencyChecks.js`（M7）と同じ設計思想を古物商許可にも
 * 適用する。DESIGN文書（`docs/DESIGN_kobutsu-core.md` 9章「今後の拡張
 * ポイント」）が今後の課題として挙げていたもので、`eligibility/kekkaku.js`・
 * `eigyosho.js`の合否判定とは明確に分離し、ここで検出した内容は
 * **合否判定に一切影響しない「気づき」情報**として扱う（コアの
 * `ConsistencyWarning`型・`EligibilityResult.consistencyWarnings`を再利用）。
 *
 * @typedef {import('../../../core/eligibility/types.js').ConsistencyWarning} ConsistencyWarning
 * @typedef {import('./types.js').KobutsuApplicantProfile} KobutsuApplicantProfile
 */

/**
 * 生年月日として明らかに不自然な値（未来日付、または現実的にありえない
 * 高齢）を入力ミスの疑いとして扱う。人間の年齢として現実的にありえない
 * 値として120歳を採用する（建設業許可のconsistencyChecks.jsが実務経験
 * 年数に80年を採用しているのと同じ考え方だが、生年月日から算出する年齢の
 * ため、より現実の高齢者記録に近い120年とした。あくまでルールベースの
 * 簡易チェックであり、この年数自体に法的根拠はない）。
 */
const MAX_PLAUSIBLE_AGE_YEARS = 120;

/**
 * FR相当（古物商許可の要件定義書には明示のFR番号が無いため、建設業許可の
 * FR-6.2に相当するチェックとして実装）: 生年月日が未来日付、または
 * 現実的にありえない高齢を示している場合に確認を促す。
 * @param {KobutsuApplicantProfile} profile
 * @returns {ConsistencyWarning[]}
 */
function checkBirthDatePlausibility(profile) {
  if (!profile.birthDate) return [];
  const birth = new Date(profile.birthDate);
  if (Number.isNaN(birth.getTime())) {
    return [
      {
        key: "birthDateUnparseable",
        message: `生年月日（${profile.birthDate}）を日付として解釈できません。入力形式（YYYY-MM-DD）をご確認ください。`,
      },
    ];
  }
  const now = new Date();
  if (birth.getTime() > now.getTime()) {
    return [{ key: "birthDateInFuture", message: `生年月日（${profile.birthDate}）が未来の日付になっています。入力ミスの疑いがあります。` }];
  }
  const ageYears = (now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears > MAX_PLAUSIBLE_AGE_YEARS) {
    return [
      {
        key: "birthDateImplausiblyOld",
        message: `生年月日（${profile.birthDate}）から算出される年齢が${MAX_PLAUSIBLE_AGE_YEARS}歳を超えており、入力ミスの疑いがあります。ご確認ください。`,
      },
    ];
  }
  return [];
}

/**
 * 同一人物が複数の営業所の管理者として重複登録されている場合、確認を促す
 * 注記を出す。古物営業法第13条は「営業所又は古物市場ごとに...管理者一人を
 * 選任しなければならない」と定めるが、同一人物が複数営業所を兼務すること
 * 自体を明示的に禁止する条文は確認できていない（2026年9月・e-Gov法令検索）。
 * そのため、建設業許可の専任技術者チェックのように「専任義務違反」と
 * 断定はせず、各営業所の業務を適正に実施できる実態があるか確認を促す
 * 表現に留める。
 * @param {KobutsuApplicantProfile} profile
 * @returns {ConsistencyWarning[]}
 */
function checkManagerDuplicateAcrossOffices(profile) {
  /** @type {Map<string, Set<string>>} managerName -> officeNameの集合 */
  const officesByManager = new Map();
  for (const office of profile.eigyoshoList ?? []) {
    if (!office.managerName) continue;
    const offices = officesByManager.get(office.managerName) ?? new Set();
    if (office.officeName) offices.add(office.officeName);
    officesByManager.set(office.managerName, offices);
  }

  /** @type {ConsistencyWarning[]} */
  const warnings = [];
  for (const [managerName, offices] of officesByManager) {
    if (offices.size < 2) continue;
    warnings.push({
      key: "managerDuplicateAcrossOffices",
      message:
        `${managerName} が複数の営業所（${[...offices].join("、")}）の管理者として登録されています。` +
        "管理者は各営業所の業務を適正に実施する責任者（古物営業法第13条第1項）であるため、" +
        "実態として複数営業所の職務を果たせる体制になっているか、念のためご確認ください。",
    });
  }
  return warnings;
}

/**
 * 未成年者の相続人例外（`isHeirWithQualifiedLegalRepresentative`）は、
 * 申請者自身が未成年者で行為能力を欠く場合（`isMinorWithoutCapacity: true`）
 * にのみ意味を持つ例外規定である。`isMinorWithoutCapacity`がfalse（または
 * 未入力）にもかかわらずこの例外フラグがtrueになっている場合、入力の
 * 取り違えの疑いがあるため確認を促す。
 * @param {KobutsuApplicantProfile} profile
 * @returns {ConsistencyWarning[]}
 */
function checkMinorExceptionConsistency(profile) {
  const { isMinorWithoutCapacity, isHeirWithQualifiedLegalRepresentative } = profile.kekkaku;
  if (isHeirWithQualifiedLegalRepresentative && !isMinorWithoutCapacity) {
    return [
      {
        key: "minorExceptionWithoutMinorFlag",
        message:
          "「未成年者の相続人特例（法定代理人が欠格事由に該当しない場合の例外）」がtrueですが、" +
          "「未成年者で行為能力を有しない」がfalse（または未入力）になっています。" +
          "この例外は申請者本人が未成年者である場合にのみ意味を持つため、入力の取り違えがないかご確認ください。",
      },
    ];
  }
  return [];
}

/**
 * `profile`に対して整合性チェックをすべて実行し、検出した注記をまとめて
 * 返す。合否判定（`evaluateKobutsuEligibility`のeligible/checks/
 * blockingIssues）には一切影響を与えない。
 * @param {KobutsuApplicantProfile} profile
 * @returns {ConsistencyWarning[]}
 */
export function checkKobutsuConsistency(profile) {
  return [
    ...checkBirthDatePlausibility(profile),
    ...checkManagerDuplicateAcrossOffices(profile),
    ...checkMinorExceptionConsistency(profile),
  ];
}
