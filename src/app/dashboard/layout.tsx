import { redirect } from "next/navigation";
import { getSessionUser, getBusinessBundle } from "@/server/core";
import { Shell, ShellUser } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/auth");
  if (!u.businessId) redirect("/onboarding");
  const bundle = await getBusinessBundle(u.businessId);
  if (!bundle) redirect("/onboarding");
  const trialDays = bundle.subscription?.trialEndsAt ? Math.max(0, Math.ceil((new Date(bundle.subscription.trialEndsAt).getTime() - Date.now()) / 86400000)) : 0;
  const user: ShellUser = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role ?? "owner",
    businessId: u.businessId,
    isPlatformAdmin: u.isPlatformAdmin,
    businessName: bundle.business.name,
    plan: bundle.subscription?.plan ?? "starter",
    trialDays,
  };
  return <Shell user={user}>{children}</Shell>;
}
