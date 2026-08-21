"use client";
import type { Figure } from "@/types/curriculum";
import { FigureList } from "./FigureList";
import { FigureFlow } from "./FigureFlow";
import { FigureDimension } from "./FigureDimension";
import { FigureFindFault } from "./FigureFindFault";
import { FigureCompare } from "./FigureCompare";
import { FigureHotspot } from "./FigureHotspot";
import { FigureTree } from "./FigureTree";
import { FigureDrawing } from "./FigureDrawing";

/* type による振り分け。74枚を8種のレンダラで賄う */
export function FigureRenderer({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  switch (fig.type) {
    case "flow":
      return <FigureFlow fig={fig} onDone={onDone} />;
    case "dimension":
      return <FigureDimension fig={fig} onDone={onDone} />;
    case "findfault":
      return <FigureFindFault fig={fig} onDone={onDone} />;
    case "compare":
      return <FigureCompare fig={fig} onDone={onDone} />;
    case "hotspot":
      return <FigureHotspot fig={fig} onDone={onDone} />;
    case "tree":
      return <FigureTree fig={fig} onDone={onDone} />;
    case "drawing":
      return <FigureDrawing fig={fig} onDone={onDone} />;
    case "list":
    default:
      return <FigureList fig={fig} onDone={onDone} />;
  }
}
