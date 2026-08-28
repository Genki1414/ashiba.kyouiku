"use client";
import { useEffect, useRef, useState } from "react";
import type { Lesson } from "@/types/curriculum";
import { Btn } from "@/components/ui/Btn";
import { speakLine, hasTts, audioUrl, voiceName } from "@/lib/audio";
import { NarrationFigure, figureAt } from "./NarrationFigure";

/* ナレーション。script[] を1行ずつ字幕＋音声で進める。
   再生中だけ視聴時間が加算される（親が playing を見て時計を回す）。 */
export function NarrationView({
  lesson,
  line,
  playing,
  onLine,
  onPlaying,
  onFinished,
  devPlus,
}: {
  lesson: Lesson;
  line: number;
  playing: boolean;
  onLine: (n: number) => void;
  onPlaying: (p: boolean) => void;
  onFinished: () => void;
  /** ローカル記録モードの開発用「＋1分」。null なら出さない */
  devPlus: (() => void) | null;
}) {
  const last = line >= lesson.script.length;
  const [audioMode, setAudioMode] = useState<"mp3" | "tts" | "text">("text");
  const [who, setWho] = useState("");

  useEffect(() => {
    setAudioMode(audioUrl(lesson.id, 1) ? "mp3" : hasTts() ? "tts" : "text");
    /* 声は端末が持っているものを選ぶ。読み込みに一拍かかるので、少し待って見る */
    const id = setTimeout(() => setWho(voiceName()), 600);
    return () => clearTimeout(id);
  }, [lesson.id]);

  /* いま話しているところの図解。字幕1行だけ見ているのは、さすがにつらい */
  const figN = figureAt(lesson.figures, line, lesson.script.length);

  /* 1行再生 → 終わったら次の行へ */
  const lineRef = useRef(line);
  lineRef.current = line;
  useEffect(() => {
    if (!playing || last) return;
    const cancel = speakLine(lesson.id, line + 1, lesson.script[line], () => {
      onLine(lineRef.current + 1);
    });
    return cancel;
  }, [playing, line, last, lesson]);

  useEffect(() => {
    if (last) onPlaying(false);
  }, [last]);

  return (
    <div>
      {/* 字幕 */}
      <div className="flex min-h-[76px] items-center gap-3 border-b border-line bg-panel px-4 py-3.5">
        <div
          className={`h-2 w-2 shrink-0 rounded-full ${playing && !last ? "bg-yel pulse" : "bg-line"}`}
        />
        <div className="text-[15px] font-semibold leading-relaxed">
          {last
            ? "この単元の解説は以上です。"
            : playing || line > 0
              ? lesson.script[line]
              : "再生すると、ナレーションが始まります。"}
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="mb-1.5 grid grid-cols-[1.5fr_1fr] gap-2">
          <Btn
            tone={playing ? undefined : "y"}
            onClick={() => {
              if (last) onLine(0);
              onPlaying(!playing);
            }}
          >
            {playing ? "一時停止" : last ? "もう一度再生" : line === 0 ? "再生する" : "続きから"}
          </Btn>
          <Btn
            onClick={() => {
              onPlaying(false);
              onLine(0);
            }}
            className="text-[13px] font-normal text-dim"
          >
            最初から
          </Btn>
        </div>
        <div className="mb-3.5 flex text-[11px] text-dim2">
          <span>
            ナレーション {Math.min(line + 1, lesson.script.length)}/{lesson.script.length}
          </span>
          <span className="ml-auto truncate">
            {audioMode === "mp3"
              ? "音声（収録済み）"
              : audioMode === "tts"
                ? who
                  ? `読み上げ：${who}`
                  : "音声で読み上げます"
                : "字幕のみ"}
          </span>
        </div>

        {/* 聞いている内容の絵。触っても構わないが、
           図解の段を済ませたことにはしない（あとでもう一度ちゃんと通る） */}
        {figN !== null && (
          <div className="mb-4">
            <NarrationFigure
              fig={lesson.figures[figN]}
              index={figN}
              total={lesson.figures.length}
            />
          </div>
        )}

        {line > 0 && (
          <>
            <div className="mb-2 text-[11px] tracking-[2px] text-dim">ここまでの内容</div>
            {lesson.script.slice(Math.max(0, line - 8), line).map((x, i) => (
              <div
                key={`${line}-${i}`}
                className="mb-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-[13px] leading-relaxed text-dim"
              >
                {x}
              </div>
            ))}
            {line > 8 && <div className="mb-2 text-[11px] text-dim2">（直近8件を表示）</div>}
          </>
        )}

        <Btn tone={last ? "y" : undefined} dis={!last} onClick={onFinished} className="mt-2.5">
          {last
            ? lesson.figures.length
              ? "図解へ進む"
              : lesson.cases.length
                ? "災害事例へ進む"
                : "確認問題へ"
            : "解説を最後まで聞いてください"}
        </Btn>

        {devPlus && (
          <Btn onClick={devPlus} className="mt-2 border-dashed text-[12px] font-normal text-dim">
            ＋1分（開発用・端末内記録のみ）
          </Btn>
        )}

        <div className="mt-3.5 text-[11px] leading-relaxed text-dim2">
          規程上の範囲：{lesson.legal_scope}
        </div>
      </div>
    </div>
  );
}
