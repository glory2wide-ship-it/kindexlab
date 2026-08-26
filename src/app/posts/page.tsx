import type { Metadata } from "next";
import Link from "next/link";
import { listPosts } from "@/lib/posts/store";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "금융·생활 시세 칼럼",
  description: `공개 환율·물가·날씨 데이터를 하루 3회 자동 해설합니다. ${SITE.name} SEO 칼럼.`,
  alternates: { canonical: "/posts" },
};

export const dynamic = "force-dynamic";

export default async function PostsIndexPage() {
  const posts = await listPosts();
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs text-accent">FX · LIVING DESK</p>
        <h1 className="text-3xl font-semibold tracking-tight">금융·생활 시세 칼럼</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          실시간 시세판 상단에 숫자를 두고, 왜 그 종목이 화제인지를 1,500~2,000어절 SEO
          본문으로 하루 세 번 발행합니다. 투자 권유가 아닙니다.
        </p>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/posts/${post.slug}`}
              className="block rounded-2xl border border-line bg-panel p-5 hover:border-accent"
            >
              <p className="font-mono text-[11px] text-muted">
                {post.editionDate} · {(post.wordCount || post.characterCount).toLocaleString("ko-KR")}
                {post.wordCount ? "어절" : "자"}
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">{post.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{post.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
