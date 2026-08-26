/* 資格の一覧（選ぶ元）。

   足場の職人が持っているものは、この仕組みの外で取ったものが多い。
   前の会社で受けた特別教育、教習機関で取った技能講習、免許。
   それを自分で選んで足せるようにする。

   なぜ要るか。
   特別教育は「その業務に就かせる前に」行う決まりで、
   すでに受けている人に受け直させる決まりではない。
   ただ、事業者は「受けている」ことを確かめないと就かせられない。
   入ってきた人が何を持っているのかが分からないと、
   受講コードを無駄に買うか、持っていない人を現場に出すことになる。

   ここに並ぶのは自己申告。修了証の現物は会社が見る（confirmed_at）。

   ── 特別教育（SE-001〜）について ──
   安衛則第36条の各号にあたるもの。学科と実技の時間、実技が要るかどうかも
   持たせてある。実技が要るものは、この仕組み（画面だけ）では完結しない。
   これから講座を増やしていくときの見取り図にもなる。

   画面にもデータベースにも触らない、ただの並び。
   **id は変えないこと**（変えると、すでに足した人のものが行方不明になる）。 */

export type QualKind = "特別教育" | "その他";

export type Qual = {
  /** 変えない目印。特別教育は SE-001 のような番号 */
  id: string;
  /** 英字の見出し。並べ替えや URL に使えるように持っておく */
  slug: string;
  /** 画面に出す名前。法令の呼び方に寄せる */
  name: string;
  kind: QualKind;
  /** 学科の時間 */
  theoryH?: number;
  /** 実技の時間。0 なら学科だけで済む */
  practicalH?: number;
  /** 実技が要るか。要るものは画面だけでは終わらない */
  practical?: boolean;
  /** いつから要るようになったか。古いものは決まっていない */
  from?: string | null;
  /** この仕組みで受けられる講座があるなら、その id */
  courseId?: string;
  /** 根拠。ほとんど同じなので、違うものだけ書く */
  basis?: string;
};

/* 特別教育の根拠。ほぼ全部これ */
export const SE_BASIS =
  "労働安全衛生法第59条第3項、労働安全衛生規則第36条および安全衛生特別教育規程等（各業務に適用される個別規程を含む）";

/* [番号, 見出し, 名前, 学科, 実技, いつから] 
   実技が0なら学科だけ（ONLINE_ONLY）。合計は学科＋実技 */
