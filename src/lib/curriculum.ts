import { readFile } from "node:fs/promises";
import path from "node:path";
import { CurriculumSchema, type Curriculum, type Lesson, type Subject } from "@/types/curriculum";
import { COURSES, findCourse, type CourseMeta } from "@/content/courses";

/* 教材の正本は content/courses/<講座>.json。
   サーバ側で一度だけ読み込み・検証してキャッシュする。

   講座は増えていく。どれを読むかは講座の目印（courseId）で決める。
   一覧は src/content/courses.ts。 */

const cache = new Map<string, Curriculum>();

export async function getCurriculum(courseId: string): Promise<Curriculum | null> {
  const hit = cache.get(courseId);
  if (hit) return hit;
  const course = findCourse(courseId);
  if (!course) return null;
  const file = path.join(process.cwd(), "content", "courses", course.file);
  const raw = JSON.parse(await readFile(file, "utf-8"));
  const cur = CurriculumSchema.parse(raw);
  cache.set(courseId, cur);
  return cur;
}

export async function getLesson(
  courseId: string,
  lessonId: string,
): Promise<{ subject: Subject; lesson: Lesson } | null> {
  const cur = await getCurriculum(courseId);
  if (!cur) return null;
  for (const subject of cur.subjects) {
    const lesson = subject.lessons.find((l) => l.id === lessonId);
    if (lesson) return { subject, lesson };
  }
  return null;
}

/** 単元の並び（前後の単元への移動に使う） */
export async function getLessonOrder(courseId: string): Promise<string[]> {
  const cur = await getCurriculum(courseId);
  if (!cur) return [];
  return cur.subjects.flatMap((s) => s.lessons.map((l) => l.id));
}

/** 講座の単元を、順番どおりに平らに並べる（教育担当者の画面などで使う） */
export async function getLessonList(
  courseId: string,
): Promise<{ id: string; title: string; legal_min: number }[]> {
  const cur = await getCurriculum(courseId);
  if (!cur) return [];
  return cur.subjects.flatMap((s) =>
    s.lessons.map((l) => ({ id: l.id, title: l.title, legal_min: l.legal_min })),
  );
}

/** 教材の json がある講座だけ。壊れていれば外す（画面に出さない） */
export async function loadedCourses(): Promise<CourseMeta[]> {
  const out: CourseMeta[] = [];
  for (const c of COURSES) {
    if (!c.ready) continue;
    try {
      if (await getCurriculum(c.id)) out.push(c);
    } catch {
      /* 教材が読めない講座は出さない */
    }
  }
  return out;
}
