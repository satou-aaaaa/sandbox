# agent/ — Issue 自律処理ループ

`agent-ready` ラベル付きのIssueを、Claude Agent SDKで実装し、検証に通ればPRを作成する。
**マージは行わない**（人手レビュー必須）。設計の根拠は
[`docs/adr/0017-agent-sdk-issue-loop.md`](../docs/adr/0017-agent-sdk-issue-loop.md)。

本体アプリとは依存関係を分離している（`agent/package.json`）。

## 準備（初回のみ）

Docker Desktop を起動しておく（既定でコンテナ隔離。ADR-0017 Amendment 2）。隔離なしで動かす場合のみ `AGENT_SANDBOX=none` を明示する。

```bash
cd agent && npm ci
```

**認証は既定でClaudeサブスクリプション（Pro/Max。追加課金なし）**。APIキーは不要。

- Docker隔離（既定）: **`powershell -ExecutionPolicy Bypass -File agent\setup-auth.ps1`** が手順を補助する。先に別のターミナルで `claude setup-token` を実行してブラウザで承認し、表示されたトークンをコピー→スクリプトに非表示で貼り付けると、形式を検証してユーザー環境変数 `CLAUDE_CODE_OAUTH_TOKEN` に保存し、認証確認まで行う（APIキーは拒否する）。手動で行う場合は、表示されたトークンを、環境変数 `CLAUDE_CODE_OAUTH_TOKEN` に設定する（PowerShell: `[Environment]::SetEnvironmentVariable("CLAUDE_CODE_OAUTH_TOKEN", "<トークン>", "User")` のあとターミナルを再起動）。コンテナにはこのトークンだけを渡し、ホストのログイン情報は渡さない。
- 隔離なし（`AGENT_SANDBOX=none`）: この端末のClaude Codeログインをそのまま使うためトークン不要（隔離は無くなる）。
- 環境に `ANTHROPIC_API_KEY` があっても既定では**使わない**（従量課金の防止）。APIキーを使う場合だけ `AGENT_AUTH=api-key` を明示する。
- サブスクリプションの利用枠は対話利用と共有される。日次上限（5件）と1件あたりの上限は、この枠を使い切らないための歯止めでもある。

## 1サイクルの実行（定期実行のエントリポイント）

```bash
node cycle.mjs --dry-run   # 判定・対象の確認のみ（書き込みなし）
node cycle.mjs             # 回復 → スカウト → トリアージ → 実装/PR作成 → 要約 を1回
```

- **排他制御**: 実行が重なった場合、後発は何もせずスキップ（`agent/.state/cycle.lock`。残骸は自動で奪取）
- **異常終了からの回復**: `agent-working` のまま90分以上放置されたIssueを `agent-needs-human` に戻し、古い一時worktreeを片付ける
- **要約**: 結果を1行にまとめ、`agent/logs/cycle-latest.txt` に保存（1サイクルの全出力は `agent/logs/cycle-*.log`）

## 作業の自動起票（スカウト）

```bash
node scout.mjs --dry-run   # 提案を表示するのみ（起票しない）
node scout.mjs             # 起票する（1回最大2件。未完了のスカウトIssueが5件以上なら起票しない）
```

読み取り専用のエージェントが、テストの追加やREADME/CHANGELOGの食い違い修正といった**自動マージできる低リスクな作業**だけを、
`agent-scouted` ラベル付きで起票する。起票されたIssueはトリアージ→実装→PR→自動マージへ進む（`cycle.mjs` が順に実行する）。
法令判定・期限計算・src/の実装変更・保護パスに関わる提案は対象外。

## Issue の自動トリアージ（`agent-ready` を自動で付けるか判断する）

```bash
node triage.mjs --dry-run   # 判定結果を表示するのみ（ラベル・コメントは変更しない）
node triage.mjs             # 判定してラベルとコメントを付ける（既定で最大5件）
node cycle.mjs             # 判定 → 実装 → PR作成までを1回で（排他制御・回復つき）
```

- 対象: **所有者本人が起票**した未判定のIssue（第三者のIssueは一切対象にしない）
- 判定は読み取り専用のエージェントが行い、`agent-ready`（実行してよい）か `agent-needs-human`（人手が必要）を付ける。理由はIssueのコメントに残る
- ready にするのは「低リスク・法令判定/期限計算ロジックに触れない・人間の判断が不要・変更5ファイル以下」のみ。判定を解釈できない場合は必ず人手側に倒す
- 上書き: `agent-skip` を付けると永久に対象外。`agent-triaged` を外すと再判定される

## 使い方

```bash
node run.mjs --dry-run      # 対象Issueと権限設定の確認（API呼び出しなし）
node run.mjs                # 対象Issueを1件処理
node run.mjs --issue 81     # 指定Issueのみ
node run.mjs --max 3        # 1実行で最大3件
```

## 処理対象になる条件

- **所有者本人（`satou-aaaaa`）が起票**したIssueである（第三者のIssueは無視。
  公開リポジトリでのプロンプトインジェクション対策）
