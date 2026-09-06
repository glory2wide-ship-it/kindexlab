import { CategoryChrome } from "@/components/layout/CategoryChrome";
import type { ReactNode } from "react";

export default function PoliticsLayout({ children }: { children: ReactNode }) {
  return <CategoryChrome channel="politics">{children}</CategoryChrome>;
}
