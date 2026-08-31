/* 売るために要る表記の中身。

   特定商取引法に基づく表記は、住所や電話番号まで載せる決まりです。

   もとは全部を Vercel の環境変数から取っていましたが、
   **入れ忘れると「未設定」と出たまま売ることになり、表示義務を満たしません。**
   ここに載るのは、刷って配る紙にも載せる公開情報です
   （振込先・修了証の名義と同じ扱い。src/lib/issuer.ts）。
   隠す意味が無いので、決まっているものは直接書きます。
   環境変数を入れれば、そちらが勝ちます。

   まだ埋まっていない項目は画面に「未設定」と出ます。
   /setup でも、どれが空かが分かります。 */

import { TAX_RATE } from "@/lib/pricing";

export type Item = { k: string; v: string; env: string; note?: string };

const get = (name: string, fallback = "") => (process.env[name] ?? "").trim() || fallback;

/** 事業者の情報。特商法・利用規約・個人情報の3ページで使う */
export function seller() {
  return {
    name: get("SELLER_NAME", "東北三上機材株式会社"),
    /** 会社の代表者。**教育実施責任者（中川元基）とは別**。
        登記上の代表者なので、勝手に埋めない。
        ここが空だと特商法の表示義務を満たしません */
    ceo: get("SELLER_CEO"),
    address: get("SELLER_ADDRESS", "宮城県名取市牛野八幡23"),
    tel: get("SELLER_TEL", "022-738-7913"),
    email: get("SELLER_EMAIL", "info@tohoku-mikamikizai.co.jp"),
    /** 電話を受けられる時間 */
    hours: get("SELLER_HOURS", "平日 9:00〜17:00（土日祝を除く）"),
    /** 問い合わせ窓口の名前 */
    contact: get("SELLER_CONTACT", "教育事業担当"),
    /** 適格請求書発行事業者の登録番号（T＋13桁）。
        課税事業者なら、請求書に載せないと相手が仕入税額控除を受けられない。
        免税事業者なら番号そのものが無いので、空のままでよい */
    invoiceNo: tidyInvoice(get("SELLER_INVOICE_NO")),
    /* 振込先。請求書に載せる。
       ここが空だと、請求書を受け取った人が払えない。

       秘密ではない（請求書に刷って送るもの）ので、ここに書いてある。
       修了証の名義（src/lib/issuer.ts）と同じ扱い。
       口座を変えたら、この5行を直すか、環境変数で上書きする。 */
    bank: {
      name: get("SELLER_BANK_NAME", "GMOあおぞらネット銀行"),
      branch: get("SELLER_BANK_BRANCH", "法人営業部"),
      kind: get("SELLER_BANK_KIND", "普通"),
      no: get("SELLER_BANK_NO", "1400601"),
      holder: get("SELLER_BANK_HOLDER", "トウホクミカミキザイ（カ"),
    },
  };
}

/** 振込先がそろっているか。1つでも欠けたら請求書に出さない
    （中途半端に出す方が、間違えて振り込まれるので危ない） */
export function bankReady(b: {
  name: string;
  branch: string;
  no: string;
  holder: string;
}): boolean {
  return !!(b.name && b.branch && b.no && b.holder);
}

/* 登録番号の打ち方をそろえる。

   国税庁の通知は「T1234567890123」だが、
   人はハイフンや空白を入れて写すし、全角で入ることもある。
   打ち方の揺れで「形が違います」と断ると、直しようが分からない。
   請求書に載る形（T＋13桁）に寄せてから見る。

   ただし **T を勝手に足さない**。13桁だけ入っていても補わない。
   法人番号は登録していなくても誰にでもあるので、補うと
   「登録していない事業者の番号」を登録番号として請求書に載せてしまう。
   足りないなら、足りないと言う方がよい。 */
export function tidyInvoice(v: string): string {
  const half = v
    /* 全角の英数字とハイフンを半角へ */
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－ー−―‐]/g, "-")
    /* 区切りとして入れられがちなものを落とす */
    .replace(/[\s　.．,，-]/g, "")
    .trim();
  /* 小文字の t で写す人がいる */
  return half.replace(/^t/, "T");
}

/** 登録番号の形。T のあとに13桁。空は「登録していない」で正しいので通す */
export const invoiceOk = (v: string): boolean => !v || /^T\d{13}$/.test(tidyInvoice(v));

/** 「未設定」の項目。ここが空のまま売ると、特商法の表示義務を満たしません */
export function missingSeller(): string[] {
  const s = seller();
  const need: [string, string][] = [
    ["代表者", s.ceo],
    ["所在地", s.address],
    ["電話番号", s.tel],
    ["メールアドレス", s.email],
  ];
  return need.filter(([, v]) => !v).map(([k]) => k);
}

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

/** 講座ごとの値段。特定商取引法の表記に載せる形 */
export type CoursePrice = { id: string; name: string; price: number };

