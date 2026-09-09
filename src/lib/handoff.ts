/* ログインを、ホーム画面のアプリへ持ち込む引き換えコード（0036）。

   げんきさん（2026-09-09）
     「ホーム画面に追加したのに、ホーム画面に追加した所から
       ログインするとネット版になる」

   ── なぜ要るか ──
   LINEログインは access.line.me という**よそのサイト**へ一度出る。
   iPhone のホーム画面アプリは、よそへ出た時点でブラウザに切り替わり、
   そのまま戻ってこない。しかも**ホーム画面アプリとブラウザは
   ログインの記憶が別**なので、ブラウザで入ってもアプリは入っていない。

   パスワードの決め直し（メールのリンク）も同じことが起きる。

   ── どう渡すか ──
   ブラウザで入ったあと8文字のコードを出し、アプリでそれを打つ。
   1回きり・5分で切れる（決まりは 0036 の SQL 側）。

   ここは字の形をそろえるだけ。**鍵は持たない。** */

/** 使う字。打ち間違えやすい 0/O・1/I/L を外した31字（受講コードと同じ） */
export const HANDOFF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const HANDOFF_LEN = 8;
/** 何分もつか。画面に出す */
export const HANDOFF_MIN = 5;

/** 打ち方の揺れを直す。小文字・空白・ハイフンを許す。

    紙に書き写して打つので、**そこそこ間違える。**
    形が違うだけで断ると、打ち直しの理由が分からない。 */
export function normalizeHandoff(s: string): string {
  return (s ?? "")
    .toUpperCase()
    .replace(/[\s\-‐-‒–—―ー_]/g, "")
    /* 打ち間違えやすい字は、使っている字に寄せる */
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, HANDOFF_LEN);
}

/** 使える形か。**字種まで見る**（0 や 1 は使っていない） */
export function isHandoff(s: string): boolean {
  const t = normalizeHandoff(s);
  if (t.length !== HANDOFF_LEN) return false;
  return [...t].every((c) => HANDOFF_ALPHABET.includes(c));
}

/** 読みやすく4文字ずつ区切る。画面に出すときだけ */
export const showHandoff = (s: string): string =>
  s.length === HANDOFF_LEN ? `${s.slice(0, 4)} ${s.slice(4)}` : s;
