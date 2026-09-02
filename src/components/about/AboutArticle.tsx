import Link from "next/link";

import type { PostChannel } from "@/lib/posts/types";
import { getChannelAbout } from "@/lib/about/channel-copy";
import { INDEX_INPUTS, METHODOLOGY } from "@/data/methodology";
import { getPostChannel } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

export function AboutArticle({ channel }: { channel?: PostChannel }) {
  const meta = channel ? getPostChannel(channel) : null;
  const channelCopy = channel ? getChannelAbout(channel) : null;
  const methodology = channelCopy?.methodology ?? METHODOLOGY;
  const indexInputs = channelCopy?.methodology?.inputs ?? INDEX_INPUTS;

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">
          {meta ? `${meta.label} 소개` : `${SITE.name} 소개`}
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
              상단 GNB의 엔터테인먼트·정치·경제·문화/생활·여행/맛집 데스크마다 실시간 지수,
              일일브리핑, 이슈 칼럼, 아카이브, 소개가 같은 규격으로 제공됩니다.
            </p>
          </section>
          <section className="space-y-3 text-[15px] leading-8">
            <h2 className="text-xl font-semibold">지수(INDEX)는 어떻게 구성되나</h2>
            <p>
              각 종목은 공개 차트·시청률·검색·보도 노출 등 소스가 제공하는 순위와 지표를 하나의
              척도로 정규화한 상대 지표입니다. 섹터마다 원천이 다르므로 서로 다른 메뉴의 점수를
              직접 비교하기보다는, 같은 보드 안에서의 순위와 방향을 읽는 편이 정확합니다.
            </p>
          </section>
        </>
      )}

      <section className="space-y-3 text-[15px] leading-8">
        <h2 className="text-xl font-semibold">{methodology.title}</h2>
        <p className="text-sm text-muted">{methodology.subtitle}</p>
        <p className="rounded-lg bg-panel px-3 py-2 font-mono text-xs leading-5">{methodology.formula}</p>
        <ul className="space-y-2">
          {indexInputs.map((item) => (
            <li key={item.label}>
              <span className="font-medium">{item.label}</span> — {item.basis}{" "}
              <span className="text-muted">({item.sources})</span>
            </li>
          ))}
        </ul>
        {methodology.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 20)}>{paragraph}</p>
        ))}
      </section>

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
