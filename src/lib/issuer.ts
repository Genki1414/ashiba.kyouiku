/* 修了証の名義。

   この教材は外販するが、特別教育を「実施した」のは東北三上機材株式会社。
   修了証はその名義で出す。受講する会社の名前ではない。
   （受講者がどの会社の人かは companies で分けている。名簿と参加コードの話。
     修了証の名義とは別物）

   会社や責任者が変わったら、この2行を直すか、
   Vercel の環境変数 CERT_ISSUER_NAME / CERT_ISSUER_RESPONSIBLE で上書きする。
   秘密ではない。刷って配る紙に載る名前そのもの。 */

export const ISSUER_NAME = "東北三上機材株式会社";
export const ISSUER_RESPONSIBLE = "中川元基";

/** 修了証に載せる事業者名 */
export const issuerName = () => process.env.CERT_ISSUER_NAME || ISSUER_NAME;

/** 修了証に載せる教育実施責任者 */
export const issuerResponsible = () =>
  process.env.CERT_ISSUER_RESPONSIBLE || ISSUER_RESPONSIBLE;
