/* 講座（特別教育）の一覧。

   足場だけでなく、これから何種類も増やしていく。
   増やすときは、教材の json を content/courses/ に置いて、
   ここに1行足すだけで済むようにしてある。

   id は URL とデータベースの単元IDに使う。短い英字にすること
   （データベースの単元IDは "id:単元番号"。例 ashiba:1-1）。

   画面からもサーバからも読むので、ここは何にも依存しない。 */

/* 教育の種類。

   特別教育（安衛法59条3項）と職長教育（安衛法60条）は別の制度で、
   修了証の表題も「〜を修了したことを証する」の文も違う。
   決め打ちにしていたので、講座から出すようにした。

   職長教育には討議（グループ演習）の要る科目がある。
   この仕組みでは**オンラインの同時双方向**でやる決めにしてある
   （docs/17-職長教育.md）。 */
export type CourseKind = "special" | "foreman";

/* 講座の進み方。職長教育だけに書き込まず、共通の土台にしておく。
   これから「討議・演習が要る教育」を足すときに、同じ仕組みが使える。

   ondemand … 各自がいつでも。特別教育はこれ
   live     … 決まった日時に集まるだけ
   hybrid   … 各自で学ぶ ＋ 決まった日時の討議。職長教育はこれ */
export type CourseType = "ondemand" | "live" | "hybrid";

/* 学科を見終わったあとに残る関門。

   学科だけで修了する講座（足場の特別教育など）は、条件を満たせば
   その場で修了証を出してよい。しかし、学科のあとに何かが残る講座は、
   押した瞬間に紙が出てはいけない。まだ修了していないからです。

   talk  … こちらが討議（オンラインの同時双方向）を行う。
           学科が終わった人が発行申請を出し、**こちらが候補日を提示**する。
           本人が選んだ日に討議をやって、そこではじめて修了になる。
           先に回を立てておく作りだと、立てるまで誰も申し込めない。

   drill … 実技。事業者が自社で行う。
           済んでから発行申請を出してもらい、実施日と実施者を控える。
           候補日は要らない（日を決めるのはこちらではない）。

   書かなければ関門なし＝学科だけで修了。 */
export type CourseGate = "talk" | "drill";

/** 種類ごとの言い方。画面と修了証で共通に使う */
export const KIND_TEXT: Record<CourseKind, { label: string; certTitle: string; certLine: string }> = {
  special: {
    label: "特別教育（学科）",
    certTitle: "特 別 教 育 修 了 証",
    certLine: "特別教育を修了したことを証する。",
  },
  foreman: {
    label: "職長教育",
    certTitle: "職 長 教 育 修 了 証",
    certLine: "職長教育を修了したことを証する。",
  },
};

export type CourseMeta = {
  /** URL とデータベースで使う目印。あとから変えない */
  id: string;
  /** 教育の種類。書かなければ特別教育 */
  kind?: CourseKind;
  /** 進み方。書かなければ各自でいつでも（ondemand） */
  type?: CourseType;
  /** 学科のあとに残る関門。書かなければ無し（学科だけで修了） */
  gate?: CourseGate;
  /** 正式名称。修了証に載る */
  name: string;
  /** 画面で使う短い呼び名 */
  short: string;
  /** 法令の根拠 */
  basis: string;
  /** 学科の法定時間（分） */
  totalMin: number;
  /** 教材の json（content/courses/ の中） */
  file: string;
  /** 受講できるか。教材がまだなら false（画面には「準備中」と出る） */
  ready: boolean;
};

