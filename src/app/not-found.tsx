import Link from "next/link";

/* 無い画面。

   これが無いと Next の既定が出る。白い画面に英語で
   「404 This page could not be found.」だけ。戻る所も無い。
   現場で開くものなので、日本語で、行き先を出す。

   ここに来るのは打ち間違いだけではない。
   ・学科だけの講座で /drill を開いた（実技が無いので無い）
   ・職長以外で /talk を開いた（討議が無いので無い）
   ・古いお気に入りや、人から回ってきた古い行き先
   どれも「壊れた」ではなく「その画面は無い」なので、そう書く。 */
export const metadata = { title: "その画面はありません" };

export default function NotFound() {
  return (
    <main className="px-5 py-8" data-testid="notfound">
      <div className="tape -mx-5 mb-6" />
      <h1 className="text-[18px] font-black">その画面はありません</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-dim">
        行き先が間違っているか、その講座には無い画面です。
        実技のない講座に実技の画面は無く、職長教育以外に討議の画面はありません。
      </p>
      <div className="mt-6 grid gap-2.5">
        <Link
          href="/"
          data-testid="notfound-home"
          className="block w-full rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        >
          ホームへ
        </Link>
        <Link
          href="/edu"
          data-testid="notfound-edu"
          className="block w-full rounded-lg border border-line p-3.5 text-center text-[14px] font-extrabold text-txt no-underline"
        >
          講座の一覧へ
        </Link>
      </div>
    </main>
  );
}
