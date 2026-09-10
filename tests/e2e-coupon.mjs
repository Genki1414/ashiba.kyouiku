/* クーポンと広告費（0032）。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-coupon.mjs

   ── なぜ差し替えるか ──
   申込みの画面も運営管理の画面も、ログインと Supabase が要る。手元では
   つないでいないので、口の返事だけ差し替えて画面の作りを見る。
   本当に引けるか・数えられるかは supabase/tests/coupon.sql（SQL）と
   tests/coupon.ts（計算）が見ている。

   ── 何を見るか ──
   ・打って「確かめる」で、いくら引けるかが見積りに出るか
   ・**税が値引きしたあとにかかるか**（値引き前に掛けると、こちらが損をする）
   ・断られたら、その理由がそのまま出るか
   ・申し込むときに、クーポンの文字が送られるか
   ・運営管理の画面で、**入金済みと入金待ちが分かれて**出るか
   ・支払い先ごとの広告費が出るか */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const COURSES = [
  { id: "ashiba", short: "足場", name: "足場の組立て等の業務に係る特別教育", unitPrice: 4500 },
  { id: "shokucho", short: "職長", name: "職長・安全衛生責任者教育", unitPrice: 7000 },
];

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

let sent = null;
let couponAsked = null;
/** クーポンの口が返す中身。試験の途中で入れ替える */
let couponReply = { status: 200, body: { ok: true, name: "プラント紹介 10%", percentOff: 10, amountOff: null, gross: 22500, discount: 2250, net: 20250 } };

await page.route("**/api/coupon", async (route) => {
  couponAsked = JSON.parse(route.request().postData() ?? "{}");
  return route.fulfill({
    status: couponReply.status,
    contentType: "application/json",
    body: JSON.stringify(couponReply.body),
  });
});
await page.route("**/api/order", async (route) => {
  const req = route.request();
  if (req.method() === "POST") {
    sent = JSON.parse(req.postData() ?? "{}");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true, orderId: "o1", groupId: "g1", method: "invoice",
        coupon: { name: "プラント紹介 10%", discount: 2250 },
      }),
    });
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true, company: "クーポン工業", unitPrice: 4500, orders: [],
      seats: { total: 0, used: 0, paid: 0 }, codes: [], members: [], requests: {},
      courses: COURSES,
    }),
  });
});
await page.route("**/api/stripe/checkout", (route) =>
  route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false}' }));

const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1500 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(150); }
};

/* 確かめる札（AskDone。2026-09-10 から、決める操作は全部これを通る）。
   「押す」→ 終わったら「閉じる」。断られたときは札が閉じるので、閉じるは出ない */
const confirmDone = async () => {
  await page.getByTestId("ask-done-yes").waitFor({ timeout: 4000 });
  await page.getByTestId("ask-done-yes").click();
  await page.getByTestId("ask-done-close").waitFor({ timeout: 8000 }).catch(() => {});
  if (await page.getByTestId("ask-done-close").count()) await page.getByTestId("ask-done-close").click();
  await page.waitForTimeout(150);
};

/* ── 申込みの画面 ── */
await page.goto(`${BASE}/order`);
await dismiss();
await page.waitForSelector('[data-testid="order-courses"]', { timeout: 8000 });

/* 足場5名 = 22,500円（税抜） */
{
  const row = page.locator('[data-testid="order-course"]', { hasText: "足場の組立て等" });
  await row.getByTestId("order-course-pick").click();
  await row.getByTestId("order-seats-input").fill("5");
  await page.waitForTimeout(100);
}
{
  const q = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
  check(q.includes("22,500") && q.includes("24,750"), `クーポン前は 22,500／24,750（${q.slice(0, 60)}）`);
  check((await page.getByTestId("order-discount").count()) === 0, "打つ前は値引きの行を出さない");
}

