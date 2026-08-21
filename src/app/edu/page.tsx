import { getCurriculum } from "@/lib/curriculum";
import { LessonList } from "./LessonList";

/* 科目・単元の一覧。進捗はクライアント側で読み込んで重ねる */
export default async function EduPage() {
  const cur = await getCurriculum();
  const subjects = cur.subjects.map((s) => ({
    id: s.id,
    name: s.name,
    legal_min: s.legal_min,
    lessons: s.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      legal_min: l.legal_min,
      figures: l.figures.length,
      cases: l.cases.length,
      quiz: l.quiz.length,
    })),
  }));
  return <LessonList meta={{ title: cur.meta.title, basis: cur.meta.basis }} subjects={subjects} />;
}
