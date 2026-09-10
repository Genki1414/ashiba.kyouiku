"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadMe, readMe, type Me } from "@/lib/me";
import { navItems } from "@/lib/nav";

/* 画面の下に、いつも出ている行き先（げんきさん 2026-09-09）。

   前は、どの画面からでもホームに戻ってから選び直していた。
   受講中の人はマイページ、担当者は名簿と申込みを1日に何度も行き来する。

   ── 出さない画面 ──
   ・ログインと、その戻り（まだ誰でもない）
   ・単元・修了試験・実務トレーニング（手元を隠すと邪魔になる）
   ・印刷（請求書。紙に出ない）

   立場は /api/me が返す（src/lib/me.ts）。覚えているぶんで先に描くので、
   画面が一拍ずれない。 */

/* ── 押す所の大きさと、下のふち（2026-09-10）──
   げんきさん「下記タブが小さくてiPhoneのバーと被って変な挙動する」。

   ROW … 札1つの高さ。指で押す所は 44px 以上ないと、
          隣を押してしまう（手袋のままなら、なおさら）。
   GAP … 下のふちに空ける分。iPhone のホーム画面から開くと、
          画面のいちばん下に横棒が乗っている。そこに札を置くと、
          押したつもりがホームに戻る。
          env が 0 のブラウザでも、指1本ぶんは必ず空ける（max）。

   高さは、下の縦並びの中で使う（貼り付けはやめた。2026-09-11） */
const ROW = 52;
const GAP = "max(env(safe-area-inset-bottom), 10px)";

/** その画面で出すかどうか。受講の邪魔になる所では出さない */
export function navHidden(path: string): boolean {
  if (path === "/login" || path.startsWith("/auth")) return true;
  /* 実務トレーニング（ゲーム）は画面いっぱいに使う */
  if (path.startsWith("/training")) return true;
  /* 単元・修了試験・討議は、見ている途中で押させない。
     /edu と /edu/<講座> は一覧なので出す */
  if (/^\/edu\/[^/]+\/.+/.test(path)) return true;
  return false;
}

export function BottomNav() {
  const path = usePathname() ?? "/";
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    setMe(readMe());
    let alive = true;
    void loadMe().then((m) => { if (alive && m) setMe(m); });
    return () => { alive = false; };
  }, [path]);

  /* ── 本体を止める印（2026-09-11）──
     この札が出ている画面だけ、ページ本体のスクロールを止めて
     <main> の中だけを動かす（globals.css の data-shell="fixed"）。

     **札を出さない画面では止めない。**単元と修了試験は
     window.scrollTo でページ本体を動かしているので、
     止めるとそこが動かなくなる。
     画面を移ったら必ず外す（外し忘れると、次の画面が動かない）。 */
  const show = !navHidden(path);
  useEffect(() => {
    const el = document.documentElement;
    if (show) el.dataset.shell = "fixed";
    else delete el.dataset.shell;
    return () => { delete el.dataset.shell; };
  }, [show]);

  if (!show) return null;
  /* 並びは src/lib/nav.ts が決める。**ホームも同じ所を見て、
     ここに出るものを札にしない**（げんきさん 2026-09-10） */
  const items = navItems(me);
  /* いまどこに居るか。/edu/ashiba のような下の階層でも、講座を光らせる */
  const here = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

  return (
    <>
      {/* ── 貼り付けるのをやめた（げんきさん 2026-09-11）──
          「また下部タブがずれる。スクロールするとズレる。固定して」

          position: fixed で画面に貼り付けている限り、iOS の惰性スクロールでは
          札の位置を決めるのが合成側になり、慣性の間だけ取り残される。
          小さくしても、描画層を切り出しても、この道筋は残る。

          だから**本体をスクロールさせない。**外枠を画面ぴったりの縦並びにして、
          真ん中の <main> だけを動かす（globals.css の data-shell="fixed"）。
          札は、その縦並びのいちばん下に普通に置く。
          動かないものの隣にあるので、ずれようがない。

          上に隙間（spacer）を作る必要も無くなった。
          札は本体の外ではなく、並びの中に居るため。 */}
      <nav
        className="shrink-0 border-t border-line bg-panel print:hidden"
        style={{
          paddingBottom: GAP,
        }}
        data-testid="bottom-nav"
        aria-label="画面の行き先"
      >
        <div className="mx-auto flex max-w-md">
          {items.map((it) => {
            const on = here(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 no-underline ${
                  on ? "text-yel" : "text-dim2"
                }`}
                style={{ minHeight: `${ROW}px` }}
                aria-current={on ? "page" : undefined}
                data-testid="bottom-nav-item"
              >
                <span className="text-[20px] leading-none" aria-hidden>{it.icon}</span>
                <span className="text-[11.5px] font-bold leading-none">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
