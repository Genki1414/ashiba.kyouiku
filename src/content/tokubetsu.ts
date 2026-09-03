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
  ishiwata: {
    name: "石綿使用建築物等解体等業務特別教育規程",
    url: "https://www.mhlw.go.jp/web/t_doc?dataId=74aa7005&dataType=0&pageNo=1",
  },
  funjin: {
    name: "粉じん作業特別教育規程",
    url: "https://www.mhlw.go.jp/web/t_doc?dataId=74109000&dataType=0&pageNo=1",
  },
  sanketsu: {
    name: "酸素欠乏危険作業特別教育規程",
    url: "https://www.mhlw.go.jp/web/t_doc?dataId=74106000&dataType=0&pageNo=1",
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
  /** いま作っている最中。まだ受けられないが、「いつか」ではない。
      作る順が見えると、待つ人は待てる */
  building?: true;
  /** 裏取りの記録（docs/…）。作り始めた行に付ける。
      ここが無いと、次に開いたときに条文を調べ直すことになる */
  doc?: string;
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
    basis: "労働安全衛生規則第36条第1号／安全衛生特別教育規程 第1条",
    src: "kitei",
    checked: true,
    courseId: "kikaitoishi",
    doc: "docs/40-機械研削といしの根拠と裏取り.md",
  },
  {
    no: 2,
    slug: "free_grinding_wheel",
    name: "自由研削用といしの取替え又は取替え時の試運転の業務",
    gakkaMin: 240,
    jitsugiMin: 120,
    basis: "労働安全衛生規則第36条第1号／安全衛生特別教育規程 第2条",
    src: "kitei",
    checked: true,
    courseId: "toishi",
    doc: "docs/34-自由研削といしの根拠と裏取り.md",
  },
  {
    no: 3,
    slug: "power_press_die",
    name: "動力プレスの金型等の取付け、取外し又は調整の業務",
    gakkaMin: 480,
    jitsugiMin: 120,
    basis: "労働安全衛生規則第36条第2号／安全衛生特別教育規程 第3条",
    src: "kitei",
    checked: true,
    courseId: "press",
    doc: "docs/47-動力プレスの根拠と裏取り.md",
  },
  {
    no: 4,
    slug: "arc_welding",
    name: "アーク溶接等の業務",
    gakkaMin: 660,
    jitsugiMin: 600,
    basis: "労働安全衛生規則第36条第3号／安全衛生特別教育規程 第4条",
    src: "kitei",
    checked: true,
    courseId: "arc",
    doc: "docs/39-アーク溶接の根拠と裏取り.md",
  },
  {
    no: 5,
    slug: "high_voltage_electrical",
    name: "高圧若しくは特別高圧の充電電路等の敷設、点検、修理又は操作の業務",
    gakkaMin: 660,
    jitsugiMin: 900,
    basis: "労働安全衛生規則第36条第4号／安全衛生特別教育規程 第5条",
    src: "kitei",
    checked: true,
    courseId: "kouatsu",
    doc: "docs/43-高圧特別高圧電気の根拠と裏取り.md",
  },
  {
    no: 6,
    slug: "low_voltage_electrical",
    name: "低圧の充電電路の敷設・修理又は一定の低圧開閉器操作の業務",
    gakkaMin: 420,
    jitsugiMin: 420,
    basis: "労働安全衛生規則第36条第4号／安全衛生特別教育規程 第6条",
    src: "kitei",
    checked: true,
    courseId: "teiatsu",
    doc: "docs/35-低圧電気の根拠と裏取り.md",
  },
  {
    no: 7,
    slug: "electric_vehicle_maintenance",
    name: "電気自動車等の整備の業務",
    gakkaMin: 360,
    jitsugiMin: 60,
    basis: "労働安全衛生規則第36条第4号の2／安全衛生特別教育規程 第6条の2",
    src: "kitei",
    checked: true,
    from: "2024-10-01",
    courseId: "ev",
    doc: "docs/44-電気自動車等の整備の根拠と裏取り.md",
  },
  {
    no: 8,
    slug: "forklift_under_1t",
    name: "フォークリフト（最大荷重1トン未満）の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "労働安全衛生規則第36条第5号／安全衛生特別教育規程 第7条",
    src: "kitei",
    checked: true,
    courseId: "forklift",
    doc: "docs/32-フォークリフトの根拠と裏取り.md",
  },
  {
    no: 9,
    slug: "shovel_loader_under_1t",
    name: "ショベルローダー等（最大荷重1トン未満）の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "労働安全衛生規則第36条第5号の2／安全衛生特別教育規程 第7条の2",
    src: "kitei",
    checked: true,
    courseId: "shovel",
    doc: "docs/41-ショベルローダー等の根拠と裏取り.md",
  },
  {
    no: 10,
    slug: "rough_terrain_vehicle_under_1t",
    name: "不整地運搬車（最大積載量1トン未満）の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "労働安全衛生規則第36条第5号の3／安全衛生特別教育規程 第7条の3",
    src: "kitei",
    checked: true,
    courseId: "fuseichi",
    doc: "docs/42-不整地運搬車の根拠と裏取り.md",
  },
  {
    no: 11,
    slug: "tailgate_lifter",
    name: "テールゲートリフターの操作の業務",
    gakkaMin: 240,
    jitsugiMin: 120,
    basis: "労働安全衛生規則第36条第5号の4／安全衛生特別教育規程 第7条の4",
    src: "kitei",
    checked: true,
    courseId: "tailgate",
    doc: "docs/33-テールゲートリフターの根拠と裏取り.md",
  },
  {
    no: 12,
    slug: "cargo_lifting_appliance_under_5t",
    name: "揚貨装置（制限荷重5トン未満）の運転の業務",
    gakkaMin: 660,
    jitsugiMin: 240,
    basis: "労働安全衛生規則第36条第6号／安全衛生特別教育規程 第8条",
    /* 規程第8条の全文で確認できたので src を kitei にした（docs/48） */
    src: "kitei",
    checked: true,
    courseId: "youka",
    doc: "docs/48-揚貨装置の根拠と裏取り.md",
  },
  {
    no: 13,
    slug: "felling_machine",
    name: "伐木等機械の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "労働安全衛生規則第36条第6号の2／安全衛生特別教育規程 第8条の2",
    src: "kitei",
    checked: true,
    courseId: "batsuboku",
    doc: "docs/49-伐木等機械の根拠と裏取り.md",
  },
  {
    no: 14,
    slug: "running_yarding_machine",
    name: "走行集材機械の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 360,
    basis: "労働安全衛生規則第36条第6号の3／安全衛生特別教育規程 第8条の3",
    src: "kitei",
    checked: true,
  },
  {
    no: 15,
    slug: "mechanical_yarding_system",
    name: "機械集材装置の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 480,
    basis: "労働安全衛生規則第36条第7号／安全衛生特別教育規程 第9条",
    src: "kitei",
    checked: true,
  },
  {
    no: 16,
    slug: "simple_cable_yarding",
    name: "簡易架線集材装置の運転又は架線集材機械の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 480,
    basis: "労働安全衛生規則第36条第7号の2／安全衛生特別教育規程 第9条の2",
    src: "kitei",
    checked: true,
  },
  {
    no: 17,
    slug: "chainsaw_felling",
    name: "チェーンソーを用いて行う立木の伐木、かかり木の処理又は造材の業務",
    gakkaMin: 540,
    jitsugiMin: 540,
    basis: "労働安全衛生規則第36条第8号／安全衛生特別教育規程 第10条",
    src: "kitei",
    checked: true,
    courseId: "chainsaw",
    doc: "docs/38-チェーンソーの根拠と裏取り.md",
  },
  /* 合計（学科7時間＋実技6時間）は確かめた。**科目ごとの時間はまだ**（docs/29）。
     確かめるまで単元を書かない。高所作業車で逆に思い込んでいたのと同じ危険 */
  {
    no: 18,
    slug: "small_vehicle_construction_leveling",
    name: "小型車両系建設機械（整地・運搬・積込み用及び掘削用）の運転の業務",
    gakkaMin: 420,
    jitsugiMin: 360,
    basis: "労働安全衛生規則第36条第9号（令別表第7第1号・第2号）／安全衛生特別教育規程 第11条",
    src: "kitei",
    checked: true,
    courseId: "kogata",
    doc: "docs/29-小型車両系建設機械の根拠と裏取り.md",
  },
  {
    no: 19,
    slug: "small_vehicle_construction_foundation",
    name: "小型車両系建設機械（基礎工事用）の運転の業務",
    gakkaMin: 420,
    jitsugiMin: 360,
    basis: "労働安全衛生規則第36条第9号（令別表第7第3号）／安全衛生特別教育規程 第11条の2",
    src: "kitei",
    checked: true,
  },
  {
    no: 20,
    slug: "small_vehicle_construction_demolition",
    name: "小型車両系建設機械（解体用）の運転の業務",
    gakkaMin: 420,
    jitsugiMin: 420,
    basis: "労働安全衛生規則第36条第9号（令別表第7第6号）／安全衛生特別教育規程 第11条の3",
    src: "kitei",
    checked: true,
  },
  {
    no: 21,
    slug: "foundation_construction_machine",
    name: "基礎工事用建設機械の運転の業務",
    gakkaMin: 420,
    jitsugiMin: 300,
    basis: "労働安全衛生規則第36条第9号の2／安全衛生特別教育規程 第11条の4",
    src: "kitei",
    checked: true,
  },
  {
    no: 22,
    slug: "foundation_machine_attachment",
    name: "車両系建設機械（基礎工事用）の作業装置の操作の業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis: "労働安全衛生規則第36条第9号の3／安全衛生特別教育規程 第11条の5",
    src: "kitei",
    checked: true,
  },
  {
    no: 23,
    slug: "roller_operation",
    name: "ローラーの運転の業務",
    gakkaMin: 360,
    jitsugiMin: 240,
    basis: "労働安全衛生規則第36条第10号／安全衛生特別教育規程 第12条",
    src: "kitei",
    checked: true,
    courseId: "roller",
    doc: "docs/37-ローラーの根拠と裏取り.md",
  },
  {
    no: 24,
    slug: "concrete_placing_machine",
    name: "コンクリート打設用機械の作業装置の操作の業務",
    gakkaMin: 420,
    jitsugiMin: 300,
    basis: "労働安全衛生規則第36条第10号の2／安全衛生特別教育規程 第12条の2",
    src: "kitei",
    checked: true,
  },
  {
    no: 25,
    slug: "boring_machine",
    name: "ボーリングマシンの運転の業務",
    gakkaMin: 420,
    jitsugiMin: 300,
    basis: "労働安全衛生規則第36条第10号の3／安全衛生特別教育規程 第12条の3",
    src: "kitei",
    checked: true,
  },
  {
    no: 26,
    slug: "jack_lifting_machine",
    name: "ジャッキ式つり上げ機械の調整又は運転の業務",
    gakkaMin: 360,
    jitsugiMin: 240,
    basis: "労働安全衛生規則第36条第10号の4／安全衛生特別教育規程 第12条の4",
    src: "kitei",
    checked: true,
  },
  /* 根拠に条番号を足した。渡された一覧は「安全衛生特別教育規程」までで、
     どの条かが分からなかった。特別教育を義務づけているのは
     安衛則第36条第10号の5、科目と時間は規程第13条（docs/26）。

     科目ごとの割り振りも規程第13条の表で確かめた（学科は
     装置3時間・原動機1時間・一般的事項1時間・関係法令1時間）。
     **学科だけをここで出す。実技3時間は事業者が自社で行う**（gate: "drill"）。 */
  {
    no: 27,
    slug: "aerial_work_platform_under_10m",
    name: "高所作業車（作業床の高さ10メートル未満）の運転の業務に係る特別教育",
    gakkaMin: 360,
    jitsugiMin: 180,
    basis: "労働安全衛生規則第36条第10号の5／安全衛生特別教育規程 第13条",
    src: "kitei",
    checked: true,
    courseId: "kousho",
    doc: "docs/26-高所作業車の根拠と裏取り.md",
  },
  {
    no: 28,
    slug: "winch_operation",
    name: "巻上げ機の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 240,
    basis: "労働安全衛生規則第36条第11号／安全衛生特別教育規程 第14条",
    src: "kitei",
    checked: true,
    courseId: "winch",
    doc: "docs/36-巻上げ機の根拠と裏取り.md",
  },
  {
    no: 29,
    slug: "railway_power_vehicle",
    name: "軌道装置の動力車の運転の業務",
    gakkaMin: 360,
    jitsugiMin: 240,
    basis: "労働安全衛生規則第36条第13号／安全衛生特別教育規程 第15条",
    src: "kitei",
    checked: true,
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
    /* **第1種は4時間**（告示第1条。30分／30分／1時間／1時間／1時間）。
       渡された一覧は330分（＝第2種の時間）になっていた。条文で確かめて直した。

       一覧は根拠も「安全衛生特別教育規程」と書いていたが、酸欠の告示は別
       （酸素欠乏危険作業特別教育規程）。

       うちが出しているのは第2種（5時間30分・告示第2条）の講座。
       **第2種は第1種を含む**ので、第1種の業務にもこの講座で足りる（docs/31）。 */
    gakkaMin: 240,
    jitsugiMin: 0,
    basis: "酸素欠乏症等防止規則第12条／酸素欠乏危険作業特別教育規程第1条",
    src: "sanketsu",
    checked: true,
    courseId: "sanketsu",
    doc: "docs/31-酸欠の根拠と裏取り.md",
  },
  {
    no: 45,
    slug: "oxygen_deficiency_type2",
    name: "第2種酸素欠乏危険作業に係る業務",
    /* 第2種は5時間30分（告示第2条。1時間／1時間／1時間／1時間／1時間30分）。条文で確認済み */
    gakkaMin: 330,
    jitsugiMin: 0,
    basis: "酸素欠乏症等防止規則第12条／酸素欠乏危険作業特別教育規程第2条",
    src: "sanketsu",
    checked: true,
    courseId: "sanketsu",
    doc: "docs/31-酸欠の根拠と裏取り.md",
  },
  {
    no: 46,
    slug: "special_chemical_equipment",
    name: "特殊化学設備の取扱い、整備及び修理の業務",
    gakkaMin: 780,
    jitsugiMin: 900,
    basis: "労働安全衛生規則第36条第27号／安全衛生特別教育規程 第16条",
    src: "kitei",
    checked: true,
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
  /* 根拠を直した。粉じんは「安全衛生特別教育規程」ではなく、
     **粉じん作業特別教育規程（昭和54年労働省告示第68号）**。
     義務づけは粉じん則第22条。学科だけ4時間30分（docs/30） */
  {
    no: 52,
    slug: "specified_dust_work",
    name: "特定粉じん作業に係る業務",
    gakkaMin: 270,
    jitsugiMin: 0,
    basis: "労働安全衛生規則第36条第29号／粉じん障害防止規則第22条／粉じん作業特別教育規程",
    src: "funjin",
    checked: true,
    courseId: "funjin",
    doc: "docs/30-粉じんの根拠と裏取り.md",
  },
  {
    no: 53,
    slug: "tunnel_excavation_lining",
    name: "ずい道等の掘削等の作業に係る業務",
    gakkaMin: 420,
    jitsugiMin: 0,
    basis: "労働安全衛生規則第36条第30号／安全衛生特別教育規程 第17条",
    src: "kitei",
    checked: true,
    courseId: "zuidou",
    doc: "docs/45-ずい道等の掘削等の根拠と裏取り.md",
  },
  {
    no: 54,
    slug: "industrial_robot_teaching",
    name: "産業用ロボットの可動範囲内で教示等を行う業務",
    gakkaMin: 420,
    jitsugiMin: 180,
    basis: "労働安全衛生規則第36条第31号／安全衛生特別教育規程 第18条",
    src: "kitei",
    checked: true,
  },
  {
    no: 55,
    slug: "industrial_robot_inspection",
    name: "産業用ロボットの可動範囲内で検査等を行う業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis: "労働安全衛生規則第36条第32号／安全衛生特別教育規程 第19条",
    src: "kitei",
    checked: true,
  },
  {
    no: 56,
    slug: "tire_air_inflation",
    name: "自動車用タイヤの組立てに係る空気充てんの業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis: "労働安全衛生規則第36条第33号／安全衛生特別教育規程 第20条",
    src: "kitei",
    checked: true,
  },
  {
    no: 57,
    slug: "dioxin_ash_handling",
    name: "ダイオキシン類：焼却施設におけるばいじん・焼却灰等取扱い業務",
    gakkaMin: 240,
    jitsugiMin: 0,
    basis: "労働安全衛生規則第36条第34号〜第36号／安全衛生特別教育規程 第21条",
    src: "kitei",
    checked: true,
    courseId: "dioxin",
    doc: "docs/46-ダイオキシン類の根拠と裏取り.md",
  },
  {
    no: 58,
    slug: "dioxin_maintenance",
    name: "ダイオキシン類：廃棄物焼却炉・集じん機等の保守点検等の業務",
    gakkaMin: 240,
    jitsugiMin: 0,
    basis: "労働安全衛生規則第36条第34号〜第36号／安全衛生特別教育規程 第21条",
    src: "kitei",
    checked: true,
    courseId: "dioxin",
    doc: "docs/46-ダイオキシン類の根拠と裏取り.md",
  },
  {
    no: 59,
    slug: "dioxin_demolition",
    name: "ダイオキシン類：廃棄物焼却炉等の解体等及び燃え殻取扱い業務",
    gakkaMin: 240,
    jitsugiMin: 0,
    basis: "労働安全衛生規則第36条第34号〜第36号／安全衛生特別教育規程 第21条",
    src: "kitei",
    checked: true,
    courseId: "dioxin",
    doc: "docs/46-ダイオキシン類の根拠と裏取り.md",
  },
  /* 名前と根拠を条文に合わせた。渡された一覧は
     「石綿障害予防規則第3条第1項の…」となっていたが、第3条は事前調査の条。
     特別教育を義務づけているのは**第27条第1項**（docs/25）。
     教育の名前も、告示（石綿使用建築物等解体等業務特別教育規程）に合わせる。

     合計4時間30分は確かめた。**科目ごとの割り振りはまだ**（docs/25）。 */
  {
    no: 60,
    slug: "asbestos_demolition",
    name: "石綿使用建築物等解体等業務に係る特別教育",
    gakkaMin: 270,
    jitsugiMin: 0,
    basis: "労働安全衛生規則第36条第37号／石綿障害予防規則第27条第1項",
    src: "ishiwata",
    checked: true,
    courseId: "ishiwata",
    doc: "docs/25-石綿の根拠と裏取り.md",
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
  /* 根拠に条番号を足した。特別教育を義務づけているのは安衛則第36条第40号、
     科目と時間は規程第23条（docs/28）。学科4時間・実技3時間。
     **学科だけをここで出す。実技は事業者が自社で行う**（gate: "drill"）。 */
  {
    no: 64,
    slug: "rope_access_work",
    name: "ロープ高所作業に係る業務",
    gakkaMin: 240,
    jitsugiMin: 180,
    basis: "労働安全衛生規則第36条第40号／安全衛生特別教育規程 第23条",
    src: "kitei",
    checked: true,
    courseId: "rope",
    doc: "docs/28-ロープ高所作業の根拠と裏取り.md",
  },
  /* 根拠に条番号を足した。特別教育を義務づけているのは安衛則第36条第41号、
     科目と時間は規程第24条（docs/27）。

     科目ごとの時間も確かめた（作業1時間・器具2時間・災害防止1時間・法令30分）。
     **学科だけをここで出す。実技1時間30分は事業者が自社で行う**（gate: "drill"）。 */
  {
    no: 65,
    slug: "full_harness",
    name: "墜落制止用器具のうちフルハーネス型のものを用いて行う作業に係る業務",
    gakkaMin: 270,
    jitsugiMin: 90,
    basis: "労働安全衛生規則第36条第41号／安全衛生特別教育規程 第24条",
    src: "kitei",
    checked: true,
    courseId: "harness",
    doc: "docs/27-フルハーネスの根拠と裏取り.md",
  },];

/** 学科＋実技の合計（分） */
export const totalMinOf = (t: Tokubetsu): number => t.gakkaMin + t.jitsugiMin;

/** 実技のある教育か。実技は事業者が自社で行う（courses.ts の gate: "drill"） */
export const hasJitsugi = (t: Tokubetsu): boolean => t.jitsugiMin > 0;

/** もう受けられるか */
export const isReady = (t: Tokubetsu): boolean => !!t.courseId;

/** いま作っている最中か。受けられるようになったら、この印は落とす */
export const isBuilding = (t: Tokubetsu): boolean => !isReady(t) && t.building === true;

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

/* ── 探すための別名 ──────────────────────────
   正式名称は法令の言い方で、現場の言い方と違うものが多い。
   「石綿」を「アスベスト」、「酸素欠乏」を「酸欠」、
   「小型車両系建設機械」を「ユンボ」と打つ人のほうが多い。
   **正式名称でしか引けないと、有るのに無いと思われる。**

   ここに足すのは**探すための言葉だけ**。画面に出る名前ではない。
   間違った別名を足しても、余計なものが引っかかるだけで、
   法令の名前や時間には触らない。 */
export const ALIAS: Record<string, string> = {
  machine_grinding_wheel: "といし 砥石 研削 グラインダー 機械研削",
  free_grinding_wheel: "といし 砥石 研削 グラインダー 自由研削",
  power_press_die: "プレス 金型",
  arc_welding: "アーク溶接 溶接 ようせつ 半自動",
  high_voltage_electrical: "高圧電気 電気取扱 特別高圧 充電電路",
  low_voltage_electrical: "低圧電気 電気取扱 開閉器",
  electric_vehicle_maintenance: "EV 電気自動車 整備",
  forklift_under_1t: "フォークリフト フォーク 1トン未満",
  shovel_loader_under_1t: "ショベルローダー ローダー",
  rough_terrain_vehicle_under_1t: "不整地運搬車 キャリア クローラ",
  tailgate_lifter: "テールゲート リフター パワーゲート",
  cargo_lifting_appliance_under_5t: "揚貨装置",
  felling_machine: "伐木 林業 ハーベスタ",
  running_yarding_machine: "集材 林業 フォワーダ",
  mechanical_yarding_system: "集材 架線 林業",
  simple_cable_yarding: "集材 架線 林業",
  chainsaw_felling: "チェーンソー 伐木 造材 かかり木 林業",
  small_vehicle_construction_leveling: "小型車両系 整地 バックホウ ユンボ 3トン未満 建設機械",
  small_vehicle_construction_foundation: "小型車両系 基礎工事 建設機械",
  small_vehicle_construction_demolition: "小型車両系 解体 建設機械 ニブラ",
  foundation_construction_machine: "基礎工事用 くい打機 アースドリル",
  foundation_machine_attachment: "基礎工事用 作業装置",
  roller_operation: "ローラー 転圧 ロードローラー",
  concrete_placing_machine: "コンクリート ポンプ車 打設 圧送",
  boring_machine: "ボーリング さく孔",
  jack_lifting_machine: "ジャッキ つり上げ リフトアップ",
  aerial_work_platform_under_10m: "高所作業車 高所 10メートル未満 10m未満",
  winch_operation: "巻上げ機 ウインチ ウィンチ",
  railway_power_vehicle: "軌道装置 動力車",
  small_boiler: "ボイラー 小型ボイラー",
  crane_under_5t: "クレーン 5トン未満 天井クレーン",
  overhead_traverser_5t_plus: "跨線テルハ テルハ",
  mobile_crane_under_1t: "移動式クレーン ユニック 積載型 1トン未満",
  derrick_under_5t: "デリック",
  construction_lift: "建設用リフト リフト 荷揚げ",
  slinging_under_1t: "玉掛け たまがけ 玉掛 1トン未満",
  gondola_operation: "ゴンドラ",
  air_compressor_hyperbaric: "高気圧 空気圧縮機 コンプレッサー 潜函",
  work_chamber_air_valve: "高気圧 送気 バルブ 作業室",
  airlock_air_valve: "高気圧 送気 排気 気こう室",
  diver_air_supply_valve: "潜水 送気 バルブ",
  hyperbaric_work: "高圧室内 高気圧 潜函 ケーソン",
  tetraalkyl_lead: "四アルキル鉛 鉛",
  oxygen_deficiency_type1: "酸欠 さんけつ 酸素欠乏 第1種 1種",
  oxygen_deficiency_type2: "酸欠 さんけつ 酸素欠乏 硫化水素 第2種 2種",
  special_chemical_equipment: "特殊化学設備 化学設備",
  xray_gamma_device: "エックス線 X線 レントゲン ガンマ線 放射線 非破壊",
  nuclear_fuel_processing_facility: "核燃料 加工施設 放射線",
  nuclear_reactor_facility: "核燃料 原子炉 放射線",
  accident_radioactive_waste_disposal: "放射性物質 処分 除染 汚染",
  special_emergency_radiation_work: "電離則 緊急作業 放射線",
  specified_dust_work: "粉じん ふんじん 特定粉じん じん肺",
  tunnel_excavation_lining: "ずい道 トンネル 隧道 掘削",
  industrial_robot_teaching: "ロボット 産業用ロボット 教示 ティーチング",
  industrial_robot_inspection: "ロボット 産業用ロボット 検査",
  tire_air_inflation: "タイヤ 空気充てん 組立て",
  dioxin_ash_handling: "ダイオキシン 焼却 ばいじん 焼却灰",
  dioxin_maintenance: "ダイオキシン 焼却炉 集じん機 保守点検",
  dioxin_demolition: "ダイオキシン 焼却炉 解体 燃え殻",
  asbestos_demolition: "石綿 せきめん アスベスト 解体 除去",
  decontamination_work: "除染 電離 汚染",
  specified_dose_work: "特定線量下 線量 除染",
  scaffolding_assembly: "足場 あしば 組立て 解体 くさび ビケ",
  rope_access_work: "ロープ高所 ロープ ブランコ 特殊高所",
  full_harness: "フルハーネス ハーネス 墜落制止 安全帯 胴ベルト",
};

/* ── 探す ────────────────────────────────────
   打ち方の揺れを吸う。ここを雑にすると
   「アスベスト」で石綿が出ず、有るのに無いと思われる。

   ・大文字小文字、全角半角をそろえる（NFKC）
   ・**カタカナをひらがなに寄せる。**「サンケツ」と「さんけつ」で
     結果が変わってはいけない
   ・空白で区切った語は全部を含むもの（AND）。
     絞り込むために足した語で、かえって増えるのはおかしい */

/** 打ち方の揺れをそろえる */
export function norm(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    /* カタカナ → ひらがな。長音符（ー）はそのまま */
    .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, " ")
    .trim();
}

