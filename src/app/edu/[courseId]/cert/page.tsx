import { CertClient } from "./CertClient";

/* 修了証。学科の全単元と修了試験に合格した人だけが開ける */
export default async function CertPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CertClient courseId={courseId} />;
}
