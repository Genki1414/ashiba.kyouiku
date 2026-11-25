import { Article, LegalPage } from "@/components/legal/Page";
import { LEGAL_REVISED, seller } from "@/content/legal";
import { hasStripe } from "@/lib/stripe";
import { needsLive, readyCourses, totalNoteOf } from "@/content/courses";
import { BRAND } from "@/content/brand";
import { membershipEnabled } from "@/lib/membership.server";
import { DEFAULT_PARTNER_RATE, TERMS } from "@/lib/membership";

export const metadata = { title: "利用規約" };

/* 事業者の情報とカードの有無は環境変数で変わる。作り置きにしない（2026-09-11） */
export const dynamic = "force-dynamic";

/* 利用規約。げんきさんの確認が要る文言です（docs/12） */
export default function TermsPage() {
  const s = seller();
  /* 対象の講座は決め打ちにしない。
     「足場の特別教育および実務トレーニング」と書いてあったので、
     職長教育を売り始めたときに、規約の対象から外れていた。
     講座を足すたびに規約を直すのは、必ず忘れる。

     **店でも決め打ちにしない。**特別教育ドットコムは実務トレーニングを
     売っていないのに、規約には「および実務トレーニング」と書いてあった。
     売っていないものの利用条件を、売る前に読ませることになる（2026-09-07）。 */
  const courses = readyCourses();
  const names = courses.map((c) => c.name).join("、");
  const training = BRAND.training ? "および実務トレーニング" : "";
  /* 法人会員・営業パートナー（0040・docs/121）。制度を開けている店だけ条を足す。
     足した条のぶん、あとの条番号がずれる（m） */
  const member = membershipEnabled();
  const m = member ? 2 : 0;
  return (
    <LegalPage
      title="利用規約"
      lead={`${s.name}（以下「当社」）が提供する教育（${names}）${training}（以下「本サービス」）の利用条件を定めます。`}
      updated={LEGAL_REVISED}
    >
      <div data-testid="terms">
        <Article n={1} t="適用">
          本規約は、本サービスの利用に関する当社と、受講する事業者およびその受講者（以下あわせて「利用者」）との
          いっさいの関係に適用されます。
        </Article>

        <Article n={2} t="本サービスの内容">
          本サービスは、次の教育をインターネットを通じて提供するものです。
          あわせて、実務の手順を学ぶトレーニングを提供します。
          <br />
          {courses.map((c) => (
            <span key={c.id} className="mt-2 block">
              ・<strong className="text-txt">{c.name}</strong>
              <br />
              　{c.basis.replace(/／/g, "および")}に基づくもののうち、
              <strong className="text-txt">{totalNoteOf(c)}</strong>
              {needsLive(c)
                ? "（討議は、当社が日時を定めてオンラインの同時双方向で行います）"
                : ""}
            </span>
          ))}
          <br />
          <strong className="text-txt">実技については本サービスに含まれません。</strong>
          事業者において別途行ってください。
        </Article>

        <Article n={3} t="受講の申込みと受講コード">
          受講は、事業者が人数分の受講コードを申し込み、受講者がこれを引き換えることにより始まります。
          受講コードは1名につき1枚、他人へ譲り渡すことはできません。
          発行から1年を過ぎた受講コードは使えなくなります。
        </Article>

        <Article n={4} t="料金と支払い">
          料金は申込みの画面に表示します。支払方法は{hasStripe() ? "クレジットカードまたは" : ""}請求書（銀行振込）です。
          請求書払いの場合、支払期限は請求書の発行から1週間です。期限は請求書にも記載します。
          期限までにお振込みの確認が取れない場合、受講いただけません。お申込みを取り消すことがあります。
          <br />
          受講コードの性質上、発行後の返金はお受けできません。
          入金前であれば、申込みの取消を承ります。
        </Article>

        {member && (
          <Article n={5} t="法人会員（月額プラン）とチケット">
            事業者は、月額の会費を支払う法人会員として契約することができます。契約期間は{TERMS.contractMonths}か月とし、
            満了の1か月前までに申し出がない場合、同じ条件で{TERMS.contractMonths}か月更新します。
            <br />
            会費は前払いです。請求書の発行から{TERMS.dueDays}日以内にお支払いください。
            支払期限を{TERMS.suspendAfterDays}日過ぎた場合、入金が確認されるまでチケットを使えません。
            <br />
            会費の入金を確認した月ごとに、プランに定める額のチケットを付与します。チケットは、受講コードの申込みにおいて
            通常価格（税抜）相当額を差し引くために用いるもので、
            <strong className="text-txt">付与から{TERMS.ticketMonthsMax}か月で失効</strong>します。現金への払戻し、他の事業者への譲渡はできません。
            <br />
            途中の解約は{TERMS.cancelNotice}に終了し、以後の会費は請求しません。支払済みの会費は返金しません。
            契約終了時に残っているチケットは失効します。
          </Article>
        )}
        {member && (
          <Article n={6} t="営業パートナー">
            当社が承認した営業パートナーが紹介した事業者が法人会員として会費を支払った場合、当社は、
            当該会費（税抜）の{DEFAULT_PARTNER_RATE}%を報酬として営業パートナーに支払います。報酬は入金を確認した月ごとに確定し、
            {TERMS.payoutRule}で支払います。{TERMS.payoutMin.toLocaleString("ja-JP")}円未満の月は翌月に繰り越します。
            <br />
            紹介元は契約成立の時点で固定します。紹介の紹介（多段）に対する報酬はありません。
            営業パートナーが自ら所属する事業者を紹介することはできません。
            詳細は別に定める業務委託契約書によります。
          </Article>
        )}

        <Article n={5 + m} t="修了証">
          全ての単元の確認問題および修了試験に合格し、かつ受講料の入金が確認できた場合に、
          修了証を発行します。修了証は当社の名義で発行します。
          <br />
          討議のある教育については、上記に加えて討議を修了していることが必要です。
          討議の日は、受講者からの発行申請を受けて当社が候補日をお示しし、
          受講者にお選びいただきます。
          <br />
          修了証に載る氏名・生年月日は受講者ご本人に入力していただきます。
          誤りがあった場合は、当社が取り消したうえで再発行します。
        </Article>

        <Article n={6 + m} t="本人の確認">
          受講中、なりすましを防ぐため、カメラを用いて受講者ご本人が画面の前に居ることを確かめます。
          映像および静止画は端末の外へ出ず、保存もしません。記録するのは
          「確かめられた／確かめられなかった」という結果と、その理由だけです。
        </Article>

        <Article n={7 + m} t="禁止事項">
          利用者は、次の行為をしてはなりません。
          <br />
          （1）受講者本人以外の者に受講させること
          <br />
          （2）受講コードを他人へ譲り渡し、または売ること
          <br />
          （3）本サービスの内容を複製し、または第三者へ配布すること
          <br />
          （4）本サービスの運営を妨げる行為
          <br />
          （5）法令または公序良俗に反する行為
        </Article>

        <Article n={8 + m} t="利用の停止">
          前条に反する行為があった場合、当社は事前の通知なく利用を停止し、
          または発行済みの修了証を取り消すことがあります。この場合、料金は返金しません。
        </Article>

        <Article n={9 + m} t="教材の権利">
          本サービスの教材（音声、図解、事例、問題、画面の意匠を含みます）の権利は当社に帰属します。
          受講の目的を超えて複製・配布することはできません。
        </Article>

        <Article n={10 + m} t="免責">
          当社は、本サービスが法令の定める教育として行われるよう努めますが、
          受講者が現場で行う作業の安全そのものを保証するものではありません。
          <br />
          通信の障害、端末の不具合その他当社の責めに帰さない事由により
          本サービスを利用できなかった場合、当社は責任を負いません。
          <br />
          当社が責任を負う場合であっても、その範囲は当該受講者について
          お支払いいただいた料金の額を上限とします。
        </Article>

        <Article n={11 + m} t="記録の保存">
          事業者が教育を行った記録として、受講の記録は
          <strong className="text-txt">修了の日から3年間</strong>保存します。
          労働安全衛生法第103条および労働安全衛生規則第38条の趣旨によります。
        </Article>

        <Article n={12 + m} t="規約の変更">
          当社は、必要と判断した場合に本規約を変更することがあります。
          変更後の規約は、本ページに掲示した時点から効力を生じます。
        </Article>

        <Article n={13 + m} t="準拠法と管轄">
          本規約は日本法に準拠します。本サービスに関して争いが生じた場合は、
          当社の本店所在地を管轄する裁判所を第一審の専属的合意管轄とします。
        </Article>
      </div>
    </LegalPage>
  );
}
