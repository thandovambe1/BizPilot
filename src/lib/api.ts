/* Client API helper + shared types. All requests hit /api (catch-all dispatcher). */

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;
  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any; stream?: boolean } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  if (!res.ok) {
    let msg = "Something went wrong. Please try again.";
    let code: string | undefined;
    let data: any;
    try {
      const j = await res.json();
      msg = j.error ?? msg;
      code = j.code;
      data = j.data;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status, code, data);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

/* ----------------------------- Types ----------------------------- */

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  businessId: string;
  isPlatformAdmin: boolean;
}

export interface Business {
  id: string;
  name: string;
  type?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  province?: string | null;
  city?: string | null;
  serviceArea?: string | null;
  description?: string | null;
  vatRate: string;
  onboardedAt?: string | null;
}

export interface Subscription {
  plan: string;
  status: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  basePrice: string | null;
  pricingType: string;
  durationMinutes: number;
  isEmergency: boolean;
  active: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  skills: string[];
  serviceAreas: string[];
  workingHours?: string | null;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  suburb?: string | null;
  city?: string | null;
  tags: string[];
  status: string;
  source?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  totalSpend: number;
  jobsCount: number;
  outstanding: number;
  lastBooking?: string | null;
  timeline: TimelineEvent[];
}

export interface Lead {
  id: string;
  customerId?: string | null;
  name: string;
  phone?: string | null;
  source: string;
  serviceId?: string | null;
  service?: string | null;
  suburb?: string | null;
  city?: string | null;
  urgency: string;
  budget?: string | null;
  status: string;
  value?: string | null;
  score: number;
  scoreReason?: string | null;
  assignedTo?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  position: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  leadId?: string | null;
  channel: string;
  subject?: string | null;
  mode: string;
  aiStatus: string;
  escalationReason?: string | null;
  unread: boolean;
  leadScore: number;
  service?: string | null;
  location?: string | null;
  recommendedAction?: string | null;
  lastMessagePreview?: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: string;
  author: string;
  body: string;
  channel: string;
  createdAt: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  serviceId?: string | null;
  service: string;
  description?: string | null;
  address?: string | null;
  suburb?: string | null;
  city?: string | null;
  gps?: string | null;
  teamMemberId?: string | null;
  teamMemberName?: string | null;
  date: string;
  startsAt: string;
  endsAt?: string | null;
  status: string;
  priority: string;
  notes?: string | null;
  photos?: { id: string; type: string; name: string; url?: string | null; caption?: string | null }[];
  createdAt: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  status: string;
  validUntil?: string | null;
  notes?: string | null;
  terms?: string | null;
  discount: string;
  vatRate: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  aiGenerated: boolean;
  sentAt?: string | null;
  createdAt: string;
  items?: { id: string; type: string; name: string; description?: string | null; qty: string; unitPrice: string; amount: string }[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  jobId?: string | null;
  quoteId?: string | null;
  status: string;
  issueDate: string;
  dueDate: string;
  notes?: string | null;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  total: string;
  paidAmount: string;
  lastReminderAt?: string | null;
  createdAt: string;
  items?: { id: string; name: string; description?: string | null; qty: string; unitPrice: string; amount: string }[];
  payments?: { id: string; amount: string; method: string; reference?: string | null; status: string; createdAt: string }[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface Briefing {
  greeting: string;
  headline: string;
  stats: Record<string, number>;
  handledOvernight: { text: string; value?: number }[];
  attention: { type: string; text: string; link?: string | null }[];
  recommendation?: { text: string; actionId?: string; applyLabel?: string } | null;
  aiParagraph: string;
  generatedAt: string;
}

export interface AiCard {
  kind: string;
  title: string;
  rows?: { label: string; value: string }[];
  items?: { id: string; title: string; sub?: string; value?: string; extra?: string }[];
  links?: { label: string; href: string }[];
}

export interface AiAction {
  id: string;
  label: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface TimelineEvent {
  id: string;
  kind: string; // message | lead | quote | job | invoice | payment | review | ai
  title: string;
  detail?: string | null;
  value?: string | null;
  at: string;
}

export interface Insight {
  id: string;
  tone: "positive" | "warning" | "info";
  title: string;
  body: string;
  action?: { label: string; prompt: string } | null;
}
