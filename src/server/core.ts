import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { eq, and, desc, sql, gte, lt } from "drizzle-orm";
import {
  users,
  sessions,
  businesses,
  aiAgents,
  businessMembers,
  subscriptions,
  businessSettings,
  workingHours,
  notifications,
  auditLogs,
  aiUsage,
  customers,
  leads,
  jobs,
  quotes,
  invoices,
  payments,
  teamMembers,
  services,
} from "@/db/schema";

/* ------------------------------------------------------------------ */
/* Passwords (scrypt)                                                  */
/* ------------------------------------------------------------------ */

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const test = scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return test.length === expected.length && timingSafeEqual(test, expected);
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

const COOKIE = "bp_session";

export async function createSession(userId: string, userAgent?: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 86400000);
  await db.insert(sessions).values({ userId, token, userAgent, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
  const jar = await cookies();
  jar.delete(COOKIE);
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  businessId?: string;
  role?: string;
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      token: sessions.token,
      expiresAt: sessions.expiresAt,
      userId: sessions.userId,
      email: users.email,
      name: users.name,
      isPlatformAdmin: users.isPlatformAdmin,
      businessId: businessMembers.businessId,
      role: businessMembers.role,
      memberStatus: businessMembers.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(businessMembers, eq(businessMembers.userId, sessions.userId))
    .where(and(eq(sessions.token, token), eq(sessions.expiresAt, sessions.expiresAt)));
  // filter in JS for clarity of expiry + active membership
  const row = rows.find((r) => new Date(r.expiresAt).getTime() > Date.now());
  if (!row) return null;
  const member = rows.find((r) => r.businessId && r.memberStatus === "active");
  return {
    id: row.userId,
    email: row.email,
    name: row.name,
    isPlatformAdmin: row.isPlatformAdmin,
    businessId: member?.businessId ?? undefined,
    role: member?.role ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/* RBAC                                                                */
/* ------------------------------------------------------------------ */

export type Role = "owner" | "admin" | "manager" | "technician" | "accountant";

const CAPS: Record<Role, string[] | "all"> = {
  owner: "all",
  admin: "all",
  manager: [
    "dashboard", "inbox.read", "inbox.write", "leads.read", "leads.write", "customers.read", "customers.write",
    "jobs.read", "jobs.write", "quotes.read", "quotes.write", "invoices.read", "invoices.write",
    "payments.read", "payments.write", "team.read", "team.write", "analytics.read",
    "knowledge.read", "knowledge.write", "ai",
  ],
  technician: ["dashboard", "inbox.read", "inbox.write", "jobs.read", "jobs.write", "customers.read"],
  accountant: ["dashboard", "quotes.read", "invoices.read", "invoices.write", "payments.read", "payments.write", "customers.read", "analytics.read", "knowledge.read"],
};

export function can(role: string | undefined, cap: string): boolean {
  if (!role) return false;
  const set = CAPS[role as Role];
  if (!set) return false;
  if (set === "all") return true;
  return set.includes(cap);
}

export interface Ctx {
  user: AuthUser;
  businessId: string;
  role: Role;
}

/** Tenant boundary guard — every query MUST pass through here. */
export function tenantId(ctx: Ctx): string {
  return ctx.businessId;
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function err(message: string, status = 400, code?: string, data?: unknown): Response {
  return Response.json({ error: message, code, data }, { status });
}

export async function readBody(req: Request): Promise<any> {
  try {
    const t = req.headers.get("content-type") ?? "";
    if (t.includes("application/json")) return await req.json();
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function num(v: unknown): number {
  const n = Number(v ?? 0);
  return isFinite(n) ? n : 0;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/* Sequential human-friendly numbers per tenant: INV-1001, Q-1001, JOB-1001 */
export async function nextDocNumber(table: any, col: any, businessId: string, prefix: string): Promise<string> {
  const rows: any[] = await db
    .select({ v: sql<string>`coalesce(max(${sql.raw(`split_part(${col.name}::text, '-' , 2)::int`)})::text` })
    .from(table)
    .where(eq(table.businessId, businessId));
  const last = Number(rows[0]?.v || "0") || 0;
  return `${prefix}${last + 1}`;
}

/* ------------------------------------------------------------------ */
/* Notifications + audit + AI usage                                    */
/* ------------------------------------------------------------------ */

export async function notify(businessId: string, type: string, title: string, body?: string, link?: string, userId?: string) {
  await db.insert(notifications).values({ businessId, userId: userId ?? null, type, title, body, link });
  // Channel fan-out goes through the messaging providers below.
  await sendViaProviders(businessId, { type, title, body, link });
}

export async function audit(businessId: string | null, actor: string, action: string, entity?: string, entityId?: string, meta?: Record<string, unknown>) {
  await db.insert(auditLogs).values({
    businessId,
    actor,
    action,
    entity: entity ?? null,
    entityId: entityId ?? null,
    meta: meta ? JSON.stringify(meta) : null,
  });
}

export async function logAiUsage(businessId: string, agent: string, tokensIn = 0, tokensOut = 0) {
  const today = todayStr();
  const existing = await db.select().from(aiUsage).where(and(eq(aiUsage.businessId, businessId), eq(aiUsage.date, today), eq(aiUsage.agent, agent)));
  if (existing.length > 0) {
    await db.update(aiUsage).set({
      requests: sql`${aiUsage.requests} + 1`,
      tokensIn: sql`${aiUsage.tokensIn} + ${tokensIn}`,
      tokensOut: sql`${aiUsage.tokensOut} + ${tokensOut}`,
    }).where(eq(aiUsage.id, existing[0].id));
  } else {
    await db.insert(aiUsage).values({ businessId, date: today, agent, requests: 1, tokensIn, tokensOut, costCents: 0 });
  }
}

/* ------------------------------------------------------------------ */
/* Integration providers — clean abstractions for later activation.    */
/* Mock providers are clearly labelled; swap in real ones via env vars */
/* without touching business logic or the UI.                          */
/* ------------------------------------------------------------------ */

export interface PaymentProvider {
  name: string;
  available: boolean;
  charge(params: { amount: number; reference: string; email?: string }): Promise<{ ok: boolean; reference: string; note?: string }>;
}

const yocoConfigured = Boolean(process.env.YOCO_MERCHANT_KEY && process.env.YOCO_SECRET);
const whatsappConfigured = Boolean(process.env.WHATSAPP_API_KEY && process.env.WHATSAPP_PHONE_NUMBER_ID);
const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

export const paymentProviders: Record<string, PaymentProvider> = {
  yoco: {
    name: "Yoco",
    available: yocoConfigured,
    async charge({ amount, reference }) {
      if (!yocoConfigured) {
        return { ok: false, reference, note: "Yoco is not configured yet. Record the payment manually (EFT) for now." };
      }
      // Real Yoco Charge API call would go here using env credentials.
      return { ok: false, reference, note: "Yoco live charging not enabled in this environment." };
    },
  },
  eft: {
    name: "EFT (manual)",
    available: true,
    async charge({ reference }) {
      return { ok: true, reference, note: "Recorded as manual EFT — reconcile when bank statement arrives." };
    },
  },
  cash: { name: "Cash", available: true, async charge({ reference }) { return { ok: true, reference }; } },
  card: {
    name: "Card (Yoco)",
    available: yocoConfigured,
    async charge({ reference }) {
      return yocoConfigured
        ? { ok: false, reference, note: "Yoco card charging not enabled in this environment." }
        : { ok: false, reference, note: "Yoco is not configured yet." };
    },
  },
};

export interface MessageChannel {
  name: string;
  available: boolean;
  send(params: { to?: string; subject?: string; body: string }): Promise<{ ok: boolean; provider: string; note?: string }>;
}

export const messageChannels: Record<string, MessageChannel> = {
  whatsapp: {
    name: "WhatsApp",
    available: whatsappConfigured,
    async send({ to, body }) {
      if (!whatsappConfigured) {
        return { ok: true, provider: "mock", note: `WhatsApp mock → ${to ?? "customer"}: ${body.slice(0, 80)}` };
      }
      // Real Meta WhatsApp Cloud API call would go here.
      return { ok: true, provider: "mock", note: "WhatsApp provider stub" };
    },
  },
  email: {
    name: "Email",
    available: smtpConfigured,
    async send({ to, subject, body }) {
      if (!smtpConfigured) {
        return { ok: true, provider: "mock", note: `Email mock → ${to ?? "owner"}: ${subject ?? body.slice(0, 80)}` };
      }
      return { ok: true, provider: "smtp", note: "SMTP configured (delivery stub)" };
    },
  },
};

export async function sendViaProviders(businessId: string, n: { type: string; title: string; body?: string; link?: string }) {
  const biz = await db.select().from(businesses).where(eq(businesses.id, businessId));
  const b = biz[0];
  if (!b) return;
  if (b.whatsapp) {
    await messageChannels.whatsapp.send({ to: b.whatsapp, subject: n.title, body: `${n.title}${n.body ? " — " + n.body : ""}` });
  }
  if (b.email) {
    await messageChannels.email.send({ to: b.email, subject: `[BizPilot] ${n.title}`, body: n.body ?? n.title });
  }
}

/* ------------------------------------------------------------------ */
/* Rate limiting (in-memory token bucket per IP+route — architecture;  */
/* swap for Redis in production)                                       */
/* ------------------------------------------------------------------ */

const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit = 120, windowMs = 60000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n += 1;
  return b.n <= limit;
}

/* ------------------------------------------------------------------ */
/* Business helpers                                                    */
/* ------------------------------------------------------------------ */

export async function getBusinessBundle(businessId: string) {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!biz) return null;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId));
  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.businessId, businessId));
  const hours = await db.select().from(workingHours).where(eq(workingHours.businessId, businessId)).orderBy(workingHours.day);
  const [sc] = await db.select({ n: sql<number>`count(*)::int` }).from(customers).where(eq(customers.businessId, businessId));
  const [lc] = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.businessId, businessId));
  const [jc] = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.businessId, businessId));
  return {
    business: biz,
    subscription: sub ?? null,
    settings: settings ?? null,
    workingHours: hours,
    counts: { customers: sc.n, leads: lc.n, jobs: jc.n },
  };
}

