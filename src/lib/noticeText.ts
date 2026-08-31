/* ホームに出すお知らせの言い方と、開く場所。

   ── 誰に宛てたものか ──
   これは**本部・担当者からの返事**を、待っていた本人に返すもの。
   運営に出す LINE の知らせ（src/lib/notifyText.ts）とは向きが逆で、
   宛てた本人しか読まない（0024 のRLSで本人だけに絞ってある）。

   だから、こちらは中身を書いてよい。断った理由もそのまま返す。
   **ロック画面に出るのは Push の側**で、そちらには本文を載せない。

   ── なぜ行き先をここで決めるか ──
   データベースには kind と講座しか入れない。
   住所をしまうと、画面の場所を1つ変えただけで、
   過ぎた知らせが全部どこにも行かない行になる。
   ここで組み立てれば、直すのは1か所で済む。 */

export type NoticeKind =
  /* 会社の担当者から、受講する人へ */
  | "member_ok"   // 参加申込を許可した
  | "member_ng"   // 参加申込を断った
  | "cert"        // 修了証を出した
  /* 本部から、会社の担当者へ */
  | "seat"        // 入金を確認して、受講コードを出した
  /* 本部から、受講する人へ */
  | "train"       // 実務トレーニングを開けるようにした
  | "slot"        // 修了証の発行申請に、討議の候補日を出した
  | "room"        // 討議の部屋（URL）が決まった
  | "pass"        // 討議・実技を通した（修了証が出せる）
  | "issue_ng";   // 発行申請を断った

type Def = {
  /** 見出し。一覧で並ぶ字 */
  t: string;
  /** 次に何をすればいいか */
  d: string;
  /** 開く場所。講座に紐づくものは courseId を受け取る */
  href: (courseId: string) => string;
  /** 講座が要るか。要るのに無ければ、講座に依らない場所へ落とす */
  needsCourse?: true;
};

const DEFS: Record<NoticeKind, Def> = {
  member_ok: {
    t: "会社とつながりました",
    d: "名簿に入りました。受講できます",
    href: () => "/",
  },
  member_ng: {
    t: "参加申込が断られました",
    d: "会社の教育担当者に確かめてください",
    href: () => "/me",
  },
  cert: {
    t: "修了証が出ました",
    d: "マイページから受け取れます",
    href: (c) => (c ? `/edu/${c}/cert` : "/me"),
  },
  seat: {
    t: "受講コードが出ました",
    d: "受講する人に配ってください",
    href: () => "/admin",
  },
  train: {
    t: "実務トレーニングが開きました",
    d: "第2章から先に進めます",
    href: () => "/training",
  },
  slot: {
    t: "討議の候補日が出ました",
    d: "都合の良い日を選んでください",
    href: (c) => (c ? `/edu/${c}/cert` : "/me"),
    needsCourse: true,
  },
  room: {
    t: "討議の入り口が決まりました",
    d: "当日、この画面から入れます",
    href: (c) => (c ? `/edu/${c}/talk` : "/me"),
    needsCourse: true,
  },
  pass: {
    t: "討議・実技を確認しました",
    d: "修了証が出せます",
    href: (c) => (c ? `/edu/${c}/cert` : "/me"),
    needsCourse: true,
  },
  issue_ng: {
    t: "修了証の発行申請が断られました",
    d: "理由を読んで、出し直してください",
    href: (c) => (c ? `/edu/${c}/cert` : "/me"),
    needsCourse: true,
  },
};

/** 知らせの1件を、画面に出す形にする */
export function noticeView(n: { kind: string; courseId?: string | null; note?: string | null }): {
  t: string;
  d: string;
  href: string;
} {
  const d = DEFS[n.kind as NoticeKind];
  /* 知らない字が来ても落とさない。古い版が残した行かもしれない。
     消してしまうと、何があったのかを追えなくなる */
  if (!d) return { t: "お知らせ", d: "", href: "/" };
  return { t: d.t, d: d.d, href: d.href((n.courseId ?? "").trim()) };
}

/** その字が知らせの種類か */
export const isNoticeKind = (k: string): k is NoticeKind =>
  Object.prototype.hasOwnProperty.call(DEFS, k);

/** 講座が要る種類か。呼ぶ側の入れ忘れを、試験で見つけるために出す */
export const needsCourse = (k: NoticeKind): boolean => DEFS[k].needsCourse === true;

/** 本部が書いた一言。そのまま画面に出るので、長さだけ切る。
    空なら出さない（空の枠が並ぶより、無いほうが読みやすい） */
export const noteOf = (s: string | null | undefined): string =>
  (s ?? "").trim().slice(0, 1000);

/** 全部の種類。試験と、抜けの点検から使う */
export const NOTICE_KINDS = Object.keys(DEFS) as NoticeKind[];
