"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { claimDevice, wipeDevice } from "@/lib/device";
import { loadMe, readMe, sameMe, type Me } from "@/lib/me";

/* いま誰として使っているか。ログインしていなければ何も出さない。
   端末を人に渡すときに、ここからログアウトできる。

   ここで Supabase の道具を持たない。名前を出すだけのために
   一式（60kBあまり）を積むと、そのぶん開くのが遅くなる。
   誰かは /api/me が返し、ログアウトは /api/signout がやる。

   帯は画面のいちばん上に出るので、あとから出てくると
   その下が全部ずり下がる。前に聞いた名前でまず描いて、
   聞き直したあとで違っていれば書き換える。
   まだ一度も聞いていないときも、高さだけは先に取っておく。 */
/* 帯の作り。受けの箱と同じものを使う（高さがずれない） */
const BAR = "flex items-center gap-2 border-b border-line bg-panel px-5 py-2 text-[11.5px]";

export function AccountBar() {
  /* 描き始めは、前に聞いた答え。無ければ null（高さだけ取る） */
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    /* 覚えているぶんで、まず描く。名前が分かる（ログイン済みの）ときだけ */
    const kept = readMe();
    if (kept?.userId) setMe(kept);

    void loadMe().then((fresh) => {
      if (!alive) return;
      setReady(true);
      if (!fresh?.userId) {
        /* ログインしていない（または Supabase をまだ繋いでいない）。
           覚えが残っていても、それは前の話なので下げる */
        setMe(null);
        return;
      }
      /* 別の画面でログインし直したときの取りこぼしを、ここで拾う。
         人が変わっていれば端末の記録を消して、読み直す */
      if (claimDevice(fresh.userId)) {
        window.location.reload();
        return;
      }
      /* 覚えと違っていたときだけ書き換える（余計な描き直しをしない） */
      if (!sameMe(kept, fresh)) setMe(fresh);
    });
    return () => { alive = false; };
  }, []);

  /* まだ何も分からないあいだ。ホームはログインしていないと開けないので、
     帯は必ず出る。高さだけ先に取って、下がずり下がらないようにする */
  if (!me?.userId) {
    /* 高さを数字で決め打つと、中身を直したときに必ずずれる。
       同じ作りのものを、字だけ見えなくして置く */
    return ready ? null : (
      <div className={BAR} data-testid="account-bar-hold" aria-hidden>
        <span className="invisible">受講者</span>
        <span className="ml-auto invisible rounded border border-line px-2 py-1">ログアウト</span>
      </div>
    );
  }
  const who = { name: me.name, email: me.email };

  const out = async () => {
    await fetch("/api/signout", { method: "POST" }).catch(() => {});
    /* 端末を次の人に渡すためのボタン。
       受講の準備（氏名・顔の特徴量）も、視聴時間も、ここで消す */
    wipeDevice();
    claimDevice(null);
    window.location.href = "/login";
  };

  return (
    <div className={BAR} data-testid="account-bar">
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
