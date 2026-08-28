/* このアプリが必要とするデータベースの版。

   supabase/migrations の最後の番号。
   **手で書かないこと**（npm run build:sql が書き出す）。
   手で書いていたら 0010 のまま止まっていて、
   0011〜0015 を流していない人にも「大丈夫」と出ていた。 */

export const NEED_SCHEMA = "0020";
