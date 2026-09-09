/* LINE ログインの決まりを確かめる。実行: npx tsx tests/line.ts

   ここで見るのは、鍵を使わずに確かめられること。
   本物のやりとり（LINE に問い合わせる所）は、設定が入った本番でしか
   通らないので、**組み立てる URL と、危ない所の作り**を見る。 */

import { readFileSync } from "node:fs";
import { authorizeUrl, LINE_CALLBACK_PATH } from "../src/lib/line";
import { emailLabel, isLineEmail, lineEmail } from "../src/lib/lineEmail";
import { checkLine, isOpsWord, verifyLineSignature } from "../src/lib/lineBot";
import { createHmac } from "node:crypto";
import { noticeLine } from "../src/lib/noticeText";

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
  /* 0034 で、番号は line_links（人と店の組）に移した。
     ここでは userByLineId が店を添えて引く */
  check(/userByLineId\(who\.sub\)/.test(cb), "LINE 番号で利用者を探す（店を添えて）");
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
  /* 公式アカウントは店ごとに別（げんきさん 2026-09-09）。
     押す前に、どちらの店に配るのかが出ていないと、よその友だちに配ってしまう */
  check(/BRAND\.shortName/.test(ui), "配る先の店の名前を出す");
  check(/owner-line-brand/.test(ui), "配る先の案内が、目印付きで出ている");
  /* 鍵を入れて Redeploy したのに効いていない、が押すまで分からないと困る。
     /setup で先に分かるようにしてある */
  const health = read("src/app/api/health/route.ts");
  check(/lineMenu: lineMenuReady\(\)/.test(health), "/setup が、鍵が入っているかを見られる");
  check(!/process\.env\.LINE_MENU_TOKEN/.test(health), "鍵そのものは読まない（入っているかだけ）");
  const setup = read("src/app/setup/SetupClient.tsx");
  check(/LINE_MENU_TOKEN/.test(setup) && /lineMenu/.test(setup), "/setup にリッチメニューの行がある");
}

console.log("── 本人への知らせ（docs/106）──");
{
  const bot = read("src/lib/lineBot.ts");
  check(/message\/push/.test(bot) && /message\/reply/.test(bot), "送る口と返す口が1か所にある");
  check(!/NEXT_PUBLIC_LINE/.test(bot), "鍵に NEXT_PUBLIC_ を付けない");

  /* 合言葉は「ちょうどその字」だけ。前方一致にすると、
     ふつうの相談に機械の返事をかぶせる */
  check(isOpsWord("設定"), "設定 で通る");
  check(isOpsWord(" セットアップ "), "前後の空白は無視する");
  check(isOpsWord("ＳＥＴＵＰ".toLowerCase()) || isOpsWord("setup"), "setup で通る");
  check(isOpsWord("Setup"), "大文字小文字は問わない");
  check(!isOpsWord("設定を変えたいのですが"), "ふつうの相談は拾わない");
  check(!isOpsWord(""), "空は通さない");
  check(!isOpsWord("受講コード"), "よその言葉は通さない");

  check(checkLine("").ok === false, "空は送らない");
  check(checkLine("あ".repeat(5000)).ok === false, "長すぎるものは送らない");
  check(checkLine("設定の様子").ok === true, "ふつうの本文は送れる");

  /* 本文の作りは、画面のお知らせと同じ言い方（DEFS を使い回す） */
  const t = noticeLine({ kind: "given", courseId: "ashiba" }, "https://example.com/", "特別教育ドットコム");
  /* 運営あての知らせと同じトークに並ぶので、向きが分かる1行を足す
     （げんきさん 2026-09-09「ユーザー宛の送信は『運営からのお知らせ』と
       表示させて。こんがらがる」） */
  check(t.startsWith("【特別教育ドットコム】運営からのお知らせ\n受講コードが届きました"), "誰からの知らせかが1行目に出る");
  check(t.includes("https://example.com/edu/ashiba"), "開く場所が入る（末尾の / は重ねない）");
  check(noticeLine({ kind: "なにこれ" }, "https://example.com", "店") === "", "知らない種類は送らない");

  /* **本部が書いた一言は送らない。**断った理由に名前が入りうる */
  const ng = noticeLine({ kind: "member_ng" }, "https://example.com", "店");
  check(!/note/.test(ng) && ng.split("\n").length === 5, "本文は向き・見出し・次にやること・行き先だけ");

  const server = read("src/lib/lineBot.server.ts");
  check(/AbortSignal\.timeout\(3000\)/.test(server), "3秒で諦める（元の操作を待たせない）");

  /* ── 署名を、本物の作り方で通してみる ──
     LINE と同じ手順（本文を HMAC-SHA256 して base64）で作った署名だけが通る */
  const secret = "test-channel-secret";
  const body = '{"events":[{"type":"message"}]}';
  const sign = (b: string, k: string) => createHmac("sha256", k).update(b, "utf8").digest("base64");
  check(verifyLineSignature(body, sign(body, secret), secret), "正しい署名は通る");
  check(!verifyLineSignature(body + " ", sign(body, secret), secret), "本文が1文字違えば通さない");
  check(!verifyLineSignature(body, sign(body, "よその鍵"), secret), "よその鍵で作った署名は通さない");
  check(!verifyLineSignature(body, "", secret), "署名が無ければ通さない");
  check(!verifyLineSignature(body, sign(body, secret), ""), "鍵が入っていなければ通さない");
  check(!verifyLineSignature(body, "abc", secret), "長さが違っても落ちない");
  check(/timingSafeEqual/.test(read("src/lib/lineBot.ts")), "署名は1文字ずつ比べない（時間で漏らさない）");

  const notice = read("src/lib/notice.server.ts");
  check(/pushToUser/.test(notice), "お知らせを残したら、LINE にも送る");
  check(notice.indexOf("add_notice") < notice.indexOf("await pushNotice"), "残してから送る");
  check(!/opts\.note/.test(notice.slice(notice.indexOf("async function pushNotice"))), "LINE には一言を渡さない");
}

