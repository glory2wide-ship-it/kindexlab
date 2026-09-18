import type { PostTable } from "@/lib/posts/types";

/**
 * The column's fact table, promoted to the top of the body.
 *
 * With stock photography gone this is the first block a reader meets, so it
 * carries the visual weight the image used to: an accent rail, a labelled
 * caption bar and banded rows. It also renders as the article's summary for a
 * scanner who never scrolls past the fold.
 */
export function FactTable({
  table,
  eyebrow = "핵심 요약",
  emphasized = false,
}: {
  table: PostTable;
  /** Omit or pass empty string to hide the accent eyebrow label. */
  eyebrow?: string;
  /** Today's analysis: +20% type size; body uses regular (non-bold) weight. */
  emphasized?: boolean;
}) {
  if (!table?.rows?.length) return null;

  const label = eyebrow?.trim() ?? "";
  const wide = (table.headers?.length ?? 0) >= 4;

  return (
    <figure
      className={`not-prose my-7 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm ring-1 ring-accent/10 ${
        emphasized ? "analysis-fact-table-120" : ""
      }`}
    >
      <figcaption className="border-b border-line border-l-4 border-l-accent bg-board/50 px-4 py-3">
        {label ? (
          <span className="block font-sans text-[10px] font-normal uppercase tracking-[0.18em] text-accent">
            {label}
          </span>
        ) : null}
        <span
          className={`block text-[14.5px] font-normal leading-6 text-ink max-md:text-[12.5px] max-md:leading-[1.35] ${
            label ? "mt-1" : ""
          }`}
        >
          {table.caption}
        </span>
      </figcaption>
      {/* Mobile: fit viewport without horizontal scroll. Desktop keeps the wide table. */}
      <div className="max-md:overflow-x-visible md:overflow-x-auto">
        <table
          className="w-full border-collapse text-[14.5px] font-normal max-md:table-fixed md:min-w-[30rem]"
        >
          <thead>
            <tr className="bg-board/70">
              {table.headers.map((header, headerIndex) => (
                <th
                  key={header}
                  scope="col"
                  className={`border-b border-line px-4 py-3 text-left font-sans text-[12.4px] font-semibold uppercase tracking-wide text-muted max-md:px-1.5 max-md:py-1.5 max-md:text-[9.5px] max-md:normal-case max-md:tracking-normal max-md:leading-[1.25] md:whitespace-nowrap ${
                    headerIndex === 0
                      ? wide
                        ? "max-md:w-[22%]"
                        : "max-md:w-[32%]"
                      : ""
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr
                key={`${row[0]}-${rowIndex}`}
                className="border-b border-line/70 last:border-b-0 even:bg-board/25"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className={`px-4 py-3 align-top font-normal leading-6 max-md:break-words max-md:px-1.5 max-md:py-1.5 max-md:text-[10px] max-md:leading-[1.3] ${
                      emphasized
                        ? cellIndex === 0
                          ? "text-ink"
                          : "text-muted"
                        : cellIndex === 0
                          ? "font-medium text-ink"
                          : "text-muted"
                    }`}
                    style={
                      emphasized
                        ? { fontWeight: 400, fontVariationSettings: '"wght" 400' }
                        : undefined
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
