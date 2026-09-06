import { getPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

/** Category board hero — index title and channel description. */
export function CategoryDeskHeader({ channel }: { channel: PostChannel }) {
  const meta = getPostChannel(channel);

  return (
    <header className="space-y-2 font-gothic">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{meta.indexTitle}</h1>
      <p className="max-w-2xl text-sm leading-6 text-muted">{meta.description}</p>
    </header>
  );
}