console.log("── LINE から受ける（docs/106）──");
{
  const hook = read("src/app/api/line/webhook/route.ts");
  check(/verifyLineSignature/.test(hook), "署名を確かめる");
  check(hook.indexOf("verifyLineSignature") < hook.indexOf("JSON.parse"), "確かめてから中身を読む");
  check(/status: 401/.test(hook), "偽物には 200 を返さない");
  check(/isOwnerEmail/.test(hook), "運営にしか返さない");
  check(/runtime = "nodejs"/.test(hook), "署名を作るので node で動かす");
  check(!/follow/.test(hook.replace(/\/\*[\s\S]*?\*\//g, "")), "あいさつはここで出さない（公式アカウント側）");

  /* 合言葉に当たったのに黙るのはやめた（げんきさん 2026-09-09
     「特別教育ドットコムでは応答ない」）。返らない理由が3つあり、
     外から切り分けられなかった */
  check(/opsNotLinkedText/.test(hook), "つないでいない人には、その理由を返す");
  check(/opsNotOwnerText/.test(hook), "つなぐ相手を間違えている人には、どのアカウントかを返す");
  check(hook.indexOf("opsNotLinkedText") < hook.indexOf("opsStatusText("), "運営かどうかを見る前に、結び付きを見る");

  const ops = read("src/lib/opsStatus.server.ts");
  /* 鍵の値そのものを本文に混ぜない。入っているかどうか（mark）だけ。
     値段の上書きも出さない（商売の中身。トークは残る） */
  check(!/\$\{\s*process\.env\./.test(ops), "鍵の値を本文に混ぜない");
  check(!/priceOverrides/.test(ops), "値段の上書きは返さない");
  check(/NEED_SCHEMA/.test(ops), "版が足りているかを出す");
}

console.log("── 紐付けは店ごと（0034）──");
{
  /* げんきさん（2026-09-09）
       「足場屋革命でLINE登録したあとに、特別教育ドットコムでも
         LINE登録したら重複してしまってる」
     番号はプロバイダーごとなので、店が違えば同じ人でも番号が違う。
     1つの欄に入れていたので、二つの店で入ると人が二人になっていた */
  const bot = read("src/lib/lineBot.server.ts");
  check(/from\("line_links"\)/.test(bot), "紐付けは line_links から引く");
  check(!/eq\("line_user_id"[\s\S]{0,80}from\("users"\)/.test(bot), "users の欄はもう見ない");
  check((bot.match(/\.eq\("brand", BRAND\.id\)/g) ?? []).length >= 2, "引くときは必ず店を添える");
  check(/onConflict: "user_id,brand"/.test(bot), "同じ人・同じ店は入れ替える（二重に作らない）");

  const cb = read("src/app/auth/line/route.ts");
  check(/currentUser\(\)/.test(cb), "すでに入っている人には、その人に結び足す");
  check(cb.indexOf("currentUser()") < cb.indexOf("createUser"), "作る前に、いまの人を見る");
  check(!/line_user_id: who\.sub/.test(cb), "users の欄を書き換えない");

  /* 入っている人がつなぐ入り口。ログイン画面は入っている人が開けないので、
     マイページに置く（げんきさん「元々のアカウントにLINEを接続したい」） */
  const me = read("src/app/me/MeClient.tsx");
  check(/me-line-link/.test(me), "マイページに「LINEをつなぐ」がある");
  check(/api\/line\/login\?next=%2Fme/.test(me), "つないだらマイページへ戻る");
  check(/me-line-on/.test(me), "つながっているときは、そう出す");
  const my = read("src/app/api/mypage/route.ts");
  check(/lineLinked/.test(my), "つながっているかを返す");

  const owner = read("src/app/owner/LineClient.tsx");
  check(/owner-line-unlinked/.test(owner), "運営の画面に、結び付いていないときの理由が出る");
  check(/owner-line-id/.test(owner), "自分の番号を出せる（LINE_TO に写すため）");
}

console.log("── 仮のメールを画面に出さない（docs/106）──");
{
  check(emailLabel("a@b.jp") === "a@b.jp", "ふつうのメールはそのまま");
  check(emailLabel("line-U123@line.invalid") === "LINEで登録（メールなし）", "仮の住所は出さない");
  check(emailLabel("") === "" && emailLabel(null) === "", "無ければ空");
  for (const f of [
    "src/components/AccountBar.tsx",
    "src/app/me/MeClient.tsx",
    "src/app/admin/LearnerCard.tsx",
    "src/app/admin/AdminClient.tsx",
    "src/app/owner/LedgerClient.tsx",
  ]) {
    check(/emailLabel\(/.test(read(f)), `${f} が仮の住所を出さない`);
    /* 画面は lineEmail.ts から読む。line.ts は鍵を読むので、
       画面から辿れる所に混ぜない（tests/env-usage.mts） */
    check(/from "@\/lib\/lineEmail"/.test(read(f)), `${f} は鍵を読むファイルを引き込まない`);
  }

  /* LINE で入った人はパスワードが無い。決め直しの画面で
     行き止まりにしない（げんきさん 2026-09-09） */
  const login = read("src/app/login/LoginClient.tsx");
  check(/login-forgot-line/.test(login), "決め直しの画面にも LINE の道がある");
}

console.log(`\n${ok} 件通過 / ${ng} 件失敗`);
process.exit(ng ? 1 : 0);
