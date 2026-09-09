import { getServiceClient, getDevEnrollmentId } from "./supabase/server";
import { currentUser } from "./supabase/session";
import { canLearn } from "./entitle";
import { findCourse } from "@/content/courses";

/* いま記録を書き込む先（受講）を決める。

   受講は「1人 × 1講座」につき1件。
   特別教育は種類が増えていくので、どの講座の記録かを取り違えないよう、
   必ず講座の目印を渡してもらう。

   ログインが無い／Supabase が未設定のときは null を返し、
   呼び出し側は端末内の記録（mode:"local"）へ切り替える。

   ── その講座の受講コードを持っているか、ここで見る（2026-09-09）──
   げんきさん「全ての穴を無くして」。

   ここを通る所は、記録を書く所ばかり（視聴時間・確認問題・修了試験・
   本人確認・修了証・発行申請）。**画面を塞いでも、ここが開いていれば
   道具で直接叩ける。**持っていない講座の記録を作られると、
   あとで受講コードを買ったときに「もう受け終わっている」状態になる。

   **1か所で見る。**呼ぶ側それぞれに書かせると、必ずどれかで忘れる
   （実際、学科の画面だけ見ていて、この裏口が全部開いていた）。

   実務トレーニングだけは例外（requireSeat: false）。
   第1章は誰でも触れる売り方にしてあり、見張りは別にある
   （src/lib/trainingGate.ts）。 */

export type Who = {
  enrollmentId: string;
  userId: string;
  /** 表示用。auth のメール */
  email: string | null;
  courseId: string;
};

export async function currentEnrollment(
  courseId: string,
  opts: { requireSeat?: boolean } = {},
): Promise<Who | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  if (!findCourse(courseId)) return null;

  /* **その講座の受講コードを持っているか。**
     持っていなければ、記録の宛先を作らない（＝どの入口も書けない） */
  if (opts.requireSeat !== false) {
    const may = await canLearn(courseId);
    if (!may.ok) return null;
  }

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
