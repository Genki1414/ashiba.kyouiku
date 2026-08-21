/* curriculum.json の単元ID・題名・legal_min を lessons 表へ写す。
   規定時間の判定（mark_quiz_passed）がサーバ側で行えるようにするため。
   実行: npm run sync:lessons（要 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY） */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CurriculumSchema } from "../src/types/curriculum";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください");
  process.exit(1);
}

const cur = CurriculumSchema.parse(
  JSON.parse(readFileSync(path.join(process.cwd(), "content", "curriculum.json"), "utf-8")),
);

const rows = cur.subjects.flatMap((s, si) =>
  s.lessons.map((l, li) => ({
    lesson_id: l.id,
    subject_id: s.id,
    title: l.title,
    legal_min: l.legal_min,
    sort_order: si * 100 + li,
  })),
);

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error } = await supabase.from("lessons").upsert(rows, { onConflict: "lesson_id" });
if (error) {
  console.error("投入に失敗:", error.message);
  process.exit(1);
}
console.log(`OK  lessons ${rows.length} 件を同期`);
