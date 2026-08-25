"use client";

import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/lib/camera";
import { detectFace, REASON_MSG, type VerifyReason, type VerifyResult } from "@/lib/face";
import { countFaces, isSamePerson, loadFace, readFace } from "@/lib/faceModel";

/* 受講中の照合。
   - カメラあり：3秒間隔で照合し、2回連続で失敗したら停止（SPEC 5章）
   - カメラなし（記録無効で見るだけ）：10分ごとに在席確認
   失敗はサーバへ記録する（画像は送らない）。

   3秒ごとに見るのは「顔が写っているか・何人か」。
   本人かどうか（登録した顔と比べる）は重いので30秒ごと。
   モデルが読み込めていないあいだは、受講そのものを始めさせない。
   見分けが付かないまま時間だけ積み上がるのが、いちばん困るため。 */

/** 照合が通っているときの表示。CamWindow もこの文字で色を変える */
export const OK_STATE = "在席を確認";

const CHECK_INTERVAL_MS = 3000;
/* モデルを回すのは重い（手元の計測で、顔の有無 約0.27秒／本人照合 約0.6秒）。
   毎回まわすと古い端末で受講そのものが重くなるので、間引く。
   塞いだ・暗い・止まっている は毎回の簡易解析で捕まるので、これで足りる。 */
/** 何回に1回、顔があるか見るか（3秒×2＝6秒ごと） */
const MODEL_EVERY = 2;
/** 何回に1回、本人かどうかまで見るか（3秒×10＝30秒ごと） */
const ID_EVERY = 10;
const FAIL_LIMIT = 2;
const PRESENCE_INTERVAL_MS = 10 * 60 * 1000;

export type VerifyStop = { kind: "presence" | "fail"; message: string } | null;

export type ModelState = "off" | "loading" | "ready" | "failed";

export function useVerification({
  lessonId,
  counting,
  useCam,
  registered,
  onStop,
}: {
  lessonId: string;
  counting: boolean;
  useCam: boolean;
  /** 受講の準備で登録した顔の特徴量。端末の中だけにある */
  registered: number[] | null;
  onStop: () => void; // 停止時に再生を止めてもらう
}) {
  const cam = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrame = useRef<Uint8Array | null>(null);
  const miss = useRef(0);
  const [stop, setStop] = useState<VerifyStop>(null);
  const [camState, setCamState] = useState("待機");
  const [model, setModel] = useState<ModelState>("off");
  const turn = useRef(0);
  const stopRef = useRef(stop);
  stopRef.current = stop;

  /* 顔を見分けるモデルを落としてくる。
     済むまで受講は始められない（LessonClient が counting を止める） */
  useEffect(() => {
    if (!useCam) { setModel("off"); return; }
    setModel("loading");
    let alive = true;
    loadFace()
      .then(() => { if (alive) setModel("ready"); })
      .catch(() => { if (alive) setModel("failed"); });
    return () => { alive = false; };
  }, [useCam]);

  /* カメラの起動（同意済みのときだけ） */
  useEffect(() => {
    if (useCam) cam.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCam]);

  useEffect(() => {
    const v = videoRef.current;
    if (!cam.stream || !v) return;
    v.srcObject = cam.stream;
    // display:none の video は autoplay が効かないことがある。明示的に再生する
    v.play().catch(() => {});
  }, [cam.stream]);

  /* 照合ループ */
  useEffect(() => {
    if (!counting || !useCam || !cam.stream || model !== "ready") return;
    const id = setInterval(async () => {
      if (stopRef.current) return;
      turn.current += 1;
      const n = turn.current;
      const r = await checkOnce(videoRef.current, canvasRef.current, prevFrame, registered, {
        face: n % MODEL_EVERY === 0,
        who: n % ID_EVERY === 0,
      });
      if (r.ok) {
        /* 「本人を確認」とは言わない。ここで見ているのは
           画面の前に人が居るかどうかで、本人かどうかではない
           （本人確認は受講の準備で、顔写真と公的書類を登録するとき） */
        setCamState(OK_STATE);
        miss.current = 0;
        return;
      }
      miss.current += 1;
      setCamState(r.msg);
      if (miss.current >= FAIL_LIMIT) {
        miss.current = 0;
        setStop({ kind: "fail", message: r.msg });
        onStop();
        logFail(lessonId, r.reason);
      }
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting, useCam, cam.stream, lessonId, model, registered]);

  /* カメラ同意済みなのに映像が無いまま受講が進むのを防ぐ */
  useEffect(() => {
    if (!counting || !useCam || cam.stream) return;
    const id = setTimeout(() => {
      if (stopRef.current) return;
      setStop({ kind: "fail", message: "カメラが起動していません" });
      onStop();
      logFail(lessonId, "blocked");
    }, 15000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting, useCam, cam.stream, lessonId]);

  /* カメラなしの在席確認 */
  useEffect(() => {
    if (!counting || useCam) return;
    const id = setInterval(() => {
      if (stopRef.current) return;
      setStop({ kind: "presence", message: "" });
      onStop();
    }, PRESENCE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting, useCam]);

  const resume = () => {
    miss.current = 0;
    prevFrame.current = null;
    setStop(null);
  };

  return { cam, videoRef, canvasRef, stop, resume, camState, model };
}

/* 1回ぶんの照合。

   ① 明るさとばらつき（速い）… 暗い・のっぺり・止まっている
   ② 顔があるか、何人か（モデル）
   ③ 登録した本人か（モデル。重いのでたまに）

   ①で落ちるものは②を待たずに返す。手で塞げば①か②で必ず止まる。 */
async function checkOnce(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  prevFrame: { current: Uint8Array | null },
  registered: number[] | null,
  run: { face: boolean; who: boolean },
): Promise<VerifyResult> {
  const rough = await detectFace(video, canvas, prevFrame);
  if (!rough.ok) return rough;

  const fail = (reason: VerifyReason): VerifyResult => ({ reason, ok: false, msg: REASON_MSG[reason] });

  if (run.who) {
    const { count, descriptor } = await readFace(video);
    if (count === 0 || !descriptor) return fail("no_face");
    if (count > 1) return fail("multi_face");
    if (!registered?.length) return { ok: true };
    return isSamePerson(registered, descriptor) ? { ok: true } : fail("not_me");
  }

  if (run.face) {
    const n = await countFaces(video);
    if (n === 0) return fail("no_face");
    if (n > 1) return fail("multi_face");
  }
  return { ok: true };
}

function logFail(lessonId: string, reason: VerifyReason) {
  fetch("/api/verify-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, reason }),
  }).catch(() => {});
  // 端末内にも控えを残す（Supabase 未設定時の確認用）
  try {
    const key = "ashiba.verifyLogs";
    const logs = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    logs.push({ lessonId, reason, msg: REASON_MSG[reason], at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(logs.slice(-200)));
  } catch {
    /* 無視 */
  }
}