/** 「受講1名につき 5,000円（税抜）／5,500円（税込）」 */
const priceLine = (price: number): string => {
  const tax = Math.floor(price * TAX_RATE);
  return `${yen(price)}（税抜）／${yen(price + tax)}（税込）`;
};

/** 特定商取引法に基づく表記。順番も決まりに沿って並べる。
    単価はサーバから渡す（環境変数を読むのは src/lib/price.server.ts だけ）。

    講座ごとに値段が違うので、受けられる講座を全部並べる。
    1つしか載せないと、載っていない講座の値段が書いていないことになる。 */
export function tokushoho(prices: CoursePrice[]): Item[] {
  const s = seller();
  const list = prices.length ? prices : [{ id: "", name: "受講", price: 0 }];
  return [
    { k: "販売事業者", v: s.name, env: "SELLER_NAME" },
    { k: "代表者", v: s.ceo, env: "SELLER_CEO" },
    { k: "所在地", v: s.address, env: "SELLER_ADDRESS" },
    { k: "電話番号", v: s.tel, env: "SELLER_TEL", note: `受付時間 ${s.hours}` },
    { k: "メールアドレス", v: s.email, env: "SELLER_EMAIL" },
    /* 登録していない（免税事業者）なら、そもそも番号が無い。
       空のときは行ごと出さない。「未設定」と出すと、
       登録し忘れているように見えてしまう */
    ...(s.invoiceNo
      ? [
          {
            k: "適格請求書発行事業者 登録番号",
            v: s.invoiceNo,
            env: "SELLER_INVOICE_NO",
            note: "請求書にもこの番号を記載します。",
          },
        ]
      : []),
    {
      k: "販売価格",
      v: list.map((c) => `${c.name}　受講1名につき ${priceLine(c.price)}`).join("\n"),
      env: "SEAT_UNIT_PRICE",
      note: "申込みの画面に、人数を入れた合計金額を出します。",
    },
    {
      k: "商品代金以外の必要料金",
      v: "インターネットの通信料はお客様のご負担です。銀行振込の手数料はお客様のご負担です。",
      env: "",
    },
    {
      k: "支払方法",
      v: "銀行振込（請求書払い）",
      env: "",
      /* 振込先は請求書にも載るが、買う前に見えている方が親切。
         そろっていないうちは書かない（中途半端に出す方が危ない） */
      ...(bankReady(s.bank)
        ? {
            note: `振込先　${s.bank.name} ${s.bank.branch} ${s.bank.kind} ${s.bank.no} ${s.bank.holder}`,
          }
        : {}),
    },
    {
      k: "支払時期",
      v:
        "前払いです。お申込み後にお送りする請求書の振込先へ、お振込みください。" +
        "支払期限は定めていません。お振込みの確認後に、受講コードを発行します。",
      env: "",
    },
    {
      k: "引渡し時期",
      v:
        "お振込みの確認後、受講コードを発行します。確認は営業日に行うため、" +
        "お振込みから発行まで数日いただく場合があります。" +
        "受講コードをお渡しした時点で、受講を始められます。",
      env: "",
    },
    {
      k: "返品・キャンセル",
      v:
        "受講コードの性質上、発行後の返品・返金はお受けできません。" +
        "お振込み前であれば、申込みの取消を承ります。" +
        "誤って申し込んだ場合は、上記の連絡先までご連絡ください。",
      env: "",
    },
    {
      k: "動作環境",
      v: "スマートフォン・タブレット・パソコンの最新のブラウザ。受講中に顔の照合を行うため、カメラの使えるものをお使いください。",
      env: "",
    },
  ];
}

/** 個人情報の扱いで挙げる、実際に預かるもの。コードと突き合わせて書いてある */
export const PERSONAL_DATA: { k: string; v: string }[] = [
  { k: "氏名・生年月日", v: "修了証に載せるため。ご本人が入力します" },
  { k: "メールアドレス", v: "ログインのため" },
  { k: "所属事業者", v: "名簿を分けるため" },
  { k: "学科の視聴記録", v: "単元ごとの視聴時間と、確認問題に合格した日時" },
  { k: "修了試験の記録", v: "点数と合否、受験した日時" },
  { k: "実務トレーニングの記録", v: "章ごとの点数・所要時間と、指摘された内容" },
  { k: "顔の照合の記録", v: "「照合できた／できなかった」という結果と理由だけ" },
  { k: "修了証の記録", v: "証明番号と発行日、取り消した日" },
  { k: "申込みの記録", v: "人数・金額・支払方法・請求先" },
];

/** 外部に渡るもの */
export const THIRD_PARTIES: { k: string; v: string }[] = [
  { k: "Supabase", v: "記録の保管とログイン（データベース）" },
  { k: "Vercel", v: "画面の配信" },
  { k: "Stripe", v: "クレジットカードの決済。カード番号は当社を通りません" },
];
