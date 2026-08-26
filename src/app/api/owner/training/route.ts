import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";

/* 実務トレーニングの利用権（本部だけ）。

   第1章は誰でも遊べる。第2章から先は、ここで付けた人だけ。

   カード払いが通るまでは、この道で売る。
   振込を確認したら、メールで探して付ける。
   最初の数人ならこれで回るし、後からカード払いを足しても
   同じ表に入るので、作り直しにならない。

   GET  … いま持っている人と、メールでの検索
   POST … 付ける／取り消す */

type Body = { action?: "grant" | "revoke"; userId?: string; note?: string };

/** いま持っている人 */
async function held(supabase: NonNullable<ReturnType<typeof getServiceClient>>) {
  const { data } = await supabase
    .from("training_access")
    .select("user_id, granted_at, source, note");
  const rows = data ?? [];
  if (!rows.length) return [];

  const { data: us } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", rows.map((r) => r.user_id as string));
  const who = new Map((us ?? []).map((u) => [u.id as string, u]));

  return rows
    .map((r) => ({
      userId: r.user_id as string,
      name: (who.get(r.user_id as string)?.name as string) ?? "",
      email: (who.get(r.user_id as string)?.email as string) ?? "",
      at: r.granted_at as string,
      source: (r.source as string) ?? "owner",
      note: (r.note as string) ?? "",
    }))
    .sort((a, b) => `${b.at}`.localeCompare(`${a.at}`));
}

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "本部だけの操作です。" }, { status: 403 });
  }

  /* メールで探す。名前で探すと同姓同名で取り違える */
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  let found: { userId: string; name: string; email: string; has: boolean }[] = [];
  if (q.length >= 3) {
    const safe = q.replace(/[%_\\]/g, (m) => `\\${m}`);
    const { data } = await supabase
      .from("users")
      .select("id, name, email")
      .ilike("email", `%${safe}%`)
      .limit(20);
    const ids = (data ?? []).map((u) => u.id as string);
    const { data: has } = ids.length
      ? await supabase.from("training_access").select("user_id").in("user_id", ids)
      : { data: [] as { user_id: string }[] };
    const got = new Set((has ?? []).map((r) => r.user_id as string));
    found = (data ?? []).map((u) => ({
      userId: u.id as string,
      name: (u.name as string) ?? "",
      email: (u.email as string) ?? "",
      has: got.has(u.id as string),
    }));
  }

  return NextResponse.json({
    ok: true,
    rows: await held(supabase),
    found,
    hint: q && q.length < 3 ? "3文字以上で探してください。" : "",
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "本部だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const userId = typeof b.userId === "string" ? b.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "誰の話か分かりません。" }, { status: 400 });
  }

  if (b.action === "revoke") {
    const { error } = await supabase.rpc("revoke_training", { p_user: userId });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rows: await held(supabase) });
  }

  /* 誰が押したか。あとで振込と突き合わせるため */
  const { data: me } = await supabase
    .from("users")
    .select("id")
    .eq("email", owner)
    .maybeSingle();

  const { data, error } = await supabase.rpc("grant_training", {
    p_user: userId,
    p_by: (me?.id as string) ?? null,
    p_source: "owner",
    p_note: typeof b.note === "string" ? b.note.trim().slice(0, 200) || null : null,
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  if (data === false) {
    return NextResponse.json({ ok: false, reason: "その人が見つかりません。" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, rows: await held(supabase) });
}
