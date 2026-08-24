export function Sparkline({
  data,
  positive,
  className = "h-8 w-24",
}: {
  data: number[];
  positive: boolean;
  className?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 28 - ((value - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  const color = positive ? "var(--color-up)" : "var(--color-down)";

  return (
    <svg viewBox="0 0 100 32" className={className} aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}
