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

   **この2つは、上の隙間（spacer）と同じ式で使う。**
   別々に書くと、片方を直したときに最後の行が札の下に隠れる */
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

  if (navHidden(path)) return null;
  /* 並びは src/lib/nav.ts が決める。**ホームも同じ所を見て、
     ここに出るものを札にしない**（げんきさん 2026-09-10） */
  const items = navItems(me);
  /* いまどこに居るか。/edu/ashiba のような下の階層でも、講座を光らせる */
  const here = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

  return (
    <>
      {/* 固定した行の高さぶん、下に余白を作る。無いと最後の行が隠れる。
          **札と同じ計算で出す**（片方だけ直すと、最後の行が隠れる）。
          +1px は札の上の線のぶん */}
      <div className="print:hidden" style={{ height: `calc(${ROW}px + ${GAP} + 1px)` }} aria-hidden />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel print:hidden"
        style={{
          paddingBottom: GAP,
          /* ── iPhone で、送っている間だけ札が置いていかれる（2026-09-10）──
             げんきさん「下部タブの固定が出来てない」。
             手元のブラウザでは、いちばん下まで送っても画面の下にぴたりと
             付いている（tests/nav-check.mjs）。iOS の惰性スクロールでだけ、
             固定したものの描き直しが後回しになって、途中に取り残される。

             自分の層に切り出すと、送っている間も一緒に描かれる。
             **fixed の要素そのものに掛けるので、位置の基準は変わらない**
             （親に掛けると、fixed が親を基準にしてしまって壊れる）。 */
          transform: "translateZ(0)",
          willChange: "transform",
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
