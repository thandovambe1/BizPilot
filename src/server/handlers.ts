import "server-only";
import { db } from "@/db";
import { eq, and, desc, asc, sql, gte, lt, ilike, or } from "drizzle-orm";
import {
  users,
  sessions,
  businesses,
  businessMembers,
  subscriptions,
  subscriptionEvents,
  businessSettings,
  workingHours,
  customers,
  leads,
  leadActivities,
  conversations,
  messages,
  services,
  teamMembers,
  appointments,
  jobs,
  jobPhotos,
  quotes,
  quoteItems,
  invoices,
  invoiceItems,
  payments,
  expenses,
  reviews,
  notifications,
  aiAgents,
  aiConversations,
  aiMessages,
  aiActions,
  aiUsage,
  knowledgeDocuments,
  knowledgeChunks,
  integrations,
  auditLogs,
} from "@/db/schema";
import {
  Ctx,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getSessionUser,
  can,
  json,
  err,
  num,
  todayStr,
  nextDocNumber,
  notify,
  audit,
  getBusinessBundle,
  createBusinessWithDefaults,
  markOverdue,
  outstandingInvoices,
  overdueInvoices,
  rateLimit,
  paymentProviders,
} from "./core";
import {
  computeBriefing,
  computeKpis,
  computeInsights,
  revenueSeries,
  revenueByService,
  leadsBySource,
  techPerformance,
  quoteAcceptance,
  handleChat,
  executeAction,
  receptionistReply,
  findSlot,
  detectService,
  scoreLeadSignal,
} from "./ai";
import { ensureDemo } from "./seed";

export type Handler = (req: Request, ctx: Ctx | null, q: URLSearchParams, body: any, seg: string[]) => Promise<Response>;

const today = () => todayStr();

/* ================================================================== */
/* AUTH                                                                */
/* ================================================================== */

const authPublic: Handler = async (_req, _ctx, _q, body) => {
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return err("Email and password are required.", 400, "invalid_input");
  }
  const email = body.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return err("Incorrect email or password.", 401, "bad_credentials");
  }
  await createSession(user.id, _req.headers.get("user-agent") ?? undefined);
  return json({ ok: true, userId: user.id, email: user.email, name: user.name });
};

const register: Handler = async (_req, _ctx, _q, body) => {
  if (!body || typeof body.name !== "string" || body.name.trim().length < 2) return err("Please enter your name.", 400, "invalid_input");
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return err("Please enter a valid email address.", 400, "invalid_input");
  if (typeof body.password !== "string" || body.password.length < 8) return err("Password must be at least 8 characters.", 400, "invalid_input");
  const email = body.email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length) return err("An account with this email already exists. Try signing in.", 409, "email_taken");
  const [user] = await db.insert(users).values({ name: body.name.trim(), email, passwordHash: hashPassword(body.password), phone: body.phone ?? null }).returning();
  await createSession(user.id, _req.headers.get("user-agent") ?? undefined);
  await audit(null, "System", "User registered", "user", user.id);
  return json({ ok: true, userId: user.id, email: user.email });
};

const logout: Handler = async (_req, ctx) => {
  const jar = await (await import("next/headers")).cookies();
  const token = jar.get("bp_session")?.value;
  if (token) await destroySession(token);
  return json({ ok: true });
};

const me: Handler = async (_req, ctx) => {
  if (!ctx) return json({ user: null });
  const bundle = ctx.businessId ? await getBusinessBundle(ctx.businessId) : null;
  return json({
    user: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.role,
      businessId: ctx.user.businessId ?? null,
      isPlatformAdmin: ctx.user.isPlatformAdmin,
    },
    business: bundle?.business ?? null,
    subscription: bundle?.subscription ?? null,
  });
};

/* ================================================================== */
/* BUSINESS + ONBOARDING                                               */
/* ================================================================== */

const getBusiness: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  const bundle = await getBusinessBundle(ctx.businessId);
  if (!bundle) return err("Business not found.", 404);
  const agents = await db.select().from(aiAgents).where(eq(aiAgents.businessId, ctx.businessId));
  const integrationsRows = await db.select().from(integrations).where(eq(integrations.businessId, ctx.businessId));
  const trialDays = bundle.subscription?.trialEndsAt ? Math.max(0, Math.ceil((new Date(bundle.subscription.trialEndsAt).getTime() - Date.now()) / 86400000)) : 0;
  return json({ ...bundle, agents, integrations: integrationsRows, trialDays });
};

const putBusiness: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "settings.write")) return err("You don't have permission to edit business settings.", 403, "forbidden");
  const allowed: (keyof typeof businesses)[number][] = ["name", "type", "ownerName", "phone", "email", "whatsapp", "province", "city", "serviceArea", "description", "vatRate", "vatRegistered"];
  const patch: any = {};
  for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
  if (Object.keys(patch).length) await db.update(businesses).set(patch).where(eq(businesses.id, ctx.businessId));
  await audit(ctx.businessId, ctx.user.name, "Updated business profile", "business", ctx.businessId);
  return json({ ok: true });
};

const putSettings: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "settings.write")) return err("You don't have permission to change AI settings.", 403, "forbidden");
  const allowed = ["aiTone", "aiAutonomy", "businessRules", "autoReminders", "reminderDays", "maxDiscountPct", "emergencySurchargePct", "requestReviews", "invoicePrefix", "quotePrefix", "quoteValidDays", "invoiceDueDays", "whatsappNumber", "emailSignature"];
  const patch: any = {};
  for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
  if (Object.keys(patch).length) {
    await db.update(businessSettings).set(patch).where(eq(businessSettings.businessId, ctx.businessId));
    if (body.whatsappNumber) await db.update(businesses).set({ whatsapp: body.whatsappNumber }).where(eq(businesses.id, ctx.businessId));
  }
  await audit(ctx.businessId, ctx.user.name, "Updated AI settings", "settings", ctx.businessId);
  return json({ ok: true });
};

const putHours: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "settings.write")) return err("You don't have permission to change working hours.", 403, "forbidden");
  if (!Array.isArray(body.days) || body.days.length !== 7) return err("Working hours must cover all 7 days.", 400);
  for (const d of body.days) {
    await db.insert(workingHours)
      .values({ businessId: ctx.businessId, day: Number(d.day), opensAt: String(d.opensAt ?? "08:00"), closesAt: String(d.closesAt ?? "17:00"), isClosed: Boolean(d.isClosed) })
      .onConflictDoUpdate({ target: [workingHours.businessId, workingHours.day], set: { opensAt: String(d.opensAt ?? "08:00"), closesAt: String(d.closesAt ?? "17:00"), isClosed: Boolean(d.isClosed) } });
  }
  return json({ ok: true });
};

const toggleAgent: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "settings.write")) return err("You don't have permission to change agents.", 403, "forbidden");
  if (!body?.key) return err("Agent key is required.", 400);
  await db.update(aiAgents).set({ active: Boolean(body.active) }).where(and(eq(aiAgents.businessId, ctx.businessId), eq(aiAgents.key, body.key)));
  await audit(ctx.businessId, ctx.user.name, `${body.active ? "Enabled" : "Disabled"} ${body.key} agent`, "agent", body.key);
  return json({ ok: true });
};

const connectIntegration: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "settings.write")) return err("You don't have permission to manage integrations.", 403, "forbidden");
  const provider = String(body?.provider ?? "");
  if (!["whatsapp", "yoco", "email", "google_calendar"].includes(provider)) return err("Unknown integration provider.", 400);
  const configured =
    (provider === "whatsapp" && process.env.WHATSAPP_API_KEY) || (provider === "yoco" && process.env.YOCO_MERCHANT_KEY) || (provider === "email" && process.env.SMTP_HOST);
  const status = configured ? "connected" : "pending";
  await db.insert(integrations)
    .values({ businessId: ctx.businessId, provider, status, label: body?.label ?? null, config: body?.config ? JSON.stringify(body.config) : null })
    .onConflictDoUpdate({ target: [integrations.businessId, integrations.provider], set: { status, label: body?.label ?? null } });
  if (provider === "whatsapp" && body?.phone) await db.update(businesses).set({ whatsapp: body.phone }).where(eq(businesses.id, ctx.businessId));
  return json({ ok: true, status, mock: !configured });
};

