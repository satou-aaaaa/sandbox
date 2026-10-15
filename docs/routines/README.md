# 定期実行（Claude のルーティン）の手順書

Claude の定期実行（ルーティン）の手順を、ルーティンのプロンプトではなくこのフォルダに置く。
ルーティンのプロンプトは「`docs/routines/<名前>.md` を読み、その手順どおりに1回実行する」の1行だけにする。

- 手順を直すときは、このフォルダのファイルをPRで直す（ルーティンの設定画面を開かなくてよい）。
- 手順は使うときだけ読み込まれるので、プロンプトに長い手順を書くより利用枠の消費も少ない。

| ファイル | ルーティン | 実行 |
| --- | --- | --- |
| [issue-pr.md](issue-pr.md) | Issue/PR定期対応 | 週1（月曜 4:35 JST） |
| [ops-agent.md](ops-agent.md) | リポジトリ運用エージェント（クラウド・1サイクル） | 平日 2:07 JST |
| [weekly-issue-proposal.md](weekly-issue-proposal.md) | 週次: 新規Issueの提案（調査つき） | 週1（水曜 8:47 JST） |

共通のきまり（節約モード・守る順番・Claude が要らない作業は CI へ・satou さんへの連絡の書き方など）は、
すべてのルーティンで同じものを使うため [satou-aaaaa/shared-workflows の `routines/common.md`](https://github.com/satou-aaaaa/shared-workflows/blob/main/routines/common.md) に置いている。
各手順の前に読むこと。このリポジトリに特有の例: Dependabot の patch/minor 更新は `.github/workflows/dependabot-automerge.yml`
が自動マージを予約するので、ルーティンで重ねて扱わない。
