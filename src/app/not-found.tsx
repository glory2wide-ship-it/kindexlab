import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-mono text-xs text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold">종목을 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-muted">상장 폐지됐거나 아직 시세가 없습니다.</p>
      <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">
        지수(INDEX)로 돌아가기
      </Link>
    </div>
  );
}