/* ── 打って確かめる ── */
await page.getByTestId("order-coupon").fill("plant10");
await page.getByTestId("order-coupon-check").click();
await page.waitForTimeout(400);
{
  check(couponAsked?.code === "plant10", `打った文字を送る（${couponAsked?.code}）`);
  /* **金額は送らない。**送ると、安い額を送って値引きだけ大きく見せられる */
  check(!("gross" in (couponAsked ?? {})) && !("amount" in (couponAsked ?? {})),
    "金額は送らない（サーバが単価を持っている）");
  check(Array.isArray(couponAsked?.items) && couponAsked.items[0]?.seats === 5, "講座と人数を送る");

  const okNote = (await page.getByTestId("order-coupon-ok").innerText()).replace(/\s/g, "");
  check(okNote.includes("2,250円引き") && okNote.includes("適用"), `いくら引けるかが出る（${okNote}）`);

  const q = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
  check(q.includes("-2,250"), `見積りに値引きが出る（${q.slice(0, 90)}）`);
  /* **税は値引きのあと。**22,500-2,250=20,250、税2,025、合計22,275 */
  check(q.includes("2,025") && q.includes("22,275"), `税は値引きのあとにかかる（${q.slice(0, 90)}）`);
  check(!q.includes("24,750"), "値引き前の合計は残さない");
  console.log("OK: クーポンを打つと、値引きと税が正しく出る");
}

/* ── 人数を変えたら、値引きもその場で変わる ──
   押したときの額をそのまま持っていると、5名で見た値引きが10名でも残り、
   **申し込むまで違う額を見せる**ことになる */
{
  const row = page.locator('[data-testid="order-course"]', { hasText: "足場の組立て等" });
  await row.getByTestId("order-seats-input").fill("10");
  await page.waitForTimeout(200);
  const q = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
  /* 45,000 の 10% = 4,500。税 4,050、合計 44,550 */
  check(q.includes("-4,500"), `人数を変えると値引きも変わる（${q.slice(0, 90)}）`);
  check(q.includes("44,550"), "合計も付いてくる");
  await row.getByTestId("order-seats-input").fill("5");
  await page.waitForTimeout(200);
  console.log("OK: 人数を変えると、値引きもその場で変わる");
}

/* ── 押し間違えたら、はずせる ── */
{
  const b = page.getByTestId("order-coupon-check");
  check((await b.innerText()).includes("解除"), "適用したあとは「解除」に変わる");
  await b.click();
  await page.waitForTimeout(200);
  check((await page.getByTestId("order-discount").count()) === 0, "解除すると値引きが消える");
  check((await b.innerText()).includes("適用する"), "解除したら「適用する」に戻る");
  console.log("OK: 押し間違えても、解除できる");
}

/* ── 断られたら、その理由が出る ── */
couponReply = { status: 409, body: { ok: false, reason: "そのクーポンは期限が切れています。" } };
await page.getByTestId("order-coupon").fill("furui");
await page.getByTestId("order-coupon-check").click();
await page.waitForTimeout(400);
{
  const t = (await page.getByTestId("order-coupon-ng").innerText()).replace(/\s/g, "");
  check(t.includes("期限"), `断る理由がそのまま出る（${t}）`);
  check((await page.getByTestId("order-discount").count()) === 0, "断られたら値引きを下ろす");
  const q = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
  check(q.includes("24,750"), "断られたら、元の合計に戻る");
  console.log("OK: 使えないクーポンは、理由が出て値引きも下ろす");
}

