# 料金表の画像

`ryokin.html` が元。`ryokin-p1.png`〜`ryokin-p5.png` が Instagram 用（1080×1350・5枚組）、
`ryokin-long.png` が LINE に貼る縦長1枚（値段ごとにまとめてある）。

値段は `src/lib/pricing.ts` の既定値（2026-10-14 時点）。値段を変えたら、
`2026-10-14-料金表.md` を作り直してから HTML を書き換え、撮り直す。

撮り方（tests と同じ playwright-core。Noto Sans JP は Google Fonts から読む）:

```
node -e '…'   # #p1〜#p5 と #long をそれぞれ element screenshot
```
