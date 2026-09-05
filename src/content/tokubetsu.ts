/* 特別教育の一覧（法令で定められている66種類）。

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

   **65件で始めたが、条文を読んで1件見つけて足した**（no.66 再圧室を操作する業務）。
   高気圧作業安全衛生規則第11条第1項は六つの業務を挙げているのに、
   元の一覧には五つしか無かった。**まとめの一覧は、抜けることがある。**

   目録の元にした一覧は、65件のうち11件しか条番号が入っておらず、
   残りは労働局のまとめページが出典だった。実際に1件、間違っていた
   （第1種酸素欠乏＝4時間とあったが、正しくは5時間30分）。
   **4時間で修了証を出せば、法定時間に足りない紙になる。**

   だから講座にするときは、docs/19 のとおり
   **規程の条文から科目と細目を取り直す**こと。
   確かめた行にだけ checked を付けてある。付いていない行の時間は、
   「だいたいこれくらい」以上の意味を持たせない。

   ── 法定時間を決めるときの順番（2026年9月5日に決めた・docs/68）──
     1. **現行の労働安全衛生関係省令**（安衛則、クレーン則、電離則…）
     2. **省令から委任された現行の告示**（○○特別教育規程）
     3. 厚生労働省・労働局などの公式のまとめ
   **民間サイトの一覧表は、法定時間の根拠にしない。**
   1と2が3と食い違ったときは、1と2を採る。ただし
   **うちがまだ告示の全文を見ていないなら、checked は付けない。** */

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
  kurenkitei: {
    name: "クレーン取扱い業務等特別教育規程",
    url: "https://www.mhlw.go.jp/web/t_doc?dataId=74027000&dataType=0&pageNo=1",
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
  /** 学科の科目・範囲（中欄）・科目ごとの法定最低時間（分）。
      **合計は gakkaMin と一致すること。**tests/tokubetsu.ts で見ている。
      scope は告示の中欄。**告示の全文を見た行にだけ入れる**（区切りは全角空白） */
  gakka?: { name: string; scope?: string; min: number }[];
  /** 実技の科目・範囲（中欄）・科目ごとの法定最低時間（分）。
      **合計は jitsugiMin と一致すること** */
  jitsugi?: { name: string; scope?: string; min: number }[];
  /** 業務区分。**ここが入っている行を、一つの固定時間で実装しないこと。**

      区分ごとの時間まで分かっているものは gakkaMin・jitsugiMin を入れる。
      **行そのものの gakkaMin・jitsugiMin は、区分のうちいちばん長いもの。**
      短い区分の人に長い教育をしても法定は満たすが、逆は満たさないため、
      迷ったら長いほうを出す。**修了証には、受けた区分の時間を書くこと** */
  variants?: { name: string; gakkaMin?: number; jitsugiMin?: number; note?: string }[];
  /** 時間の出どころが、げんきさんの講座マスター（MASTER_ON）である行。
      src は規程そのものを指しているが、**うちが見たのは告示の全文ではない** */
  fromMaster?: true;
  /** **告示（規程）の全文を、うちが見た行。**科目名・中欄・時間を一字ずつ突き合わせてある。
      fromMaster より一段強い。ここが true なら、条文がうちの手元にある */
  fullText?: true;
  /** **省令が定めている「教育すべき事項」**（省令の表の下欄）。
      科目・範囲・時間は告示の側にあるので、事項だけ分かっている段階の行に入れる。
      **これは条文そのもの。**省令が読めた行にだけ入れること */
  jikou?: string[];
  /** **法定の時間が、まだ分からない行。**
      省令で教育が要ることは分かっているが、時間を決めている告示を見ていない。
      **この行の gakkaMin・jitsugiMin は 0。**「教育が要らない」ではない。
      0 を法定時間として使わないよう、講座にできないようテストで止めてある */
  hoursUnknown?: true;
  /** 法令を確かめた日 */
  checkedOn?: string;
};

/** 一覧を写した日 */
export const LISTED_ON = "2026-09-01";

/** げんきさんの講座マスター（訂正版）を受け取った日。
    **法定時間は、現行の省令と、省令から委任された告示（○○特別教育規程）を正とする。**
    労働局などの公式まとめは、その次。民間サイトの一覧は根拠にしない。
    この決まりで、no.42・no.48・no.50・no.61 の時間を直した（docs/68） */
export const MASTER_ON = "2026-09-05";

/** **クレーン取扱い業務等特別教育規程（昭和47年労働省告示第118号）の全文を読んだ日。**
    げんきさんが条文を送ってくれた。第1条から第5条まで、科目名・中欄・時間を
    一字ずつ突き合わせてある（目録の31〜36行目・docs/69）。
    **うちが告示の全文で裏を取った、初めての規程。** */
export const KOKUJI_118_ON = "2026-09-05";

/** **高気圧業務特別教育規程（昭和47年労働省告示第129号）の全文を読んだ日。**
    第1条から第6条まで、高圧則第11条第1項の六つの業務に、一つずつ表が付いている。
    **no.66（再圧室）の時間は、ここで決まった**（目録の38〜42・66行目・docs/71）。 */
export const KOKUJI_129_ON = "2026-09-05";

/** **ゴンドラ取扱い業務等特別教育規程（昭和47年労働省告示第121号）と、
    小型ボイラー取扱業務特別教育規程（昭和47年労働省告示第115号）を読んだ日**（docs/72）。
    小型ボイラーは学科・実技とも全部そろった。
    **ゴンドラは、実技の二つ目（合図）の時間のところで写しが切れていた。** */
export const KOKUJI_121_115_ON = "2026-09-05";

/** **四アルキル鉛等業務特別教育規程（昭和47年労働省告示第125号）と、
    除染等業務特別教育及び特定線量下業務特別教育規程（平成23年厚生労働省告示第469号）
    を読んだ日**（docs/73）。
    **除染等の業務区分ごとの時間が、ここで分かった。** */
