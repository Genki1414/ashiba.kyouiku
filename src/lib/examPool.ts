import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getCurriculum } from "@/lib/curriculum";

/* 修了試験の出題プール（サーバ専用）。
   全単元の確認問題48問＋総合問題10問。設問文で重複を除く。
   正解はサーバだけが知り、クライアントへは渡さない。 */

export type ExamQuestion = { id: string; q: string; a: string[]; ok: number };

const ExtraSchema = z.object({
  questions: z.array(z.object({ q: z.string(), a: z.array(z.string()), ok: z.number().int() })),
});

export const EXAM_N = 20;
export const EXAM_PASS = 16;

let cache: ExamQuestion[] | null = null;

export async function getExamPool(): Promise<ExamQuestion[]> {
  if (cache) return cache;
  const pool: ExamQuestion[] = [];
  const seen = new Set<string>();
  const push = (id: string, q: { q: string; a: string[]; ok: number }) => {
    if (seen.has(q.q)) return;
    seen.add(q.q);
    pool.push({ id, q: q.q, a: q.a, ok: q.ok });
  };

  const extraRaw = JSON.parse(
    await readFile(path.join(process.cwd(), "content", "exam-extra.json"), "utf-8"),
  );
  ExtraSchema.parse(extraRaw).questions.forEach((q, i) => push(`X-${i}`, q));

  const cur = await getCurriculum();
  for (const s of cur.subjects) {
    for (const l of s.lessons) {
      l.quiz.forEach((q, i) => push(`${l.id}-${i}`, q));
    }
  }
  cache = pool;
  return pool;
}

export async function getQuestionsByIds(ids: string[]): Promise<ExamQuestion[] | null> {
  const pool = await getExamPool();
  const map = new Map(pool.map((q) => [q.id, q]));
  const qs = ids.map((id) => map.get(id));
  return qs.every(Boolean) ? (qs as ExamQuestion[]) : null;
}
