"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error || `로그인 실패 (${res.status})`);
          return;
        }
        router.replace("/admin");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-line bg-panel px-6 py-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">KinDex · Ops</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">관리자 로그인</h1>
        <p className="mt-2 text-sm text-muted">
          설정한 관리자 비밀번호를 입력하세요. 로그인 후 30일간 유지됩니다.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm text-ink">
            <span className="mb-1.5 block text-muted">비밀번호</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-line bg-board px-3 py-2.5 text-ink outline-none ring-accent focus:ring-2"
              placeholder="관리자 비밀번호"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={pending || !password}
            className="w-full rounded-lg bg-ink px-3 py-2.5 text-sm font-medium text-board hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "확인 중…" : "입장"}
          </button>
        </form>
      </div>
    </main>
  );
}
