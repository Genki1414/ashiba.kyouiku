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

/** 秒 → 「x時間y分」。1時間に満たなければ「y分」だけ。
    「0時間0分」と出すより、そのまま「0分」のほうが読みやすい */
export function dur(s: number): string {
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}分` : `${Math.floor(m / 60)}時間${m % 60}分`;
}
