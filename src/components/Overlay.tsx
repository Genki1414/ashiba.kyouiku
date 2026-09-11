"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/* 画面全体に被せる札（確認・完了・アプリのコード）を、外枠の外に出す。

   ── 何が起きていたか（げんきさん 2026-09-11 実機）──
   下のタブを出す画面では、本体（.shell > main）だけを動かす枠にしてある
   （globals.css の data-shell="fixed"）。その枠の中で position: fixed の
   札を出すと、iPhone では**枠に閉じ込められて**タブの下に潜り、
   押す所が切れて見えなかった（実務トレーニングの申込みの確認札）。

   ── どう直すか ──
   札は body の直下に描く（createPortal）。枠の外なので、どの画面でも
   タブの上に被さる。中身は同じ。試験の目印（data-testid）も同じ。

   サーバでの描画には document が無いので、そこでは何も出さない。
   端末では**最初の描画から**body に描く。取り付いてから描く形にすると
   1コマ遅れて、押した瞬間には札が無い（e2e-order が見ている）。
   札はどれも押してから開く（最初の描画で開いているものは無い）ので、
   サーバと端末で食い違うことはない。 */

export function Overlay({ children }: { children: React.ReactNode }) {
  const [host] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : document.body,
  );
  if (!host) return null;
  return createPortal(children, host);
}
