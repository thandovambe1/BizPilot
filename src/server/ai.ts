import "server-only";
import { db } from "@/db";
import { eq, and, desc, asc, sql, gte, lt, lte } from "drizzle-orm";
import {
  customers,
  leads,
  jobs,
  quotes,
  quoteItems,
  invoices,
  invoiceItems,
  payments,
  teamMembers,
  services,
  conversations,
  messages,
  reviews,
  aiActions,
  aiConversations,
  aiMessages,
  leadActivities,
} from "@/db/schema";
import {
  Ctx,
  num,
  todayStr,
  nextDocNumber,
  notify,
  audit,
  logAiUsage,
  getBusinessContext,
  outstandingInvoices,
  overdueInvoices,
  revenueBetween,
} from "./core";

/* ================================================================== */
/* Text utilities                                                      */
/* ================================================================== */

const lower = (s: string) => s.toLowerCase();

export function detectService(text: string, services: { id: string; name: string; category: string }[]): any | null {
  const t = lower(text);
  let best: any = null;
  let bestLen = 0;
  for (const s of services) {
    const name = lower(s.name);
    const words = name.split(/[\s-]+/).filter((w) => w.length > 3);
    const hit = name.split(" ").some((w) => w.length > 4 && t.includes(w)) || (words.length && words.every((w) => t.includes(w)));
    if ((name.length > 4 && t.includes(name)) || (name.length >= 4 && t.includes(name))) {
      if (name.length > bestLen) {
        best = s;
        bestLen = name.length;
      }
    } else if (hit && words.length >= 2 && !best) {
      best = s;
      bestLen = 2;
    }
  }
  if (best) return best;
  // category keywords
  const catMap: Record<string, string> = {
    geyser: "geyser",
    leak: "leak",
    drain: "drain",
    toilet: "toilet",
    pipe: "pipe",
    bathroom: "bathroom",
    electric: "electric",
    light: "light",
    socket: "socket",
    board: "board",
    solar: "solar",
    gate: "gate motor",
    ac: "air conditioning",
  };
  for (const [key, label] of Object.entries(catMap)) {
    if (t.includes(key)) {
      const s = services.find((sv) => lower(sv.name).includes(label) || lower(sv.name).includes(key));
      if (s) return s;
    }
  }
  return null;
}

const ESCALATION_PATTERNS: [RegExp, string][] = [
  [/angry|furious|unacceptable|worst service|rip ?off|scam/i, "Customer is upset about service"],
  [/refund|money back|compensation/i, "Refund request"],
  [/lawyer|legal|sca |court|poche/i, "Legal threat"],
  [/shock|electrocuted|gas leak|flood(ed|ing) (the|my)|fire/i, "Safety issue reported"],
  [/human|agent|someone from your team|talk to (a )?person|call me back/i, "Customer requested a human"],
  [/negotiat|too (expensive|much|high)[.!?]?$/i, "Pricing negotiation in progress"],
];

export function detectEscalation(text: string): { escalate: boolean; reason: string | null } {
  for (const [re, reason] of ESCALATION_PATTERNS) {
    if (re.test(text)) return { escalate: true, reason };
  }
  return { escalate: false, reason: null };
}

export function scoreLeadSignal(text: string, hasSuburb: boolean, hasPhone: boolean): { score: number; reason: string; urgency: string } {
  const t = lower(text);
  let score = 30;
  const parts: string[] = ["Standard enquiry"];
  let urgency = "normal";
  if (/emergency|burst|flood|no (hot water|power)|leak(ing)? (heavily|badly)|danger/i.test(t)) {
    score += 25;
    urgency = "emergency";
    parts.push("Emergency keywords detected");
  } else if (/urgent|today|asap|now|tomorrow/i.test(t)) {
    score += 15;
    urgency = "high";
    parts.push("Urgent timing requested");
  }
  if (hasSuburb) {
    score += 15;
    parts.push("Location provided");
  }
  if (hasPhone) {
    score += 10;
    parts.push("Contact details complete");
  }
  if (/book|come (out|over)|send (a )?(tech|plumber|electrician)|arrange/i.test(t)) {
    score += 10;
    parts.push("Booking intent");
  }
  if (/\br[0-9]|[0-9]+ ?(rand|bucks)|budget/i.test(t)) {
    score += 10;
    parts.push("Budget mentioned");
  }
  score = Math.min(100, score);
  return { score, reason: parts.join(". "), urgency };
}

function parseWhen(text: string): { date?: string; time: string } {
  const t = lower(text);
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  let date: string | undefined;
  if (t.includes("tomorrow")) date = iso(new Date(now.getTime() + 86400000));
  else if (t.includes("today")) date = todayStr();
  else {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const di = days.findIndex((d) => t.includes(d));
    if (di >= 0) {
      const diff = (di - now.getDay() + 7) % 7 || 7;
      date = iso(new Date(now.getTime() + diff * 86400000));
    }
  }
  let time: string | undefined;
  const hm = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (hm) {
    let h = Number(hm[1]);
    const m = hm[2] ? Number(hm[2]) : 0;
    if (hm[3] === "pm" && h < 12) h += 12;
    if (hm[3] === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && (!date || h >= 7 && h <= 19)) time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return { date, time: time ?? "09:00" };
}

async function findCustomerByMention(businessId: string, text: string): Promise<any | null> {
  const t = lower(text);
  const all = await db.select().from(customers).where(eq(customers.businessId, businessId)).limit(500);
  for (const c of all) {
    const names = c.name.toLowerCase().split(/\s+/);
    for (const n of names) {
      if (n.length >= 3 && new RegExp(`\\b${n}\\b`, "i").test(text)) return c;
    }
    if (c.name.toLowerCase().length >= 4 && t.includes(c.name.toLowerCase())) return c;
  }
  return null;
}

/* ================================================================== */
/* Scheduling engine                                                   */
/* ================================================================== */

const toMin = (t: string) => {
  const [h, m] = (t || "09:00").split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export async function findSlot(businessId: string, dateIso: string, start: string, durationMin: number, preferredMemberId?: string): Promise<any> {
  const team = await db.select().from(teamMembers).where(and(eq(teamMembers.businessId, businessId), eq(teamMembers.active, true)));
  const jobsDay = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.businessId, businessId), eq(jobs.date, dateIso), sql`${jobs.status} not in ('completed','cancelled','new')`));
  const hourRow = await db
    .select()
    .from(
      (await import("@/db/schema")).workingHours
    )
    .where(and(eq((await import("@/db/schema")).workingHours.businessId, businessId), eq((await import("@/db/schema")).workingHours.day, new Date(dateIso + "T00:00:00").getDay())));
  const open = hourRow.length ? toMin(hourRow[0].opensAt) : 8 * 60;
  const close = hourRow.length ? toMin(hourRow[0].closesAt) : 17 * 60;

  const busy = (memberId: string) => jobsDay.filter((j) => j.teamMemberId === memberId);
  const candidates = preferredMemberId ? team.filter((tm) => tm.id === preferredMemberId).concat(team.filter((tm) => tm.id !== preferredMemberId)) : team;

  for (const tm of candidates) {
    const dayJobs = busy(tm.id).sort((a, b) => toMin(a.startsAt) - toMin(b.startsAt));
    let blocked: [number, number][] = dayJobs.map((j) => {
      const s = toMin(j.startsAt);
      const d = j.endsAt ? toMin(j.endsAt) - s : 60;
      return [s, s + d] as [number, number];
    });
    const s0 = toMin(start);
    const fits = (s: number) => s >= open && s + durationMin <= close && !blocked.some(([bs, be]) => s < be && s + durationMin > bs);
    if (fits(s0)) return { ok: true, member: tm, time: start };
    // suggest next free hour
    for (let s = open; s + durationMin <= close; s += 30) {
      if (fits(s)) return { ok: true, member: tm, time: toHHMM(s), suggested: true };
    }
  }
  return { ok: false, reason: `No technician availability found on ${dateIso} between ${toHHMM(open)} and ${toHHMM(close)}.` };
}

