import "server-only";
import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import {
  users,
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
  jobs,
  quotes,
  quoteItems,
  invoices,
  invoiceItems,
  payments,
  reviews,
  notifications,
  aiAgents,
  aiActions,
  knowledgeDocuments,
  knowledgeChunks,
  integrations,
  auditLogs,
} from "@/db/schema";
import { hashPassword, createBusinessWithDefaults } from "./core";

const D = (offsetDays: number, hour = 9, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, min, 0, 0);
  return d;
};
const DISO = (offsetDays: number) => D(offsetDays).toISOString().slice(0, 10);

export async function ensureDemo(): Promise<{ userId: string; email: string; businessId: string } | null> {
  const email = "demo@bizpilot.co.za";
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length) {
    const [m] = await db.select().from(businessMembers).where(eq(businessMembers.userId, existing[0].id));
    return m ? { userId: existing[0].id, email, businessId: m.businessId } : null;
  }

  /* users */
  const [owner] = await db
    .insert(users)
    .values({ name: "Thando Mokoena", email, passwordHash: hashPassword("demo1234"), phone: "+27 82 555 0134" })
    .returning();
  await db.insert(users).values({ name: "BizPilot Admin", email: "admin@bizpilot.co.za", passwordHash: hashPassword("admin1234"), isPlatformAdmin: true });

  /* business */
  const [biz] = await db
    .insert(businesses)
    .values({
      name: "Thando Plumbing & Electrical",
      type: "Plumbing",
      ownerName: "Thando Mokoena",
      phone: "+27 21 555 0134",
      email: "office@thandoplumbing.co.za",
      whatsapp: "+27 82 555 0134",
      province: "Western Cape",
      city: "Cape Town",
      serviceArea: "Cape Town northern & southern suburbs, Paarl",
      description: "Family-run plumbing and electrical business serving the Cape Town area since 2016. Geysers, drains, bathrooms and full electrical work.",
      onboardedAt: D(-21),
    })
    .returning();
  await db.insert(businessMembers).values({ businessId: biz.id, userId: owner.id, role: "owner" });
  const [sub] = await db
    .insert(subscriptions)
    .values({ businessId: biz.id, plan: "business", status: "trialing", trialEndsAt: D(9) })
    .returning();
  await db.insert(subscriptionEvents).values({ subscriptionId: sub.id, businessId: biz.id, type: "trial_started", meta: JSON.stringify({ plan: "business", days: 14 }) });
  await createBusinessWithDefaults(biz.id);
  await db.update(businessSettings).set({ businessRules: ["Never offer discounts above 10%.", "Emergency jobs carry a 30% surcharge.", "Always ask for a photo before quoting a geyser repair.", "Weekend availability is 08:00–13:00 only."] }).where(eq(businessSettings.businessId, biz.id));
  await db.insert(integrations).values([
    { businessId: biz.id, provider: "whatsapp", status: "pending", label: "WhatsApp Business" },
    { businessId: biz.id, provider: "yoco", status: "disconnected", label: "Yoco payments" },
    { businessId: biz.id, provider: "email", status: "pending", label: "Email notifications" },
  ]);

  /* services */
  const svcDefs: [string, string, number | null, string, number, boolean][] = [
    ["Leak repair", "Locate and fix domestic water leaks.", 850, "starting_from", 60, false],
    ["Geyser repair", "Element, thermostat and body repairs on all geyser brands.", 1450, "fixed", 90, true],
    ["Geyser replacement & installation", "Full geyser replacement incl. new unit, installation and commissioning.", 4850, "fixed", 240, true],
    ["Drain cleaning", "High-pressure jetting of blocked drains and pipelines.", 1200, "fixed", 120, false],
    ["Toilet repair", "Cisterns, valves, blocking and full toilet replacements.", 950, "fixed", 90, false],
    ["Burst pipe", "Emergency burst pipe isolation and repair.", 1850, "fixed", 120, true],
    ["Bathroom installation", "Full bathroom installs — plumbing and tiling coordination.", 18500, "custom", 480, false],
    ["Electrical fault-finding", "DB board inspection, tripping and fault-finding.", 980, "fixed", 60, false],
    ["Solar system installation", "Design and install of residential solar + battery systems.", 27500, "custom", 240, false],
  ];
  const svc: Record<string, string> = {};
  for (const [name, desc, price, pt, dur, em] of svcDefs) {
    const [s] = await db
      .insert(services)
      .values({ businessId: biz.id, name, description: desc, category: /electric|solar/i.test(name) ? "electrical" : "plumbing", basePrice: price != null ? String(price) : null, pricingType: pt, durationMinutes: dur, isEmergency: em })
      .returning();
    svc[name] = s.id;
  }

  /* team */
  const [thabo] = await db.insert(teamMembers).values({ businessId: biz.id, name: "Thabo Nkosi", role: "Plumber", phone: "+27 83 555 0171", skills: ["geysers", "drains", "pipework"], serviceAreas: ["Northern Suburbs", "Central"], workingHours: "Mon–Fri 07:30–17:00, Sat 08:00–13:00" }).returning();
  const [sipho] = await db.insert(teamMembers).values({ businessId: biz.id, name: "Sipho Dlamini", role: "Electrician", phone: "+27 84 555 0122", skills: ["DB boards", "fault-finding", "solar"], serviceAreas: ["Southern Suburbs", "Central"], workingHours: "Mon–Fri 07:30–17:00" }).returning();
  const [anele] = await db.insert(teamMembers).values({ businessId: biz.id, name: "Anele Mthembu", role: "Plumber / Handyman", phone: "+27 81 555 0198", skills: ["toilets", "leaks", "handyman"], serviceAreas: ["Northern Suburbs", "Paarl"], workingHours: "Mon–Sat 07:30–16:00" }).returning();

  /* customers */
  const custDefs: [string, string, string, string][] = [
    ["Sarah van Wyk", "+27 82 555 0111", "12 Regent Road", "Sea Point"],
    ["Pieter Botha", "+27 83 555 0123", "48 Tokai Main Road", "Tokai"],
    ["Naledi Khumalo", "+27 84 555 0145", "75 Bredasdorp Road", "Bellville"],
    ["Johan de Villiers", "+27 82 555 0167", "18 Rynfield Street", "Paarl"],
    ["Lerato Molefe", "+27 81 555 0189", "9 Regent Road", "Sea Point"],
    ["Zanele Dube", "+27 83 555 0156", "22 Main Road", "Milnerton"],
    ["Ayesha Patel", "+27 84 555 0134", "5 V&A Road", "V&A Waterfront"],
    ["Mike Dlamini", "+27 82 555 0178", "40 Kuils River Main", "Kuils River"],
  ];
  const cust: Record<string, string> = {};
  for (const [name, phone, address, suburb] of custDefs) {
    const [c] = await db
      .insert(customers)
      .values({ businessId: biz.id, name, phone, whatsapp: phone, address, suburb, city: suburb === "Paarl" ? "Paarl" : "Cape Town", province: "Western Cape", status: "customer", source: ["whatsapp", "google", "referral", "facebook"][Object.keys(cust).length % 4], tags: ["repeat"].filter((t) => Object.keys(cust).length < 4) })
      .returning();
    cust[name] = c.id;
  }

  /* leads */
  const leadDefs: { name: string; service: string; suburb: string; status: string; score: number; value: number; urgency: string; source: string; age: number; cust?: string; followIn?: number }[] = [
    { name: "Sarah van Wyk", service: "Geyser replacement & installation", suburb: "Sea Point", status: "booked", score: 92, value: 4850, urgency: "emergency", source: "whatsapp", age: -2, cust: "Sarah van Wyk" },
    { name: "Zanele Dube", service: "Leak repair", suburb: "Milnerton", status: "new", score: 74, value: 850, urgency: "high", source: "whatsapp", age: 0 },
    { name: "James Naidoo", service: "Drain cleaning", suburb: "Montague Gardens", status: "quote_sent", score: 68, value: 1200, urgency: "normal", source: "website", age: -3 },
    { name: "Lerato Molefe", service: "Electrical fault-finding", suburb: "Sea Point", status: "negotiating", score: 71, value: 980, urgency: "normal", source: "phone", age: -4, cust: "Lerato Molefe", followIn: -1 },
    { name: "Dipuo Radebe", service: "Bathroom installation", suburb: "Table View", status: "qualified", score: 83, value: 18500, urgency: "low", source: "referral", age: -5, followIn: -1 },
    { name: "Fanie Pretorius", service: "Solar system installation", suburb: "Kuils River", status: "quote_sent", score: 77, value: 27500, urgency: "low", source: "google", age: -6, followIn: -2 },
    { name: "Sarah van Wyk", service: "Geyser repair", suburb: "Sea Point", status: "won", score: 90, value: 1450, urgency: "emergency", source: "whatsapp", age: -12, cust: "Sarah van Wyk" },
    { name: "Johan de Villiers", service: "Burst pipe", suburb: "Paarl", status: "won", score: 88, value: 1850, urgency: "emergency", source: "phone", age: -9, cust: "Johan de Villiers" },
    { name: "Naledi Khumalo", service: "Drain cleaning", suburb: "Bellville", status: "lost", score: 41, value: 1200, urgency: "normal", source: "facebook", age: -15, cust: "Naledi Khumalo" },
  ];
  const leadIds: string[] = [];
  for (const l of leadDefs) {
    const [row] = await db
      .insert(leads)
      .values({
        businessId: biz.id,
        customerId: l.cust ? cust[l.cust] : null,
        name: l.name,
        phone: l.cust ? custDefs.find((c) => c[0] === l.cust)?.[1] : "+27 82 555 0100",
        source: l.source,
        service: l.service,
        suburb: l.suburb,
        urgency: l.urgency,
        budget: String(l.value),
        status: l.status,
        value: String(l.value),
        score: l.score,
        scoreReason: l.score >= 85 ? "High intent. Emergency or time-critical. Address and booking request provided." : l.score >= 70 ? "Strong intent. Service and location confirmed, awaiting scheduling." : "Standard enquiry. Needs qualification on scope and timing.",
        nextFollowUpAt: l.followIn != null ? D(l.followIn) : null,
        position: leadIds.length + 1,
        createdAt: D(l.age, 10),
        closedAt: ["won", "lost", "booked"].includes(l.status) ? D(l.age + 1) : null,
      })
      .returning();
    leadIds.push(row.id);
    await db.insert(leadActivities).values({ businessId: biz.id, leadId: row.id, type: "ai_scored", note: `AI score ${l.score}`, actor: "AI Receptionist", createdAt: D(l.age, 10, 5) });
  }

  /* conversations */
  const [convSarah] = await db.insert(conversations).values({ businessId: biz.id, customerId: cust["Sarah van Wyk"], leadId: leadIds[0], channel: "whatsapp", subject: "Geyser replacement", mode: "ai", aiStatus: "active", leadScore: 92, service: "Geyser replacement & installation", location: "Sea Point", recommendedAction: "Book technician — customer confirmed", unread: false }).returning();
  await db.insert(messages).values([
    { businessId: biz.id, conversationId: convSarah.id, customerId: cust["Sarah van Wyk"], direction: "in", author: "customer", body: "Hi, my geyser is leaking and the hot water is gone 😬", channel: "whatsapp", createdAt: D(-2, 9, 12) },
    { businessId: biz.id, conversationId: convSarah.id, customerId: cust["Sarah van Wyk"], direction: "out", author: "bizpilot_ai", body: "Hi Sarah 👋 I'm so sorry about the geyser — that's stressful. To get you sorted fast, could you send me: 1. Your suburb 2. A photo of the geyser 3. Whether water is currently leaking heavily. I'll arrange the next available technician.", channel: "whatsapp", createdAt: D(-2, 9, 13) },
    { businessId: biz.id, conversationId: convSarah.id, customerId: cust["Sarah van Wyk"], direction: "in", author: "customer", body: "It's in Sea Point. Water is just dripping for now. I'll send a photo tonight.", channel: "whatsapp", createdAt: D(-2, 9, 20) },
    { businessId: biz.id, conversationId: convSarah.id, customerId: cust["Sarah van Wyk"], direction: "out", author: "bizpilot_ai", body: "Thanks Sarah — Sea Point noted. Once I have the photo I can confirm a geyser replacement quote. Thabo has a slot tomorrow morning at 09:00 — shall I lock that in?", channel: "whatsapp", createdAt: D(-2, 9, 21) },
  ]);
  await db.update(conversations).set({ lastMessagePreview: "Thanks Sarah — Sea Point noted…", lastMessageAt: D(-2, 9, 21) }).where(eq(conversations.id, convSarah.id));

  const [convPieter] = await db.insert(conversations).values({ businessId: biz.id, customerId: cust["Pieter Botha"], channel: "whatsapp", subject: "Electrical fault", mode: "human", aiStatus: "escalated", escalationReason: "Customer is upset about service + refund request", leadScore: 88, service: "Electrical fault-finding", location: "Tokai", recommendedAction: "Owner to reply personally — escalated by AI", unread: true }).returning();
  await db.insert(messages).values([
    { businessId: biz.id, conversationId: convPieter.id, customerId: cust["Pieter Botha"], direction: "in", author: "customer", body: "This is unacceptable. The DB board keeps tripping and last time you said it was fixed. I want a refund.", channel: "whatsapp", createdAt: D(0, 8, 40) },
    { businessId: biz.id, conversationId: convPieter.id, customerId: cust["Pieter Botha"], direction: "out", author: "bizpilot_ai", body: "I'm really sorry to hear that, Pieter. I've flagged this to the owner of the business and they'll respond personally, as soon as possible.", channel: "whatsapp", createdAt: D(0, 8, 41) },
  ]);
  await db.update(conversations).set({ lastMessagePreview: "This is unacceptable. The DB board…", lastMessageAt: D(0, 8, 40) }).where(eq(conversations.id, convPieter.id));

  const [convZanele] = await db.insert(conversations).values({ businessId: biz.id, customerId: cust["Zanele Dube"], channel: "whatsapp", subject: "Water leak", mode: "ai", aiStatus: "active", leadScore: 74, service: "Leak repair", location: "Milnerton", recommendedAction: "Monitor — AI handling", unread: true }).returning();
  await db.insert(messages).values([
    { businessId: biz.id, conversationId: convZanele.id, customerId: cust["Zanele Dube"], direction: "in", author: "customer", body: "Good afternoon, there's a small leak under my kitchen sink and it's getting worse. When can someone come?", channel: "whatsapp", createdAt: D(0, 6, 15) },
    { businessId: biz.id, conversationId: convZanele.id, customerId: cust["Zanele Dube"], direction: "out", author: "bizpilot_ai", body: "Good afternoon Zanele 👋 A kitchen sink leak is a common one — we can usually fix it on the first visit. For Milnerton, Anele has a slot today at 14:30. Shall I book that in?", channel: "whatsapp", createdAt: D(0, 6, 16) },
  ]);
  await db.update(conversations).set({ lastMessagePreview: "Good afternoon Zanele 👋 A kitchen…", lastMessageAt: D(0, 6, 16) }).where(eq(conversations.id, convZanele.id));

  const [convJohan] = await db.insert(conversations).values({ businessId: biz.id, customerId: cust["Johan de Villiers"], channel: "phone", subject: "Burst pipe follow-up", mode: "human", aiStatus: "resolved", leadScore: 0, service: "Burst pipe", location: "Paarl", recommendedAction: null, unread: false }).returning();
  await db.insert(messages).values([
    { businessId: biz.id, conversationId: convJohan.id, customerId: cust["Johan de Villiers"], direction: "out", author: "Thando Mokoena", body: "Johan, the burst pipe is fixed and the pressure tested fine. Invoicing for R1 850 + VAT as discussed. — Thando", channel: "phone", createdAt: D(-8, 15, 30) },
  ]);
  await db.update(conversations).set({ lastMessagePreview: "Johan, the burst pipe is fixed…", lastMessageAt: D(-8, 15, 30) }).where(eq(conversations.id, convJohan.id));

  /* jobs */
  const jobDefs: { service: string; cust: string | null; date: number; start: string; tech: string | null; techName: string | null; status: string; priority: string; desc: string }[] = [
    { service: "Geyser replacement & installation", cust: "Sarah van Wyk", date: 0, start: "09:00", tech: thabo.id, techName: "Thabo Nkosi", status: "scheduled", priority: "emergency", desc: "Replace leaking geyser. Customer to confirm photo. New unit: Rheem 150L." },
    { service: "Leak repair", cust: "Zanele Dube", date: 0, start: "11:00", tech: anele.id, techName: "Anele Mthembu", status: "scheduled", priority: "high", desc: "Kitchen sink leak, getting worse. Bring washer kit." },
    { service: "Electrical fault-finding", cust: "Lerato Molefe", date: 0, start: "13:00", tech: sipho.id, techName: "Sipho Dlamini", status: "confirmed", priority: "normal", desc: "DB board tripping, re-circuit inspection." },
    { service: "Toilet repair", cust: "Mike Dlamini", date: 0, start: "14:00", tech: sipho.id, techName: "Sipho Dlamini", status: "scheduled", priority: "normal", desc: "Cistern refit — note: close to previous job (schedule tight)." },
    { service: "Drain cleaning", cust: "Naledi Khumalo", date: 0, start: "15:30", tech: anele.id, techName: "Anele Mthembu", status: "scheduled", priority: "normal", desc: "Jet main drain line, Bellville." },
    { service: "Burst pipe", cust: "Johan de Villiers", date: 0, start: "08:00", tech: thabo.id, techName: "Thabo Nkosi", status: "en_route", priority: "emergency", desc: "Isolate and repair burst supply line." },
    { service: "Geyser repair", cust: "Sarah van Wyk", date: -10, start: "09:00", tech: thabo.id, techName: "Thabo Nkosi", status: "completed", priority: "emergency", desc: "Element replacement." },
    { service: "Burst pipe", cust: "Johan de Villiers", date: -9, start: "10:00", tech: thabo.id, techName: "Thabo Nkosi", status: "completed", priority: "emergency", desc: "Full supply line replacement." },
    { service: "Drain cleaning", cust: "Naledi Khumalo", date: -6, start: "14:00", tech: anele.id, techName: "Anele Mthembu", status: "completed", priority: "normal", desc: "Jet main line Bellville." },
    { service: "Electrical fault-finding", cust: "Pieter Botha", date: -5, start: "11:00", tech: sipho.id, techName: "Sipho Dlamini", status: "completed", priority: "normal", desc: "DB board inspection — fault persists, follow-up needed." },
    { service: "Leak repair", cust: "Lerato Molefe", date: -3, start: "13:00", tech: anele.id, techName: "Anele Mthembu", status: "completed", priority: "normal", desc: "Washer replacement under basin." },
    { service: "Toilet repair", cust: "Ayesha Patel", date: -2, start: "10:00", tech: anele.id, techName: "Anele Mthembu", status: "completed", priority: "normal", desc: "Cistern valve replacement." },
    { service: "Drain cleaning", cust: null, date: 1, start: "09:30", tech: anele.id, techName: "Anele Mthembu", status: "scheduled", priority: "normal", desc: "Quarterly maintenance, Table View commercial." },
    { service: "Geyser repair", cust: "Mike Dlamini", date: 2, start: "10:00", tech: thabo.id, techName: "Thabo Nkosi", status: "scheduled", priority: "normal", desc: "No hot water — likely element." },
  ];
  const jobIds: string[] = [];
  for (let i = 0; i < jobDefs.length; i++) {
    const jd = jobDefs[i];
    const [j] = await db
      .insert(jobs)
      .values({
        businessId: biz.id,
        jobNumber: `JOB-${1001 + i}`,
        customerId: jd.cust ? cust[jd.cust] : null,
        service: jd.service,
        description: jd.desc,
        suburb: jd.cust ? custDefs.find((c) => c[0] === jd.cust)?.[3] : null,
        teamMemberId: jd.tech,
        teamMemberName: jd.techName,
        date: DISO(jd.date),
        startsAt: jd.start,
        status: jd.status,
        priority: jd.priority,
        createdAt: D(jd.date, 8),
      })
      .returning();
    jobIds.push(j.id);
  }

  /* quotes */
  const mkQuote = async (no: string, custName: string | null, status: string, items: [string, number][], age: number, aiGen = false) => {
    const subtotal = items.reduce((s, [, p]) => s + p, 0);
    const vat = (subtotal * 0.15).toFixed(2);
    const total = (subtotal + Number(vat)).toFixed(2);
    const [q] = await db
      .insert(quotes)
      .values({ businessId: biz.id, quoteNumber: no, customerId: custName ? cust[custName] : null, status, subtotal: String(subtotal), vatRate: "15.00", vatAmount: vat, total, aiGenerated: aiGen, sentAt: status !== "draft" ? D(age, 12) : null, respondedAt: ["accepted", "rejected"].includes(status) ? D(age + 2, 9) : null, validUntil: D(age + 14), createdAt: D(age, 11) })
      .returning();
    await db.insert(quoteItems).values(items.map(([name, price], i) => ({ quoteId: q.id, businessId: biz.id, type: "service", name, qty: "1", unitPrice: String(price), amount: String(price), sortOrder: i })));
    return q;
  };
  await mkQuote("Q-1001", "Sarah van Wyk", "sent", [["Geyser replacement & installation", 4850], ["Labour — commissioning", 450]], -2, true);
  await mkQuote("Q-1002", "Johan de Villiers", "sent", [["Solar system installation (5kW + battery)", 27500]], -6);
  await mkQuote("Q-1003", "Lerato Molefe", "viewed", [["Electrical fault-finding", 980], ["Re-circuit wiring", 2400]], -4);
  await mkQuote("Q-1004", "Naledi Khumalo", "accepted", [["Drain cleaning", 1200]], -12);
  await mkQuote("Q-1005", "Ayesha Patel", "rejected", [["Bathroom installation (stage 1)", 9200]], -8);
  await mkQuote("Q-1006", "Mike Dlamini", "draft", [["Geyser repair", 1450]], 0);

  /* invoices + payments */
  const mkInvoice = async (no: string, custName: string | null, total: number, issueAge: number, dueAge: number, status: string, jobId: string | null, desc: string) => {
    const sub = Math.round(total / 1.15);
    const vat = (total - sub).toFixed(2);
    const [inv] = await db
      .insert(invoices)
      .values({ businessId: biz.id, invoiceNumber: no, customerId: custName ? cust[custName] : null, jobId, status, issueDate: DISO(issueAge), dueDate: DISO(dueAge), subtotal: String(sub), vatRate: "15.00", vatAmount: vat, total: String(total), paidAmount: status === "paid" ? String(total) : "0", createdAt: D(issueAge, 16) })
      .returning();
    await db.insert(invoiceItems).values([{ invoiceId: inv.id, businessId: biz.id, name: desc, qty: "1", unitPrice: String(sub), amount: String(sub), sortOrder: 0 }]);
    return inv;
  };
  const inv1 = await mkInvoice("INV-2001", "Sarah van Wyk", 1667.5, -31, -21, "overdue", jobIds[6], "Geyser repair (element replacement)");
  const inv2 = await mkInvoice("INV-2002", "Pieter Botha", 2821, -19, -9, "overdue", jobIds[9], "Electrical fault-finding");
  const inv3 = await mkInvoice("INV-2003", "Johan de Villiers", 2127.5, -14, -4, "sent", jobIds[7], "Burst pipe — supply line replacement");
  const inv4 = await mkInvoice("INV-2004", "Naledi Khumalo", 1380, -4, 3, "sent", jobIds[8], "Drain cleaning");
  const inv5 = await mkInvoice("INV-2005", "Ayesha Patel", 1092.5, -3, 4, "paid", jobIds[11], "Toilet repair — cistern valve");
  const inv6 = await mkInvoice("INV-2006", "Lerato Molefe", 1092.5, -6, 1, "paid", jobIds[10], "Leak repair — washer replacement");
  const inv7 = await mkInvoice("INV-2007", "Zanele Dube", 1380, -1, 6, "sent", null, "Handyman services — gate motor alignment");
  await db.insert(payments).values([
    { businessId: biz.id, invoiceId: inv5.id, customerId: cust["Ayesha Patel"], amount: "1092.50", method: "card", reference: "YCO-88213", status: "completed", createdAt: D(-2, 10, 5) },
    { businessId: biz.id, invoiceId: inv6.id, customerId: cust["Lerato Molefe"], amount: "1092.50", method: "eft", reference: "EFT-0921", status: "completed", createdAt: D(-3, 12, 20) },
    { businessId: biz.id, invoiceId: null, customerId: cust["Sarah van Wyk"], amount: "850.00", method: "cash", reference: "CASH-014", status: "completed", createdAt: D(-1, 15, 0) },
    { businessId: biz.id, invoiceId: null, customerId: cust["Naledi Khumalo"], amount: "1200.00", method: "eft", reference: "EFT-0934", status: "completed", createdAt: D(-2, 11, 15) },
    { businessId: biz.id, invoiceId: null, customerId: cust["Mike Dlamini"], amount: "1450.00", method: "eft", reference: "EFT-0928", status: "completed", createdAt: D(-5, 9, 30) },
    { businessId: biz.id, invoiceId: null, customerId: cust["Johan de Villiers"], amount: "1850.00", method: "cash", reference: "CASH-012", status: "completed", createdAt: D(-7, 16, 0) },
  ]);

  /* reviews */
  await db.insert(reviews).values([
    { businessId: biz.id, customerId: cust["Sarah van Wyk"], jobId: jobIds[6], rating: 5, comment: "Thabo was fast, tidy and explained everything. Highly recommend.", source: "in_app", status: "completed", createdAt: D(-9, 17) },
    { businessId: biz.id, customerId: cust["Naledi Khumalo"], jobId: jobIds[8], rating: 5, comment: "Drain cleared first visit. Fair price.", source: "google", status: "completed", createdAt: D(-5, 18) },
    { businessId: biz.id, customerId: cust["Pieter Botha"], jobId: jobIds[9], rating: 2, comment: "Same problem came back. Needs another look at the DB board.", source: "in_app", status: "new", supportTask: true, createdAt: D(-4, 20) },
  ]);

  /* knowledge base */
  const kbDefs: [string, string, string][] = [
    ["Price list 2026 (domestic)", "price_list", "Geyser repair from R1 450. Geyser replacement & installation from R4 850. Leak repair from R850. Drain cleaning R1 200. Toilet repair R950. Burst pipe from R1 850. Electrical fault-finding R980. Emergency surcharge 30% (out of hours). VAT 15%."],
    ["Terms of service", "terms", "Payment due within 7 days of invoice. Quotes valid 14 days. 12-month workmanship guarantee on all installed work. Cancellation: 24h notice required; no-show fee R350."],
    ["Top 10 FAQs", "faq", "Do I need a permit for a new geyser? No, domestic replacement needs no permit. How long does geyser replacement take? Usually 3–4 hours. Do you attend emergencies? Yes, 7 days a week, with a 30% emergency surcharge."],
  ];
  for (const [name, type, content] of kbDefs) {
    const [doc] = await db.insert(knowledgeDocuments).values({ businessId: biz.id, name, type, size: content.length, status: "ready", content, chunks: 2 }).returning();
    await db.insert(knowledgeChunks).values([
      { businessId: biz.id, documentId: doc.id, chunkIndex: 0, content: content.slice(0, 400) },
      { businessId: biz.id, documentId: doc.id, chunkIndex: 1, content: content.slice(400) },
    ]);
  }

  /* AI activity (overnight) */
  await db.insert(aiActions).values([
    { businessId: biz.id, agent: "AI Receptionist", action: "auto_reply", tool: "receptionistReply", reason: "Routine enquiry", status: "executed", result: "Replied to geyser leak enquiry, requested suburb + photo", createdAt: D(-1, 21, 10) },
    { businessId: biz.id, agent: "AI Sales Agent", action: "follow_up_leads", tool: "followUpLeads", reason: "Quote awaiting response", status: "executed", result: "Followed up 2 sent quotes", createdAt: D(-1, 19, 30) },
    { businessId: biz.id, agent: "AI Finance Agent", action: "send_reminders", tool: "sendPaymentReminders", reason: "Invoices past due", status: "executed", result: "Sent 2 payment reminders", createdAt: D(-1, 18, 0) },
    { businessId: biz.id, agent: "AI Receptionist", action: "escalated", tool: "receptionistReply", reason: "Customer is upset about service + refund request", status: "executed", result: "Escalated Pieter Botha conversation to owner", createdAt: D(0, 8, 41) },
  ]);
  await db.update(aiAgents).set({ active: true }).where(eq(aiAgents.businessId, biz.id));

  /* notifications */
  await db.insert(notifications).values([
    { businessId: biz.id, type: "ai_escalation", title: "AI needs your attention", body: "Pieter Botha (Tokai) is upset about a recurring electrical fault and requested a refund.", link: "/dashboard/inbox", createdAt: D(0, 8, 41) },
    { businessId: biz.id, type: "invoice_overdue", title: "3 invoices overdue", body: "R 8 400 outstanding across 3 invoices. Oldest is 21 days.", link: "/dashboard/invoices", createdAt: D(0, 7, 0) },
    { businessId: biz.id, type: "payment", title: "Payment received", body: "R 1 092 from Lerato Molefe (EFT) on INV-2006.", link: "/dashboard/invoices", read: true, createdAt: D(-3, 12, 25) },
    { businessId: biz.id, type: "new_lead", title: "New lead captured by AI", body: "Zanele Dube — Leak repair, Milnerton (score 74).", link: "/dashboard/leads", createdAt: D(0, 6, 17) },
  ]);

  await db.insert(auditLogs).values({ businessId: biz.id, actor: "System", action: "Demo data seeded", entity: "business", entityId: biz.id, createdAt: D(0, 7) });

  /* mark overdue invoices properly */
  await db
    .update(invoices)
    .set({ status: "overdue" })
    .where(sql`business_id = ${biz.id} and status in ('sent','viewed','partial') and due_date < ${new Date().toISOString().slice(0, 10)}`);

  return { userId: owner.id, email, businessId: biz.id };
}
