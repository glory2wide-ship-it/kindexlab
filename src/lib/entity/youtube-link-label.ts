/** True when a display string is a raw YouTube URL / channel id rather than a title. */
export function isRawYoutubeChannelDisplay(value?: string): boolean {
  if (!value?.trim()) return false;
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return true;
  if (/^(www\.)?youtube\.com\//i.test(v)) return true;
  if (/^youtu\.be\//i.test(v)) return true;
  if (/^youtube\.com\/(channel|@|c\/|user\/)/i.test(v)) return true;
  if (/^UC[\w-]{20,}$/.test(v)) return true;
  return false;
}

/**
 * Link label for a YouTube channel cell: always the channel/item name, never the
 * opaque /channel/UC… URL string.
 */
export function youtubeChannelLinkLabel(channelName: string, value?: string): string {
  const name = channelName.trim();
  if (!name) return value?.trim() || "유튜브 채널";
  if (!value?.trim() || isRawYoutubeChannelDisplay(value)) return name;
  // Keep curated human labels (e.g. "유튜브에서 채널 확인") unless they look like URLs.
  if (/유튜브|채널/.test(value) && !/youtube\.com|youtu\.be|UC[\w-]{10,}/i.test(value)) {
    return name;
  }
  if (isRawYoutubeChannelDisplay(value)) return name;
  return name;
}