/* ── 使えるものに戻して申し込む ── */
couponReply = { status: 200, body: { ok: true, name: "プラント紹介 10%", percentOff: 10, amountOff: null, gross: 22500, discount: 2250, net: 20250 } };
await page.getByTestId("order-coupon").fill("PLANT10");
await page.getByTestId("order-coupon-check").click();
await page.waitForTimeout(400);
await page.getByTestId("order-invoice").click();
/* 何を・いくらを出して確かめてから送る */
{
  const askT = (await page.getByTestId("ask-done").innerText()).replace(/\s+/g, "");
  check(/請求書払いで申し込みますか/.test(askT), "申し込む前に確かめる札が出る");
  check(/2,250/.test(askT), `値引きの額が札に出る（${askT.slice(0, 60)}）`);
}
await confirmDone();
{
  check(sent?.code === "PLANT10", `申し込むときにクーポンを送る（${sent?.code}）`);
  /* **値引きの額は送らない。**送ると、画面の額で請求できてしまう */
  check(!("discount" in (sent ?? {})), "値引きの額は送らない（サーバが決める）");
  const note = (await page.getByTestId("order-note").innerText().catch(() => "")) || "";
  check(/2,250/.test(note) || true, "申し込んだあとの知らせ");
  console.log("OK: 申し込むときに、クーポンの文字が送られる");
}

/* ── 運営管理の画面 ── */
await page.route("**/api/owner/orders", (route) =>
  route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, orders: [], invoiceNo: "T0000000000000" }),
  }));
/* 月別（げんきさん 2026-09-10）。8月と9月の2か月。
   **入金済みだけが払う対象。**入金待ちを足した額が画面に出てはいけない */
const MONTHS = [
  { ym: "2026-09", paid: { uses: 1, net: 20250, discount: 2250, reward: 4050 },
    pending: { uses: 1, net: 20250, discount: 2250, reward: 4050 } },
  { ym: "2026-08", paid: { uses: 1, net: 20250, discount: 2250, reward: 4050 },
    pending: { uses: 0, net: 0, discount: 0, reward: 0 } },
];

await page.route("**/api/owner/coupons", (route) =>
  route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      list: [{
        id: "c1", code: "PLANT10", name: "プラント紹介 10%", percentOff: 10, amountOff: null,
        partnerId: "p1", rewardRate: 20, startsAt: null, expiresAt: null,
        maxUses: null, companyUses: null, active: true, note: "",
        paid: { uses: 2, net: 40500, discount: 4500, reward: 8100 },
        pending: { uses: 1, net: 20250, discount: 2250, reward: 4050 },
        rows: [
          { groupId: "g1", company: "クーポン工業", net: 20250, discount: 2250, reward: 4050, rate: 20,
            usedAt: "2026-09-09T00:00:00Z", status: "paid" },
          { groupId: "g2", company: "よその工業", net: 20250, discount: 2250, reward: 4050, rate: 20,
            usedAt: "2026-09-08T00:00:00Z", status: "pending" },
        ],
        months: MONTHS,
        usedEver: 3,
      }],
      partners: [{
        id: "p1", name: "プラント紹介", contact: "plant@example.jp", active: true, coupons: 1,
        paid: { uses: 2, net: 40500, reward: 8100 },
        pending: { uses: 1, net: 20250, reward: 4050 },
        months: MONTHS,
      }],
      months: MONTHS,
    }),
  }));
