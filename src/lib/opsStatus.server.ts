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

/* ── まだ結び付いていない人への返事 ──

   げんきさん（2026-09-09）「特別教育ドットコムでは応答ない」。

   **黙っていると切り分けられない。**返らない理由は3つあり、
   どれなのかが外から分からなかった。
     ・この店ではまだ「LINEをつなぐ」をしていない
     ・つないだ相手が、運営ではない別のアカウントだった
     ・ログインチャネルと公式アカウントのプロバイダーが分かれていて、
       **番号そのものが食い違っている**

   3つ目は、ここに出す番号と、運営管理 → LINE に出る番号を
   見比べれば分かる。**食い違っていたら、プロバイダーが分かれている。**

   出すのは、その人自身の番号だけ。鍵も、よその人のことも出さない。 */
export function opsNotLinkedText(lineUserId: string): string {
  const site = siteUrl().replace(/\/+$/, "");
  return [
    `【${BRAND.notifyPrefix}】`,
    "このLINEは、まだこの仕組みのアカウントとつながっていません。",
    "",
    "つなぐと、受講コードや修了証の知らせがここに届きます。",
    `① ${site}/me を開く`,
    "② ログインする（はじめての方は「LINEではじめる」）",
    "③ LINE の枠の「LINEをつなぐ」を押す",
    "",
    "このLINEの番号",
    lineUserId,
  ].join("\n");
}

/** つながってはいるが、運営ではない人への返事。

    **どのアカウントにつながっているかを返す。**運営のつもりで
    別のアカウントにつないでいた、が実際に起きる（重複したアカウント）。
    返すのは、その人自身のアカウントのことだけ。 */
export function opsNotOwnerText(who: { name: string; email: string }): string {
  return [
    `【${BRAND.notifyPrefix}】`,
    `このLINEは「${who.name || "（氏名未登録）"}」としてつながっています。`,
    who.email ? `メール: ${who.email}` : "",
    "",
    "設定の様子は、運営のアカウントだけが見られます。",
    "別のアカウントにつないでいる場合は、そのアカウントでログインし直して、",
    "マイページの LINE から、つなぎ直してください。",
  ]
    .filter(Boolean)
    .join("\n");
}
