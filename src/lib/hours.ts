/* 教育時間の割り振りと、公開してよいかの判断。

   職長教育は、科目ごとに「講義」「討議」「演習」を分けて持つ。
   3つの合計が、その科目の**法定最低時間を下回ってはいけない**。
   下回ったまま公開すると、足りない教育で修了証を出すことになる。

   ここは画面にもデータベースにも触らない、ただの計算。
   本部の画面からも、サーバからも同じものを使う。 */

export type Plan = { lecture: number; talk: number; drill: number };

export type SubjectHours = {
  id: number;
  name: string;
  /** 法定の最低時間（分） */
  legalMin: number;
  plan: Plan;
};

/** その科目に積んだ時間（分） */
export const planTotal = (p: Plan): number =>
  Math.max(0, p.lecture) + Math.max(0, p.talk) + Math.max(0, p.drill);

/** 足りない分（分）。足りていれば0 */
export const shortOf = (s: SubjectHours): number =>
  Math.max(0, s.legalMin - planTotal(s.plan));

export type Judge =
  | { ok: true; total: number }
  /* 出せない理由。画面にそのまま出す */
  | { ok: false; total: number; why: string[] };

/** 講座として公開してよいか。
    ・科目ごとに、講義＋討議＋演習 が法定最低時間以上
    ・全部足して、講座の法定時間以上
    どちらか欠けたら公開しない。 */
export function judgeHours(subjects: SubjectHours[], courseLegalMin: number): Judge {
  const total = subjects.reduce((n, s) => n + planTotal(s.plan), 0);
  const why: string[] = [];

  if (!subjects.length) why.push("科目がありません。");

  for (const s of subjects) {
    const short = shortOf(s);
    if (short > 0) {
      why.push(`科目${s.id}「${s.name}」が ${hm(short)} 足りません（法定 ${hm(s.legalMin)}）。`);
    }
  }

  /* 科目ごとに足りていても、講座の合計が足りないことがある
     （法定の合計が、科目の合計より大きいとき） */
  if (total < courseLegalMin) {
    why.push(`合計が ${hm(courseLegalMin - total)} 足りません（法定 ${hm(courseLegalMin)}）。`);
  }

  return why.length ? { ok: false, total, why } : { ok: true, total };
}

/** 「2時間30分」。分だけ・時間だけのときは短く出す */
export function hm(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}分`;
  if (!r) return `${h}時間`;
  return `${h}時間${r}分`;
}

/* ── 討議の完了判定 ──────────────────────────

   討議の画面を開いただけでは修了にしない。
   実際に居た時間で見る。途中で抜けた分は引く。

   「実参加時間」＝ 出入りを足し合わせた時間 − 離席
   これがその科目の討議時間に足りていなければ、その科目は未修了。 */

export type Attend = {
  /** 入室と退出の組。途中で切れていれば複数になる */
  spans: { inAt: string; outAt: string | null }[];
  /** 席を外していた時間（分）。講師が付ける */
  awayMin: number;
};

/** 実際に居た時間（分）。まだ出ていない回は、いまの時刻まで数える */
export function attendedMin(a: Attend, now: Date = new Date()): number {
  let ms = 0;
  for (const s of a.spans) {
    const i = new Date(s.inAt).getTime();
    const o = s.outAt ? new Date(s.outAt).getTime() : now.getTime();
    if (!Number.isFinite(i) || !Number.isFinite(o) || o <= i) continue;
    ms += o - i;
  }
  return Math.max(0, Math.floor(ms / 60000) - Math.max(0, a.awayMin));
}

export type TalkDone =
  | { ok: true; min: number }
  | { ok: false; min: number; need: number; why: "time" | "answer" | "teacher" };

/** その科目の討議を終えたと見てよいか。
    時間・課題への回答・講師の確認、3つとも要る。 */
export function judgeTalk(
  a: Attend,
  need: number,
  opts: { answered: boolean; teacherOk: boolean },
  now: Date = new Date(),
): TalkDone {
  const min = attendedMin(a, now);
  if (min < need) return { ok: false, min, need, why: "time" };
  /* 居ただけで通すと、繋いで放っておけば済んでしまう */
  if (!opts.answered) return { ok: false, min, need, why: "answer" };
  /* 最後は人が見る。討議は、出席の数字だけでは測れない */
  if (!opts.teacherOk) return { ok: false, min, need, why: "teacher" };
  return { ok: true, min };
}

/** 1つの回に入れる人数。多いと討議にならない */
export const TALK_MAX = 15;
