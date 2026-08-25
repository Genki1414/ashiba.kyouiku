"use client";

/* 端末に残る記録の持ち主。

   現場ではタブレットを人から人へ渡す。
   端末の中に置いている記録（受講の準備・視聴時間・実務の成績・
   間違いノート・途中経過）は、渡した時点で前の人のものだから、
   使う人が変わったら消す。

   消さないと、前の人の氏名で受講したことになったり、
   前の人の視聴時間を引き継いで規定時間を満たしたことになってしまう。

   サーバ（Supabase）にある記録は本人に紐づいているので消さない。
   音の入切と「更新のお知らせを見たか」は端末の設定なので残す。 */

const OWNER = "ashiba.owner";
const KEEP = new Set([OWNER, "ashiba.sound", "ashiba.seen-update"]);

/** 端末に残っている受講の記録を消す */
export function wipeDevice() {
  try {
    const gone: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ashiba.") && !KEEP.has(k)) gone.push(k);
    }
    for (const k of gone) localStorage.removeItem(k);
  } catch {
    /* 消せない端末（プライベートモード等）は、そもそも残っていない */
  }
}

/** いま使う人を端末に覚えさせる。
    前と違う人なら、前の人の記録を消して true を返す */
export function claimDevice(uid: string | null): boolean {
  try {
    const was = localStorage.getItem(OWNER) ?? "";
    const now = uid ?? "";
    if (was === now) return false;
    wipeDevice();
    if (now) localStorage.setItem(OWNER, now);
    else localStorage.removeItem(OWNER);
    return true;
  } catch {
    return false;
  }
}
