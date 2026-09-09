/* 複数の講座を、まとめて申し込めるか（0029）。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-order-multi.mjs

   ── なぜ差し替えるか ──
   申込みの画面は教育担当者だけが開ける。手元では Supabase につないで
   いないので、そのままでは「教育担当者だけの画面です」で止まり、
   **申込みの form が一度も描かれない。**

   ここで見たいのは画面の作りなので、口（/api/order）の返事だけ差し替える。
   本物かどうかは admin-db と order-group.sql（SQL）が見ている。

   ── 何を見るか ──
   ・3講座を選んで、講座ごとに人数を入れられるか
   ・合計が、**講座ごとの単価で足した額**になっているか
     （1つの単価で掛けると、値段の違う講座で合わない）
   ・送る中身が「講座と人数の並び」になっているか
   ・**絞り込みで隠れている選択を、見失わせないか**
     （絞ったまま押すと、画面に出ていない講座まで買うことになる）
   ・何も選んでいないうちは押せないか
   ・受講コードの一覧の「配る」で、**押したそのコード**が相手に送られるか（0031）
   ・**取得済みの人は、配る相手として押せない**か */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

/* 値段の違う講座を混ぜる。同じ値段だと、
   1つの単価で掛けても合ってしまい、間違いに気づけない */
const COURSES = [
  { id: "ashiba", short: "足場", name: "足場の組立て等の業務に係る特別教育", unitPrice: 4500 },
  { id: "shokucho", short: "職長", name: "職長・安全衛生責任者教育", unitPrice: 7000 },
  { id: "ishiwata", short: "石綿", name: "石綿使用建築物等解体等業務に係る特別教育", unitPrice: 5000 },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `x${i}`,
    short: `その他${i}`,
    name: `ならべもの${i}の業務に係る特別教育`,
    unitPrice: 4500,
  })),
];

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

/** 送られてきた申込みの中身 */
let sent = null;
/** 「配る」で送られた中身 */
let given = null;

await page.route("**/api/order", async (route) => {
  const req = route.request();
  if (req.method() === "POST") {
    sent = JSON.parse(req.postData() ?? "{}");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, orderId: "o1", groupId: "g1", method: "invoice" }),
    });
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      company: "まとめ工業",
      unitPrice: 4500,
      orders: [],
      seats: { total: 2, used: 1, paid: 2 },
      /* 受講コードの一覧。未使用が1枚、使用済みが1枚 */
      codes: [
        { code: "EQ37-AB12-CD34", orderId: "o0", status: "paid", courseId: "ashiba",
          usedBy: null, usedAt: null, expiresAt: "2027-09-09T00:00:00Z", certified: false },
        { code: "EPB7-AB12-CD34", orderId: "o0", status: "paid", courseId: "ashiba",
          usedBy: "使った 人", usedAt: "2026-09-01T00:00:00Z", expiresAt: "2027-09-09T00:00:00Z", certified: false },
      ],
      /* 在籍している人。2人目は足場を**取得済み**（配れない） */
      members: [
        { id: "u1", name: "配る 相手", held: [] },
        { id: "u2", name: "持ってる 人", held: ["ashiba"] },
      ],
      /* 届いている受講リクエストの数（講座ごと）。
         **並び順の見張りのため、上に出るはずのものを下の方に置いてある** */
      requests: { ishiwata: 2, x5: 4 },
      courses: COURSES,
    }),
  });
});
/* 「配る」の口。受け取った中身だけ覚えて、渡ったことにする */
await page.route("**/api/admin/assign", async (route) => {
  given = JSON.parse(route.request().postData() ?? "{}");
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, code: given.code ?? null }),
  });
});
/* カード払いが使えるかを聞きに行く。使えないことにする（請求書で見る） */
await page.route("**/api/stripe/checkout", (route) =>
  route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false}' }),
);

await page.goto(`${BASE}/order`);
{
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
}
await page.waitForSelector('[data-testid="order-courses"]', { timeout: 8000 });

