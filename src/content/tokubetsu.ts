/* 特別教育の一覧（法令で定められている65種類）。

   ── これは何か ──
   **教材ではなく、目録。** 労働安全衛生法59条3項で特別教育が要る業務を、
   学科・実技の法定時間と根拠とともに並べてある。

   使い道は3つ。
     ・次にどれを作るかを決める材料
     ・「この教育はありますか」と聞かれたときに答える元
     ・作るときの出発点（時間と根拠は、ここから条文へ辿る）

   ── ここの時間を、そのまま修了証に使わないこと ──
   **これは目録の時間であって、教材の時間ではない。**
   受講できる講座の時間は src/content/courses.ts が持っている。

   目録の元にした一覧は、65件のうち11件しか条番号が入っておらず、
   残りは労働局のまとめページが出典だった。実際に1件、間違っていた
   （第1種酸素欠乏＝4時間とあったが、正しくは5時間30分）。
   **4時間で修了証を出せば、法定時間に足りない紙になる。**

   だから講座にするときは、docs/19 のとおり
   **規程の条文から科目と細目を取り直す**こと。
   確かめた行にだけ checked を付けてある。付いていない行の時間は、
   「だいたいこれくらい」以上の意味を持たせない。 */

/** 出典。65回 URL を書かないための記号 */
export const SOURCES: Record<string, { name: string; url: string }> = {
  kitei: {
    name: "安全衛生特別教育規程",
    url: "https://www.mhlw.go.jp/web/t_doc?dataId=74085000&dataType=0",
  },
  roudoukyoku: {
    name: "東京労働局 安全衛生教育の一覧",
    url: "https://jsite.mhlw.go.jp/tokyo-roudoukyoku/hourei_seido_tetsuzuki/anzen_eisei/a-kyoiku.html",
  },
  xray: {
    name: "エックス線装置及びガンマ線照射装置取扱業務特別教育規程",
    url: "https://www.mhlw.go.jp/web/t_doc?dataId=74104000&dataType=0&pageNo=1",
  },
};

export type Tokubetsu = {
  /** 一覧での通し番号。あとから変えない */
  no: number;
  /** 英字の目印。講座にするときの id の候補にもなる */
  slug: string;
  /** 正式名称。「〜の業務」まで入れてある */
  name: string;
  /** 学科の法定時間（分） */
  gakkaMin: number;
  /** 実技の法定時間（分）。0 なら学科だけ */
  jitsugiMin: number;
  /** 根拠。条番号まで分かっているものは条番号まで */
  basis: string;
  /** 出典（SOURCES の鍵） */
  src: keyof typeof SOURCES | string;
  /** 施行日。新しくできた教育だけ */
  from?: string;
  /** もう作ってある講座（courses.ts の id） */
  courseId?: string;
  /** 規程の条文か、実物で確かめた行。
      **付いていない行の時間で修了証を出さないこと** */
  checked?: true;
};

/** 一覧を写した日 */
export const LISTED_ON = "2026-09-01";