/** その行が、探している言葉に当たるか */
export function matches(t: Tokubetsu, q: string): boolean {
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  /* 目印（slug）は探す対象に入れない。人が打つものではないうえ、
     英字の切れ端が中で当たる（「EV」が leveling に当たっていた） */
  const hay = norm(`${t.name} ${t.basis} ${ALIAS[t.slug] ?? ""}`);
  return words.every((w) => hay.includes(w));
}

/** 探した結果。並び順は目録のまま（法令の番号順） */
export const searchTokubetsu = (q: string, from: Tokubetsu[] = TOKUBETSU): Tokubetsu[] =>
  from.filter((t) => matches(t, q));

/* ── 持ち出す ────────────────────────────────
   この目録は、いずれ単体で事業にする。**そのとき丸ごと持ち出せること。**

   ・この file は何も import していない（試験で見張っている）。
     コピーすれば、そのまま別の仕組みで動く
   ・下の2つで、機械（JSON）にも表計算（CSV）にも出せる
   ・列は渡された一覧と同じ形にそろえてある。行って戻れる

   確かめたかどうか（checked）も一緒に出す。
   **出した先で「全部裏を取ってある」と誤解されると、
   足りない時間の修了証が出る。** 印は付いたまま持ち出す。 */

/** 持ち出す形。1行1件 */
export type TokubetsuOut = {
  course_id: number;
  slug: string;
  title_ja: string;
  theory_minutes: number;
  practical_minutes: number;
  total_minutes: number;
  practical_required: boolean;
  legal_basis_note: string;
  source_url: string;
  effective_from: string;
  /** 条文か実物で時間を確かめたか。false の行を信用しないこと */
  hours_verified: boolean;
  /** いま作っている最中か */
  building: boolean;
  /** もう受けられる講座の目印。無ければ空 */
  course_slug: string;
  /** 探すための別名（空白区切り） */
  alias: string;
  listed_on: string;
};

/** 全部を、持ち出す形にする */
export const toRows = (): TokubetsuOut[] =>
  TOKUBETSU.map((t) => ({
    course_id: t.no,
    slug: t.slug,
    title_ja: t.name,
    theory_minutes: t.gakkaMin,
    practical_minutes: t.jitsugiMin,
    total_minutes: totalMinOf(t),
    practical_required: hasJitsugi(t),
    legal_basis_note: t.basis,
    source_url: sourceOf(t).url,
    effective_from: t.from ?? "",
    hours_verified: trustedHours(t),
    building: isBuilding(t),
    course_slug: t.courseId ?? "",
    alias: ALIAS[t.slug] ?? "",
    listed_on: LISTED_ON,
  }));

/** 表計算に貼れる形。Excel が文字化けしないよう、呼ぶ側で BOM を足す */
export function toCsv(): string {
  const rows = toRows();
  const cols = Object.keys(rows[0]) as (keyof TokubetsuOut)[];
  /* 引用符とカンマと改行を含む値を壊さない。
     名前に「、」ではなく「,」が入る日が来ても崩れないように */
  const cell = (v: string | number | boolean): string => {
    const s = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}
