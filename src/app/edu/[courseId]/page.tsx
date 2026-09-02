import { notFound } from "next/navigation";
import { getCurriculum } from "@/lib/curriculum";
import { drillMinOf, findCourse, needsLive } from "@/content/courses";
import { LessonList } from "./LessonList";

/* 科目・単元の一覧。進捗はクライアント側で読み込んで重ねる。
   どの講座かは URL の1つ目（/edu/ashiba）で決まる */
export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = findCourse(courseId);
  const cur = course ? await getCurriculum(courseId) : null;
  if (!course || !cur) notFound();
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
  return (
    <LessonList
      course={{ id: course.id, name: course.name, basis: course.basis }}
      subjects={subjects}
      live={needsLive(course)}
      drillMin={drillMinOf(course)}
    />
  );
}
