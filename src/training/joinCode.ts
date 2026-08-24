/* 参加コード。事業者ごとの合言葉。

   この仕組みは外販するので、受講者は「自分がどの会社の人か」を
   これで名乗る。決まっていないと、修了証をどの会社の名義で出すか決まらない。

   画面でもサーバでも同じ判断をしたいので、ここは何にも依存しない。
   （サーバだけの処理は src/lib/tenant.ts） */

/** 使う字。紙に書いて渡すので、読み違えやすい 0・1・O・I・L は入れない */
export const JOIN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** 桁数 */
export const JOIN_LEN = 8;

/* 形を見る決まり。使う字の一覧から作るので、片方だけ直しても食い違わない */
const CODE_RE = new RegExp(`^[${JOIN_ALPHABET}]{${JOIN_LEN}}$`);

/** 入れてもらったコードを、比べられる形に揃える */
export const normalizeJoinCode = (s: string): string =>
  s.trim().toUpperCase().replace(/[\s-]/g, "");

/** コードの形が合っているか */
export const isJoinCode = (s: string): boolean => CODE_RE.test(normalizeJoinCode(s));

/** 新しいコードを作る。推測されないよう、暗号用の乱数を使う */
export function newJoinCode(len = JOIN_LEN): string {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => JOIN_ALPHABET[n % JOIN_ALPHABET.length]).join("");
}
