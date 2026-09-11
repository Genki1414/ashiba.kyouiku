import { Article, LegalPage } from "@/components/legal/Page";
import { LEGAL_REVISED, PERSONAL_DATA, TRAINING_DATA, THIRD_PARTIES, seller } from "@/content/legal";
import { BRAND } from "@/content/brand";

export const metadata = { title: "個人情報の取扱い" };

/* 環境変数（事業者の情報）を変えたら、配信し直さなくても反映されるように。
   作り置きにすると、Vercel で値を変えても古い表記が出続ける（2026-09-11） */
export const dynamic = "force-dynamic";

/* 個人情報の取扱い。
   何を預かるかは、実際にデータベースへ入る中身と突き合わせて書いてある
   （src/content/legal.ts の PERSONAL_DATA）。げんきさんの確認が要ります（docs/12）。 */
export default function PrivacyPage() {
  const s = seller();
  return (
    <LegalPage
      title="個人情報の取扱い"
      lead={`${s.name}（以下「当社」）は、本サービスでお預かりする個人情報を次のとおり取り扱います。`}
      updated={LEGAL_REVISED}
    >
      <div data-testid="privacy">
        <Article n={1} t="お預かりするもの">
          <div className="grid gap-0">
            {/* 実務トレーニングの記録は、それを売っている店でだけ並べる。
                売っていない店で並べると、預かっていない物を「預かる」と書くことになる */}
            {[...PERSONAL_DATA, ...(BRAND.training ? [TRAINING_DATA] : [])].map((d) => (
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
          学科の進み具合・修了試験の結果・{BRAND.training ? "実務トレーニングの成績・" : ""}修了証の発行状況を見ることができます。
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
          {/* ── 国外への移転（個人情報保護法 第28条）（2026-09-11）──
              「国外にある場合があります」では、どこの国かも、その国の制度も
              分からない。法は、外国の名称・その国の個人情報保護制度・
              相手が講じる措置を本人に分かるようにすることを求めている。
              記録の保管先そのものは日本（東京）。米国法人の仕組みを通る部分だけを書く */}
          <div className="mt-2">
            お預かりした記録は、日本国内（東京）のサーバーに保管します。
            <br />
            画面の配信（Vercel）とカード決済（Stripe）は米国の法人が提供する仕組みのため、
            通信の一部や決済に関する情報は
            <strong className="text-txt">アメリカ合衆国</strong>
            のサーバーを経由することがあります。
            アメリカ合衆国には日本の個人情報保護法にあたる包括的な法制度はなく、
            各社との契約により、日本の法令と同等の保護措置を講じることを約束させています。
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
          {BRAND.training ? "実務トレーニングの成績や途中の状態、音の入切、" : "音の入切、"}
          更新のお知らせを読んだかどうかは、
          お使いの端末の中にも保存されます。ブラウザの設定から消せます。
        </Article>

        <Article n={8} t="保存する期間">
          受講の記録は、修了の日から3年間保存します。
          労働安全衛生法第103条および労働安全衛生規則第38条の趣旨によります。
          <br />
          期間を過ぎたものは、事業者からの求めに応じて消します。
        </Article>

        {/* ── 安全管理措置（個人情報保護法 第32条）（2026-09-11）──
            保有個人データについて、講じている措置を本人が知り得る状態に
            置くことが求められている。**やっていることだけを書く。**
            コードと突き合わせ：通信は TLS、行の見張りは RLS（0002）、
            鍵はサーバの中だけ、顔の映像は端末の外に出ない（第3条）、
            3年を過ぎた記録は運営が消す（RetentionClient） */}
        <Article n={9} t="安全管理措置">
          お預かりした個人情報について、次の措置を講じています。
          <br />
          （1）組織的措置：個人情報を扱う担当者を限定し、教育担当者は自社の受講者の記録だけを、
          運営は業務に必要な範囲だけを見られるようにしています。
          <br />
          （2）人的措置：担当者に対し、個人情報の取扱いについて周知しています。
          <br />
          （3）物理的措置：記録は、入退室が管理されたデータセンターに保管しています。
          当社の事業所に紙や端末で持ち出しません。
          <br />
          （4）技術的措置：通信は暗号化（TLS）し、記録は事業者ごとに区切って
          権限のない人が読めないようにしています。記録を書き換える鍵はサーバーの中だけに置き、
          画面には出しません。顔の映像は端末の外に出しません。
          <br />
          （5）保存期間を過ぎた記録は、個人を特定できる部分を消します。
        </Article>

        <Article n={10} t="ご本人からの求め">
          お預かりしている内容の開示・訂正・利用の停止・消去をご希望の場合は、
          下記までご連絡ください。ご本人であることを確かめたうえで応じます。
          <br />
          氏名・生年月日は、修了証を発行するまでは受講者ご自身で直せます。
        </Article>

        <Article n={11} t="連絡先">
          {s.name}
          {s.contact ? `　${s.contact}` : ""}
          <br />
          {/* 法人は代表者の氏名も公表事項（個人情報保護法 第32条）。
              seller().ceo に入っている（げんきさん 2026-09-11「代表者 中川元基」） */}
          代表者　{s.ceo || <span className="text-yel">（代表者・未設定）</span>}
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
