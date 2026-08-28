import type { EntityType, RankingEntity } from "@/lib/types";
import { TYPE_LABEL } from "@/lib/format";

export interface IssueName {
  name: string;
  slug: string;
}

/** Market-free input for every editorial column. Numbers never live here. */
export interface IssueKeyword {
  name: string;
  slug: string;
  topic: EntityType;
  topicLabel: string;
  related: IssueName[];
  imageUrl?: string;
}

function cleanTag(value: string): string {
  return value
    .replace(/\d+(?:\.\d+)?%?/g, " ")
    .replace(/\d+\s*위/g, " ")
    .replace(/등락|거래량|버즈|시세|분봉|호가|급등|급락/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function issueKeywordFromName(
  name: string,
  options?: Partial<Pick<IssueKeyword, "slug" | "topic" | "topicLabel" | "related" | "imageUrl">>,
): IssueKeyword {
  const topic = options?.topic ?? "celebrity";
  return {
    name,
    slug: options?.slug ?? name.toLowerCase().replace(/[^\w가-힣]+/g, "-"),
    topic,
    topicLabel: options?.topicLabel ?? TYPE_LABEL[topic] ?? "이슈",
    related: options?.related ?? [],
    imageUrl: options?.imageUrl,
  };
}

export function issueKeywordFromEntity(
  entity: Pick<RankingEntity, "name" | "slug" | "type" | "imageUrl">,
  related: IssueName[] = [],
): IssueKeyword {
  return {
    name: entity.name,
    slug: entity.slug,
    topic: entity.type,
    topicLabel: TYPE_LABEL[entity.type] || "이슈",
    related: related.map((item) => ({ name: item.name, slug: item.slug })),
    imageUrl: entity.imageUrl,
  };
}

export function issueKeywordsFromEntities(
  entities: Pick<RankingEntity, "name" | "slug" | "type" | "imageUrl">[],
): IssueKeyword[] {
  return entities.map((entity, index) =>
    issueKeywordFromEntity(
      entity,
      entities.filter((_, other) => other !== index).map((item) => ({ name: item.name, slug: item.slug })),
    ),
  );
}

export function themeWord(keyword: IssueKeyword): string {
  const raw = cleanTag(keyword.topicLabel);
  return raw || "문화";
}
