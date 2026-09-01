import type { CSSProperties, ElementType, ReactNode } from "react";

type DeskEyebrowVariant = "base" | "xs" | "10" | "sans" | "subnav";

const BASE: CSSProperties = {
  lineHeight: 1.05,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--accent)",
};

const VARIANTS: Record<DeskEyebrowVariant, CSSProperties> = {
  base: { ...BASE, fontFamily: "var(--font-mono)", fontSize: "33px" },
  xs: { ...BASE, fontFamily: "var(--font-mono)", fontSize: "36px" },
  "10": { ...BASE, fontFamily: "var(--font-mono)", fontSize: "30px", letterSpacing: "0.16em" },
  sans: { ...BASE, fontFamily: "var(--font-sans)", fontSize: "33px", fontWeight: 600 },
  /** Category sub-nav bar — xs (36px) reduced by 30%. */
  subnav: { ...BASE, fontFamily: "var(--font-mono)", fontSize: "25px" },
};

/** English desk/category eyebrows — 3× base sizes (11px→33px, 12px→36px, 10px→30px). */
export function DeskEyebrow({
  variant = "xs",
  as: Tag = "p",
  children,
  className = "",
}: {
  variant?: DeskEyebrowVariant;
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={className} style={VARIANTS[variant]}>
      {children}
    </Tag>
  );
}
