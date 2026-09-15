"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatZAR, timeAgo } from "@/lib/utils";
import { Badge, Button, Card, Icon, Kpi, Spinner, StatusBadge, useToast } from "@/components/ui";
import { BarChart, Donut } from "@/components/charts";
import type { Briefing } from "@/lib/api";

export default function DashboardPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [applying, setApplying] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api<Briefing>("/ai/briefing").then(setBriefing).catch(() => {});
    api<any>("/analytics").then(setAnalytics).catch(() => {});
  }, []);

  const applyRecommendation = async () => {
    const rec = briefing?.recommendation;
    if (!rec?.actionId) return;
    setApplying(true);
    try {
      const r = await api<any>("/ai/confirm", { method: "POST", body: { actionId: rec.actionId, approve: true } });
      toast(r.text ?? "Done.", "ok");
      api<Briefing>("/ai/briefing").then(setBriefing).catch(() => {});
    } catch (e: any) {
      toast(e.message ?? "Could not apply the recommendation.", "danger");
    } finally {
      setApplying(false);
    }
  };

  const k = analytics?.kpis;
  const s = briefing?.stats;

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight sm:text-[26px]">
            {briefing?.greeting ?? "Hello"}
            <span className="text-mut">, what do you need today?</span>
          </h1>
          <p className="mt-1 text-[13px] text-mut">{new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Your business is {briefing?.headline.toLowerCase() ?? "up and running"}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon="file" onClick={() => window.location.href = "/dashboard/quotes?new=1"}>
            New quote
          </Button>
          <Button variant="secondary" size="sm" icon="wrench" onClick={() => window.location.href = "/dashboard/jobs?new=1"}>
            Book job
          </Button>
        </div>
      </div>

      {!briefing && !analytics && (
        <div className="flex items-center justify-center gap-3 py-24 text-[14px] text-mut">
          <Spinner size={18} className="text-brand" />
          Preparing your daily briefing…
        </div>
      )}

      {/* North Star briefing */}
      {briefing && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brandsoft/70 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-brand">
                <Icon name="sparkles" size={14} />
                BizPilot daily briefing
              </div>
              <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed">{briefing.aiParagraph}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  { label: "Jobs today", value: String(s?.jobsToday ?? 0), icon: "wrench", tone: "brand" as const },
                  { label: "New leads", value: String(s?.newLeads ?? 0), icon: "target", tone: "info" as const },
                  { label: "Booked (7d)", value: formatZAR(s?.bookedValue ?? 0), icon: "wallet", tone: "ok" as const },
                  { label: "Outstanding", value: formatZAR(s?.outstanding ?? 0), icon: "receipt", tone: "warn" as const },
                  { label: "Quotes waiting", value: String(s?.quotesWaiting ?? 0), icon: "file", tone: "accent" as const },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-line bg-surface2/60 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-mut">
                      <Icon name={c.icon} size={11} className={c.tone === "ok" ? "text-ok" : c.tone === "warn" ? "text-warn" : "text-brand"} />
                      {c.label}
                    </div>
                    <div className="mt-1 font-display text-[17px] font-semibold tracking-tight">{c.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            {/* handled overnight */}
            <Card className="p-4">
              <div className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold text-ink">
                <Icon name="moon" size={14} className="text-brand" />
                BizPilot handled overnight
              </div>
              <div className="space-y-2">
                {briefing.handledOvernight.map((h) => (
                  <div key={h.text} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-oksoft text-ok">
                      <Icon name="check" size={11} />
                    </span>
                    <span className="flex-1 text-mut">{h.text}</span>
                    <span className="font-display text-[15px] font-semibold">{h.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* attention + recommendation */}
            <Card className="p-4">
              <div className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold">
                <Icon name="alert" size={14} className={briefing.attention.length ? "text-warn" : "text-ok"} />
                Your attention
              </div>
              {briefing.attention.length === 0 && <p className="text-[12.5px] text-mut">Nothing urgent. Good morning to you.</p>}
              <div className="space-y-2">
                {briefing.attention.map((a, i) => (
                  <a key={i} href={a.link ?? "#"} className="flex items-start gap-2.5 rounded-lg bg-warnsoft/60 px-3 py-2 text-[12.5px] leading-snug text-ink transition hover:brightness-95">
                    <Icon name="alert" size={13} className="mt-0.5 shrink-0 text-warn" />
                    {a.text}
                  </a>
                ))}
              </div>
              {briefing.recommendation && (
                <div className="mt-3 rounded-xl border border-brand/25 bg-brandsoft/50 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brandstrong">
                    <Icon name="sparkles" size={12} />
                    BizPilot recommends
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed">{briefing.recommendation.text}</p>
                  {briefing.recommendation.actionId ? (
                    <Button size="sm" className="mt-2.5" onClick={applyRecommendation} disabled={applying}>
                      {applying ? "Applying…" : briefing.recommendation.applyLabel}
                    </Button>
                  ) : (
                    <div className="mt-2.5 text-[12px] font-medium text-ok">
                      <Icon name="check" size={13} className="mr-1 inline" />
                      All clear — no action needed.
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* KPI grid */}
      {k && (
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-display text-[15px] font-semibold">Business performance</h2>
            <div className="flex rounded-lg border border-line bg-surface p-0.5 text-[12px] font-medium">
              {([7, 30, 90] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={cn("btn-focus rounded-md px-2.5 py-1 transition", period === p ? "bg-brand text-white shadow-sm" : "text-mut hover:text-ink")}>
                  {p}d
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label={`Revenue (${period}d)`} value={formatZAR(k.revenue30)} icon="wallet" tone="ok" sub={<span className={k.revenueDeltaPct >= 0 ? "text-ok" : "text-danger"}>{k.revenueDeltaPct >= 0 ? "▲" : "▼"} {Math.abs(k.revenueDeltaPct)}% vs prev</span>} />
            <Kpi label="Outstanding" value={formatZAR(k.outstanding)} icon="receipt" tone="warn" sub={`${k.outstandingCount} open invoice${k.outstandingCount === 1 ? "" : "s"}`} />
            <Kpi label="New leads" value={k.newLeads30} icon="target" tone="info" sub={`${k.conversion}% conversion`} />
            <Kpi label="Jobs today" value={k.jobsToday} icon="wrench" tone="brand" sub={`${k.completed7} completed this week`} />
            <Kpi label="Quotes awaiting" value={k.quotesWaiting} icon="file" tone="accent" sub="Waiting on customers" />
            <Kpi label="Repeat customers" value={k.repeatCustomers} icon="users" tone="ok" sub="2+ completed jobs" />
            <Kpi label="Avg payment time" value={`${analytics?.avgPaymentDays ?? "—"}d`} icon="clock" tone="info" sub="Issue to paid" />
            <Kpi label="Avg job value" value={formatZAR(analytics?.avgJobValue ?? 0)} icon="chart" tone="brand" sub="Per completed job" />
          </div>
        </div>
      )}

      {/* charts row */}
      {analytics && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-[15px] font-semibold">Cash collected</h3>
                <p className="text-[12px] text-mut">Payments received, last 14 days</p>
              </div>
              <Badge tone="ok">
                <Icon name="trend-up" size={11} />
                live
              </Badge>
            </div>
            <BarChart data={analytics.revenue14} money height={170} />
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 font-display text-[15px] font-semibold">Revenue by service</h3>
            {analytics.byService?.length ? (
              <Donut
                parts={analytics.byService.slice(0, 5).map((sv: any, i: number) => ({ name: sv.service.length > 22 ? sv.service.slice(0, 21) + "…" : sv.service, value: sv.total, color: ["#1577ee", "#16CFC7", "#0B1F3D", "#7FB1FF", "#9BE3DF"][i] }))}
                label={formatZAR(analytics.byService.reduce((s: number, x: any) => s + x.total, 0))}
                sub="30 days"
              />
            ) : (
              <p className="py-10 text-center text-[13px] text-mut">No paid invoices yet — your service breakdown will appear here.</p>
            )}
          </Card>
        </div>
      )}

      {/* insights + activity */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold">
              <Icon name="sparkles" size={16} className="text-brand" />
              AI business insights
            </h3>
            <button onClick={() => window.location.href = "/dashboard/analytics"} className="btn-focus text-[12px] font-semibold text-brand hover:underline">
              Full analytics
            </button>
          </div>
          {!analytics ? (
            <div className="flex items-center gap-2 py-8 text-[13px] text-mut">
              <Spinner size={14} /> Crunching your numbers…
            </div>
          ) : (
            <div className="space-y-2.5">
              {analytics.insights.map((ins: any) => (
                <div key={ins.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface2/50 px-3.5 py-3">
                  <span className={cn("mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", ins.tone === "positive" ? "bg-oksoft text-ok" : ins.tone === "warning" ? "bg-warnsoft text-warn" : "bg-infosoft text-info")}>
                    <Icon name={ins.tone === "positive" ? "trend-up" : ins.tone === "warning" ? "alert" : "info"} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-snug">{ins.title}</div>
                    <div className="mt-0.5 text-[12px] leading-relaxed text-mut">{ins.body}</div>
                  </div>
                  {ins.action && (
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent("bp:open-ai-prompt", { detail: ins.action.prompt }))}
                      className="btn-focus shrink-0 self-center rounded-lg bg-surface px-2.5 py-1.5 text-[11.5px] font-semibold text-brandstrong shadow-sm transition hover:bg-brandsoft"
                    >
                      {ins.action.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <TodayJobs />
      </div>
    </div>
  );
}

function TodayJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ items: any[] }>("/jobs?view=today").then((r) => setJobs(r.items)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return (
    <Card className="flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-semibold">Jobs today</h3>
        <button onClick={() => window.location.href = "/dashboard/jobs"} className="btn-focus text-[12px] font-semibold text-brand hover:underline">
          View all
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-mut">
          <Spinner size={14} /> Loading schedule…
        </div>
      ) : jobs.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-mut">No jobs scheduled today.</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface2/50 px-3 py-2.5">
              <div className="w-12 shrink-0 font-display text-[13.5px] font-semibold text-brand">{j.startsAt}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium">
                  {j.customerName ?? "Unassigned"} · {j.service}
                </div>
                <div className="truncate text-[11px] text-mut">
                  {j.jobNumber}
                  {j.suburb ? ` · ${j.suburb}` : ""}
                </div>
              </div>
              <StatusBadge status={j.status} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
