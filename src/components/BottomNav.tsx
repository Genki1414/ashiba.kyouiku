"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadMe, readMe, type Me } from "@/lib/me";

/* 画面の下に、いつも出ている行き先（げんきさん 2026-09-09）。

   前は、どの画面からでもホームに戻ってから選び直していた。
   受講中の人はマイページ、担当者は名簿と申込みを1日に何度も行き来する。

   ── 出さない画面 ──
   ・ログインと、その戻り（まだ誰でもない）
   ・単元・修了試験・実務トレーニング（手元を隠すと邪魔になる）
   ・印刷（請求書。紙に出ない）

   立場は /api/me が返す（src/lib/me.ts）。覚えているぶんで先に描くので、
   画面が一拍ずれない。 */

type Item = { href: string; label: string; icon: string };

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

function itemsFor(me: Me | null): Item[] {
  const out: Item[] = [
    { href: "/", label: "ホーム", icon: "⌂" },
    { href: "/edu", label: "講座", icon: "▤" },
    { href: "/me", label: "マイページ", icon: "◉" },
  ];
  /* 立場のある人だけ、4つ目が出る。本部と担当者を兼ねる人には本部を出す
     （本部の画面から担当者の画面へは、そのまま行ける） */
  if (me?.owner) out.push({ href: "/owner", label: "運営", icon: "▦" });
  else if (me?.admin) out.push({ href: "/admin", label: "受講管理", icon: "▦" });
  return out;
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
  const items = itemsFor(me);
  /* いまどこに居るか。/edu/ashiba のような下の階層でも、講座を光らせる */
  const here = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

  return (
    <>
      {/* 固定した行の高さぶん、下に余白を作る。無いと最後の行が隠れる */}
      <div className="h-[62px] print:hidden" aria-hidden />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 no-underline ${
                  on ? "text-yel" : "text-dim2"
                }`}
                aria-current={on ? "page" : undefined}
                data-testid="bottom-nav-item"
              >
                <span className="text-[15px] leading-none" aria-hidden>{it.icon}</span>
                <span className="text-[10.5px] font-bold leading-none">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
