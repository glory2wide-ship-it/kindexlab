import { redirect } from "next/navigation";
import { isPostChannel } from "@/lib/posts/channels";

/** Channel 이슈칼럼 hub retired. */
export default async function CategoryPostsPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  redirect(isPostChannel(category) ? `/${category}` : "/");
}
