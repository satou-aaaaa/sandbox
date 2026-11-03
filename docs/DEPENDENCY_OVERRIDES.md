# 依存の上書き（package.json の overrides）

上流のパッケージが古い版を指定していて、`npm audit fix` でも Dependabot のセキュリティ更新でも直せない脆弱性を、
`package.json` の `overrides` で直すときの決まり。`test/dependencyOverrides.test.js` が下の2つを毎回調べる。

1. **版は範囲で書く**（`^6.16.1` のように。`6.16.0` のような1つの版に固定しない）。
   固定すると、次にその版で脆弱性が見つかったとき Dependabot が上げられない（`security_update_not_possible`）。
   2026-10-28〜31 に qs で6回のうち3回これが起きた（qs を `6.16.0` に固定していたため、直った 6.16.1 に上げられなかった）。
2. **下の表に1行足す**（なぜ上書きしたか・いつ外せるか）。表に無い上書きはテストが落とす。外したら行も消す。

## Dependabot のセキュリティ更新が `security_update_not_possible` で落ちたとき

1. Actions の失敗したログの最後の表で `dependency-name`・`lowest-non-vulnerable-version`・`blocking_dependencies` を見る。
2. `blocking_dependencies` の上流に、直った版を許す新しい版があれば、その上流を上げる（overrides は使わない）。
3. 無ければ `overrides` に `"<名前>": "^<lowest-non-vulnerable-version>"` を足し、`npm install` で lockfile を作り直す。
   直った版が上流の指定よりメジャーが上（例: `^10` に対して 11）なら、上流が使う道具を実際に動かして確かめる
   （`npm test`・`npm run lint`・`npm run typecheck` と、その道具のコマンド。下の表の「確かめたこと」に書く）。
4. `npm audit` が 0 件になったのを見てから PR にする。

## 今の上書き

| 名前 | 範囲 | なぜ | 外せる条件 | 確かめたこと |
| --- | --- | --- | --- | --- |
| `qs` | `^6.16.1` | @stryker-mutator/core → typed-rest-client 2.3.1 が `qs@6.15.1` に固定（GHSA-6pq8-jhm2-2vcw） | typed-rest-client が 6.16.1 以上を許す版になり、Stryker がそれを使う | `npm run test:mutation` の1組 |
| `uuid` | `^11.1.1` | autocannon → hyperid 3.3.0 が `uuid@^8.3.2` を指定（中程度の脆弱性。#193） | hyperid が uuid 11.1.1 以上を許す | `npm run test:load` |
| `source-map-js` | `^1.2.2` | jsdom → css-tree の lockfile が古い source-map-js を引いていた（css-tree 自体は `^1.2.1` を許す） | lockfile が 1.2.2 以上になっていれば外してよい（外す候補） | `npm test`（jsdom を使うテスト） |
| `minimatch` | `^11.0.1` | eslint・@eslint/config-array・@stryker-mutator/core・c8（test-exclude）が `^10.2` を指定。直った版は 11.0.1 から（GHSA-g3hv-75wg-m249） | 4つの上流が `^11` を許す | `npm run lint`（設定の当たり方が 10 と同じ）・`npx c8 --all`（拾うファイル数が 10 と同じ）・Stryker の1組 |
| `glob` | `^14.0.2` | c8 → test-exclude 8.0.0 が `^13.0.6` を指定。直った版は 14.0.2 から（GHSA-3g3m-2fjr-6pw4） | test-exclude が `^14` を許す | `npx c8 --all`（拾うファイル数が 13 と同じ） |
