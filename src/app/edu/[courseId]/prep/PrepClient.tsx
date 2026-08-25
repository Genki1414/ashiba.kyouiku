"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Btn } from "@/components/ui/Btn";
import { useCamera } from "@/lib/camera";
import { countFaces, faceDistance, loadFace, readFace, SAME_FACE } from "@/lib/faceModel";
import { loadPrep, prepUid, readPrep, writePrep, type PrepState } from "@/lib/prep";

export function PrepClient({ courseId }: { courseId: string }) {
  const router = useRouter();
  /* 点検（tests/e2e-face.mjs）から、本物の判定をそのまま呼べるようにする。
     本番では出さない */
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__face = {
        loadFace, readFace, countFaces, faceDistance, SAME_FACE,
      };
    }
  }, []);
  const back = useSearchParams().get("back");
  const dest = back ? `/edu/${courseId}/${back}` : `/edu/${courseId}`;
  const [prep, setPrep] = useState<PrepState | null>(null);
  const [step, setStep] = useState<"consent" | "enroll">("consent");
  /* 準備は人ごとに分けて持つ。誰として使っているかが分かるまで書けない */
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const id = await prepUid();
      const p = await loadPrep();
      if (!alive) return;
      setUid(id);
      setPrep(p);
      if (p.consentedAt) setStep("enroll");
    })();
    return () => { alive = false; };
  }, []);

  if (!prep || !uid) return null;

  const save = (patch: Partial<PrepState>) => {
    const next = { ...prep, ...patch };
    setPrep(next);
    writePrep(next, uid);
    return next;
  };

  const sendEnrollment = (p: PrepState) => {
    // サーバへは事実（日時・氏名）だけ。顔の特徴量・画像は送らない
    fetch("/api/enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        consented: !!p.consentedAt,
        faceRegistered: p.faceRegistered,
        idDocument: p.idDocument,
        name: p.who.name,
        birth: p.who.birth,
      }),
    }).catch(() => {});
  };

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-4 pt-4">
        <Link href={`/edu/${courseId}`} className="backlink text-[13px] text-dim no-underline">
          ← 科目一覧
        </Link>
      </div>
      {step === "consent" ? (
        <ConsentView
          onNext={() => {
            save({ consentedAt: new Date().toISOString(), skipped: false });
            setStep("enroll");
          }}
          onSkip={() => {
            const p = save({ skipped: true });
            sendEnrollment(p);
            router.push(dest);
          }}
        />
      ) : (
        <EnrollView
          prep={prep}
          save={save}
          onDone={() => {
            sendEnrollment(readPrep(uid));
            router.push(dest);
          }}
        />
      )}
    </main>
  );
}