const onboarding: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!body?.business?.name) return err("Business name is required.", 400);
  const [biz] = await db
    .insert(businesses)
    .values({
      name: String(body.business.name).slice(0, 120),
      type: body.business.type ?? null,
      ownerName: body.business.ownerName ?? ctx.user.name,
      phone: body.business.phone ?? null,
      email: body.business.email ?? ctx.user.email,
      whatsapp: body.business.whatsapp ?? null,
      province: body.business.province ?? null,
      city: body.business.city ?? null,
      serviceArea: body.business.serviceArea ?? null,
      description: body.business.description ?? null,
      onboardedAt: new Date(),
    })
    .returning();
  await db.insert(businessMembers).values({ businessId: biz.id, userId: ctx.user.id, role: "owner" });
  const trialEnds = new Date(Date.now() + 14 * 86400000);
  const [sub] = await db.insert(subscriptions).values({ businessId: biz.id, plan: body.plan ?? "business", status: "trialing", trialEndsAt: trialEnds }).returning();
  await db.insert(subscriptionEvents).values({ subscriptionId: sub.id, businessId: biz.id, type: "trial_started", meta: JSON.stringify({ plan: sub.plan, days: 14 }) });
  await createBusinessWithDefaults(biz.id);
  if (Array.isArray(body.services)) {
    for (const s of body.services) {
      await db.insert(services).values({
        businessId: biz.id,
        name: String(s.name).slice(0, 120),
        description: s.description ?? null,
        category: s.category ?? "general",
        basePrice: s.basePrice != null && s.basePrice !== "" ? String(Number(s.basePrice)) : null,
        pricingType: s.pricingType ?? "fixed",
        durationMinutes: Number(s.durationMinutes ?? 60),
        isEmergency: Boolean(s.isEmergency),
        active: s.active !== false,
      });
    }
  }
  if (Array.isArray(body.team)) {
    for (const tm of body.team) {
      await db.insert(teamMembers).values({
        businessId: biz.id,
        name: String(tm.name).slice(0, 120),
        role: tm.role ?? "technician",
        phone: tm.phone ?? null,
        email: tm.email ?? null,
        skills: Array.isArray(tm.skills) ? tm.skills : [],
        serviceAreas: Array.isArray(tm.serviceAreas) ? tm.serviceAreas : [],
        workingHours: tm.workingHours ?? null,
      });
    }
  }
  if (Array.isArray(body.hours) && body.hours.length === 7) {
    for (const d of body.hours) {
      await db.insert(workingHours).values({ businessId: biz.id, day: Number(d.day), opensAt: String(d.opensAt ?? "08:00"), closesAt: String(d.closesAt ?? "17:00"), isClosed: Boolean(d.isClosed) }).onConflictDoUpdate({ target: [workingHours.businessId, workingHours.day], set: { opensAt: String(d.opensAt ?? "08:00"), closesAt: String(d.closesAt ?? "17:00"), isClosed: Boolean(d.isClosed) } });
    }
  }
  const settingsPatch: any = {};
  if (body.ai) {
    if (body.ai.tone) settingsPatch.aiTone = body.ai.tone;
    if (body.ai.autonomy) settingsPatch.aiAutonomy = body.ai.autonomy;
    if (Array.isArray(body.ai.rules)) settingsPatch.businessRules = body.ai.rules;
  }
  if (Object.keys(settingsPatch).length) await db.update(businessSettings).set(settingsPatch).where(eq(businessSettings.businessId, biz.id));
  if (body.channels) {
    const chans: any[] = [];
    if (body.channels.website) chans.push({ provider: "whatsapp", status: body.channels.whatsapp ? "pending" : "disconnected", label: "Website + WhatsApp" });
    if (body.channels.email) chans.push({ provider: "email", status: "pending", label: "Email" });
    for (const c of chans) await db.insert(integrations).values({ businessId: biz.id, ...c }).onConflictDoUpdate({ target: [integrations.businessId, integrations.provider], set: { status: c.status } });
  }
  await db.update(businessMembers).set({}).where(eq(businessMembers.id, "00000000-0000-0000-0000-000000000000")); // no-op to keep tx warm
  await audit(biz.id, ctx.user.name, "Business onboarded", "business", biz.id, { name: biz.name });
  await notify(biz.id, "briefing", "Welcome to BizPilot", `Your AI team is ready. ${body.services?.length ?? 0} services configured.`);
  return json({ ok: true, businessId: biz.id });
};

/* ================================================================== */
/* CUSTOMERS                                                           */
/* ================================================================== */

const listCustomers: Handler = async (_req, ctx, q) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "customers.read")) return err("You don't have access to customers.", 403, "forbidden");
  const search = q.get("search") ?? "";
  const limit = Math.min(100, Number(q.get("limit") ?? 50));
  const offset = Number(q.get("offset") ?? 0);
  const conds: any[] = [eq(customers.businessId, ctx.businessId)];
  if (search) {
    const like = `%${search}%`;
    conds.push(or(ilike(customers.name, like), ilike(customers.phone, like), ilike(customers.email, like), ilike(customers.suburb, like)));
  }
  const rows = await db.select().from(customers).where(and(...conds)).orderBy(desc(customers.createdAt)).limit(limit).offset(offset);
  return json({ items: rows });
};

const createCustomer: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "customers.write")) return err("You don't have access to add customers.", 403, "forbidden");
  if (!body?.name) return err("Customer name is required.", 400, "invalid_input");
  const [c] = await db
    .insert(customers)
    .values({
      businessId: ctx.businessId,
      name: String(body.name).slice(0, 120),
      phone: body.phone ?? null,
      whatsapp: body.whatsapp ?? body.phone ?? null,
      email: body.email ?? null,
      address: body.address ?? null,
      suburb: body.suburb ?? null,
      city: body.city ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: body.status ?? "customer",
      source: body.source ?? "manual",
      notes: body.notes ?? null,
    })
    .returning();
  await audit(ctx.businessId, ctx.user.name, "Created customer", "customer", c.id, { name: c.name });
  return json({ item: c }, 201);
};

const patchCustomer: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "customers.write")) return err("You don't have access to edit customers.", 403, "forbidden");
  if (!body?.id) return err("Customer id is required.", 400);
  const [existing] = await db.select().from(customers).where(and(eq(customers.id, body.id), eq(customers.businessId, ctx.businessId)));
  if (!existing) return err("Customer not found.", 404);
  const allowed = ["name", "phone", "whatsapp", "email", "address", "suburb", "city", "province", "notes", "tags", "status", "source"] as const;
  const patch: any = {};
  for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
  await db.update(customers).set(patch).where(eq(customers.id, existing.id));
  return json({ ok: true });
};

const deleteCustomer: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "customers.write")) return err("You don't have access to delete customers.", 403, "forbidden");
  if (!body?.id) return err("Customer id is required.", 400);
  await db.delete(customers).where(and(eq(customers.id, body.id), eq(customers.businessId, ctx.businessId)));
  return json({ ok: true });
};

const getCustomer: Handler = async (_req, ctx, _q, _b, seg) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "customers.read")) return err("You don't have access to customers.", 403, "forbidden");
  const id = seg[1];
  const [c] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, ctx.businessId)));
  if (!c) return err("Customer not found.", 404);
  const [spend] = await db.select({ v: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.customerId, c.id), eq(payments.businessId, ctx.businessId), eq(payments.status, "completed")));
  const [jobsCnt] = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.customerId, c.id));
  const out = await outstandingInvoices(ctx.businessId);
  const outstanding = out.items.filter((i) => i.customerId === c.id).reduce((s, i) => s + i.balance, 0);
  const [lastJob] = await db.select().from(jobs).where(eq(jobs.customerId, c.id)).orderBy(desc(jobs.date));
  const since = new Date(Date.now() - 60 * 86400000);
  const [msgs, lds, qts, jbs, invs, pmts, rvs, aas] = await Promise.all([
    db.select().from(messages).where(and(eq(messages.customerId, c.id), gte(messages.createdAt, since))).orderBy(desc(messages.createdAt)).limit(15),
    db.select().from(leads).where(eq(leads.customerId, c.id)).orderBy(desc(leads.createdAt)).limit(10),
    db.select().from(quotes).where(eq(quotes.customerId, c.id)).orderBy(desc(quotes.createdAt)).limit(10),
    db.select().from(jobs).where(eq(jobs.customerId, c.id)).orderBy(desc(jobs.date)).limit(10),
    db.select().from(invoices).where(eq(invoices.customerId, c.id)).orderBy(desc(invoices.createdAt)).limit(10),
    db.select().from(payments).where(eq(payments.customerId, c.id)).orderBy(desc(payments.createdAt)).limit(10),
    db.select().from(reviews).where(eq(reviews.customerId, c.id)).orderBy(desc(reviews.createdAt)).limit(5),
    db.select().from(aiActions).where(eq(aiActions.businessId, ctx.businessId)).orderBy(desc(aiActions.createdAt)).limit(5),
  ]);
  const timeline: any[] = [
    ...msgs.map((m) => ({ id: m.id, kind: "message", title: m.direction === "in" ? "Customer message" : "Outgoing message", detail: m.body.slice(0, 120), at: m.createdAt })),
    ...lds.map((l) => ({ id: l.id, kind: "lead", title: `Lead — ${l.service ?? "General"}`, detail: `Status: ${l.status} · score ${l.score}`, at: l.createdAt })),
    ...qts.map((qt) => ({ id: qt.id, kind: "quote", title: `Quote ${qt.quoteNumber}`, value: `R ${Math.round(num(qt.total)).toLocaleString("en-ZA")}`, detail: qt.status, at: qt.createdAt })),
    ...jbs.map((j) => ({ id: j.id, kind: "job", title: `Job ${j.jobNumber} — ${j.service}`, detail: j.status, at: new Date(j.date).toISOString() })),
    ...invs.map((i) => ({ id: i.id, kind: "invoice", title: `Invoice ${i.invoiceNumber}`, value: `R ${Math.round(num(i.total)).toLocaleString("en-ZA")}`, detail: i.status, at: i.createdAt })),
    ...pmts.map((p) => ({ id: p.id, kind: "payment", title: "Payment received", value: `R ${Math.round(num(p.amount)).toLocaleString("en-ZA")}`, detail: p.method, at: p.createdAt })),
    ...rvs.map((r) => ({ id: r.id, kind: "review", title: `Review — ${r.rating} star${r.rating > 1 ? "s" : ""}`, detail: r.comment?.slice(0, 120) ?? null, at: r.createdAt })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 25);
  return json({
    item: { ...c, totalSpend: Math.round(num(spend.v)), jobsCount: jobsCnt.n, outstanding: Math.round(outstanding), lastBooking: lastJob ? lastJob.date : null },
    timeline,
  });
};

/* ================================================================== */
/* LEADS                                                               */
/* ================================================================== */

const listLeads: Handler = async (_req, ctx, q) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "leads.read")) return err("You don't have access to leads.", 403, "forbidden");
  const status = q.get("status");
  const conds: any[] = [eq(leads.businessId, ctx.businessId)];
  if (status) conds.push(eq(leads.status, status));
  const rows = await db.select().from(leads).where(and(...conds)).orderBy(asc(leads.position), desc(leads.createdAt));
  return json({ items: rows });
};