export async function getBusinessContext(businessId: string) {
  const bundle = await getBusinessBundle(businessId);
  if (!bundle) return null;
  const [servicesList, team] = await Promise.all([
    db.select().from(services).where(and(eq(services.businessId, businessId), eq(services.active, true))),
    db.select().from(teamMembers).where(and(eq(teamMembers.businessId, businessId), eq(teamMembers.active, true))),
  ]);
  return { ...bundle, services: servicesList, team };
}

/** Payments received between two dates (completed only). */
export async function revenueBetween(businessId: string, from: Date, to: Date): Promise<number> {
  const rows: any[] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.businessId, businessId), eq(payments.status, "completed"), gte(payments.createdAt, from), lt(payments.createdAt, to)));
  return num(rows[0]?.total);
}

/** Sum of unpaid (sent/viewed/partial + overdue) invoice balances. */
export async function outstandingInvoices(businessId: string) {
  const rows = await db
    .select({ inv: invoices, customerName: customers.name })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      and(
        eq(invoices.businessId, businessId),
        sql`${invoices.status} in ('sent','viewed','partial','overdue')`
      )
    )
    .orderBy(desc(invoices.dueDate));
  const items = rows.map((r) => ({ ...r.inv, customerName: r.customerName ?? null, balance: num(r.inv.total) - num(r.inv.paidAmount) }));
  const total = items.reduce((s, r) => s + r.balance, 0);
  return { items, total };
}