- `agent-ready` ラベルが付いている
- `agent-working` / `agent-done` が付いていない

Issueに `agent-ready` を付けるのが「実行してよい」という人間の承認になる。

## 処理の流れ

1. `origin/main` から隔離した `git worktree` を作り、`npm ci`
2. エージェントが実装（許可ツール: ファイル編集・テスト実行のみ。40ターン/$3まで）
3. 保護パス（`.github/` `agent/` `hooks/` `data/` `package*.json` `CLAUDE.md` `.env*`）に
   変更があれば中止しIssueへ差し戻す
4. `npm test` / `typecheck` / `lint` が通らなければ中止しIssueへ差し戻す
5. commit → push → PR作成（`agent-authored` ラベル）→ Issueを `agent-done` に

中止時はIssueにコメントが付き、`agent-ready` に戻る。

### PRの自動マージ（原則は人が介入しない）

`agent-pr-automerge` workflowが、エージェントのPRをリスクで振り分ける（ADR-0017 Amendment 10）。

- **自動マージ（既定）**: README/CHANGELOG、docs直下の文書（設計文書・ADRを除く）、テスト（追加≧削除）、法令ロジックを含まないコード（src/web・src/core/documents・src/portal・scripts・e2e・load）。12ファイル以下。必須チェック成功後にマージされる
- **承認が必要**: 法令判定・期限計算・様式生成の領域、設定・スキーマ・設計文書・ADR。理由がPRにコメントされ `agent-needs-review` が付く。`agent-approved` ラベル（所有者、またはAIレビュアー）で自動マージ。リポジトリ変数 `AGENT_AUTOMERGE_LEGAL=true` にすると法令領域も自動マージ
- **常に人手**: 保護パス（.github・agent・hooks・data・package*.json・CLAUDE.md・.env*）。ただし `agent/` の運用系ファイル（`policy.js` の `AGENT_OPS_FILES`: README・report・sync・scout・triage・selftest）だけは、AIレビュアーの承認で自動マージされる（Amendment 19）

### AIレビュアーによる承認（人の承認とみなす）

承認が必要なPR（法令ロジック・設定・設計文書など）は、`review.mjs` の独立したレビュアーが判定する（ADR-0017 Amendment 11）。

```bash
node review.mjs --dry-run   # 判定のみ（ラベル・コメントは変更しない）
node review.mjs             # 承認なら agent-approved を付ける（自動マージへ）、不承認なら理由をコメント
```

- 別の強いモデル・読み取り専用・観点の異なる2回。**全員一致**で承認。解釈不能・失敗は不承認
- 承認しないもの: 保護パスの変更、必須チェック未完了・失敗、差分が大きすぎるPR
- 承認後に問題があれば、PRに `agent-revert` ラベルを付けて取り消す（事後の取消。順次追加）
- `cycle.mjs` が実装/PR作成の後に自動で実行する

### 事後の取消（リバート）と自己解決

原則はマージ前に人が承認しないため、問題があれば事後に取り消す（ADR-0017 Amendment 12）。

- **人による取消**: マージ済みPRに `agent-revert` ラベルを付ける（1操作）。リバートPRが作られ、自動マージされる
- **自動の取消**: mainのCIが、エージェントのPRの直後に失敗し、再実行後も失敗した場合（一時的な失敗の誤検知を避けるため、まず再実行）
- **再挑戦**: 取り消したIssueは、失敗の記録（教訓）を添えて再オープンされ、最大2回まで再挑戦する。上限に達したら `agent-needs-human`
- **サーキットブレーカー**: 24時間以内に自動リバートが2件以上あれば、自動運用を停止し、障害記録のIssue（`agent-incident`）を立てる。解消してIssueをクローズすると再開

```bash
node revert.mjs --sweep --dry-run   # 取り消し対象の確認のみ
node revert.mjs --pr 99 --reason "理由"   # 指定したマージ済みPRを取り消す
```

### 自己修復（CI失敗・レビュー指摘への対応）

エージェントのPRのCIが失敗した、またはAIレビューで不承認となった場合、`fix.mjs` がフィードバック（失敗ログ・指摘）を渡して同じブランチ上で修正する（ADR-0017 Amendment 13）。

```bash
node fix.mjs --dry-run   # 対象と対応内容の確認のみ
node fix.mjs             # 修正する（既定で1件）
```

- 最大2回（`agent-fix-1/2`）。上限に達したら `agent-needs-human`。修正後はCIとAIレビューを最初から受け直す
- テストを削除・弱めて通すことは禁止。実装と同じ多層防御（許可リスト・保護パス・検証ゲート・Docker隔離）で動く

### 自動の点検（セルフテスト）

週1回、ダミーのIssueで「実装→自動マージ→完了同期→取消→再挑戦」を実際に通し、パイプラインの回帰を検知する（ADR-0017 Amendment 15）。`cycle.mjs` が `--if-due` で呼ぶ。

