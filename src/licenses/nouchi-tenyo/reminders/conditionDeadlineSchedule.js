/**
 * 農地転用許可の「条件履行期限型」リマインドを計算する。
 *
 * これまでの3パターン（建設業許可・産廃許可＝満了日ベースの有効期限型、
 * 古物商許可＝変更トリガー型、民泊届出＝定期反復型）に続く、4つ目の新しい
 * リマインドパターン。農地転用許可には更新の概念が無い代わりに、許可条件
 * として「工事着手期限」「転用の完了・完了報告の期限」等の履行期限が
 * 個別に付されることが多く、これらは許可証に個別記載された期限日を
 * そのまま入力として受け取る（他のパターンのような起点日からの計算式は
 * 存在しない）。
 *
 * 参照: e-Gov法令検索「農地法」第51条（許可条件違反が許可取消し等の処分
 * 事由になることを2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/327AC0000000229
 *
 * 【設計判断】期限超過時に動的な文言切替え（today基準の判定）を行うには
 * ScheduleFnのシグネチャを`(license, todayIso) => ScheduleItem[]`へ変更する
 * 必要があり、他の許可種別の実装・呼び出し側にも影響が及ぶ。コアの
 * インターフェースを変更しない方針を優先し、期限超過の有無にかかわらず
 * 「期限超過の場合は許可取消し等のリスクがある」という注記を常にラベル
 * 文言へ含める（超過していない場合は単なる予告注記として機能する）。
 * 期限超過後は既存のbucketizeAlertsが自動的に「期限超過」区分に分類する
 * ため、区分表示とラベル注記が組み合わさり、超過時により強い警告になる。
 */

/**
 * @typedef {Object} NouchiTenyoLicenseDetail LicenseEntry.nouchiTenyoDetail の中身
 * @property {"4条" | "5条"} [article] 適用条文
 * @property {string} [grantDateIso] 許可年月日（参考情報。農地転用許可には更新の概念が無いためリマインド計算の起点にはしない）
 * @property {string} [constructionStartDeadlineIso] 許可条件として付された工事着手期限日（YYYY-MM-DD）。条件が付されていない場合は未設定
 * @property {boolean} [constructionStartReported] 着手を行政書士側で確認・記録済みか。trueになった時点で該当リマインドを止める
 * @property {string} [completionReportDeadlineIso] 転用完了・完了報告の期限日（YYYY-MM-DD）。許可条件として付されている場合のみ設定
 * @property {boolean} [completionReported] 完了報告書を提出済みか。trueになった時点で該当リマインドを止める
 * @property {string} [restorationDeadlineIso] 一時転用の農地復元期限日（YYYY-MM-DD）。
 *   「一時転用」は農地法4条・5条の条文上の用語ではなく、工事期間中の仮設
 *   道路・資材置場等、転用後に農地への原状回復を予定している案件で許可条件
 *   として付される「復元期限」を指す行政運用上の呼称である（2026年9月・
 *   e-Gov法令検索で農地法の条文中に「一時」を含む用語自体が存在しないことを
 *   確認済み）。恒久転用と同じ4条・5条の許可の枠組み内で、復元期限という
 *   条件が付される点が異なるだけのため、既存の「条件履行期限型」パターンを
 *   そのまま適用できる
 * @property {boolean} [restored] 農地への原状回復が完了し行政書士側で確認・記録済みか。trueになった時点で該当リマインドを止める
 */

/**
 * @param {import('../../../core/reminders/digest.js').LicenseEntry & { nouchiTenyoDetail?: NouchiTenyoLicenseDetail }} license
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcNouchiTenyoSchedule(license) {
  const detail = license.nouchiTenyoDetail;
  if (!detail) return [];

  const items = [];

  if (detail.constructionStartDeadlineIso && !detail.constructionStartReported) {
    items.push(buildConditionItem("construction-start-deadline", "工事着手期限（許可条件の履行）", detail.constructionStartDeadlineIso));
  }

  if (detail.completionReportDeadlineIso && !detail.completionReported) {
    items.push(buildConditionItem("completion-report-deadline", "転用完了・完了報告の期限（許可条件の履行）", detail.completionReportDeadlineIso));
  }

  if (detail.restorationDeadlineIso && !detail.restored) {
    items.push(buildConditionItem("restoration-deadline", "一時転用の農地復元期限（許可条件の履行）", detail.restorationDeadlineIso));
  }

  return items; // 条件が付されていない、または履行済みの項目が無ければ空配列
}

/**
 * 許可条件1件分の ScheduleItem を組み立てる。
 * @param {string} type
 * @param {string} baseLabel
 * @param {string} dueDateIso
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem}
 */
function buildConditionItem(type, baseLabel, dueDateIso) {
  return {
    type,
    label: `${baseLabel}（期限を超過すると許可取消し等のリスクがあります。至急、農業委員会へご相談ください）`,
    dueDateIso,
  };
}
