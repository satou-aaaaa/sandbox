/**
 * すべての許可種別アドオンをコアへ登録する。リマインドを計算するCLI（scripts/reminders-daily.js 等）から、
 * 計算より前に1度呼ぶ。登録漏れ（古物商の登録漏れで、リマインドが出なかった過去の不具合。
 * scripts/reminder-digest.js のコメント参照）を、1か所にまとめて防ぐためのもの。
 *
 * 新しい許可種別を追加したら、ここにも追加する（test/registerAll.test.js が、src/web/server.js との差を検知する）。
 */
import { registerConstructionLicense } from "./construction/index.js";
import { registerKobutsuLicense } from "./kobutsu/index.js";
import { registerSanpaiLicense } from "./sanpai/index.js";
import { registerMinpakuLicense } from "./minpaku/index.js";
import { registerGijinkokuModule } from "./gijinkoku/index.js";
import { registerKeieiJikoShinsaLicense } from "./keiei-jiko-shinsa/index.js";
import { registerNouchiTenyoLicense } from "./nouchi-tenyo/index.js";
import { registerInshokutenEigyoLicense } from "./inshokuten-eigyo/index.js";
import { registerTokuteiGinouModule } from "./tokutei-ginou/index.js";

export function registerAllLicenses() {
  registerConstructionLicense();
  registerKobutsuLicense();
  registerSanpaiLicense();
  registerMinpakuLicense();
  registerGijinkokuModule();
  registerKeieiJikoShinsaLicense();
  registerNouchiTenyoLicense();
  registerInshokutenEigyoLicense();
  registerTokuteiGinouModule();
}
