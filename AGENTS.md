# AGENTS.md

AI エージェント共通の入口（Claude・Codex・Gemini・Copilot などが読む）。
このリポジトリの指示の本文は [CLAUDE.md](CLAUDE.md)。どの AI も、作業の前に CLAUDE.md を全部読み、そこに書かれた「変更してはならない前提」とテストのコマンドに従うこと。
（CLAUDE.md は agent/ の安全規則とテストが名前で参照しているので、本文はそちらに置いたままにしている）

- Claude 以外の AI・人が作業するときは、satou-aaaaa/shared-workflows の `routines/tool-map.md`（道具の置き換え）と `routines/without-claude.md` を読む。
