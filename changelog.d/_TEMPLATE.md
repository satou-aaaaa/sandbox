<!--
  CHANGELOG.md の断片ファイル雛形（Issue #230）。

  このファイル（`_TEMPLATE.md`）自体は集約スクリプトの対象外
  （ファイル名が "_" または "." で始まるものは `scripts/aggregate-changelog.mjs` が無視する）。
  ディレクトリを空のままGit管理するための役割も兼ねている。

  - 1ファイル = 1件の変更。ファイル名は `<PR番号>.md`（例: `231.md`）。
    同じPRで複数件書きたい場合は `231-2.md` のように連番を付ける。
  - 中身は CHANGELOG.md に貼り付けられる断片（リスト項目1つを想定。
    複数行にわたる場合もMarkdownのリストとして崩れないようにインデントを揃える）。
  - 見出し（`## ...（YYYY年M月）`）は書かない。集約時に
    `node scripts/aggregate-changelog.mjs --section "## ..."` で指定した
    見出しの下に入る。
  - 詳しい運用（集約タイミング・コマンド）は docs/DEVELOPMENT_GUIDE.md を参照。
-->
- （ここに変更内容を1件、箇条書きで書く）
