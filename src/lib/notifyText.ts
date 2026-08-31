/* 申込が来たときに、運営へ出す知らせの中身。

   ── なぜ中身を書かないか ──
   誰が申し込んだかは**書かない**。種類と件数と、開く場所だけ。

   ・LINE はよその会社の仕組み。氏名を流せば第三者提供になり、
     個人情報の取扱い（/legal/privacy）に LINE を書き足す話になる。
     書かなければ、その話が起きない
   ・通知はスマホのロック画面に出る。**人の名前がそこに出る。**
     現場で画面を見られることもある
   ・知らせの役目は「忘れないこと」。誰かはアプリを開けば1タップで分かる

   だから「参加申込が1件」と、その画面への行き先だけを送る。 */

export type NotifyKind = "member" | "order" | "cert" | "train" | "company";

type Def = { t: string; path: string; why: string };

/* 種類ごとの言い方と、開く場所。
   path は運営が実際に**手を動かす画面**にする。ホームに送ると、
   そこから探し直すことになる */
const DEFS: Record<NotifyKind, Def> = {
  member: {
    t: "参加申込",
    path: "/admin",
    why: "許可を出すまで、その人の教材は開きません",
  },
  order: {
    t: "受講コードの申込",
    path: "/owner",
    why: "請求書を送ってください",
  },
  cert: {
    t: "修了証の発行申請",
    path: "/owner",
    why: "討議の候補日を出してください",
  },
  train: {
    t: "実務トレーニングの申込",
    path: "/owner",
    why: "請求書を送ってください",
  },
  company: {
    t: "事業者の登録",
    path: "/owner",
    why: "新しい会社が使い始めました",
  },
};

/** その種類の言い方（画面や試験から使う） */
export const kindText = (k: NotifyKind): string => DEFS[k].t;

/** 知らせの本文。氏名や会社名は入れない */
export function notifyText(k: NotifyKind, site: string, n = 1): string {
  const d = DEFS[k];
  const base = site.replace(/\/+$/, "");
  const count = n > 1 ? `${n}件` : "1件";
  return [
    `【足場屋革命】${d.t}が${count}`,
    d.why,
    "",
    `${base}${d.path}`,
  ].join("\n");
}

/** 送れる形か。LINE は1通5000字まで。
    こちらの文は短いが、site が壊れていたときに気づけるように見る */
export function checkNotify(text: string): { ok: true } | { ok: false; reason: string } {
  const t = text.trim();
  if (!t) return { ok: false, reason: "本文が空です" };
  if (t.length > 4900) return { ok: false, reason: "本文が長すぎます" };
  if (!/https:\/\//.test(t)) return { ok: false, reason: "開く場所が入っていません" };
  return { ok: true };
}
