"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatZAR, timeAgo } from "@/lib/utils";
import { Badge, Card, Icon, Kpi, Spinner, StatusBadge } from "@/components/ui";
import { HBars } from "@/components/charts";

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    api<any>("/admin/overview")
      .then(setData)
      .catch((e: any) => {
        if (e.status === 403 || e.status === 401) setForbidden(true);
      });
  }, []);

  if (forbidden)
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-dangersoft text-danger">
          <Icon name="shield" size={22} />
        </span>
        <h1 className="font-display text-[18px] font-semibold">Platform administrators only</h1>
        <p className="mt-2 max-w-sm text-[13.5px] text-mut">This area is for BizPilot platform staff. Business users can't see it — and your business data is isolated from everything else.</p>
        <a href="/dashboard" className="mt-5 text-[13px] font-semibold text-brand hover:underline">Back to my dashboard</a>
      </div>
    );

  if (!data)
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-[14px] text-mut">
        <Spinner size={18} className="text-brand" /> Loading platform overview…
      </div>
    );

  const trialRate = data.businesses ? Math.round((data.trials / data.businesses) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-dangersoft text-danger">
          <Icon name="shield" size={19} />
        </span>
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Platform admin</h1>
          <p className="text-[12.5px] text-mut">BizPilot infrastructure overview — tenants, revenue, AI usage and health.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="MRR" value={formatZAR(data.mrr)} icon="wallet" tone="ok" sub="Active subscriptions" />
        <Kpi label="Businesses" value={data.businesses} icon="building" tone="brand" sub={`${data.trials} on trial (${trialRate}%)`} />
        <Kpi label="Users" value={data.users} icon="users" tone="info" sub="Across all tenants" />
        <Kpi label="Database" value={data.health?.database === "ok" ? "Healthy" : "Degraded"} icon="check" tone={data.health?.database === "ok" ? "ok" : "danger"} sub={`v${data.health?.version}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">Plans</h3>
          <HBars data={(data.plans ?? []).map((p: any) => ({ label: `${p.plan} (${formatZAR((({ starter: 299, business: 699, pro: 1499 } as Record<string, number>)[p.plan] ?? 0))}/mo)`, value: p.n }))} />
          {(data.plans ?? []).length === 0 && <p className="py-6 text-center text-[12.5px] text-mut">No active subscriptions yet.</p>}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">AI requests (30d)</h3>
          <HBars data={(data.aiUsage ?? []).slice(0, 6).map((u: any) => ({ label: `tenant ${u.businessId.slice(0, 8)}…`, value: u.requests }))} />
          {(data.aiUsage ?? []).length === 0 && <p className="py-6 text-center text-[12.5px] text-mut">No AI usage recorded yet.</p>}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">System</h3>
          <div className="space-y-2.5">
            {[
              ["PostgreSQL", "ok"],
              ["AI engine (on-device)", "ok"],
              ["WhatsApp provider", process.env.NEXT_PUBLIC_DEMO_ENABLED ? "mock" : "ok"],
              ["Yoco payments", "stub"],
              ["Email (SMTP)", "mock"],
            ].map(([name, status]) => (
              <div key={name} className="flex items-center justify-between text-[13px]">
                <span className="font-medium">{name}</span>
                <Badge tone={status === "ok" ? "ok" : "warn"}>{status}</Badge>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-surface2 px-3 py-2 text-[11.5px] leading-snug text-mut">Mock providers are clearly labelled and swap to live providers via environment credentials — no code changes.</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3.5 font-display text-[15px] font-semibold">Recent businesses</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface2/60 text-[11px] uppercase tracking-wide text-mut">
                <th className="px-5 py-2.5 font-semibold">Business</th>
                <th className="px-5 py-2.5 font-semibold">Type</th>
                <th className="px-5 py-2.5 font-semibold">City</th>
                <th className="px-5 py-2.5 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBusinesses.map((b: any) => (
                <tr key={b.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3 font-medium">{b.name}</td>
                  <td className="px-5 py-3 text-mut">{b.type ?? "—"}</td>
                  <td className="px-5 py-3 text-mut">{b.city ?? "—"}</td>
                  <td className="px-5 py-3 text-mut">{timeAgo(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
