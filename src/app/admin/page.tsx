import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminLoginForm } from "./AdminLoginForm";
import { AdminOpsClient } from "./AdminOpsClient";
import { buildAdminDashboard } from "@/lib/ops/admin-dashboard";
import { ADMIN_COOKIE, adminDashboardSecret, secretMatches } from "@/lib/ops/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Ops · KinDex",
  robots: { index: false, follow: false },
};

function isLoggedIn(cookieHeader: string | undefined): boolean {
  if (!adminDashboardSecret() && process.env.NODE_ENV !== "production") {
    return true;
  }
  if (!cookieHeader) return false;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  return Boolean(match && secretMatches(decodeURIComponent(match[1] ?? "")));
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  if (!isLoggedIn(cookieHeader)) {
    return <AdminLoginForm />;
  }

  const params = await searchParams;
  const initial = await buildAdminDashboard(params.date || undefined);
  return <AdminOpsClient initial={initial} />;
}
