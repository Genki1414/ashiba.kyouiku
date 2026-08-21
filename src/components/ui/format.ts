/** 秒 → 「x分y秒」 */
export function hm(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}分${r ? `${r}秒` : ""}`;
}

/** 秒 → 「x時間y分」 */
export function hhmm(s: number): string {
  return `${Math.floor(s / 3600)}時間${Math.floor((s % 3600) / 60)}分`;
}
