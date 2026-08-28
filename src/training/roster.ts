/* 教育担当者の画面に出す一覧の組み立て。

   画面にもデータベースにも触らない、ただの計算。
   ここだけで試験できるようにしてある（tests/roster.ts）。 */

import { CHAPTERS, type ChapterId } from "./chapters";
import { PASS } from "./score";

/** 章ごとの成績 */
export type ChapterResult = {
  ch: ChapterId;
  /** 本番で通した回数 */
  times: number;
  /** チュートリアルで通した回数。
      点には入れないが、数えないと「まだ通していません」と出てしまう。
      練習で通した人と、一度も触っていない人は別のもの */
  tried: number;
  /** 本番の最高技能点。1度も通していなければ null */
  best: number | null;
  passed: boolean;
  /** 通し見学を開いた回数 */
  seen: number;
  /** 通し見学を最後まで見たか */
  seenDone: boolean;
};

export type LearnerRow = {
  userId: string;
  enrollmentId: string | null;
  name: string;
  email: string | null;
  /** 教育担当者か */
  admin: boolean;
  /** その会社を抜けているか（退職・転職）。記録は残す */
  left: boolean;
  /** まだ許可していない申し込み。在籍でも退職でもない。
      これを退職と一緒くたにすると、入ったことのない人が
      「退職」と出て、申し込みの欄と名簿の欄に二重に並ぶ */
  pending: boolean;
  /** 学科：合格した単元 */
  lessonsPassed: number;
  lessonsTotal: number;
  /** 学科：見た時間の合計（秒）と、法定の合計（秒） */
  watchedSec: number;
  requiredSec: number;
  /** いま受けている単元。全部終わっていれば null。
      「あと何が残っているか」を担当者が一目で分かるようにする */
  now: { id: string; title: string; watchedSec: number; needSec: number } | null;
  /** 修了試験。受けていなければ null */
  exam: { score: number; total: number; passed: boolean } | null;
  /** 実務トレーニング。遊べる章だけ並べる */
  training: ChapterResult[];
  /** 修了証。出ていなければ null */
  cert: { no: string; at: string } | null;
  /** いま修了証を出せるか（学科が全単元＋修了試験に合格） */
  canIssue: boolean;
  /** 学科を終えた日時（いちばん新しい合格）。まだなら null */
  lastAt: string | null;
};

/* ── 素の行（データベースから読んだそのまま）── */
export type RawUser = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  /** その会社に在籍しているか。抜けた人も、受けた記録があれば名簿に残る */
  active?: boolean;
  /** まだ許可していない申し込みの人か */
  pending?: boolean;
};
export type RawEnrollment = { id: string; user_id: string };
export type RawProgress = {
  enrollment_id: string;
  lesson_id: string;
  /* 見た時間。法定時間に届いているかは、これで分かる */
  watched_sec: number;
  quiz_passed_at: string | null;
};

/** 学科の単元（順番どおり） */
export type RosterLesson = { id: string; title: string; legal_min: number };
export type RawExam = {
  enrollment_id: string;
  score: number;
  total: number;
  passed: boolean;
  created_at: string;
};
export type RawAttempt = {
  enrollment_id: string;
  chapter: string;
  tutorial: boolean;
  skill: number;
  passed: boolean;
  created_at: string;
};
export type RawCert = { enrollment_id: string; cert_no: string; issued_at: string };
/** 通し見学を見たこと。点は付かないので、成績とは別に持つ */
export type RawView = {
  enrollment_id: string;
  chapter: string;
  times: number;
  done: boolean;
};

export type RosterInput = {
  users: RawUser[];
  enrollments: RawEnrollment[];
  progress: RawProgress[];
  exams: RawExam[];
  attempts: RawAttempt[];
  /** 通し見学。渡さなければ「見ていない」で通す（古い呼び出しを壊さない） */
  views?: RawView[];
  certs: RawCert[];
  /** 学科の単元。順番どおりに渡すこと（「いま何番目か」を出すため） */
  lessons: RosterLesson[];
};

/** 章ごとに、本番の最高点と回数、練習と通し見学をまとめる */
function trainingOf(rows: RawAttempt[], views: RawView[]): ChapterResult[] {
  return CHAPTERS.filter((c) => c.ready).map((c) => {
    const here = rows.filter((a) => a.chapter === c.id);
    const v = views.find((x) => x.chapter === c.id);
    /* 点は本番だけで見る。チュートリアルは親方に聞けて目印も濃いので、
       同じ土俵で比べられない */
    const mine = here.filter((a) => !a.tutorial);
    const best = mine.length ? Math.max(...mine.map((a) => a.skill)) : null;
    return {
      ch: c.id,
      times: mine.length,
      tried: here.length - mine.length,
      best,
      /* 合否は点で決める。記録側の passed が古い決まりでも、いまの基準で揃う */
      passed: best !== null && best >= PASS,
      seen: v?.times ?? 0,
      seenDone: v?.done === true,
    };
  });
}

