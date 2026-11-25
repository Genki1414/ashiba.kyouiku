"use client";

import { useState } from "react";
import { yen } from "@/lib/pricing";
import { DEFAULT_PARTNER_RATE, simulateCommission, type Plan } from "@/lib/membership";

/* 営業パートナーの報酬シミュレーター（指示書 12）。

   契約数 × 月額（税抜）× 率。**見込み。**確定は入金のあった分だけ。
   式は src/lib/membership.ts（SQL と同じ floor）。ここで別の式を書かない。 */
export function Simulator({ plans, rate = DEFAULT_PARTNER_RATE }: { plans: Pick<Plan, "name" | "monthlyFee">[]; rate?: number }) {
  const [n, setN] = useState(10);
  const [fee, setFee] = useState(plans[1]?.monthlyFee ?? plans[0]?.monthlyFee ?? 10000);
  const r = simulateCommission(n, fee, rate);
  return (
    <div className="card hi" data-testid="lp-sim">
      <div style={{ fontWeight: 900, color: "var(--navy)" }}>報酬シミュレーター</div>
      <div className="sub">紹介した会社が、いまのプランで払い続けたときの見込みです。</div>

      <label style={{ display: "block", marginTop: 12, fontSize: 12, color: "var(--mute)" }}>
        紹介した会社の数　<b style={{ color: "var(--navy)", fontSize: 16 }} data-testid="lp-sim-n">{n}社</b>
      </label>
      <input
        type="range"
        min={1}
        max={50}
        value={n}
        onChange={(e) => setN(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--blue)" }}
        data-testid="lp-sim-range"
        aria-label="紹介した会社の数"
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }} data-testid="lp-sim-plans">
        {plans.map((p) => (
          <button
            key={p.name}
            onClick={() => setFee(p.monthlyFee)}
            style={{
              borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer",
              border: `1.5px solid ${fee === p.monthlyFee ? "var(--blue)" : "var(--line)"}`,
              background: fee === p.monthlyFee ? "var(--blue)" : "#fff",
              color: fee === p.monthlyFee ? "#fff" : "var(--ink)",
            }}
          >
            {p.name} {yen(p.monthlyFee)}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: "var(--mute)" }}>月あたり</div>
          <div className="big" data-testid="lp-sim-monthly">{yen(r.monthly)}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: "var(--mute)" }}>年あたり</div>
          <div className="big" data-testid="lp-sim-yearly">{yen(r.yearly)}</div>
        </div>
      </div>
      <div className="sub" style={{ marginTop: 8 }}>
        {n}社 × {yen(fee)} × {rate}% で計算。報酬は紹介した会社の入金が確認された月ごとに確定します。
      </div>
    </div>
  );
}
