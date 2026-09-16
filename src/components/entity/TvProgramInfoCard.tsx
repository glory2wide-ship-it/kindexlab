import {
  buildTvProgramProfile,
  tvProgramGenreLabel,
} from "@/lib/boards/tv-program-profile";
import {
  entityNarrativeSummary,
  formatEntityIndexBlurb,
  isEntityIndexBlurbText,
} from "@/lib/entity/index-blurb";
import type { RankingEntity } from "@/lib/types";

/**
 * TV 시청률 / OTT 종목 상세: 본방송·재방송·채널·등장인물·줄거리.
 */
export function TvProgramInfoCard({ entity }: { entity: RankingEntity }) {
  const profile = buildTvProgramProfile(entity);
  if (!profile) return null;

  const genreLabel = tvProgramGenreLabel(profile.genre);
  const rows: Array<{ label: string; value: string }> = [
    { label: "방송 채널", value: profile.channel },
    { label: "최근 본방송", value: profile.lastBroadcast },
  ];
  if (profile.rerunTime) {
    rows.push({ label: "재방송", value: profile.rerunTime });
  }
  if (genreLabel) {
    rows.push({ label: "장르", value: genreLabel });
  }

  const indexBlurb = formatEntityIndexBlurb(entity);
  const plotRaw = profile.plotSummary?.trim();
  const plot =
    plotRaw &&
    entityNarrativeSummary(plotRaw) &&
    plotRaw !== indexBlurb &&
    !isEntityIndexBlurbText(plotRaw)
      ? plotRaw
      : undefined;

  return (
    <section className="rounded-2xl border border-line bg-panel p-[18px] md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted">방송 프로그램 정보</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight md:text-xl">
            {profile.title}
          </h2>
        </div>
        {genreLabel ? (
          <span className="rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-soft">
            {genreLabel}
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl bg-board/60 px-3 py-2.5">
            <dt className="text-[11px] font-semibold tracking-wide text-soft">{row.label}</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-[11px] font-semibold tracking-wide text-soft">등장인물</h3>
        {profile.cast.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {profile.cast.map((person) => (
              <li
                key={person}
                className="rounded-md border border-line bg-board px-2 py-1 text-xs font-medium text-ink"
              >
                {person}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            출연진 정보는 회차·시즌 공개에 맞춰 업데이트됩니다.
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-[11px] font-semibold tracking-wide text-soft">핵심 줄거리 요약</h3>
        <p className="mt-2 text-sm leading-6 text-ink/90">
          {plot ||
            `${profile.title}의 핵심 줄거리와 회차 하이라이트는 방송사·OTT 공식 소개를 기준으로 요약됩니다.`}
        </p>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-muted">
        편성·재방송 시각은 방송사·OTT 공지와 편성표 변동에 따라 달라질 수 있습니다. 실측
        시청률·공식 시놉시스와 다를 수 있는 편집 요약입니다.
      </p>
    </section>
  );
}
