/* 視聴時間などの進捗バー */
export function Bar({ v, max, color }: { v: number; max: number; color?: string }) {
  const pct = Math.min(100, (v / Math.max(1, max)) * 100);
  return (
    <div className="h-1.5 overflow-hidden rounded-sm bg-line">
      <div
        className="h-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: color ?? "var(--color-yel)" }}
      />
    </div>
  );
}
