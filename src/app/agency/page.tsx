import Link from "next/link";
import { notFound } from "next/navigation";
import { LpShell } from "@/components/lp/LpShell";
import { membershipEnabled, plansForLp } from "@/lib/membership.server";
import { TERMS, grossOf } from "@/lib/membership";
import { yen } from "@/lib/pricing";

/* 販売代理店の案内（0040・docs/120、指示書 5・12）。
   フェーズ1では「会費の200%のチケット」と、自社の受講への利用まで。
   自社ショップ・協力会社への配布はフェーズ2（docs/119 §9）。**できないことを、できるように書かない** */
export const metadata = { title: "販売代理店のご案内" };
export const dynamic = "force-dynamic";

export default async function AgencyLp() {
  if (!membershipEnabled()) notFound();
  const { plans } = await plansForLp("agency");
  return (
    <LpShell
      eyebrow="販売代理店制度"
      title={<>会費の200%のチケットで、<br />教育を仕入れる。</>}
      lead="元請・資材屋・協力会社を多く抱える会社向け。月額の会費の2倍のチケットが毎月付きます。"
      cta={{ href: "/member", label: "販売代理店について問い合わせる", testid: "lp-agency-cta" }}
    >
      <section>
        <h2>法人会員との違い</h2>
        <p>チケットの率は同じ200%ですが、月額の上限が大きく、協力会社の教育費をまとめて持てる額になっています。</p>
        <div className="card">
          <b style={{ color: "var(--navy)" }}>いまできること（第1段階）</b>
          <div className="sub">自社の受講コードの申込みに、チケットで払う。</div>
        </div>
        <div className="card">
          <b style={{ color: "var(--navy)" }}>準備中（第2段階）</b>
          <div className="sub">協力会社（親会社の下に付く事業者）の受講コードをチケットで払う。代理店ごとの販売ページ。</div>
        </div>
      </section>

      <section>
        <h2>プランと料金</h2>
        <p>税抜。契約期間は{TERMS.contractMonths}か月（自動更新）。チケットは付与から{TERMS.ticketMonthsMax}か月有効です。</p>
        <div data-testid="lp-plans">
          {plans.map((p) => (
            <div key={p.id} className="card" data-testid="lp-plan">
              <div className="plan">
                <span className="name">{p.name}</span>
                <span className="fee">{yen(p.monthlyFee)}<small>／月（税抜）</small></span>
              </div>
              <div className="sub">毎月のチケット <b>{yen(p.ticketAmount)}</b>　税込 {yen(grossOf(p.monthlyFee))}　有効期間 {p.ticketMonths}か月</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>申込みの流れ</h2>
        <div className="steps">
          <div><b>問い合わせる</b>下の連絡先か、法人会員の申込み画面の連絡事項に「販売代理店」と書いてください。</div>
          <div><b>契約書を取り交わす</b>解約・更新・チケットの失効は法人会員と同じ条件です。協力会社への配布は第2段階で定めます。</div>
          <div><b>初月の請求書・入金・チケット付与</b>法人会員と同じ流れです。</div>
        </div>
      </section>

      <section>
        <Link href="/members" className="cta ghost">法人会員の案内を見る</Link>
      </section>
    </LpShell>
  );
}
