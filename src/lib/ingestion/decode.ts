import iconv from "iconv-lite";

function charsetFromContentType(contentType: string): string | undefined {
  const match = contentType.match(/charset=([^;]+)/i);
  return match?.[1]?.trim().replace(/["']/g, "").toLowerCase();
}

function looksMojibake(text: string): boolean {
  const sample = text.slice(0, 4000);
  const replacements = sample.match(/\uFFFD/g)?.length ?? 0;
  return replacements > 8 || /Ã.|Â.|À.|ì.|í.|ë./.test(sample);
}

export function decodeBody(buffer: ArrayBuffer, contentType = ""): string {
  const bytes = Buffer.from(buffer);
  const charset = charsetFromContentType(contentType);
  if (charset && charset !== "utf-8" && charset !== "utf8" && iconv.encodingExists(charset)) {
    return iconv.decode(bytes, charset);
  }

  const utf8 = bytes.toString("utf8");
  if (!looksMojibake(utf8)) return utf8;

  if (iconv.encodingExists("euc-kr")) {
    const korean = iconv.decode(bytes, "euc-kr");
    if (!looksMojibake(korean)) return korean;
  }
  return utf8;
}
