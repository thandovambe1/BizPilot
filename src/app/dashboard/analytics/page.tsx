"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatZAR } from "@/lib/utils";
import { Badge, Card, Icon, Kpi, Spinner } from "@/components/ui";
import { BarChart, Donut, Funnel, HBars } from "@/components/charts";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api<any>("/analytics").then(setData).catch(() => setData({ error: true }));
  }, []);

  if (!data)
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-[14px] text-mut">
        <Spinner size={18} className="text-brand" />
        Crunching your business numbers…
      </div>
    );
  if (data.error) return <div className="py-32 text-center text-[14px] text-mut">Analytics unavailable right now.</div>;

  const kpis: any = data.kpis;
  const monthly: any[] = data.monthly ?? [];
  const revenue14: any[] = data.revenue14 ?? [];
  const byService: any[] = data.byService ?? [];
  const leads: any[] = data.leadsBySource ?? [];
  const techs: any[] = data.techs ?? [];
  const acceptance: any = data.acceptance ?? { rate: 0, accepted: 0, total: 0 };
  const insights: any[] = data.insights ?? [];
  const avgJobValue: number = data.avgJobValue ?? 0;
  const avgPaymentDays: number = data.avgPaymentDays ?? 0;
  const totalLeads: number = data.totalLeads ?? 0;
  const wonBooked = leads.reduce((s: number, l: any) => s + l.won, 0);

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <div>
        <h1 className="font-display text-[20px] font-semibold tracking-tight">Analytics</h1>
        <p className="text-[12.5px] text-mut">Performance across revenue, pipeline, services and technicians — computed from live data.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Revenue (30d)" value={formatZAR(kpis.revenue30)} icon="wallet" tone="ok" sub={`${kpis.revenueDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(kpis.revenueDeltaPct)}% vs previous 30d`} />
        <Kpi label="Avg job value" value={formatZAR(avgJobValue)} icon="chart" tone="brand" sub="Completed jobs" />
        <Kpi label="Lead → won" value={`${kpis.conversion}%`} icon="target" tone="info" sub={`${totalLeads} leads all-time`} />
        <Kpi label="Avg payment time" value={`${avgPaymentDays}d`} icon="clock" tone="accent" sub="Issue → paid" />
        <Kpi label="Quote acceptance" value={`${acceptance.rate}%`} icon="file" tone="brand" sub={`${acceptance.accepted}/${acceptance.total} responded`} />
        <Kpi label="Outstanding" value={formatZAR(kpis.outstanding)} icon="receipt" tone="warn" sub={`${kpis.outstandingCount} open invoices`} />
        <Kpi label="New leads (30d)" value={kpis.newLeads30} icon="target" tone="info" sub={`${wonBooked} converted`} />
        <Kpi label="Repeat customers" value={kpis.repeatCustomers} icon="users" tone="ok" sub="2+ completed jobs" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display text-[15px] font-semibold">Monthly revenue</h3>
          <p className="mb-4 text-[12px] text-mut">Last 6 months, payments collected</p>
          <BarChart data={monthly} money height={180} />
        </Card>
        <Card className="p-5">
          <h3 className="font-display text-[15px] font-semibold">Daily collections</h3>
          <p className="mb-4 text-[12px] text-mut">Last 14 days</p>
          <BarChart data={revenue14} money height={180} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">Lead funnel</h3>
          <Funnel
            stages={[
              { label: "All leads", value: totalLeads || 0 },
              { label: "In pipeline", value: Math.max(totalLeads - leads.filter((l) => false).length, Math.max(totalLeads - 0, 0)) || totalLeads || 0 },
              { label: "Quoted / won", value: wonBooked },
              { label: "Won / booked", value: wonBooked },
            ]}
          />
          <p className="mt-3 text-[11.5px] leading-relaxed text-mut">Pipeline converts at {totalLeads ? Math.round((wonBooked / totalLeads) * 100) : 0}% overall — WhatsApp enquiries respond best within 5 minutes.</p>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">Lead sources</h3>
          {leads.length ? (
            <HBars data={leads.map((l) => ({ label: l.source, value: l.total, sub: `${l.rate}% convert` }))} />
          ) : (
            <p className="py-8 text-center text-[12.5px] text-mut">No lead data yet.</p>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">Technician output</h3>
          {techs.length ? (
            <HBars data={techs.map((t: any) => ({ label: t.member, value: t.jobs, sub: "jobs / 30d" }))} />
          ) : (
            <p className="py-8 text-center text-[12.5px] text-mut">No completed jobs yet.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">Service profitability</h3>
          {byService?.length ? (
            <HBars data={byService.map((s: any) => ({ label: s.service, value: s.total, sub: `${s.share}%` }))} money />
          ) : (
            <p className="py-8 text-center text-[12.5px] text-mut">No paid revenue yet — this ranks your services once invoices are paid.</p>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-semibold">Revenue mix (30d)</h3>
          {byService?.length ? (
            <Donut
              parts={byService.slice(0, 5).map((s: any, i: number) => ({ name: s.service.length > 20 ? s.service.slice(0, 19) + "…" : s.service, value: s.total, color: ["#1577ee", "#16CFC7", "#0B1F3D", "#7FB1FF", "#9BE3DF"][i] }))}
              label={formatZAR(byService.reduce((s, x: any) => s + x.total, 0))}
              sub="total"
            />
          ) : (
            <p className="py-8 text-center text-[12.5px] text-mut">No paid revenue yet.</p>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="sparkles" size={17} className="text-brand" />
          <h3 className="font-display text-[15px] font-semibold">AI business insights</h3>
          <Badge tone="brand">auto-detected patterns</Badge>
        </div>
        <div className="grid gap-2.5 md:grid-cols-2">
          {insights.map((ins: any) => (
            <div key={ins.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface2/50 px-4 py-3.5">
              <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ins.tone === "positive" ? "bg-oksoft text-ok" : ins.tone === "warning" ? "bg-warnsoft text-warn" : "bg-infosoft text-info"}`}>
                <Icon name={ins.tone === "positive" ? "trend-up" : ins.tone === "warning" ? "alert" : "info"} size={14} />
              </span>
              <div>
                <div className="text-[13.5px] font-semibold leading-snug">{ins.title}</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-mut">{ins.body}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
