"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findCourse } from "@/content/courses";

/* 断りの画面（NeedSeat）から、ひとりで受ける（/solo）と
   無料の1単元（/edu/<講座>/try）へ（0039）。

   げんきさん（2026-09-17）「会社登録が邪魔してる気がする」。
   ここに立った人のいちばん多い形は「投稿を見て来た1人」。
   会社の話より先に、自分で申し込める道と、まず見られる道を出す。

   どの講座かは住所から取る（RequestCourse・OrderLink と同じ）。 */
export function SoloLink() {
  const path = usePathname() ?? "";
  const id = path.split("/").filter(Boolean)[1] ?? "";
  const course = findCourse(id);
  const solo = course ? `/solo?courseId=${encodeURIComponent(course.id)}` : "/solo";
  return (
    <Link
      href={solo}
      className="mt-2 block rounded-lg border border-yel p-3.5 text-center text-[14px] font-extrabold text-yel no-underline"
      data-testid="need-seat-solo"
    >
      ひとりで受ける
      <span className="block text-[11.5px] font-normal text-dim2">自分で申し込む。会社の登録は要りません</span>
    </Link>
  );
}

/** 第1単元をログインなしで見る。講座が分かるときだけ出す */
export function TryLink() {
  const path = usePathname() ?? "";
  const id = path.split("/").filter(Boolean)[1] ?? "";
  const course = findCourse(id);
  if (!course || !course.ready) return null;
  return (
    <Link
      href={`/edu/${course.id}/try`}
      className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
      data-testid="need-seat-try"
    >
      まず第1単元を見てみる（無料・記録なし）
    </Link>
  );
}
