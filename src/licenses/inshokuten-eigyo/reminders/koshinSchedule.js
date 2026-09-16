/**
 * 飲食店営業許可の更新満了リマインド（可変期間型・第三のパターン）。
 *
 * 建設業許可・産廃許可は「許可年月日＋固定/選択式の年数」から満了日を
 * 計算し、技人国ビザは「満了日そのもの」を入力として受け取っていた。
 * 本モジュールは「起点（許可年月日）は分かっているが、そこに加える年数
 * （5〜8年）が許可ごとに自治体・施設の立入検査結果で個別に決まる」という
 * 第三のパターンに当たる。月単位丸め計算ロジック自体は産廃許可と同じく
 * `src/core/reminders/expirySchedule.js`（`calcExpirySchedule`）を再利用し、
 * 有効期間の年数を引数として渡すことで、コア側（`ScheduleFn`契約）を
 * 一切変更せずに対応した（docs/DESIGN_inshokuten-eigyo-core.md 4.3節）。
 *
 * 【要件定義書1.3節の設計判断】有効期間の年数は許可証交付後の立入検査
 * 結果で個別に決定され、申請前には確定しないため、許可前の見込み年数
 * からの自動計算は行わない。`validityYears`が未入力（＝許可証交付前）の
 * 場合は空配列を返し、リマインドを生成しない。
 */
import { calcExpirySchedule } from "../../../core/reminders/expirySchedule.js";

/**
 * @typedef {Object} InshokutenLicenseDetail LicenseEntry.inshokutenDetail の中身
 * @property {string} [municipalityName] 許可を交付した自治体名（保健所設置市・特別区・都道府県等）
 * @property {string} [grantDateIso] 許可年月日（YYYY-MM-DD）。満了日計算の起点
 * @property {number} [validityYears] 有効期間年数（5〜8が目安。自治体・施設により異なり、許可証交付時に個別に決定される。許可前には確定しないため許可証交付後に入力する）
 * @property {string} [responsiblePersonName] 食品衛生責任者の氏名（変更があった場合は最新の氏名に更新する）
 * @property {string} [lastRenewalDateIso] 直近の更新（更新許可申請が受理された）年月日。任意
 */

/**
 * @param {import('../../../core/reminders/digest.js').LicenseEntry & { inshokutenDetail?: InshokutenLicenseDetail }} license
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcInshokutenKoshinSchedule(license) {
  const detail = license.inshokutenDetail;
  if (!detail?.grantDateIso || !detail?.validityYears) return [];

  const schedule = calcExpirySchedule(detail.grantDateIso, detail.validityYears);
  return [
    {
      type: "inshokuten-koshin-early-notice",
      label: `更新準備の早期検討（満了180日前・有効期間${detail.validityYears}年）`,
      dueDateIso: schedule.earlyNoticeDate,
    },
    {
      type: "inshokuten-koshin-prepare",
      label: "更新準備開始の推奨日（満了60日前）",
      dueDateIso: schedule.recommendedStartDate,
    },
    {
      type: "inshokuten-koshin-deadline",
      label: "更新申請の目安締切（満了30日前。運用は自治体により異なるため保健所へ要確認）",
      dueDateIso: schedule.hardDeadline,
    },
  ];
}