const createLead: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "leads.write")) return err("You don't have access to leads.", 403, "forbidden");
  if (!body?.name) return err("Lead name is required.", 400, "invalid_input");
  const text = `${body.notes ?? ""} ${body.service ?? ""}`;
  const score = scoreLeadSignal(text, Boolean(body.suburb), Boolean(body.phone));
  const [pos] = await db.select({ n: sql<number>`coalesce(max(${leads.position}), 0)::int` }).from(leads).where(eq(leads.businessId, ctx.businessId));
  const [l] = await db
    .insert(leads)
    .values({
      businessId: ctx.businessId,
      customerId: body.customerId ?? null,
      name: String(body.name).slice(0, 120),
      phone: body.phone ?? null,
      source: body.source ?? "manual",
      serviceId: body.serviceId ?? null,
      service: body.service ?? null,
      suburb: body.suburb ?? null,
      city: body.city ?? null,
      urgency: body.urgency ?? score.urgency,
      budget: body.budget != null && body.budget !== "" ? String(Number(body.budget)) : null,
      status: body.status ?? "new",
      value: body.value != null && body.value !== "" ? String(Number(body.value)) : null,
      score: body.score != null ? Number(body.score) : score.score,
      scoreReason: body.scoreReason ?? score.reason,
      assignedTo: body.assignedTo ?? null,
      nextFollowUpAt: body.nextFollowUpAt ?? null,
      notes: body.notes ?? null,
      position: (pos?.n ?? 0) + 1,
    })
    .returning();
  await db.insert(leadActivities).values({ businessId: ctx.businessId, leadId: l.id, type: "created", note: body.notes ?? "Lead created", actor: ctx.user.name });
  return json({ item: l }, 201);
};

const patchLead: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "leads.write")) return err("You don't have access to leads.", 403, "forbidden");
  if (!body?.id) return err("Lead id is required.", 400);
  const [l] = await db.select().from(leads).where(and(eq(leads.id, body.id), eq(leads.businessId, ctx.businessId)));
  if (!l) return err("Lead not found.", 404);
  const allowed = ["status", "urgency", "score", "scoreReason", "value", "budget", "assignedTo", "nextFollowUpAt", "notes", "position", "service", "suburb", "phone", "customerId"] as const;
  const patch: any = {};
  for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
  if (patch.status && ["won", "booked", "lost"].includes(patch.status)) patch.closedAt = new Date();
  await db.update(leads).set(patch).where(eq(leads.id, l.id));
  if (patch.status && patch.status !== l.status) {
    await db.insert(leadActivities).values({ businessId: ctx.businessId, leadId: l.id, type: "status_changed", note: `${l.status} → ${patch.status}`, actor: ctx.user.name });
    if (patch.status === "won" || patch.status === "booked") await notify(ctx.businessId, "new_booking", "Lead converted", `${l.name} — ${l.service ?? "lead"} marked ${patch.status}`);
  }
  return json({ ok: true });
};

const getLead: Handler = async (_req, ctx, _q, _b, seg) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "leads.read")) return err("You don't have access to leads.", 403, "forbidden");
  const [l] = await db.select().from(leads).where(and(eq(leads.id, seg[1]), eq(leads.businessId, ctx.businessId)));
  if (!l) return err("Lead not found.", 404);
  const acts = await db.select().from(leadActivities).where(eq(leadActivities.leadId, l.id)).orderBy(desc(leadActivities.createdAt));
  return json({ item: l, activities: acts });
};

const convertLead: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "quotes.write")) return err("You don't have access to quotes.", 403, "forbidden");
  const [l] = await db.select().from(leads).where(and(eq(leads.id, body?.id), eq(leads.businessId, ctx.businessId)));
  if (!l) return err("Lead not found.", 404);
  let customerId = l.customerId;
  if (!customerId) {
    let c = l.customerId ? null : (await db.select().from(customers).where(and(eq(customers.businessId, ctx.businessId), eq(customers.name, l.name))))[0];
    if (!c) {
      [c] = await db.insert(customers).values({ businessId: ctx.businessId, name: l.name, phone: l.phone, suburb: l.suburb, status: "prospect", source: l.source }).returning();
    }
    customerId = c.id;
    await db.update(leads).set({ customerId: c.id }).where(eq(leads.id, l.id));
  }
  const service = l.serviceId ? (await db.select().from(services).where(eq(services.id, l.serviceId)))[0] : null;
  const price = service?.basePrice && num(service.basePrice) > 0 ? num(service.basePrice) : num(l.value) > 0 ? num(l.value) : null;
  if (price == null) return err(`BizPilot couldn't create the quote because the service price hasn't been configured. Set a price for this service first.`, 409, "no_price", { configureUrl: "/dashboard/settings?tab=services" });
  const number = await nextDocNumber(quotes, quotes.quoteNumber, ctx.businessId, "Q-");
  const subtotal = price;
  const vat = num((await getBusinessBundle(ctx.businessId))?.business.vatRate) / 100;
  const [q] = await db
    .insert(quotes)
    .values({ businessId: ctx.businessId, quoteNumber: number, customerId, leadId: l.id, status: "draft", notes: `From lead: ${l.name}`, subtotal: String(subtotal), vatAmount: String((subtotal * vat).toFixed(2)), total: String((subtotal * (1 + vat)).toFixed(2)) })
    .returning();
  await db.insert(quoteItems).values({ quoteId: q.id, businessId: ctx.businessId, type: "service", name: l.service ?? "Service", qty: "1", unitPrice: String(price), amount: String(price) });
  await db.update(leads).set({ status: "quote_sent" }).where(eq(leads.id, l.id));
  await db.insert(leadActivities).values({ businessId: ctx.businessId, leadId: l.id, type: "quote_sent", note: `Quote ${number} created`, actor: ctx.user.name });
  await audit(ctx.businessId, ctx.user.name, "Created quote from lead", "quote", q.id, { leadId: l.id });
  return json({ item: q, quoteNumber: number }, 201);
};

/* ================================================================== */
/* CONVERSATIONS + MESSAGES (AI Receptionist)                          */
/* ================================================================== */

const listConversations: Handler = async (_req, ctx, q) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "inbox.read")) return err("You don't have access to the inbox.", 403, "forbidden");
  const view = q.get("view") ?? "all";
  const conds: any[] = [eq(conversations.businessId, ctx.businessId)];
  if (view === "unread") conds.push(eq(conversations.unread, true));
  if (view === "urgent") conds.push(or(eq(conversations.aiStatus, "escalated"), sql`coalesce(${conversations.leadScore}, 0) >= 85`));
  if (view === "ai") conds.push(eq(conversations.aiStatus, "active"));
  if (view === "human") conds.push(eq(conversations.mode, "human"));
  const rows = await db
    .select({ conv: conversations, customerName: customers.name, customerPhone: customers.phone })
    .from(conversations)
    .leftJoin(customers, eq(conversations.customerId, customers.id))
    .where(and(...conds))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(60);
  return json({
    items: rows.map((r) => ({ ...r.conv, customerName: r.customerName ?? null, customerPhone: r.customerPhone ?? null })),
  });
};

const createConversation: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "inbox.write")) return err("You don't have access to the inbox.", 403, "forbidden");
  let customerId = body?.customerId ?? null;
  if (!customerId && body?.name) {
    let c = (await db.select().from(customers).where(and(eq(customers.businessId, ctx.businessId), eq(customers.phone, body.phone ?? ""))))[0];
    if (!c) {
      [c] = await db.insert(customers).values({ businessId: ctx.businessId, name: String(body.name).slice(0, 120), phone: body.phone ?? null, whatsapp: body.phone ?? null, suburb: body.suburb ?? null, status: "prospect", source: body.channel ?? "manual" }).returning();
    }
    customerId = c.id;
  }
  const [conv] = await db
    .insert(conversations)
    .values({ businessId: ctx.businessId, customerId, channel: body?.channel ?? "whatsapp", subject: body?.subject ?? "New conversation", mode: body?.mode ?? "ai", lastMessagePreview: "" })
    .returning();
  if (body?.firstMessage) {
    const msg = await db.insert(messages).values({ businessId: ctx.businessId, conversationId: conv.id, customerId, direction: "in", author: "customer", body: String(body.firstMessage), channel: body?.channel ?? "whatsapp" }).returning();
    await db.update(conversations).set({ lastMessagePreview: String(body.firstMessage).slice(0, 90), lastMessageAt: new Date(), unread: true }).where(eq(conversations.id, conv.id));
    // AI receptionist handles the incoming message
    const handled = await handleIncoming(ctx, conv, msg[0]);
    return json({ item: conv, firstMessage: msg[0], ai: handled }, 201);
  }
  return json({ item: conv }, 201);
};

