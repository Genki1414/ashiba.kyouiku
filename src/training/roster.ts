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
  /** 本番の最高技能点。1度も通していなければ null */
  best: number | null;
  passed: boolean;
};

export type LearnerRow = {
  userId: string;
  enrollmentId: string | null;
  name: string;
  email: string | null;
  /** 教育担当者か */
  admin: boolean;
  /** 学科：合格した単元 */
  lessonsPassed: number;
  lessonsTotal: number;
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
};
export type RawEnrollment = { id: string; user_id: string };
export type RawProgress = { enrollment_id: string; quiz_passed_at: string | null };
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

export type RosterInput = {
  users: RawUser[];
  enrollments: RawEnrollment[];
  progress: RawProgress[];
  exams: RawExam[];
  attempts: RawAttempt[];
  certs: RawCert[];
  /** 学科の全単元数 */
  lessonsTotal: number;
};

/** 章ごとに、本番の最高点と回数をまとめる。チュートリアルは数えない */
function trainingOf(rows: RawAttempt[]): ChapterResult[] {
  return CHAPTERS.filter((c) => c.ready).map((c) => {
    const mine = rows.filter((a) => a.chapter === c.id && !a.tutorial);
    const best = mine.length ? Math.max(...mine.map((a) => a.skill)) : null;
    return {
      ch: c.id,
      times: mine.length,
      best,
      /* 合否は点で決める。記録側の passed が古い決まりでも、いまの基準で揃う */
      passed: best !== null && best >= PASS,
    };
  });
}

/** 一覧を組み立てる。名前順（同じなら登録の早い順＝渡された順） */
export function buildRoster(inp: RosterInput): LearnerRow[] {
  const rows = inp.users.map((u): LearnerRow => {
    const en = inp.enrollments.find((e) => e.user_id === u.id) ?? null;
    const id = en?.id ?? null;

    const prog = id ? inp.progress.filter((p) => p.enrollment_id === id) : [];
    const passedRows = prog.filter((p) => !!p.quiz_passed_at);
    const lessonsPassed = passedRows.length;

    const exams = id ? inp.exams.filter((e) => e.enrollment_id === id) : [];
    /* 合格があればそれを出す。無ければいちばん新しい不合格 */
    const pass = exams.filter((e) => e.passed).sort(cmpAt).at(-1);
    const last = exams.slice().sort(cmpAt).at(-1);
    const exam = pass ?? last ?? null;

    const attempts = id ? inp.attempts.filter((a) => a.enrollment_id === id) : [];
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
      lessonsPassed,
      lessonsTotal: inp.lessonsTotal,
      exam: exam
        ? { score: exam.score, total: exam.total, passed: exam.passed }
        : null,
      training: trainingOf(attempts),
      cert: cert ? { no: cert.cert_no, at: cert.issued_at } : null,
      canIssue:
        inp.lessonsTotal > 0 &&
        lessonsPassed >= inp.lessonsTotal &&
        !!exams.find((e) => e.passed),
      lastAt: times.at(-1) ?? null,
    };
  });

  return rows.sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

const cmpAt = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;

/** 一覧の上に出す数字 */
export function rosterTotals(rows: LearnerRow[]) {
  return {
    people: rows.length,
    /* 学科を終えた人（全単元＋修了試験） */
    done: rows.filter((r) => r.canIssue).length,
    /* 修了証を出した人 */
    issued: rows.filter((r) => r.cert).length,
    /* 出せるのにまだ出していない人。担当者がやることはここ */
    waiting: rows.filter((r) => r.canIssue && !r.cert).length,
  };
}
