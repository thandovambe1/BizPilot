import { pgTable, uuid, text, boolean, timestamp, integer, numeric, date, index, uniqueIndex } from "drizzle-orm/pg-core";

const now = () => new Date();

/* ------------------------------------------------------------------ */
/* Identity & tenancy                                                  */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$onUpdate(now),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type"),
  ownerName: text("owner_name"),
  phone: text("phone"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  province: text("province"),
  city: text("city"),
  serviceArea: text("service_area"),
  description: text("description"),
  currency: text("currency").notNull().default("ZAR"),
  vatRegistered: boolean("vat_registered").notNull().default(true),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("15.00"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$onUpdate(now),
});

export const businessMembers = pgTable(
  "business_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("manager"), // owner | admin | manager | technician | accountant
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bm_business_idx").on(t.businessId), index("bm_user_idx").on(t.userId)]
);

/* ------------------------------------------------------------------ */
/* Subscription                                                        */
/* ------------------------------------------------------------------ */

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }).unique(),
  plan: text("plan").notNull().default("starter"), // starter | business | pro
  status: text("status").notNull().default("trialing"), // trialing | active | past_due | cancelled
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$onUpdate(now),
});

export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").notNull(),
    type: text("type").notNull(), // trial_started | subscribed | upgraded | payment_succeeded | cancelled
    meta: text("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sub_events_business_idx").on(t.businessId)]
);

/* ------------------------------------------------------------------ */
/* CRM                                                                 */
/* ------------------------------------------------------------------ */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    address: text("address"),
    suburb: text("suburb"),
    city: text("city"),
    province: text("province"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default([]),
    status: text("status").notNull().default("prospect"), // prospect | customer | inactive
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$onUpdate(now),
  },
  (t) => [index("customers_business_idx").on(t.businessId), index("customers_name_idx").on(t.name)]
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    label: text("label"),
    address: text("address"),
    suburb: text("suburb"),
    city: text("city"),
    province: text("province"),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cust_addr_customer_idx").on(t.customerId)]
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone"),
    source: text("source").notNull().default("whatsapp"),
    serviceId: uuid("service_id"),
    service: text("service"),
    suburb: text("suburb"),
    city: text("city"),
    urgency: text("urgency").notNull().default("normal"), // low | normal | high | emergency
    budget: numeric("budget", { precision: 12, scale: 2 }),
    status: text("status").notNull().default("new"), // new | contacted | qualified | quote_sent | negotiating | booked | won | lost
    value: numeric("value", { precision: 12, scale: 2 }),
    score: integer("score").notNull().default(0),
    scoreReason: text("score_reason"),
    assignedTo: text("assigned_to"),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$onUpdate(now),
  },
  (t) => [index("leads_business_idx").on(t.businessId), index("leads_status_idx").on(t.status)]
);

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // created | status_changed | note | ai_scored | quote_sent | message
    note: text("note"),
    actor: text("actor").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_act_lead_idx").on(t.leadId)]
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    leadId: uuid("lead_id"),
    channel: text("channel").notNull().default("whatsapp"), // whatsapp | email | web | phone | in_app
    subject: text("subject"),
    mode: text("mode").notNull().default("ai"), // ai | human | hybrid
    aiStatus: text("ai_status").notNull().default("active"), // active | escalated | resolved
    escalationReason: text("escalation_reason"),
    unread: boolean("unread").notNull().default(true),
    leadScore: integer("lead_score").notNull().default(0),
    service: text("service"),
    location: text("location"),
    recommendedAction: text("recommended_action"),
    lastMessagePreview: text("last_message_preview"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$onUpdate(now),
  },
  (t) => [index("conv_business_idx").on(t.businessId), index("conv_customer_idx").on(t.customerId)]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id"),
    direction: text("direction").notNull().default("out"), // in | out
    author: text("author").notNull().default("human"), // customer | bizpilot_ai | human
    body: text("body").notNull(),
    channel: text("channel").notNull().default("whatsapp"),
    meta: text("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("msgs_conv_idx").on(t.conversationId), index("msgs_business_idx").on(t.businessId)]
);

/* ------------------------------------------------------------------ */
/* Services & team                                                     */
/* ------------------------------------------------------------------ */

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull().default("general"),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }),
    pricingType: text("pricing_type").notNull().default("fixed"), // fixed | starting_from | hourly | custom
    durationMinutes: integer("duration_minutes").notNull().default(60),
    isEmergency: boolean("is_emergency").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$onUpdate(now),
  },
  (t) => [index("services_business_idx").on(t.businessId)]
);

