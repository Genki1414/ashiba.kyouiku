/* 店の名前と表紙。

   同じ中身を、二つの店で売る。

     足場屋革命          … 足場屋さん向け。特別教育・職長教育＋実務トレーニング
     特別教育ドットコム  … それ以外の業種向け。特別教育・職長教育だけ

   **足場屋革命が正。** 講座も、席も、修了証も、migration も一つ。
   ここで変わるのは、名前と表紙と、実務トレーニングを出すかどうかだけ。
   分けているのは売り先であって、中身ではない。

   ── なぜ複製しないか ──
   アプリごと複製すると、講座を1本足すたび、法令が変わるたび、
   画面を1か所直すたびに、二回ずつやることになる。必ず片方が古くなる。
   （実際、「その他特別教育」の探す窓を上に出したとき、
     同じ物が2か所にあったせいでホームだけ直し忘れた）

   ── どちらの店かの決め方 ──
   環境変数 NEXT_PUBLIC_BRAND。デプロイごとに決める。
   **書かなければ足場屋革命。** いまの本番は何も足さなくてよい。
   秘密ではないので NEXT_PUBLIC_ で構わない（画面にそのまま出る文字）。 */

export type BrandId = "ashibaya" | "tokubetsu";

export type Brand = {
  id: BrandId;
  /** 画面の見出しと、ログイン画面に出る名前 */
  name: string;
  /** ホーム画面に付くときの短い名前。11文字くらいまで */
  shortName: string;
  /** 見出しの上に出る小さい英字 */
  eyebrow: string;
  /** 表紙の一言。2行 */
  lead: [string, string];
  /** タブと検索に出る題 */
  title: string;
  /** PWA の説明（ホーム画面に足すときに出る） */
  description: string;
  /** 検索とリンクの説明（<meta name="description">） */
  metaDescription: string;
  /** ホーム画面に追加するときの正式な名前（manifest の name）。
      アイコンの下に出るのは shortName のほう */
  manifestName: string;
  /** ログインのメールの差出人。受信箱にこう出る */
  mailFrom: string;
  /** 知らせの頭。【 】で囲う */
  notifyPrefix: string;
  /** 実務トレーニング（足場を組むゲーム）を出すか。
      足場屋さん以外には要らない */
  training: boolean;
  /** 講座を、大きな札で並べずに、探す窓ひとつの一覧にするか。

      足場屋革命は足場と職長を大きく出して、残りを「その他」に畳む。
      特別教育ドットコムは業種を選ばないので、**足場も含めて**
      73講座を平らに並べ、探す窓で選んでもらう。
      どれかを上に置くと、その業種の人以外には邪魔になる */
  flatList: boolean;
  /** この店の本番の住所（`https://…`、末尾の / なし）。

      合言葉の決め直しのメールと、LINE の知らせのリンクが、ここへ戻る。
      **決まっていない店は空。**空のときは、いま開いている住所を使う。

      ここを空にできるようにしたのは、**よその店の住所へ飛ばさない**ため。
      前は src/lib/siteUrl.ts に足場屋革命の住所が1つ書いてあるだけで、
      特別教育ドットコムで合言葉を決め直すと、メールのリンクが
      **足場屋革命へ飛んでいた**（2026-09-08 に見つけた）。

      NEXT_PUBLIC_SITE_URL を入れれば、そちらが勝つ。 */
  site: string;
};

const ASHIBAYA: Brand = {
  id: "ashibaya",
  name: "足場屋革命",
  shortName: "足場屋革命",
  eyebrow: "ASHIBAYA KAKUMEI",
  lead: [
    "特別教育・職長教育と、実務トレーニング。",
    "労働安全衛生法にもとづく学科と、組む手順の練習。",
  ],
  title: "足場屋革命｜特別教育・職長教育と実務トレーニング",
  manifestName: "足場屋革命｜足場の特別教育と実務トレーニング",
  description:
    "足場の組立て等の業務に係る特別教育（学科6時間）と、組む手順を覚える実務トレーニング",
  metaDescription:
    "足場の組立て等の業務に係る特別教育（学科6時間）、職長・安全衛生責任者教育（14時間）、そして組む手順を覚える実務トレーニング",
  mailFrom: "足場屋革命 <noreply@ashibase.jp>",
  notifyPrefix: "足場屋革命",
  training: true,
  flatList: false,
  site: "https://kyouiku.ashibase.jp",
};

const TOKUBETSU: Brand = {
  id: "tokubetsu",
  name: "特別教育ドットコム",
  /* ホーム画面に出る名前。**長い名前の一部にすること。**
     前は「特別教育.com」にしていたが、正式な名前は「特別教育ドットコム」で、
     ホーム画面のアイコンの下だけ別の綴りになっていた。
     押した人が「これは何のアプリだったか」と迷う（2026-09-08、
     本番の作りでしか出ないので tests/e2e-pwa.mjs で見つけた）。 */
  shortName: "特別教育ドットコム",
  eyebrow: "TOKUBETSU KYOIKU .COM",
  lead: [
    "特別教育と、職長・安全衛生責任者教育。",
    "労働安全衛生法にもとづく学科を、スマホで。",
  ],
  title: "特別教育ドットコム｜特別教育・職長教育",
  manifestName: "特別教育ドットコム｜特別教育・職長教育",
  description: "労働安全衛生法にもとづく特別教育と、職長・安全衛生責任者教育",
  metaDescription:
    "労働安全衛生法で定められた特別教育と、職長・安全衛生責任者教育（14時間）。業種を問わず、スマホで学科を受けられます",
  /* 差出人の住所は ashibase.jp のまま。ドメインを増やすと
     送信の認証（SPF・DKIM）をもう一度通すことになる。
     名前だけ変える。届かないより、名前が違うほうがまし */
  mailFrom: "特別教育ドットコム <noreply@ashibase.jp>",
  notifyPrefix: "特別教育ドットコム",
  training: false,
  flatList: true,
  /* この店の本番の住所（げんきさんが取得。2026-09-09）。

     **ここと合わせる所が2つある。**
       ・Vercel（tokubetsu-kyouiku）の NEXT_PUBLIC_SITE_URL と SITE_URL
       ・Supabase の許した戻り先（Redirect URLs）に https://…/**
     どれかが欠けると、パスワード再設定のメールから戻ってきた人が弾かれる。
     入れたあとは Redeploy が要る（NEXT_PUBLIC_ は組み立てるときに焼き付く）。

     **www を付ける。**Vercel では www.tokubetsu-kyouiku.com が本番で、
     tokubetsu-kyouiku.com（apex）は www へ 308 で転送する形にしてある
     （げんきさんの登録。2026-09-09）。ここを apex にすると、
     パスワード再設定のリンクが1回転送されてから届くことになる。
     **実際に人が開く住所と、同じものを書く。**
     末尾に / は付けない（つなぐと // になる）。 */
  site: "https://www.tokubetsu-kyouiku.com",
};

const ALL: Record<BrandId, Brand> = { ashibaya: ASHIBAYA, tokubetsu: TOKUBETSU };

/** いまの店。書いていなければ足場屋革命 */
export const BRAND: Brand =
  ALL[(process.env.NEXT_PUBLIC_BRAND ?? "").trim() as BrandId] ?? ASHIBAYA;

/** 店の一覧。見張りが両方を見るために使う */
export const BRANDS: Brand[] = [ASHIBAYA, TOKUBETSU];

/** 足場屋さん向けの店か */
export const isAshibaya = (): boolean => BRAND.id === "ashibaya";
