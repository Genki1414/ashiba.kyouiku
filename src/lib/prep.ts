"use client";

/* 受講の準備（同意・本人確認）の状態。端末内に保持する。
   顔の特徴量もここ（端末内）に置き、サーバへは「登録した」という事実だけ送る。 */

export type PrepState = {
  consentedAt: string | null;
  skipped: boolean; // カメラを使わず内容だけ確認（記録は無効）
  faceRegistered: boolean;
  idDocument: boolean;
  who: { name: string; birth: string; company: string };
  faceFeature: number[] | null;
};

const KEY = "ashiba.prep";

export const emptyPrep: PrepState = {
  consentedAt: null,
  skipped: false,
  faceRegistered: false,
  idDocument: false,
  who: { name: "", birth: "", company: "" },
  faceFeature: null,
};

export function readPrep(): PrepState {
  try {
    const raw = localStorage.getItem(KEY);
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

export function writePrep(p: PrepState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* プライベートモード等は諦める */
  }
}

/** 受講に入れる状態か（本登録済み or スキップ済み） */
export function prepDone(p: PrepState): boolean {
  return p.skipped || (!!p.consentedAt && p.faceRegistered && p.idDocument && !!p.who.name && !!p.who.birth);
}
