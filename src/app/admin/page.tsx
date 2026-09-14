import type { Metadata } from "next";
import { buildAdminDashboard } from "@/lib/ops/admin-dashboard";
import { AdminOpsClient } from "./AdminOpsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Ops · KinDex",
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const initial = await buildAdminDashboard(params.date || undefined);
  return <AdminOpsClient initial={initial} />;
}