async function handleIncoming(ctx: Ctx, conv: any, customerMsg: any) {
  if (conv.mode === "human" || conv.aiStatus === "escalated") {
    await notify(ctx.businessId, "new_lead", "New customer message", `${conv.customerName ?? "Customer"} needs a human reply.`);
    return { handledBy: "none" };
  }
  const result = await receptionistReply(ctx.businessId, customerMsg.body, conv.customerId ?? null, conv.leadId);
  if (!result) return { handledBy: "none" };
  // create / update lead
  let leadId = conv.leadId;
  const cust = conv.customerId ? (await db.select().from(customers).where(eq(customers.id, conv.customerId)))[0] : null;
  const existingLead = leadId ? (await db.select().from(leads).where(eq(leads.id, leadId)))[0] : null;
  if (!leadId || !existingLead) {
    if (cust) {
      const open = (await db.select().from(leads).where(and(eq(leads.customerId, cust.id), sql`${leads.status} in ('new','contacted','qualified','quote_sent','negotiating')`)))[0];
      if (open) {
        leadId = open.id;
        await db.update(leads).set({ score: result.score.score, scoreReason: result.score.reason, urgency: result.score.urgency ?? open.urgency, status: open.status === "new" ? "contacted" : open.status, service: result.service?.name ?? open.service, suburb: cust.suburb ?? open.suburb }).where(eq(leads.id, open.id));
        await db.insert(leadActivities).values({ businessId: ctx.businessId, leadId: open.id, type: "ai_scored", note: `AI score ${result.score.score}: ${result.score.reason}`, actor: "AI Receptionist" });
      } else {
        const [pos] = await db.select({ n: sql<number>`coalesce(max(${leads.position}), 0)::int` }).from(leads).where(eq(leads.businessId, ctx.businessId));
        const [l] = await db
          .insert(leads)
          .values({ businessId: ctx.businessId, customerId: cust.id, name: cust.name, phone: cust.phone, source: conv.channel, serviceId: result.service?.id ?? null, service: result.service?.name ?? null, suburb: cust.suburb ?? (result.hasSuburb ? "Provided in chat" : null), urgency: result.score.urgency, score: result.score.score, scoreReason: result.score.reason, status: "new", position: (pos?.n ?? 0) + 1 })
          .returning();
        leadId = l.id;
        await db.insert(leadActivities).values({ businessId: ctx.businessId, leadId: l.id, type: "ai_scored", note: `AI score ${result.score.score}: ${result.score.reason}`, actor: "AI Receptionist" });
        await notify(ctx.businessId, "new_lead", "New lead captured by AI", `${cust.name} — ${result.service?.name ?? "enquiry"} (score ${result.score.score})`);
      }
    }
  }
  await db.update(conversations).set({ leadId, leadScore: result.score.score, service: result.service?.name ?? conv.service, location: result.hasSuburb ? (conv.location ?? "provided in chat") : conv.location, recommendedAction: result.escalate ? "Reply personally — escalated" : "Monitor — AI handling", lastMessageAt: new Date() }).where(eq(conversations.id, conv.id));
  await db.insert(aiActions).values({ businessId: ctx.businessId, agent: "AI Receptionist", action: result.escalate ? "escalated" : "auto_reply", tool: "receptionistReply", reason: result.reason ?? "Routine enquiry", input: JSON.stringify({ conversationId: conv.id, leadId }), status: "executed", result: result.reply.slice(0, 200) });

  const [aiMsg] = await db.insert(messages).values({ businessId: ctx.businessId, conversationId: conv.id, customerId: conv.customerId, direction: "out", author: "bizpilot_ai", body: result.reply, channel: conv.channel }).returning();
  await db.update(conversations).set({ lastMessagePreview: result.reply.slice(0, 90) }).where(eq(conversations.id, conv.id));

  if (result.escalate) {
    await db.update(conversations).set({ aiStatus: "escalated", escalationReason: result.reason, mode: "human", unread: true }).where(eq(conversations.id, conv.id));
    await notify(ctx.businessId, "ai_escalation", "AI needs your attention", `${conv.customerName ?? "A customer"}: ${result.reason}`, "/dashboard/inbox");
    return { handledBy: "escalated", reason: result.reason, aiMessage: aiMsg };
  }
  return { handledBy: "ai", aiMessage: aiMsg, leadId, score: result.score.score };
}

const patchConversation: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "inbox.write")) return err("You don't have access to the inbox.", 403, "forbidden");
  if (!body?.id) return err("Conversation id is required.", 400);
  const [c] = await db.select().from(conversations).where(and(eq(conversations.id, body.id), eq(conversations.businessId, ctx.businessId)));
  if (!c) return err("Conversation not found.", 404);
  const patch: any = {};
  if (body.mode) patch.mode = body.mode;
  if (body.aiStatus) patch.aiStatus = body.aiStatus;
  if (body.escalationReason !== undefined) patch.escalationReason = body.escalationReason;
  if (body.read) patch.unread = false;
  await db.update(conversations).set(patch).where(eq(conversations.id, c.id));
  return json({ ok: true });
};

const getConversation: Handler = async (_req, ctx, _q, _b, seg) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "inbox.read")) return err("You don't have access to the inbox.", 403, "forbidden");
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, seg[1]), eq(conversations.businessId, ctx.businessId)));
  if (!conv) return err("Conversation not found.", 404);
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(asc(messages.createdAt));
  const cust = conv.customerId ? (await db.select().from(customers).where(eq(customers.id, conv.customerId)))[0] : null;
  return json({ item: { ...conv, customer: cust ?? null }, messages: msgs });
};

const sendMessage: Handler = async (_req, ctx, _q, body, seg) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "inbox.write")) return err("You don't have access to messaging.", 403, "forbidden");
  const convId = body?.conversationId ?? seg[2];
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, convId), eq(conversations.businessId, ctx.businessId)));
  if (!conv) return err("Conversation not found.", 404);
  if (!body?.body || !String(body.body).trim()) return err("Message cannot be empty.", 400, "invalid_input");
  const direction = body?.direction ?? "out";
  const [msg] = await db
    .insert(messages)
    .values({ businessId: ctx.businessId, conversationId: conv.id, customerId: conv.customerId, direction, author: direction === "in" ? "customer" : ctx.user.name ?? "human", body: String(body.body).slice(0, 4000), channel: conv.channel })
    .returning();
  await db.update(conversations).set({ lastMessagePreview: String(body.body).slice(0, 90), lastMessageAt: new Date(), unread: direction === "in" ? true : conv.unread }).where(eq(conversations.id, conv.id));
  let ai: any = null;
  if (direction === "in") {
    ai = await handleIncoming(ctx, conv, msg);
  } else if (conv.aiStatus === "escalated") {
    await db.update(conversations).set({ aiStatus: "active", escalationReason: null }).where(eq(conversations.id, conv.id));
  }
  return json({ message: msg, ai }, 201);
};

/* ================================================================== */
/* SERVICES + TEAM                                                     */
/* ================================================================== */

const listServices: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  const rows = await db.select().from(services).where(eq(services.businessId, ctx.businessId)).orderBy(asc(services.name));
  return json({ items: rows });
};

const saveService: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "settings.write") && ctx.role !== "manager") return err("You don't have access to services.", 403, "forbidden");
  if (!body?.name) return err("Service name is required.", 400, "invalid_input");
  const values = {
    name: String(body.name).slice(0, 120),
    description: body.description ?? null,
    category: body.category ?? "general",
    basePrice: body.basePrice != null && body.basePrice !== "" ? String(Number(body.basePrice)) : null,
    pricingType: body.pricingType ?? "fixed",
    durationMinutes: Number(body.durationMinutes ?? 60),
    isEmergency: Boolean(body.isEmergency),
    active: body.active !== false,
  };
  if (body.id) {
    const [ex] = await db.select().from(services).where(and(eq(services.id, body.id), eq(services.businessId, ctx.businessId)));
    if (!ex) return err("Service not found.", 404);
    await db.update(services).set(values).where(eq(services.id, ex.id));
    return json({ ok: true, id: ex.id });
  }
  const [s] = await db.insert(services).values({ businessId: ctx.businessId, ...values }).returning();
  return json({ ok: true, item: s }, 201);
};

const deleteService: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "settings.write")) return err("You don't have access to services.", 403, "forbidden");
  await db.delete(services).where(and(eq(services.id, body?.id), eq(services.businessId, ctx.businessId)));
  return json({ ok: true });
};

const listTeam: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "team.read") && ctx.role !== "technician") return err("You don't have access to the team.", 403, "forbidden");
  const rows = await db.select().from(teamMembers).where(eq(teamMembers.businessId, ctx.businessId)).orderBy(asc(teamMembers.name));
  return json({ items: rows });
};

const saveTeamMember: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "team.write")) return err("You don't have access to the team.", 403, "forbidden");
  if (!body?.name) return err("Name is required.", 400, "invalid_input");
  const values = {
    name: String(body.name).slice(0, 120),
    role: body.role ?? "technician",
    phone: body.phone ?? null,
    email: body.email ?? null,
    skills: Array.isArray(body.skills) ? body.skills : [],
    serviceAreas: Array.isArray(body.serviceAreas) ? body.serviceAreas : [],
    workingHours: body.workingHours ?? null,
    active: body.active !== false,
  };
  if (body.id) {
    const [ex] = await db.select().from(teamMembers).where(and(eq(teamMembers.id, body.id), eq(teamMembers.businessId, ctx.businessId)));
    if (!ex) return err("Team member not found.", 404);
    await db.update(teamMembers).set(values).where(eq(teamMembers.id, ex.id));
    return json({ ok: true, id: ex.id });
  }
  const [tm] = await db.insert(teamMembers).values({ businessId: ctx.businessId, ...values }).returning();
  return json({ ok: true, item: tm }, 201);
};

const deleteTeamMember: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "team.write")) return err("You don't have access to the team.", 403, "forbidden");
  await db.delete(teamMembers).where(and(eq(teamMembers.id, body?.id), eq(teamMembers.businessId, ctx.businessId)));
  return json({ ok: true });
};

const teamAvailability: Handler = async (_req, ctx, q) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "jobs.write") && ctx.role !== "technician") return err("Not allowed.", 403, "forbidden");
  const date = q.get("date") ?? today();
  const start = q.get("start") ?? "09:00";
  const dur = Number(q.get("durationMin") ?? 60);
  const slot = await findSlot(ctx.businessId, date, start, dur, q.get("member") ?? undefined);
  return json(slot);
};

/* ================================================================== */
/* JOBS                                                                */
/* ================================================================== */

