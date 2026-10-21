// ワークフローが直接呼ぶ scripts/*.sh に実行の印（git の 100755）が付いているかを確かめる。
// 2026-10 に gh-upsert-issue.sh の印が無く、Law watch・夜間検査・ミューテーションの Issue 投稿が
// 「Permission denied」で毎回落ちていた（4週続けて法令の変化の知らせが届かなかった）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('ワークフローが直接呼ぶ scripts/*.sh は実行できる印が付いている', () => {
  const dir = '.github/workflows';
  const called = new Set();
  for (const f of readdirSync(dir)) {
    if (!/\.ya?ml$/.test(f)) continue;
    const text = readFileSync(`${dir}/${f}`, 'utf8');
    // 「bash scripts/x.sh」のように bash 経由で呼ぶものは印が要らないので外す
    for (const m of text.matchAll(/(?<![\w./-])(?<!bash )(?<!sh )(?:\.\/)?(scripts\/[\w.-]+\.sh)/g)) called.add(m[1]);
  }
  assert.ok(called.size > 0, '直接呼ぶスクリプトが見つからない（検査の正規表現を見直す）');
  const modes = execFileSync('git', ['ls-files', '-s', ...called], { encoding: 'utf8' });
  const lines = modes.trim().split('\n').filter(Boolean);
  const tracked = new Set(lines.map((l) => l.split('\t')[1]));
  const missing = [...called].filter((p) => !tracked.has(p));
  assert.deepEqual(missing, [], `ワークフローが呼ぶのに git に無い: ${missing.join(', ')}`);
  const notExec = lines.filter((l) => !l.startsWith('100755')).map((l) => l.split('\t')[1]);
  assert.deepEqual(notExec, [], `実行の印が無い: ${notExec.join(', ')}（git update-index --chmod=+x で直す）`);
});