export async function detectConflicts(businessId: string, dateIso: string) {
  const dayJobs = (await db.select().from(jobs).where(and(eq(jobs.businessId, businessId), eq(jobs.date, dateIso)))).filter(
    (j) => !["completed", "cancelled", "new"].includes(j.status) && j.teamMemberId
  );
  const conflicts: any[] = [];
  const byMember = new Map<string, any[]>();
  for (const j of dayJobs) {
    const arr = byMember.get(j.teamMemberId!) ?? [];
    arr.push(j);
    byMember.set(j.teamMemberId!, arr);
  }
  for (const [memberId, arr] of byMember) {
    const sorted = [...arr].sort((a, b) => toMin(a.startsAt) - toMin(b.startsAt));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const endA = a.endsAt ? toMin(a.endsAt) : toMin(a.startsAt) + 60;
      const gap = toMin(b.startsAt) - endA;
      if (gap < 30) {
        conflicts.push({ memberId, from: a, to: b, gap, date: dateIso });
      }
    }
  }
  return conflicts;
}

/* ================================================================== */
/* Analytics tools                                                     */
/* ================================================================== */

export async function computeKpis(businessId: string) {
  const now = new Date();
  const d = (days: number, from = now) => new Date(from.getTime() - days * 86400000);
  const [rev30, rev30Prev] = await Promise.all([revenueBetween(businessId, d(30), now), revenueBetween(businessId, d(60), d(30))]);
  const out = await outstandingInvoices(businessId);
  const revDeltaPct = rev30Prev > 0 ? Math.round(((rev30 - rev30Prev) / rev30Prev) * 100) : 0;

  const [newLeads30, allLeads] = await Promise.all([
    db.select().from(leads).where(and(eq(leads.businessId, businessId), gte(leads.createdAt, d(30)))),
    db.select().from(leads).where(eq(leads.businessId, businessId)),
  ]);
  const closedWon = allLeads.filter((l) => ["won", "booked"].includes(l.status)).length;
  const conversion = allLeads.length ? Math.round((closedWon / allLeads.length) * 100) : 0;

  const today = todayStr();
  const jobsTodayRows = await db.select().from(jobs).where(and(eq(jobs.businessId, businessId), eq(jobs.date, today)));
  const jobsToday = jobsTodayRows.filter((j) => j.status !== "cancelled").length;

  const [qw] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quotes)
    .where(and(eq(quotes.businessId, businessId), sql`${quotes.status} in ('sent','viewed')`));

  const completed7 = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.businessId, businessId), eq(jobs.status, "completed"), gte(jobs.createdAt, d(7))));

  const custJobCounts: any[] = await db
    .select({ customerId: customers.id, n: sql<number>`count(*)::int` })
    .from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .where(and(eq(jobs.businessId, businessId), eq(jobs.status, "completed")))
    .groupBy(customers.id);
  const repeatCustomers = custJobCounts.filter((r) => r.n >= 2).length;

  return {
    revenue30: Math.round(rev30),
    revenue30Prev: Math.round(rev30Prev),
    revenueDeltaPct: revDeltaPct,
    outstanding: Math.round(out.total),
    outstandingCount: out.items.length,
    newLeads30: newLeads30.length,
    conversion,
    jobsToday,
    quotesWaiting: qw?.n ?? 0,
    completed7: completed7[0]?.n ?? 0,
    repeatCustomers,
  };
}

export async function revenueSeries(businessId: string, days: number) {
  const out: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const from = new Date(Date.now() - (i + 1) * 86400000);
    const to = new Date(Date.now() - i * 86400000);
    const v = await revenueBetween(businessId, from, to);
    out.push({ label: from.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }), value: Math.round(v) });
  }
  return out;
}

export async function revenueByService(businessId: string, days: number) {
  const from = new Date(Date.now() - days * 86400000);
  const rows: any[] = await db
    .select({ service: sql<string>`coalesce(${jobs.service}, 'Other')`, total: sql<number>`coalesce(sum(${payments.amount}),0)` })
    .from(payments)
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .where(and(eq(payments.businessId, businessId), eq(payments.status, "completed"), gte(payments.createdAt, from)))
    .groupBy(jobs.service);
  const top = [...rows].sort((a, b) => b.total - a.total).slice(0, 6);
  const grand = top.reduce((s, r) => s + num(r.total), 0);
  return top.map((r) => ({ service: r.service, total: Math.round(num(r.total)), share: grand ? Math.round((num(r.total) / grand) * 100) : 0 }));
}

