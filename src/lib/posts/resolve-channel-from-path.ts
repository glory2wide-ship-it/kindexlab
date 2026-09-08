import { getBoard } from "@/lib/boards/registry";
import { isPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { decodeRouteSlug } from "@/lib/slugs";

/**
 * Infer the active post channel from the URL when SetActiveChannel is absent.
 * Used by sticky category chips + section tabs in the root layout.
 */
export function resolveChannelFromPath(pathname: string): PostChannel | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const head = parts[0];
  if (!head) return undefined;
  if (isPostChannel(head)) return head;
  if (head === "approval") return "politics";
  if (head === "board" && parts[1]) {
    return getBoard(decodeRouteSlug(parts[1]))?.channel;
  }
  if (head === "ranking" && parts[1]) {
    const decoded = decodeRouteSlug(parts[1]);
    const boardSlug = decoded.includes("--") ? decoded.split("--")[0]! : decoded;
    return getBoard(boardSlug)?.channel;
  }
  return undefined;
}
