"use client";

/* ナレーション音声。
   mp3（Storage: audio/{lesson_id}/{seq}.mp3）があればそれを再生し、
   無ければ Web Speech API、どちらも無ければ文字数から起こした無音タイマーで進める。
   narration-all.csv の audio_file（1-1-001.mp3）と同じ採番。 */

const AUDIO_BASE = process.env.NEXT_PUBLIC_AUDIO_BASE || "";

let voice: SpeechSynthesisVoice | null = null;
function ttsOk() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
function pickVoice() {
  if (!ttsOk()) return;
  const vs = window.speechSynthesis.getVoices();
  voice = vs.find((v) => /ja/i.test(v.lang)) ?? null;
}
if (typeof window !== "undefined" && ttsOk()) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function audioUrl(lessonId: string, seq1: number): string | null {
  if (!AUDIO_BASE) return null;
  const seq = String(seq1).padStart(3, "0");
  return `${AUDIO_BASE}/${lessonId}/${seq}.mp3`;
}

/** 1行ぶんを再生する。戻り値は中断関数。 */
export function speakLine(
  lessonId: string,
  seq1: number,
  text: string,
  onEnd: () => void,
): () => void {
  let cancelled = false;
  let innerCancel: (() => void) | null = null;
  const fallback = () => {
    if (cancelled) return;
    speakTts(text, () => !cancelled && onEnd(), (c) => (innerCancel = c));
  };
  const url = audioUrl(lessonId, seq1);
  let el: HTMLAudioElement | null = null;
  if (url) {
    el = new Audio(url);
    el.onended = () => !cancelled && onEnd();
    el.onerror = fallback; // mp3 未生成 → TTS へ
    el.play().catch(fallback);
  } else {
    fallback();
  }
  return () => {
    cancelled = true;
    el?.pause();
    innerCancel?.();
  };
}

function speakTts(text: string, onEnd: () => void, setCancel: (c: () => void) => void) {
  const readMs = Math.max(1800, text.length * 130); // 音声なしで読む場合の目安時間
  if (!ttsOk()) {
    const id = setTimeout(onEnd, readMs);
    setCancel(() => clearTimeout(id));
    return;
  }
  /* speechSynthesis があっても実際には鳴らない環境（webview 等）がある。
     開始も終了も来なければ、字幕タイマーへ落として先へ進める。 */
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 1;
  u.pitch = 1;
  if (voice) u.voice = voice;

  let done = false;
  let started = false;
  const t0 = Date.now();
  const timers: ReturnType<typeof setTimeout>[] = [];
  const finish = () => {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    onEnd();
  };
  /* 音が出ないまま即座に end/error が返る環境では、
     字幕を読む時間を確保してから次の行へ進める */
  const finishAfterReading = () => {
    if (done) return;
    const rest = readMs - (Date.now() - t0);
    if (rest > 200) timers.push(setTimeout(finish, rest));
    else finish();
  };
  u.onstart = () => (started = true);
  u.onend = () => {
    if (Date.now() - t0 < 1000) finishAfterReading();
    else finish();
  };
  u.onerror = finishAfterReading;
  // 2.5秒たっても始まらない → 鳴らない環境。読了タイマーで進める
  timers.push(
    setTimeout(() => {
      if (!started && !done) {
        window.speechSynthesis.cancel();
        timers.push(setTimeout(finish, readMs));
      }
    }, 2500),
  );
  // 始まったのに終わりが来ない場合の保険
  timers.push(setTimeout(finish, readMs * 4 + 8000));

  window.speechSynthesis.speak(u);
  setCancel(() => {
    done = true;
    timers.forEach(clearTimeout);
    window.speechSynthesis.cancel();
  });
}

export function hasTts() {
  return ttsOk();
}
