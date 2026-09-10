import Link from "next/link";
import { BRAND } from "@/content/brand";
import { RequestCourse } from "./RequestCourse";
import { OrderLink } from "./OrderLink";
import { HeldInstead } from "./HeldInstead";

/* 受講コードが無い人に出す画面。

   ただ断るのではなく、何を持っていれば開くのか、
   どこで手に入るのかまで書く。現場で聞ける相手は教育担当者なので、
   そこへ行き着くように書く。

   **断って終わりにしない。**ここは「この講座を受けたい」と
   いちばん強く思っている場所なので、担当者に送る所も置く
   （RequestCourse）。前は送る所が /join にしか無く、
   73講座の中からさっき見ていた講座を探し直す必要があった。

   出すものは店で変わる（src/content/brand.ts）。
   実務トレーニングは足場屋革命だけの売り物なので、
   特別教育ドットコムでは案内しない。

   ── 取得済みの人には、そもそもこの画面を出さない（2026-09-11）──
   げんきさん「取得済みでも押すと講座リクエスト可能になるから、
   取得済み資格はタップで開いたら取得済みの為受講不要などと表示する」。
   もう持っている資格を「受けたい」と担当者に頼めてしまっていた。
   HeldInstead が包んで、持っている人には取得済みの画面に差し替える。 */

export function NeedSeat({ why, company }: { why: "signin" | "seat"; company: string }) {
  if (why === "signin") {
    return (
      <main className="px-5 py-10" data-testid="need-seat">
        <div className="tape -mx-5 mb-6" />
        <h1 className="text-[19px] font-black">ログインが必要です</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim">
          受講の記録を、どなたのものとして残すかを確定するためです。
        </p>
        <Link
          href="/login"
          className="mt-6 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        >
          ログインする
        </Link>
      </main>
    );
  }

  return (
    <HeldInstead>
    <main className="px-5 py-10" data-testid="need-seat">
      <div className="tape -mx-5 mb-6" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">受講コードが必要です</div>
      <h1 className="mt-2 text-[20px] font-black leading-snug">
        受講コードを入力すると
        <br />
        受講を開始できます
      </h1>
      <p className="mt-4 text-[13px] leading-relaxed text-dim">
        特別教育（学科）は、受講コードを入力した方のみ受講できます。
        受講コードは、会社の教育担当者が人数分を申し込み、配布します。
        {company ? `（現在の所属：${company}）` : ""}
      </p>

      {/* 参加コード（8文字）のことは、ここには書かない。
         受講する人にとっては、入れても教材が開かないコードでしかない。
         2種類あると書くと、8文字の方を試して「開かない」と詰まる。
         配るのは担当者の側なので、案内は担当者の画面にだけ置く */}
      <div className="mt-5 rounded-xl border border-line bg-panel p-4 text-[12.5px] leading-relaxed text-dim">
        <div className="mb-1 text-[11px] tracking-[2px] text-dim2">受講コードとは</div>
        <div className="mt-2">
          <span className="font-black text-txt">12文字のコード</span>（例 ABCD-2345-6789）
          <br />
          1名につき1つ。入力すると特別教育（学科）を受講できます。
        </div>
      </div>

      <Link
        href="/join"
        className="mt-5 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        data-testid="need-seat-join"
      >
        受講コードを入れる
      </Link>

      {/* ── 並べる順は、ここに立った人がやることの順 ──

          ① コードを持っている　… 入れる
          ② 持っていない　　　　… **担当者に受講リクエストを送る**
          ③ 自分が担当者　　　　… 申し込む
          ④ どれも今すぐでない　… 実務トレーニングで待つ

          ②がいちばん多い。前はここが**いちばん下**で、
          実務トレーニングの札より後ろにあった（2026-09-09 に直した）。 */}

      {/* 受講リクエストを担当者に送る。どの講座かは住所から取る */}
      <RequestCourse />

      {/* 担当者は、この講座の受講コードを申し込みに来ている。
          /admin へ送ると、名簿や進み具合の中から入口を探すことになる。
          申込みの画面へ**その講座を選んだ状態**で直に送る */}
      <OrderLink />

      {/* 実務トレーニングは別の売り物。第1章はコードが無くても遊べる。
         ここで断られた人に、いま出来ることが何も無いと、そのまま閉じられる。

         **売っている店でだけ出す。**特別教育ドットコムは実務トレーニングを
         売っていない。売っていない店で勧めると、あの店の利用規約が
         対象にしていないものへ連れて行くことになる（2026-09-07 に
         規約から外したばかり）。 */}
      {BRAND.training && (
        <Link
          href="/training"
          className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
          data-testid="need-seat-train"
        >
          実務トレーニングの第1章は、コード無しで遊べます
        </Link>
      )}
      <Link href="/" className="mt-5 block text-center text-[12.5px] text-dim2 no-underline">
        ← ホームへ
      </Link>
    </main>
    </HeldInstead>
  );
}
