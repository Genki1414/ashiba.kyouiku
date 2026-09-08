import Link from "next/link";
import { COURSES, hoursText, splitMenu, textOf, totalNoteOf, type CourseMeta } from "@/content/courses";
import { loadedCourses } from "@/lib/curriculum";
import { AccountBar } from "@/components/AccountBar";
import { HomeCards } from "@/components/HomeCards";
import { FirstSteps } from "@/components/FirstSteps";
import { Notices } from "@/components/Notices";
import { OtherTokubetsu } from "@/components/OtherTokubetsu";
import { CourseDrawer } from "@/components/CourseDrawer";
import { tokubetsuOfCourse } from "@/content/tokubetsu";
import { BRAND } from "@/content/brand";

/* ここはサーバ側で誰かを見ていない（立場ごとの出し分けは HomeCards が
   あとから聞きに行く）。作り置きにしておけば、開いた瞬間に出る */
export const revalidate = 3600;

/* 平らな一覧の並び順。**法令（目録）の号順にする。**

   COURSES の並びは足場屋革命の看板順で、足場がいちばん上にある。
   そのまま特別教育ドットコムに出すと、塗装屋さんや解体屋さんが開いて
   最初に見るのが足場になる。「足場屋のところか」と読まれる。

   売り文句で決めずに、法令の号順に置く。うちの都合が入らないし、
   下に並ぶ「まだ作っていない目録」と同じ順になるので、探すときに迷わない。
   目録に無いもの（職長教育）は先頭。特別教育ではないので号を持たない */
const flatOrder = (list: CourseMeta[]): CourseMeta[] =>
  [...list].sort((a, b) =>
    (tokubetsuOfCourse(a.id)?.no ?? 0) - (tokubetsuOfCourse(b.id)?.no ?? 0));