const SE: [string, string, string, number, number, string | null][] = [
  ["SE-001", "machine-grinding-wheel-replacement", "機械研削用といしの取替え・試運転", 7, 3, null],
  ["SE-002", "freehand-grinding-wheel-replacement", "自由研削用といしの取替え・試運転", 4, 2, null],
  ["SE-003", "power-press-die-handling", "動力プレスの金型等の取付け・取外し・調整", 8, 2, null],
  ["SE-004", "arc-welding", "アーク溶接等", 11, 10, null],
  ["SE-005", "high-voltage-electrical-work", "高圧・特別高圧電気取扱", 11, 15, null],
  ["SE-006", "low-voltage-electrical-work", "低圧電気取扱", 7, 7, null],
  ["SE-007", "electric-vehicle-maintenance", "電気自動車等の整備", 6, 1, null],
  ["SE-008", "forklift-under-1t", "1t未満フォークリフト運転", 6, 6, null],
  ["SE-009", "shovel-loader-under-1t", "1t未満ショベルローダー・フォークローダー運転", 6, 6, null],
  ["SE-010", "rough-terrain-carrier-under-1t", "1t未満不整地運搬車運転", 6, 6, null],
  ["SE-011", "tailgate-lifter-operation", "テールゲートリフター操作", 4, 2, "2024-02-01"],
  ["SE-012", "cargo-lifting-appliance-under-5t", "5t未満揚貨装置運転", 11, 4, null],
  ["SE-013", "forestry-machine-operation", "伐木等機械運転", 6, 6, null],
  ["SE-014", "mobile-forestry-machine-operation", "走行集材機械運転", 6, 6, null],
  ["SE-015", "yarding-system-operation", "機械集材装置運転", 6, 8, null],
  ["SE-016", "simplified-cable-yardering-operation", "簡易架線集材装置・架線集材機械運転", 6, 8, null],
  ["SE-017", "chainsaw-felling", "チェーンソーによる伐木等", 9, 9, "2020-08-01"],
  ["SE-018", "small-construction-machine-leveling", "小型車両系建設機械（整地・運搬・積込み・掘削）", 7, 6, null],
  ["SE-019", "small-construction-machine-foundation", "小型車両系建設機械（基礎工事用）", 7, 6, null],
  ["SE-020", "small-construction-machine-demolition", "小型車両系建設機械（解体用）", 7, 7, null],
  ["SE-021", "foundation-construction-machine", "基礎工事用建設機械運転", 7, 5, null],
  ["SE-022", "foundation-machine-attachment", "車両系建設機械（基礎工事用）作業装置操作", 5, 4, null],
  ["SE-023", "road-roller-operation", "ローラー運転", 6, 4, null],
  ["SE-024", "concrete-placement-machine", "コンクリート打設用機械作業装置操作", 7, 5, null],
  ["SE-025", "boring-machine-operation", "ボーリングマシン運転", 7, 5, null],
  ["SE-026", "jack-lifting-machine", "ジャッキ式つり上げ機械調整・運転", 6, 4, null],
  ["SE-027", "aerial-work-platform-under-10m", "10m未満高所作業車運転", 6, 3, null],
  ["SE-028", "winch-operation", "巻上げ機運転", 6, 4, null],
  ["SE-029", "railway-powered-vehicle", "軌道装置動力車運転", 6, 4, null],
  ["SE-030", "small-boiler-operation", "小型ボイラー取扱", 7, 4, null],
  ["SE-031", "crane-under-5t", "5t未満クレーン運転", 9, 4, null],
  ["SE-032", "overhead-telha-5t-or-more", "5t以上跨線テルハ運転", 9, 4, null],
  ["SE-033", "mobile-crane-under-1t", "1t未満移動式クレーン運転", 9, 4, null],
  ["SE-034", "derrick-under-5t", "5t未満デリック運転", 9, 4, null],
  ["SE-035", "construction-lift-operation", "建設用リフト運転", 5, 4, null],
  ["SE-036", "slinging-under-1t", "1t未満クレーン等玉掛け", 5, 4, null],
  ["SE-037", "gondola-operation", "ゴンドラ操作", 5, 4, null],
  ["SE-038", "compressed-air-supply-operation", "高圧作業室等への送気用空気圧縮機運転", 10, 2, null],
  ["SE-039", "work-chamber-air-valve-operation", "作業室への送気調節バルブ等操作", 10, 2, null],
  ["SE-040", "air-lock-valve-operation", "気こう室送排気調節バルブ等操作", 9, 3, null],
  ["SE-041", "diver-air-supply-control", "潜水作業者への送気調節", 9, 2, null],
  ["SE-042", "high-pressure-chamber-work", "高圧室内作業", 7, 0, null],
  ["SE-043", "tetraalkyl-lead-work", "四アルキル鉛等業務", 6, 0, null],
  ["SE-044", "oxygen-deficiency-class-1", "第一種酸素欠乏危険作業", 4, 0, null],
  ["SE-045", "oxygen-deficiency-class-2", "第二種酸素欠乏危険作業", 5.5, 0, null],
  ["SE-046", "special-chemical-equipment", "特殊化学設備の取扱い・整備・修理", 13, 15, null],
  ["SE-047", "xray-gamma-equipment-operation", "エックス線装置・ガンマ線照射装置取扱", 4.5, 0, "2026-04-01"],
  ["SE-048", "nuclear-fuel-processing-facility", "加工施設等で核燃料物質等を取り扱う業務", 11.5, 6, null],
  ["SE-049", "nuclear-reactor-facility", "原子炉施設等で核燃料物質等を取り扱う業務", 5, 2, null],
  ["SE-050", "accident-derived-radioactive-waste", "事故由来放射性物質汚染物処分業務", 10, 6, null],
  ["SE-051", "emergency-radiation-work", "特例緊急作業", 6.5, 6, null],
  ["SE-052", "specified-dust-work", "特定粉じん作業", 4.5, 0, null],
  ["SE-053", "tunnel-excavation-and-lining", "ずい道等の掘削・覆工等", 7, 0, null],
  ["SE-054", "industrial-robot-teaching", "産業用ロボット教示等", 7, 3, null],
  ["SE-055", "industrial-robot-inspection", "産業用ロボット検査等", 9, 4, null],
  ["SE-056", "tire-inflation", "タイヤ空気充てん", 5, 4, null],
  ["SE-057", "dioxin-ash-handling", "ダイオキシン類：焼却施設でばいじん・焼却灰等取扱い", 4, 0, null],
  ["SE-058", "dioxin-maintenance", "ダイオキシン類：焼却炉・集じん機等保守点検", 4, 0, null],
  ["SE-059", "dioxin-demolition", "ダイオキシン類：焼却炉等解体・燃え殻取扱い", 4, 0, null],
  ["SE-060", "asbestos-demolition", "石綿使用建築物等解体等", 4.5, 0, null],
  ["SE-061", "decontamination-work", "除染等業務", 11.5, 6.5, null],
  ["SE-062", "specified-dose-work", "特定線量下業務", 2.5, 0, null],
  ["SE-063", "scaffolding-assembly", "足場の組立て・解体・変更", 6, 0, "2015-07-01"],
  ["SE-064", "rope-access-work", "ロープ高所作業", 4, 3, "2016-07-01"],
  ["SE-065", "full-body-harness-work", "フルハーネス型墜落制止用器具使用作業", 4.5, 1.5, "2019-02-01"],
];