/* ── 受講リクエストが届いていることが、ここで分かる ── */
{
  const b = page.getByTestId("order-requests");
  check((await b.count()) === 1, "「受講リクエストが届いています」が出る");
  const t = (await b.innerText()).replace(/\s/g, "");
  check(t.includes("受講リクエストが届いています"), `仕組みの名前で呼ぶ（${t.slice(0, 30)}）`);
  check(t.includes("6件"), `合計の件数が出る（${t.slice(0, 40)}）`);

  /* **講座ごとの件数。**合計だけだと、どの講座に何人ぶん要るのか分からない */
  const badges = page.getByTestId("order-course-req");
  check((await badges.count()) === 2, `リクエストのある講座にだけ札が付く（${await badges.count()}）`);
  const texts = (await badges.allInnerTexts()).map((x) => x.replace(/\s/g, ""));
  check(texts.includes("リクエスト4件") && texts.includes("リクエスト2件"),
    `講座ごとの件数が出る（${texts.join("・")}）`);

  /* **リクエストのある講座が上に出る。**73本あるので、下に埋もれると
     札を付けても見えない。多い順 */
  const rows = page.locator('[data-testid="order-course"]');
  const first = await rows.nth(0).innerText();
  const second = await rows.nth(1).innerText();
  check(first.includes("ならべもの5"), `いちばん多い講座が先頭（${first.split("\n")[0]}）`);
  check(second.includes("石綿"), `次に多い講座が2番目（${second.split("\n")[0]}）`);
  /* 送られていない講座には札を付けない */
  const third = await rows.nth(2).innerText();
  check(!third.includes("リクエスト"), "リクエストの無い講座に札は付かない");
  console.log("OK: 受講リクエストが、合計と講座ごとに出る");
}

/* ── はじめは何も選んでいない ── */
check((await page.getByTestId("order-none").count()) === 1, "はじめは「講座を選んでください」と出る");
check(await page.getByTestId("order-invoice").isDisabled(), "何も選んでいないうちは押せない");
check((await page.getByTestId("order-quote").count()) === 0, "選ぶ前は金額を出さない");

/* ── 3講座を選ぶ ── */
const pick = async (name, seats) => {
  const row = page.locator('[data-testid="order-course"]', { hasText: name });
  await row.getByTestId("order-course-pick").click();
  await row.getByTestId("order-seats-input").fill(String(seats));
  await page.waitForTimeout(80);
};
await pick("足場の組立て等", 5);
await pick("職長・安全衛生責任者教育", 3);
await pick("石綿使用建築物等", 2);

check(!(await page.getByTestId("order-invoice").isDisabled()), "選べば押せる");

/* ── リクエストのある講座を押すと、その人数が入る ── */
{
  const row = page.locator('[data-testid="order-course"]', { hasText: "ならべもの5" });
  await row.getByTestId("order-course-pick").click();
  await page.waitForTimeout(100);
  const v = await row.getByTestId("order-seats-input").inputValue();
  check(v === "4", `リクエストの数がそのまま入る（${v}）`);
  /* あとから直せる。押さえつけない */
  await row.getByTestId("order-seats-input").fill("6");
  await page.waitForTimeout(80);
  check((await row.getByTestId("order-seats-input").inputValue()) === "6", "あとから直せる");
  /* 片づける（このあとの合計を狂わせない） */
  await row.getByTestId("order-course-pick").click();
  await page.waitForTimeout(80);
  console.log("OK: リクエストのある講座は、その人数で入る");
}
const money = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");

/* 足場 5×4,500＝22,500／職長 3×7,000＝21,000／石綿 2×5,000＝10,000
   小計 53,500 ／ 税 5,350 ／ 合計 58,850 */
check(money.includes("53,500"), `小計が講座ごとの単価で足されている（${money.slice(0, 80)}）`);
check(money.includes("58,850"), "合計（税込）が出る");
check(money.includes("3講座") && money.includes("10名"), "何講座・何名かが出る");
await page.screenshot({ path: `${process.env.SC ?? "."}/order-multi-01.png` });

/* ── 絞り込みで隠れても、選択を見失わせない ── */
await page.getByTestId("order-filter").fill("石綿");
await page.waitForTimeout(120);
const hidden = await page.getByTestId("order-hidden").count();
check(hidden === 1, "絞り込みで隠れている選択を知らせる");
const hiddenText = hidden ? await page.getByTestId("order-hidden").innerText() : "";
check(hiddenText.includes("足場") && hiddenText.includes("職長"),
  `隠れている講座の名前と人数を出す（${hiddenText.replace(/\s+/g, " ")}）`);
