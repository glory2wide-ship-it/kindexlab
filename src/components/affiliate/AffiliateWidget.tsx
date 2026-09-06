"use client";

import type { AgeSegment, GenderSegment } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Shopping shelves are paused until AdSense is approved. The component stays
 * mounted so stored markdown tags (`<AffiliateWidget />`) still compile.
 */
export function AffiliateWidget(_props: {
  category?: string;
  keyword?: string;
  channel?: PostChannel;
  boardSlug?: string;
  gender?: "all" | GenderSegment;
  age?: "all" | AgeSegment;
  placement?: "mid" | "footer";
}): null {
  return null;
}
