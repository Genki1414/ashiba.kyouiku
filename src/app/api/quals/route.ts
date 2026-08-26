import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { heldFor } from "@/lib/quals";
import { OTHER, findQual } from "@/content/quals";
import { COURSES } from "@/content/courses";

/* 取得済みの資格。本人が足す・外す。

   出どころは2つある。
   ・この仕組みで取ったもの … certificates。自動で出る。外せない
   ・よそで取ったもの　　　 … held_quals。本人が入れる。外せる

   自分のぶんしか触らない。誰かの id を受け取ったりしない。
   ここで足せるのは自己申告まで。「確かめた」印は会社側が立てる
   （/api/admin/qual）。自分で確かめたことにできると、印の意味が無くなる。 */

type Body = {
  action?: "add" | "drop";
  id?: string;
  /** 1つだけのとき */
  qualId?: string;
  /** まとめて足すとき。同じ所で同じ日に取ったものは、たいてい何枚もある */
  qualIds?: string[];
  label?: string;
  issuer?: string;
  gotOn?: string;
  certNo?: string;
};

const clip = (v: unknown, n: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

export async function GET() {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    held: await heldFor(supabase, user.id),
    mine: await minted(supabase, user.id),
  });
}

/* この仕組みで取ったもの。取り消していない修了証だけ。
   受講を取り消して閉じたあとでも、出した修了証は持っている
   （取り消すなら revoked_at が立つ）ので、開いているものに絞らない */
async function minted(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  userId: string,
) {
  const { data: ens } = await supabase
    .from("enrollments")
    .select("id, course_id")
    .eq("user_id", userId);
  const rows = ens ?? [];
  if (!rows.length) return [];

  const { data: certs } = await supabase
    .from("certificates")
    .select("enrollment_id, cert_no, issued_at, revoked_at")
    .in("enrollment_id", rows.map((e) => e.id as string));

  const courseOf = new Map(rows.map((e) => [e.id as string, e.course_id as string]));
  const name = new Map(COURSES.map((c) => [c.id, c.name]));
  return (certs ?? [])
    .filter((c) => !c.revoked_at)
    .map((c) => {
      const cid = courseOf.get(c.enrollment_id as string) ?? "";
      return {
        id: c.cert_no as string,
        name: name.get(cid) ?? cid,
        kind: "特別教育",
        certNo: c.cert_no as string,
        gotOn: (c.issued_at as string) ?? null,
      };
    })
    .sort((a, b) => `${b.gotOn ?? ""}`.localeCompare(`${a.gotOn ?? ""}`));
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;

  if (b.action === "drop") {
    const id = clip(b.id, 64);
    if (!id) {
      return NextResponse.json({ ok: false, reason: "どれを外すのか分かりません。" }, { status: 400 });
    }
    /* 自分のぶんだけ消える（drop_qual が user_id で絞っている） */
    const { error } = await supabase.rpc("drop_qual", { p_user: user.id, p_id: id });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      held: await heldFor(supabase, user.id),
      mine: await minted(supabase, user.id),
    });
  }

  /* まとめて足せる。同じ教習機関で同じ日に何枚も取ることが多い。
     1件だけのときも、この形に寄せる */
  const picked = Array.isArray(b.qualIds) ? b.qualIds : b.qualId ? [b.qualId] : [];
  const ids = [...new Set(picked.map((x) => clip(x, 64)).filter(Boolean))] as string[];
  if (!ids.length) {
    return NextResponse.json({ ok: false, reason: "資格を選んでください。" }, { status: 400 });
  }
  if (ids.length > 40) {
    return NextResponse.json({ ok: false, reason: "一度に足せるのは40件までです。" }, { status: 400 });
  }
  /* 一覧に無い id を送られても取らない。'その他' だけは本人が名前を書く */
  const unknown = ids.filter((x) => x !== OTHER && !findQual(x));
  if (unknown.length) {
    return NextResponse.json({ ok: false, reason: "その資格は一覧にありません。" }, { status: 400 });
  }
  const label = clip(b.label, 100);
  if (ids.includes(OTHER) && !label) {
    return NextResponse.json(
      { ok: false, reason: "その他を選んだときは、資格の名前を書いてください。" },
      { status: 400 },
    );
  }

  /* 取った日。未来の日付は受けない（打ち間違い） */
  let gotOn: string | null = null;
  if (typeof b.gotOn === "string" && b.gotOn) {
    const t = Date.parse(b.gotOn);
    if (Number.isNaN(t)) {
      return NextResponse.json({ ok: false, reason: "取った日が読めません。" }, { status: 400 });
    }
    if (t > Date.now()) {
      return NextResponse.json({ ok: false, reason: "取った日が先の日付になっています。" }, { status: 400 });
    }
    gotOn = new Date(t).toISOString().slice(0, 10);
  }

  /* 取った先・日付・番号は、選んだものすべてに入る。
     違うものは分けて足してもらう（画面にもそう書いてある）。
     1件でも失敗したらそこで止める。半端に入ると、どれが入ったか分からない */
  const issuer = clip(b.issuer, 100);
  const certNo = clip(b.certNo, 60);
  for (const qualId of ids) {
    const { error } = await supabase.rpc("add_qual", {
      p_user: user.id,
      p_qual: qualId,
      p_label: qualId === OTHER ? label : null,
      p_issuer: issuer,
      p_got: gotOn,
      p_cert: certNo,
    });
    if (error) {
      return NextResponse.json(
        { ok: false, reason: error.message, held: await heldFor(supabase, user.id) },
        { status: 500 },
      );
    }
  }
  return NextResponse.json({
    ok: true,
    added: ids.length,
    held: await heldFor(supabase, user.id),
    mine: await minted(supabase, user.id),
  });
}
