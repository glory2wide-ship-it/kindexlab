"use client";

import { FormEvent, useState } from "react";
import { SITE } from "@/lib/site";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const from = String(data.get("email") ?? "").trim();
    const subject = String(data.get("subject") ?? `${SITE.name} 문의`).trim();
    const message = String(data.get("message") ?? "").trim();
    const body = [
      `이름: ${name}`,
      `회신 이메일: ${from}`,
      "",
      message,
    ].join("\n");
    window.location.href = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-panel p-5 md:p-6">
      <label className="block text-sm">
        이름
        <input
          name="name"
          required
          autoComplete="name"
          className="mt-1.5 w-full rounded-lg border border-line bg-board px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        이메일
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 w-full rounded-lg border border-line bg-board px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        제목
        <input
          name="subject"
          required
          defaultValue="서비스 문의"
          className="mt-1.5 w-full rounded-lg border border-line bg-board px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        내용
        <textarea
          name="message"
          required
          rows={6}
          className="mt-1.5 w-full rounded-lg border border-line bg-board px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:opacity-90"
      >
        메일 앱으로 보내기
      </button>
      {sent ? (
        <p className="text-sm text-muted">
          메일 앱이 열리지 않으면 {SITE.contactEmail} 로 직접 보내 주세요.
        </p>
      ) : null}
    </form>
  );
}