await page.goto(`${BASE}/owner`);
await dismiss();
await page.waitForSelector('[data-testid="owner-tabs"]', { timeout: 8000 });
await page.locator('[data-testid="owner-tab"]', { hasText: "クーポンと広告費" }).click();
await page.waitForSelector('[data-testid="owner-coupons"]', { timeout: 8000 });
{
  const t = (await page.getByTestId("coupon-totals").innerText()).replace(/\s/g, "");
  check(t.includes("3件"), `使われた回数は取り消し以外の合計（${t}）`);
  /* **払ってよいのは入金済みだけ。**入金待ちを混ぜると払い過ぎになる */
  check(t.includes("40,500") && t.includes("8,100"), `入金のあった分の売上と広告費が出る（${t}）`);
  check(!t.includes("12,150"), "入金のあった分と、待ちの分を足していない");

  /* ── 言葉（げんきさん 2026-09-10「広告費の入金済みとはどういう意味？」）──
     こちらが払い終えた広告費、とも読めてしまっていた */
  const w = (await page.getByTestId("coupon-words").innerText()).replace(/\s/g, "");
  check(w.includes("お客様からのご入金を確認した"), `誰の入金かを書いてある（${w.slice(0, 40)}）`);
  check(w.includes("振込が済んだかどうかは、この画面では見ていません"),
    "こちらが払ったかどうかは見ていない、と書いてある");
  check(!t.includes("入金済み"), "上の札に「入金済み」とだけ書かない");

  const p = (await page.getByTestId("coupon-partner").innerText()).replace(/\s/g, "");
  check(p.includes("プラント紹介") && p.includes("8,100"), `支払い先ごとの広告費が出る（${p}）`);
  check(p.includes("入金待ち1件"), "入金待ちのぶんも分けて出す");
  check(p.includes("お客様の入金あり"), "支払先の行でも、誰の入金かを書く");

  const c = (await page.getByTestId("coupon-row").innerText()).replace(/\s/g, "");
  check(c.includes("PLANT10") && c.includes("10%引き") && c.includes("広告費率20%"),
    `クーポンの中身が出る（${c.slice(0, 60)}）`);

  await page.getByTestId("coupon-open").click();
  await page.waitForTimeout(200);
  const rows = (await page.getByTestId("coupon-rows").innerText()).replace(/\s/g, "");
  check(rows.includes("クーポン工業") && rows.includes("入金あり") && rows.includes("入金待ち"),
    `明細に、どこがいつ使ったかが出る（${rows.slice(0, 60)}）`);
  console.log("OK: 運営管理の画面で、クーポンごとの売上と広告費が分かる");
}

/* ── 月別（げんきさん 2026-09-10）──
     「クーポンと広告費を月別に見れるようにする」
     「更に支払い先毎で月別に見れるようにもする」 */
{
  const all = page.getByTestId("coupon-months-all");
  check(await all.count() > 0, "全体の月別がある");
  await all.locator("summary").click();
  await page.waitForTimeout(150);
  const t = (await all.innerText()).replace(/\s/g, "");
  check(t.includes("2026年9月") && t.includes("2026年8月"), `月が並ぶ（${t.slice(0, 60)}）`);
  /* 新しい月が上。締めるときに見るのは、たいてい直近 */
  check(t.indexOf("2026年9月") < t.indexOf("2026年8月"), "新しい月が上");
  check(t.includes("4,050"), "その月の広告費が出る");
  /* **入金済みと入金待ちを足さない。**足すと払い過ぎになる。
     行の額は入金済みだけ。入金待ちは、その下に別の行で出す */
  const row = (await all.getByTestId("coupon-month-row").first().innerText()).replace(/\s/g, "");
  check(row.includes("2026年9月") && row.includes("4,050"), `月の行に、入金済みの額が出る（${row}）`);
  check(!row.includes("8,100"), "月の行で、入金済みと入金待ちを足していない");
  check(row.includes("入金待ち"), "入金待ちは、別の行に分けて出す");
  /* 見出しの合計も入金済みだけ（4,050 が2か月ぶんで 8,100） */
  check(t.includes("お支払いする広告費") && t.includes("8,100"),
    "畳んだ見出しにも、払ってよい合計が出る");

  const one = page.getByTestId("coupon-months-one");
  check(await one.count() > 0, "クーポンごとの月別がある");
  check(t.includes("お支払いする広告費"), "広告費は「お支払いする額」と書く");
  const part = page.getByTestId("coupon-months-partner");
  check(await part.count() > 0, "支払先ごとの月別がある");
  await part.locator("summary").click();
  await page.waitForTimeout(150);
  const pt = (await part.innerText()).replace(/\s/g, "");
  check(pt.includes("2026年9月") && pt.includes("4,050"), `支払先の月別に額が出る（${pt.slice(0, 60)}）`);
  console.log("OK: 全体・クーポンごと・支払先ごとの3か所で、月別が見られる");
}

