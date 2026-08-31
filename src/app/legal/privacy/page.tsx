import { Article, LegalPage } from "@/components/legal/Page";
import { PERSONAL_DATA, THIRD_PARTIES, seller } from "@/content/legal";

export const metadata = { title: "個人情報の取扱い" };

/* 個人情報の取扱い。
   何を預かるかは、実際にデータベースへ入る中身と突き合わせて書いてある
   （src/content/legal.ts の PERSONAL_DATA）。げんきさんの確認が要ります（docs/12）。 */
export default function PrivacyPage() {
  const s = seller();
  return (
    <LegalPage
      title="個人情報の取扱い"
      lead={`${s.name}（以下「当社」）は、本サービスでお預かりする個人情報を次のとおり取り扱います。`}
      updated="2026年8月24日"
    >
      <div data-testid="privacy">
        <Article n={1} t="お預かりするもの">
          <div className="grid gap-0">
            {PERSONAL_DATA.map((d) => (
              <div key={d.k} className="border-t border-line py-2">
                <div className="text-[12.5px] font-bold text-txt">{d.k}</div>
                <div className="text-[12px] text-dim">{d.v}</div>
              </div>
            ))}
          </div>
        </Article>

        <Article n={2} t="使う目的">
          （1）特別教育・職長教育などの教育を行い、その記録を残すため
          <br />
          （2）修了証を発行し、その真偽の照会に応じるため
          <br />
          （3）事業者が自社の受講者の進み具合を確かめるため
          <br />
          （4）受講料の請求と入金の管理のため
          <br />
          （5）本サービスの不具合を直し、使いやすくするため
        </Article>

        <Article n={3} t="顔の照合について">
          受講中、なりすましを防ぐためにカメラを使います。
          <strong className="text-txt">
            映像も静止画も、端末の外へ出ません。保存もしません。
          </strong>
          顔の特徴を数値にしたもの（特徴量）も作らず、残しません。
          <br />
          記録するのは「確かめられた／確かめられなかった」という結果と、
          その理由（顔が写っていない、複数人が写っている、カメラが遮られている、動きがない）だけです。
        </Article>

        <Article n={4} t="事業者への開示">
          受講者の所属する事業者の教育担当者は、その事業者に属する受講者について、
          学科の進み具合・修了試験の結果・実務トレーニングの成績・修了証の発行状況を見ることができます。
          <br />
          <strong className="text-txt">他の事業者の受講者は見られません。</strong>
        </Article>

        <Article n={5} t="外部に渡るもの">
          本サービスは、次の事業者のしくみを使っています。
          <div className="mt-2 grid gap-0">
            {THIRD_PARTIES.map((d) => (
              <div key={d.k} className="border-t border-line py-2">
                <div className="text-[12.5px] font-bold text-txt">{d.k}</div>
                <div className="text-[12px] text-dim">{d.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            これらの事業者のサーバーは日本国外にある場合があります。
            当社は、委託先として適切に監督します。
            <br />
            上記のほか、法令にもとづく場合を除き、ご本人の同意なく第三者へ渡すことはありません。
          </div>
        </Article>

        <Article n={6} t="修了証の照会について">
          証明番号を入れると、その修了証があるかどうかを、ログインなしで確かめられる画面があります。
          元請や監督署の方が確かめるためのものです。
          <br />
          このとき出る氏名は<strong className="text-txt">伏せ字</strong>です
          （例：山○○○）。番号を手当たり次第に入れられても、氏名が分からないようにしてあります。
        </Article>

        <Article n={7} t="端末に残るもの">
          実務トレーニングの成績や途中の状態、音の入切、更新のお知らせを読んだかどうかは、
          お使いの端末の中にも保存されます。ブラウザの設定から消せます。
        </Article>

        <Article n={8} t="保存する期間">
          受講の記録は、修了の日から3年間保存します。
          労働安全衛生法第103条および労働安全衛生規則第38条の趣旨によります。
          <br />
          期間を過ぎたものは、事業者からの求めに応じて消します。
        </Article>

        <Article n={9} t="ご本人からの求め">
          お預かりしている内容の開示・訂正・利用の停止・消去をご希望の場合は、
          下記までご連絡ください。ご本人であることを確かめたうえで応じます。
          <br />
          氏名・生年月日は、修了証を発行するまでは受講者ご自身で直せます。
        </Article>

        <Article n={10} t="連絡先">
          {s.name}
          {s.contact ? `　${s.contact}` : ""}
          <br />
          {s.address || <span className="text-yel">（所在地・未設定）</span>}
          <br />
          {s.tel || <span className="text-yel">（電話番号・未設定）</span>}
          <br />
          {s.email || <span className="text-yel">（メールアドレス・未設定）</span>}
        </Article>
      </div>
    </LegalPage>
  );
}
