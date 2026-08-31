/* はじめて使う人への案内。

   画面ごとの案内（「会社とつなぐ」「許可待ち」）は、もうホームに出ている。
   ただ、あれは**次の一手**しか言わない。
   初めての人には、それだと

     ・全部で何段階あるのか
     ・いま自分がどのへんに居るのか
     ・あと何が残っているのか

   が分からない。「会社とつなぐ」を押したあと、許可を待つあいだに
   「これで終わりなのか、まだ何かあるのか」が読めず、そこで止まる。

   だから、道のり全部を並べて、いまどこかを印す。

   ── 出す相手 ──
   立場で道が違うので分ける。
     ・教育担当者 … 人数ぶん買って、配って、許可を出す側
     ・受講する人 … つないで、許可をもらって、受ける側

   ── いつ消すか ──
   受講できるようになったら消す（canLearn）。
   そこから先は講座の画面が進み具合を出すので、ホームにも出すと二重になる。
   済んだ人に案内を出し続けると、次からは読まれなくなる。 */

export type StepState = "done" | "now" | "todo";

export type Step = {
  /** 見出し */
  t: string;
  /** ひとこと説明。なぜ要るかが分かるように */
  d: string;
  state: StepState;
  /** その場でやれるなら、行き先 */
  href?: string;
};

export type Who = {
  admin: boolean;
  member: "none" | "pending" | "active";
  canLearn: boolean;
  company: string;
};

/** 案内を出すか。受講できるようになったら出さない */
export const showGuide = (me: Who | null): boolean => !!me && !me.canLearn;

/* 段どりに印を付ける。いま居る所より前は done、そこが now、あとは todo。
   now が2つあると、どちらをやればいいのか分からない */
const mark = (steps: Omit<Step, "state">[], at: number): Step[] =>
  steps.map((s, i) => ({
    ...s,
    state: i < at ? "done" : i === at ? "now" : "todo",
  }));

/** 受講する人の道のり */
export function learnerSteps(me: Who): Step[] {
  const steps: Omit<Step, "state">[] = [
    { t: "登録する", d: "氏名とメールで登録します。氏名は修了証に載ります" },
    {
      t: "会社とつなぐ",
      d: "自分の会社をさがして申し込みます。つながっていないと名簿に載らず、修了証も出せません",
      href: "/join",
    },
    {
      t: "会社の許可を待つ",
      d: "会社の教育担当者が許可すると、名簿に入ります。急ぐときは担当者にひとこと言ってください",
      href: "/join",
    },
    {
      t: "受講の準備",
      d: "カメラの使用に同意して、顔を1枚登録します。受講中に本人確認をするためです",
    },
    { t: "学科を受ける", d: "単元ごとに、決まった時間を見て確認問題に受かります" },
    { t: "修了試験", d: "全単元を終えると受けられます" },
    { t: "修了証", d: "討議のある講座は、討議を終えてから出ます" },
  ];

  /* いまどこか。登録は済んでいる（この案内はログインしている人にしか出ない） */
  let at = 1;
  if (me.member === "pending") at = 2;
  if (me.member === "active") at = 3;
  /* 在籍していても受講コードが要る場合がある。
     そのときは「準備」ではなく、まだ手前で止まっている */
  if (me.member === "active" && !me.canLearn) {
    steps[3] = {
      t: "受講できるようにする",
      d: "受講コード（12文字）を入れます。会社の教育担当者から受け取ってください",
      href: "/join",
    };
  }
  return mark(steps, at);
}

/** 教育担当者の道のり */
export function adminSteps(me: Who): Step[] {
  const steps: Omit<Step, "state">[] = [
    { t: "事業者を登録する", d: `${me.company || "自社"}の登録は済んでいます` },
    {
      t: "受講コードを申し込む",
      d: "受ける人数ぶん申し込みます。お振込みの確認後に発行されます",
      href: "/admin",
    },
    {
      t: "参加コードを配る",
      d: "受ける人に登録してもらい、8文字の参加コードで自社に申し込んでもらいます",
      href: "/admin",
    },
    {
      t: "申し込みを許可する",
      d: "**ここを忘れると教材が開きません。**申し込んだだけの人は名簿に入りません",
      href: "/admin",
    },
    { t: "受講コードを渡す", d: "1人に1つ。渡した人から学科が開きます", href: "/admin" },
    { t: "進み具合を見る", d: "誰がどこまで進んだか、修了証が出たかを見られます", href: "/admin" },
  ];
  return mark(steps, 1);
}

/** その人に出す道のり。
    見出しと添え書きも、道のりと一緒にここから出す。
    画面側に置くと、立場で出し分けたときに片方だけ直し忘れる
    （担当者の画面に「修了証が出るまでの道のり」と出ていた） */
export function guideFor(me: Who): { title: string; lead: string; steps: Step[] } {
  return me.admin
    ? {
        title: "教育担当者のはじめかた",
        lead: "受けてもらえるようになるまでの道のり",
        steps: adminSteps(me),
      }
    : {
        title: "はじめての方へ",
        lead: "修了証が出るまでの道のり",
        steps: learnerSteps(me),
      };
}

/** いまやること。1つだけ */
export const nowStep = (steps: Step[]): Step | null =>
  steps.find((s) => s.state === "now") ?? null;
