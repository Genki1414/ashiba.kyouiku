import Link from "next/link";
import { notFound } from "next/navigation";
import { LpShell } from "@/components/lp/LpShell";
import { membershipEnabled, plansForLp } from "@/lib/membership.server";
import { TERMS, grossOf } from "@/lib/membership";
import { yen } from "@/lib/pricing";
import { BRAND } from "@/content/brand";

/* 法人会員の案内（0040・docs/120、指示書 12）。ログイン前の人が読む（authGate で開けてある）。
   制度を開けていない店では無いのと同じ（404） */
export const metadata = { title: "法人会員のご案内" };
export const dynamic = "force-dynamic";

export default async function MembersLp() {
  if (!membershipEnabled()) notFound();
  const { plans } = await plansForLp("member");
  return (
    <LpShell
      eyebrow="法人会員制度"
      title={<>毎月の会費の2倍、<br />教育に使えるチケットが付く。</>}
      lead={`${BRAND.name}の特別教育・職長教育を、月額の固定費で。入社のたびに見積りも請求書も要りません。`}
      cta={{ href: "/member", label: "法人会員に申し込む", testid: "lp-members-cta" }}
    >
      <section>
        <h2>どういう仕組みか</h2>
        <p>毎月の会費（税抜）の2倍の額が、チケットとして毎月付きます。受講コードの申込みにそのチケットで払えます。</p>
        <div className="steps">
          <div><b>プランを選んで申し込む</b>請求書払い。初月の請求書をお送りします。</div>
          <div><b>入金の確認でチケットが付く</b>会費の2倍の額が、その月のチケットになります。</div>
          <div><b>受講コードをチケットで申し込む</b>受講コードの申込み画面に「チケットで払う」が出ます。請求書は出ません。</div>
          <div><b>毎月くり返す</b>翌月分の請求書は月末までに届きます。チケットは付与から{TERMS.ticketMonthsMax}か月で失効します。</div>
        </div>
      </section>

      <section>
        <h2>プランと料金</h2>
        <p>税抜。契約期間は{TERMS.contractMonths}か月（自動更新）。チケットは付与から{TERMS.ticketMonthsMax}か月有効です。</p>
        <div data-testid="lp-plans">
          {plans.map((p, i) => (
            <div key={p.id} className={`card${i === 1 ? " hi" : ""}`} data-testid="lp-plan">
              <div className="plan">
                <span className="name">{p.name}</span>
                <span className="fee">{yen(p.monthlyFee)}<small>／月（税抜）</small></span>
              </div>
              <div className="sub">
                毎月のチケット <b>{yen(p.ticketAmount)}</b>　税込 {yen(grossOf(p.monthlyFee))}　有効期間 {p.ticketMonths}か月
                {p.note ? `　${p.note}` : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>例：スタンダード（月額 10,000円）</h2>
        <table>
          <thead><tr><th>項目</th><th className="n">金額（税抜）</th></tr></thead>
          <tbody>
            <tr><td>年間の会費</td><td className="n">{yen(120000)}</td></tr>
            <tr><td>年間に付くチケット</td><td className="n">{yen(240000)}</td></tr>
            <tr><td>足場の特別教育（4,500円）なら</td><td className="n">約53人分</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--mute)" }}>
          講座ごとの通常価格は <Link href="/legal/tokushoho">特定商取引法に基づく表記</Link> にあります。
          チケットは通常価格（税抜）ぶんを引きます。
        </p>
      </section>

      <section>
        <h2>よくある質問</h2>
        <div className="faq">
          <div><b>受講者の名簿や修了証は今までと同じですか</b>同じです。会社の名簿・受講の記録・修了証の仕組みはそのまま。払い方にチケットが増えるだけです。</div>
          <div><b>チケットが足りない月は</b>足りないぶんは、今までどおり請求書払いかカードで申し込めます。</div>
          <div><b>使わなかったチケットは</b>付与から{TERMS.ticketMonthsMax}か月のあいだ使えます。過ぎると失効し、返金はありません。</div>
          <div><b>解約したいときは</b>{TERMS.cancelNotice}で終了します。以後の会費はかかりません。払った月のチケットは失効日まで使えますが、契約終了時に残っているぶんは失効します。</div>
          <div><b>契約期間は</b>{TERMS.contractMonths}か月です。満了の1か月前までに申し出が無ければ、同じ条件で{TERMS.contractMonths}か月更新します。</div>
          <div><b>会費を払い忘れたら</b>支払期限（請求書の発行から{TERMS.dueDays}日）を{TERMS.suspendAfterDays}日過ぎると、チケットが使えなくなります。入金が確認されると元に戻ります。</div>
          <div><b>会社の登録がまだです</b><Link href="/join">会社とつなぐ</Link> から事業者を登録し、教育担当者になってからお申し込みください。</div>
        </div>
      </section>

      <section>
        <Link href="/member" className="cta" data-testid="lp-members-cta2">法人会員に申し込む</Link>
        <Link href="/agency" className="cta ghost">協力会社の教育もまとめて払う（販売代理店）</Link>
      </section>
    </LpShell>
  );
}