export const servicePrices = pgTable(
  "service_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    area: text("area"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("svc_prices_service_idx").on(t.serviceId)]
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull().default("technician"),
    phone: text("phone"),
    email: text("email"),
    skills: text("skills").array().notNull().default([]),
    serviceAreas: text("service_areas").array().notNull().default([]),
    workingHours: text("working_hours"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$onUpdate(now),
  },
  (t) => [index("team_business_idx").on(t.businessId)]
);

export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    day: integer("day").notNull(), // 0 = Sunday
    opensAt: text("opens_at").notNull().default("08:00"),
    closesAt: text("closes_at").notNull().default("17:00"),
    isClosed: boolean("is_closed").notNull().default(false),
  },
  (t) => [uniqueIndex("wh_business_day_idx").on(t.businessId, t.day)]
);

/* ------------------------------------------------------------------ */
/* Scheduling, jobs, quotes, invoices, payments                        */
/* ------------------------------------------------------------------ */

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    leadId: uuid("lead_id"),
    customerId: uuid("customer_id"),
    teamMemberId: uuid("team_member_id"),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: text("status").notNull().default("pending"), // pending | confirmed | completed | cancelled
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("appt_business_idx").on(t.businessId)]
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    jobNumber: text("job_number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    leadId: uuid("lead_id"),
    serviceId: uuid("service_id"),
    service: text("service").notNull(),
    description: text("description"),
    address: text("address"),
    suburb: text("suburb"),
    city: text("city"),
    gps: text("gps"), // "lat,lng"
    teamMemberId: uuid("team_member_id"),
    teamMemberName: text("team_member_name"),
    date: date("date").notNull(),
    startsAt: text("starts_at").notNull().default("09:00"),
    endsAt: text("ends_at"),
    status: text("status").notNull().default("new"), // new | scheduled | confirmed | en_route | on_site | in_progress | completed | cancelled
    priority: text("priority").notNull().default("normal"), // low | normal | high | emergency
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().$onUpdate(now),
  },
  (t) => [index("jobs_business_idx").on(t.businessId), index("jobs_date_idx").on(t.date), index("jobs_status_idx").on(t.status)]
);

