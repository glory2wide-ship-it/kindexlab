import { redirect } from "next/navigation";

/** 이슈칼럼 hub retired — keep the route for old bookmarks. */
export default function PostsIndexPage() {
  redirect("/");
}
