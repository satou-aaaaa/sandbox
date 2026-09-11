/**
 * 要件2: 営業所ごとの専任技術者の配置
 *
 * 一般建設業と特定建設業で基準が異なる。営業所が複数ある場合は
 * 営業所ごとに判定する必要があるため、本モジュールは1営業所分の判定を行い、
 * engine.js 側で全営業所をまとめて評価する。
 *
 * 参照: 国土交通省「建設産業・不動産業：許可の要件」
 * https://www.mlit.go.jp/totikensangyo/const/1_6_bt_000082.html
 *
 * @param {import('../types.js').SenninGijutsushaInput} input
 * @returns {{ officeName: string, passed: boolean, reasons: string[], warnings: string[] }}
 */
export function checkSenninGijutsushaForOffice(input) {
  const reasons = [];
  const warnings = [];

  if (input.hasNationalLicense) {
    reasons.push("該当する国家資格等の保有により要件を満たします");
    return finish(input, true, reasons, warnings);
  }

  // 指定学科卒業 + 実務経験（高卒5年 / 大卒3年）
  const eduRoute =
    input.isDesignatedCourseGraduate &&
    ((input.educationLevel === "高卒" && input.yearsOfPracticalExperience >= 5) ||
      (input.educationLevel === "大卒" && input.yearsOfPracticalExperience >= 3));

  if (eduRoute) {
    reasons.push(
      `指定学科卒業（${input.educationLevel}）+ 実務経験 ${input.yearsOfPracticalExperience}年で要件を満たします`
    );
  }

  // 実務経験10年ルート（学歴不問）
  const experienceRoute = input.yearsOfGeneralExperience >= 10;
  if (experienceRoute) {
    reasons.push(`実務経験 ${input.yearsOfGeneralExperience}年（10年以上）で要件を満たします`);
  }

  let passed = eduRoute || experienceRoute;

  if (!passed) {
    reasons.push("国家資格・指定学科卒業+実務経験・実務経験10年のいずれの基準も満たしていません");
  }

  // 特定建設業は追加で指導監督的実務経験（4,500万円以上の工事、2年以上）が必要
  if (passed && input.licenseType === "特定") {
    const supervisoryRoute = input.yearsOfSupervisoryExperience >= 2;
    if (!supervisoryRoute) {
      passed = false;
      reasons.push(
        "特定建設業は上記に加えて、4,500万円以上の工事における指導監督的実務経験2年以上（または該当する国家資格）が必要ですが、確認できていません"
      );
    } else {
      reasons.push(`指導監督的実務経験 ${input.yearsOfSupervisoryExperience}年（2年以上）で特定建設業の追加要件も満たします`);
    }
  }

  return finish(input, passed, reasons, warnings);
}

function finish(input, passed, reasons, warnings) {
  if (passed) {
    warnings.push(`${input.officeName}: 資格者証・卒業証明書・実務経験証明書など裏付け書類の準備を忘れずに`);
  }
  return {
    officeName: input.officeName,
    passed,
    reasons,
    warnings,
  };
}

/**
 * 複数営業所分の専任技術者要件をまとめて判定する。
 * 1つでも要件を満たさない営業所があれば全体としては不合格。
 *
 * @param {import('../types.js').SenninGijutsushaInput[]} list
 * @returns {import('../types.js').RequirementCheckResult}
 */
export function checkSenninGijutsusha(list) {
  if (!list || list.length === 0) {
    return {
      key: "senninGijutsusha",
      label: "営業所ごとの専任技術者の配置",
      passed: false,
      reasons: ["営業所の情報が入力されていません"],
      warnings: [],
    };
  }

  const perOffice = list.map(checkSenninGijutsushaForOffice);
  const passed = perOffice.every((o) => o.passed);
  const reasons = perOffice.flatMap((o) => o.reasons.map((r) => `[${o.officeName}] ${r}`));
  const warnings = perOffice.flatMap((o) => o.warnings);

  return {
    key: "senninGijutsusha",
    label: "営業所ごとの専任技術者の配置",
    passed,
    reasons,
    warnings,
  };
}
