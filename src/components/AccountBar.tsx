"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/browser";
import { claimDevice, wipeDevice } from "@/lib/device";

/* いま誰として使っているか。ログインしていなければ何も出さない。
   端末を人に渡すときに、ここからログアウトできる。 */
export function AccountBar() {
  const [who, setWho] = useState<{ name: string; email: string } | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      /* 別の画面でログインし直したときの取りこぼしを、ここで拾う。
         人が変わっていれば端末の記録を消して、読み直す */
      if (claimDevice(u.id)) {
        window.location.reload();
        return;
      }
      const name = (u.user_metadata?.name as string) || "";
      setWho({ name, email: u.email ?? "" });
    });
  }, []);

  if (!who) return null;

  const out = async () => {
    const supabase = getBrowserClient();
    await supabase?.auth.signOut();
    /* 端末を次の人に渡すためのボタン。
       受講の準備（氏名・顔の特徴量）も、視聴時間も、ここで消す */
    wipeDevice();
    claimDevice(null);
    window.location.href = "/login";
  };

  return (
    <div
      className="flex items-center gap-2 border-b border-line bg-panel px-5 py-2 text-[11.5px]"
      data-testid="account-bar"
    >
      <span className="text-dim">受講者</span>
      {/* 名前を押すとマイページ。所属を外すのも、氏名を直すのもそこから */}
      <Link
        href="/me"
        className="min-w-0 truncate font-bold text-txt no-underline"
        data-testid="account-name"
      >
        {who.name || who.email}
      </Link>
      {asking ? (
        <span className="ml-auto flex items-center gap-2">
          <button onClick={out} className="rounded border border-red px-2 py-1 text-ng-tx" data-testid="signout-yes">
            ログアウトする
          </button>
          <button onClick={() => setAsking(false)} className="rounded border border-line px-2 py-1 text-dim">
            やめる
          </button>
        </span>
      ) : (
        <button
          onClick={() => setAsking(true)}
          className="ml-auto rounded border border-line px-2 py-1 text-dim"
          data-testid="signout"
        >
          ログアウト
        </button>
      )}
    </div>
  );
}