/* ── 同意（プロトタイプ ConsentView を移植） ── */
function ConsentView({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [ok, setOk] = useState(false);
  const items: [string, string][] = [
    ["利用目的", "受講者の本人確認、および受講中の在席確認のみに使用します"],
    ["保存するもの", "照合の結果（一致・不一致）と、その時刻のみ"],
    ["保存しないもの", "受講中に撮影した映像・静止画は保存しません。端末内で照合し、破棄します"],
    ["登録用の顔写真", "本人確認のために1枚のみ登録します。記録の保存期間が過ぎたら削除します"],
    ["提供先", "所属する事業者の教育担当者のみが記録を閲覧します"],
  ];
  return (
    <div className="px-4 py-4">
      <div className="text-[11px] font-extrabold tracking-[2px] text-cyan">受講の準備　1 / 2</div>
      <h1 className="mb-3 mt-2 text-[21px] font-black leading-snug">カメラの使用について</h1>
      <p className="mb-4 text-[13px] leading-loose text-dim">
        この講座は、受講した事実と受講時間を事業者が確認できるようにするため、受講中にカメラで本人確認を行います。
        法令に基づく特別教育として実施するために必要な措置です。
      </p>
      <div className="mb-3 rounded-xl border border-line bg-panel p-3.5">
        <div className="mb-2 text-[11px] tracking-widest text-yel">取り扱いの内容</div>
        {items.map(([k, v]) => (
          <div key={k} className="mb-2.5">
            <div className="text-[12.5px] font-extrabold">{k}</div>
            <div className="mt-0.5 text-[12.5px] leading-relaxed text-dim">{v}</div>
          </div>
        ))}
      </div>
      <button
        onClick={() => setOk(!ok)}
        className={`mb-3 flex w-full items-center gap-3 rounded-xl border bg-panel px-3.5 py-3 text-left ${
          ok ? "border-cyan" : "border-line"
        }`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[13px] font-black ${
            ok ? "border-cyan bg-cyan text-bg" : "border-line"
          }`}
        >
          {ok ? "✓" : ""}
        </span>
        <span className="text-[13px] leading-relaxed">上記に同意し、カメラの使用を許可します</span>
      </button>
      <Btn tone="y" dis={!ok} onClick={onNext} testid="consent-next">
        次へ（本人確認）
      </Btn>
      <Btn onClick={onSkip} className="mt-2 text-[12.5px] font-normal text-dim" testid="consent-skip">
        カメラを使わずに内容だけ確認する（記録は無効）
      </Btn>
      <p className="mt-3 text-[11px] leading-loose text-dim2">
        ※同意されない場合は、事業所での集合受講（監視者の配置）をご案内します。教育担当者へご連絡ください。
      </p>
    </div>
  );
}

/* ── 本人確認（顔写真・公的書類・受講者情報） ── */
function EnrollView({
  prep,
  save,
  onDone,
}: {
  prep: PrepState;
  save: (p: Partial<PrepState>) => PrepState;
  onDone: () => void;
}) {
  const cam = useCamera();
  const vRef = useRef<HTMLVideoElement>(null);
  const cRef = useRef<HTMLCanvasElement>(null);
  const [shot, setShot] = useState<string | null>(null);
  /* 顔を見分けるモデルの支度。落ちてくるまで登録はできない */
  const [model, setModel] = useState<"loading" | "ready" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  const [ng, setNg] = useState<string>("");

  useEffect(() => {
    if (cam.stream && vRef.current) vRef.current.srcObject = cam.stream;
  }, [cam.stream]);

  useEffect(() => {
    let alive = true;
    loadFace()
      .then(() => alive && setModel("ready"))
      .catch(() => alive && setModel("failed"));
    return () => { alive = false; };
  }, []);

  /* 顔の登録は、本当に顔が写っているか見てから通す。
     ここを素通しにすると、机でも壁でも「登録済み」になってしまい、
     受講中の照合が意味を持たなくなる */
  const capture = async (kind: "face" | "id") => {
    if (!cam.stream || !vRef.current || !cRef.current) return;
    const cv = cRef.current;
    // 確認表示用（保存しない）
    cv.width = 240;
    cv.height = 180;
    cv.getContext("2d")?.drawImage(vRef.current, 0, 0, 240, 180);
    setShot(cv.toDataURL("image/jpeg", 0.6));
    setNg("");
    if (kind !== "face") {
      save({ idDocument: true });
      return;
    }
    setBusy(true);
    try {
      const { count, descriptor } = await readFace(vRef.current);
      if (count === 0 || !descriptor) {
        setNg("顔を読み取れませんでした。明るい所で、正面を向いて撮り直してください。");
        save({ faceRegistered: false, faceDescriptor: null });
        return;
      }
      if (count > 1) {
        setNg("複数人が写っています。お一人で撮り直してください。");
        save({ faceRegistered: false, faceDescriptor: null });
        return;
      }
      save({ faceRegistered: true, faceDescriptor: descriptor });
    } catch {
      setNg("顔の読み取りに失敗しました。電波の届く所でもう一度開いてください。");
      save({ faceRegistered: false, faceDescriptor: null });
    } finally {
      setBusy(false);
    }
  };

  const who = prep.who;
  const whoOk = !!who.name && !!who.birth;
  const allOk = prep.faceRegistered && prep.idDocument && whoOk;

  return (
    <div className="px-4 py-4">
      <div className="text-[11px] font-extrabold tracking-[2px] text-cyan">受講の準備　2 / 2</div>
      <h1 className="mb-1.5 mt-2 text-[21px] font-black leading-snug">本人確認</h1>
      <p className="mb-3.5 text-[13px] leading-relaxed text-dim">
        照合の基準となる顔写真と、顔写真付きの公的書類を登録します。
      </p>

      <div className="mb-3 overflow-hidden rounded-xl border border-line bg-[#0F1318]">
        {cam.stream ? (
          <video ref={vRef} autoPlay playsInline muted className="block w-full -scale-x-100" />
        ) : (
          <div className="px-4 py-8 text-center">
            <div className="mb-2 text-[28px]">📷</div>
            <div className="text-[13px] leading-relaxed text-dim">
              {cam.error ? `カメラを起動できません（${cam.error}）` : "カメラを起動してください"}
            </div>
            <button
              onClick={cam.start}
              data-testid="cam-start"
              className="mt-3 rounded-lg border border-line bg-panel2 px-5 py-2.5 text-[13px] text-txt"
            >
              カメラを起動する
            </button>
          </div>
        )}
        <canvas ref={cRef} className="hidden" />
      </div>

      {ng && (
        <div className="mb-3 rounded-xl border border-red bg-ng-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-ng-tx" data-testid="prep-ng">
          {ng}
        </div>
      )}

      {shot && (
        <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-line bg-panel p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot} alt="" className="w-[72px] -scale-x-100 rounded-md" />
          <div className="text-[12px] leading-relaxed text-dim">
            登録用の画像です。
            <br />
            端末内で特徴量に変換し、照合に使います。画像そのものは送信しません。
          </div>
        </div>
      )}

      {(
        [
          { k: "face" as const, t: "顔写真の登録", d: "正面を向いて、明るい場所で撮影してください", done: prep.faceRegistered },
          { k: "id" as const, t: "公的書類の撮影", d: "運転免許証、マイナンバーカードなど顔写真付きのもの", done: prep.idDocument },
        ]
      ).map((s) => (
        <div
          key={s.k}
          className={`mb-2 rounded-xl border bg-panel px-3.5 py-3 ${s.done ? "border-grn" : "border-line"}`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-[14px] ${s.done ? "text-grn" : "text-dim2"}`}>{s.done ? "✓" : "□"}</span>
            <span className="text-[14px] font-extrabold">{s.t}</span>
          </div>
          <div className="mb-2 mt-1 text-[12px] leading-relaxed text-dim">{s.d}</div>
          <Btn
            tone={s.done ? undefined : "y"}
            dis={!cam.stream || busy || (s.k === "face" && model !== "ready")}
            onClick={() => void capture(s.k)}
            className="p-2.5 text-[13px]"
            testid={`capture-${s.k}`}
          >
            {busy
              ? "顔を読み取っています…"
              : s.k === "face" && model === "loading"
                ? "照合の支度をしています…"
                : s.k === "face" && model === "failed"
                  ? "照合の支度ができません（電波の届く所で開き直してください）"
                  : s.done
                    ? "撮り直す"
                    : cam.stream
                      ? "撮影する"
                      : "先にカメラを起動してください"}
          </Btn>
        </div>
      ))}

      <div className={`mb-2 rounded-xl border bg-panel px-3.5 py-3 ${whoOk ? "border-grn" : "border-line"}`}>
        <div className="mb-1 flex items-center gap-2">
          <span className={`text-[14px] ${whoOk ? "text-grn" : "text-dim2"}`}>{whoOk ? "✓" : "□"}</span>
          <span className="text-[14px] font-extrabold">受講者情報</span>
        </div>
        <div className="mb-2 text-[12px] leading-relaxed text-dim">
          修了証に記載されます。書類のとおりに入力してください。
        </div>
        {(
          [
            ["name", "氏名", "例：山田 太郎"],
            ["birth", "生年月日", "例：1990-04-01"],
            ["company", "事業者名（任意）", "例：〇〇建設工業"],
          ] as const
        ).map(([k, lb, ph]) => (
          <div key={k} className="mb-2">
            <div className="mb-1 text-[11px] text-dim">{lb}</div>
            <input
              value={who[k]}
              onChange={(e) => save({ who: { ...who, [k]: e.target.value } })}
              placeholder={ph}
              data-testid={`who-${k}`}
              className="w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 text-[14px] text-txt placeholder:text-dim2"
            />
          </div>
        ))}
      </div>

      <Btn tone="y" dis={!allOk} onClick={onDone} className="mt-1.5" testid="prep-done">
        {allOk ? "受講を開始する" : "登録が完了していません"}
      </Btn>
      <p className="mt-3 text-[11px] leading-loose text-dim2">
        ※顔写真のない書類では修了証を発行できません。
        <br />
        ※撮影画像は端末内で特徴量に変換し、画像そのものは送信しません。
      </p>
    </div>
  );
}