export default async function Home() {
  /* 特別教育は種類が増えていく。受けられるものを並べる */
  const all = await loadedCourses();
  /* 「その他特別教育」に入れた講座（menu: "other"）は、大きな札には出さない。
     足場を受けに来た人の一覧を長くしないため（courses.ts の menu）。
     ただし**開いた中には必ず出す。** 出し忘れると、受けられるのに
     行き着けない講座ができる（石綿でそうなった） */
  /* main … 大きな札で出すもの（足場・職長）。other … 「その他特別教育」に畳むもの。
     名前を ready にしない。**OtherCourses に渡す配列と同じ名前にすると、
     「その他の中身を自分で並べていないか」の見張りが見分けられなくなる** */
  const { main: mainCourses, other: otherReady } = splitMenu(all);
  const soon = COURSES.filter((c) => !c.ready);
  return (
    <main>
      <div className="tape" />
      <AccountBar />
      <div className="px-5 pt-10 pb-6">
        <div className="text-[11px] tracking-[3px] text-yel font-extrabold">{BRAND.eyebrow}</div>
        <h1 className="mt-2 text-[22px] font-black leading-snug">{BRAND.name}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          {BRAND.lead[0]}
          <br />
          {BRAND.lead[1]}
        </p>
      </div>

      <div className="grid gap-3 px-5 pb-10">
        {/* はじめて使う人への道のり。講座の札より**上**に置く。
            初めての人がまずやるのは、大きく出ている講座の札を押すこと。
            受講コードが無いとその先で断られるので、押す前に道のりを見せる。
            受講できるようになったら、自分で消える */}
        {/* こちらからの返事。**はじめかたより上**に置く。
            返事が返るのは待っているときなので、いちばん先に目に入る所へ。
            1件も無ければ、自分で消える */}
        <Notices />

        <FirstSteps />

        {/* 講座の並べ方は店で変わる（src/content/brand.ts）。

            足場屋革命は、足場と職長を大きな札で出して、残りを
            「その他特別教育」に畳む。足場を受けに来た人の一覧を長くしないため。

            特別教育ドットコムは業種を選ばない。どれかを上に置くと、
            その業種以外の人には邪魔になるだけなので、**足場も含めて**
            73講座を平らに並べ、探す窓ひとつで選んでもらう。 */}
        {BRAND.flatList ? (
          /* 73枚をいきなり並べると、開いた瞬間に画面が札で埋まる。
             押して開く（げんきさん 2026-09-07） */
          <CourseDrawer
            title="受けられる講座"
            ready={flatOrder(all.filter((c) => c.ready))}
            soon={flatOrder(soon)}
          />
        ) : (
        mainCourses.map((c) => (
          <Link
            key={c.id}
            href={`/edu/${c.id}`}
            className="block rounded-xl border border-yel bg-panel p-5 no-underline"
            data-testid="home-course"
          >
            {/* 札は講座の種類から出す。決め打ちにすると、
               職長教育に「特別教育」と書いた札が付く */}
            <div className="text-[11px] font-extrabold tracking-widest text-yel">
              {textOf(c).label}
            </div>
            <div className="mt-1 text-[17px] font-black leading-snug text-txt">{c.name}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-dim">
              {c.basis}
              <br />
              {/* 「学科」で決め打ちにしていたので、討議まで含む職長教育にも
                  「学科 計14時間」と出ていた。時間も Math.round では
                  半端のある講座で法定時間とずれる（/edu と同じ直し） */}
              {totalNoteOf(c)} 計{hoursText(c.totalMin)}
            </div>
          </Link>
        )))}

        {/* 法令で決まっている特別教育の目録。教育の札のすぐ下に置く。

            前は講座の一覧（/edu）にだけ置いていたが、**ホームの札は
            各講座へ直接飛ぶ**ので、一覧に辿り着く道がどこにも無かった。
            置いたのに誰にも見えていなかった。人が見ているのはホーム。 */}
        {!BRAND.flatList && <OtherTokubetsu ready={otherReady} />}

        {/* 実務トレーニングは足場を組むゲーム。足場屋さん以外には要らない */}
        {BRAND.training && (
        <Link
          href="/training"
          className="block rounded-xl border border-line bg-panel p-5 no-underline"
        >
          <div className="text-[11px] font-extrabold tracking-widest text-cyan">実務トレーニング</div>
          <div className="mt-1 text-[17px] font-black text-txt">足場を組むゲーム</div>
          <div className="mt-2 text-[12px] leading-relaxed text-dim">
            作業員を動かして足場を組む。手を間違えると親方に叱られる。
            <br />
            第1章 段取りと根がらみ／第2章 高所作業／第3章 火打とシート
          </div>
        </Link>
        )}

        {/* これから増える講座。何が来るのかが分かるように名前だけ出す */}
        {!BRAND.flatList && !!soon.length && (
          <div className="rounded-xl border border-line bg-bg p-4" data-testid="home-soon">
            <div className="text-[11px] tracking-[2px] text-dim">これから増える講座</div>
            <ul className="mt-1.5 grid gap-1 text-[12.5px] leading-relaxed text-dim2">
              {soon.map((c) => (
                <li key={c.id}>・{c.name}（準備中）</li>
              ))}
            </ul>
          </div>
        )}

        {/* 立場によって出すもの（会社とつなぐ／教育担当者／運営）*/}
        <HomeCards />
      </div>

      {/* 売るために要る表記。買う前に読めるところに置く */}
      <div className="border-t border-line px-5 py-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11.5px]">
          <Link href="/legal/tokushoho" className="text-dim no-underline">
            特定商取引法に基づく表記
          </Link>
          <Link href="/legal/terms" className="text-dim no-underline">
            利用規約
          </Link>
          <Link href="/legal/privacy" className="text-dim no-underline">
            個人情報の取扱い
          </Link>
          {/* 更新のお知らせの一覧。**前は実務トレーニングの画面にしか無かった。**
              あれは足場屋革命だけの売り物なので、特別教育ドットコムでは
              お知らせを一度閉じたら二度と読めなかった（2026-09-08）。
              どちらの店にもあるホームの足元に置く */}
          <Link href="/updates" className="text-dim no-underline">
            更新のお知らせ
          </Link>
        </div>
      </div>
    </main>
  );
}
