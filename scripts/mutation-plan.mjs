#!/usr/bin/env node
/**
 * ミューテーションテストの組（シャード）の計画を、GitHub Actions の matrix に渡せる JSON で出す。
 * 中身と理由は scripts/lib/mutationPlan.mjs。
 *
 * 使い方: node scripts/mutation-plan.mjs          # {"include":[{"name","mutate","tests"}]}
 *         node scripts/mutation-plan.mjs --table  # 人が読む一覧
 * テストが1つも届かない組があれば終了コード1（生き残りが全部「未到達」になり、結果が当てにならないため）。
 */
import config from "../stryker.config.mjs";
import { planFromConfig } from "./lib/mutationPlan.mjs";

const shards = planFromConfig(config);
const empty = shards.filter((s) => s.tests.length === 0);
if (process.argv.includes("--table")) {
  for (const s of shards) console.log(`${s.name}\t変える ${s.mutate.length} ファイル\tテスト ${s.tests.length} ファイル`);
} else {
  const include = shards.map((s) => ({ name: s.name, mutate: s.mutate.join(","), tests: s.tests.join(" ") }));
  console.log(JSON.stringify({ include }));
}
if (empty.length > 0) {
  console.error(`テストが届かない組があります: ${empty.map((s) => s.name).join(", ")}`);
  process.exit(1);
}