export const COURSES: CourseMeta[] = [
  {
    id: "ashiba",
    kind: "special",
    type: "ondemand",
    name: "足場の組立て等の業務に係る特別教育",
    short: "足場の組立て等",
    basis: "労働安全衛生法第59条第3項／労働安全衛生規則第36条第39号",
    totalMin: 360,
    file: "ashiba.json",
    ready: true,
  },
  {
    /* 職長・安全衛生責任者教育。2026年8月29日から公開。

       ・時間と科目は、令和5年4月の改正後のもの
       ・討議（グループ演習）はオンラインの同時双方向でやる
       （docs/13-講座を増やす.md／docs/17-職長教育.md／docs/20-修了証の発行申請.md） */
    id: "shokucho",
    kind: "foreman",
    /* 各自で学ぶ部分と、決まった日時に集まる討議の組み合わせ。
       録画を見せるのは討議にならない（docs/17-職長教育.md） */
    type: "hybrid",
    /* 学科を終えた人が発行申請を出す。こちらが討議の候補日を返す。
       自動では発行しない（討議が済んでいないため） */
    gate: "talk",
    name: "職長・安全衛生責任者教育",
    short: "職長・安責者",
    basis: "労働安全衛生法第60条／労働安全衛生規則第40条",
    /* 職長教育の12時間に、安全衛生責任者教育の2時間を足して14時間。
       建設業では一体で実施し、1枚の修了証を出す（src/content/shokucho.ts） */
    totalMin: 840,
    file: "shokucho.json",
    ready: true,
  },
];

/** その講座の種類。書いていなければ特別教育 */
export const kindOf = (c: CourseMeta): CourseKind => c.kind ?? "special";

/** その講座の進み方。書いていなければ各自でいつでも */
export const typeOf = (c: CourseMeta): CourseType => c.type ?? "ondemand";

/** 決まった日時に集まる回があるか（討議・演習） */
export const needsLive = (c: CourseMeta): boolean => typeOf(c) !== "ondemand";

/** 学科のあとに残る関門。無ければ null */
export const gateOf = (c: CourseMeta): CourseGate | null => c.gate ?? null;

/** 修了証を、押した瞬間に出さず、いったん申請にする講座か */
export const needsRequest = (c: CourseMeta): boolean => gateOf(c) !== null;

/** 関門ごとの言い方。画面で使う */
export const GATE_TEXT: Record<CourseGate, { label: string; what: string }> = {
  talk: {
    label: "討議",
    what: "学科のあとに、オンラインの討議があります。発行申請を出すと、こちらから候補日をお送りします。",
  },
  drill: {
    label: "実技",
    what: "学科のあとに、実技があります。実技は事業者で行い、済んでから発行申請を出してください。",
  },
};

/** その講座の言い方（画面の札・修了証の表題と文） */
export const textOf = (c: CourseMeta) => KIND_TEXT[kindOf(c)];

/** 受けられる講座だけ */
export const readyCourses = (): CourseMeta[] => COURSES.filter((c) => c.ready);

export const findCourse = (id: string | null | undefined): CourseMeta | null =>
  COURSES.find((c) => c.id === id) ?? null;

/** 講座がひとつだけか。ひとつなら一覧を挟まず、そのまま中へ通す */
export const onlyCourse = (): CourseMeta | null => {
  const list = readyCourses();
  return list.length === 1 ? list[0] : null;
};

/* 実務トレーニング（足場を組むゲーム）が付いている講座。
   いまは足場だけ。ほかの講座に実務を作ったら、ここを増やす */
export const TRAINING_COURSE = "ashiba";

/* ── データベースの単元ID ──────────────────
   単元番号（1-1）は講座ごとに重なるので、講座を頭に付けて世界で1つにする。
   ここを揃えておかないと、別の講座の 1-1 と記録が混ざる。 */

export const lessonKey = (courseId: string, lessonId: string): string =>
  `${courseId}:${lessonId}`;

/** 単元IDを講座と番号に分ける。形が違えば null */
export function splitLessonKey(key: string): { courseId: string; lessonId: string } | null {
  const i = key.indexOf(":");
  if (i <= 0 || i === key.length - 1) return null;
  return { courseId: key.slice(0, i), lessonId: key.slice(i + 1) };
}
