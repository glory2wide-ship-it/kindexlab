import { notFound } from "next/navigation";
import { CategoryChrome } from "@/components/layout/CategoryChrome";
import { isPostChannel, POST_CHANNELS } from "@/lib/posts/channels";
import type { ReactNode } from "react";

export function generateStaticParams() {
  return POST_CHANNELS.filter((item) => item.id !== "politics").map((item) => ({
    category: item.id,
  }));
}

export default async function CategoryLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();
  return <CategoryChrome channel={category}>{children}</CategoryChrome>;
}
