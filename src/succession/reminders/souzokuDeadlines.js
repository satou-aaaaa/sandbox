/**
 * 相続手続きに関連する期限（相続放棄・相続税申告・遺留分侵害額請求）の
 * リマインドを計算する。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】民法915条1項（相続放棄の熟慮期間。
 * 自己のために相続の開始があったことを知った時から3ヶ月）・民法1048条
 * （遺留分侵害額請求権。知った時から1年の消滅時効、相続開始から10年の
 * 除斥期間）・相続税法27条（相続の開始があったことを知った日の翌日から
 * 10ヶ月）・33条（申告期限までの納付）を確認済み。
 *
 * 【重要】ここで計算するのはあくまで期限の「見える化」である。各期限に
 * 対応する実際の手続き（相続放棄の申述・相続税申告・遺留分侵害額請求の
 * 意思表示）の代理・作成は、行政書士の業務範囲外のものを含む
 * （要件定義書1.3節）。各関数が返すlabelには、必ず担当すべき専門家を
 * 明記する（FR-S4.4）。
 *
 * コアの`registerScheduleFn`（許可の`LicenseEntry`を前提とした契約）は
 * 使わず、`docs/DESIGN_uketsuke-portal.md` 4.3節の`buildCaseDeadlineAlerts`
 * と同じパターンで、`SuccessionCaseRecord`から直接、コアの`ReminderAlert`と
 * 同じ形のオブジェクトを組み立てる（1.2節の設計原則）。
 */
import { daysUntil } from "../../core/reminders/dateUtils.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** @param {string} iso @param {number} months 暦月単位の加算（月末クランプ） */
function addMonthsClamped(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + months;
  const targetYear = y + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12; // 0-11
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay)).toISOString().slice(0, 10);
}

/** @param {string} iso @param {number} years */
function addYearsClamped(iso, years) {
  return addMonthsClamped(iso, years * 12);
}

/** @param {string} iso @param {number} days */
function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * 相続放棄の熟慮期間の期限（民法915条1項: 自己のために相続の開始が
 * あったことを知った時から3ヶ月）。
 * @param {string} knownDateIso 相続の開始を知った日
 */
export function calcSouzokuHoukiDeadline(knownDateIso) {
  return {
    type: "souzoku-houki",
    label: "相続放棄の申述期限（3ヶ月）※申述書の作成は弁護士・司法書士の職域",
    dueDateIso: addMonthsClamped(knownDateIso, 3),
  };
}

/**
 * 相続税の申告・納付期限（相続税法27条・33条: 相続の開始があったことを
 * 知った日の翌日から10ヶ月）。
 * @param {string} knownDateIso
 */
export function calcSouzokuzeiShinkokuDeadline(knownDateIso) {
  const startFromNextDay = addDaysIso(knownDateIso, 1);
  return {
    type: "souzokuzei-shinkoku",
    label: "相続税の申告・納付期限（10ヶ月）※申告書の作成は税理士の独占業務",
    dueDateIso: addMonthsClamped(startFromNextDay, 10),
  };
}

/**
 * 遺留分侵害額請求の期間制限（民法1048条）。「知った時から1年」の消滅
 * 時効と、「相続開始の時から10年」の除斥期間の2つがあり、早い方が優先
 * する。両方をリマインドとして提示する。
 * @param {string} deathDateIso 相続開始日（死亡日）
 * @param {string} [knownDateIso] 遺留分の侵害を知った日（省略時はdeathDateIsoと同一とみなす）
 */
export function calcIryuubunSeikyuDeadlines(deathDateIso, knownDateIso) {
  const from = knownDateIso ?? deathDateIso;
  return [
    {
      type: "iryuubun-1nen",
      label: "遺留分侵害額請求の期限（知った時から1年・消滅時効）※請求の代理は弁護士の職域",
      dueDateIso: addYearsClamped(from, 1),
    },
    {
      type: "iryuubun-10nen",
      label: "遺留分侵害額請求の期限（相続開始から10年・除斥期間）※請求の代理は弁護士の職域",
      dueDateIso: addYearsClamped(deathDateIso, 10),
    },
  ];
}

/**
 * SuccessionCaseRecord一覧から、コアのReminderAlertと同じ形のリマインド
 * 項目を生成する。`docs/DESIGN_uketsuke-portal.md` 4.3節の
 * `buildCaseDeadlineAlerts`と同じ設計パターン。
 * @param {import('../types.js').SuccessionCaseRecord[]} cases
 * @param {string} [todayIso]
 * @returns {import('../../core/reminders/digest.js').ReminderAlert[]}
 */
export function buildSuccessionDeadlineAlerts(cases, todayIso) {
  const alerts = [];
  for (const c of cases) {
    if (c.status === "完了") continue;
    const known = c.decedentDeathKnownDateIso ?? c.decedentDeathDateIso;
    const items = [
      calcSouzokuHoukiDeadline(known),
      calcSouzokuzeiShinkokuDeadline(known),
      ...calcIryuubunSeikyuDeadlines(c.decedentDeathDateIso, known),
    ];
    for (const item of items) {
      alerts.push(makeSuccessionAlert(c, item, todayIso));
    }
  }
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * @param {import('../types.js').SuccessionCaseRecord} caseRecord
 * @param {{ type: string, label: string, dueDateIso: string }} item
 * @param {string} [todayIso]
 * @returns {import('../../core/reminders/digest.js').ReminderAlert}
 */
function makeSuccessionAlert(caseRecord, item, todayIso) {
  const days = daysUntil(item.dueDateIso, todayIso);
  return {
    clientName: caseRecord.caseLabel ?? `案件 ${caseRecord.caseId}`,
    type: item.type,
    label: item.label,
    dueDateIso: item.dueDateIso,
    daysUntil: days,
    isOverdue: days < 0,
  };
}