const listJobs: Handler = async (_req, ctx, q) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "jobs.read")) return err("You don't have access to jobs.", 403, "forbidden");
  const view = q.get("view") ?? "all";
  const conds: any[] = [eq(jobs.businessId, ctx.businessId)];
  if (ctx.role === "technician") conds.push(or(eq(jobs.teamMemberName, ctx.user.name), isNull(jobs.teamMemberName)));
  if (view === "today") conds.push(eq(jobs.date, today()));
  if (view === "upcoming") conds.push(sql`${jobs.date} >= ${today()}`);
  const from = q.get("from");
  const to = q.get("to");
  if (from && to) conds.push(sql`${jobs.date} between ${from} and ${to}`);
  const rows = await db
    .select({ job: jobs, customerName: customers.name, customerPhone: customers.phone })
    .from(jobs)
    .leftJoin(customers, eq(jobs.customerId, customers.id))
    .where(and(...conds))
    .orderBy(asc(jobs.date), asc(jobs.startsAt))
    .limit(200);
  return json({ items: rows.map((r) => ({ ...r.job, customerName: r.customerName ?? null, customerPhone: r.customerPhone ?? null })) });
};

const createJob: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "jobs.write")) return err("You don't have access to jobs.", 403, "forbidden");
  if (!body?.date || !body?.service) return err("Date and service are required.", 400, "invalid_input");
  let customerId = body.customerId ?? null;
  if (!customerId && body.customerName) {
    let c = (await db.select().from(customers).where(and(eq(customers.businessId, ctx.businessId), eq(customers.name, body.customerName))))[0];
    if (!c) [c] = await db.insert(customers).values({ businessId: ctx.businessId, name: body.customerName, phone: body.customerPhone ?? null, suburb: body.suburb ?? null, status: "prospect", source: "manual" }).returning();
    customerId = c.id;
  }
  const [tm] = body.teamMemberId ? await db.select().from(teamMembers).where(and(eq(teamMembers.id, body.teamMemberId), eq(teamMembers.businessId, ctx.businessId))) : [];
  const number = await nextDocNumber(jobs, jobs.jobNumber, ctx.businessId, "JOB-");
  const [j] = await db
    .insert(jobs)
    .values({
      businessId: ctx.businessId,
      jobNumber: number,
      customerId,
      leadId: body.leadId ?? null,
      serviceId: body.serviceId ?? null,
      service: String(body.service).slice(0, 160),
      description: body.description ?? null,
      address: body.address ?? null,
      suburb: body.suburb ?? null,
      city: body.city ?? null,
      teamMemberId: tm?.id ?? null,
      teamMemberName: tm?.name ?? body.teamMemberName ?? null,
      date: String(body.date),
      startsAt: String(body.startsAt ?? "09:00"),
      endsAt: body.endsAt ?? null,
      status: "scheduled",
      priority: body.priority ?? "normal",
      notes: body.notes ?? null,
    })
    .returning();
  if (body.leadId) await db.update(leads).set({ status: "booked", closedAt: new Date() }).where(eq(leads.id, body.leadId));
  await audit(ctx.businessId, ctx.user.name, "Created job", "job", j.id, { jobNumber: number });
  await notify(ctx.businessId, "new_booking", "New job scheduled", `${number} — ${body.service}, ${body.date} ${body.startsAt ?? "09:00"}`);
  return json({ item: j }, 201);
};

const patchJob: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "jobs.write")) return err("You don't have access to jobs.", 403, "forbidden");
  if (!body?.id) return err("Job id is required.", 400);
  const [j] = await db.select().from(jobs).where(and(eq(jobs.id, body.id), eq(jobs.businessId, ctx.businessId)));
  if (!j) return err("Job not found.", 404);
  if (ctx.role === "technician" && j.teamMemberName && j.teamMemberName !== ctx.user.name) {
    return err("This job is assigned to another technician.", 403, "forbidden");
  }
  const allowed = ["status", "priority", "startsAt", "endsAt", "date", "teamMemberId", "teamMemberName", "notes", "description", "address", "suburb"] as const;
  const patch: any = {};
  for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
  await db.update(jobs).set(patch).where(eq(jobs.id, j.id));
  if (patch.status) {
    await audit(ctx.businessId, ctx.user.name, `Job ${j.jobNumber} → ${patch.status}`, "job", j.id);
    if (patch.status === "completed") {
      const settings = (await getBusinessBundle(ctx.businessId))?.settings;
      const cust = j.customerId ? (await db.select().from(customers).where(eq(customers.id, j.customerId)))[0] : null;
      const priorReview = (await db.select().from(reviews).where(eq(reviews.jobId, j.id)))[0];
      if (cust && settings?.requestReviews && !priorReview) {
        const convs = await db.select().from(conversations).where(and(eq(conversations.businessId, ctx.businessId), eq(conversations.customerId, cust.id)));
        const conv = convs[0];
        const text = `Hi ${cust.name.split(" ")[0]} 👋 Thanks for choosing us for your ${j.service.toLowerCase()}. How did we do? If you had 5 stars, a quick Google review means a lot — and if anything was off, tell me and I'll take it to the owner.`;
        if (conv) {
          await db.insert(messages).values({ businessId: ctx.businessId, conversationId: conv.id, customerId: cust.id, direction: "out", author: "bizpilot_ai", body: text, channel: conv.channel });
          await db.update(conversations).set({ lastMessagePreview: text.slice(0, 90), lastMessageAt: new Date(), unread: false }).where(eq(conversations.id, conv.id));
        }
        await notify(ctx.businessId, "review", "Review request sent", `AI Customer Success Agent asked ${cust.name} for a review after ${j.jobNumber}.`);
        await db.insert(aiActions).values({ businessId: ctx.businessId, agent: "AI Customer Success Agent", action: "review_request", tool: "requestReview", reason: "Job completed", input: JSON.stringify({ jobId: j.id }), status: "executed" });
      }
    }
  }
  return json({ ok: true });
};

const getJob: Handler = async (_req, ctx, _q, _b, seg) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "jobs.read")) return err("You don't have access to jobs.", 403, "forbidden");
  const [j] = await db.select().from(jobs).where(and(eq(jobs.id, seg[1]), eq(jobs.businessId, ctx.businessId)));
  if (!j) return err("Job not found.", 404);
  if (ctx.role === "technician" && j.teamMemberName && j.teamMemberName !== ctx.user.name) return err("This job is assigned to another technician.", 403, "forbidden");
  const cust = j.customerId ? (await db.select().from(customers).where(eq(customers.id, j.customerId)))[0] : null;
  const photos = await db.select().from(jobPhotos).where(eq(jobPhotos.jobId, j.id)).orderBy(asc(jobPhotos.createdAt));
  return json({ item: { ...j, customer: cust ?? null, photos } });
};

const addJobPhoto: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "jobs.write")) return err("You don't have access to jobs.", 403, "forbidden");
  const [j] = await db.select().from(jobs).where(and(eq(jobs.id, body?.jobId), eq(jobs.businessId, ctx.businessId)));
  if (!j) return err("Job not found.", 404);
  if (!body?.name) return err("Photo name is required.", 400);
  if (body.url && String(body.url).length > 1_500_000) return err("Image is too large. Please keep photos under 1.5 MB.", 413, "too_large");
  const [p] = await db.insert(jobPhotos).values({ businessId: ctx.businessId, jobId: j.id, type: body.type ?? "after", name: String(body.name).slice(0, 200), url: body.url ?? null, caption: body.caption ?? null, uploadedBy: ctx.user.name }).returning();
  return json({ item: p }, 201);
};

/* ================================================================== */
/* QUOTES                                                              */
/* ================================================================== */

function calcQuoteTotals(items: any[], discount: number, vatRatePct: number) {
  const subtotal = items.reduce((s, it) => s + num(it.unitPrice) * num(it.qty ?? 1), 0) - discount;
  const vat = (subtotal * vatRatePct) / 100;
  return { subtotal: subtotal.toFixed(2), vatAmount: vat.toFixed(2), total: (subtotal + vat).toFixed(2) };
}

const listQuotes: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "quotes.read")) return err("You don't have access to quotes.", 403, "forbidden");
  const rows = await db
    .select({ q: quotes, customerName: customers.name })
    .from(quotes)
    .leftJoin(customers, eq(quotes.customerId, customers.id))
    .where(eq(quotes.businessId, ctx.businessId))
    .orderBy(desc(quotes.createdAt))
    .limit(100);
  return json({ items: rows.map((r) => ({ ...r.q, customerName: r.customerName ?? null })) });
};

const createQuote: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "quotes.write")) return err("You don't have access to quotes.", 403, "forbidden");
  if (!body?.customerId) return err("Customer is required.", 400, "invalid_input");
  const [cust] = await db.select().from(customers).where(and(eq(customers.id, body.customerId), eq(customers.businessId, ctx.businessId)));
  if (!cust) return err("Customer not found in your business.", 404);
  const items: any[] = Array.isArray(body.items) && body.items.length ? body.items : [{ name: "Service", type: "service", qty: 1, unitPrice: 0 }];
  const biz = (await getBusinessBundle(ctx.businessId))!;
  const vatPct = biz.business.vatRegistered ? num(biz.business.vatRate) : 0;
  const discount = num(body.discount);
  const totals = calcQuoteTotals(items, discount, vatPct);
  const number = await nextDocNumber(quotes, quotes.quoteNumber, ctx.businessId, biz.settings?.quotePrefix ?? "Q-");
  const validUntil = new Date(Date.now() + (biz.settings?.quoteValidDays ?? 14) * 86400000);
  const [q] = await db
    .insert(quotes)
    .values({ businessId: ctx.businessId, quoteNumber: number, customerId: cust.id, leadId: body.leadId ?? null, status: "draft", notes: body.notes ?? null, terms: body.terms ?? null, discount: discount.toFixed(2), vatRate: String(vatPct), validUntil, aiGenerated: Boolean(body.aiGenerated), ...totals })
    .returning();
  await db.insert(quoteItems).values(
    items.map((it, i) => ({ quoteId: q.id, businessId: ctx.businessId, type: it.type ?? "service", name: String(it.name).slice(0, 160), description: it.description ?? null, qty: String(num(it.qty ?? 1)), unitPrice: String(num(it.unitPrice)), amount: String(num(it.unitPrice) * num(it.qty ?? 1)), sortOrder: i }))
  );
  await audit(ctx.businessId, ctx.user.name, "Created quote", "quote", q.id, { quoteNumber: number });
  return json({ item: q, quoteNumber: number }, 201);
};

