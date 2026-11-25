# チラシ（A4）

`chirashi.html` が元。`chirashi.pdf` が印刷用（A4・余白なし・1枚）、`chirashi.png` が LINE などに貼る画像（1588×2246）。
`qr-try.svg` は https://kyouiku.ashibase.jp/try の QR（npm の qrcode で作った）。

値段・連絡先は 2026-11-25 時点。値段を変えたら HTML を書き換えて撮り直す
（docs/nedan/料金表 と同じ。playwright-core で #flyer を撮り、page.pdf で A4 に出す）。
