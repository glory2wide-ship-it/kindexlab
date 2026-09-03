/**
 * OpenAI Structured Outputs JSON Schemas for the premium briefing generator.
 * Every object uses additionalProperties:false + required[] for strict mode.
 */

export type JsonSchemaObject = {
  type: "object" | "array" | "string" | "number" | "boolean" | "integer";
  properties?: Record<string, JsonSchemaObject>;
  items?: JsonSchemaObject;
  required?: string[];
  additionalProperties?: boolean;
  minItems?: number;
  maxItems?: number;
  enum?: string[];
};

export interface OpenAiJsonSchemaFormat {
  name: string;
  strict: true;
  schema: JsonSchemaObject;
}

const stringSchema: JsonSchemaObject = { type: "string" };

const linkSchema: JsonSchemaObject = {
  type: "object",
  properties: {
    href: stringSchema,
    label: stringSchema,
  },
  required: ["href", "label"],
  additionalProperties: false,
};

const tableSchema: JsonSchemaObject = {
  type: "object",
  properties: {
    caption: stringSchema,
    headers: { type: "array", items: stringSchema },
    rows: {
      type: "array",
      items: { type: "array", items: stringSchema },
    },
  },
  required: ["caption", "headers", "rows"],
  additionalProperties: false,
};

const faqItemSchema: JsonSchemaObject = {
  type: "object",
  properties: {
    question: stringSchema,
    answer: stringSchema,
  },
  required: ["question", "answer"],
  additionalProperties: false,
};

/** Single-pass full article (title → FAQ) in one Structured Outputs call. */
export const ARTICLE_JSON_SCHEMA: OpenAiJsonSchemaFormat = {
  name: "premium_article",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: stringSchema,
      excerpt: stringSchema,
      sections: {
        type: "array",
        minItems: 4,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            heading: stringSchema,
            headingLevel: { type: "integer" },
            paragraphs: { type: "array", items: stringSchema, minItems: 4, maxItems: 5 },
          },
          required: ["heading", "headingLevel", "paragraphs"],
          additionalProperties: false,
        },
      },
      table: tableSchema,
      faq: {
        type: "array",
        items: faqItemSchema,
        minItems: 1,
        maxItems: 6,
      },
      externalLink: linkSchema,
      internalLink: linkSchema,
      takeaways: { type: "array", items: stringSchema },
    },
    required: [
      "title",
      "excerpt",
      "sections",
      "table",
      "faq",
      "externalLink",
      "internalLink",
      "takeaways",
    ],
    additionalProperties: false,
  },
};

/** @deprecated Use ARTICLE_JSON_SCHEMA — outline/section multi-pass removed. */
export const OUTLINE_JSON_SCHEMA = ARTICLE_JSON_SCHEMA;

/** @deprecated Multi-pass section body — unused after single-pass rewrite. */
export const SECTION_JSON_SCHEMA: OpenAiJsonSchemaFormat = {
  name: "premium_section",
  strict: true,
  schema: {
    type: "object",
    properties: {
      paragraphs: { type: "array", items: stringSchema, minItems: 1 },
    },
    required: ["paragraphs"],
    additionalProperties: false,
  },
};

/** Parallel string rewrite (decliché / density). */
export const REWRITE_LIST_JSON_SCHEMA: OpenAiJsonSchemaFormat = {
  name: "premium_rewrite_list",
  strict: true,
  schema: {
    type: "object",
    properties: {
      rewritten: { type: "array", items: stringSchema },
    },
    required: ["rewritten"],
    additionalProperties: false,
  },
};

/** SEO expand — full section tree. */
export const SECTIONS_JSON_SCHEMA: OpenAiJsonSchemaFormat = {
  name: "premium_sections",
  strict: true,
  schema: {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading: stringSchema,
            headingLevel: { type: "integer" },
            paragraphs: { type: "array", items: stringSchema },
          },
          required: ["heading", "headingLevel", "paragraphs"],
          additionalProperties: false,
        },
      },
    },
    required: ["sections"],
    additionalProperties: false,
  },
};

/**
 * Error-patch payload: only fields that need fixing.
 * Empty arrays/strings mean "leave unchanged" — caller merges selectively.
 */
export const ERROR_PATCH_JSON_SCHEMA: OpenAiJsonSchemaFormat = {
  name: "premium_error_patch",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: stringSchema,
      excerpt: stringSchema,
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading: stringSchema,
            headingLevel: { type: "integer" },
            paragraphs: { type: "array", items: stringSchema },
          },
          required: ["heading", "headingLevel", "paragraphs"],
          additionalProperties: false,
        },
      },
      faq: { type: "array", items: faqItemSchema },
      patchedFields: { type: "array", items: stringSchema },
    },
    required: ["title", "excerpt", "sections", "faq", "patchedFields"],
    additionalProperties: false,
  },
};

/** Local shape check when Structured Outputs is unavailable / Batch fallback. */
export function hasRequiredKeys(value: unknown, keys: string[]): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return keys.every((key) => key in row);
}
