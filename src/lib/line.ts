/* LINE でログインする（0033）。

   ── なぜ LINE か ──
   現場の職人は、メールを持っていない・使っていない人が多い。
   メールとパスワードで入る形は、そこで止まる。忘れたときの決め直しも、
   メールが読めないと詰む（げんきさん 2026-09-09）。

   ── どう繋ぐか ──
   Supabase のログインに LINE は入っていない。だから
     ① LINE で本人だと確かめる（id_token を LINE に検証してもらう）
     ② その人に当たる Supabase の利用者を探す（無ければ作る）
     ③ サーバで1回きりの合図を作り、それをクッキーのログインに引き換える
   という橋を自分で架ける。②③はサーバだけで行う（service_role）。

   ── 決めたこと ──
   ・**id_token は必ず LINE に検証してもらう。**自分で中身を読むだけでは、
     偽の token を作られたときに見抜けない
   ・**state を必ず確かめる。**確かめないと、よそのサイトから
     ログインの流れを差し込まれる（CSRF）
   ・LINE の表示名は**修了証に使わない。**本名とは限らない。
     氏名はマイページで入れてもらう（0015 からの決まり）
   ・鍵（channel secret）は LINE_LOGIN_CHANNEL_SECRET。
     **NEXT_PUBLIC_ を付けない。**付けると画面に埋まって誰でも使える */

export const LINE_AUTH = "https://access.line.me/oauth2/v2.1/authorize";
export const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
export const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

/** 設定が入っているか。/setup で出す */
export function lineLoginReady(): boolean {
  return !!(process.env.LINE_LOGIN_CHANNEL_ID ?? "").trim()
    && !!(process.env.LINE_LOGIN_CHANNEL_SECRET ?? "").trim();
}

export const lineChannelId = () => (process.env.LINE_LOGIN_CHANNEL_ID ?? "").trim();

/** 戻り先。店ごとの住所に付ける（src/lib/siteUrl.ts） */
export const LINE_CALLBACK_PATH = "/auth/line";

/** LINE へ送る、ログインの入口 */
export function authorizeUrl(opts: { redirectUri: string; state: string; nonce: string }): string {
  const u = new URL(LINE_AUTH);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", lineChannelId());
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.state);
  u.searchParams.set("nonce", opts.nonce);
  /* openid と profile だけ。email は LINE の審査が要るうえ、
     持っていない人も多い。**無くても入れる作りにする** */
  u.searchParams.set("scope", "openid profile");
  /* 友だち追加も同じ画面で勧める。リッチメニューを使ってもらうため。
     断ってもログインはできる */
  u.searchParams.set("bot_prompt", "aggressive");
  return u.toString();
}

/* ── この仕組みの中で使う、仮のメール ──

   Supabase の利用者はメールで見分ける作りになっている。
   LINE から来た人はメールを持っていないことがあるので、
   **その人だけの、届かない住所**を作って結ぶ。

   届かない住所にしてあるのは、間違って送らないため。
   （招待や決め直しのメールは、この住所には出さない） */
export const lineEmail = (sub: string): string => `line-${sub}@line.invalid`;

/** 仮の住所か。画面に出さないための見分け */
export const isLineEmail = (email: string | null | undefined): boolean =>
  !!email && email.endsWith("@line.invalid");
