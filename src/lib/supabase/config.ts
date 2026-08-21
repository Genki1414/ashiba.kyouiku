/* Supabase を使える状態か。
   設定されていないあいだは、記録は端末内に置き、ログインも求めない。
   （手元で動かすときと、まだ繋いでいない環境のため） */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** ブラウザ側から見て、Supabase が使えるか */
export const hasSupabase = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
