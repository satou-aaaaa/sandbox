/**
 * 同一ファイルに対する「読み込み→変更→書き込み」の一連の操作を直列化する、
 * プロセス内限定の簡易ミューテックス。
 *
 * 【なぜ必要か】`clientStore.js`・`draftStore.js`の`upsertXxx`系関数は、
 * ファイル全体を読み込み→配列を書き換え→ファイル全体を書き戻す、という
 * read-modify-write方式で実装されている。ロックが無いと、2つの呼び出しが
 * ほぼ同時に発生した場合（例: Webフォームを複数タブで同時に操作した場合や、
 * 将来複数利用者が同時にアクセスするようになった場合）、両方が同じ「変更前」
 * の内容を読み込んでからそれぞれ書き戻すことになり、後から書き込んだ方が
 * 先の変更を丸ごと上書きしてしまう（lost update。カオステストで実際に
 * 再現したバグ。`test/chaos.test.js`参照）。
 *
 * 【スコープ外】本モジュールはあくまで「同一プロセス内」の直列化のみを保証する。
 * 複数プロセス・複数マシンから同じファイルへ同時に書き込むケース
 * （ファイルシステムレベルの排他制御。`proper-lockfile`等）は対象外。
 * 現状は単一プロセスのローカルWebサーバー・CLIスクリプトのみを想定している
 * ため、これで十分と判断している。将来、複数プロセス構成になった場合は
 * データベースの導入（ADR-0003の見直し）とあわせて再検討すること。
 */

/** @type {Map<string, Promise<unknown>>} ファイルパスごとの「実行中の直近の操作」を保持する */
const locks = new Map();

/**
 * `filePath` に対する操作を、同じ`filePath`への他の`withFileLock`呼び出しと
 * 直列化して実行する。異なる`filePath`への呼び出しは互いに待ち合わせない。
 *
 * @template T
 * @param {string} filePath
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function withFileLock(filePath, fn) {
  const previous = locks.get(filePath) ?? Promise.resolve();
  // 前段の操作が失敗していても、後続の操作の実行は妨げない
  // （1件の失敗でロックが永久に詰まってしまうのを防ぐため）。
  const previousSettled = previous.catch(() => {});
  const current = previousSettled.then(fn);
  // マップに保持するのは「常に解決するPromise」にする。呼び出し元へ返す`current`
  // 自体は`fn`の成否をそのまま反映する（失敗時は呼び出し元に伝播する）。
  locks.set(
    filePath,
    current.catch(() => {})
  );
  return current;
}
