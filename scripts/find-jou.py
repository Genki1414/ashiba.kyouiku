#!/usr/bin/env python3
"""安衛則などの条文（e-Gov の HTML）から、言葉で条番号を引く。

   使い方
     1. e-Gov で法令の HTML を落とす（zip でよい）
     2. python3 scripts/find-jou.py <条文のHTMLかtxt> "調べたい言葉" ...

   なぜ要るか
     この環境からは e-Gov に出られない（外向き通信のポリシー）。
     げんきさんが落としてくれたファイルを、こちらで引くための道具。
     **検索の要約ではなく条文そのものを引く**ための道具でもある（docs/24）。

   出るもの
     その言葉を含む条の番号と、条の見出し。
     見出し行に当たったときは、その見出しが付く「次の条」を返す
     （e-Gov の並びは 見出し → 条 の順）。
"""
import re, sys, html, pathlib

JOU = re.compile(r"^(第[〇一二三四五六七八九十百千]+条(?:の[〇一二三四五六七八九十]+)?)(?:[　\s]|$)")


def to_text(p: pathlib.Path) -> list[str]:
    s = p.read_text(encoding="utf-8", errors="replace")
    if p.suffix.lower() in (".html", ".htm"):
        s = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
        s = html.unescape(re.sub(r"<[^>]+>", "\n", s))
    return [l.strip() for l in s.split("\n") if l.strip()]


def jou_at(lines: list[str], i: int) -> tuple[str, str]:
    if lines[i].startswith("（") and lines[i].endswith("）"):
        for k in range(i + 1, min(len(lines), i + 4)):
            m = JOU.match(lines[k])
            if m:
                return m.group(1), lines[i]
    for k in range(i, -1, -1):
        m = JOU.match(lines[k])
        if m:
            head = ""
            for h in range(k - 1, max(0, k - 3), -1):
                if lines[h].startswith("（") and lines[h].endswith("）"):
                    head = lines[h]
                    break
            return m.group(1), head
    return "?", ""


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    lines = to_text(pathlib.Path(sys.argv[1]))
    for q in sys.argv[2:]:
        hits = [i for i, l in enumerate(lines) if q in l]
        print(f"■ 「{q}」 {len(hits)}か所")
        seen: set[str] = set()
        for i in hits:
            j, h = jou_at(lines, i)
            if j in seen or j == "?":
                continue
            seen.add(j)
            print(f"   {j}　{h}")
            print(f"      {lines[i][:100]}")
            if len(seen) >= 5:
                break
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
