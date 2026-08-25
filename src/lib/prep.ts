"use client";

import { getBrowserClient } from "./supabase/browser";

/* 受講の準備（同意・本人確認）の状態。端末内に保持する。
   顔の特徴量もここ（端末内）に置き、サーバへは「登録した」という事実だけ送る。

   ログインしている人ごとに分けて持つ。
   分けないと、現場のタブレットを次の人に渡したとき、
   前の人の氏名・生年月日・顔の特徴量がそのまま残り、
   別人の名前で受講したことになってしまう。 */

export type PrepState = {
  consentedAt: string | null;
  skipped: boolean; // カメラを使わず内容だけ確認（記録は無効）
  faceRegistered: boolean;
  idDocument: boolean;
  who: { name: string; birth: string; company: string };
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
  who: { name: "", birth: "", company: "" },
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
    return {
      ...emptyPrep,
      ...v,
      who: { ...emptyPrep.who, ...(v.who ?? {}) },
    };
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

/** 受講に入れる状態か（本登録済み or スキップ済み） */
export function prepDone(p: PrepState): boolean {
  return (
    p.skipped ||
    (!!p.consentedAt &&
      p.faceRegistered &&
      /* 顔の特徴量が無いと、受講中に本人かどうか比べられない。
         登録し直してもらう（前の作りで登録した人もここに入る） */
      !!p.faceDescriptor?.length &&
      p.idDocument &&
      !!p.who.name &&
      !!p.who.birth)
  );
}
