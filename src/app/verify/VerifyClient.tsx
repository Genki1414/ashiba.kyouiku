"use client";

import { useState } from "react";
import Link from "next/link";
import { isCertNo } from "@/lib/cert";
import { Btn } from "@/components/ui/Btn";

/* 修了証が本物かを見る画面。
   元請や監督署に「この番号の修了証はあるか」と聞かれたときに使う。 */

type Result =
  | { found: false; reason?: string }
  | { found: true; valid: false; reason: string }
  | { found: true; valid: true; certNo: string; issuedAt: string; name: string; course: string };

const jpDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

export function VerifyClient() {
  const [no, setNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Result | null>(null);

  const go = async () => {
    setR(null);
    if (!isCertNo(no)) {
      setR({ found: false, reason: "証明番号の形が違います。AT-202608-1234 の形で入れてください。" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/verify-cert?no=${encodeURIComponent(no.trim())}`);
      setR((await res.json()) as Result);
    } catch {
      setR({ found: false, reason: "うまく調べられませんでした。" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="px-5 py-8" data-testid="verify">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">
        ← ホーム
      </Link>
      <h1 className="mt-2 text-[19px] font-black">修了証の照会</h1>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">
        修了証に書いてある証明番号を入れてください。
        <br />
        氏名は頭の1文字だけ出ます。手元の修了証と見比べてください。
      </p>

      <div className="mt-5">
        <input
          value={no}
          onChange={(e) => setNo(e.target.value)}
          placeholder="AT-202608-1234"
          autoCapitalize="characters"
          autoCorrect="off"
          data-testid="verify-no"
          className="w-full rounded-lg border border-line bg-panel2 px-3.5 py-3 text-center font-mono text-[17px] tracking-wider placeholder:text-dim2"
        />
        <Btn tone="y" dis={busy} onClick={go} className="mt-3" testid="verify-go">
          {busy ? "…" : "調べる"}
        </Btn>
      </div>

      {r && (
        <div className="mt-5" data-testid="verify-result">
          {r.found && r.valid ? (
            <div className="rounded-xl border border-grn bg-panel p-4">
              <div className="text-[11px] font-extrabold tracking-[2px] text-grn">あります</div>
              <div className="mt-2 grid gap-1.5 text-[13px]">
                <Row k="証明番号" v={r.certNo} mono />
                <Row k="氏名" v={r.name || "（記録なし）"} />
                <Row k="修了日" v={jpDate(r.issuedAt)} />
                <Row k="講習" v={r.course} />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red bg-panel p-4">
              <div className="text-[11px] font-extrabold tracking-[2px] text-red">
                {r.found ? "有効ではありません" : "見つかりません"}
              </div>
              <div className="mt-2 text-[13px] leading-relaxed text-dim">
                {("reason" in r && r.reason) || "その番号の修了証は記録にありません。"}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-[4.5em] flex-none text-dim">{k}</span>
      <span className={mono ? "font-mono" : "font-bold"}>{v}</span>
    </div>
  );
}
