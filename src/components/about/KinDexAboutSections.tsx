import Link from "next/link";
import { getChannelAbout } from "@/lib/about/channel-copy";
import {
  BRIEFING_PRINCIPLES,
  CHANNEL_METHOD_ORDER,
  DATA_SOURCE_GROUPS,
  EDITING_PRINCIPLES,
  KINDEX_INTRO,
} from "@/lib/about/site-pages";
import { channelSectionHref, getPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

function MethodologyBlock({ channel }: { channel: PostChannel }) {
  const method = getChannelAbout(channel).methodology;
  if (!method) return null;
  const meta = getPostChannel(channel);
  return (
    <section className="space-y-3 border-t border-line pt-6 text-[15px] leading-[1.6rem]">
      <h3 className="text-lg font-semibold">{method.title}</h3>
      <p className="text-sm text-muted">{method.subtitle}</p>
      <p className="rounded-lg bg-panel px-3 py-2 font-mono text-xs leading-5">{method.formula}</p>
      <ul className="space-y-2">
        {method.inputs.map((item) => (
          <li key={item.label}>
            <span className="font-medium">{item.label}</span> — {item.basis}{" "}
            <span className="text-muted">({item.sources})</span>
          </li>
        ))}
      </ul>
      {method.paragraphs.slice(0, 3).map((paragraph) => (
        <p key={paragraph.slice(0, 24)}>{paragraph}</p>
      ))}
      <p className="text-sm">
        <Link href={channelSectionHref(channel, "about")} className="text-accent hover:underline">
          {meta.label} 데스크 소개
        </Link>
      </p>
    </section>
  );
}

function IntroSection({ compact }: { compact?: boolean }) {
  return (
    <section className="space-y-3 text-[15px] leading-[1.6rem]">
      <h2 className="text-xl font-semibold">{KINDEX_INTRO.title}</h2>
      {(compact ? KINDEX_INTRO.paragraphs.slice(0, 2) : KINDEX_INTRO.paragraphs).map((paragraph) => (
        <p key={paragraph.slice(0, 20)}>{paragraph}</p>
      ))}
      {compact ? (
        <p className="text-sm">
          <Link href="/about" className="text-accent hover:underline">
            KinDex / 킨덱스 소개 전체 보기
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function DataSourcesSection() {
  return (
    <section className="space-y-3 text-[15px] leading-[1.6rem]">
      <h2 className="text-xl font-semibold">데이터 출처</h2>
      <p className="text-sm text-muted">
        아래는 예시 형식이 아니라, 현재 파이프라인이 실제로 수집하거나 정규화에 쓰는 출처입니다.
      </p>
      <ul className="space-y-4">
        {DATA_SOURCE_GROUPS.map((group) => (
          <li key={group.label}>
            <p className="font-medium">- {group.label}</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-muted">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BulletSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-3 text-[15px] leading-[1.6rem]">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="list-disc space-y-2 pl-5">
        {items.map((item) => (
          <li key={item.slice(0, 32)}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function KinDexAboutSections({
  channel,
  compact = false,
}: {
  channel?: PostChannel;
  compact?: boolean;
}) {
  const channels = channel ? [channel] : CHANNEL_METHOD_ORDER;
  return (
    <div className="space-y-8">
      <IntroSection compact={compact} />
      <section className="space-y-3 text-[15px] leading-[1.6rem]">
        <h2 className="text-xl font-semibold">지수 산출 방식</h2>
        <p className="text-sm text-muted">
          {channel
            ? `${getPostChannel(channel).label} 데스크의 랭킹 산출 방식입니다.`
            : "카테고리마다 원천이 다릅니다. 같은 보드 안에서의 순위와 방향을 읽는 것이 정확합니다."}
        </p>
        {channels.map((id) => (
          <MethodologyBlock key={id} channel={id} />
        ))}
      </section>
      <DataSourcesSection />
      <BulletSection title={EDITING_PRINCIPLES.title} items={EDITING_PRINCIPLES.items} />
      <BulletSection title={BRIEFING_PRINCIPLES.title} items={BRIEFING_PRINCIPLES.items} />
    </div>
  );
}
