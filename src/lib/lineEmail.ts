/* LINE から入った人の、仮のメールと、その見せ方。

   ── なぜ line.ts から分けたか ──
   ここは**画面（"use client"）からも読む。**
   line.ts は鍵（LINE_LOGIN_CHANNEL_SECRET など）を読むので、
   画面から辿れる所に置くと、サーバだけの設定が画面側の束に混ざる。
   Next が消してくれるとはいえ、**混ぜない形にしておく**
   （tests/env-usage.mts が見張っている）。

   だから、ここには設定を読む所を1つも置かない。 */

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

/** 画面に出す、その人の連絡先の書き方。

    **仮の住所をそのまま出さない。**名簿に
    「line-U4af…@line.invalid」と並ぶと、担当者は
    「これは何かの間違いか」と思って、本人に聞き直すことになる。
    LINE から入った人はメールを持っていないので、
    **持っていないことが分かる字**にする。

    メールがあればそのまま。無ければ空（枠を出さない）。 */
export const emailLabel = (email: string | null | undefined): string => {
  const e = (email ?? "").trim();
  if (!e) return "";
  return isLineEmail(e) ? "LINEで登録（メールなし）" : e;
};