const patchQuote: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "quotes.write")) return err("You don't have access to quotes.", 403, "forbidden");
  if (!body?.id) return err("Quote id is required.", 400);
  const [q] = await db.select().from(quotes).where(and(eq(quotes.id, body.id), eq(quotes.businessId, ctx.businessId)));
  if (!q) return err("Quote not found.", 404);
  const patch: any = {};
  if (body.status) {
    patch.status = body.status;
    if (body.status === "sent" && !q.sentAt) patch.sentAt = new Date();
    if (["accepted", "rejected", "expired"].includes(body.status)) patch.respondedAt = new Date();
  }
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.terms !== undefined) patch.terms = body.terms;
  if (body.validUntil) patch.validUntil = new Date(body.validUntil);
  await db.update(quotes).set(patch).where(eq(quotes.id, q.id));
  if (body.status === "sent") {
    const cust = q.customerId ? (await db.select().from(customers).where(eq(customers.id, q.customerId)))[0] : null;
    await notify(ctx.businessId, "new_lead", `Quote ${q.quoteNumber} sent`, cust ? `Sent to ${cust.name}` : undefined);
  }
  if (body.status === "accepted") {
    await notify(ctx.businessId, "quote_accepted", `Quote ${q.quoteNumber} accepted`, `R ${num(q.total).toLocaleString("en-ZA")} — ready to schedule.`);
  }
  if (body.convertToJob) {
    const number = await nextDocNumber(jobs, jobs.jobNumber, ctx.businessId, "JOB-");
    const [j] = await db
      .insert(jobs)
      .values({ businessId: ctx.businessId, jobNumber: number, customerId: q.customerId, service: (await db.select().from(quoteItems).where(eq(quoteItems.quoteId, q.id))).find((i) => i.type === "service")?.name ?? "Job", description: q.notes ?? `From quote ${q.quoteNumber}`, date: String(body.jobDate ?? today()), startsAt: String(body.jobStart ?? "09:00"), status: "scheduled", teamMemberId: body.teamMemberId ?? null, teamMemberName: body.teamMemberName ?? null })
      .returning();
    return json({ ok: true, job: j, jobNumber: number });
  }
  return json({ ok: true });
};

const getQuote: Handler = async (_req, ctx, _q, _b, seg) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "quotes.read")) return err("You don't have access to quotes.", 403, "forbidden");
  const [q] = await db.select().from(quotes).where(and(eq(quotes.id, seg[1]), eq(quotes.businessId, ctx.businessId)));
  if (!q) return err("Quote not found.", 404);
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, q.id)).orderBy(asc(quoteItems.sortOrder));
  const cust = q.customerId ? (await db.select().from(customers).where(eq(customers.id, q.customerId)))[0] : null;
  return json({ item: { ...q, customer: cust ?? null, items } });
};

const duplicateQuote: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "quotes.write")) return err("You don't have access to quotes.", 403, "forbidden");
  const [q] = await db.select().from(quotes).where(and(eq(quotes.id, body?.id), eq(quotes.businessId, ctx.businessId)));
  if (!q) return err("Quote not found.", 404);
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, q.id)).orderBy(asc(quoteItems.sortOrder));
  const number = await nextDocNumber(quotes, quotes.quoteNumber, ctx.businessId, "Q-");
  const [copy] = await db
    .insert(quotes)
    .values({ businessId: ctx.businessId, quoteNumber: number, customerId: q.customerId, status: "draft", notes: q.notes, terms: q.terms, discount: q.discount, vatRate: q.vatRate, subtotal: q.subtotal, vatAmount: q.vatAmount, total: q.total, validUntil: new Date(Date.now() + 14 * 86400000) })
    .returning();
  await db.insert(quoteItems).values(items.map((it) => ({ quoteId: copy.id, businessId: ctx.businessId, type: it.type, name: it.name, description: it.description, qty: it.qty, unitPrice: it.unitPrice, amount: it.amount, sortOrder: it.sortOrder })));
  return json({ item: copy, quoteNumber: number }, 201);
};

/* ================================================================== */
/* INVOICES + PAYMENTS                                                 */
/* ================================================================== */

const listInvoices: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "invoices.read")) return err("You don't have access to invoices.", 403, "forbidden");
  await markOverdue(ctx.businessId);
  const rows = await db
    .select({ i: invoices, customerName: customers.name })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.businessId, ctx.businessId))
    .orderBy(desc(invoices.createdAt))
    .limit(150);
  return json({ items: rows.map((r) => ({ ...r.i, customerName: r.customerName ?? null, balance: num(r.i.total) - num(r.i.paidAmount) })) });
};

const createInvoice: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "invoices.write")) return err("You don't have access to invoices.", 403, "forbidden");
  if (!body?.customerId) return err("Customer is required.", 400, "invalid_input");
  const [cust] = await db.select().from(customers).where(and(eq(customers.id, body.customerId), eq(customers.businessId, ctx.businessId)));
  if (!cust) return err("Customer not found in your business.", 404);
  const biz = (await getBusinessBundle(ctx.businessId))!;
  const vatPct = biz.business.vatRegistered ? num(biz.business.vatRate) : 0;
  let items: any[] = Array.isArray(body.items) && body.items.length ? body.items : [{ name: "Services", qty: 1, unitPrice: num(body.amount ?? 0) }];
  let quoteId: string | null = null;
  let jobId: string | null = null;
  if (body.quoteId) {
    const [srcQ] = await db.select().from(quotes).where(and(eq(quotes.id, body.quoteId), eq(quotes.businessId, ctx.businessId)));
    if (srcQ) {
      quoteId = srcQ.id;
      jobId = body.jobId ?? null;
      const qItems = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, srcQ.id)).orderBy(asc(quoteItems.sortOrder));
      if (qItems.length) items = qItems.map((it) => ({ name: it.name, description: it.description, qty: it.qty, unitPrice: it.unitPrice }));
    }
  } else if (body.jobId) {
    const [srcJ] = await db.select().from(jobs).where(and(eq(jobs.id, body.jobId), eq(jobs.businessId, ctx.businessId)));
    if (srcJ) {
      jobId = srcJ.id;
      if (!items.length) items = [{ name: srcJ.service, qty: 1, unitPrice: 0 }];
    }
  }
  const subtotal = items.reduce((s, it) => s + num(it.unitPrice) * num(it.qty ?? 1), 0);
  const vatAmount = ((subtotal * vatPct) / 100).toFixed(2);
  const total = (subtotal + Number(vatAmount)).toFixed(2);
  const dueDays = Number(body.dueDays ?? biz.settings?.invoiceDueDays ?? 7);
  const issue = new Date(body.issueDate ?? today()).toISOString().slice(0, 10);
  const due = new Date(new Date(issue).getTime() + dueDays * 86400000).toISOString().slice(0, 10);
  const number = await nextDocNumber(invoices, invoices.invoiceNumber, ctx.businessId, biz.settings?.invoicePrefix ?? "INV-");
  const [inv] = await db
    .insert(invoices)
    .values({ businessId: ctx.businessId, invoiceNumber: number, customerId: cust.id, jobId, quoteId, status: body.status ?? "sent", issueDate: issue, dueDate: due, notes: body.notes ?? null, terms: body.terms ?? "Payment due within 7 days. EFT details in the invoice footer.", subtotal: subtotal.toFixed(2), vatRate: String(vatPct), vatAmount, total })
    .returning();
  await db.insert(invoiceItems).values(items.map((it, i) => ({ invoiceId: inv.id, businessId: ctx.businessId, name: String(it.name).slice(0, 160), description: it.description ?? null, qty: String(num(it.qty ?? 1)), unitPrice: String(num(it.unitPrice)), amount: String(num(it.unitPrice) * num(it.qty ?? 1)), sortOrder: i })));
  await audit(ctx.businessId, ctx.user.name, "Created invoice", "invoice", inv.id, { invoiceNumber: number });
  await notify(ctx.businessId, "invoice_overdue", `Invoice ${number} issued`, `R ${Number(total).toLocaleString("en-ZA")} — due ${due}`);
  return json({ item: inv, invoiceNumber: number }, 201);
};

const patchInvoice: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "invoices.write")) return err("You don't have access to invoices.", 403, "forbidden");
  if (!body?.id) return err("Invoice id is required.", 400);
  const [i] = await db.select().from(invoices).where(and(eq(invoices.id, body.id), eq(invoices.businessId, ctx.businessId)));
  if (!i) return err("Invoice not found.", 404);
  const patch: any = {};
  if (body.status) patch.status = body.status;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.dueDate) patch.dueDate = body.dueDate;
  await db.update(invoices).set(patch).where(eq(invoices.id, i.id));
  if (body.status === "cancelled") await audit(ctx.businessId, ctx.user.name, `Cancelled invoice ${i.invoiceNumber}`, "invoice", i.id);
  return json({ ok: true });
};

const getInvoice: Handler = async (_req, ctx, _q, _b, seg) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "invoices.read")) return err("You don't have access to invoices.", 403, "forbidden");
  const [i] = await db.select().from(invoices).where(and(eq(invoices.id, seg[1]), eq(invoices.businessId, ctx.businessId)));
  if (!i) return err("Invoice not found.", 404);
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, i.id)).orderBy(asc(invoiceItems.sortOrder));
  const pays = await db.select().from(payments).where(eq(payments.invoiceId, i.id)).orderBy(desc(payments.createdAt));
  const cust = i.customerId ? (await db.select().from(customers).where(eq(customers.id, i.customerId)))[0] : null;
  return json({ item: { ...i, customer: cust ?? null, items, payments: pays } });
};

