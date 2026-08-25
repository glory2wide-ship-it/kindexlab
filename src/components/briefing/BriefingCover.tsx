"use client";

import { useState } from "react";
import type { BriefingCoverImage } from "@/lib/types";

export function BriefingCover({
  image,
  priority = false,
  variant = "framed",
  showCaption = true,
}: {
  image: BriefingCoverImage;
  priority?: boolean;
  variant?: "framed" | "flush";
  showCaption?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const framed = variant === "framed";

  return (
    <figure className={framed ? "overflow-hidden rounded-xl border border-line bg-board" : "bg-board"}>
      <div className="relative aspect-video w-full overflow-hidden bg-board">
        {failed ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/25 via-board to-panel px-6 text-center">
            <p className="max-w-sm text-sm font-medium text-ink/80">{image.alt}</p>
          </div>
        ) : (
          // Native img: lazy-load, works with live snapshot URLs, no remote-host allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.src}
            alt={image.alt}
            width={1600}
            height={900}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {showCaption && image.photographer ? (
        <figcaption className="px-3 py-1.5 font-mono text-[10px] text-muted">
          Photo: {image.photographer}
          {image.source === "unsplash" ? " / Unsplash" : ""}
        </figcaption>
      ) : null}
    </figure>
  );
}