export const TOKUBETSU: Tokubetsu[] = [
  {
    no: 1,
    slug: "machine_grinding_wheel",
    name: "機械研削用といしの取替え又は取替え時の試運転の業務",
    gakkaMin: 420,
    jitsugiMin: 180,
    basis: "安全衛生特別教育規程 第1条",
    src: "kitei",
  },
  {
    no: 2,
    slug: "free_grinding_wheel",
    name: "自由研削用といしの取替え又は取替え時の試運転の業務",
    gakkaMin: 240,
    jitsugiMin: 120,
    basis: "安全衛生特別教育規程 第2条",
    src: "kitei",
  },
  {
    no: 3,
    slug: "power_press_die",
    name: "動力プレスの金型等の取付け、取外し又は調整の業務",
    gakkaMin: 480,
    jitsugiMin: 120,
    basis: "安全衛生特別教育規程 第3条",
    src: "kitei",
  },
  {
    no: 4,
    slug: "arc_welding",
    name: "アーク溶接等の業務",
    gakkaMin: 660,
    jitsugiMin: 600,
    basis: "安全衛生特別教育規程 第4条",
    src: "kitei",
  },
  {
    no: 5,
    slug: "high_voltage_electrical",
    name: "高圧若しくは特別高圧の充電電路等の敷設、点検、修理又は操作の業務",
    gakkaMin: 660,
    jitsugiMin: 900,
    basis: "安全衛生特別教育規程 第5条",
    src: "kitei",
  },
  {
    no: 6,
    slug: "low_voltage_electrical",
    name: "低圧の充電電路の敷設・修理又は一定の低圧開閉器操作の業務",
    gakkaMin: 420,
    jitsugiMin: 420,
    basis: "安全衛生特別教育規程 第6条",
    src: "kitei",
  },
  {
    no: 7,
    slug: "electric_vehicle_maintenance",
    name: "電気自動車等の整備の業務",
    gakkaMin: 360,
    jitsugiMin: 60,
    basis: "安全衛生特別教育規程 第6条の2",
    src: "kitei",
    from: "2024-10-01",
  },
  {
    no: 8,
    slug: "forklift_under_1t",
    name: "フォークリフト（最大荷重1トン未満）の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 9,
    slug: "shovel_loader_under_1t",
    name: "ショベルローダー等（最大荷重1トン未満）の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 10,
    slug: "rough_terrain_vehicle_under_1t",
    name: "不整地運搬車（最大積載量1トン未満）の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 11,
    slug: "tailgate_lifter",
    name: "テールゲートリフターの操作の業務",
    gakkaMin: 240,
    jitsugiMin: 120,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 12,
    slug: "cargo_lifting_appliance_under_5t",
    name: "揚貨装置（制限荷重5トン未満）の運転の業務",
    gakkaMin: 660,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 13,
    slug: "felling_machine",
    name: "伐木等機械の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 14,
    slug: "running_yarding_machine",
    name: "走行集材機械の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 15,
    slug: "mechanical_yarding_system",
    name: "機械集材装置の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 480,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 16,
    slug: "simple_cable_yarding",
    name: "簡易架線集材装置の運転又は架線集材機械の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 480,
    basis: "安全衛生特別教育規程 第9条の2",
    src: "kitei",
  },
  {
    no: 17,
    slug: "chainsaw_felling",
    name: "チェーンソーを用いて行う立木の伐木、かかり木の処理又は造材の業務",
    gakkaMin: 540,
    jitsugiMin: 540,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 18,
    slug: "small_vehicle_construction_leveling",
    name: "小型車両系建設機械（整地・運搬・積込み用及び掘削用）の運転の業務",
    gakkaMin: 420,
    jitsugiMin: 360,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 19,
    slug: "small_vehicle_construction_foundation",
    name: "小型車両系建設機械（基礎工事用）の運転の業務",
    gakkaMin: 420,
    jitsugiMin: 360,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 20,
    slug: "small_vehicle_construction_demolition",
    name: "小型車両系建設機械（解体用）の運転の業務",
    gakkaMin: 420,
    jitsugiMin: 420,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 21,
    slug: "foundation_construction_machine",
    name: "基礎工事用建設機械の運転の業務",
    gakkaMin: 420,
    jitsugiMin: 300,
    basis: "安全衛生特別教育規程 第11条の4",
    src: "kitei",
  },
  {
    no: 22,
    slug: "foundation_machine_attachment",
    name: "車両系建設機械（基礎工事用）の作業装置の操作の業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 23,
    slug: "roller_operation",
    name: "ローラーの運転の業務",
    gakkaMin: 360,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 24,
    slug: "concrete_placing_machine",
    name: "コンクリート打設用機械の作業装置の操作の業務",
    gakkaMin: 420,
    jitsugiMin: 300,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 25,
    slug: "boring_machine",
    name: "ボーリングマシンの運転の業務",
    gakkaMin: 420,
    jitsugiMin: 300,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 26,
    slug: "jack_lifting_machine",
    name: "ジャッキ式つり上げ機械の調整又は運転の業務",
    gakkaMin: 360,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 27,
    slug: "aerial_work_platform_under_10m",
    name: "高所作業車（作業床高さ10メートル未満）の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 180,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 28,
    slug: "winch_operation",
    name: "巻上げ機の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 29,
    slug: "railway_power_vehicle",
    name: "軌道装置の動力車の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程 第15条",
    src: "kitei",
  },
  {
    no: 30,
    slug: "small_boiler",
    name: "小型ボイラー取扱業務",
    gakkaMin: 420,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 31,
    slug: "crane_under_5t",
    name: "つり上げ荷重5トン未満のクレーンの運転の業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 32,
    slug: "overhead_traverser_5t_plus",
    name: "跨線テルハでつり上げ荷重5トン以上のものの運転の業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 33,
    slug: "mobile_crane_under_1t",
    name: "つり上げ荷重1トン未満の移動式クレーンの運転の業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 34,
    slug: "derrick_under_5t",
    name: "つり上げ荷重5トン未満のデリックの運転の業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 35,
    slug: "construction_lift",
    name: "建設用リフトの運転の業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 36,
    slug: "slinging_under_1t",
    name: "つり上げ荷重1トン未満のクレーン等の玉掛けの業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 37,
    slug: "gondola_operation",
    name: "ゴンドラの操作の業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 38,
    slug: "air_compressor_hyperbaric",
    name: "作業室及び気こう室へ送気するための空気圧縮機を運転する業務",
    gakkaMin: 600,
    jitsugiMin: 120,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 39,
    slug: "work_chamber_air_valve",
    name: "作業室への送気調節用バルブ又はコックを操作する業務",
    gakkaMin: 600,
    jitsugiMin: 120,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 40,
    slug: "airlock_air_valve",
    name: "気こう室への送気又は排気調節用バルブ又はコックを操作する業務",
    gakkaMin: 540,
    jitsugiMin: 180,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 41,
    slug: "diver_air_supply_valve",
    name: "潜水作業者への送気調節用バルブ又はコックを操作する業務",
    gakkaMin: 540,
    jitsugiMin: 120,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 42,
    slug: "hyperbaric_work",
    name: "高圧室内作業に係る業務",
    gakkaMin: 420,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 43,
    slug: "tetraalkyl_lead",
    name: "四アルキル鉛等に係る業務",
    gakkaMin: 360,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  /* 学科は5時間30分（5科目、うち「その他」が1時間30分）。CSV は240分だった */
  {
    no: 44,
    slug: "oxygen_deficiency_type1",
    name: "第1種酸素欠乏危険作業に係る業務",
    gakkaMin: 330,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
    checked: true,
  },
  {
    no: 45,
    slug: "oxygen_deficiency_type2",
    name: "第2種酸素欠乏危険作業に係る業務",
    gakkaMin: 330,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 46,
    slug: "special_chemical_equipment",
    name: "特殊化学設備の取扱い、整備及び修理の業務",
    gakkaMin: 780,
    jitsugiMin: 900,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 47,
    slug: "xray_gamma_device",
    name: "エックス線装置又はガンマ線照射装置を取り扱う業務",
    gakkaMin: 270,
    jitsugiMin: 0,
    basis: "エックス線装置及びガンマ線照射装置取扱業務特別教育規程",
    src: "xray",
    from: "2026-04-01",
  },
  {
    no: 48,
    slug: "nuclear_fuel_processing_facility",
    name: "加工施設等において核燃料物質等を取り扱う業務",
    gakkaMin: 690,
    jitsugiMin: 360,
    basis: "関係特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 49,
    slug: "nuclear_reactor_facility",
    name: "原子炉施設等において核燃料物質等を取り扱う業務",
    gakkaMin: 300,
    jitsugiMin: 120,
    basis: "関係特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 50,
    slug: "accident_radioactive_waste_disposal",
    name: "事故由来放射性物質により汚染されたものの処分の業務",
    gakkaMin: 600,
    jitsugiMin: 360,
    basis: "関係特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 51,
    slug: "special_emergency_radiation_work",
    name: "電離則に定める特例緊急作業に係る業務",
    gakkaMin: 390,
    jitsugiMin: 360,
    basis: "関係特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 52,
    slug: "specified_dust_work",
    name: "特定粉じん作業に係る業務",
    gakkaMin: 270,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 53,
    slug: "tunnel_excavation_lining",
    name: "ずい道等の掘削等の作業に係る業務",
    gakkaMin: 420,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 54,
    slug: "industrial_robot_teaching",
    name: "産業用ロボットの可動範囲内で教示等を行う業務",
    gakkaMin: 420,
    jitsugiMin: 180,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 55,
    slug: "industrial_robot_inspection",
    name: "産業用ロボットの可動範囲内で検査等を行う業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 56,
    slug: "tire_air_inflation",
    name: "自動車用タイヤの組立てに係る空気充てんの業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 57,
    slug: "dioxin_ash_handling",
    name: "ダイオキシン類：焼却施設におけるばいじん・焼却灰等取扱い業務",
    gakkaMin: 240,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 58,
    slug: "dioxin_maintenance",
    name: "ダイオキシン類：廃棄物焼却炉・集じん機等の保守点検等の業務",
    gakkaMin: 240,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 59,
    slug: "dioxin_demolition",
    name: "ダイオキシン類：廃棄物焼却炉等の解体等及び燃え殻取扱い業務",
    gakkaMin: 240,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
  },
  {
    no: 60,
    slug: "asbestos_demolition",
    name: "石綿障害予防規則第3条第1項の建築物又は工作物の解体・破砕等の作業に係る業務",
    gakkaMin: 270,
    jitsugiMin: 0,
    basis: "石綿障害予防規則に基づく特別教育",
    src: "roudoukyoku",
  },
  {
    no: 61,
    slug: "decontamination_work",
    name: "除染等業務",
    gakkaMin: 690,
    jitsugiMin: 390,
    basis: "除染電離則に基づく特別教育",
    src: "roudoukyoku",
  },
  {
    no: 62,
    slug: "specified_dose_work",
    name: "特定線量下業務",
    gakkaMin: 150,
    jitsugiMin: 0,
    basis: "除染電離則に基づく特別教育",
    src: "roudoukyoku",
  },
  {
    no: 63,
    slug: "scaffolding_assembly",
    name: "足場の組立て、解体又は変更の作業に係る業務",
    gakkaMin: 360,
    jitsugiMin: 0,
    basis: "安全衛生特別教育規程",
    src: "roudoukyoku",
    courseId: "ashiba",
    checked: true,
  },
  {
    no: 64,
    slug: "rope_access_work",
    name: "ロープ高所作業に係る業務",
    gakkaMin: 240,
    jitsugiMin: 180,
    basis: "安全衛生特別教育規程",
    src: "kitei",
  },
  {
    no: 65,
    slug: "full_harness",
    name: "墜落制止用器具のうちフルハーネス型のものを用いて行う作業に係る業務",
    gakkaMin: 270,
    jitsugiMin: 90,
    basis: "安全衛生特別教育規程 第24条",
    src: "kitei",
  },];

/** 学科＋実技の合計（分） */
export const totalMinOf = (t: Tokubetsu): number => t.gakkaMin + t.jitsugiMin;

/** 実技のある教育か。実技は事業者が自社で行う（courses.ts の gate: "drill"） */
export const hasJitsugi = (t: Tokubetsu): boolean => t.jitsugiMin > 0;

/** もう受けられるか */
export const isReady = (t: Tokubetsu): boolean => !!t.courseId;

/** その時間で修了証を出してよいか。

    確かめていない行の時間は、目録として写しただけ。
    **これが false のまま講座にしてはいけない。**
    条文から取り直して checked を付けること（docs/19、docs/24）。 */
export const trustedHours = (t: Tokubetsu): boolean => t.checked === true;

/** 目印から引く */
export const findTokubetsu = (slug: string): Tokubetsu | null =>
  TOKUBETSU.find((t) => t.slug === slug) ?? null;

/** 講座の id から引く。作ってある講座が、目録のどれかを知りたいとき */
export const tokubetsuOfCourse = (courseId: string): Tokubetsu | null =>
  TOKUBETSU.find((t) => t.courseId === courseId) ?? null;

/** 出典の名前と住所 */
export const sourceOf = (t: Tokubetsu): { name: string; url: string } =>
  SOURCES[t.src] ?? { name: t.src, url: "" };

/** 作ってあるもの・これからのもの。数えるのに使う */
export const splitReady = (): { ready: Tokubetsu[]; todo: Tokubetsu[] } => ({
  ready: TOKUBETSU.filter(isReady),
  todo: TOKUBETSU.filter((t) => !isReady(t)),
});
