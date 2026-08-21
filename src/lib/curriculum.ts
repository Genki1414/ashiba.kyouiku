import { readFile } from "node:fs/promises";
import path from "node:path";
import { CurriculumSchema, type Curriculum, type Lesson, type Subject } from "@/types/curriculum";

/* 教材の正本は content/curriculum.json。
   サーバ側で一度だけ読み込み・検証してキャッシュする。
   （Storage を更新元にする場合も、このモジュールの中だけ差し替えれば済む） */

let cache: Curriculum | null = null;

export async function getCurriculum(): Promise<Curriculum> {
  if (cache) return cache;
  const file = path.join(process.cwd(), "content", "curriculum.json");
  const raw = JSON.parse(await readFile(file, "utf-8"));
  cache = CurriculumSchema.parse(raw);
  return cache;
}

export async function getLesson(lessonId: string): Promise<{ subject: Subject; lesson: Lesson } | null> {
  const cur = await getCurriculum();
  for (const subject of cur.subjects) {
    const lesson = subject.lessons.find((l) => l.id === lessonId);
    if (lesson) return { subject, lesson };
  }
  return null;
}

/** 単元の並び（前後の単元への移動に使う） */
export async function getLessonOrder(): Promise<string[]> {
  const cur = await getCurriculum();
  return cur.subjects.flatMap((s) => s.lessons.map((l) => l.id));
}
