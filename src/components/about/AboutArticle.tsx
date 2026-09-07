import Link from "next/link";

import type { PostChannel } from "@/lib/posts/types";
import { KinDexAboutSections } from "@/components/about/KinDexAboutSections";
import { getChannelAbout } from "@/lib/about/channel-copy";
import { channelSectionHref, getPostChannel, POST_CHANNELS } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

export function AboutArticle({ channel }: { channel?: PostChannel }) {
  const meta = channel ? getPostChannel(channel) : null;
  const channelCopy = channel ? getChannelAbout(channel) : null;

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">
          {meta ? `${meta.label} 소개` : "KinDex / 킨덱스 소개"}
        </h1>
        <p className="mt-3 leading-7 text-muted">{channelCopy?.lead ?? SITE.description}</p>
      </header>

      {channelCopy ? (
        <>
          <section className="space-y-3 text-[15px] leading-8">
            <h2 className="text-xl font-semibold">무엇을 보나</h2>
            {channelCopy.whatYouSee.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
            <ul className="grid gap-2 sm:grid-cols-2">
              {channelCopy.whatYouSee.highlights.map((item) => (
                <li key={item} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-3 text-[15px] leading-8">
            <h2 className="text-xl font-semibold">지수(INDEX)는 어떻게 읽나</h2>
            {channelCopy.indexHow.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </section>
          <section className="space-y-3 text-[15px] leading-8">
            <h2 className="text-xl font-semibold">데스크 구성</h2>
            {channelCopy.desk.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </section>
        </>
      ) : (
        <>
          <section className="space-y-3 text-[15px] leading-8">
            <h2 className="text-xl font-semibold">무엇을 보나</h2>
            <p>
              {SITE.name}는 공개된 순위·지표·보도 신호를 지수(INDEX) 문법으로 읽는 매거진 데스크입니다.
              트리맵은 관심도를 면적으로, 등락률을 색으로 보여 주고, 리스트는 같은 데이터를 표로
              정렬합니다. 분봉을 바꾸면 단기 노이즈와 중기 흐름을 같은 보드에서 비교할 수 있습니다.
            </p>
            <p>
              상단 메뉴의 엔터·정치·경제·문화/생활·여행/맛집 데스크마다 실시간 지수,
              일일브리핑, 아카이브, 소개가 같은 규격으로 제공됩니다.
            </p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {POST_CHANNELS.map((item) => (
                <li key={item.id}>
                  <Link
                    href={channelSectionHref(item.id, "about")}
                    className="rounded-full border border-line bg-panel px-3 py-1 hover:text-ink"
                  >
                    {item.label} 소개
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <KinDexAboutSections channel={channel} />

      <section className="space-y-3 text-[15px] leading-8">
        <h2 className="text-xl font-semibold">문의</h2>
        <p>
          운영 문의, 개인정보, 콘텐츠 오류는{" "}
          <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
            {SITE.contactEmail}
          </a>
          또는{" "}
          <Link href="/contact" className="text-accent hover:underline">
            문의하기
          </Link>
          로 보내 주십시오.
        </p>
      </section>
    </article>
  );
}
