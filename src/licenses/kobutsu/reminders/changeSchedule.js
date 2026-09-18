/**
 * 古物商許可の「書換申請」「事前届出」「返納」の期限計算を提供する。
 * 建設業許可の renewalSchedule.js と異なり、起点は「許可日」ではなく
 * 「変更・廃業という出来事の発生日（または予定日）」である点に注意。
 *
 * 【2026年9月・e-Gov法令検索で確認済み】旧版は「記載事項以外の変更
 * （取り扱う古物の区分の追加等）は事由発生から3日以内に変更届出が必要」
 * としていたが、これは一次資料未確認の二次情報に基づく誤りだったことが
 * 判明したため訂正した。古物営業法第7条・古物営業法施行規則第5条・第7条
 * （https://laws.e-gov.go.jp/law/324AC0000000108 、
 * https://laws.e-gov.go.jp/law/407M50400000010 ）を確認した結果、実際は
 * 以下のとおりである。
 * - 第5条第1項第2号（営業所又は古物市場の名称及び所在地。主たる営業所に
 *   限らずその他の営業所も含む）の変更: **事前届出**。施行規則第5条2〜3項
 *   により、様式第五号の届出書を変更予定日の**3日前まで**に提出する
 *   （`calcEigyoshoHenkoJizenTodokedeDeadline`）
 * - 上記以外の第5条第1項各号（氏名/名称・住所、取り扱う古物の区分、
 *   管理者の氏名・住所、行商の別、インターネット利用の別・送信元識別符号、
 *   法人役員）の変更: **事後届出**。施行規則第5条4〜6項により、様式第六号の
 *   届出書を変更の日から**14日以内**（登記事項証明書の添付を要する場合は
 *   20日以内）に提出する。届出事項が許可証の記載事項に該当する場合は
 *   併せて書換えを受ける（法第7条第5項）。本モジュールの
 *   `calcShokanShinseiDeadline`（14日後）はこちらに対応する
 */
import { addDaysIso } from "../../../core/reminders/dateUtils.js";

/**
 * @typedef {Object} KobutsuLicenseDetail 古物商許可のクライアント側追加情報
 *   （`LicenseEntry.kobutsuDetail` の中身。コア側のLicenseEntry型自体には
 *   含めず、古物商アドオン側だけがこの形を知っている。
 *   docs/DESIGN_kobutsu-core.md 4.4節参照）
 * @property {string} [grantDateIso] 許可年月日（リマインド計算の起点にはしない。参考情報）
 * @property {string} [lastRecordedChangeDateIso] 直近に記録した記載事項変更日（書換申請の期限計算の入力。営業所の名称・所在地以外の変更）
 * @property {string} [plannedEigyoshoChangeDateIso] 営業所又は古物市場の名称・所在地変更の予定日（事前届出の期限計算の入力）
 * @property {string} [closureDateIso] 廃業日（返納期限の計算の入力。廃業していない場合は未設定）
 */

/**
 * 記載事項変更日から、書換申請（届出）の期限（14日後）を計算する。
 * 月単位の丸め（addMonthsClamped）は不要な、単純な暦日加算。
 * 登記事項証明書の添付を要する変更（法人の役員変更等）の場合は
 * 20日以内に延長されるが、本関数は個人申請を主眼とする一般的な
 * 14日を計算する（法人申請の場合は20日以内の余地があることを
 * 呼び出し側で別途案内すること）。
 * @param {string} changeDateIso YYYY-MM-DD
 * @returns {string}
 */
export function calcShokanShinseiDeadline(changeDateIso) {
  return addDaysIso(changeDateIso, 14);
}

/**
 * 営業所又は古物市場の名称・所在地の変更予定日から、事前届出の期限
 * （変更予定日の3日前）を計算する（古物営業法第7条第1項・施行規則第5条
 * 2〜3項）。他の記載事項の変更（`calcShokanShinseiDeadline`）と異なり、
 * 事後ではなく事前に届け出る必要がある点に注意。
 * @param {string} plannedChangeDateIso YYYY-MM-DD
 * @returns {string}
 */
export function calcEigyoshoHenkoJizenTodokedeDeadline(plannedChangeDateIso) {
  return addDaysIso(plannedChangeDateIso, -3);
}

/**
 * 廃業日から、許可証返納の期限（10日後）を計算する。
 * @param {string} closureDateIso YYYY-MM-DD
 * @returns {string}
 */
export function calcHenoukiDeadline(closureDateIso) {
  return addDaysIso(closureDateIso, 10);
}