const listPayments: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "payments.read")) return err("You don't have access to payments.", 403, "forbidden");
  const rows = await db.select().from(payments).where(eq(payments.businessId, ctx.businessId)).orderBy(desc(payments.createdAt)).limit(100);
  return json({ items: rows });
};

const recordPayment: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "payments.write")) return err("You don't have access to payments.", 403, "forbidden");
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, body?.invoiceId), eq(invoices.businessId, ctx.businessId)));
  if (!inv) return err("Invoice not found.", 404);
  const amount = Number(body?.amount);
  if (!isFinite(amount) || amount <= 0) return err("Enter a valid payment amount.", 400, "invalid_input");
  const method = ["yoco", "eft", "card", "cash", "other"].includes(body?.method) ? body.method : "eft";
  const provider = paymentProviders[method] ?? paymentProviders.eft;
  const reference = body?.reference ?? `${inv.invoiceNumber}-${Date.now().toString(36).toUpperCase()}`;
  const charge = await provider.charge({ amount, reference, email: inv.customerId ? undefined : undefined });
  if (!charge.ok) return err(charge.note ?? "Payment provider unavailable.", 409, "provider_unavailable");
  const paid = num(inv.paidAmount) + amount;
  const status = paid >= num(inv.total) - 0.5 ? "paid" : "partial";
  await db.insert(payments).values({ businessId: ctx.businessId, invoiceId: inv.id, customerId: inv.customerId, amount: String(amount.toFixed(2)), method, reference, status: "completed", providerMeta: JSON.stringify({ provider: provider.name, note: charge.note ?? null }) });
  await db.update(invoices).set({ paidAmount: String(paid.toFixed(2)), status }).where(eq(invoices.id, inv.id));
  await audit(ctx.businessId, ctx.user.name, "Recorded payment", "payment", inv.id, { amount, method, reference });
  await notify(ctx.businessId, "payment", "Payment received", `R ${amount.toLocaleString("en-ZA")} on ${inv.invoiceNumber} (${method.toUpperCase()})`);
  return json({ ok: true, status, reference }, 201);
};

/* ================================================================== */
/* NOTIFICATIONS + KNOWLEDGE + SUBSCRIPTION                            */
/* ================================================================== */

const listNotifications: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.businessId, ctx.businessId), or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId))))
    .orderBy(desc(notifications.createdAt))
    .limit(40);
  return json({ items: rows });
};

const markNotifications: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (body?.readAll) {
    await db.update(notifications).set({ read: true }).where(and(eq(notifications.businessId, ctx.businessId), eq(notifications.read, false), or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId))));
  } else if (body?.id) {
    await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, body.id), eq(notifications.businessId, ctx.businessId)));
  }
  return json({ ok: true });
};

const listKnowledge: Handler = async (_req, ctx, q) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "knowledge.read")) return err("You don't have access to the knowledge base.", 403, "forbidden");
  const search = q.get("q") ?? "";
  const conds: any[] = [eq(knowledgeDocuments.businessId, ctx.businessId)];
  if (search) conds.push(or(ilike(knowledgeDocuments.name, `%${search}%`), sql`${knowledgeDocuments.content} ilike ${"%" + search + "%"}`));
  const rows = await db.select().from(knowledgeDocuments).where(and(...conds)).orderBy(desc(knowledgeDocuments.createdAt));
  return json({ items: rows.map((r) => ({ ...r, content: r.content ? r.content.slice(0, 200) : null })) });
};

const saveKnowledge: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "knowledge.write")) return err("You don't have access to the knowledge base.", 403, "forbidden");
  if (!body?.name) return err("Document name is required.", 400, "invalid_input");
  const content = String(body.content ?? "").slice(0, 20000);
  const chunks = content ? content.match(/.{1,500}([^.!\n]+[.!\n])?/g)?.length ?? 1 : 0;
  const [doc] = await db
    .insert(knowledgeDocuments)
    .values({ businessId: ctx.businessId, name: String(body.name).slice(0, 160), type: body.type ?? "document", size: content.length, status: "ready", content: content || null, chunks })
    .returning();
  if (content) {
    const parts = content.match(/.{1,500}([^.!\n]+[.!\n])?/g) ?? [content];
    await db.insert(knowledgeChunks).values(parts.map((p, i) => ({ businessId: ctx.businessId, documentId: doc.id, chunkIndex: i, content: p.slice(0, 900) })));
  }
  return json({ item: doc }, 201);
};

const deleteKnowledge: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "knowledge.write")) return err("You don't have access to the knowledge base.", 403, "forbidden");
  await db.delete(knowledgeDocuments).where(and(eq(knowledgeDocuments.id, body?.id), eq(knowledgeDocuments.businessId, ctx.businessId)));
  return json({ ok: true });
};

const PLAN_PRICES: Record<string, number> = { starter: 299, business: 699, pro: 1499 };

const getSubscription: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  const bundle = await getBusinessBundle(ctx.businessId);
  if (!bundle) return err("Business not found.", 404);
  const trialDays = bundle.subscription?.trialEndsAt ? Math.max(0, Math.ceil((new Date(bundle.subscription.trialEndsAt).getTime() - Date.now()) / 86400000)) : 0;
  return json({ ...bundle, trialDays });
};

const upgradeSubscription: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "settings.write")) return err("Only the owner or an admin can change the plan.", 403, "forbidden");
  const plan = body?.plan;
  if (!PLAN_PRICES[plan]) return err("Unknown plan. Choose Starter, Business or Pro.", 400, "invalid_plan");
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, ctx.businessId));
  if (!sub) return err("Subscription not found.", 404);
  const periodEnd = new Date(Date.now() + 30 * 86400000);
  await db
    .update(subscriptions)
    .set({ plan, status: "active", currentPeriodEnd: periodEnd, trialEndsAt: null })
    .where(eq(subscriptions.id, sub.id));
  await db.insert(subscriptionEvents).values({ subscriptionId: sub.id, businessId: ctx.businessId, type: sub.status === "trialing" ? "subscribed" : "upgraded", meta: JSON.stringify({ plan, price: PLAN_PRICES[plan], currency: "ZAR", checkout: "yoco_stub" }) });
  await notify(ctx.businessId, "briefing", `Plan changed to ${plan}`, `R ${PLAN_PRICES[plan].toLocaleString("en-ZA")}/month — charged via Yoco when enabled.`);
  return json({ ok: true, note: "Yoco checkout is stubbed until credentials are configured — plan updated for now." });
};

/* ================================================================== */
/* AI + ANALYTICS + SEARCH + ADMIN + DEMO                              */
/* ================================================================== */

const aiBriefing: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  return json(await computeBriefing(ctx.businessId));
};

const aiHistory: Handler = async (_req, ctx, q) => {
  if (!ctx) return err("Not authenticated.", 401);
  const convId = q.get("convId");
  const conds: any[] = [eq(aiConversations.businessId, ctx.businessId)];
  if (convId) {
    const [msgs] = [await db.select().from(aiMessages).where(and(eq(aiMessages.aiConversationId, convId), eq(aiMessages.businessId, ctx.businessId))).orderBy(asc(aiMessages.createdAt)).limit(200)];
    return json({ messages: msgs.map((m) => ({ id: m.id, role: m.role, content: m.content, data: safeParse(m.data), createdAt: m.createdAt })) });
  }
  const convs = await db.select().from(aiConversations).where(and(...conds, eq(aiConversations.userId, ctx.user.id))).orderBy(desc(aiConversations.updatedAt)).limit(15);
  return json({ items: convs });
};

function safeParse(s: string | null): any {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

const aiConfirm: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!body?.actionId) return err("Action id is required.", 400);
  const res = await executeAction(ctx.businessId, body.actionId, Boolean(body.approve), ctx.user.id);
  return json(res);
};

const aiActivity: Handler = async (_req, ctx, _q) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "analytics.read") && !can(ctx.role, "settings.write")) return err("You don't have access to the AI activity log.", 403, "forbidden");
  const rows = await db.select().from(aiActions).where(eq(aiActions.businessId, ctx.businessId)).orderBy(desc(aiActions.createdAt)).limit(50);
  return json({ items: rows });
};

const analytics: Handler = async (_req, ctx) => {
  if (!ctx) return err("Not authenticated.", 401);
  if (!can(ctx.role, "analytics.read")) return err("You don't have access to analytics.", 403, "forbidden");
  const now = new Date();
  const kpis = await computeKpis(ctx.businessId);
  const revenue14 = await revenueSeries(ctx.businessId, 14);
  const monthly: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const v = await (async () => {
      const rows: any[] = await db.select({ total: sql<number>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(eq(payments.businessId, ctx.businessId), eq(payments.status, "completed"), gte(payments.createdAt, m), lt(payments.createdAt, mEnd)));
      return Math.round(num(rows[0]?.total));
    })();
    monthly.push({ label: m.toLocaleDateString("en-ZA", { month: "short" }), value: v });
  }
  const [byService, leadsSrc, techs, acceptance, insights] = await Promise.all([
    revenueByService(ctx.businessId, 30),
    leadsBySource(ctx.businessId),
    techPerformance(ctx.businessId, 30),
    quoteAcceptance(ctx.businessId),
    computeInsights(ctx.businessId),
  ]);
  const invRows: any[] = await db
    .select({ total: invoices.total, job: invoices.jobId, issued: invoices.issueDate, paid: invoices.paidAmount, paidAt: payments.createdAt })
    .from(invoices)
    .leftJoin(payments, and(eq(payments.invoiceId, invoices.id), eq(payments.status, "completed")))
    .where(and(eq(invoices.businessId, ctx.businessId), eq(invoices.status, "paid")));
  const withJob = invRows.filter((r) => r.job && num(r.total) > 0);
  const avgJobValue = withJob.length ? Math.round(withJob.reduce((s, r) => s + num(r.total), 0) / withJob.length) : 0;
  const timed = invRows.filter((r) => r.paidAt);
  const avgPaymentDays = timed.length ? Math.round(timed.reduce((s, r) => s + (new Date(r.paidAt).getTime() - new Date(r.issued).getTime()) / 86400000, 0) / timed.length) : 0;
  const [allLeads] = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.businessId, ctx.businessId));
  return json({ kpis, revenue14, monthly, byService, leadsBySource: leadsSrc, techs, acceptance, insights, avgJobValue, avgPaymentDays, totalLeads: allLeads.n });
};

