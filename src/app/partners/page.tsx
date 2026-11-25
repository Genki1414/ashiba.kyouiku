import Link from "next/link";
import { notFound } from "next/navigation";
import { LpShell } from "@/components/lp/LpShell";
import { Simulator } from "@/components/lp/Simulator";
import { membershipEnabled, plansForLp } from "@/lib/membership.server";
import { DEFAULT_PARTNER_RATE, commissionOf } from "@/lib/membership";
import { yen } from "@/lib/pricing";

/* 営業パートナーの案内（0040・docs/120、指示書 7・12）。
   報酬は紹介した会社の月額（税抜）× 率、入金のあった月ごとに確定。多段なし。
   支払い時期・契約終了後の扱いは **契約書で定める**（§16）。ここでは決め打ちしない */
export const metadata = { title: "営業パートナーのご案内" };
export const dynamic = "force-dynamic";

export default async function PartnersLp() {
  if (!membershipEnabled()) notFound();
  const { plans } = await plansForLp("member");
  const std = plans.find((p) => p.monthlyFee === 10000) ?? plans[1] ?? plans[0];
  return (
    <LpShell
      eyebrow="営業パートナー制度"
      title={<>紹介した会社が払い続けるかぎり、<br />報酬も続く。</>}
      lead="法人会員を紹介してください。その会社の月額会費（税抜）の30%が、入金のあった月ごとに報酬として確定します。"
      cta={{ href: "/partner", label: "営業パートナーに登録する", testid: "lp-partners-cta" }}
    >
      <section>
        <h2>仕組み</h2>
        <div className="steps">
          <div><b>登録する</b>個人でも法人でも。運営が承認すると、あなたの紹介コードと URL が使えます。</div>
          <div><b>紹介する</b>URL を押した会社、またはコードを打った会社の申込みに、あなたの紹介が付きます。</div>
          <div><b>入金のたびに確定</b>紹介した会社の月額（税抜）× {DEFAULT_PARTNER_RATE}% が、入金が確認された月ごとに確定します。</div>
          <div><b>続く</b>その会社が会員でいるあいだ、毎月。紹介の紹介（多段）はありません。</div>
        </div>
      </section>

      <section>
        <h2>例</h2>
        <table data-testid="lp-partners-table">
          <thead><tr><th>紹介した会社</th><th className="n">月あたり</th><th className="n">年あたり</th></tr></thead>
          <tbody>
            {[1, 5, 10, 20].map((n) => {
              const m = n * commissionOf(std?.monthlyFee ?? 10000, DEFAULT_PARTNER_RATE);
              return (
                <tr key={n}>
                  <td>{n}社（{std?.name ?? "スタンダード"} {yen(std?.monthlyFee ?? 10000)}）</td>
                  <td className="n">{yen(m)}</td>
                  <td className="n">{yen(m * 12)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Simulator plans={plans.map((p) => ({ name: p.name, monthlyFee: p.monthlyFee }))} rate={DEFAULT_PARTNER_RATE} />
      </section>

      <section>
        <h2>よくある質問</h2>
        <div className="faq">
          <div><b>自分の会社を紹介できますか</b>できません。自分の紹介コードは自分の会社の申込みには使えません。</div>
          <div><b>紹介元はあとから変わりますか</b>契約が成立した時点で固定されます。変える必要があるときは運営が理由を残して変えます。</div>
          <div><b>見込みと確定の違いは</b>見込みは「いまの契約が払い続けたら」の額。確定は入金が確認された分だけで、画面では別の数字として出ます。</div>
          <div><b>報酬の支払い時期や、契約が終わったあとの扱いは</b>業務委託契約書で定めます。登録のあとにお送りします。</div>
        </div>
      </section>

      <section>
        <Link href="/partner" className="cta" data-testid="lp-partners-cta2">営業パートナーに登録する</Link>
        <Link href="/members" className="cta ghost">法人会員の案内を見る</Link>
      </section>
    </LpShell>
  );
}
