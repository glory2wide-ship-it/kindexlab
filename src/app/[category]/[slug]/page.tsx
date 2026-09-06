import { notFound, redirect } from "next/navigation";
import { isPostChannel } from "@/lib/posts/channels";

/**
 * Former 이슈칼럼 article URLs under /{channel}/{slug}.
 * Generation is disabled; send readers to the channel board.
 */
export default async function CategoryPostPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();
  redirect(`/${category}`);
}