/* 根拠が違うもの */
const BASIS_OVERRIDE: Record<string, string> = {
  "SE-047":
    "労働安全衛生法第59条第3項、労働安全衛生規則第36条、電離放射線障害防止規則第52条の5、エックス線装置及びガンマ線照射装置取扱業務特別教育規程（令和8年4月1日適用）",
};

/* この仕組みで受けられるもの。増えたらここに足す */
const OURS: Record<string, string> = { "SE-063": "ashiba" };

const SPECIAL: Qual[] = SE.map(([id, slug, name, theoryH, practicalH, from]) => ({
  id,
  slug,
  name,
  kind: "特別教育" as const,
  theoryH,
  practicalH,
  practical: practicalH > 0,
  from,
  courseId: OURS[id],
  basis: BASIS_OVERRIDE[id] ?? SE_BASIS,
}));

/* ── その他 ──
   免許や、法令で決まった講習。特別教育のような通し番号は無いので
   OT- を振ってある。ここも id は変えないこと。

   技能講習（作業主任者・玉掛け1t以上・移動式クレーンなど）は、
   いったん外してある。私が並べたものが現場のものと合っている保証が無く、
   間違った名前を選ばせると、そのまま名簿に残ってしまうため。
   一覧をもらったら、特別教育と同じ形で足す。
   それまでは「この一覧にない（自分で書く）」で入れてもらう。 */
const OTHERS: Qual[] = [
  { id: "OT-001", slug: "foreman-safety-supervisor", name: "職長・安全衛生責任者教育", kind: "その他" },
  { id: "OT-002", slug: "crane-derrick-license", name: "クレーン・デリック運転士（免許）", kind: "その他" },
  { id: "OT-003", slug: "mobile-crane-license", name: "移動式クレーン運転士（免許）", kind: "その他" },
  { id: "OT-004", slug: "gas-welding-license", name: "ガス溶接作業主任者（免許）", kind: "その他" },
  { id: "OT-005", slug: "boiler-license", name: "ボイラー技士（免許）", kind: "その他" },
  { id: "OT-006", slug: "first-aid", name: "救命講習", kind: "その他" },
];

export const QUALS: Qual[] = [...SPECIAL, ...OTHERS];

/** 一覧に無いものを自分で書くときの id */
export const OTHER = "other";

export const findQual = (id: string): Qual | null =>
  QUALS.find((q) => q.id === id) ?? null;

/** 画面に出す名前。一覧に無ければ、本人が書いた名前 */
export const qualName = (id: string, label?: string | null): string =>
  findQual(id)?.name ?? (label ?? "").trim() ?? "";

/** 合計時間（学科＋実技） */
export const totalH = (q: Qual): number => (q.theoryH ?? 0) + (q.practicalH ?? 0);

export const KINDS: QualKind[] = ["特別教育", "その他"];

/** 種類ごとに分ける（画面はこの順で並べる） */
export const byKind = (kind: QualKind) => QUALS.filter((q) => q.kind === kind);

/** 名前でしぼる。65件あるので、探せないと選んでもらえない */
export const search = (kind: QualKind, q: string): Qual[] => {
  const s = q.trim();
  const list = byKind(kind);
  if (!s) return list;
  return list.filter((x) => x.name.includes(s) || x.slug.includes(s.toLowerCase()) || x.id.includes(s.toUpperCase()));
};