/* 絞っても合計は変わらない。変わると、隠れたぶんが消えたように見える */
const money2 = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
check(money2.includes("58,850"), "絞り込んでも合計は変わらない");
await page.getByTestId("order-filter").fill("");
await page.waitForTimeout(120);

/* ── 送る中身 ── */
await page.getByTestId("order-invoice").click();
await page.waitForTimeout(400);
check(!!sent, "申込みが送られた");
check(Array.isArray(sent?.items) && sent.items.length === 3, `講座と人数の並びで送る（${JSON.stringify(sent?.items)}）`);
const byId = Object.fromEntries((sent?.items ?? []).map((i) => [i.courseId, i.seats]));
check(byId.ashiba === 5 && byId.shokucho === 3 && byId.ishiwata === 2, "講座ごとの人数がそのまま乗る");
/* 金額は送らない。送ると、画面の額で請求できてしまう */
check(!("amount" in (sent ?? {})) && !("total" in (sent ?? {})), "金額は送らない（サーバが計算する）");
check(sent?.method === "invoice", "払い方が乗る");

/* 送ったあとは選択が空に戻る。残すと、押し直しで二重に申し込む */
await page.waitForTimeout(300);
check((await page.getByTestId("order-quote").count()) === 0, "送ったら選択が空に戻る");
console.log("OK: 3講座をまとめて申し込める");

/* ── 受講コードの一覧から、その人に配る（0031）── */
{
  /* 受講コードは畳んである。開けてから配る */
  await page.getByTestId("order-codes-open").click();
  await page.waitForTimeout(200);
  const cards = page.getByTestId("order-code");
  check((await cards.count()) === 2, `受講コードが並ぶ（${await cards.count()}）`);
  /* 「配る」は未使用の札にだけ。使用済みには出ない */
  const gives = page.getByTestId("order-code-give");
  check((await gives.count()) === 1, `「配る」は未使用の札にだけ出る（${await gives.count()}）`);
  await gives.first().click();
  await page.waitForTimeout(120);
  check((await page.getByTestId("order-code-give-to").count()) === 1, "押すと、誰に配るかを選ぶ所が開く");

  /* **取得済みの人は押せない。**名前は出す（居ないと「あの人が無い」になる） */
  const heldOpt = page.getByTestId("order-code-give-held");
  check((await heldOpt.count()) === 1, "取得済みの人が1人いる");
  check(await heldOpt.first().isDisabled(), "取得済みの人は押せない");
  const heldText = (await heldOpt.first().innerText()).replace(/\s/g, "");
  check(heldText.includes("取得済"), `取得済みだと分かる（${heldText}）`);

  /* 選ぶまでは押せない */
  check(await page.getByTestId("order-code-give-go").isDisabled(), "相手を選ぶまで押せない");
  await page.getByTestId("order-code-give-select").selectOption("u1");
  await page.waitForTimeout(80);
  await page.getByTestId("order-code-give-go").click();
  await page.waitForTimeout(400);

  check(!!given, "配るが送られた");
  /* **押したそのコード**が渡る。自動で別の1枚を選ばせない */
  check(given?.code === "EQ37-AB12-CD34", `押したそのコードを送る（${given?.code}）`);
  check(given?.userId === "u1" && given?.courseId === "ashiba", "誰に・どの講座かが乗る");
  const note = (await page.getByTestId("order-code-note").innerText()).replace(/\s/g, "");
  check(note.includes("配布しました") && note.includes("配る相手"), `配ったことと相手が出る（${note.slice(0, 40)}）`);
  check(note.includes("通知"), "本人に通知が届くと出る");
  console.log("OK: 受講コードを指して、その人に配れる（取得済みの人には配れない）");
}

/* ── 講座を渡されたら、それを選んだ状態で開く（導線）── */
sent = null;
await page.goto(`${BASE}/order?courseId=ishiwata&seats=4`);
await page.waitForSelector('[data-testid="order-courses"]', { timeout: 8000 });
const one = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
check(one.includes("石綿") && one.includes("4名"), `渡された講座と人数で開く（${one.slice(0, 60)}）`);
check(!one.includes("足場") && !one.includes("職長"), "渡していない講座は選ばない");
console.log("OK: 講座を渡すと、それを選んだ状態で開く");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
