import { getServiceClient, getDevEnrollmentId } from "./supabase/server";
import { currentUser } from "./supabase/session";

/* いま記録を書き込む先（受講）を決める。
   ログインしている人の受講を返す。無ければ1件だけ作る。

   ログインが無い／Supabase が未設定のときは null を返し、
   呼び出し側は端末内の記録（mode:"local"）へ切り替える。 */

export type Who = {
  enrollmentId: string;
  userId: string;
  /** 表示用。auth のメール */
  email: string | null;
};

export async function currentEnrollment(): Promise<Who | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const user = await currentUser();
  if (!user) {
    /* ログインが無いとき。開発用の受講が指定してあればそれを使う
       （手元で画面を確かめるときのため。本番では設定しない） */
    const dev = getDevEnrollmentId();
    return dev ? { enrollmentId: dev, userId: "", email: null } : null;
  }

  const { data: found } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (found?.id) {
    return { enrollmentId: found.id as string, userId: user.id, email: user.email ?? null };
  }

  /* まだ受講が無い。1件だけ作る。
     （席を売る形になったら、ここで seat の引き換えを見るようにする） */
  const { data: made, error } = await supabase
    .from("enrollments")
    .insert({ user_id: user.id, started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !made) {
    /* 同時に2回来て、どちらかが弾かれた場合は取り直す */
    const { data: again } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!again?.id) return null;
    return { enrollmentId: again.id as string, userId: user.id, email: user.email ?? null };
  }
  return { enrollmentId: made.id as string, userId: user.id, email: user.email ?? null };
}
