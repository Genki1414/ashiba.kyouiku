"use client";

/* ホーム画面に追加してあるか。

   ── なぜ見るか ──
   ・追加してあると、住所バーの無い画面で開く。現場では画面が広いほうがいい
   ・**iPhone では、ホーム画面に追加していないと通知が届かない。**
     ブラウザのタブで開いているあいだは、Push を受け取れない。
     だから「便利です」ではなく、通知を出すための前提として案内する

   追加済みなら案内を出さない。済んだ人に出し続けると読まれなくなる
   （はじめかたの道のりと同じ考え方）。 */

/** ホーム画面から開いているか */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    /* iOS の Safari は display-mode を返さないことがあるので、
       navigator.standalone も見る（iOS だけにある古い印） */
    const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return ios || window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    /* 判定できない端末では「追加していない」として案内を出す。
       出しすぎるほうが、出さずに通知が届かないより軽い */
    return false;
  }
}

/** ホーム画面に追加する手順。端末を当てにいかず、両方出す。

    見分けを外すと、逆の手順を読ませることになる。
    2行しかないので、両方出しても読める。 */
export const ADD_STEPS: { os: string; how: string }[] = [
  { os: "iPhone・iPad", how: "下の「共有」（□に↑）→ ホーム画面に追加" },
  { os: "Android", how: "右上の「⋮」→ アプリをインストール（ホーム画面に追加）" },
];