```bash
node selftest.mjs --dry-run   # 実施内容の表示のみ
node selftest.mjs             # 実施する（CIとマージを待つため、20〜30分かかる）
```

- 触るのは `docs/SELFTEST.md` だけ。成功のたびに1行残る（この行が増えている間は、パイプラインが正常）
- 失敗したら、障害Issue（`agent-incident`）を1件だけ立てる。トリアージのLLM判定は対象外（非決定的なため）

### 運用レポート（日次・週次の報告）

自律運用の結果を、GitHubの状態から決定的に集計して届ける（LLM不使用。ADR-0017 Amendment 16）。

```bash
node report.mjs                         # 日次（直近24時間）を表示するのみ
node report.mjs --period weekly         # 週次（直近7日）を表示するのみ
node report.mjs --post                  # 常設のレポート用Issue（agent-report）へ投稿（日次は、動き・問題がある日だけ）
```

- 内容: エージェントのPRのマージ（自動マージ）、取り消し、AIレビューの承認率、人・Dependabotのマージ、推定費用、自動点検の結果。問題がある日は冒頭で目立たせ、要対応（障害・人手に回したIssue・承認待ちPR・CI失敗）を列挙する
- **通知を受け取るには**、レポート用Issue（`agent: 運用レポート（自動投稿）`）を **Watch（購読）** する。GitHubの通知（メール・モバイル）で届く。最新のレポートは `agent/logs/report-latest.md` にも残る
- `cycle.mjs` の末尾で、日次と週次（前回から7日以上）を自動で呼ぶ

### Issueのクローズ

- PRがマージされると、PR本文の `Closes #N` によりGitHubがIssueを**自動でクローズ**する。
- ただし、**自動マージ（GITHUB_TOKEN）でマージされたPRでは、この自動クローズもclosedイベントのworkflowも働かない**（実機のドリルで判明）。`sync.mjs` が状態から判断してクローズする（`cycle.mjs` の先頭で実行。ADR-0017 Amendment 14）
- PRがマージされずに閉じられた場合は、`agent-issue-sync` workflowがIssueを `agent-needs-human` に戻し、理由をコメントする（`agent-done` のまま放置しない）。

## 注意

- ソースコードとIssue本文がAnthropic APIへ送信される。Issueに実データを書かない。
- ローカル実行が前提。`GITHUB_TOKEN` で作ったPRは必須CIを起動しないため、
  Actionsで動かす場合は別途GitHub App等のトークンが必要（ADR-0017）。
- 安全側の判断は `policy.js` に集約し `test/agent-policy.test.js` で検証している。
  権限を緩める変更は必ずテストとADRを更新すること。

## 安全機構（多層防御）

| 層 | 内容 |
|---|---|
| 許可リスト/拒否リスト | `dontAsk` で列挙外を拒否。push・`gh`・ネットワーク・保護パス編集を明示禁止 |
| PreToolUseフック | 全ツール呼び出しを `decideToolUse` で再判定（作業ディレクトリ外・`.env`・鍵・危険コマンドを拒否）。**全呼び出しを `agent/logs/*.jsonl` に監査記録** |
| 保護パス検査 | 変更に保護対象が含まれれば中止 |
| 検証ゲート | `npm test` / `typecheck` / `lint` / `check-secrets`。失敗時は1回だけ自己修正させ、再失敗で差し戻し |
| 上限 | 1件あたり40ターン・$3・20分。日次で5件・$10（`agent/.state/daily.json`） |
| コンテナ隔離 | 既定で `npm ci`・エージェント・検証をDockerコンテナ内で実行（作業ツリーのみマウント・`--cap-drop ALL`・読み取り専用FS・非root・認証情報なし）。Docker不可なら実行しない |
| キルスイッチ | `agent/.disabled` ファイルを作る、または `AGENT_DISABLED=1` で即停止 |

### 緊急停止・確認

```bash
touch agent/.disabled      # 停止（rm agent/.disabled で再開）
ls agent/logs              # 監査ログ（1行1JSON: ツール名・入力・判定・結果）
```

### 既知の制約

コンテナのネットワークegressは無制限（API・npmレジストリ到達のため）。API宛のみ許可するプロキシへの移行が次の一手（ADR-0017 Amendment 2）。

## クラウドルーティンでの実行（PC非依存）

Claudeのクラウドルーティンで1サイクルを実行できる（プロンプトは [`cloud-routine.md`](cloud-routine.md)）。
`AGENT_GH_MODE=rest AGENT_STATE=github AGENT_SANDBOX=none AGENT_AUTH=inherit` で動かす。
ghはREST（`gh-rest.mjs`）経由のみ（GraphQLは不可）、実行回数などの状態はGitHubから導出する。
自動マージの予約はGraphQL専用のため、`agent-pr-automerge` workflowが代行する。
一時停止は、`agent-pause` ラベルを付けたIssueを開いておく。ローカルのスケジュールタスクとの併用（二重実行）は避ける。
