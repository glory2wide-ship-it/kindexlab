import type { ReactNode } from "react";
import { CategoryChrome } from "@/components/layout/CategoryChrome";

export default function TravelSubLayout({ children }: { children: ReactNode }) {
  return <CategoryChrome channel="travel">{children}</CategoryChrome>;
}
