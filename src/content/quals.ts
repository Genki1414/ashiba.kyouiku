/* よそで取った資格の一覧（選ぶ元）。

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

   画面にもデータベースにも触らない、ただの並び。
   増やすときはここに1行足すだけ。id は変えないこと
   （変えると、すでに足した人のものが行方不明になる）。 */

export type QualKind = "特別教育" | "技能講習" | "その他";

export type Qual = {
  id: string;
  /** 画面に出す名前。法令の呼び方に寄せる */
  name: string;
  kind: QualKind;
  /** この仕組みで受けられる講座があるなら、その id */
  courseId?: string;
};

export const QUALS: Qual[] = [
  /* ── 特別教育（安衛則 第36条）── */
  { id: "se-ashiba", name: "足場の組立て等の業務", kind: "特別教育", courseId: "ashiba" },
  { id: "se-harness", name: "フルハーネス型墜落制止用器具を用いる作業", kind: "特別教育" },
  { id: "se-rope", name: "ロープ高所作業", kind: "特別教育" },
  { id: "se-asbestos", name: "石綿使用建築物等の解体等の作業", kind: "特別教育" },
  { id: "se-lowvolt", name: "低圧電気取扱い", kind: "特別教育" },
  { id: "se-grinder", name: "自由研削といしの取替え等", kind: "特別教育" },
  { id: "se-crane5", name: "クレーンの運転（つり上げ荷重5t未満）", kind: "特別教育" },
  { id: "se-sling1", name: "玉掛け（つり上げ荷重1t未満）", kind: "特別教育" },
  { id: "se-lift10", name: "高所作業車の運転（作業床の高さ10m未満）", kind: "特別教育" },
  { id: "se-machine3", name: "小型車両系建設機械（機体重量3t未満）", kind: "特別教育" },
  { id: "se-winch", name: "巻上げ機（ウインチ）の運転", kind: "特別教育" },
  { id: "se-oxygen", name: "酸素欠乏危険作業", kind: "特別教育" },
  { id: "se-dust", name: "粉じん作業", kind: "特別教育" },
  { id: "se-vibration", name: "振動工具取扱い作業", kind: "特別教育" },
  { id: "se-chainsaw", name: "チェーンソーを用いる伐木等の業務", kind: "特別教育" },

  /* ── 技能講習（安衛法 第76条）── */
  { id: "sk-ashiba-chief", name: "足場の組立て等作業主任者", kind: "技能講習" },
  { id: "sk-steel-chief", name: "建築物等の鉄骨の組立て等作業主任者", kind: "技能講習" },
  { id: "sk-form-chief", name: "型枠支保工の組立て等作業主任者", kind: "技能講習" },
  { id: "sk-dig-chief", name: "地山の掘削及び土止め支保工作業主任者", kind: "技能講習" },
  { id: "sk-wood-chief", name: "木造建築物の組立て等作業主任者", kind: "技能講習" },
  { id: "sk-demo-chief", name: "コンクリート造の工作物の解体等作業主任者", kind: "技能講習" },
  { id: "sk-asbestos-chief", name: "石綿作業主任者", kind: "技能講習" },
  { id: "sk-organic-chief", name: "有機溶剤作業主任者", kind: "技能講習" },
  { id: "sk-hai-chief", name: "はい作業主任者", kind: "技能講習" },
  { id: "sk-sling", name: "玉掛け（つり上げ荷重1t以上）", kind: "技能講習" },
  { id: "sk-mcrane", name: "小型移動式クレーン運転（つり上げ荷重5t未満）", kind: "技能講習" },
  { id: "sk-lift", name: "高所作業車運転（作業床の高さ10m以上）", kind: "技能講習" },
  { id: "sk-machine", name: "車両系建設機械（整地・運搬・積込み用及び掘削用）運転", kind: "技能講習" },
  { id: "sk-forklift", name: "フォークリフト運転（最大荷重1t以上）", kind: "技能講習" },
  { id: "sk-gas", name: "ガス溶接", kind: "技能講習" },

  /* ── その他（法令で決まった講習・免許）── */
  { id: "ot-shokucho", name: "職長・安全衛生責任者教育", kind: "その他" },
  { id: "ot-welding", name: "アーク溶接等の業務（特別教育）", kind: "その他" },
  { id: "ot-crane-lic", name: "クレーン・デリック運転士（免許）", kind: "その他" },
  { id: "ot-mobile-lic", name: "移動式クレーン運転士（免許）", kind: "その他" },
  { id: "ot-first-aid", name: "救命講習", kind: "その他" },
];

/** 一覧に無いものを自分で書くときの id */
export const OTHER = "other";

export const findQual = (id: string): Qual | null =>
  QUALS.find((q) => q.id === id) ?? null;

/** 画面に出す名前。一覧に無ければ、本人が書いた名前 */
export const qualName = (id: string, label?: string | null): string =>
  findQual(id)?.name ?? (label ?? "").trim() ?? "";

export const KINDS: QualKind[] = ["特別教育", "技能講習", "その他"];

/** 種類ごとに分ける（画面はこの順で並べる） */
export const byKind = (kind: QualKind) => QUALS.filter((q) => q.kind === kind);
