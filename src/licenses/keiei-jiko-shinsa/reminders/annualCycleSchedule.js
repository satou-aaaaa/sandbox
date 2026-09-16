/**
 * 経審の年次反復型リマインドを計算する。
 *
 * 建設業許可（有効期限型・起点は許可日で不変）、古物商許可（変更トリガー型）、
 * 民泊（定期反復型・起点は直近実績日から一定間隔）のいずれとも異なる、
 * 「会社ごとに固定された年次イベント（決算）を起点に、有効期間（1年7ヶ月）
 * を切らさないよう毎年反復して受審し続ける」という第4のパターン
 * （docs/DESIGN_keiei-jiko-shinsa-core.md 4.3節）。
 *
 * 参照: e-Gov法令検索「建設業法」第27条の23、「建設業法施行規則」第18条の2
 * （経審結果の有効期間は審査基準日から1年7ヶ月であることを2026年9月に
 * 原文確認済み）https://laws.e-gov.go.jp/law/324M50004000014
 *
 * 【設計判断】有効期限の起点は「審査基準日（決算日）」であり、「結果通知日」
 * ではない。結果通知を受け取るまでには審査基準日から数ヶ月かかるため、
 * 結果通知日を起点にすると有効期限を長く見積もりすぎる誤りになる
 * （`latestKekkaTsuchibiIso`は参考記録用に保持するのみで期限計算には使わない）。
 * 「次回の審査基準日」は、直近の審査基準日に単純に1年を加算して推定する
 * （決算期変更があった場合は`latestKijunbiIso`を発注者側で手動補正する運用を前提とする）。
 */

const MONTHS_IN_VALIDITY = 19; // 1年7ヶ月 = 19ヶ月

/**
 * 審査基準日（決算日）から、経審結果の有効期限（審査基準日から1年7ヶ月）を計算する。
 * @param {string} kijunbiIso 審査基準日（YYYY-MM-DD）
 * @returns {string}
 */
export function calcYukoKigen(kijunbiIso) {
  return addMonthsIso(kijunbiIso, MONTHS_IN_VALIDITY);
}

/**
 * 直近の審査基準日から、翌年の審査基準日（次回決算日）を推定する。
 * 決算期が変わらない前提での単純な1年後推定。
 * @param {string} latestKijunbiIso
 * @returns {string}
 */
export function calcNextKijunbi(latestKijunbiIso) {
  return addMonthsIso(latestKijunbiIso, 12);
}

/**
 * 次回決算に向けた決算変更届の提出期限（次回審査基準日から4ヶ月後。
 * 建設業法上の決算変更届の提出期限と同じ日数）を計算する。
 * @param {string} nextKijunbiIso
 * @returns {string}
 */
export function calcNextKessanHenkoDeadline(nextKijunbiIso) {
  return addMonthsIso(nextKijunbiIso, 4);
}

/**
 * 経審の再受審の推奨申請時期。決算変更届の提出直後、経営状況分析（Y）の
 * 申請に要する期間を見込んだ上で、次回決算変更届提出期限の1ヶ月後を目安に設定する。
 * @param {string} nextKijunbiIso
 * @returns {string}
 */
export function calcRecommendedReapplicationDate(nextKijunbiIso) {
  return addMonthsIso(calcNextKessanHenkoDeadline(nextKijunbiIso), 1);
}

/**
 * @typedef {Object} KeieiJikoShinsaDetail LicenseEntry.keieiJikoShinsaDetail の中身
 * @property {string} [latestKijunbiIso] 直近の経審の審査基準日（YYYY-MM-DD）。未受審の場合は未設定
 * @property {string} [latestKekkaTsuchibiIso] 直近の経営規模等評価結果通知書の受領日（参考情報。有効期限の起点には使わない）
 * @property {number} [latestSougouHyoutei] 直近の総合評定値（P点）。参考記録用（本モジュールでは計算しない）
 * @property {string[]} [targetGyoshu] 経審を受けている業種区分の一覧
 * @property {"未申請" | "申請中" | "結果受領済み"} [yBunsekiStatus] 直近サイクルにおけるYの申請状況
 */

/**
 * 経審の年次反復リマインドを算出する。
 * ① 次回決算変更届の提出期限（経審申請の前提書類）
 * ② 経審再受審の推奨申請時期
 * ③ 現行の経審結果の有効期限（絶対に切らしてはならない最終締切）
 *
 * @param {import('../../../core/reminders/digest.js').LicenseEntry & { keieiJikoShinsaDetail?: KeieiJikoShinsaDetail }} license
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcKeieiJikoShinsaSchedule(license) {
  const latestKijunbi = license.keieiJikoShinsaDetail?.latestKijunbiIso;
  if (!latestKijunbi) return []; // 未受審の場合はリマインド対象外（まず初回申請の準備を進める段階のため）

  const nextKijunbi = calcNextKijunbi(latestKijunbi);
  const yukoKigen = calcYukoKigen(latestKijunbi); // 現行結果の有効期限

  return [
    {
      type: "keiei-next-kessan-henko",
      label: "次回決算に向けた決算変更届の提出期限（経審再受審の前提書類）",
      dueDateIso: calcNextKessanHenkoDeadline(nextKijunbi),
    },
    {
      type: "keiei-recommended-reapplication",
      label: "経審 再受審の推奨申請時期",
      dueDateIso: calcRecommendedReapplicationDate(nextKijunbi),
    },
    {
      type: "keiei-validity-deadline",
      label: "現行の経営事項審査結果の有効期限（切れると公共工事の入札参加資格を維持できません）",
      dueDateIso: yukoKigen,
    },
  ];
}

/** @param {string} iso @param {number} months うるう年・月末日（31日→存在しない月）は繰り下げで丸める */
function addMonthsIso(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const totalMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(totalMonthIndex / 12);
  const targetMonthIndex = ((totalMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return new Date(Date.UTC(targetYear, targetMonthIndex, day)).toISOString().slice(0, 10);
}
