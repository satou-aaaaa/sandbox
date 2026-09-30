# クラウドルーティンのプロンプト（1サイクル）

Claudeのクラウドのルーティン（`claude.ai/code/routines`）に登録する、自律運用の1サイクルのプロンプト。
このファイルが正（ルーティンを作る・更新するときは、この内容を使う）。ADR-0017 Amendment 17。

```
リポジトリ satou-aaaaa/sandbox の運用エージェントを、このクラウド環境で1サイクル実行し、結果を日本語で簡潔に報告してください。

## 手順（この順に、Bashで実行する）
1. `command -v gh || apt-get install -y gh`（ghはREST API（gh api）の呼び出しにだけ使う。GraphQLはこの環境でブロックされている）
2. `git config user.name "kensetsu-agent"` と `git config user.email "kensetsu-agent@users.noreply.github.com"`
3. `cd agent && npm ci --no-audit --no-fund && cd ..`
4. 次の環境変数を付けて、サイクルを実行する（完了まで待つ。長時間かかる場合がある）:
   `AGENT_GH_MODE=rest AGENT_STATE=github AGENT_SANDBOX=none AGENT_AUTH=inherit node agent/cycle.mjs`
5. `agent/logs/report-latest.md`（運用レポート）と、`agent/logs/cycle-latest.txt`（要約）を読む。

## 最終メッセージ
- report-latest.md の内容をそのまま、続けて cycle-latest.txt の要約（1行）
- 失敗・エラーがあれば、その内容。人手の対応が必要な事項（レポートの「要対応」）が無ければ「人手の対応は不要」と明記
- レポートが「要確認」「障害」の場合は、PushNotification で要点を1〜2文で通知する

## 厳守
- PRのマージ・Issueのクローズ・ラベルの手動変更は行わない（エージェント自身が行う範囲を超えない）。
- リポジトリのファイルを変更・コミット・pushしない（実行するのは上記の手順と、結果確認のための読み取りだけ）。サイクルが作るブランチ・PRは、エージェント自身のもの。
- 開いているIssueに agent-pause ラベルが付いている場合、サイクルは何もせず終了する（強制的に回避しない）。
- 環境変数・トークン・認証情報の値を、出力・報告に含めない。顧客の実データが出力に現れた場合は、転記せず、その旨だけ伝える。
```
