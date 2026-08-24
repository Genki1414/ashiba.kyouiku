/* 参加コード。事業者ごとの合言葉。

   この仕組みは外販するので、受講者は「自分がどの会社の人か」を
   これで名乗る。決まっていないと、修了証をどの会社の名義で出すか決まらない。

   画面でもサーバでも同じ判断をしたいので、ここは何にも依存しない。
   （サーバだけの処理は src/lib/tenant.ts） */

/** 使う字。紙に書いて渡すので、読み違えやすい 0・1・O・I・L は入れない */
export const JOIN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** 参加コードの桁数。会社の名簿に入るだけのもの */
export const JOIN_LEN = 8;

/** 受講コードの桁数。1人1枚の売り物（席） */
export const SEAT_LEN = 12;

const RE = (n: number) => new RegExp(`^[${JOIN_ALPHABET}]{${n}}$`);
const JOIN_RE = RE(JOIN_LEN);
const SEAT_RE = RE(SEAT_LEN);

/** 入れてもらったコードを、比べられる形に揃える */
export const normalizeJoinCode = (s: string): string =>
  s.trim().toUpperCase().replace(/[\s-]/g, "");

/** 参加コードの形か（8文字） */
export const isJoinCode = (s: string): boolean => JOIN_RE.test(normalizeJoinCode(s));

/** 受講コードの形か（12文字） */
export const isSeatCode = (s: string): boolean => SEAT_RE.test(normalizeJoinCode(s));

/** どちらのコードか。桁で見分ける */
export function codeKind(s: string): "join" | "seat" | null {
  const v = normalizeJoinCode(s);
  if (JOIN_RE.test(v)) return "join";
  if (SEAT_RE.test(v)) return "seat";
  return null;
}

/** 受講コードを 4-4-4 で区切って見せる。紙に書き写すため */
export const showSeatCode = (s: string): string =>
  normalizeJoinCode(s).replace(/(.{4})(?=.)/g, "$1-");

/** 新しいコードを作る。推測されないよう、暗号用の乱数を使う */
export function newJoinCode(len = JOIN_LEN): string {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => JOIN_ALPHABET[n % JOIN_ALPHABET.length]).join("");
}
