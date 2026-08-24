/* 修了証の名義。

   げんきさんから聞いた名義をそのまま入れてある。
   ここに書いておけば Vercel の設定が要らず、手元で確かめるときも同じものが出る。
   会社や責任者が変わったら、この2行を直すか、
   Vercel の環境変数（CERT_ISSUER_NAME / CERT_ISSUER_RESPONSIBLE）で上書きする。

   秘密ではない。刷って配る紙に載る名前そのもの。 */

export const ISSUER_NAME = "東北三上機材株式会社";
export const ISSUER_RESPONSIBLE = "中川元基";

/** 修了証に載せる事業者名 */
export const issuerName = () => process.env.CERT_ISSUER_NAME || ISSUER_NAME;

/** 修了証に載せる教育実施責任者 */
export const issuerResponsible = () =>
  process.env.CERT_ISSUER_RESPONSIBLE || ISSUER_RESPONSIBLE;
