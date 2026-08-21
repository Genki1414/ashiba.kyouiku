"use client";

/* プロトタイプの Btn を移植。tone="y" が黄色の主ボタン */
export function Btn({
  children,
  onClick,
  tone,
  dis,
  className = "",
  testid,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "y";
  dis?: boolean;
  className?: string;
  testid?: string;
}) {
  const base =
    "w-full rounded-lg border p-3.5 text-[14px] font-extrabold transition-colors";
  const look = dis
    ? "border-line bg-panel2 text-dim2 cursor-default"
    : tone === "y"
      ? "border-yel bg-yel text-bg cursor-pointer"
      : "border-line bg-transparent text-txt cursor-pointer";
  return (
    <button onClick={onClick} disabled={dis} data-testid={testid} className={`${base} ${look} ${className}`}>
      {children}
    </button>
  );
}
