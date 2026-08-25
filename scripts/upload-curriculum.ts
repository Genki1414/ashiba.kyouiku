/* content/courses/ashiba.json（正本）を Supabase Storage へ写す。
   アプリはビルド同梱の content/ を読むが、Storage を配信元にする場合に使う。
   実行: npm run upload:curriculum */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください");
  process.exit(1);
}

const body = readFileSync(path.join(process.cwd(), "content", "courses", "ashiba.json"));
const supabase = createClient(url, key, { auth: { persistSession: false } });

const bucket = "content";
await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});
const { error } = await supabase.storage
  .from(bucket)
  .upload("curriculum.json", body, { contentType: "application/json", upsert: true });
if (error) {
  console.error("アップロードに失敗:", error.message);
  process.exit(1);
}
console.log("OK  content/courses/ashiba.json を Storage へアップロード");
