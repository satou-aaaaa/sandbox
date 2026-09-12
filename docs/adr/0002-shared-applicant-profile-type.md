# 0002. 全様式生成モジュールでApplicantProfile型を共有する

Status: Accepted
Date: 2026-09（M2）

## Context（背景）

M1で実装した要件判定エンジンは `ApplicantProfile` 型を入力としていたが、
M1試作の様式第一号生成モジュール（`youshiki1.js`）は独自の `Youshiki1Data`
型を使っていた。M2で様式第六号・第七号・第八号・第二十号の二を追加するに
あたり、様式ごとに個別の入力型を新設すると、同じ申請者データ
（商号・代表者名・所在地等）を様式の数だけ別々の形で入力・保守する必要が
生じ、データの二重管理・不整合のリスクが高まる。

## Decision（決定）

すべての様式生成モジュール（`youshiki1.js` を含む）が要件判定エンジンと
同じ `ApplicantProfile` 型を入力として受け取るよう統一する。様式固有の
追加項目が必要な場合は、`types.js` の `ApplicantProfile` に**オプション
フィールドとして追加**し、既存フィールドの意味は変更しない（例:
`officers`、`keieiGyomuKanri.responsibleName`、
`senninGijutsushaList[].personName`）。

これに伴い `youshiki1.js` を独自型からリファクタリングし、共通のdocx
組み立てヘルパー（見出し・赤字注記・表）を `src/documents/common.js` に
切り出した。

## Consequences（影響）

- **メリット**: 申請者データの入力は1箇所（`ApplicantProfile` オブジェクト）で
  完結し、Webフォーム（M3）も同じ型を1対1で組み立てるだけでよい。判定ロジックも
  各様式モジュールが `src/eligibility/rules/*.js` の既存関数をそのまま呼ぶ形に
  統一でき、要件判定エンジンと様式サマリーの判定結果が食い違うことを防げる
- **デメリット**: `ApplicantProfile` が肥大化しやすい（現時点で複数様式分の
  オプションフィールドを抱えている）。将来様式が大幅に増えた場合、型定義の
  可読性が下がる可能性がある
- **見直しのトリガー**: `ApplicantProfile` のオプションフィールドが管理しきれない
  規模になった場合、様式カテゴリ別のサブ型に分割し、`ApplicantProfile` は
  それらを合成する形に再設計することを検討する
