import "server-only";
import { LINE_TOKEN_URL, LINE_VERIFY_URL, lineChannelId } from "./line";

/* LINE に問い合わせる所（サーバ専用）。

   純粋な計算（URLの組み立て・仮のメール）は src/lib/line.ts。
   分けてあるのは、**鍵を使わずに決まりを確かめられるようにする**ため
   （tests/line.ts が line.ts を読む）。 */

const channelSecret = () => (process.env.LINE_LOGIN_CHANNEL_SECRET ?? "").trim();

export type LineUser = {
  /** LINE の利用者番号。この仕組みの利用者に結ぶ（users.line_user_id） */
  sub: string;
  name: string;
  email: string | null;
};

/** 合図（code）を、LINE の本人確認に引き換える。

    **id_token の中身を自分で読まない。**LINE の verify に渡して、
    channel_id と署名を LINE 側で確かめてもらう。 */
export async function exchange(code: string, redirectUri: string): Promise<LineUser | null> {
  const id = lineChannelId();
  const secret = channelSecret();
  if (!id || !secret) return null;

  const res = await fetch(LINE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!res.ok) return null;
  const tok = (await res.json()) as { id_token?: string };
  if (!tok.id_token) return null;

  const ver = await fetch(LINE_VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: tok.id_token, client_id: id }),
  });
  if (!ver.ok) return null;
  const v = (await ver.json()) as { sub?: string; name?: string; email?: string };
  if (!v.sub) return null;
  return {
    sub: v.sub,
    name: (v.name ?? "").trim(),
    email: (v.email ?? "").trim() || null,
  };
}