export const KOKUJI_125_469_ON = "2026-09-05";

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
    courseId: "soukou",
    doc: "docs/50-走行集材機械の根拠と裏取り.md",
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
    courseId: "kikaishuzai",
    doc: "docs/51-機械集材装置の根拠と裏取り.md",
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
    courseId: "kanikasen",
    doc: "docs/52-簡易架線集材装置等の根拠と裏取り.md",
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
    courseId: "kisokouji",
    doc: "docs/53-小型車両系建設機械（基礎工事用）の根拠と裏取り.md",
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
    courseId: "kaitai",
    doc: "docs/54-小型車両系建設機械（解体用）の根拠と裏取り.md",
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
    courseId: "kisokenki",
    doc: "docs/55-基礎工事用建設機械の根拠と裏取り.md",
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
    courseId: "kisosousa",
    doc: "docs/56-車両系建設機械（基礎工事用）の作業装置の操作の根拠と裏取り.md",
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
    courseId: "concrete",
    doc: "docs/57-コンクリート打設用機械の根拠と裏取り.md",
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
    courseId: "boring",
    doc: "docs/58-ボーリングマシンの根拠と裏取り.md",
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
    courseId: "jack",
    doc: "docs/59-ジャッキ式つり上げ機械の根拠と裏取り.md",
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
    courseId: "kidou",
    doc: "docs/60-軌道装置の動力車の根拠と裏取り.md",
  },
  {
    no: 30,
    slug: "small_boiler",
    name: "小型ボイラー取扱業務",
    gakkaMin: 420,
    jitsugiMin: 240,
    basis:
      "ボイラー及び圧力容器安全規則（昭和47年労働省令第33号）第92条第1項／小型ボイラー取扱業務特別教育規程 第2条・第3条（昭和47年労働省告示第115号）",
    /* **告示の全文で確かめた**（2026年9月5日・docs/72）。
       元からあった労働局のまとめの時間（学科7時間・実技4時間）とも一致した。
       **実技に合図が無い。**一人で焚く機械だから */
    gakka: [
      {
        name: "ボイラーの構造に関する知識",
        scope: "熱及び蒸気　小型ボイラーの種類　主要部分の構造",
        min: 120,
      },
      {
        name: "ボイラーの附属品に関する知識",
        scope: "安全装置　圧力計　水面測定装置　給水装置　吹出装置　自動制御装置",
        min: 120,
      },
      {
        name: "燃料及び燃焼に関する知識",
        scope: "燃料の種類　燃焼方式及び燃焼装置　通風装置",
        min: 120,
      },
      {
        name: "関係法令",
        scope:
          "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及びボイラー及び圧力容器安全規則中の関係条項",
        min: 60,
      },
    ],
    jitsugi: [
      {
        name: "小型ボイラーの運転及び保守",
        scope: "点火及び燃焼の調整　運転中の留意事項　吹出し　運転の停止及び停止後の処置",
        min: 180,
      },
      {
        name: "小型ボイラーの点検",
        scope: "運転開始前の点検　使用中における異常状態及びこれに対する処置の方法　清掃の方法",
        min: 60,
      },
    ],
    src: "roudoukyoku",
    checked: true,
    fullText: true,
    checkedOn: KOKUJI_121_115_ON,
  },
  {
    no: 31,
    slug: "crane_under_5t",
    name: "つり上げ荷重5トン未満のクレーンの運転の業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis:
      "クレーン等安全規則（昭和47年労働省令第34号）第21条第1項／クレーン取扱い業務等特別教育規程 第1条（昭和47年労働省告示第118号）",
    /* **告示の全文で裏を取った**（2026年9月5日・docs/69）。
       科目名・中欄・時間を、規程第1条と一字ずつ突き合わせてある。
       **跨線テルハ（5トン以上）も、クレーン（5トン未満）と同じ規程第1条。**
       だから講座は1本で、目録の2行がそれを指している */
    gakka: [
      { name: "クレーンに関する知識", scope: "種類及び型式　主要構造部分　作動装置　安全装置　ブレーキ機能　取扱い方法", min: 180 },
      { name: "原動機及び電気に関する知識", scope: "電気に関する基礎知識　電動機　開閉器、コントローラー等電気を通ずる機械器具　電路の点検及び補修　感電による危険性", min: 180 },
      { name: "クレーンの運転のために必要な力学に関する知識", scope: "力(合成、分解、つり合い及びモーメント)　重心　荷重　ワイヤロープ、フツク及びつり具の強さ　ワイヤロープの掛け方と荷重との関係", min: 120 },
      { name: "関係法令", scope: "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及びクレーン則中の関係条項", min: 60 },
    ],
    jitsugi: [
      { name: "クレーンの運転", scope: "重量の確認　荷のつり上げ　定められた経路による運搬　荷の卸し", min: 180 },
      { name: "クレーンの運転のための合図", scope: "合図の方法", min: 60 },
    ],
    src: "kurenkitei",
    checked: true,
    fromMaster: true,
    fullText: true,
    checkedOn: KOKUJI_118_ON,
    courseId: "crane",
    doc: "docs/67-クレーン（5トン未満）・跨線テルハの根拠と裏取り.md",
  },
  {
    no: 32,
    slug: "overhead_traverser_5t_plus",
    name: "跨線テルハでつり上げ荷重5トン以上のものの運転の業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis:
      "クレーン等安全規則（昭和47年労働省令第34号）第21条第1項／クレーン取扱い業務等特別教育規程 第1条（昭和47年労働省告示第118号）",
    /* **告示の全文で裏を取った**（2026年9月5日・docs/69）。
       科目名・中欄・時間を、規程第1条と一字ずつ突き合わせてある。
       **跨線テルハ（5トン以上）も、クレーン（5トン未満）と同じ規程第1条。**
       だから講座は1本で、目録の2行がそれを指している */
    gakka: [
      { name: "クレーンに関する知識", scope: "種類及び型式　主要構造部分　作動装置　安全装置　ブレーキ機能　取扱い方法", min: 180 },
      { name: "原動機及び電気に関する知識", scope: "電気に関する基礎知識　電動機　開閉器、コントローラー等電気を通ずる機械器具　電路の点検及び補修　感電による危険性", min: 180 },
      { name: "クレーンの運転のために必要な力学に関する知識", scope: "力(合成、分解、つり合い及びモーメント)　重心　荷重　ワイヤロープ、フツク及びつり具の強さ　ワイヤロープの掛け方と荷重との関係", min: 120 },
      { name: "関係法令", scope: "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及びクレーン則中の関係条項", min: 60 },
    ],
    jitsugi: [
      { name: "クレーンの運転", scope: "重量の確認　荷のつり上げ　定められた経路による運搬　荷の卸し", min: 180 },
      { name: "クレーンの運転のための合図", scope: "合図の方法", min: 60 },
    ],
    src: "kurenkitei",
    checked: true,
    fromMaster: true,
    fullText: true,
    checkedOn: KOKUJI_118_ON,
    courseId: "crane",
    doc: "docs/67-クレーン（5トン未満）・跨線テルハの根拠と裏取り.md",
  },
  {
    no: 33,
    slug: "mobile_crane_under_1t",
    name: "つり上げ荷重1トン未満の移動式クレーンの運転の業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis:
      "クレーン等安全規則（昭和47年労働省令第34号）第67条第1項／クレーン取扱い業務等特別教育規程 第2条（昭和47年労働省告示第118号）",
    gakka: [
      { name: "移動式クレーンに関する知識", scope: "種類及び型式　主要構造部分　作動装置　安全装置　ブレーキ機能　取扱い方法", min: 180 },
      /* **ここがクレーンと違う。**据置きのクレーンは「電気に関する基礎知識　電動機…」だが、
         移動式は**内燃機関・蒸気機関・油圧駆動装置**。走って動く機械だから。
         同じ科目名で中身が別。取り違えると、法定の範囲を外した講座になる */
      {
        name: "原動機及び電気に関する知識",
        scope: "内燃機関　蒸気機関　油圧駆動装置　感電による危険性",
        min: 180,
      },
      {
        name: "移動式クレーンの運転のために必要な力学に関する知識",
        scope: "力(合成、分解、つり合い及びモーメント)　重心　荷重　ワイヤロープ、フツク及びつり具の強さ　ワイヤロープの掛け方と荷重との関係",
        min: 120,
      },
      { name: "関係法令", scope: "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及びクレーン則中の関係条項", min: 60 },
    ],
    /* 実技は第1条第3項の準用（「クレーン」を「移動式クレーン」と読み替える） */
    jitsugi: [
      { name: "移動式クレーンの運転", scope: "重量の確認　荷のつり上げ　定められた経路による運搬　荷の卸し", min: 180 },
      { name: "移動式クレーンの運転のための合図", scope: "合図の方法", min: 60 },
    ],
    src: "kurenkitei",
    checked: true,
    fromMaster: true,
    fullText: true,
    checkedOn: KOKUJI_118_ON,
  },
  {
    no: 34,
    slug: "derrick_under_5t",
    name: "つり上げ荷重5トン未満のデリックの運転の業務",
    gakkaMin: 540,
    jitsugiMin: 240,
    basis:
      "クレーン等安全規則（昭和47年労働省令第34号）第107条第1項／クレーン取扱い業務等特別教育規程 第3条（昭和47年労働省告示第118号）",
    /* 告示の字は「デリツク」（小さい「ッ」ではない）。**告示のまま書く** */
    gakka: [
      { name: "デリツクに関する知識", scope: "種類及び型式　主要構造部分　作動装置　安全装置　ブレーキ機能　取扱い方法", min: 180 },
      { name: "原動機及び電気に関する知識", scope: "電気に関する基礎知識　電動機　開閉器、コントローラー等電気を通ずる機械器具　電路の点検及び補修　感電による危険性", min: 180 },
      {
        name: "デリツクの運転のために必要な力学に関する知識",
        scope: "力(合成、分解、つり合い及びモーメント)　重心　荷重　ワイヤロープ、フツク及びつり具の強さ　ワイヤロープの掛け方と荷重との関係",
        min: 120,
      },
      { name: "関係法令", scope: "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及びクレーン則中の関係条項", min: 60 },
    ],
    /* 実技は第1条第3項の準用（「クレーン」を「デリツク」と読み替える） */
    jitsugi: [
      { name: "デリツクの運転", scope: "重量の確認　荷のつり上げ　定められた経路による運搬　荷の卸し", min: 180 },
      { name: "デリツクの運転のための合図", scope: "合図の方法", min: 60 },
    ],
    src: "kurenkitei",
    checked: true,
    fromMaster: true,
    fullText: true,
    checkedOn: KOKUJI_118_ON,
  },
  {
    no: 35,
    slug: "construction_lift",
    name: "建設用リフトの運転の業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis:
      "クレーン等安全規則（昭和47年労働省令第34号）第183条第1項／クレーン取扱い業務等特別教育規程 第4条（昭和47年労働省告示第118号）",
    gakka: [
      {
        name: "建設用リフトに関する知識",
        scope: "種類及び型式　昇降装置　安全装置　ブレーキ機能　取扱い方法",
        min: 120,
      },
      {
        name: "建設用リフトの運転のために必要な電気に関する知識",
        scope: "電気に関する基礎知識　電動機　開閉器等電気を通ずる機械器具　感電による危険性",
        min: 120,
      },
      { name: "関係法令", scope: "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及びクレーン則中の関係条項", min: 60 },
    ],
    jitsugi: [
      {
        name: "建設用リフトの運転及び点検",
        scope: "搬器の昇降の操作　機械部分及び電路の点検",
        min: 180,
      },
      { name: "建設用リフトの運転のための合図", scope: "電鈴等による合図の方法", min: 60 },
    ],
    src: "kurenkitei",
    checked: true,
    fromMaster: true,
    fullText: true,
    checkedOn: KOKUJI_118_ON,
  },
  {
    no: 36,
    slug: "slinging_under_1t",
    name: "つり上げ荷重1トン未満のクレーン等の玉掛けの業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis:
      "クレーン等安全規則（昭和47年労働省令第34号）第222条第1項／クレーン取扱い業務等特別教育規程 第5条（昭和47年労働省告示第118号）",
    /* **告示の全文で裏を取った**（2026年9月5日・docs/69）。
       科目名・中欄・時間を、規程第5条と一字ずつ突き合わせてある */
    gakka: [
      {
        name: "クレーン、移動式クレーン及びデリツクに関する知識",
        scope: "種類及び型式　構造及び機能　安全装置及びブレーキ",
        min: 60,
      },
      {
        name: "クレーン等の玉掛けに必要な力学に関する知識",
        scope: "力(合成、分解、つり合い及びモーメント)　簡単な図形の重心及び物の安定　摩擦　重量　荷重",
        min: 60,
      },
      {
        name: "クレーン等の玉掛けの方法",
        scope: "玉掛用具の選定及び使用の方法　基本動作(安全作業方法を含む。)　合図の方法",
        min: 120,
      },
      { name: "関係法令", scope: "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及びクレーン則中の関係条項", min: 60 },
    ],
    jitsugi: [
      {
        name: "クレーン等の玉掛け",
        scope: "材質又は形状の異なる二以上の物の重量目測　玉掛用具の選定及び玉掛けの方法",
        min: 180,
      },
      {
        name: "クレーン等の運転のための合図",
        scope: "手、小旗等を用いて行なう合図の方法",
        min: 60,
      },
    ],
    src: "kurenkitei",
    checked: true,
    fromMaster: true,
    fullText: true,
    checkedOn: KOKUJI_118_ON,
    courseId: "tamakake",
    doc: "docs/66-玉掛け（1トン未満）の根拠と裏取り.md",
  },
  {
    no: 37,
    slug: "gondola_operation",
    name: "ゴンドラの操作の業務",
    gakkaMin: 300,
    jitsugiMin: 240,
    basis:
      "ゴンドラ安全規則（昭和47年労働省令第35号）第12条第1項／ゴンドラ取扱い業務特別教育規程 第2条・第3条（昭和47年労働省告示第121号）",
    /* **学科（第2条）は告示の全文で確かめた**（2026年9月5日・docs/72）。3科目で300分。

       **実技（第3条）は、二つ目の「ゴンドラの操作のための合図」の時間のところで
       写しが切れていた。**下の 60分は、
         ・目録の実技240分から、一つ目の180分を引いた数
         ・同じ形の建設用リフト（規程第4条）の合図が1時間
       この二つから置いた数字であって、**条文で見た数字ではない。**
       だから **fullText（告示の全文で確かめた印）は付けていない。**
       **合図の時間が載っているところを、もう一度もらうこと。** */
    gakka: [
      {
        name: "ゴンドラに関する知識",
        scope: "種類及び型式　昇降装置　安全装置　ブレーキ機能　取扱い方法",
        min: 120,
      },
      {
        name: "ゴンドラの操作のために必要な電気に関する知識",
        scope: "電気に関する基礎知識　電動機　開閉器等電気を通ずる機械器具　感電による危険性",
        min: 120,
      },
      {
        name: "関係法令",
        scope:
          "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及びゴンドラ安全規則中の関係条項",
        min: 60,
      },
    ],
    jitsugi: [
      {
        name: "ゴンドラの操作及び点検",
        scope: "作業床の昇降の操作　機械部分及び電路の点検",
        min: 180,
      },
      /* **この60分だけ、条文で見ていない**（上のコメント） */
      { name: "ゴンドラの操作のための合図", scope: "電鈴等による合図の方法", min: 60 },
    ],
    src: "roudoukyoku",
    checked: true,
    checkedOn: KOKUJI_121_115_ON,
  },
  {
    no: 38,
    slug: "air_compressor_hyperbaric",
    name: "作業室及び気こう室へ送気するための空気圧縮機を運転する業務",
    gakkaMin: 600,
    jitsugiMin: 120,
    basis:
      "高気圧作業安全衛生規則（昭和47年労働省令第40号）第11条第1項第1号／高気圧業務特別教育規程 第1条（昭和47年労働省告示第129号）",
    /* **規則第11条第2項の表と、告示第1条の表の両方で確かめた**（2026年9月5日・docs/71）。
       元からあった労働局のまとめの時間（学科10時間・実技2時間）とも一致した */
    jikou: [
      "圧気工法の知識に関すること。",
      "送気設備の構造及び取扱いに関すること。",
      "高気圧障害の知識に関すること。",
      "関係法令",
      "空気圧縮機の運転に関する実技",
    ],
    gakka: [
      { name: "圧気工法の知識に関すること。", scope: "圧気工法の概要　圧気工法による業務の危険性　事故発生時の措置", min: 120 },
      {
        name: "送気設備の構造及び取扱いに関すること。",
        scope: "送気設備の種類、構造、取扱い方法及び点検修理の方法　自動警報装置の構造及び取扱い方法",
        min: 240,
      },
      { name: "高気圧障害の知識に関すること。", scope: "高気圧障害の病理、症状及び予防方法", min: 120 },
      { name: "関係法令", scope: "労働基準法、労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及び高圧則中の関係条項", min: 120 },
    ],
    jitsugi: [
      {
        name: "空気圧縮機の運転に関する実技",
        scope: "空気圧縮機の始動及び停止並びに送気を行うバルブ又はコツクの操作",
        min: 120,
      },
    ],
    src: "roudoukyoku",
    checked: true,
    fullText: true,
    checkedOn: KOKUJI_129_ON,
  },
  {
    no: 39,
    slug: "work_chamber_air_valve",
    /* 名前を規則の字に合わせた（「コツク」は告示・省令の書き方） */
    name: "作業室への送気の調節を行うためのバルブ又はコツクを操作する業務",
    gakkaMin: 600,
    jitsugiMin: 120,
    basis:
      "高気圧作業安全衛生規則（昭和47年労働省令第40号）第11条第1項第2号／高気圧業務特別教育規程 第2条（昭和47年労働省告示第129号）",
    jikou: [
      "圧気工法の知識に関すること。",
      "送気及び排気に関すること。",
      "高気圧障害の知識に関すること。",
      "関係法令",
      "送気の調節の実技",
    ],
    gakka: [
      { name: "圧気工法の知識に関すること。", scope: "圧気工法の概要　圧気工法による業務の危険性　事故発生時の措置", min: 120 },
      {
        name: "送気及び排気に関すること。",
        scope: "送気及び排気の方法　緊急時の減圧法　圧気工法に係る設備の種類、取扱い方法及び修理の方法",
        min: 240,
      },
      { name: "高気圧障害の知識に関すること。", scope: "高気圧障害の病理、症状及び予防方法", min: 120 },
      { name: "関係法令", scope: "労働基準法、安衛法、施行令、安衛則及び高圧則中の関係条項", min: 120 },
    ],
    jitsugi: [
      { name: "送気の調節の実技", scope: "送気の調節を行うバルブ又はコツクの操作", min: 120 },
    ],
    src: "roudoukyoku",
    checked: true,
    fullText: true,
    checkedOn: KOKUJI_129_ON,
  },
  {
    no: 40,
    slug: "airlock_air_valve",
    name: "気こう室への送気又は気こう室からの排気の調節を行うためのバルブ又はコツクを操作する業務",
    gakkaMin: 540,
    jitsugiMin: 180,
    basis:
      "高気圧作業安全衛生規則（昭和47年労働省令第40号）第11条第1項第3号／高気圧業務特別教育規程 第3条（昭和47年労働省告示第129号）",
    jikou: [
      "圧気工法の知識に関すること。",
      "加圧及び減圧並びに換気の仕方に関すること。",
      "高気圧障害の知識に関すること。",
      "関係法令",
      "加圧及び減圧並びに換気に関する実技",
    ],
    gakka: [
      { name: "圧気工法の知識に関すること。", scope: "圧気工法の概要　圧気工法による業務の危険性　事故発生時の措置", min: 120 },
      {
        name: "加圧及び減圧並びに換気の仕方に関すること。",
        scope: "加圧及び減圧並びに換気の仕方　緊急時の減圧並びに換気法",
        min: 180,
      },
      { name: "高気圧障害の知識に関すること。", scope: "高気圧障害の病理、症状及び予防方法", min: 120 },
      { name: "関係法令", scope: "労働基準法、安衛法、施行令、安衛則及び高圧則中の関係条項", min: 120 },
    ],
    jitsugi: [
      {
        name: "加圧及び減圧並びに換気に関する実技",
        scope: "加圧及び減圧並びに換気を行うための送気又は排気の調節を行うバルブ又はコツクの操作",
        min: 180,
      },
    ],
    src: "roudoukyoku",
    checked: true,
    fullText: true,
    checkedOn: KOKUJI_129_ON,
  },
  {
    no: 41,
    slug: "diver_air_supply_valve",
    name: "潜水作業者への送気の調節を行うためのバルブ又はコツクを操作する業務",
    gakkaMin: 540,
    jitsugiMin: 120,
    basis:
      "高気圧作業安全衛生規則（昭和47年労働省令第40号）第11条第1項第4号／高気圧業務特別教育規程 第4条（昭和47年労働省告示第129号）",
    jikou: [
      "潜水業務に関する知識に関すること。",
      "送気に関すること。",
      "高気圧障害の知識に関すること。",
      "関係法令",
      "送気の調節の実技",
    ],
    gakka: [
      {
        name: "潜水業務に関する知識に関すること。",
        scope: "潜水業務の基礎知識及び危険性　事故発生時の措置",
        min: 120,
      },
      {
        name: "送気に関すること。",
        scope: "送気の方法　緊急時の減圧法　潜水業務に関する設備の種類、取扱い方法及び修理の方法",
        min: 180,
      },
      { name: "高気圧障害の知識に関すること。", scope: "高気圧障害の病理、症状及び予防方法", min: 120 },
      { name: "関係法令", scope: "労働基準法、安衛法、施行令、安衛則及び高圧則中の関係条項", min: 120 },
    ],
    jitsugi: [
      { name: "送気の調節の実技", scope: "送気の調節を行うバルブ又はコツクの操作", min: 120 },
    ],
    src: "roudoukyoku",
    checked: true,
    fullText: true,
    checkedOn: KOKUJI_129_ON,
  },
  {
    no: 42,
    slug: "hyperbaric_work",
    /* 規則の書き方は「高圧室内業務」。目録の名前もそれに合わせた */
    name: "高圧室内業務",
    gakkaMin: 420,
    jitsugiMin: 0,
    basis:
      "高気圧作業安全衛生規則（昭和47年労働省令第40号）第11条第1項第6号／高気圧業務特別教育規程 第6条（昭和47年労働省告示第129号）",
    /* **規則第11条第2項の表と、告示第6条の表の両方で確かめた**（docs/70・docs/71）。
       六つの業務のうち、**実技が下欄に入っていないのは高圧室内業務だけ。**
       だから実技0分でよい、と条文の側から言える。
       **告示第6条の表にも実技の行は無い。**裏が取れた */
    jikou: [
      "圧気工法の知識に関すること。",
      "圧気工法に係る設備に関すること。",
      "急激な圧力低下、火災等の防止に関すること。",
      "高気圧障害の知識に関すること。",
      "関係法令",
    ],
    /* **告示第6条の表のまま。**科目名は、講座マスターでは
       「急激な圧力の低下、火災等を防止するための措置に関する知識」のように
       言い換えられていたが、**告示の上欄は規則第11条第2項と同じ「〜に関すること。」**。
       告示のままにした。時間（1／1／3／1／1時間）は講座マスターと一致 */
    gakka: [
      {
        name: "圧気工法の知識に関すること。",
        /* 第6条だけ「事故発生時の措置」が中欄に入っていない */
        scope: "圧気工法の概要　圧気工法による業務の危険性",
        min: 60,
      },
      {
        name: "圧気工法に係る設備に関すること。",
        scope: "送気設備の種類及び機能　気閘室の機能　通話装置の取扱い方法",
        min: 60,
      },
      {
        name: "急激な圧力低下、火災等の防止に関すること。",
        scope: "急激な圧力低下による異常出水等の防止方法　火災等の防止方法　事故発生時の措置　保護具の使用方法",
        min: 180,
      },
      { name: "高気圧障害の知識に関すること。", scope: "高気圧障害の病理、症状及び予防方法", min: 60 },
      { name: "関係法令", scope: "労働基準法、安衛法、施行令、安衛則及び高圧則中の関係条項", min: 60 },
    ],
    /* **学科420分・実技なし。**講座マスターの前の版にあった「学科9時間＋実技3時間」は取り消し。
       元からあった目録の420分と、訂正版の講座マスターが一致した（docs/68）。

       **規則の名前と法令番号は、条文（題名と目次）で確かめた**（2026年9月5日）。
         昭和四十七年労働省令第四十号　高気圧作業安全衛生規則
       講座マスターの「高気圧業務安全衛生規則」は誤り。**「作業」が正しい。**

       **特別教育の条番号は、まだ分からない。**目次では
       第三章 業務管理 第一節 作業主任者等（第十条―第十二条）のあたりだが、
       **目次だけでは決められないので書かない**（docs/19 ④）。
       科目と時間の側は、高気圧業務特別教育規程 第6条。 */
    src: "roudoukyoku",
    checked: true,
    fromMaster: true,
    fullText: true,
    checkedOn: KOKUJI_129_ON,
  },
  {
    no: 43,
    slug: "tetraalkyl_lead",
    name: "四アルキル鉛等に係る業務",
    gakkaMin: 360,
    jitsugiMin: 0,
    basis:
      "四アルキル鉛中毒予防規則（昭和47年労働省令第38号）第21条第1項／四アルキル鉛等業務特別教育規程（昭和47年労働省告示第125号）",
    /* **告示の全文で確かめた**（2026年9月5日・docs/73）。
       元からあった労働局のまとめの時間（学科6時間）とも一致した。
       **この告示には条が無い。**一つの表だけでできている。だから根拠に条を書いていない。
       **実技は無い。**6科目が1時間ずつ */
    gakka: [
      {
        name: "四アルキル鉛の毒性",
        scope: "四アルキル鉛の性状　四アルキル鉛中毒の病理及び症状",
        min: 60,
      },
      {
        name: "作業の方法",
        scope: "四アルキル鉛等業務に係るドラムかん及び設備の取扱い方法",
        min: 60,
      },
      {
        name: "保護具の使用方法",
        scope: "四アルキル鉛等業務に係る保護具の種類、性能及び使用方法",
        min: 60,
      },
      {
        name: "洗身等清潔の保持の方法",
        scope: "洗身、保護具の洗浄及び身体等の清潔の保持の方法",
        min: 60,
      },
      {
        name: "事故の場合の退避及び救急処置の方法",
        scope: "合図又は警報の内容及び退避の場所　除毒剤、拡散防止剤及び補修剤の使用方法",
        min: 60,
      },
      {
        name: "その他四アルキル鉛中毒の防止に関し必要な事項",
        scope:
          "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及び四アルキル鉛中毒予防規則中の関係条項　四アルキル鉛中毒を防止するため当該業務について必要な事項",
        min: 60,
      },
    ],
    src: "roudoukyoku",
    checked: true,
    fullText: true,
    checkedOn: KOKUJI_125_469_ON,
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
    courseId: "tokushu",
    doc: "docs/64-特殊化学設備の根拠と裏取り.md",
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
    gakkaMin: 330,
    jitsugiMin: 120,
    basis: "電離放射線障害防止規則第52条の6／核燃料物質等取扱業務特別教育規程 第1条（平成12年労働省告示第1号）",
    gakka: [
      { name: "核燃料物質若しくは使用済燃料又はこれらによって汚染された物に関する知識", min: 60 },
      { name: "加工施設、再処理施設又は使用施設等における作業の方法に関する知識", min: 90 },
      { name: "加工施設、再処理施設又は使用施設等に係る設備の構造及び取扱いの方法に関する知識", min: 90 },
      { name: "電離放射線の生体に与える影響", min: 30 },
      { name: "関係法令", min: 60 },
    ],
    jitsugi: [
      { name: "加工施設、再処理施設又は使用施設等における作業の方法及び同施設に係る設備の取扱い", min: 120 },
    ],
    /* **時間を直した。**元は学科690分・実技360分（労働局のまとめ）。
       訂正版の講座マスターは**学科330分・実技120分**。
       電離則の本文には科目しかなく、時間は**核燃料物質等取扱業務特別教育規程**の側にある。
       **二つの出どころが食い違っているので、checked は付けない**（docs/68） */
    src: "roudoukyoku",
    fromMaster: true,
  },
  {
    no: 49,
    slug: "nuclear_reactor_facility",
    name: "原子炉施設等において核燃料物質等を取り扱う業務",
    gakkaMin: 300,
    jitsugiMin: 120,
    basis: "電離放射線障害防止規則第52条の7／核燃料物質等取扱業務特別教育規程 第2条（平成12年労働省告示第1号）",
    gakka: [
      { name: "核燃料物質若しくは使用済燃料又はこれらによって汚染された物に関する知識", min: 30 },
      { name: "原子炉施設における作業の方法に関する知識", min: 90 },
      { name: "原子炉施設に係る設備の構造及び取扱いの方法に関する知識", min: 90 },
      { name: "電離放射線の生体に与える影響", min: 30 },
      { name: "関係法令", min: 60 },
    ],
    jitsugi: [
      { name: "原子炉施設における作業の方法及び同施設に係る設備の取扱い", min: 120 },
    ],
    src: "roudoukyoku",
    checked: true,
    fromMaster: true,
    checkedOn: MASTER_ON,
  },
  {
    no: 50,
    slug: "accident_radioactive_waste_disposal",
    name: "事故由来放射性物質により汚染されたものの処分の業務",
    gakkaMin: 300,
    jitsugiMin: 120,
    basis: "電離放射線障害防止規則第52条の8／事故由来廃棄物等処分業務特別教育規程（平成25年厚生労働省告示第140号）",
    gakka: [
      { name: "事故由来廃棄物等に関する知識", min: 30 },
      { name: "事故由来廃棄物等の処分の業務に係る作業の方法に関する知識", min: 90 },
      { name: "事故由来廃棄物等の処分の業務に使用する設備の構造及び取扱いの方法に関する知識", min: 60 },
      { name: "電離放射線の生体に与える影響及び被ばく線量の管理の方法に関する知識", min: 60 },
      { name: "関係法令", min: 60 },
    ],
    jitsugi: [
      { name: "事故由来廃棄物等の処分の業務に係る作業の方法及び使用する設備の取扱い", min: 120 },
    ],
    /* 区分ごとの時間は、まだ分からない（告示を見ていない） */
    variants: [{ name: "破砕等" }, { name: "焼却" }, { name: "埋立て" }],
    /* **時間を直した。**元は学科600分・実技360分（労働局のまとめ）。
       訂正版の講座マスターは**学科300分・実技120分**。
       **二つの出どころが食い違っているので、checked は付けない**（docs/68） */
    src: "roudoukyoku",
    fromMaster: true,
  },
  {
    no: 51,
    slug: "special_emergency_radiation_work",
    name: "電離則に定める特例緊急作業に係る業務",
    gakkaMin: 390,
    jitsugiMin: 360,
    basis:
      "電離放射線障害防止規則第52条の9／特例緊急作業特別教育規程（平成27年厚生労働省告示第361号。令和8年厚生労働省告示第44号による改正後）",
    gakka: [
      { name: "特例緊急作業の方法に関する知識", min: 180 },
      { name: "特例緊急作業で使用する施設及び設備の構造及び取扱いの方法に関する知識", min: 120 },
      { name: "電離放射線の生体に与える影響、健康管理の方法及び被ばく線量の管理の方法に関する知識", min: 60 },
      { name: "関係法令", min: 30 },
    ],
    jitsugi: [
      { name: "特例緊急作業の方法", min: 180 },
      { name: "特例緊急作業で使用する施設及び設備の取扱い", min: 180 },
    ],
    src: "roudoukyoku",
    checked: true,
    fromMaster: true,
    checkedOn: MASTER_ON,
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
    courseId: "robotkyoji",
    doc: "docs/61-産業用ロボット（教示等）の根拠と裏取り.md",
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
    courseId: "robotkensa",
    doc: "docs/62-産業用ロボット（検査等）の根拠と裏取り.md",
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
    courseId: "tire",
    doc: "docs/63-自動車用タイヤの空気充てんの根拠と裏取り.md",
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
    gakkaMin: 240,
    jitsugiMin: 90,
    basis:
      "東日本大震災により生じた放射性物質により汚染された土壌等を除染するための業務等に係る電離放射線障害防止規則（平成23年厚生労働省令第152号）第19条第1項／除染等業務特別教育及び特定線量下業務特別教育規程 第1条〜第3条（平成23年厚生労働省告示第469号）",
    /* **ここの科目と時間は、区分のうちいちばん長いもの**
       （土壌等の除染等／除去土壌の収集等／汚染廃棄物の収集等）。
       **特定汚染土壌等取扱業務は、機械の科目が30分になり、実技も1時間**（下の variants）。
       範囲（中欄）も区分ごとに書き分けられているので、ここには長いほうの
       共通部分を入れてある。**講座にするときは、区分ごとに組むこと** */
    gakka: [
      {
        name: "電離放射線の生体に与える影響及び被ばく線量の管理の方法に関する知識",
        scope: "電離放射線の種類及び性質　電離放射線が生体の細胞、組織、器官及び全身に与える影響　被ばく限度及び被ばく線量測定の方法　被ばく線量測定の結果の確認及び記録等の方法",
        min: 60,
      },
      {
        name: "除染等作業の方法に関する知識",
        scope:
          "作業の方法及び順序　放射線測定の方法　外部放射線による線量当量率の監視の方法　汚染防止措置の方法　身体等の汚染の状態の検査及び汚染の除去の方法　保護具の性能及び使用方法　異常な事態が発生した場合における応急の措置の方法",
        min: 60,
      },
      {
        name: "除染等作業に使用する機械等の構造及び取扱いの方法に関する知識",
        scope: "当該業務に係る作業に使用する機械等の構造及び取扱いの方法",
        min: 60,
      },
      {
        name: "関係法令",
        scope: "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及び除染則中の関係条項",
        min: 60,
      },
    ],
    jitsugi: [
      {
        name: "除染等作業の方法及び使用する機械等の取扱い",
        scope:
          "作業　放射線測定器の取扱い　外部放射線による線量当量率の監視　汚染防止措置　身体等の汚染の状態の検査及び汚染の除去　保護具の取扱い　当該作業に使用する機械等の取扱い",
        min: 90,
      },
    ],
    /* **業務区分ごとの時間。告示第2条・第3条の表で確かめた**（2026年9月5日・docs/73）。
       **「除染等業務＝全員一律」という作り方をしないこと。** */
    variants: [
      { name: "土壌等の除染等", gakkaMin: 240, jitsugiMin: 90 },
      { name: "除去土壌の収集等", gakkaMin: 240, jitsugiMin: 90 },
      { name: "汚染廃棄物の収集等", gakkaMin: 240, jitsugiMin: 90 },
      {
        name: "特定汚染土壌等取扱業務",
        gakkaMin: 210,
        jitsugiMin: 60,
        note: "機械の科目が30分（名称及び用途だけ）。実技も1時間",
      },
      {
        name: "特定汚染土壌等取扱業務（線量管理外）",
        gakkaMin: 210,
        jitsugiMin: 60,
        note: "平均空間線量率2.5マイクロシーベルト毎時以下の場所だけで行う人。科目1と2の範囲が短い",
      },
    ],
    /* 元は学科690分・実技390分（労働局のまとめ）だったが、
       **それは一律の法定最低時間ではなかった。**告示が来て決着した */
    src: "roudoukyoku",
    fromMaster: true,
    fullText: true,
    checked: true,
    checkedOn: KOKUJI_125_469_ON,
  },
  {
    no: 62,
    slug: "specified_dose_work",
    name: "特定線量下業務",
    gakkaMin: 150,
    jitsugiMin: 0,
    basis:
      "東日本大震災により生じた放射性物質により汚染された土壌等を除染するための業務等に係る電離放射線障害防止規則（平成23年厚生労働省令第152号）第25条の8第1項／除染等業務特別教育及び特定線量下業務特別教育規程 第4条・第5条（平成23年厚生労働省告示第469号）",
    /* **告示第5条の表で確かめた**（2026年9月5日・docs/73）。学科だけ。合わせて150分。
       **除染等業務（no.61）と違って、業務区分が無い** */
    gakka: [
      {
        name: "電離放射線の生体に与える影響及び被ばく線量の管理の方法に関する知識",
        scope: "電離放射線の種類及び性質　電離放射線が生体の細胞、組織、器官及び全身に与える影響　被ばく限度及び被ばく線量測定の方法　被ばく線量測定の結果の確認及び記録等の方法",
        min: 60,
      },
      {
        name: "放射線測定の方法等に関する知識",
        scope: "放射線測定の方法　外部放射線による線量当量率の監視の方法　異常な事態が発生した場合における応急の措置の方法",
        min: 30,
      },
      {
        name: "関係法令",
        scope: "労働安全衛生法、労働安全衛生法施行令、労働安全衛生規則及び除染則中の関係条項",
        min: 60,
      },
    ],
    src: "roudoukyoku",
    checked: true,
    fromMaster: true,
    fullText: true,
    checkedOn: KOKUJI_125_469_ON,
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
  },
  /* ── ここから下は、あとから条文を読んで見つけて足した行 ──
     no は「あとから変えない」決まりなので、見つけた順に番号を伸ばす。
     並びは42の隣がいいが、番号を詰め替えると、
     すでに配ってある一覧や CSV の番号がずれる。 */
  {
    no: 66,
    slug: "recompression_chamber",
    name: "再圧室を操作する業務",
    /* **時間が決まった。**告示第5条の表（2026年9月5日・docs/71）。
       足すと学科9時間・実技3時間。
       この行を足したときは、告示を見ていなくて 0分（hoursUnknown）だった */
    gakkaMin: 540,
    jitsugiMin: 180,
    basis:
      "高気圧作業安全衛生規則（昭和47年労働省令第40号）第11条第1項第5号／高気圧業務特別教育規程 第5条（昭和47年労働省告示第129号）",
    /* **元の目録（65件）に、この業務が入っていなかった。**
       規則第11条第1項は六つの業務を挙げているのに、目録には五つしか無かった（38〜42）。
       条文を読んで見つけた（2026年9月5日・docs/70）。
       **潜水と圧気工法の現場で、再圧室を操作する人に要る教育。**
       高気圧障害（減圧症）が出たときに使う部屋なので、
       救急再圧法と救急そ生法が事項に入っている。 */
    jikou: [
      "高気圧障害の知識に関すること。",
      "救急再圧法に関すること。",
      "救急そ生法に関すること。",
      "関係法令",
      "再圧室の操作及び救急そ生法に関する実技",
    ],
    gakka: [
      { name: "高気圧障害の知識に関すること。", scope: "高気圧障害の病理、症状及び予防方法", min: 120 },
      {
        name: "救急再圧法に関すること。",
        scope: "再圧室に関する基礎知識　標準再圧治療法",
        min: 180,
      },
      { name: "救急そ生法に関すること。", scope: "人工呼吸法　人工そ生法", min: 120 },
      { name: "関係法令", scope: "労働基準法、安衛法、施行令、安衛則及び高圧則中の関係条項", min: 120 },
    ],
    jitsugi: [
      {
        name: "再圧室の操作及び救急そ生法に関する実技",
        scope: "再圧室の操作を行うバルブ又はコツクの操作　人工呼吸法　人工そ生法",
        min: 180,
      },
    ],
    src: "roudoukyoku",
    checked: true,
    fullText: true,
    checkedOn: KOKUJI_129_ON,
  },
];

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
  hyperbaric_work: "高圧室内 高圧室内作業 高気圧 潜函 ケーソン",
  recompression_chamber: "再圧室 高気圧 潜水 減圧症 潜函病 救急再圧",
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
  /** 学科の科目と時間。「科目 60分／科目 90分」。分かっていなければ空 */
  theory_subjects: string;
  /** 実技の科目と時間。分かっていなければ空 */
  practical_subjects: string;
  /** 業務区分（読点区切り）。ここが空でない行を、一つの固定時間にしない */
  variants: string;
  /** 法令を確かめた日。空なら確かめていない */
  checked_on: string;
  /** 省令の「教育すべき事項」（読点区切り）。分かっていなければ空 */
  jikou: string;
  /** 法定の時間がまだ分からない行。true なら 0分を時間として使わない */
  hours_unknown: boolean;
};

