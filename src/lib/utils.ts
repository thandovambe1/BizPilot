/* Shared client-safe utilities: formatting (SA locale), i18n foundation, cn */

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});
const ZAR_CENTS = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatZAR(v: number | string | null | undefined, cents = false): string {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return cents ? "R 0,00" : "R 0";
  return cents ? ZAR_CENTS.format(n) : ZAR.format(n);
}

export function formatNumber(v: number | string | null | undefined): string {
  return new Intl.NumberFormat("en-ZA").format(Number(v ?? 0));
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  return formatDate(d);
}

export function daysUntil(d: string | Date | null | undefined): number {
  if (!d) return 0;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export function daysOverdue(d: string | Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(d).setHours(23, 59, 59, 0)) / 86400000));
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(base: Date | string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "0821 123 456" -> "+27821123456" (rough SA phone normalisation) */
export function normalizeSAphone(p: string | null | undefined): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+27${digits}`;
  if (digits.startsWith("27") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+27${digits.slice(1)}`;
  return p;
}

export const SA_PROVINCES = [
  "Western Cape",
  "Eastern Cape",
  "Northern Cape",
  "Free State",
  "KwaZulu-Natal",
  "North West",
  "Gauteng",
  "Mpumalanga",
  "Limpopo",
] as const;

export const BUSINESS_TYPES = [
  "Plumbing",
  "Electrical",
  "Handyman",
  "Construction",
  "Painting",
  "Cleaning",
  "Gardening",
  "Appliance repair",
  "Mechanical / Auto",
  "Solar installation",
  "Security",
  "HVAC / Air conditioning",
  "Other service business",
];

/* ------------------------------------------------------------------ */
/* i18n foundation — English first; architecture for af, zu, xh, st,   */
/* tn, nso, ss, nd, ve, ts later. Never hard-code strings in the AI    */
/* engine or UI through raw literals that bypass this table.           */
/* ------------------------------------------------------------------ */

type Dict = Record<string, string>;

const en: Dict = {
  "app.name": "BizPilot",
  "app.tagline": "Your AI business manager.",
  "nav.dashboard": "Dashboard",
  "nav.inbox": "Inbox",
  "nav.leads": "Leads",
  "nav.jobs": "Jobs",
  "nav.customers": "Customers",
  "nav.quotes": "Quotes",
  "nav.invoices": "Invoices",
  "nav.analytics": "Analytics",
  "nav.settings": "Settings",
  "ai.ask": "Ask BizPilot",
  "empty.leads.title": "No leads yet",
  "empty.leads.body":
    "Once customers contact your business, BizPilot will automatically create and score leads here.",
  "empty.customers.title": "No customers yet",
  "empty.customers.body": "Add your first customer, or let the AI receptionist create them from enquiries.",
};

const dicts: Record<string, Dict> = { en };

export function t(key: string, locale = "en"): string {
  return (dicts[locale] ?? en)[key] ?? en[key] ?? key;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function relativeDayLabel(isoDate: string): string {
  const today = new Date();
  const t0 = new Date(today.toISOString().slice(0, 10));
  const d = new Date(isoDate + "T00:00:00");
  const diff = Math.round((d.getTime() - t0.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}
