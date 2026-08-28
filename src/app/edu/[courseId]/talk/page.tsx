import { notFound } from "next/navigation";
import { findCourse, needsLive } from "@/content/courses";
import { TalkClient } from "./TalkClient";

/* 討議の回。

   職長教育は討議方式が原則で、録画を見せるのは討議にならない。
   同じ時間に集まって、やり取りできる状態でやる（Zoom）。
   討議のある講座（needsLive）にしか置かない。 */
export default async function TalkPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = findCourse(courseId);
  if (!course || !needsLive(course)) notFound();
  return <TalkClient courseId={course.id} courseName={course.name} />;
}
