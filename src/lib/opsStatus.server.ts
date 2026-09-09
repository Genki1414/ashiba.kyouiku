import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { NEED_SCHEMA } from "@/content/schema";
import { BRAND } from "@/content/brand";
import { ownerEmails } from "./owner";
import { missingPrice } from "./price.server";
import { notifyReady } from "./notify.server";
import { lineLoginReady } from "./line";
import { lineBotReady, lineHookReady } from "./lineBot";
import { siteUrl } from "./siteUrl";

/* 設定の様子を、1通の短い字にする。

   げんきさん（2026-09-09）
     「セットアップや設定とおくったらセットアップを表示させる」

   ── なぜ画面の写しではないのか ──
   /setup は表が長い。スマホのトークに全部流すと、指で延々と繰ることになる。
   **現場で見たいのは「いま止まっている所があるか」だけ。**
   だから、止まると困る所だけを並べて、詳しくは画面へ送る。

   ── 出さないもの ──
   鍵そのもの、値段の上書き、人の名前。**トークは残る。**
   端末を人に見せることもあるので、商売の中身は画面の側に置く。 */

const mark = (ok: boolean) => (ok ? "OK" : "未設定");

/** データベースの版。読めなければ空 */
async function schemaNow(): Promise<string> {
  const supabase = getServiceClient();
  if (!supabase) return "";
  try {
    const { data, error } = await supabase.rpc("schema_version");
    return error ? "" : String(data ?? "");
  } catch {
    return "";
  }
}

/** 設定の様子。LINE に返す本文 */
export async function opsStatusText(): Promise<string> {
  const now = await schemaNow();
  const site = siteUrl().replace(/\/+$/, "");
  const zero = missingPrice();

  const lines = [
    `【${BRAND.notifyPrefix}】設定の様子`,
    "",
    /* いちばん先に見るのはここ。版が古いと、新しい画面が動かない */
    `データベース　${now || "読めません"}（要 ${NEED_SCHEMA}）${now && now >= NEED_SCHEMA ? "" : "　← 要対応"}`,
    `Supabase　${mark(!!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY)}`,
    `運営　${ownerEmails().length}人`,
    `申込の知らせ　${mark(notifyReady())}`,
    `LINEログイン　${mark(lineLoginReady())}`,
    `LINEで送る　${mark(lineBotReady())}`,
    `LINEで受ける　${mark(lineHookReady())}`,
    /* 0円のまま公開している講座。ここが空でないときだけ困る */
    `0円のまま公開　${zero.length ? `${zero.length}件　← 要対応` : "なし"}`,
    "",
    `${site}/setup`,
  ];
  return lines.join("\n");
}