/** 一覧を組み立てる。
    修了証を出せるのにまだ出していない人が上（担当者がやることはそこなので）、
    次に在籍している人、そのあとは名前順。
    抜けた人（退職・転職）は下に置く。名簿から消さないのは、
    その会社が「誰に受けさせたか」を後から示せるようにするため。
    受けた記録そのものは、教育を行っているこの仕組みの側に残る。 */
export function buildRoster(inp: RosterInput): LearnerRow[] {
  const lessonsTotal = inp.lessons.length;
  const requiredSec = inp.lessons.reduce((n, l) => n + l.legal_min * 60, 0);

  const rows = inp.users.map((u): LearnerRow => {
    const en = inp.enrollments.find((e) => e.user_id === u.id) ?? null;
    const id = en?.id ?? null;

    const prog = id ? inp.progress.filter((p) => p.enrollment_id === id) : [];
    const passedRows = prog.filter((p) => !!p.quiz_passed_at);
    const lessonsPassed = passedRows.length;
    const watchedSec = prog.reduce((n, p) => n + (p.watched_sec ?? 0), 0);

    /* いま受けている単元＝まだ合格していない、いちばん前の単元。
       見た時間が0なら「次はここ」、入っていれば「ここの途中」 */
    const byLesson = new Map(prog.map((p) => [p.lesson_id, p]));
    const nextLesson = inp.lessons.find((l) => !byLesson.get(l.id)?.quiz_passed_at) ?? null;
    const now = nextLesson
      ? {
          id: nextLesson.id,
          title: nextLesson.title,
          watchedSec: byLesson.get(nextLesson.id)?.watched_sec ?? 0,
          needSec: nextLesson.legal_min * 60,
        }
      : null;

    const exams = id ? inp.exams.filter((e) => e.enrollment_id === id) : [];
    /* 合格があればそれを出す。無ければいちばん新しい不合格 */
    const pass = exams.filter((e) => e.passed).sort(cmpAt).at(-1);
    const last = exams.slice().sort(cmpAt).at(-1);
    const exam = pass ?? last ?? null;

    const attempts = id ? inp.attempts.filter((a) => a.enrollment_id === id) : [];
    const views = id ? (inp.views ?? []).filter((v) => v.enrollment_id === id) : [];
    const cert = id ? (inp.certs.find((c) => c.enrollment_id === id) ?? null) : null;

    const times = [
      ...passedRows.map((p) => p.quiz_passed_at as string),
      ...exams.map((e) => e.created_at),
      ...attempts.map((a) => a.created_at),
    ].sort();

    return {
      userId: u.id,
      enrollmentId: id,
      name: u.name,
      email: u.email,
      admin: u.role === "admin",
      left: u.active === false && u.pending !== true,
      pending: u.pending === true,
      lessonsPassed,
      lessonsTotal,
      watchedSec,
      requiredSec,
      now,
      exam: exam
        ? { score: exam.score, total: exam.total, passed: exam.passed }
        : null,
      training: trainingOf(attempts, views),
      cert: cert ? { no: cert.cert_no, at: cert.issued_at } : null,
      canIssue:
        lessonsTotal > 0 &&
        lessonsPassed >= lessonsTotal &&
        !!exams.find((e) => e.passed),
      lastAt: times.at(-1) ?? null,
    };
  });

  const waiting = (r: LearnerRow) => (r.canIssue && !r.cert ? 0 : 1);
  return rows.sort(
    (a, b) =>
      Number(a.left) - Number(b.left) ||
      waiting(a) - waiting(b) ||
      a.name.localeCompare(b.name, "ja"),
  );
}

const cmpAt = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;

/** 一覧の上に出す数字 */
export function rosterTotals(rows: LearnerRow[]) {
  return {
    /* 数えるのは在籍している人。抜けた人は記録として残るだけ。
       まだ許可していない申し込みの人も、在籍には数えない */
    people: rows.filter((r) => !r.left && !r.pending).length,
    left: rows.filter((r) => r.left).length,
    pending: rows.filter((r) => r.pending).length,
    /* 学科を終えた人（全単元＋修了試験） */
    done: rows.filter((r) => r.canIssue).length,
    /* 修了証を出した人 */
    issued: rows.filter((r) => r.cert).length,
    /* 出せるのにまだ出していない人。担当者がやることはここ */
    waiting: rows.filter((r) => r.canIssue && !r.cert).length,
  };
}

/* ── 人ごとにまとめる ────────────────────────
   buildRoster は講座ごとの一覧を作る。
   担当者の画面は人で並ぶので、講座ぶんを1人にまとめ直す。

   1人が複数の特別教育を受けるようになるため、
   名前の下は「実務トレーニング」「受講中」「取得済み資格」の3つに畳む。
   全部いっぺんに広げると、10人並んだだけで読めなくなる。 */