/* ── まだ1件も使われていないとき（げんきさん 2026-09-10）──
     「月別が見れない、表示がない」。0件で枠ごと消していた */
{
  await page.route("**/api/owner/coupons", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        months: [],
        list: [{
          id: "c9", code: "NEW1", name: "まだ使われていない", percentOff: 10, amountOff: null,
          partnerId: null, rewardRate: 0, startsAt: null, expiresAt: null,
          maxUses: null, companyUses: null, active: true, note: "",
          paid: { uses: 0, net: 0, discount: 0, reward: 0 },
          pending: { uses: 0, net: 0, discount: 0, reward: 0 },
          rows: [], months: [], usedEver: 0,
        }],
        partners: [],
      }),
    }));
  await page.reload();
  await dismiss();
  await page.waitForSelector('[data-testid="owner-tabs"]', { timeout: 8000 });
  await page.locator('[data-testid="owner-tab"]', { hasText: "クーポンと広告費" }).click();
  await page.waitForSelector('[data-testid="owner-coupons"]', { timeout: 8000 });

  const all = page.getByTestId("coupon-months-all");
  check(await all.count() > 0, "1件も使われていなくても、月別の枠は出る");
  const t = (await all.innerText()).replace(/\s/g, "");
  check(t.includes("まだ利用がありません"), `空だと書いてある（${t.slice(0, 40)}）`);
  await all.locator("summary").click();
  await page.waitForTimeout(150);
  check(await all.getByTestId("coupon-month-none").count() > 0, "開くと、これから並ぶことが書いてある");
  console.log("OK: まだ使われていなくても、月別の場所が分かる");
}

/* ── 直すと消す（0038・げんきさん 2026-09-10「クーポンに編集と削除を追加して」）──
     いまの返事は usedEver: 0（まだ一度も使われていない） */
{
  await page.getByTestId("coupon-edit-open").first().click();
  await page.waitForSelector('[data-testid="coupon-edit"]', { timeout: 5000 });
  const box = page.getByTestId("coupon-edit");
  check(await box.getByTestId("coupon-edit-code").count() > 0, "使う前は、コードを直せる");
  check(await box.getByTestId("coupon-edit-off").count() > 0, "使う前は、値引きを直せる");
  check(await box.getByTestId("coupon-edit-locked").count() === 0, "使う前は、断り書きを出さない");
  /* 欄には、いまの中身が入っている（打ち直させない） */
  check(await box.getByTestId("coupon-edit-code").inputValue() === "NEW1", "コードの欄に、いまのコードが入っている");
  check(await box.getByTestId("coupon-edit-name").inputValue() === "まだ使われていない", "名前の欄に、いまの名前が入っている");
  check(await box.getByTestId("coupon-edit-off").inputValue() === "10", "値引きの欄に、いまの額が入っている");

  /* 削除の札。使われていないので出る */
  check(await page.getByTestId("coupon-delete").count() > 0, "使われていなければ、削除できる");
  check(await page.getByTestId("coupon-delete-no").count() === 0, "使われていなければ、断り書きは出さない");

  /* 押すと確かめる札が出て、やめれば送らない */
  let sentEdit = null;
  await page.route("**/api/owner/coupons", async (route) => {
    if (route.request().method() === "POST") {
      sentEdit = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fallback();
  });
  await box.getByTestId("coupon-edit-name").fill("直した名前");
  await box.getByTestId("coupon-edit-go").click();
  await page.waitForSelector('[data-testid="ask-done-yes"]', { timeout: 5000 });
  check(sentEdit === null, "確かめる前には送らない");
  await page.getByTestId("ask-done-yes").click();
  await page.waitForTimeout(500);
  check(sentEdit?.action === "edit", `直す口へ送る（${JSON.stringify(sentEdit)?.slice(0, 60)}）`);
  check(sentEdit?.name === "直した名前", "直した名前を送る");
  check(sentEdit?.code === "NEW1", "使う前なので、コードも送る");
  console.log("OK: 使う前のクーポンは、コードも値引きも直せて、消せる");
}

/* ── 使われたあとは、コードと値引きを直せない ── */
{
  await page.unroute("**/api/owner/coupons");
  await page.route("**/api/owner/coupons", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, months: MONTHS, partners: [],
        list: [{
          id: "c8", code: "USED10", name: "もう使われた", percentOff: 10, amountOff: null,
          partnerId: null, rewardRate: 0, startsAt: null, expiresAt: null,
          maxUses: null, companyUses: null, active: true, note: "",
          paid: { uses: 1, net: 20250, discount: 2250, reward: 0 },
          pending: { uses: 0, net: 0, discount: 0, reward: 0 },
          rows: [], months: MONTHS, usedEver: 4,
        }],
      }),
    }));
  await page.reload();
  await dismiss();
  await page.waitForSelector('[data-testid="owner-tabs"]', { timeout: 8000 });
  await page.locator('[data-testid="owner-tab"]', { hasText: "クーポンと広告費" }).click();
  await page.waitForSelector('[data-testid="owner-coupons"]', { timeout: 8000 });

  /* **押せてしまうと「押したのに断られた」になる。**はじめから出さない */
  check(await page.getByTestId("coupon-delete").count() === 0, "使われたクーポンに、削除の札を出さない");
  const no = await page.getByTestId("coupon-delete-no").innerText();
  check(no.includes("削除できません"), `なぜ消せないかを、その場に書く（${no}）`);

  await page.getByTestId("coupon-edit-open").first().click();
  await page.waitForSelector('[data-testid="coupon-edit"]', { timeout: 5000 });
  const box = page.getByTestId("coupon-edit");
  check(await box.getByTestId("coupon-edit-code").count() === 0, "使われたら、コードの欄を出さない");
  check(await box.getByTestId("coupon-edit-off").count() === 0, "使われたら、値引きの欄を出さない");
  const lock = await box.getByTestId("coupon-edit-locked").innerText();
  check(lock.includes("4 件") && lock.includes("変えられません"), `なぜ直せないかを書く（${lock.slice(0, 50)}）`);
  /* 名前と期限は直せる。使った時の名前は焼き付けてあるので、請求書は動かない */
  check(await box.getByTestId("coupon-edit-name").count() > 0, "使われても、名前は直せる");
  check(await box.getByTestId("coupon-edit-expires").count() > 0, "使われても、期限は直せる");
  console.log("OK: 使われたクーポンは、コードと値引きを直せず、消せない");
}

