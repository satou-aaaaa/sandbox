/**
 * 古物商許可の「書換申請」「返納」の期限計算、および変更届出の
 * 即時警告メッセージを提供する。建設業許可の renewalSchedule.js と異なり、
 * 起点は「許可日」ではなく「変更・廃業という出来事の発生日」である点に注意。
 *
 * 参照: docs/REQUIREMENTS_kobutsu-core.md 8.4節（一次資料未確認。要件定義書
 * の二次情報のまとめであり、実装の正としては扱わない）
 */

/**
 * @typedef {Object} KobutsuLicenseDetail 古物商許可のクライアント側追加情報
 *   （`LicenseEntry.kobutsuDetail` の中身。コア側のLicenseEntry型自体には
 *   含めず、古物商アドオン側だけがこの形を知っている。
 *   docs/DESIGN_kobutsu-core.md 4.4節参照）
 * @property {string} [grantDateIso] 許可年月日（リマインド計算の起点にはしない。参考情報）
 * @property {string} [lastRecordedChangeDateIso] 直近に記録した記載事項変更日（書換申請の期限計算の入力）
 * @property {string} [closureDateIso] 廃業日（返納期限の計算の入力。廃業していない場合は未設定）
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 記載事項変更日から、書換申請の期限（14日後）を計算する。
 * 月単位の丸め（addMonthsClamped）は不要な、単純な暦日加算。
 * @param {string} changeDateIso YYYY-MM-DD
 * @returns {string}
 */
export function calcShokanShinseiDeadline(changeDateIso) {
  return addDaysIso(changeDateIso, 14);
}

/**
 * 廃業日から、許可証返納の期限（10日後）を計算する。
 * @param {string} closureDateIso YYYY-MM-DD
 * @returns {string}
 */
export function calcHenoukiDeadline(closureDateIso) {
  return addDaysIso(closureDateIso, 10);
}

/**
 * 記載事項以外の変更を入力した際に、即座に表示する警告メッセージを返す。
 * リマインド一覧（数日〜数ヶ月単位の定期確認を前提とする既存の
 * bucketizeAlerts）には含めない設計判断について、
 * docs/REQUIREMENTS_kobutsu-core.md FR-K3.4を参照。
 * @returns {string}
 */
export function buildHenkoTodokedeWarning() {
  return "※ 記載事項以外の変更（取り扱う古物の区分の追加等）は、事由が発生した日から3日以内に変更届出が必要です。至急、届出の準備をしてください。";
}

/** @param {string} iso @param {number} days */
function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return date.toISOString().slice(0, 10);
}