export async function leadsBySource(businessId: string) {
  const rows: any[] = await db
    .select({ source: sql<string>`coalesce(${leads.source}, 'other')`, n: sql<number>`count(*)::int`, won: sql<number>`count(*) filter (where ${leads.status} in ('won','booked'))::int` })
    .from(leads)
    .where(eq(leads.businessId, businessId))
    .groupBy(leads.source);
  return rows
    .map((r) => ({ source: r.source, total: r.n, won: r.won, rate: r.n ? Math.round((r.won / r.n) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
}

export async function techPerformance(businessId: string, days = 30) {
  const from = new Date(Date.now() - days * 86400000);
  const rows: any[] = await db
    .select({ member: sql<string>`coalesce(${jobs.teamMemberName}, 'Unassigned')`, n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.businessId, businessId), eq(jobs.status, "completed"), gte(jobs.createdAt, from)))
    .groupBy(jobs.teamMemberName);
  return [...rows].sort((a, b) => b.n - a.n).map((r) => ({ member: r.member, jobs: r.n }));
}

export async function quoteAcceptance(businessId: string) {
  const rows = await db.select().from(quotes).where(and(eq(quotes.businessId, businessId), sql`${quotes.status} in ('accepted','rejected')`));
  const accepted = rows.filter((r) => r.status === "accepted").length;
  const total = rows.length;
  return { rate: total ? Math.round((accepted / total) * 100) : 0, accepted, total };
}

/* ================================================================== */
/* Insights                                                            */
/* ================================================================== */

export interface Insight {
  id: string;
  tone: "positive" | "warning" | "info";
  title: string;
  body: string;
  action?: { label: string; prompt: string } | null;
}

export async function computeInsights(businessId: string): Promise<Insight[]> {
  const out: Insight[] = [];
  const kpis = await computeKpis(businessId);
  const overdue = await overdueInvoices(businessId);
  const srcs = await leadsBySource(businessId);
  const bySvc = await revenueByService(businessId, 30);
  const acceptance = await quoteAcceptance(businessId);
  const techs = await techPerformance(businessId, 30);

  if (kpis.revenueDeltaPct !== 0) {
    const up = kpis.revenueDeltaPct > 0;
    out.push({
      id: "rev-trend",
      tone: up ? "positive" : "warning",
      title: `Revenue is ${up ? "up" : "down"} ${Math.abs(kpis.revenueDeltaPct)}% vs last month`,
      body: `You received R ${Math.round(kpis.revenue30).toLocaleString("en-ZA")} in the last 30 days, compared with R ${Math.round(kpis.revenue30Prev).toLocaleString("en-ZA")} before that.`,
    });
  }
  if (overdue.length > 0) {
    const total = overdue.reduce((s, i) => s + i.balance, 0);
    out.push({
      id: "overdue",
      tone: "warning",
      title: `R ${Math.round(total).toLocaleString("en-ZA")} is currently overdue`,
      body: `${overdue.length} invoice${overdue.length > 1 ? "s" : ""} past due date, oldest ${Math.round((Date.now() - new Date(overdue[0].dueDate).getTime()) / 86400000)} days.`,
      action: { label: "Send reminders", prompt: "Send payment reminders to overdue customers" },
    });
  }
  const bestSrc = srcs.filter((s) => s.total >= 2).sort((a, b) => b.rate - a.rate)[0];
  if (bestSrc) {
    out.push({
      id: "source",
      tone: "info",
      title: `Your fastest converting lead source is ${bestSrc.source}`,
      body: `${bestSrc.rate}% of ${bestSrc.source} leads convert to booked or won, vs ${srcs.reduce((s, r) => s + r.won, 0)}/${srcs.reduce((s, r) => s + r.total, 0)} overall.`,
    });
  }
  if (bySvc[0] && bySvc.length > 1) {
    out.push({
      id: "top-service",
      tone: "positive",
      title: `${bySvc[0].service} drives ${bySvc[0].share}% of revenue`,
      body: `${bySvc[0].service} generated R ${bySvc[0].total.toLocaleString("en-ZA")} in the last 30 days across ${bySvc.length} services.`,
    });
  }
  if (acceptance.total > 0) {
    out.push({
      id: "acceptance",
      tone: acceptance.rate >= 60 ? "positive" : "warning",
      title: `Quote acceptance rate is ${acceptance.rate}%`,
      body: `${acceptance.accepted} of ${acceptance.total} responded quotes were accepted.`,
    });
  }
  if (techs[0]) {
    out.push({
      id: "top-tech",
      tone: "info",
      title: `${techs[0].member} completed the most jobs`,
      body: `${techs[0].jobs} jobs completed in the last 30 days.`,
    });
  }
  if (kpis.repeatCustomers > 0) {
    out.push({
      id: "repeat",
      tone: "positive",
      title: `${kpis.repeatCustomers} customers book repeat jobs`,
      body: "Repeat customers have 2 or more completed jobs. A short check-in can turn them into regulars.",
    });
  }
  return out.slice(0, 6);
}

/* ================================================================== */
/* Briefing                                                            */
/* ================================================================== */

export interface BriefingResult {
  greeting: string;
  headline: string;
  stats: Record<string, number>;
  handledOvernight: { text: string; value: number }[];
  attention: { type: string; text: string; link?: string | null }[];
  recommendation: { text: string; actionId: string | null; applyLabel: string } | null;
  aiParagraph: string;
  generatedAt: string;
}

async function insertAction(businessId: string, conversationId: string | null, agent: string, action: string, tool: string, reason: string, input: any) {
  const [row] = await db.insert(aiActions).values({ businessId, aiConversationId: conversationId, agent, action, tool, reason, input: JSON.stringify(input), status: "suggested" }).returning();
  return row.id;
}

export async function computeBriefing(businessId: string): Promise<BriefingResult> {
  const kpis = await computeKpis(businessId);
  const overdue = await overdueInvoices(businessId);
  const overdueTotal = overdue.reduce((s, i) => s + i.balance, 0);
  const today = todayStr();

  // overnight activity (last 24h)
  const since24 = new Date(Date.now() - 86400000);
  const [inMsgs, aiActs, leads24] = await Promise.all([
    db.select().from(messages).where(and(eq(messages.businessId, businessId), eq(messages.direction, "in"), gte(messages.createdAt, since24))),
    db.select().from(aiActions).where(and(eq(aiActions.businessId, businessId), gte(aiActions.createdAt, since24), eq(aiActions.status, "executed"))),
    db.select().from(leads).where(and(eq(leads.businessId, businessId), gte(leads.createdAt, since24))),
  ]);
  const reminders = aiActs.filter((a) => a.action === "send_reminders").length;
  const handled = inMsgs.filter((m) => m.author === "customer").length;

  const jobsToday = await db.select().from(jobs).where(and(eq(jobs.businessId, businessId), eq(jobs.date, today)));
  const bookedValue = await revenueBetween(businessId, new Date(Date.now() - 7 * 86400000), new Date());

  // attention items
  const attention: BriefingResult["attention"] = [];
  const convoRows = await db.select().from(conversations).where(and(eq(conversations.businessId, businessId), eq(conversations.unread, true)));
  for (const c of convoRows.slice(0, 3)) {
    const hrs = (Date.now() - new Date(c.lastMessageAt).getTime()) / 3600000;
    if (hrs > 2) {
      attention.push({ type: "customer", text: `A customer has been waiting ${Math.round(hrs)} hours for a response.`, link: "/dashboard/inbox" });
      break;
    }
  }
  if (overdue[0]) {
    attention.push({
      type: "invoice",
      text: `${overdue[0].invoiceNumber} is ${Math.round((Date.now() - new Date(overdue[0].dueDate).getTime()) / 86400000)} days overdue (R ${Math.round(overdue[0].balance).toLocaleString("en-ZA")}).`,
      link: "/dashboard/invoices",
    });
  }
  const conflicts = (await detectConflicts(businessId, today)).concat(await detectConflicts(businessId, new Date(Date.now() + 86400000).toISOString().slice(0, 10)));
  if (conflicts[0]) {
    attention.push({ type: "schedule", text: `Schedule conflict: ${conflicts[0].from.jobNumber} and ${conflicts[0].to.jobNumber} are only ${Math.max(0, conflicts[0].gap)} minutes apart.`, link: "/dashboard/jobs" });
  }

  // recommendation
  let recommendation: BriefingResult["recommendation"] = null;
  if (conflicts[0]) {
    const c = conflicts[0];
    const team = await db.select().from(teamMembers).where(and(eq(teamMembers.businessId, businessId), eq(teamMembers.active, true)));
    const alt = team.find((tm) => tm.id !== c.from.teamMemberId);
    if (alt) {
      const actionId = await insertAction(
        businessId,
        null,
        "AI Scheduling Agent",
        "reassign_job",
        "reassignJob",
        "Avoid schedule conflict",
        { jobId: c.from.id, jobNumber: c.from.jobNumber, fromName: c.from.teamMemberName, toId: alt.id, toName: alt.name, date: c.date, time: c.from.startsAt }
      );
      recommendation = { text: `Move ${c.from.jobNumber} (${c.from.startsAt}) to ${alt.name}. This avoids the clash and keeps both jobs on time.`, actionId, applyLabel: "Apply recommendation" };
    }
  } else if (overdue.length > 0) {
    const actionId = await insertAction(businessId, null, "AI Finance Agent", "send_reminders", "sendPaymentReminders", "Invoices past due", {
      invoices: overdue.map((i) => ({ id: i.id, number: i.invoiceNumber, customerName: i.customerName ?? "customer", balance: i.balance, days: Math.round((Date.now() - new Date(i.dueDate).getTime()) / 86400000) })),
    });
    recommendation = { text: `Send payment reminders for ${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} totalling R ${Math.round(overdueTotal).toLocaleString("en-ZA")}.`, actionId, applyLabel: "Send reminders" };
  } else if (leads24.length > 0) {
    const top = leads24.sort((a, b) => b.score - a.score)[0];
    const actionId = await insertAction(businessId, null, "AI Sales Agent", "follow_up_leads", "followUpLeads", "High-score lead needs a follow-up", {
      leads: [{ id: top.id, name: top.name, service: top.service ?? "your enquiry", phone: top.phone }],
    });
    recommendation = { text: `Follow up with ${top.name} (lead score ${top.score}) about ${top.service ?? "their enquiry"} — they responded quickly and are likely to book.`, actionId, applyLabel: "Start follow-up" };
  }

  const overdueInv = await overdueInvoices(businessId);
  const quotesWaiting = kpis.quotesWaiting;
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const headline = attention.length ? `${attention.length} item${attention.length > 1 ? "s" : ""} need your attention today` : "Your business is under control.";

  const aiParagraph = [
    `${greeting} 👋`,
    `You have ${kpis.jobsToday} job${kpis.jobsToday === 1 ? "" : "s"} today${bookedValue ? ` and R ${Math.round(bookedValue).toLocaleString("en-ZA")} has been collected in the past week.` : "."}`,
    `${leads24.length} new lead${leads24.length === 1 ? "" : "s"} in the last 24 hours${kpis.outstanding ? `, and R ${Math.round(kpis.outstanding).toLocaleString("en-ZA")} is currently outstanding.` : "."}`,
    quotesWaiting ? `${quotesWaiting} quote${quotesWaiting > 1 ? "s are" : " is"} waiting for a customer response.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    greeting,
    headline,
    stats: {
      jobsToday: kpis.jobsToday,
      newLeads: leads24.length,
      bookedValue: Math.round(bookedValue),
      outstanding: Math.round(kpis.outstanding),
      quotesWaiting,
      overdue: Math.round(overdueInv.reduce((s, i) => s + i.balance, 0)),
    },
    handledOvernight: [
      { text: "Customer enquiries handled", value: handled },
      { text: "Leads qualified by AI", value: leads24.length },
      { text: "Payment reminders sent", value: reminders },
    ],
    attention,
    recommendation,
    aiParagraph,
    generatedAt: new Date().toISOString(),
  };
}

/* ================================================================== */
/* Action executors                                                    */
/* ================================================================== */

async function findOrCreateConversation(businessId: string, customerId: string, subject: string, channel = "whatsapp") {
  const existing = await db.select().from(conversations).where(and(eq(conversations.businessId, businessId), eq(conversations.customerId, customerId)));
  if (existing.length) return existing[0];
  const cust = await db.select().from(customers).where(eq(customers.id, customerId));
  const [row] = await db
    .insert(conversations)
    .values({ businessId, customerId, channel, subject, mode: "human", aiStatus: "resolved", unread: false, location: cust[0]?.suburb ?? null, recommendedAction: null, lastMessagePreview: "" })
    .returning();
  return row;
}

export async function executeAction(businessId: string, actionId: string, approve: boolean, userId: string): Promise<{ ok: boolean; text: string }> {
  const [action] = await db.select().from(aiActions).where(and(eq(aiActions.id, actionId), eq(aiActions.businessId, businessId)));
  if (!action) return { ok: false, text: "That action expired. Please ask again." };
  if (action.status !== "suggested") return { ok: false, text: "This action was already handled." };
  if (!approve) {
    await db.update(aiActions).set({ status: "cancelled", confirmedByUserId: userId }).where(eq(aiActions.id, actionId));
    return { ok: true, text: "Cancelled — no changes were made." };
  }
  const input = JSON.parse(action.input || "{}");
  let result = "Done.";
  try {
    if (action.action === "send_reminders") {
      const invs: any[] = input.invoices || [];
      for (const inv of invs) {
        const [full] = await db.select().from(invoices).where(eq(invoices.id, inv.id));
        if (!full || !full.customerId) continue;
        const conv = await findOrCreateConversation(businessId, full.customerId, `Payment reminder ${inv.number}`);
        const text = `Hi 👋 This is a friendly reminder from your service provider that invoice ${inv.number} for R ${Math.round(inv.balance).toLocaleString("en-ZA")} is now ${inv.days} day${inv.days === 1 ? "" : "s"} overdue. You can settle by EFT or card — reply here with the payment reference and we'll confirm receipt. Thanks!`;
        await db.insert(messages).values({ businessId, conversationId: conv.id, customerId: full.customerId, direction: "out", author: "bizpilot_ai", body: text, channel: "whatsapp" });
        await db.update(conversations).set({ lastMessagePreview: text.slice(0, 90), lastMessageAt: new Date(), unread: false }).where(eq(conversations.id, conv.id));
        await db.update(invoices).set({ lastReminderAt: new Date() }).where(eq(invoices.id, full.id));
      }
      const total = invs.reduce((s, i) => s + num(i.balance), 0);
      result = `Sent ${invs.length} payment reminder${invs.length === 1 ? "" : "s"} totalling R ${Math.round(total).toLocaleString("en-ZA")}. I'll flag again in 3 days for anything still unpaid.`;
      await notify(businessId, "invoice_overdue", "Payment reminders sent", `${invs.length} reminder(s) sent by AI Finance Agent`);
    } else if (action.action === "create_quote") {
      const number = await nextDocNumber(quotes, quotes.quoteNumber, businessId, "Q-");
      const [q] = await db
        .insert(quotes)
        .values({
          businessId,
          quoteNumber: number,
          customerId: input.customerId,
          status: "draft",
          notes: input.notes ?? null,
          aiGenerated: true,
          subtotal: String(input.items.reduce((s: number, it: any) => s + num(it.unitPrice) * num(it.qty || 1), 0)),
          total: String(input.items.reduce((s: number, it: any) => s + num(it.unitPrice) * num(it.qty || 1), 0)),
        })
        .returning();
      await db.insert(quoteItems).values(
        input.items.map((it: any, i: number) => ({
          quoteId: q.id,
          businessId,
          type: it.type ?? "service",
          name: it.name,
          description: it.description ?? null,
          qty: String(it.qty ?? 1),
          unitPrice: String(it.unitPrice),
          amount: String(num(it.unitPrice) * num(it.qty ?? 1)),
          sortOrder: i,
        }))
      );
      result = `Quote ${number} created for ${input.customerName} (R ${Math.round(num(q.total)).toLocaleString("en-ZA")} incl. VAT will be shown after VAT is applied). It's saved as a draft — review and send it from Quotes.`;
      await notify(businessId, "new_lead", "Quote draft ready", `${number} for ${input.customerName} created by BizPilot AI`);
    } else if (action.action === "create_job") {
      const slot = await findSlot(businessId, input.date, input.start, input.durationMin ?? 60, input.teamMemberId);
      if (!slot.ok) {
        await db.update(aiActions).set({ status: "failed", result: slot.reason, confirmedByUserId: userId }).where(eq(aiActions.id, actionId));
        return { ok: false, text: `I couldn't book this: ${slot.reason} Try a different time?` };
      }
      const number = await nextDocNumber(jobs, jobs.jobNumber, businessId, "JOB-");
      const [j] = await db
        .insert(jobs)
        .values({
          businessId,
          jobNumber: number,
          customerId: input.customerId,
          service: input.service,
          description: input.description ?? null,
          address: input.address ?? null,
          suburb: input.suburb ?? null,
          teamMemberId: slot.member.id,
          teamMemberName: slot.member.name,
          date: input.date,
          startsAt: slot.time,
          priority: input.priority ?? "normal",
          status: "scheduled",
        })
        .returning();
      if (input.leadId) {
        await db.update(leads).set({ status: "booked", closedAt: new Date() }).where(eq(leads.id, input.leadId));
        await db.insert(leadActivities).values({ businessId, leadId: input.leadId, type: "status_changed", note: `Job ${number} booked by AI`, actor: "AI Scheduling Agent" });
      }
      result = `Booked ${input.customerName} for ${new Date(input.date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })} at ${slot.time}${slot.suggested ? " (next free slot)" : ""} with ${slot.member.name} — Job ${number}.`;
      await notify(businessId, "new_booking", "New job booked by AI", `${number} for ${input.customerName}, ${input.date} ${slot.time}, ${slot.member.name}`);
      await audit(businessId, "AI Scheduling Agent", "Booked job", "job", j.id, { jobNumber: number, member: slot.member.name });
    } else if (action.action === "follow_up_leads") {
      const ls: any[] = input.leads || [];
      for (const l of ls) {
        const [full] = await db.select().from(leads).where(eq(leads.id, l.id));
        if (!full) continue;
        const cust = full.customerId ? await db.select().from(customers).where(eq(customers.id, full.customerId)) : [];
        if (cust.length && cust[0].id) {
          const conv = await findOrCreateConversation(businessId, cust[0].id, `Follow-up: ${l.service}`);
          const text = `Hi ${l.name.split(" ")[0]} 👋 It's BizPilot for your service provider. I'm following up on your enquiry for ${l.service} — we still have space this week. Would you like me to book you in?`;
          await db.insert(messages).values({ businessId, conversationId: conv.id, customerId: cust[0].id, direction: "out", author: "bizpilot_ai", body: text, channel: "whatsapp" });
          await db.update(conversations).set({ lastMessagePreview: text.slice(0, 90), lastMessageAt: new Date(), unread: false }).where(eq(conversations.id, conv.id));
        }
        await db.update(leads).set({ status: full.status === "new" ? "contacted" : full.status }).where(eq(leads.id, full.id));
      }
      result = `Started ${ls.length} follow-up${ls.length === 1 ? "" : "s"}. I'll ping you again tomorrow if there's no reply.`;
    } else if (action.action === "follow_up_customers") {
      const cs: any[] = input.customers || [];
      for (const c of cs) {
        if (!c.id) continue;
        const conv = await findOrCreateConversation(businessId, c.id, "We miss you");
        const text = `Hi ${c.name.split(" ")[0]} 👋 It's been a while since your last job with us. Anything we can help with this season? Booking is quick — just reply here.`;
        await db.insert(messages).values({ businessId, conversationId: conv.id, customerId: c.id, direction: "out", author: "bizpilot_ai", body: text, channel: "whatsapp" });
        await db.update(conversations).set({ lastMessagePreview: text.slice(0, 90), lastMessageAt: new Date(), unread: false }).where(eq(conversations.id, conv.id));
      }
      result = `Sent ${cs.length} win-back message${cs.length === 1 ? "" : "s"} to lapsed customers.`;
    } else if (action.action === "reassign_job") {
      await db.update(jobs).set({ teamMemberId: input.toId, teamMemberName: input.toName }).where(eq(jobs.id, input.jobId));
      result = `Moved ${input.jobNumber} to ${input.toName}. The ${input.fromName} schedule is now clear.`;
      await audit(businessId, "AI Scheduling Agent", "Reassigned job", "job", input.jobId, { to: input.toName });
    } else if (action.action === "request_reviews") {
      const js: any[] = input.jobs || [];
      for (const j of js) {
        const [job] = await db.select().from(jobs).where(eq(jobs.id, j.id));
        if (!job?.customerId) continue;
        const conv = await findOrCreateConversation(businessId, job.customerId, "How did we do?");
        const text = `Hi ${j.customerName.split(" ")[0]} 👋 Thanks for choosing us for your ${job.service.toLowerCase()}. How did we do? If you had 5 stars, would you consider leaving a quick Google review? And if anything was off, tell me — I'll take it straight to the owner.`;
        await db.insert(messages).values({ businessId, conversationId: conv.id, customerId: job.customerId, direction: "out", author: "bizpilot_ai", body: text, channel: "whatsapp" });
        await db.update(conversations).set({ lastMessagePreview: text.slice(0, 90), lastMessageAt: new Date(), unread: false }).where(eq(conversations.id, conv.id));
      }
      result = `Sent ${js.length} review request${js.length === 1 ? "" : "s"}. Negative replies will automatically raise a support task.`;
    }
    await db.update(aiActions).set({ status: "executed", result, confirmedByUserId: userId }).where(eq(aiActions.id, actionId));
    await audit(businessId, action.agent, `${action.action}`, action.tool, actionId, { result: result.slice(0, 200) });
  } catch (e: any) {
    await db.update(aiActions).set({ status: "failed", result: e?.message ?? "Error", confirmedByUserId: userId }).where(eq(aiActions.id, actionId));
    return { ok: false, text: "That action failed. Please check the details and try again." };
  }
  return { ok: true, text: result };
}

/* ================================================================== */
/* Chat orchestrator — BizPilot AI (AI CEO agent)                      */
/* ================================================================== */

export interface ChatEvent {
  t: "status" | "card" | "text" | "action" | "done" | "error";
  agent?: string;
  text?: string;
  card?: any;
  action?: { id: string; label: string; description: string; confirmLabel: string; cancelLabel: string };
}

const tonePrefix: Record<string, (s: string) => string> = {
  friendly: (s) => s,
  professional: (s) => s,
  formal: (s) => s,
  casual: (s) => s,
};

export async function handleChat(
  businessId: string,
  userId: string,
  conversationId: string | null,
  text: string,
  emit: (ev: ChatEvent) => void
): Promise<void> {
  const ctx: Ctx = { user: { id: userId, email: "", name: "", isPlatformAdmin: false, businessId, role: "owner" }, businessId, role: "owner" };
  const bizCtx = await getBusinessContext(businessId);
  if (!bizCtx) throw new Error("Business not found");
  const tone = bizCtx.settings?.aiTone ?? "friendly";
  const autonomy = bizCtx.settings?.aiAutonomy ?? "confirm";
  const applyTone = tonePrefix[tone] ?? ((s: string) => s);
  const t = lower(text);

  let convId = conversationId;
  if (!convId) {
    const [conv] = await db.insert(aiConversations).values({ businessId, userId, title: text.slice(0, 60) || "New conversation" }).returning();
    convId = conv.id;
  }
  await db.insert(aiMessages).values({ businessId, aiConversationId: convId, role: "user", content: text });
  await db.update(aiConversations).set({ title: (await db.select().from(aiConversations).where(eq(aiConversations.id, convId)))[0]?.title ?? "Conversation" }).where(eq(aiConversations.id, convId));

  const push = (content: string, data: any = {}) =>
    db.insert(aiMessages).values({ businessId, aiConversationId: convId, role: "assistant", content, data: JSON.stringify(data) });

  const makeAction = async (agent: string, action: string, tool: string, reason: string, input: any, label: string, description: string, confirmLabel: string) => {
    const id = await insertAction(businessId, convId, agent, action, tool, reason, input);
    emit({ t: "action", action: { id, label, description, confirmLabel, cancelLabel: "Cancel" } });
    return id;
  };
  const maybeAuto = (routine: boolean) => autonomy === "autonomous" && routine;

  const finish = async (content: string, cards: any[] = []) => {
    emit({ t: "text", text: applyTone(content) });
    await push(applyTone(content), { cards });
    await logAiUsage(businessId, "ceo", text.length, content.length);
    emit({ t: "done" });
  };

  try {
    /* ---- Greetings ---- */
    if (/^(hi|hey|hello|good (morning|afternoon|evening))[.! ]*$/.test(t)) {
      const k = await computeKpis(businessId);
      return finish(
        `Hey 👋 Here's the picture right now: ${k.jobsToday} job${k.jobsToday === 1 ? "" : "s"} today, ${k.newLeads30} new leads in the last 30 days, R ${k.outstanding.toLocaleString("en-ZA")} outstanding. What would you like to look at?`
      );
    }

    /* ---- Send payment reminders (explicit) ---- */
    if (/send.*(remind|follow ?up)|reminders? (to|for)|chase.*(payment|invoice)/.test(t)) {
      emit({ t: "status", agent: "AI Finance Agent", text: "Checking overdue invoices…" });
      const overdue = await overdueInvoices(businessId);
      if (!overdue.length) return finish("Good news — there are no overdue invoices. Nothing to chase right now.");
      const total = overdue.reduce((s, i) => s + i.balance, 0);
      emit({
        t: "card",
        card: {
          kind: "stats",
          title: "Overdue invoices",
          rows: [
            { label: "Invoices", value: String(overdue.length) },
            { label: "Outstanding", value: `R ${Math.round(total).toLocaleString("en-ZA")}` },
            { label: "Oldest", value: `${Math.round((Date.now() - new Date(overdue[0].dueDate).getTime()) / 86400000)} days` },
          ],
          items: overdue.slice(0, 5).map((i) => ({ id: i.id, title: `${i.invoiceNumber} — ${i.customerName ?? "Customer"}`, value: `R ${Math.round(i.balance).toLocaleString("en-ZA")}`, extra: `${Math.round((Date.now() - new Date(i.dueDate).getTime()) / 86400000)}d overdue` })),
        },
      });
      const desc = `Draft a polite WhatsApp reminder for ${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} totalling R ${Math.round(total).toLocaleString("en-ZA")}.`;
      if (maybeAuto(true)) {
        const id = await makeAction("AI Finance Agent", "send_reminders", "sendPaymentReminders", "Autonomous mode", { invoices: overdue.map((i) => ({ id: i.id, number: i.invoiceNumber, customerName: i.customerName ?? "customer", balance: i.balance, days: Math.round((Date.now() - new Date(i.dueDate).getTime()) / 86400000) })) }, "Sending reminders", desc, "Send");
        const res = await executeAction(businessId, id, true, userId);
        return finish(res.text);
      }
      makeAction("AI Finance Agent", "send_reminders", "sendPaymentReminders", "Invoices past due", { invoices: overdue.map((i) => ({ id: i.id, number: i.invoiceNumber, customerName: i.customerName ?? "customer", balance: i.balance, days: Math.round((Date.now() - new Date(i.dueDate).getTime()) / 86400000) })) }, "Send payment reminders", desc, "Send reminders");
      return finish(`I found ${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} totalling R ${Math.round(total).toLocaleString("en-ZA")}. Shall I send polite payment reminders on WhatsApp?`);
    }

    /* ---- Overdue / outstanding questions ---- */
    if (/overdue|outstanding|unpaid|debt/.test(t)) {
      emit({ t: "status", agent: "AI Finance Agent", text: "Scanning invoice balances…" });
      const overdue = await overdueInvoices(businessId);
      const all = await outstandingInvoices(businessId);
      emit({
        t: "card",
        card: {
          kind: "stats",
          title: "Receivables",
          rows: [
            { label: "Total outstanding", value: `R ${Math.round(all.total).toLocaleString("en-ZA")}` },
            { label: "Overdue", value: `R ${Math.round(overdue.reduce((s, i) => s + i.balance, 0)).toLocaleString("en-ZA")}` },
            { label: "Open invoices", value: String(all.items.length) },
          ],
          items: all.items.slice(0, 6).map((i) => ({ id: i.id, title: `${i.invoiceNumber} — ${i.customerName ?? "Customer"}`, value: `R ${Math.round(i.balance).toLocaleString("en-ZA")}`, extra: i.dueDate < todayStr() ? "overdue" : `due ${i.dueDate}` })),
          links: [{ label: "Review invoices", href: "/dashboard/invoices" }],
        },
      });
      if (overdue.length) {
        makeAction("AI Finance Agent", "send_reminders", "sendPaymentReminders", "Invoices past due", { invoices: overdue.map((i) => ({ id: i.id, number: i.invoiceNumber, customerName: i.customerName ?? "customer", balance: i.balance, days: Math.round((Date.now() - new Date(i.dueDate).getTime()) / 86400000) })) }, "Send payment reminders", `Polite reminder for ${overdue.length} overdue invoice(s).`, "Send reminders");
      }
      return finish(
        overdue.length
          ? `You're carrying R ${Math.round(all.total).toLocaleString("en-ZA")} in open invoices, of which R ${Math.round(overdue.reduce((s, i) => s + i.balance, 0)).toLocaleString("en-ZA")} is past due (${overdue.length} invoice${overdue.length > 1 ? "s" : ""}).`
          : `You're carrying R ${Math.round(all.total).toLocaleString("en-ZA")} in open invoices — none are overdue. Well managed.`
      );
    }

    /* ---- Create quote ---- */
    if (/(create|generate|draft|make|put together).{0,30}quote/.test(t)) {
      emit({ t: "status", agent: "AI Sales Agent", text: "Looking up customer and configured prices…" });
      const customer = await findCustomerByMention(businessId, text);
      if (!customer) {
        const custs = await db.select().from(customers).where(eq(customers.businessId, businessId)).limit(5);
        emit({ t: "card", card: { kind: "list", title: "Which customer?", items: custs.map((c) => ({ id: c.id, title: c.name, sub: c.suburb ?? "" })) } });
        return finish("Which customer is this quote for? Pick one from the list, or tell me their name — and which service, e.g. \"quote for Sarah — geyser replacement\".");
      }
      const service = detectService(text, bizCtx.services);
      if (!service) {
        emit({ t: "card", card: { kind: "list", title: "Which service?", items: bizCtx.services.slice(0, 8).map((s: any) => ({ id: s.id, title: s.name, value: s.basePrice ? `R ${Math.round(num(s.basePrice)).toLocaleString("en-ZA")}` : "no price set" })) } });
        return finish(`Found ${customer.name}. Which service should I put on the quote? I can only use your configured prices — I won't invent numbers.`);
      }
      if (!service.basePrice || num(service.basePrice) === 0) {
        return finish(
          `I can create this quote, but I don't have a configured price for "${service.name}". Would you like to enter the price now? Set it in Settings → Services, or tell me the amount and I'll add it: "quote for ${customer.name} — ${service.name} at R5,500".`,
          [{ kind: "links", title: "Fix pricing", links: [{ label: "Configure service pricing", href: "/dashboard/settings?tab=services" }] }]
        );
      }
      const m = t.match(/at\s+r?\s*([0-9][0-9 ,]{2,})/);
      const unit = m ? Number(m[1].replace(/[ ,]/g, "")) : num(service.basePrice);
      const prefix = service.pricingType === "starting_from" ? " (from)" : "";
      emit({
        t: "card",
        card: {
          kind: "stats",
          title: `Quote preview — ${customer.name}`,
          rows: [
            { label: "Service", value: `${service.name}${prefix}` },
            { label: "Rate", value: `R ${Math.round(unit).toLocaleString("en-ZA")}` },
            { label: "VAT", value: `${bizCtx.business.vatRate}% (applied on send)` },
            { label: "Valid for", value: `${bizCtx.settings?.quoteValidDays ?? 14} days` },
          ],
        },
      });
      makeAction("AI Sales Agent", "create_quote", "createQuote", "Owner requested quote via AI", { customerId: customer.id, customerName: customer.name, notes: text, items: [{ type: "service", name: `${service.name}${prefix}`, description: service.description ?? null, qty: 1, unitPrice: unit }] }, `Create quote for ${customer.name}`, `${service.name} at R ${Math.round(unit).toLocaleString("en-ZA")} — created as a draft for your review.`, "Create quote");
      return finish(`I've prepared a quote for ${customer.name}: ${service.name} at R ${Math.round(unit).toLocaleString("en-ZA")}${prefix}. Confirm below and I'll save it as a draft for you to review and send.`);
    }

    /* ---- Book / schedule ---- */
    if (/\b(book|schedule|book her|book him|arrange)\b/.test(t)) {
      emit({ t: "status", agent: "AI Scheduling Agent", text: "Checking technician availability…" });
      const customer = await findCustomerByMention(businessId, text);
      if (!customer) {
        const custs = await db.select().from(customers).where(eq(customers.businessId, businessId)).limit(5);
        emit({ t: "card", card: { kind: "list", title: "Who should I book?", items: custs.map((c) => ({ id: c.id, title: c.name })) } });
        return finish("Who should I book? Tell me the customer, day and time — e.g. \"book Sarah for tomorrow at 10\".");
      }
      const service = detectService(text, bizCtx.services);
      const when = parseWhen(text);
      const date = when.date ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const slot = await findSlot(businessId, date, when.time, service?.durationMinutes ?? 60);
      if (!slot.ok) {
        return finish(`I couldn't find a free slot for ${customer.name} on ${date}. ${slot.reason} Try another day, or I can check tomorrow — just say so.`);
      }
      const svcName = service?.name ?? "Service visit";
      makeAction("AI Scheduling Agent", "create_job", "scheduleJob", "Owner requested booking via AI", { customerId: customer.id, customerName: customer.name, service: svcName, description: text, address: customer.address, suburb: customer.suburb, date, start: slot.time, durationMin: service?.durationMinutes ?? 60, teamMemberId: slot.member?.id, priority: /emergency|urgent/i.test(t) ? "emergency" : "normal" }, `Book ${customer.name}`, `${svcName} on ${date} at ${slot.time} with ${slot.member?.name}${slot.suggested ? " (next available slot)" : ""}.`, "Book it");
      return finish(`I can book ${customer.name} in for ${date} at ${slot.time} with ${slot.member?.name}${slot.suggested ? " — that's the next free slot" : ""}. Service: ${svcName}.`);
    }

    /* ---- Revenue ---- */
    if (/revenue|sales|money|made|earn/.test(t)) {
      emit({ t: "status", agent: "AI Business Analyst", text: "Calculating revenue…" });
      const now = new Date();
      let days = 30;
      let label = "last 30 days";
      if (/today/.test(t)) { days = 1; label = "today"; }
      else if (/this week|last week/.test(t)) { days = 7; label = "this week"; }
      else if (/this month/.test(t)) { days = 30; label = "this month"; }
      else if (/last month/.test(t)) { days = 30; label = "last month"; }
      const cur = await revenueBetween(businessId, new Date(now.getTime() - days * 86400000), now);
      const prev = await revenueBetween(businessId, new Date(now.getTime() - days * 2 * 86400000), new Date(now.getTime() - days * 86400000));
      const bySvc = await revenueByService(businessId, days);
      emit({
        t: "card",
        card: {
          kind: "stats",
          title: `Revenue — ${label}`,
          rows: [
            { label: "Collected", value: `R ${Math.round(cur).toLocaleString("en-ZA")}` },
            { label: "Previous period", value: `R ${Math.round(prev).toLocaleString("en-ZA")}` },
            { label: "Change", value: `${prev ? Math.round(((cur - prev) / prev) * 100) : 0}%` },
          ],
          items: bySvc.slice(0, 5).map((s) => ({ id: s.service, title: s.service, value: `R ${s.total.toLocaleString("en-ZA")}`, extra: `${s.share}%` })),
        },
      });
      return finish(`You collected R ${Math.round(cur).toLocaleString("en-ZA")} in the ${label}${prev ? `, ${Math.abs(Math.round(((cur - prev) / prev) * 100))}% ${cur >= prev ? "up" : "down"} vs the previous period` : ""}.`);
    }

    /* ---- Why revenue fell/rose ---- */
    if (/why.*(fall|drop|down|decrease|up|grow)|revenue (down|fell|up)/.test(t)) {
      emit({ t: "status", agent: "AI Business Analyst", text: "Comparing this month with last…" });
      const now = new Date();
      const cur = await revenueBetween(businessId, new Date(now.getTime() - 30 * 86400000), now);
      const prev = await revenueBetween(businessId, new Date(now.getTime() - 60 * 86400000), new Date(now.getTime() - 30 * 86400000));
      const bySvc = await revenueByService(businessId, 30);
      const acceptance = await quoteAcceptance(businessId);
      const dir = cur >= prev ? "up" : "down";
      let body = `Revenue is ${dir} ${prev ? Math.abs(Math.round(((cur - prev) / prev) * 100)) : 0}% month on month (R ${Math.round(cur).toLocaleString("en-ZA")} vs R ${Math.round(prev).toLocaleString("en-ZA")}). `;
      if (bySvc[0]) body += `Your top service this month is ${bySvc[0].service} at R ${bySvc[0].total.toLocaleString("en-ZA")} (${bySvc[0].share}% of collected revenue). `;
      if (acceptance.total) body += `Quote acceptance is at ${acceptance.rate}% — ${acceptance.rate < 60 ? "below your historical norm, so a pricing or response-time review would help." : "healthy."}`;
      return finish(body);
    }

    /* ---- Who to follow up with ---- */
    if (/who should i follow|follow ?up (with|list)|which leads need/.test(t)) {
      emit({ t: "status", agent: "AI Sales Agent", text: "Ranking leads by intent…" });
      const all = await db.select().from(leads).where(and(eq(leads.businessId, businessId), sql`${leads.status} in ('new','contacted','qualified','quote_sent','negotiating')`)).orderBy(desc(leads.score));
      const cutoff = new Date(Date.now() + 86400000);
      const due = all.filter((l) => (l.nextFollowUpAt && new Date(l.nextFollowUpAt) < cutoff) || new Date(l.createdAt) < new Date(Date.now() - 86400000));
      const top = (due.length ? due : all).slice(0, 5);
      if (!top.length) return finish("Nothing needs a follow-up right now — your pipeline is up to date.");
      emit({ t: "card", card: { kind: "list", title: "Follow up today", items: top.map((l) => ({ id: l.id, title: l.name, sub: `${l.service ?? "General"} · ${l.suburb ?? "location TBC"}`, extra: `score ${l.score}` })) } });
      makeAction("AI Sales Agent", "follow_up_leads", "followUpLeads", "Leads due for follow-up", { leads: top.map((l) => ({ id: l.id, name: l.name, service: l.service ?? "your service", phone: l.phone })) }, "Start follow-ups", `Send a friendly WhatsApp follow-up to ${top.length} lead${top.length > 1 ? "s" : ""}: ${top.map((l) => l.name).join(", ")}.`, "Start follow-ups");
      return finish(`${top.length} lead${top.length === 1 ? " is" : "s are"} due for a follow-up, ranked by intent score. ${top[0]?.name} is your hottest at ${top[0]?.score}.`);
    }

    /* ---- Leads ---- */
    if (/lead|enquir/.test(t)) {
      emit({ t: "status", agent: "AI Sales Agent", text: "Reviewing pipeline…" });
      const all = await db.select().from(leads).where(eq(leads.businessId, businessId));
      const byStatus = new Map<string, number>();
      for (const l of all) byStatus.set(l.status, (byStatus.get(l.status) ?? 0) + 1);
      const top = [...all].sort((a, b) => b.score - a.score).slice(0, 4);
      emit({
        t: "card",
        card: {
          kind: "stats",
          title: "Lead pipeline",
          rows: Array.from(byStatus.entries()).map(([s, n]) => ({ label: s.replace("_", " "), value: String(n) })),
          items: top.map((l) => ({ id: l.id, title: l.name, sub: l.service ?? "General", extra: `score ${l.score}` })),
          links: [{ label: "Open pipeline", href: "/dashboard/leads" }],
        },
      });
      return finish(`${all.length} leads in the pipeline. ${top[0] ? `Highest intent: ${top[0].name} (score ${top[0].score}).` : ""}`);
    }

    /* ---- Jobs ---- */
    if (/\bjobs?\b/.test(t)) {
      const when = parseWhen(text);
      const date = when.date ?? todayStr();
      const area = text.match(/in ([a-z ]{4,25})(?: today| tomorrow|$|\s)/i)?.[1];
      emit({ t: "status", agent: "AI Scheduling Agent", text: `Loading jobs for ${date}…` });
      let dayJobs = await db.select().from(jobs).where(and(eq(jobs.businessId, businessId), eq(jobs.date, date)));
      if (area) dayJobs = dayJobs.filter((j) => lower(`${j.suburb ?? ""} ${j.city ?? ""} ${j.address ?? ""}`).includes(lower(area)));
      dayJobs = dayJobs.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      if (!dayJobs.length) return finish(`No jobs found for ${date}${area ? ` in ${area}` : ""}.`);
      const custs = new Map((await db.select().from(customers).where(eq(customers.businessId, businessId))).map((c) => [c.id, c]));
      emit({
        t: "card",
        card: {
          kind: "list",
          title: `${dayJobs.length} jobs — ${new Date(date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short" })}`,
          items: dayJobs.map((j) => ({ id: j.id, title: `${j.startsAt} ${j.jobNumber} · ${custs.get(j.customerId ?? "")?.name ?? "—"}`, sub: `${j.service}${j.suburb ? " · " + j.suburb : ""}`, extra: j.teamMemberName ?? "unassigned" })),
        },
      });
      return finish(`${dayJobs.length} job${dayJobs.length > 1 ? "s" : ""} on ${new Date(date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "long" })}${area ? ` in ${area}` : ""}. First one is at ${dayJobs[0].startsAt}.`);
    }

    /* ---- Technicians ---- */
    if (/technician|who completed|staff|team performance/.test(t)) {
      emit({ t: "status", agent: "AI Business Analyst", text: "Tallying completed jobs per technician…" });
      const techs = await techPerformance(businessId, 30);
      if (!techs.length) return finish("No completed jobs recorded in the last 30 days, so I can't rank technicians yet.");
      emit({ t: "card", card: { kind: "list", title: "Jobs completed (30 days)", items: techs.map((t2) => ({ id: t2.member, title: t2.member, value: `${t2.jobs} jobs` })) } });
      return finish(`${techs[0].member} completed the most jobs — ${techs[0].jobs} in the last 30 days.`);
    }

    /* ---- Lapsed customers ---- */
    if (/haven.?t (booked|ordered|called)|lapsed|inactive customers|no (jobs?|bookings?) (in|for) (90|\d+)/.test(t)) {
      emit({ t: "status", agent: "AI Customer Success Agent", text: "Finding customers who went quiet…" });
      const custs = await db.select().from(customers).where(eq(customers.businessId, businessId));
      const lapsed: any[] = [];
      for (const c of custs) {
        const done = await db.select().from(jobs).where(and(eq(jobs.customerId, c.id), eq(jobs.status, "completed")));
        if (!done.length) continue;
        const last = new Date(Math.max(...done.map((j) => new Date(j.date).getTime())));
        if (Date.now() - last.getTime() > 90 * 86400000) lapsed.push({ ...c, lastBooking: last.toISOString() });
      }
      if (!lapsed.length) return finish("No customers have gone quiet — everyone with a job history has booked within the last 90 days.");
      emit({ t: "card", card: { kind: "list", title: `${lapsed.length} customers haven't booked in 90+ days`, items: lapsed.slice(0, 6).map((c) => ({ id: c.id, title: c.name, sub: c.suburb ?? "", extra: `last ${new Date(c.lastBooking).toLocaleDateString("en-ZA", { month: "short", year: "numeric" })}` })) } });
      makeAction("AI Customer Success Agent", "follow_up_customers", "followUpCustomers", "Lapsed customer win-back", { customers: lapsed.slice(0, 6) }, "Send win-back messages", `A friendly "we miss you" check-in to ${lapsed.length} customer${lapsed.length > 1 ? "s" : ""} who haven't booked in 90+ days.`, "Send check-ins");
      return finish(`${lapsed.length} customer${lapsed.length > 1 ? "s" : ""} hasn't booked again in 90+ days. A short check-in usually gets these back — want me to send them?`);
    }

    /* ---- Service profitability ---- */
    if (/profitab|which service|best performing|top service/.test(t)) {
      emit({ t: "status", agent: "AI Business Analyst", text: "Crunching service-level revenue…" });
      const bySvc = await revenueByService(businessId, 30);
      if (!bySvc.length) return finish("No paid invoices in the last 30 days, so I can't rank services yet.");
      emit({ t: "card", card: { kind: "list", title: "Revenue by service (30 days)", items: bySvc.map((s) => ({ id: s.service, title: s.service, value: `R ${s.total.toLocaleString("en-ZA")}`, extra: `${s.share}%` })) } });
      return finish(`${bySvc[0].service} is your top earner: R ${bySvc[0].total.toLocaleString("en-ZA")} (${bySvc[0].share}% of collected revenue) in the last 30 days.`);
    }

    /* ---- Quotes status / acceptance ---- */
    if (/acceptance|quotes? (waiting|pending|response|viewed)|quote rate/.test(t)) {
      const [[waitingRow], acc] = await Promise.all([
        db.select({ n: sql<number>`count(*)::int` }).from(quotes).where(and(eq(quotes.businessId, businessId), sql`${quotes.status} in ('sent','viewed')`)),
        quoteAcceptance(businessId),
      ]);
      const wn = waitingRow?.n ?? 0;
      return finish(
        `${wn} quote${wn === 1 ? "" : "s"} waiting for customer response. Your acceptance rate is ${acc.rate}% (${acc.accepted} of ${acc.total} responded quotes). ${wn > 2 ? "A 48-hour chase on sent quotes typically lifts this." : ""}`
      );
    }

    /* ---- Document lookup by number ---- */
    const numMatch = t.match(/(inv|q|job)[- #]?(\d{3,5})/);
    if (numMatch) {
      const n = numMatch[2];
      const kind = numMatch[1];
      let doc: any = null;
      if (kind === "inv") doc = (await db.select().from(invoices).where(and(eq(invoices.businessId, businessId), sql`${invoices.invoiceNumber} like ${"%" + n + "%"}`)))[0];
      if (kind === "q") doc = (await db.select().from(quotes).where(and(eq(quotes.businessId, businessId), sql`${quotes.quoteNumber} like ${"%" + n + "%"}`)))[0];
      if (kind === "job") doc = (await db.select().from(jobs).where(and(eq(jobs.businessId, businessId), sql`${jobs.jobNumber} like ${"%" + n + "%"}`)))[0];
      if (!doc) return finish(`I couldn't find a document numbered ${n} in your business. Double-check the number, or use the search bar.`);
      const cust = doc.customerId ? (await db.select().from(customers).where(eq(customers.id, doc.customerId)))[0] : null;
      return finish(
        `Found ${doc.invoiceNumber ?? doc.quoteNumber ?? doc.jobNumber}: ${cust?.name ?? "—"}, ${doc.status}, ${doc.total ? `R ${Math.round(num(doc.total) - num(doc.paidAmount || 0)).toLocaleString("en-ZA")} ${doc.paidAmount !== undefined ? "balance" : "total"}` : doc.startsAt ? `at ${doc.startsAt} on ${doc.date}` : ""}.`,
        [{ kind: "stats", title: doc.invoiceNumber ?? doc.quoteNumber ?? doc.jobNumber ?? "Document", rows: [
          { label: "Customer", value: cust?.name ?? "—" },
          { label: "Status", value: doc.status },
          doc.total !== undefined ? { label: "Total", value: `R ${Math.round(num(doc.total)).toLocaleString("en-ZA")}` } : null,
          doc.paidAmount !== undefined ? { label: "Paid", value: `R ${Math.round(num(doc.paidAmount)).toLocaleString("en-ZA")}` } : null,
        ].filter(Boolean) as any}]
      );
    }

    /* ---- Business overview ---- */
    if (/how (is|are) my business|summary|overview|report|health check|how'?s (my|the) business/.test(t)) {
      emit({ t: "status", agent: "AI CEO Agent", text: "Pulling together the full picture…" });
      const k = await computeKpis(businessId);
      const insights = await computeInsights(businessId).then((x) => x.slice(0, 3));
      emit({
        t: "card",
        card: {
          kind: "stats",
          title: "Business snapshot",
          rows: [
            { label: "Revenue (30d)", value: `R ${k.revenue30.toLocaleString("en-ZA")}` },
            { label: "Outstanding", value: `R ${k.outstanding.toLocaleString("en-ZA")}` },
            { label: "New leads (30d)", value: String(k.newLeads30) },
            { label: "Conversion", value: `${k.conversion}%` },
            { label: "Jobs today", value: String(k.jobsToday) },
            { label: "Quotes waiting", value: String(k.quotesWaiting) },
          ],
          links: [{ label: "Open dashboard", href: "/dashboard" }],
        },
      });
      const top = insights[0];
      return finish(`Here's where things stand: R ${k.revenue30.toLocaleString("en-ZA")} collected in 30 days (${k.revenueDeltaPct >= 0 ? "+" : ""}${k.revenueDeltaPct}% vs last month), ${k.newLeads30} new leads, ${k.jobsToday} jobs today. ${top ? `Key insight: ${top.title.toLowerCase()}.` : ""}`);
    }

    /* ---- Fallback — honest, no fabrication ---- */
    emit({ t: "status", agent: "AI CEO Agent", text: "Matching your request to my tools…" });
    return finish(
      "I don't have a tool for that exact question yet — and I won't guess at your numbers. I can: ask about revenue or overdue invoices, list leads or jobs, create a quote, book a job, send payment reminders, follow up with customers, or give you a full business overview. Try: \"How is my business doing?\"",
      [{ kind: "list", title: "Try one of these", items: [
        { id: "1", title: "How much did we make this month?" },
        { id: "2", title: "Which invoices are overdue?" },
        { id: "3", title: "Who should I follow up with today?" },
        { id: "4", title: "Book Sarah for tomorrow at 10" },
      ] }]
    );
  } catch (e: any) {
    emit({ t: "error", text: "I hit an error while working that. Please try again in a moment." });
    await push("Sorry — I hit an error while processing that. Please try again.");
    emit({ t: "done" });
  }
}

/* ================================================================== */
/* AI Receptionist — used by the inbox when a customer message lands   */
/* ================================================================== */

export async function receptionistReply(businessId: string, customerText: string, customerId: string | null, existingLeadId?: string | null) {
  const ctx = await getBusinessContext(businessId);
  if (!ctx) return null;
  const tone = ctx.settings?.aiTone ?? "friendly";
  const { escalate, reason } = detectEscalation(customerText);
  const service = detectService(customerText, ctx.services);
  const t = lower(customerText);
  const hasSuburb = /\b(sea point|tokai|bellville|paarl|milnerton|table view|kuils river|cape town|sandton|ptoria|jozi|durban|bloemfontein|centurion|midrand|fourways|randburg|constantia|goodwood|bergville|parow|monkton|glen|woodbridge|diep river|muizenberg|kalk bay|fish hoek|v&A)\b/i.test(customerText);
  const hasPhone = /\+?2[0-9]{9,10}/.test(customerText) || /\b0[0-9]{9}\b/.test(customerText);
  const score = scoreLeadSignal(customerText, hasSuburb, hasPhone);

  const first = customerText.match(/my name is (\w+)/i)?.[1];

  if (escalate) {
    return {
      escalate: true,
      reason,
      reply: `I'm really sorry to hear that. I've flagged this for the owner of this business and they'll respond personally, as soon as possible. In the meantime, if it's urgent, please call us directly.`,
      score: { ...score, score: Math.min(100, score.score + 15) },
      service,
      hasSuburb,
    };
  }

  const bits: string[] = [];
  const asks: string[] = [];
  bits.push(tone === "formal" || tone === "professional" ? `Thank you for contacting us. I can help with that.` : `I'm happy to help with that 👋`);
  if (service) bits.push(tone === "casual" ? `No worries, ${service.name.toLowerCase()} is one we do all the time.` : `For ${service.name.toLowerCase()}, here's how we can help.`);
  if (!hasSuburb) asks.push("your suburb");
  if (service && /geyser/i.test(service.name)) asks.push("a quick photo of the geyser");
  if (!/today|tomorrow|urgent|emergency|when|book/i.test(t)) asks.push("when would suit you — we have slots this week");
  if (asks.length) {
    bits.push(`To get you sorted, could you send me: ${asks.map((a, i) => `${i + 1}. ${a}`).join(" ")}?`);
  }
  if (/when (can|is)|earliest|available|slot|book/i.test(t)) {
    const date = todayStr();
    const slot = await findSlot(businessId, date, "14:00", service?.durationMinutes ?? 60);
    if (slot.ok) bits.push(`Good news — ${slot.member.name} is free today at ${slot.time}. Shall I book that in?`);
  }
  if (/how much|price|cost|quote/i.test(t) && service) {
    if (service.basePrice && num(service.basePrice) > 0) {
      const p = `R ${Math.round(num(service.basePrice)).toLocaleString("en-ZA")}`;
      bits.push(
        service.pricingType === "starting_from"
          ? `For ${service.name.toLowerCase()} we start from ${p}, and I can send a proper quote once we assess it.`
          : service.pricingType === "hourly"
            ? `For ${service.name.toLowerCase()} we charge ${p} per hour, and I'll send a quote before any work starts.`
            : `For ${service.name.toLowerCase()} our price is ${p}${ctx.settings?.emergencySurchargePct ? " (a 30% emergency surcharge applies for out-of-hours calls)" : ""}.`
      );
    } else if (service.pricingType === "custom") {
      bits.push(`For ${service.name.toLowerCase()} every job is quoted individually — I'll get you a proper quote once we assess it.`);
    } else {
      bits.push(`For ${service.name.toLowerCase()} I'll need to assess first to give you an exact price — no fixed figures until then.`);
    }
  }
  if (!bits.length) bits.push("Could you tell me a bit more about the job?");
  bits.push(`I'll keep everything moving on my side — no need to chase.`);

  return { escalate: false, reason: null, reply: bits.join("\n\n"), score, service, hasSuburb };
}
