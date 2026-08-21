"use client";
import type { Figure } from "@/types/curriculum";
import { FigureFrame, figureItems } from "./core";

/* list：項目を順に開く基本形（38枚） */
export function FigureList({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  return <FigureFrame fig={fig} items={figureItems(fig)} onDone={onDone} />;
}