/** その人の、講座ひとつぶんの状態 */
export type CourseRow = {
  courseId: string;
  short: string;
  name: string;
  enrollmentId: string | null;
  lessonsPassed: number;
  lessonsTotal: number;
  watchedSec: number;
  requiredSec: number;
  now: LearnerRow["now"];
  exam: LearnerRow["exam"];
  cert: LearnerRow["cert"];
  canIssue: boolean;
  lastAt: string | null;
};

export type PersonRow = {
  userId: string;
  name: string;
  email: string | null;
  admin: boolean;
  left: boolean;
  pending: boolean;
  /** 実務トレーニング。章ごとの最高点。講座をまたいで一番良いものを見る */
  training: ChapterResult[];
  /** 受講中（受け始めていて、まだ修了証が出ていない） */
  doing: CourseRow[];
  /** 取得済み（修了証が出ている） */
  done: CourseRow[];
  /** よそで取った資格（この仕組みの外）。自己申告。
      入れ物だけ用意して、中身は返す側で足す（src/lib/quals.ts） */
  held: HeldQual[];
  /** 出せるのに、まだ出していない資格がある */
  canIssue: boolean;
};

/** よそで取った資格。中身の作りは src/lib/quals.ts に置いてある */
export type HeldQual = {
  id: string;
  name: string;
  kind: string;
  issuer: string;
  gotOn: string | null;
  certNo: string;
  confirmedAt: string | null;
};

type Part = { course: { id: string; short: string; name: string }; rows: LearnerRow[] };

/** 章ごとの成績を、講座をまたいでまとめる */
function mergeTraining(list: ChapterResult[][]): ChapterResult[] {
  return CHAPTERS.filter((c) => c.ready).map((c) => {
    const mine = list.map((rs) => rs.find((r) => r.ch === c.id)).filter(Boolean) as ChapterResult[];
    const bests = mine.map((m) => m.best).filter((b): b is number => b !== null);
    const best = bests.length ? Math.max(...bests) : null;
    return {
      ch: c.id,
      times: mine.reduce((n, m) => n + m.times, 0),
      tried: mine.reduce((n, m) => n + m.tried, 0),
      best,
      passed: best !== null && best >= PASS,
      seen: mine.reduce((n, m) => n + m.seen, 0),
      seenDone: mine.some((m) => m.seenDone),
    };
  });
}

const toCourse = (p: Part, r: LearnerRow): CourseRow => ({
  courseId: p.course.id,
  short: p.course.short,
  name: p.course.name,
  enrollmentId: r.enrollmentId,
  lessonsPassed: r.lessonsPassed,
  lessonsTotal: r.lessonsTotal,
  watchedSec: r.watchedSec,
  requiredSec: r.requiredSec,
  now: r.now,
  exam: r.exam,
  cert: r.cert,
  canIssue: r.canIssue,
  lastAt: r.lastAt,
});

/** 講座ごとの一覧を、人ごとにまとめ直す。
    上に来るのは、担当者がやること（修了証を出す）が残っている人 */
export function mergePeople(parts: Part[]): PersonRow[] {
  const byUser = new Map<string, { base: LearnerRow; parts: [Part, LearnerRow][] }>();
  for (const p of parts) {
    for (const r of p.rows) {
      const cur = byUser.get(r.userId);
      if (!cur) byUser.set(r.userId, { base: r, parts: [[p, r]] });
      else cur.parts.push([p, r]);
    }
  }

  const people = [...byUser.values()].map(({ base, parts: mine }): PersonRow => {
    /* 受けている講座だけ並べる。席も進みも無いものは、まだ受けていない */
    const taken = mine
      .map(([p, r]) => toCourse(p, r))
      .filter((c) => c.enrollmentId !== null || c.cert !== null);

    return {
      userId: base.userId,
      name: base.name,
      email: base.email,
      admin: base.admin,
      left: base.left,
      pending: base.pending,
      training: mergeTraining(mine.map(([, r]) => r.training)),
      doing: taken.filter((c) => !c.cert),
      done: taken.filter((c) => c.cert),
      held: [],
      canIssue: taken.some((c) => c.canIssue && !c.cert),
    };
  });

  return people.sort(
    (a, b) =>
      Number(a.left) - Number(b.left) ||
      Number(b.canIssue) - Number(a.canIssue) ||
      a.name.localeCompare(b.name, "ja"),
  );
}

/** 人ごとの一覧の上に出す数字 */
export function peopleTotals(rows: PersonRow[]) {
  return {
    people: rows.filter((r) => !r.left && !r.pending).length,
    left: rows.filter((r) => r.left).length,
    pending: rows.filter((r) => r.pending).length,
    /* 受講中の資格がある人 */
    doing: rows.filter((r) => r.doing.length).length,
    /* 資格を持っている人。よそで取ったものも数える。
       「誰を現場に出せるか」を見るのに、出どころは関係ない */
    issued: rows.filter((r) => r.done.length || r.held.length).length,
    /* 修了証を出せるのに、まだ出していない人。担当者がやることはここ */
    waiting: rows.filter((r) => r.canIssue).length,
  };
}
