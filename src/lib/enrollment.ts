import { getServiceClient, getDevEnrollmentId } from "./supabase/server";
import { currentUser } from "./supabase/session";
import { findCourse } from "@/content/courses";

/* いま記録を書き込む先（受講）を決める。

   受講は「1人 × 1講座」につき1件。
   特別教育は種類が増えていくので、どの講座の記録かを取り違えないよう、
   必ず講座の目印を渡してもらう。

   ログインが無い／Supabase が未設定のときは null を返し、
   呼び出し側は端末内の記録（mode:"local"）へ切り替える。 */

export type Who = {
  enrollmentId: string;
  userId: string;
  /** 表示用。auth のメール */
  email: string | null;
  courseId: string;
};

export async function currentEnrollment(courseId: string): Promise<Who | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  if (!findCourse(courseId)) return null;

  const user = await currentUser();
  if (!user) {
    /* ログインが無いとき。開発用の受講が指定してあればそれを使う
       （手元で画面を確かめるときのため。本番では設定しない） */
    const dev = getDevEnrollmentId();
    return dev ? { enrollmentId: dev, userId: "", email: null, courseId } : null;
  }

  /* 取れなければ作る、を DB 側でひとまとめにしてある。
     ここで「探す→無ければ作る」と書くと、同時に来たとき2件できる */
  const { data, error } = await supabase.rpc("enrollment_for", {
    p_user: user.id,
    p_course: courseId,
  });
  if (error || typeof data !== "string") return null;
  return { enrollmentId: data, userId: user.id, email: user.email ?? null, courseId };
}
