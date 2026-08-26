# Instagram の投稿画像

`tokubetsu.html` が、特別教育のカルーセル（6枚）の元。
`tokubetsu-1.png` 〜 `tokubetsu-6.png` が、書き出した画像（1080×1080）。

文言を直したいときは HTML を書き換えて、書き出し直す。
書き出しには Noto Sans JP（400/700/900）が要る。

```
npx playwright screenshot --viewport-size=1080,1080 ...
```
でも出せるが、章ごとに切り出すので tests と同じ playwright-core を使って
`#p1` 〜 `#p6` をそれぞれ撮るのが早い。
