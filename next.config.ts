import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // handoff/ は仕様参照用。ビルド対象に含めない（tsconfig の exclude と対）

  /* 組み立て物の置き場所。ふだんは .next。
     試験でもう1台サーバを立てるときだけ、環境変数で分ける。
     同じ .next を2台で共有すると、片方が壊れて別の試験が落ちる。 */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
