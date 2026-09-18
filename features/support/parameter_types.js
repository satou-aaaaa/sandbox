/**
 * Cucumber標準の{string}パラメータ型はASCIIの引用符（"..."や'...'）のみに
 * 対応しており、日本語の鉤括弧（「...」）は認識しない。本プロジェクトの
 * フィーチャーファイルは日本語の業務文書として自然な鉤括弧を使うため、
 * 専用のパラメータ型を定義する。
 */
import { defineParameterType } from "@cucumber/cucumber";

defineParameterType({
  name: "quoted",
  regexp: /「([^」]*)」/,
  transformer: (s) => s,
});