const search: Handler = async (_req, ctx, q) => {
  if (!ctx) return err("Not authenticated.", 401);
  const query = (q.get("q") ?? "").trim();
  if (query.length < 2) return json({ results: { customers: [], leads: [], jobs: [], quotes: [], invoices: [], team: [] } });
  const like = `%${query}%`;
  const [cs, ls, js, qs, is, ts] = await Promise.all([
    db.select().from(customers).where(and(eq(customers.businessId, ctx.businessId), or(ilike(customers.name, like), ilike(customers.phone, like)))).limit(5),
    db.select().from(leads).where(and(eq(leads.businessId, ctx.businessId), or(ilike(leads.name, like), ilike(leads.service, like)))).limit(5),
    db.select().from(jobs).where(and(eq(jobs.businessId, ctx.businessId), or(ilike(jobs.jobNumber, like), ilike(jobs.service, like), ilike(jobs.suburb, like)))).limit(5),
    db.select().from(quotes).where(and(eq(quotes.businessId, ctx.businessId), ilike(quotes.quoteNumber, like))).limit(5),
    db.select().from(invoices).where(and(eq(invoices.businessId, ctx.businessId), ilike(invoices.invoiceNumber, like))).limit(5),
    db.select().from(teamMembers).where(and(eq(teamMembers.businessId, ctx.businessId), ilike(teamMembers.name, like))).limit(5),
  ]);
  return json({
    results: {
      customers: cs,
      leads: ls,
      jobs: js,
      quotes: qs,
      invoices: is,
      team: ts,
    },
  });
};

const adminOverview: Handler = async (_req, ctx) => {
  if (!ctx || !ctx.user.isPlatformAdmin) return err("Platform administrators only.", 403, "forbidden");
  const [bizCount, userCount, mrrRows, trialCount, usageRows, recentBiz] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(businesses),
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db.select({ plan: subscriptions.plan, n: sql<number>`count(*)::int` }).from(subscriptions).where(eq(subscriptions.status, "active")).groupBy(subscriptions.plan),
    db.select({ n: sql<number>`count(*)::int` }).from(subscriptions).where(eq(subscriptions.status, "trialing")),
    db.select({ businessId: aiUsage.businessId, requests: sql<number>`coalesce(sum(${aiUsage.requests}),0)::int` }).from(aiUsage).where(gte(aiUsage.date, new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))).groupBy(aiUsage.businessId).limit(20),
    db.select().from(businesses).orderBy(desc(businesses.createdAt)).limit(10),
  ]);
  const mrr = mrrRows.reduce((s, r) => s + (PLAN_PRICES[r.plan] ?? 0) * r.n, 0);
  return json({
    businesses: bizCount[0]?.n ?? 0,
    users: userCount[0]?.n ?? 0,
    mrr,
    plans: mrrRows,
    trials: trialCount[0]?.n ?? 0,
    aiUsage: usageRows,
    recentBusinesses: recentBiz,
    health: { database: "ok", version: "1.0.0" },
  });
};

const demo: Handler = async (_req, _ctx, _q) => {
  const ip = _req.headers.get("x-forwarded-for") ?? "demo";
  if (!rateLimit(`demo:${ip}`, 10, 60000)) return err("Too many attempts. Try again shortly.", 429, "rate_limited");
  const res = await ensureDemo();
  if (!res) return err("Could not set up the demo. Please try again.", 500);
  await createSession(res.userId, _req.headers.get("user-agent") ?? undefined);
  return json({ ok: true, email: res.email, businessId: res.businessId });
};

/* ================================================================== */
/* ROUTE REGISTRY                                                      */
/* ================================================================== */

function isNull(col: any) {
  return sql`${col} is null`;
}

const chatStream: Handler = async (_req, ctx, _q, body) => {
  if (!ctx) return err("Not authenticated.", 401);
  const message = String(body?.message ?? "").trim();
  if (!message || message.length > 2000) return err("Enter a message for BizPilot AI.", 400, "invalid_input");
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: any) => controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      try {
        await handleChat(ctx!.businessId, ctx!.user.id, body?.conversationId ?? null, message, send);
      } catch (e: any) {
        send({ t: "error", text: e?.message ?? "Something went wrong." });
        send({ t: "done" });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
};

export interface RouteDef {
  public?: boolean;
  cap?: string;
  fn: Handler;
}

export const routes: Record<string, RouteDef> = {
  "POST auth/login": { public: true, fn: authPublic },
  "POST auth/register": { public: true, fn: register },
  "POST auth/logout": { fn: logout },
  "GET auth/me": { public: true, fn: me },
  "POST demo": { public: true, fn: demo },

  "GET business": { cap: "dashboard", fn: getBusiness },
  "PUT business": { cap: "settings.write", fn: putBusiness },
  "PUT business/settings": { cap: "settings.write", fn: putSettings },
  "PUT business/hours": { cap: "settings.write", fn: putHours },
  "PUT business/agents": { cap: "settings.write", fn: toggleAgent },
  "POST business/integrations": { cap: "settings.write", fn: connectIntegration },
  "POST onboarding": { cap: "dashboard", fn: onboarding },

  "GET customers": { cap: "customers.read", fn: listCustomers },
  "POST customers": { cap: "customers.write", fn: createCustomer },
  "PATCH customers": { cap: "customers.write", fn: patchCustomer },
  "DELETE customers": { cap: "customers.write", fn: deleteCustomer },
  "GET customers/:id": { cap: "customers.read", fn: getCustomer },

  "GET leads": { cap: "leads.read", fn: listLeads },
  "POST leads": { cap: "leads.write", fn: createLead },
  "PATCH leads": { cap: "leads.write", fn: patchLead },
  "GET leads/:id": { cap: "leads.read", fn: getLead },
  "POST leads/convert": { cap: "quotes.write", fn: convertLead },

  "GET conversations": { cap: "inbox.read", fn: listConversations },
  "POST conversations": { cap: "inbox.write", fn: createConversation },
  "PATCH conversations": { cap: "inbox.write", fn: patchConversation },
  "GET conversations/:id": { cap: "inbox.read", fn: getConversation },
  "POST messages": { cap: "inbox.write", fn: sendMessage },

  "GET services": { cap: "dashboard", fn: listServices },
  "POST services": { cap: "settings.write", fn: saveService },
  "PATCH services": { cap: "settings.write", fn: saveService },
  "DELETE services": { cap: "settings.write", fn: deleteService },

  "GET team": { cap: "team.read", fn: listTeam },
  "POST team": { cap: "team.write", fn: saveTeamMember },
  "PATCH team": { cap: "team.write", fn: saveTeamMember },
  "DELETE team": { cap: "team.write", fn: deleteTeamMember },
  "GET team/availability": { cap: "jobs.write", fn: teamAvailability },

  "GET jobs": { cap: "jobs.read", fn: listJobs },
  "POST jobs": { cap: "jobs.write", fn: createJob },
  "PATCH jobs": { cap: "jobs.write", fn: patchJob },
  "GET jobs/:id": { cap: "jobs.read", fn: getJob },
  "POST jobs/photos": { cap: "jobs.write", fn: addJobPhoto },

  "GET quotes": { cap: "quotes.read", fn: listQuotes },
  "POST quotes": { cap: "quotes.write", fn: createQuote },
  "PATCH quotes": { cap: "quotes.write", fn: patchQuote },
  "GET quotes/:id": { cap: "quotes.read", fn: getQuote },
  "POST quotes/duplicate": { cap: "quotes.write", fn: duplicateQuote },

  "GET invoices": { cap: "invoices.read", fn: listInvoices },
  "POST invoices": { cap: "invoices.write", fn: createInvoice },
  "PATCH invoices": { cap: "invoices.write", fn: patchInvoice },
  "GET invoices/:id": { cap: "invoices.read", fn: getInvoice },

  "GET payments": { cap: "payments.read", fn: listPayments },
  "POST payments": { cap: "payments.write", fn: recordPayment },

  "GET notifications": { fn: listNotifications },
  "PATCH notifications": { fn: markNotifications },

  "GET knowledge": { cap: "knowledge.read", fn: listKnowledge },
  "POST knowledge": { cap: "knowledge.write", fn: saveKnowledge },
  "DELETE knowledge": { cap: "knowledge.write", fn: deleteKnowledge },

  "GET subscription": { cap: "dashboard", fn: getSubscription },
  "POST subscription/upgrade": { cap: "settings.write", fn: upgradeSubscription },

  "GET ai/briefing": { fn: aiBriefing },
  "POST ai/confirm": { fn: aiConfirm },
  "GET ai/history": { fn: aiHistory },
  "GET ai/activity": { cap: "analytics.read", fn: aiActivity },
  "POST ai/chat": { fn: chatStream },

  "GET analytics": { cap: "analytics.read", fn: analytics },
  "GET search": { fn: search },
  "GET admin/overview": { fn: adminOverview },
};