/** 科目と時間を、1行の文字にする。「科目 60分／科目 90分」 */
export const subjectsText = (rows?: { name: string; min: number }[]): string =>
  (rows ?? []).map((r) => `${r.name} ${r.min}分`).join("／");

/** **法定の時間が、まだ分からない行。**0分を法定時間として使わないこと */
export const unknownHours = (t: Tokubetsu): boolean => t.hoursUnknown === true;

/** 省令の「教育すべき事項」が分かっている行 */
export const withJikou = (): Tokubetsu[] => TOKUBETSU.filter((t) => (t.jikou ?? []).length > 0);

/** 業務区分で時間が変わる行か。**ここが true の行を、一つの固定時間で実装しない** */
export const hasVariants = (t: Tokubetsu): boolean => (t.variants ?? []).length > 0;

/** 科目の内訳が入っている行 */
export const withSubjects = (): Tokubetsu[] => TOKUBETSU.filter((t) => !!t.gakka);

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
    theory_subjects: subjectsText(t.gakka),
    practical_subjects: subjectsText(t.jitsugi),
    variants: (t.variants ?? [])
      .map((v) =>
        typeof v.gakkaMin === "number"
          ? `${v.name}（学科${v.gakkaMin}分・実技${v.jitsugiMin ?? 0}分）`
          : v.name,
      )
      .join("、"),
    checked_on: t.checkedOn ?? "",
    jikou: (t.jikou ?? []).join("／"),
    hours_unknown: unknownHours(t),
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
