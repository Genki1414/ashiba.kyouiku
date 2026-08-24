import Link from "next/link";

/* 表記のページの枠。3ページで同じ見た目にする */

export function LegalPage({
  title,
  lead,
  updated,
  children,
}: {
  title: string;
  lead?: string;
  /** 最後に直した日 */
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="px-5 py-8 pb-14">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">
        ← ホーム
      </Link>
      <h1 className="mt-2 text-[19px] font-black">{title}</h1>
      {lead && <p className="mt-2 text-[12.5px] leading-relaxed text-dim">{lead}</p>}
      <div className="mt-5">{children}</div>
      <div className="mt-8 border-t border-line pt-3 text-[11.5px] text-dim2">{updated} 制定</div>
      <LegalNav />
    </main>
  );
}

/** 3ページを行き来する */
export function LegalNav() {
  const links = [
    { href: "/legal/tokushoho", t: "特定商取引法に基づく表記" },
    { href: "/legal/terms", t: "利用規約" },
    { href: "/legal/privacy", t: "個人情報の取扱い" },
  ];
  return (
    <nav className="mt-4 grid gap-2" data-testid="legal-nav">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-lg border border-line p-2.5 text-center text-[12px] text-dim no-underline"
        >
          {l.t}
        </Link>
      ))}
    </nav>
  );
}

/** 見出しと本文の組。規約はこれを並べる */
export function Article({ n, t, children }: { n: number; t: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-[14px] font-black">
        第{n}条（{t}）
      </h2>
      <div className="mt-1.5 text-[12.5px] leading-[1.95] text-dim">{children}</div>
    </section>
  );
}
