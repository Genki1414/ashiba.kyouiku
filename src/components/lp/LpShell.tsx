import Link from "next/link";
import { seller } from "@/content/legal";
import { BRAND } from "@/content/brand";
import { TERMS } from "@/lib/membership";

/* 会員制度の案内（0040・docs/120）の枠。3枚で同じ見た目。

   指示書「UI/デザイン：白・ネイビー・ブルーを基調」。
   この教材の画面は黒地（現場で見る）だが、案内は会社の事務所で読むものなので白地。
   外枠（.shell）の黒は、この div の白で覆う。下の札（BottomNav）は navHidden で出さない。

   ── 条件（docs/121）──
   げんきさん（2026-11-25）「届出不要な状態にして。他もおすすめの構成で」で決めた。
   字は src/lib/membership.ts の TERMS から出す。2か所に書かない。 */

export function LpShell({
  eyebrow,
  title,
  lead,
  cta,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead: string;
  /** いちばん上の押す所。無ければ出さない */
  cta?: { href: string; label: string; testid?: string };
  children: React.ReactNode;
}) {
  const s = seller();
  return (
    <div className="lp" data-testid="lp">
      <style>{`
        .lp { --navy: #0B1F3A; --blue: #1E5EFF; --blue-lt: #E8EFFF; --ink: #1A2333; --mute: #5B6B82; --line: #D9E1EC; --bg: #F4F7FB;
              background: #fff; color: var(--ink); min-height: 100dvh; font-size: 14px; line-height: 1.75; }
        .lp a { color: var(--blue); }
        .lp .hero { background: var(--navy); color: #fff; padding: 36px 20px 32px; }
        .lp .hero .eyebrow { font-size: 11px; letter-spacing: 3px; color: #9DB4FF; font-weight: 800; }
        .lp .hero h1 { margin: 10px 0 0; font-size: 26px; line-height: 1.35; font-weight: 900; }
        .lp .hero p { margin: 12px 0 0; font-size: 13.5px; color: #CBD6EA; }
        .lp .cta { display: block; margin-top: 20px; background: var(--blue); color: #fff; text-decoration: none; text-align: center;
                   border-radius: 12px; padding: 14px; font-weight: 900; font-size: 15px; }
        .lp .cta.ghost { background: #fff; color: var(--navy); border: 2px solid var(--navy); }
        .lp section { padding: 28px 20px 0; }
        .lp h2 { margin: 0; font-size: 18px; font-weight: 900; color: var(--navy); }
        .lp h2 + p { margin: 8px 0 0; color: var(--mute); font-size: 13px; }
        .lp .card { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin-top: 12px; }
        .lp .card.hi { background: var(--blue-lt); border-color: #B9CCFF; }
        .lp .plan { display: flex; align-items: baseline; gap: 8px; }
        .lp .plan .name { font-weight: 900; font-size: 16px; color: var(--navy); }
        .lp .plan .fee { margin-left: auto; font-weight: 900; font-size: 18px; color: var(--blue); }
        .lp .plan .fee small { font-size: 10.5px; color: var(--mute); font-weight: 400; }
        .lp .sub { color: var(--mute); font-size: 12px; margin-top: 4px; }
        .lp .steps { counter-reset: s; display: grid; gap: 10px; margin-top: 12px; }
        .lp .steps > div { position: relative; padding-left: 40px; }
        .lp .steps > div::before { counter-increment: s; content: counter(s); position: absolute; left: 0; top: 2px; width: 28px; height: 28px;
                                   border-radius: 50%; background: var(--navy); color: #fff; font-weight: 900; display: grid; place-items: center; font-size: 13px; }
        .lp .steps b { display: block; color: var(--navy); }
        .lp .faq div { border-top: 1px solid var(--line); padding: 12px 0; }
        .lp .faq b { display: block; color: var(--navy); }
        .lp .note { margin: 28px 20px 0; padding: 14px 16px; border: 1px dashed var(--line); border-radius: 12px; font-size: 12px; color: var(--mute); }
        .lp footer { margin-top: 28px; padding: 20px 20px 36px; background: var(--bg); border-top: 1px solid var(--line); font-size: 12px; color: var(--mute); }
        .lp footer nav { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 8px; }
        .lp .big { font-size: 24px; font-weight: 900; color: var(--blue); }
        .lp table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
        .lp th, .lp td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); }
        .lp th { color: var(--mute); font-weight: 600; font-size: 11.5px; }
        .lp td.n, .lp th.n { text-align: right; white-space: nowrap; }
      `}</style>

      <header className="hero">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{lead}</p>
        {cta && (
          <Link href={cta.href} className="cta" data-testid={cta.testid}>
            {cta.label}
          </Link>
        )}
      </header>

      {children}

      <div className="note" data-testid="lp-note">
        料金はすべて税抜表示です（消費税10%が加わります）。
        チケットは付与から{TERMS.ticketMonthsMax}か月で失効します。契約期間は{TERMS.contractMonths}か月で、
        満了の1か月前までに申し出が無ければ同じ期間で自動更新します。途中の解約は{TERMS.cancelNotice}で、
        以後の会費はかかりません。会費の返金はなく、契約終了時に残っているチケットは失効します。
        詳しい条件は利用規約・契約書で定めます。
      </div>

      <footer>
        <div style={{ fontWeight: 800, color: "var(--navy)" }}>{s.name}</div>
        {s.address && <div>{s.address}</div>}
        {s.tel && <div>TEL {s.tel}</div>}
        {s.email && <div>{s.email}</div>}
        <nav>
          <Link href="/members">法人会員</Link>
          <Link href="/agency">販売代理店</Link>
          <Link href="/partners">営業パートナー</Link>
          <Link href="/legal/tokushoho">特定商取引法に基づく表記</Link>
          <Link href="/legal/terms">利用規約</Link>
          <Link href="/legal/privacy">個人情報の取扱い</Link>
          <a href="/legal/member-contract.pdf">法人会員利用契約書（PDF）</a>
          <a href="/legal/partner-agreement.pdf">営業パートナー業務委託契約書（PDF）</a>
          <Link href="/">{BRAND.name} へ</Link>
        </nav>
      </footer>
    </div>
  );
}
