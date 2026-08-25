/* 講座（特別教育）の一覧。

   足場だけでなく、これから何種類も増やしていく。
   増やすときは、教材の json を content/courses/ に置いて、
   ここに1行足すだけで済むようにしてある。

   id は URL とデータベースの単元IDに使う。短い英字にすること
   （データベースの単元IDは "id:単元番号"。例 ashiba:1-1）。

   画面からもサーバからも読むので、ここは何にも依存しない。 */

export type CourseMeta = {
  /** URL とデータベースで使う目印。あとから変えない */
  id: string;
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
    name: "足場の組立て等の業務に係る特別教育",
    short: "足場の組立て等",
    basis: "労働安全衛生法第59条第3項／労働安全衛生規則第36条第39号",
    totalMin: 360,
    file: "ashiba.json",
    ready: true,
  },
];

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