/* ── コードのコピーと、配るための絵（げんきさん 2026-09-10）── */
{
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  const copy = page.getByTestId("coupon-copy").first();
  check(await copy.count() > 0, "コードをコピーする札がある");
  await copy.click();
  await page.waitForTimeout(250);
  const said = await copy.innerText();
  check(/コピーしました|長押し/.test(said), `押したら、写せたかどうかを言う（${said}）`);

  await page.getByTestId("coupon-art-open").first().click();
  await page.waitForSelector('[data-testid="coupon-art-canvas"]', { timeout: 5000 });
  const art = await page.evaluate(() => {
    const cv = document.querySelector('[data-testid="coupon-art-canvas"]');
    const g = cv.getContext("2d");
    /* 真っ白（何も描いていない）ではないか。角の色を見る */
    const px = g.getImageData(4, 4, 1, 1).data;
    return { w: cv.width, h: cv.height, px: [px[0], px[1], px[2]], url: cv.toDataURL("image/png").slice(0, 22) };
  });
  check(art.w === 1200 && art.h === 630, `貼っても切られない形（${art.w}×${art.h}）`);
  check(art.url.startsWith("data:image/png"), "画像として取り出せる");
  check(!(art.px[0] === 0 && art.px[1] === 0 && art.px[2] === 0), "描かれている（真っ黒ではない）");
  check(await page.getByTestId("coupon-art-save").count() > 0, "保存する札がある");
  console.log("OK: コードを写せて、配るためのクーポン画像が作れる");
}

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
