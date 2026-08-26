/* 事業者名の突き合わせ。

   なぜ要るか。
   同じ会社が2つ登録されると、名簿が割れる。
   片方に申し込んだ人が、もう片方を見ている担当者からは見えない。
   前に「申し込みが出ない」で困ったのと同じ形になる。

   ところが会社名の書き方は、人によってばらつく。

     東北三上機材株式会社
     東北三上機材（株）
     東北三上機材(株)
     東北三上機材㈱
     東北三上機材 株式会社

   これは全部おなじ会社。書き方を揃えてから比べる。

   逆に「株式会社山田」と「山田株式会社」は、別の会社のことがある。
   そこまで同じ扱いにすると、本当に別の会社が登録できなくなる。
   なので、
     ・書き方を揃えて**ぴったり同じ**なら、作らせずに申し込みへ回す
     ・法人格を外した所だけ同じなら、「もしかしてこれ？」と候補に出す
   の2段にしてある。

   画面にもデータベースにも触らない、ただの計算。 */

/** 全角の英数記号を半角に、半角カナを全角に */
function width(s: string): string {
  let t = s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  /* 半角カナ。濁点・半濁点は前の字にくっつける */
  const KANA: Record<string, string> = {
    "ｶﾞ": "ガ", "ｷﾞ": "ギ", "ｸﾞ": "グ", "ｹﾞ": "ゲ", "ｺﾞ": "ゴ",
    "ｻﾞ": "ザ", "ｼﾞ": "ジ", "ｽﾞ": "ズ", "ｾﾞ": "ゼ", "ｿﾞ": "ゾ",
    "ﾀﾞ": "ダ", "ﾁﾞ": "ヂ", "ﾂﾞ": "ヅ", "ﾃﾞ": "デ", "ﾄﾞ": "ド",
    "ﾊﾞ": "バ", "ﾋﾞ": "ビ", "ﾌﾞ": "ブ", "ﾍﾞ": "ベ", "ﾎﾞ": "ボ",
    "ﾊﾟ": "パ", "ﾋﾟ": "ピ", "ﾌﾟ": "プ", "ﾍﾟ": "ペ", "ﾎﾟ": "ポ",
    "ｳﾞ": "ヴ",
  };
  const ONE = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｯｬｭｮｰ";
  const TO = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョー";
  for (const [k, v] of Object.entries(KANA)) t = t.split(k).join(v);
  t = [...t].map((c) => {
    const i = ONE.indexOf(c);
    return i >= 0 ? TO[i] : c;
  }).join("");
  return t;
}

/** 法人格の書き方を1つに揃える */
function houjin(s: string): string {
  return s
    .replace(/㈱|\(株\)|（株）/g, "株式会社")
    .replace(/㈲|\(有\)|（有）/g, "有限会社")
    .replace(/㈳|\(社\)|（社）/g, "社団法人")
    .replace(/㈶|\(財\)|（財）/g, "財団法人")
    .replace(/合同会社|\(同\)|（同）/g, "合同会社");
}

/** 突き合わせ用の形。ぴったり同じなら、同じ会社とみなす */
export function normalizeCompany(name: string): string {
  return houjin(width(String(name ?? "")))
    /* 空白・中黒・区切り線は、書き方のゆれでしかない */
    .replace(/[\s　・･,，.．\-ー−―‐]/g, "")
    .toLowerCase();
}

/** 法人格を外した所。「もしかしてこれ？」を探すのに使う */
export function companyCore(name: string): string {
  return normalizeCompany(name)
    .replace(/株式会社|有限会社|合同会社|合資会社|合名会社|社団法人|財団法人|一般社団法人|一般財団法人/g, "");
}

/** 同じ会社とみなすか（書き方のゆれを吸収してぴったり同じ） */
export const sameCompany = (a: string, b: string): boolean =>
  !!normalizeCompany(a) && normalizeCompany(a) === normalizeCompany(b);

/** 似ているか（法人格を外した所が同じ）。候補として出すだけで、止めはしない */
export const likeCompany = (a: string, b: string): boolean => {
  const x = companyCore(a);
  const y = companyCore(b);
  /* 短すぎる名前で拾いすぎないように、2文字以上のときだけ見る */
  return x.length >= 2 && x === y;
};
