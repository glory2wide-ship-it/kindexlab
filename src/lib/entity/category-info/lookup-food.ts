import { fetchText } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";

export type FoodLookup = {
  name: string;
  address?: string;
  hours?: string;
  menu?: string;
  phone?: string;
  url?: string;
  source: "네이버" | "카카오";
};

function plain(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  return text || undefined;
}

async function lookupNaverPlace(name: string): Promise<FoodLookup | undefined> {
  const url =
    `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(`${name} 맛집`)}`;
  try {
    const html = await fetchText(url, {
      headers: {
        Accept: "text/html",
        Referer: "https://search.naver.com/",
      },
    });
    // Place module snippets commonly embed address / hours near the query title.
    const address =
      plain(
        html.match(
          /(?:class=["'][^"']*addr[^"']*["'][^>]*>|주소[:\s]*)([\s\S]{0,80}?)</i,
        )?.[1],
      ) ||
      plain(
        html.match(
          /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n<]{5,60}/,
        )?.[0],
      );
    const hours = plain(
      html.match(
        /(?:영업\s*시간|운영\s*시간|오늘\s*[\d:])[^<\n]{0,4}[:：]?\s*([^<\n]{4,40})/i,
      )?.[1],
    );
    const menu = plain(
      html.match(/(?:대표\s*메뉴|메뉴)[^<\n]{0,10}[:：]?\s*([^<\n]{2,40})/i)?.[1],
    );
    const phone = plain(
      html.match(/(0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/)?.[1],
    );
    if (!address && !hours && !menu) return undefined;
    return {
      name,
      address: address?.slice(0, 80),
      hours: hours?.slice(0, 40),
      menu: menu?.slice(0, 40),
      phone,
      url,
      source: "네이버",
    };
  } catch {
    return undefined;
  }
}

async function lookupKakaoPlace(name: string): Promise<FoodLookup | undefined> {
  const url = `https://map.kakao.com/?q=${encodeURIComponent(name)}`;
  try {
    const html = await fetchText(url, {
      headers: {
        Accept: "text/html",
        Referer: "https://map.kakao.com/",
      },
    });
    const address = plain(
      html.match(/(?:address|addr)["']?\s*[:=]\s*["']([^"']{6,80})["']/i)?.[1],
    );
    const phone = plain(
      html.match(/(?:phone|tel)["']?\s*[:=]\s*["']([^"']{8,20})["']/i)?.[1],
    );
    const hours = plain(
      html.match(/(?:openHour|hours|영업시간)["']?\s*[:=]\s*["']([^"']{4,40})["']/i)?.[1],
    );
    if (!address && !phone && !hours) {
      // Kakao map is often JS-rendered; keep deep-link only.
      return {
        name,
        url,
        source: "카카오",
      };
    }
    return {
      name,
      address,
      phone,
      hours,
      url,
      source: "카카오",
    };
  } catch {
    return undefined;
  }
}

/**
 * Resolve restaurant address/hours/menu via Naver search place modules,
 * with Kakao Map deep-link as secondary.
 */
export async function lookupFoodFacts(name: string): Promise<FoodLookup | undefined> {
  const raw = name.trim();
  if (!raw) return undefined;
  // "[서울] 을지로골목" → try full then unbracketed place name.
  const unbracket = raw.replace(/^\[[^\]]+\]\s*/, "").trim();
  const queries = [...new Set([raw, unbracket].filter(Boolean))];
  let best: FoodLookup | undefined;
  for (const q of queries) {
    const naver = await lookupNaverPlace(q);
    if (naver?.address || naver?.hours || naver?.menu) return naver;
    if (naver && !best) best = naver;
  }
  for (const q of queries) {
    const kakao = await lookupKakaoPlace(q);
    if (!kakao) continue;
    if (kakao.address || kakao.hours || kakao.phone) {
      return {
        ...kakao,
        address: kakao.address || best?.address,
        hours: kakao.hours || best?.hours,
        menu: kakao.menu || best?.menu,
        phone: kakao.phone || best?.phone,
        url: best?.url || kakao.url,
        source: best?.address ? "네이버" : kakao.source,
      };
    }
    if (!best) best = kakao;
  }
  return best;
}
