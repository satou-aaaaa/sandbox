/**
 * 農地転用許可（農地法第4条・第5条）の要件判定に使うデータ型定義（JSDoc）。
 *
 * 【注意】農地区分の定義・例外規定の要件は農地法施行令・施行規則、および
 * docs/REQUIREMENTS_nouchi-tenyo-core.md 1.3節の一次資料確認が完了してから
 * 確定すること。以下は要件定義書の暫定整理に基づく実装の出発点であり、
 * 確定仕様ではない。
 */

/**
 * @typedef {Object} NouchiTenyoRicchiKijunInput 立地基準の判定に使う入力（農地区分）
 * @property {"農用地区域内農地" | "甲種農地" | "第1種農地" | "第2種農地" | "第3種農地"} nouchiKubun
 *   転用対象農地の区分（農業委員会への事前相談・現地確認等で確認した内容の入力）
 * @property {boolean} [hasExceptionReason] 原則不許可の区分（農用地区域内農地・
 *   甲種農地・第1種農地）に該当する場合、例外規定に該当する事情があるか
 * @property {string} [exceptionReasonNote] 例外事由の具体的な内容（自由記述。合否には影響させず、必ず人手確認を促す）
 * @property {boolean} [hasNoAlternativeLand] 第2種農地の場合、周辺の他の土地で代替可能な土地が無いか
 */

/**
 * @typedef {Object} NouchiTenyoIppanKijunInput 一般基準の判定に使う入力
 * @property {boolean} hasSufficientFundsAndCredit 転用を確実に行うための資力・信用が確認できるか
 * @property {boolean} hasConstructionSchedule 工事計画・工程表が具体的に定まっているか
 * @property {boolean} hasNeighborDamagePreventionMeasures 周辺農地への被害防除措置（排水計画等）が講じられているか
 * @property {boolean} [hasNeighborConsent] 隣接農地所有者等の同意を得ているか（任意。未取得でも合否には影響させず警告のみとする）
 */

/**
 * @typedef {Object} ShikinChotatsuItem 資金調達内訳1件分（事業計画書用）
 * @property {string} kubun 区分（例: "自己資金", "金融機関借入"）
 * @property {number} amountYen 金額（円）
 * @property {string} [note] 備考（融資内諾書の有無等）
 */

/**
 * @typedef {Object} NouchiTenyoApplicantProfile 申請者の総合入力データ
 * @property {"4条" | "5条"} article 適用条文（4条=自己転用、5条=権利移動を伴う転用）
 * @property {string} applicantName 申請者氏名または法人名
 * @property {string} [address]
 * @property {string} [landAddress] 転用対象農地の所在地（地番）
 * @property {number} [landAreaSqm] 転用対象農地の面積（平方メートル）。
 *   4ヘクタール（40,000㎡）を超える場合は農林水産大臣への協議が必要になる
 *   （`eligibility/daijinKyogi.js`。農地法附則2項1号・3号）
 * @property {string} [purposeOfConversion] 転用の目的（例: "資材置場", "駐車場", "太陽光発電設備"）
 * @property {string} [rightsHolderName] 譲受人・借主氏名（5条許可の場合のみ入力。4条の場合は未設定）
 * @property {NouchiTenyoRicchiKijunInput} ricchiKijun
 * @property {NouchiTenyoIppanKijunInput} ippanKijun
 * @property {ShikinChotatsuItem[]} [shikinChotatsu] 資金調達内訳（事業計画書用）
 */

export {};
