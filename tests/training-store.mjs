/* 実務トレーニングを売っている店かどうかを見て、売っていなければ
   「無いこと」を確かめて、その試験を終わらせる。

   ── なぜ要るか ──
   実務トレーニングは**足場屋革命だけの売り物。**
   特別教育ドットコムでは画面（/training・/train）も口（/api/training ほか）も
   閉じてある（2026-09-08、docs/98）。

   だから実務トレーニングの試験は、あの店では走れない。
   ところが**素通りさせると、開くようになっても気づけない。**
   売っていない店では「閉じていること」を確かめて終わる。

   どちらの店かは、環境変数ではなく**実際の返事**で見る。
   店の名前を試験に持ち込むより、そのほうが確か
   （名前を足しても、閉じ忘れていれば通ってしまう）。 */

/** 売っていない店なら、閉じていることを確かめて `true` を返す。
    呼んだ側は `true` なら、そこで終わること。

    @param page   Playwright のページ
    @param BASE   http://localhost:3100 など
    @param onNg   だめだったときに呼ぶ（各試験の check と同じ数え方にするため） */
export async function closedStore(page, BASE, onNg) {
  const res = await page.goto(`${BASE}/training`, { waitUntil: "domcontentloaded" });
  if (res?.status() !== 404) return false;

  /* 画面が404なら、口も閉じているはず。**扉だけ閉めて窓を開けない。**
     とくに /api/train-order は請求書の出る注文を立てる口 */
  const outs = await page.evaluate(async () => {
    const out = {};
    for (const u of ["/api/training", "/api/training/view", "/api/train-order"]) {
      const r = await fetch(u, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      out[u] = r.status;
    }
    return out;
  });
  for (const [u, st] of Object.entries(outs)) {
    if (st !== 404) onNg(`${u} が開いている（${st}）。画面は404なのに口が開いている`);
  }
  /* 画面の方も、下まで閉じているか */
  for (const u of ["/training/ch1", "/training/catalog", "/training/demo", "/train"]) {
    const r = await page.goto(`${BASE}${u}`, { waitUntil: "domcontentloaded" });
    if (r?.status() !== 404) onNg(`${u} が開く（${r?.status()}）`);
  }
  return true;
}
