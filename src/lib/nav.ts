import type { Me } from "@/lib/me";

/* 下の行き先（画面の下にいつも出ている札）を、ここ1か所で決める。

   ── なぜ分けたか ──
   げんきさん（2026-09-10）
     「ホームと下部タブで重複するものはホームに出さない」

   下の札にマイページがあるのに、ホームにもマイページの札があった。
   運営・受講管理も同じ。**同じ行き先が、1画面に2つ**出ていた。
   現場の方は、どちらを押せばいいのか迷う。

   ホームが「下の札に何が出ているか」を知らないと消せないので、
   決める所を出しておく。**2か所に書かない。**書くと、
   片方だけ直したときに、また重なる。 */

export type NavItem = { href: string; label: string; icon: string };

/** 下の札に並ぶ行き先。立場は /api/me が返すものを使う */
export function navItems(me: Me | null): NavItem[] {
  const out: NavItem[] = [
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

/** その行き先が、いま下の札に出ているか。**ホームの出し分けに使う。**

    兼ねている人には本部しか出ないので、そのときホームの
    「受講管理」は重なっていない。消さずに残す */
export function inNav(me: Me | null, href: string): boolean {
  return navItems(me).some((i) => i.href === href);
}
