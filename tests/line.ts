/* LINE ログインの決まりを確かめる。実行: npx tsx tests/line.ts

   ここで見るのは、鍵を使わずに確かめられること。
   本物のやりとり（LINE に問い合わせる所）は、設定が入った本番でしか
   通らないので、**組み立てる URL と、危ない所の作り**を見る。 */

import { readFileSync } from "node:fs";
import { authorizeUrl, isLineEmail, lineEmail, LINE_CALLBACK_PATH } from "../src/lib/line";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

console.log("── LINE へ送る入口 ──");
{
  process.env.LINE_LOGIN_CHANNEL_ID = "1234567890";
  const u = new URL(authorizeUrl({
    redirectUri: "https://www.example.jp/auth/line",
    state: "st",
    nonce: "no",
  }));
  check(u.origin + u.pathname === "https://access.line.me/oauth2/v2.1/authorize", "行き先は LINE の認可画面");
  check(u.searchParams.get("response_type") === "code", "合図（code）で受け取る");
  check(u.searchParams.get("client_id") === "1234567890", "チャネルの番号を渡す");
  check(u.searchParams.get("state") === "st", "state を渡す（差し込み対策）");
  check(u.searchParams.get("nonce") === "no", "nonce を渡す");
  check(u.searchParams.get("scope") === "openid profile", "メールは求めない（持っていない人が多い）");
  check(u.searchParams.get("bot_prompt") === "aggressive", "友だち追加も勧める（リッチメニュー）");
  check(u.searchParams.get("redirect_uri") === "https://www.example.jp/auth/line", "戻り先は店の住所");
  check(LINE_CALLBACK_PATH === "/auth/line", "戻り先の道は /auth/line");
}

console.log("── 仮のメール ──");
{
  /* LINE はメールを返さないことが多い。**届かない住所**を作って結ぶ。
     届く住所にすると、間違って送ったときに知らない人へ届く */
  const e = lineEmail("U1234");
  check(e === "line-U1234@line.invalid", `その人だけの住所（${e}）`);
  check(e.endsWith("@line.invalid"), "届かない住所（.invalid）を使う");
  check(isLineEmail(e), "仮の住所だと見分けられる");
  check(!isLineEmail("a@example.jp"), "本物の住所は仮と間違えない");
}

console.log("── 危ない所 ──");
{
  const lib = strip(read("src/lib/line.ts") + read("src/lib/line.server.ts"));
  /* id_token を自分で読むだけだと、偽物を見抜けない */
  /* strip は // を落とすので、URL は素のまま見る（https:// が消える） */
  const raw = read("src/lib/line.ts") + read("src/lib/line.server.ts");
  check(lib.includes("LINE_VERIFY_URL") && raw.includes("oauth2/v2.1/verify"),
    "id_token は LINE に確かめてもらう");
  check(!/atob|jwtDecode|split\("\."\)/.test(lib), "id_token を自分で開いて済ませていない");
  check(!/NEXT_PUBLIC_LINE/.test(lib), "鍵に NEXT_PUBLIC_ を付けていない");
  check(read("src/lib/line.server.ts").includes('"server-only"'), "鍵を使う所はサーバ専用");

  const start = strip(read("src/app/api/line/login/route.ts"));
  check(/httpOnly: true/.test(start), "state はブラウザから読めないクッキーに入れる");
  check(/maxAge: 600/.test(start), "10分で切れる");
  check(/next\.startsWith\("\/"\)/.test(start), "戻り先は中の道だけ（よそへ飛ばす道具にしない）");

  const cb = strip(read("src/app/auth/line/route.ts"));
  check(/state !== saved/.test(cb), "戻ってきた state を必ず確かめる");
  check(/line_user_id/.test(cb), "LINE 番号で利用者を探す");
  check(/generateLink/.test(cb) && /verifyOtp/.test(cb), "1回きりの合図をログインに引き換える");
  check(!/console\.log/.test(cb), "途中の中身を書き出していない");
  /* 氏名は修了証に載る。LINE の表示名は本名とは限らない */
  check(!/name: who\.name.*update/s.test(cb) || !/\.update\(\{ name/.test(cb),
    "LINE の表示名で氏名を上書きしない");

  const mig = read("supabase/migrations/0033_line_login.sql");
  check(/users_line_user_id_key/.test(mig), "1つの LINE 番号は1人にだけ");
  check(/LINE の紐付けは変更できません/.test(mig), "本人には紐付けを触らせない");
}

console.log("── リッチメニュー ──");
{
  const lib = read("src/lib/line.ts");
  check(/MENU_AREAS/.test(lib), "札の一覧が1か所にある");
  check((lib.match(/href: "\/(edu|join|me)"/g) ?? []).length === 3, "押す所は3つ（手袋でも押せる大きさ）");
  const api = read("src/app/api/owner/line-menu/route.ts");
  check(/currentOwner\(\)/.test(api), "運営でなければ配れない");
  check(/LINE_MENU_TOKEN/.test(api) && !/NEXT_PUBLIC_LINE/.test(api), "鍵は環境変数（画面に埋めない）");
  check(/user\/all\/richmenu/.test(api), "友だち全員の既定にする");
  check(/richMenuBody\(site, BRAND\.shortName\)/.test(api), "行き先は、この店の住所");
  const ui = read("src/app/owner/LineClient.tsx");
  check(/richmenu\.png/.test(ui), "押す前に、出来上がりを見せる");
}

console.log(`\n${ok} 件通過 / ${ng} 件失敗`);
process.exit(ng ? 1 : 0);
