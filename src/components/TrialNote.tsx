/* 無償利用で開いていることを、受講者にも分かるようにする帯。

   受講コードが無いのに開けているのは、運営が「無償利用」を立てているから。
   黙って開けていると、コードの要る仕組みが効いていないように見える。 */
export function TrialNote() {
  return (
    <div
      className="border-b border-line bg-[#1A1F14] px-5 py-2 text-[11.5px] leading-relaxed text-yel"
      data-testid="trial-note"
    >
      無償利用の事業者として開いています（受講コードは使っていません）。
    </div>
  );
}