/** Overdue only (due date in the past, not paid/cancelled). */
export async function overdueInvoices(businessId: string) {
  const all = await outstandingInvoices(businessId);
  const today = todayStr();
  return all.items.filter((i) => i.dueDate < today && i.balance > 0);
}

export async function markOverdue(businessId: string) {
  // Idempotent status flip for invoices past due date.
  await db
    .update(invoices)
    .set({ status: "overdue" })
    .where(
      and(
        eq(invoices.businessId, businessId),
        sql`${invoices.status} in ('sent','viewed','partial')`,
        lt(invoices.dueDate, todayStr())
      )
    );
}

export async function createBusinessWithDefaults(businessId: string) {
  await db.insert(businessSettings).values({
    businessId,
    reminderDays: "1,3,7,14",
    businessRules: [
      "Never offer discounts above 10%.",
      "Emergency jobs carry a 30% surcharge.",
      "Never schedule jobs outside business hours.",
      "Always ask for a photo before quoting a geyser repair.",
    ],
  });
  const days = [
    ["08:00", "17:00"], ["07:30", "17:00"], ["07:30", "17:00"], ["07:30", "17:00"],
    ["07:30", "17:00"], ["08:00", "16:00"], ["08:00", "13:00"],
  ];
  await db.insert(workingHours).values(
    days.map(([o, c], i) => ({ businessId, day: i, opensAt: o, closesAt: c, isClosed: false }))
  );
  const agents = [
    ["receptionist", "AI Receptionist", "Answers enquiries, qualifies leads, books appointments"],
    ["sales", "AI Sales Agent", "Follows up leads, drafts quotes, recovers abandoned enquiries"],
    ["scheduling", "AI Scheduling Agent", "Checks availability, assigns technicians, prevents double bookings"],
    ["finance", "AI Finance Agent", "Monitors invoices, drafts payment reminders, summarises cash flow"],
    ["success", "AI Customer Success Agent", "Post-job follow-ups, review requests, repeat bookings"],
    ["analyst", "AI Business Analyst", "Revenue, conversion, service and technician analytics"],
    ["ceo", "AI CEO Agent", "Combines all agents into strategic recommendations"],
  ] as const;
  await db
    .insert(aiAgents)
    .values(agents.map(([key, name, role]) => ({ businessId, key, name, role, active: true })));
}
