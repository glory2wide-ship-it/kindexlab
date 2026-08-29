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
}: {
  table: PostTable;
  eyebrow?: string;
}) {
  if (!table?.rows?.length) return null;

  return (
    <figure className="not-prose my-7 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm ring-1 ring-accent/10">
      <figcaption className="border-b border-line border-l-4 border-l-accent bg-board/50 px-4 py-3">
        <span className="block font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          {eyebrow}
        </span>
        <span className="mt-1 block text-sm font-semibold leading-6 text-ink">{table.caption}</span>
      </figcaption>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="bg-board/70">
              {table.headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="whitespace-nowrap border-b border-line px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-wide text-muted"
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
                    className={`px-4 py-3 align-top leading-6 ${
                      cellIndex === 0 ? "font-medium text-ink" : "text-muted"
                    }`}
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
