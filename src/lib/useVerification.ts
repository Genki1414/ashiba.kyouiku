"use client";

import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/lib/camera";
import { detectFace, REASON_MSG, type VerifyReason, type VerifyResult } from "@/lib/face";
import { countFaces, isSamePerson, loadFace, readFace } from "@/lib/faceModel";
import { CHECK_INTERVAL_MS, ID_EVERY, OK_EVERY, START, step, type Gate } from "@/lib/verifyGate";

/* 受講中の照合。
   - カメラあり：3秒間隔で照合し、2回連続で失敗したら停止（SPEC 5章）
   - カメラなし（記録無効で見るだけ）：10分ごとに在席確認
   失敗はサーバへ記録する（画像は送らない）。

   3秒ごとに見るのは「顔が写っているか・何人か」。
   本人かどうか（登録した顔と比べる）は重いので30秒ごと。
   モデルが読み込めていないあいだは、受講そのものを始めさせない。
   見分けが付かないまま時間だけ積み上がるのが、いちばん困るため。

   顔があるかは毎回見る。間引くと、外れた回と外れていない回が
   交互になって、2回続けて外れることが無くなり、いつまでも止まらない。 */

/** 照合が通っているときの表示。CamWindow もこの文字で色を変える */
export const OK_STATE = "在席を確認";

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
  const gate = useRef<Gate>(START);
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
      const r = await checkOnce(
        videoRef.current,
        canvasRef.current,
        prevFrame,
        registered,
        turn.current % ID_EVERY === 0,
      );
      /* 「本人を確認」とは言わない。ここで見ているのは
         画面の前に人が居るかどうかで、本人かどうかではない
         （本人確認は受講の準備で、顔写真と公的書類を登録するとき） */
      setCamState(r.ok ? OK_STATE : r.msg);
      if (r.ok && turn.current % OK_EVERY === 0) logOk(lessonId);
      gate.current = step(gate.current, r);
      if (gate.current.stop) {
        const why = gate.current.stop;
        gate.current = START;
        setStop({ kind: "fail", message: r.ok ? "" : r.msg });
        onStop();
        logFail(lessonId, why);
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
    gate.current = START;
    prevFrame.current = null;
    setStop(null);
  };

  return { cam, videoRef, canvasRef, stop, resume, camState, model };
}

/* 1回ぶんの照合。

   ① 明るさとばらつき（速い）… 暗い・のっぺり・止まっている
   ② 顔があるか、何人か（モデル。毎回）
   ③ 登録した本人か（モデル。30秒に1回）

   ①で落ちるものは②を待たずに返す。手で塞げば①か②で必ず止まる。 */
async function checkOnce(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  prevFrame: { current: Uint8Array | null },
  registered: number[] | null,
  who: boolean,
): Promise<VerifyResult> {
  const rough = await detectFace(video, canvas, prevFrame);
  if (!rough.ok) return rough;

  const fail = (reason: VerifyReason): VerifyResult => ({ reason, ok: false, msg: REASON_MSG[reason] });

  if (!who) {
    const n = await countFaces(video);
    if (n === 0) return fail("no_face");
    if (n > 1) return fail("multi_face");
    return { ok: true };
  }

  const first = await whoIsThere(video, registered);
  if (first.ok || first.reason !== "not_me") return first;
  /* 別人に見えた。横を向いた一瞬かもしれないので、もう一度だけ確かめる。
     ここで通れば止めない */
  const again = await whoIsThere(video, registered);
  return again.ok ? { ok: true } : fail("not_me");
}

async function whoIsThere(
  video: HTMLVideoElement | null,
  registered: number[] | null,
): Promise<VerifyResult> {
  const fail = (reason: VerifyReason): VerifyResult => ({ reason, ok: false, msg: REASON_MSG[reason] });
  const { count, descriptor } = await readFace(video);
  if (count === 0 || !descriptor) return fail("no_face");
  if (count > 1) return fail("multi_face");
  /* 登録が無い人（前の作りで登録した人）は、顔があることまでで通す。
     次に受講の準備を通ると、そこで登録し直される */
  if (!registered?.length) return { ok: true };
  return isSamePerson(registered, descriptor) ? { ok: true } : fail("not_me");
}

/** 通っていることの控え。5分に1回だけ */
function logOk(lessonId: string) {
  fetch("/api/verify-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, ok: true }),
  }).catch(() => {});
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
