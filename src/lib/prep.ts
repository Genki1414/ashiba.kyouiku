"use client";

import { getBrowserClient } from "./supabase/browser";

/* 受講の準備（同意・本人確認）の状態。端末内に保持する。
   顔の特徴量もここ（端末内）に置き、サーバへは「登録した」という事実だけ送る。

   ログインしている人ごとに分けて持つ。
   分けないと、現場のタブレットを次の人に渡したとき、
   前の人の顔の特徴量がそのまま残り、
   別人として受講したことになってしまう。

   ── 氏名と生年月日は、ここに持たない ──
   前はここに who として持ち、受講の準備の画面で入力させていた。
   マイページにも同じものがあり、**同じ事実が2か所にあった。**

     ・端末を替えると、また入れ直しになる（localStorage なので）
     ・マイページの値と食い違ったとき、どちらが修了証に載るのか分からない
     ・実際には、講座の画面から入れた値がマイページを上書きしていた

   いまは users 表の1か所だけ。入り口はマイページ。
   受講の準備の画面は、それを**見るだけ**（/api/me が返す name と birth）。 */

export type PrepState = {
  consentedAt: string | null;
  skipped: boolean; // カメラを使わず内容だけ確認（記録は無効）
  faceRegistered: boolean;
  idDocument: boolean;
  /* 登録した顔の特徴量（128の数）。受講中の照合はこれと比べる。
     端末の中だけに置き、サーバへは送らない */
  faceDescriptor: number[] | null;
};

const KEY = (uid: string) => `ashiba.prep:${uid}`;
/* 人ごとに分ける前の記録。誰のものか分からないので使わない */
const OLD_KEY = "ashiba.prep";

export const emptyPrep: PrepState = {
  consentedAt: null,
  skipped: false,
  faceRegistered: false,
  idDocument: false,
  faceDescriptor: null,
};

let uidCache: string | null = null;

/** いま使っている人の目印。ログインしていなければ "local"（手元で動かすとき） */
export async function prepUid(): Promise<string> {
  if (uidCache) return uidCache;
  try {
    const supabase = getBrowserClient();
    const got = await supabase?.auth.getUser();
    uidCache = got?.data.user?.id ?? "local";
  } catch {
    uidCache = "local";
  }
  return uidCache;
}

export function readPrep(uid: string): PrepState {
  try {
    /* 誰のものか分からない古い記録は、ここで捨てる */
    localStorage.removeItem(OLD_KEY);
    const raw = localStorage.getItem(KEY(uid));
    if (!raw) return { ...emptyPrep };
    const v = JSON.parse(raw) as Partial<PrepState>;
    /* 古い記録に who が残っていても、そのまま捨てる。
       氏名と生年月日は users 表の1か所だけを見る */
    return { ...emptyPrep, ...v };
  } catch {
    return { ...emptyPrep };
  }
}

export function writePrep(p: PrepState, uid: string) {
  try {
    localStorage.setItem(KEY(uid), JSON.stringify(p));
  } catch {
    /* プライベートモード等は諦める */
  }
}

/** その人の準備を消す。端末を次の人に渡すとき（ログアウト）に使う */
export function clearPrep(uid: string) {
  try {
    localStorage.removeItem(KEY(uid));
    localStorage.removeItem(OLD_KEY);
  } catch {
    /* 消せなければ諦める */
  }
  uidCache = null;
}

/** いまの人の準備を読む */
export async function loadPrep(): Promise<PrepState> {
  return readPrep(await prepUid());
}

/** 端末の側の準備が済んでいるか（同意・顔・書類）。

    **氏名と生年月日はここで見ない。** あれは端末ではなく人に付くもので、
    users 表に入っている（マイページで入れる）。
    受講に入れるかどうかは、これと合わせて whoReady() も見ること。 */
export function prepDone(p: PrepState): boolean {
  return (
    p.skipped ||
    (!!p.consentedAt &&
      p.faceRegistered &&
      /* 顔の特徴量が無いと、受講中に本人かどうか比べられない。
         登録し直してもらう（前の作りで登録した人もここに入る） */
      !!p.faceDescriptor?.length &&
      p.idDocument)
  );
}

/** 修了証に載る氏名と生年月日が、登録してあるか。
    入り口はマイページだけ（/api/me が返す name と birth） */
export const whoReady = (me: { name?: string; birth?: string } | null): boolean =>
  !!me?.name?.trim() && !!me?.birth?.trim();

/** 受講に入れるか。端末の準備と、人の登録の両方がそろっていること */
export const canStart = (
  p: PrepState,
  me: { name?: string; birth?: string } | null,
): boolean => prepDone(p) && (p.skipped || whoReady(me));