export const jobPhotos = pgTable(
  "job_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("after"), // before | after | document
    name: text("name").notNull(),
    url: text("url"),
    caption: text("caption"),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_photos_job_idx").on(t.jobId)]
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    quoteNumber: text("quote_number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    leadId: uuid("lead_id"),
    status: text("status").notNull().default("draft"), // draft | sent | viewed | accepted | rejected | expired
    validUntil: timestamp("valid_until", { withTimezone: true }),
    notes: text("notes"),
    terms: text("terms"),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("15.00"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(now),
  },
  (t) => [index("quotes_business_idx").on(t.businessId), index("quotes_status_idx").on(t.status)]
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").notNull(),
    type: text("type").notNull().default("service"), // service | material | labour
    name: text("name").notNull(),
    description: text("description"),
    qty: numeric("qty", { precision: 10, scale: 2 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("qitems_quote_idx").on(t.quoteId)]
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    jobId: uuid("job_id"),
    quoteId: uuid("quote_id"),
    status: text("status").notNull().default("draft"), // draft | sent | viewed | partial | paid | overdue | cancelled
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    notes: text("notes"),
    terms: text("terms"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("15.00"),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(now),
  },
  (t) => [index("inv_business_idx").on(t.businessId), index("inv_status_idx").on(t.status), index("inv_due_idx").on(t.dueDate)]
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    qty: numeric("qty", { precision: 10, scale: 2 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("iitems_invoice_idx").on(t.invoiceId)]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    customerId: uuid("customer_id"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: text("method").notNull().default("eft"), // yoco | eft | card | cash | other
    reference: text("reference"),
    status: text("status").notNull().default("completed"), // pending | completed | failed | refunded
    providerMeta: text("provider_meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pay_business_idx").on(t.businessId), index("pay_invoice_idx").on(t.invoiceId)]
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    category: text("category").notNull().default("other"),
    description: text("description"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exp_business_idx").on(t.businessId)]
);

/* ------------------------------------------------------------------ */
/* Reviews, notifications                                              */
/* ------------------------------------------------------------------ */

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    customerId: uuid("customer_id"),
    jobId: uuid("job_id"),
    rating: integer("rating").notNull().default(5),
    comment: text("comment"),
    source: text("source").notNull().default("in_app"),
    status: text("status").notNull().default("new"), // new | followed_up | completed
    supportTask: boolean("support_task").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rev_business_idx").on(t.businessId)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id"), // null = broadcast to all members
    type: text("type").notNull(), // new_lead | urgent | new_booking | quote_accepted | payment | invoice_overdue | technician_delayed | ai_escalation | review | briefing
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notif_business_idx").on(t.businessId)]
);

export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    userId: uuid("user_id").notNull(),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    whatsappEnabled: boolean("whatsapp_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    prefs: text("prefs"), // JSON map of type -> true/false
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(now),
  },
  (t) => [uniqueIndex("notif_settings_idx").on(t.businessId, t.userId)]
);

/* ------------------------------------------------------------------ */
/* AI layer                                                            */
/* ------------------------------------------------------------------ */

export const aiAgents = pgTable(
  "ai_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    key: text("key").notNull(), // receptionist | sales | scheduling | finance | success | analyst | ceo
    name: text("name").notNull(),
    role: text("role").notNull(),
    active: boolean("active").notNull().default(true),
    config: text("config"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ai_agents_idx").on(t.businessId, t.key)]
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    userId: uuid("user_id"),
    title: text("title").notNull().default("New conversation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(now),
  },
  (t) => [index("aic_conv_business_idx").on(t.businessId)]
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    aiConversationId: uuid("ai_conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("user"), // user | assistant
    content: text("content").notNull(),
    data: text("data"), // JSON: cards, statuses
    pendingActionId: uuid("pending_action_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("aimg_conv_idx").on(t.aiConversationId)]
);

export const aiActions = pgTable(
  "ai_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    aiConversationId: uuid("ai_conversation_id"),
    agent: text("agent").notNull(),
    action: text("action").notNull(),
    tool: text("tool").notNull(),
    reason: text("reason"),
    input: text("input"), // JSON
    result: text("result"),
    status: text("status").notNull().default("suggested"), // suggested | executed | cancelled | failed
    confirmedByUserId: uuid("confirmed_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("aiaction_business_idx").on(t.businessId)]
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    date: date("date").notNull(),
    agent: text("agent").notNull().default("ceo"),
    requests: integer("requests").notNull().default(1),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costCents: integer("cost_cents").notNull().default(0),
  },
  (t) => [index("aiusage_business_idx").on(t.businessId)]
);

/* ------------------------------------------------------------------ */
/* Knowledge base, settings, integrations, audit                       */
/* ------------------------------------------------------------------ */

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull().default("document"), // price_list | policy | faq | manual | terms | document | image
    size: integer("size").notNull().default(0),
    status: text("status").notNull().default("ready"), // processing | ready | failed
    content: text("content"),
    chunks: integer("chunks").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(now),
  },
  (t) => [index("kb_business_idx").on(t.businessId)]
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    documentId: uuid("document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull().default(0),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kbc_doc_idx").on(t.documentId)]
);

export const businessSettings = pgTable("business_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }).unique(),
  aiTone: text("ai_tone").notNull().default("friendly"), // professional | friendly | casual | formal
  aiAutonomy: text("ai_autonomy").notNull().default("confirm"), // suggest | confirm | autonomous
  businessRules: text("business_rules").array().notNull().default([]),
  autoReminders: boolean("auto_reminders").notNull().default(true),
  reminderDays: text("reminder_days").notNull().default("1,3,7,14"),
  maxDiscountPct: integer("max_discount_pct").notNull().default(10),
  emergencySurchargePct: integer("emergency_surcharge_pct").notNull().default(30),
  requestReviews: boolean("request_reviews").notNull().default(true),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  quotePrefix: text("quote_prefix").notNull().default("Q-"),
  quoteValidDays: integer("quote_valid_days").notNull().default(14),
  invoiceDueDays: integer("invoice_due_days").notNull().default(7),
  whatsappNumber: text("whatsapp_number"),
  emailSignature: text("email_signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(now),
});

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    provider: text("provider").notNull(), // whatsapp | yoco | email | google_calendar
    status: text("status").notNull().default("disconnected"), // connected | pending | disconnected
    label: text("label"),
    config: text("config"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(now),
  },
  (t) => [uniqueIndex("integrations_idx").on(t.businessId, t.provider)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id"),
    userId: uuid("user_id"),
    actor: text("actor").notNull().default("system"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    meta: text("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_business_idx").on(t.businessId)]
);
