"use client";

/* いまの自分（名前と立場）。ホームの上の帯と、下の札が使う。

   なぜ覚えておくか。
   ホームは作り置きなので、特別教育と実務トレーニングは押した瞬間に出る。
   ところが名前と立場はサーバに聞きに行くので、そこだけ後から出てきて、
   画面が一拍ずれる。現場で何度も開くものなので、これが地味に効く。

   立場（担当者か・本部か・どこの会社か）は、そう変わるものではない。
   前に聞いた答えを端末に覚えておいて、**まず それで描く**。
   そのうしろで聞き直して、違っていれば書き換える。

   端末の持ち主が変わったら、この覚えも消える
   （wipeDevice が ashiba.* をまとめて消すため。src/lib/device.ts）。
   前の人の名前が次の人の画面に出ることはない。

   帯と札で2回聞きに行かないよう、行きかけの1本を分け合う。 */

const KEY = "ashiba.me";

export type Me = {
  userId: string | null;
  name: string;
  email: string;
  admin: boolean;
  owner: boolean;
  needsJoin: boolean;
  canLearn: boolean;
  company: string;
};

const shape = (j: Record<string, unknown>): Me => ({
  userId: (j.userId as string) ?? null,
  name: (j.name as string) ?? "",
  email: (j.email as string) ?? "",
  admin: !!j.admin,
  owner: !!j.owner,
  needsJoin: !!j.needsJoin,
  /* 古い応答（canLearn が無い）は、止めずに通す */
  canLearn: j.canLearn !== false,
  company: (j.company as string) ?? "",
});

/** 前に聞いた答え。無ければ null */
export function readMe(): Me | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

let flying: Promise<Me | null> | null = null;
let flewAt = 0;
/* 1回の画面表示で何本も行かないように、しばらくは同じ答えを配る。
   立場が変わる（担当者にしてもらう等）のは、そう頻繁ではない */
const HOLD_MS = 30_000;

/** 聞き直す。帯と札から同時に呼ばれても、行くのは1本 */
export function loadMe(): Promise<Me | null> {
  if (flying && Date.now() - flewAt < HOLD_MS) return flying;
  flewAt = Date.now();
  flying = fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j?.ok) return null;
      const me = shape(j as Record<string, unknown>);
      try {
        localStorage.setItem(KEY, JSON.stringify(me));
      } catch {
        /* しまえない端末（プライベートモード等）。毎回聞きに行くだけ */
      }
      return me;
    })
    .catch(() => {
      /* 圏外。次に呼ばれたら、また行く */
      flying = null;
      flewAt = 0;
      return null;
    });
  return flying;
}

export const sameMe = (a: Me | null, b: Me | null) =>
  JSON.stringify(a) === JSON.stringify(b);
