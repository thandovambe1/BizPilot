"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn, formatZAR, timeAgo } from "@/lib/utils";
import { Avatar, Badge, Icon, Logo, Spinner, Wordmark } from "./ui";
import { useTheme } from "./theme-init";
import { AiPanel } from "./ai-panel";

export interface ShellUser {
  id: string;
  name: string;
  email: string;
  role: string;
  businessId: string;
  isPlatformAdmin: boolean;
  businessName: string;
  plan: string;
  trialDays: number;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "home", match: (p: string) => p === "/dashboard" },
  { href: "/dashboard/inbox", label: "Inbox", icon: "inbox", match: (p: string) => p.includes("/inbox") },
  { href: "/dashboard/leads", label: "Leads", icon: "target", match: (p: string) => p.includes("/leads") },
  { href: "/dashboard/jobs", label: "Jobs", icon: "wrench", match: (p: string) => p.includes("/jobs") },
  { href: "/dashboard/customers", label: "Customers", icon: "users", match: (p: string) => p.includes("/customers") },
  { href: "/dashboard/quotes", label: "Quotes", icon: "file", match: (p: string) => p.includes("/quotes") },
  { href: "/dashboard/invoices", label: "Invoices", icon: "receipt", match: (p: string) => p.includes("/invoices") },
  { href: "/dashboard/analytics", label: "Analytics", icon: "chart", match: (p: string) => p.includes("/analytics") },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", match: (p: string) => p.includes("/settings") },
];

export function Shell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const router = useRouter();
  const [path, setPath] = useState("/dashboard");
  const [unread, setUnread] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { dark, setDark } = useTheme();

  useEffect(() => {
    setPath(window.location.pathname);
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      setMoreOpen(false);
    },
    [router]
  );

  useEffect(() => {
    let stop = false;
    const load = () =>
      api<{ items: any[] }>("/conversations?view=unread")
        .then((r) => !stop && setUnread(r.items.length))
        .catch(() => {});
    load();
    const t = setInterval(load, 25000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onOpen = () => setAiOpen(true);
    window.addEventListener("bp:open-ai", onOpen);
    return () => window.removeEventListener("bp:open-ai", onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showTrialBanner = user.plan === "starter" || user.plan === "business" || user.plan === "pro" ? (user.trialDays > 0 && user.trialDays <= 10) : false;
  const isTrial = user.trialDays > 0;

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col border-r border-line bg-surface lg:flex">
        <button onClick={() => go("/dashboard")} className="flex h-16 items-center px-5 text-left">
          <Wordmark size={30} />
        </button>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main navigation">
          {NAV.map((n) => {
            const active = n.match(path);
            return (
              <button
                key={n.href}
                onClick={() => go(n.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "btn-focus flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                  active ? "bg-brandsoft text-brandstrong" : "text-mut hover:bg-surface2 hover:text-ink"
                )}
              >
                <Icon name={n.icon} size={17} />
                {n.label}
                {n.label === "Inbox" && unread > 0 && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10.5px] font-bold text-[#241a08]">{unread}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          {isTrial && (
            <button onClick={() => go("/dashboard/settings?tab=subscription")} className="mb-2 w-full rounded-[10px] border border-accent/30 bg-accentsoft px-3 py-2.5 text-left transition hover:brightness-95">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-accent">
                <Icon name="zap" size={14} />
                {user.trialDays} day{user.trialDays === 1 ? "" : "s"} left on trial
              </div>
              <div className="mt-0.5 text-[11px] text-mut">Upgrade to keep all AI features</div>
            </button>
          )}
          <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5">
            <Avatar name={user.name} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold">{user.name}</div>
              <div className="truncate text-[11px] text-mut capitalize">{user.role}</div>
            </div>
            <button onClick={() => api("/auth/logout", { method: "POST" }).then(() => window.location.href = "/auth")} className="btn-focus rounded-lg p-1.5 text-mut hover:bg-surface2 hover:text-danger" aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[228px]">
        {showTrialBanner && (
          <div className="flex items-center justify-center gap-3 border-b border-accent/25 bg-accentsoft px-4 py-2 text-[12.5px] font-medium text-warn">
            <Icon name="zap" size={14} />
            <span>
              Your 14-day trial ends in {user.trialDays} day{user.trialDays === 1 ? "" : "s"}.
            </span>
            <button onClick={() => go("/dashboard/settings?tab=subscription")} className="btn-focus rounded-md bg-accent px-2.5 py-1 text-[11.5px] font-semibold text-[#241a08] hover:brightness-95">
              Upgrade
            </button>
          </div>
        )}
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
          <button onClick={() => go("/dashboard")} className="lg:hidden">
            <Logo size={30} />
          </button>
          <div className="hidden items-center gap-2 text-[13px] text-mut sm:flex">
            <span className="font-medium text-ink">{user.businessName}</span>
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="btn-focus ml-auto flex h-9 w-full max-w-[300px] items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-mut shadow-sm transition hover:border-linestrong sm:ml-auto"
            aria-label="Search (Ctrl+K)"
          >
            <Icon name="search" size={15} />
            <span className="flex-1 text-left">Search customers, leads, invoices…</span>
            <kbd className="hidden rounded-md border border-line bg-surface2 px-1.5 py-0.5 text-[10px] font-semibold text-mut sm:block">⌘K</kbd>
          </button>
          <div className="flex items-center gap-1">
            <ThemeToggle dark={dark} setDark={setDark} />
            <NotificationsBell />
            <button onClick={() => setAiOpen(true)} className="btn-focus hidden items-center gap-2 rounded-[10px] bg-brand px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brandstrong sm:inline-flex">
              <Icon name="sparkles" size={15} />
              Ask BizPilot
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10" id="main">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-line bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-md lg:hidden" aria-label="Mobile navigation">
        {[NAV[0], NAV[1], NAV[3]].map((n) => (
          <MobileTab key={n.href} nav={n} path={path} go={go} badge={n.label === "Inbox" ? unread : 0} />
        ))}
        <button
          onClick={() => setAiOpen(true)}
          className="btn-focus -mt-6 flex h-13 w-13 items-center justify-center rounded-2xl bg-brand p-3.5 text-white shadow-lg ring-4 ring-canvas"
          aria-label="Ask BizPilot"
        >
          <Icon name="sparkles" size={20} />
        </button>
        {[NAV[4], { ...NAV[8], label: "More", icon: "dots" }].map((n, i) =>
          i === 1 ? (
            <button key="more" onClick={() => setMoreOpen(true)} className="btn-focus flex flex-col items-center gap-0.5 px-3 py-1 text-[10.5px] font-medium text-mut">
              <Icon name="dots" size={19} />
              More
            </button>
          ) : (
            <MobileTab key={n.href} nav={n} path={path} go={go} />
          )
        )}
      </nav>

      {/* Mobile "more" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/45 anim-fade-in" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 anim-fade-up rounded-t-2xl border-t border-line bg-surface p-4 pb-8">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-linestrong" />
            <div className="grid grid-cols-3 gap-2">
              {NAV.slice(5).map((n) => (
                <button key={n.href} onClick={() => go(n.href)} className={cn("btn-focus flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface2/60 px-2 py-3.5 text-[11.5px] font-medium", n.match(path) ? "text-brandstrong" : "text-mut")}>
                  <Icon name={n.icon} size={19} />
                  {n.label}
                </button>
              ))}
              <button onClick={() => window.location.href = "/admin"} className="btn-focus flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface2/60 px-2 py-3.5 text-[11.5px] font-medium text-mut">
                <Icon name="shield" size={19} />
                Platform
              </button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onAsk={() => { setPaletteOpen(false); setAiOpen(true); }} go={go} />
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} businessId={user.businessId} />
    </div>
  );
}

function MobileTab({ nav, path, go, badge }: { nav: { href: string; label: string; icon: string }; path: string; go: (h: string) => void; badge?: number }) {
  const active = nav.href === "/dashboard" ? path === "/dashboard" : path.includes(nav.href.replace("/dashboard", ""));
  return (
    <button onClick={() => go(nav.href)} className={cn("btn-focus relative flex flex-col items-center gap-0.5 px-3 py-1 text-[10.5px] font-medium", active ? "text-brandstrong" : "text-mut")} aria-current={active ? "page" : undefined}>
      <Icon name={nav.icon} size={19} />
      {nav.label === "Inbox" ? "Inbox" : nav.label === "Jobs" ? "Jobs" : "Home"}
      {!!badge && badge > 0 && <span className="absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-[#241a08]">{badge}</span>}
    </button>
  );
}

function ThemeToggle({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  return (
    <button onClick={() => setDark(!dark)} className="btn-focus rounded-[10px] border border-line bg-surface p-2 text-mut shadow-sm transition hover:text-ink" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      <Icon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const load = async () => {
    if (!open) return;
    setLoading(true);
    try {
      const r = await api<{ items: any[] }>("/notifications");
      setItems(r.items);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [open]);
  const unread = items.filter((i) => !i.read).length;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="btn-focus relative rounded-[10px] border border-line bg-surface p-2 text-mut shadow-sm transition hover:text-ink" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
        <Icon name="bell" size={16} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="anim-pop absolute right-0 top-12 z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-[13px] font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={async () => { await api("/notifications", { method: "PATCH", body: { readAll: true } }); load(); }} className="btn-focus text-[11.5px] font-medium text-brand hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {loading && <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-mut"><Spinner size={14} /> Loading…</div>}
            {!loading && items.length === 0 && <div className="px-4 py-10 text-center text-[12.5px] text-mut">You're all caught up.</div>}
            {!loading &&
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={async () => {
                    await api("/notifications", { method: "PATCH", body: { id: n.id } });
                    setOpen(false);
                    if (n.link) window.location.href = n.link;
                  }}
                  className={cn("flex w-full items-start gap-3 border-b border-line/60 px-4 py-3 text-left transition hover:bg-surface2", !n.read && "bg-brandsoft/40")}
                >
                  <span className={cn("mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", n.type === "payment" ? "bg-oksoft text-ok" : n.type === "ai_escalation" ? "bg-dangersoft text-danger" : n.type === "invoice_overdue" ? "bg-warnsoft text-warn" : "bg-brandsoft text-brand")}>
                    <Icon name={n.type === "payment" ? "wallet" : n.type === "ai_escalation" ? "alert" : n.type === "invoice_overdue" ? "receipt" : n.type === "review" ? "star" : n.type === "new_booking" || n.type === "quote_accepted" ? "calendar" : "bell"} size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-[12.5px] leading-snug", !n.read && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-[11.5px] leading-snug text-mut">{n.body}</span>}
                    <span className="mt-1 block text-[10.5px] text-mut/70">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- Command palette ------------------------- */

function CommandPalette({ open, onClose, onAsk, go }: { open: boolean; onClose: () => void; onAsk: () => void; go: (h: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      if (q.trim().length < 2) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const r = await api<{ results: any }>(`/search?q=${encodeURIComponent(q)}`);
        setResults(r.results);
      } catch {
        setResults(null);
      }
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;

  const groups: { label: string; icon: string; items: any[]; href: (i: any) => string }[] = results
    ? [
        { label: "Customers", icon: "users", items: results.customers ?? [], href: () => "/dashboard/customers" },
        { label: "Leads", icon: "target", items: results.leads ?? [], href: () => "/dashboard/leads" },
        { label: "Jobs", icon: "wrench", items: results.jobs ?? [], href: () => "/dashboard/jobs" },
        { label: "Quotes", icon: "file", items: results.quotes ?? [], href: () => "/dashboard/quotes" },
        { label: "Invoices", icon: "receipt", items: results.invoices ?? [], href: () => "/dashboard/invoices" },
        { label: "Team", icon: "user", items: results.team ?? [], href: () => "/dashboard/settings?tab=team" },
      ]
    : [];
  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-black/45 anim-fade-in backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl anim-pop overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={17} className="text-mut" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search “Sarah”, “invoice 2003”, “jobs in Sea Point”…"
            className="h-13 w-full bg-transparent py-4 text-[14.5px] outline-none placeholder:text-mut/70"
            aria-label="Search input"
          />
          {loading && <Spinner size={15} className="text-mut" />}
          <kbd className="rounded-md border border-line bg-surface2 px-1.5 py-0.5 text-[10px] font-semibold text-mut">esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {!q.trim() && (
            <div className="grid grid-cols-2 gap-2 p-2">
              {[
                { icon: "users", label: "New customer", href: "/dashboard/customers?new=1" },
                { icon: "file", label: "New quote", href: "/dashboard/quotes?new=1" },
                { icon: "wrench", label: "Schedule a job", href: "/dashboard/jobs?new=1" },
                { icon: "receipt", label: "New invoice", href: "/dashboard/invoices?new=1" },
              ].map((a) => (
                <button key={a.label} onClick={() => { onClose(); go(a.href); }} className="btn-focus flex items-center gap-3 rounded-xl border border-line bg-surface2/60 px-3.5 py-3 text-left text-[13px] font-medium transition hover:border-linestrong">
                  <Icon name={a.icon} size={16} className="text-brand" />
                  {a.label}
                </button>
              ))}
              <button onClick={() => { onClose(); onAsk(); }} className="btn-focus col-span-2 flex items-center gap-3 rounded-xl bg-brand px-3.5 py-3 text-left text-[13px] font-semibold text-white transition hover:bg-brandstrong">
                <Icon name="sparkles" size={16} />
                Ask BizPilot — “How is my business doing?”
              </button>
            </div>
          )}
          {!!q.trim() && total === 0 && !loading && <div className="px-4 py-10 text-center text-[13px] text-mut">No matches for “{q}”. Try a name, phone number or document number.</div>}
          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <div key={g.label} className="mb-1">
                <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-mut">
                  <Icon name={g.icon} size={12} />
                  {g.label}
                </div>
                {g.items.map((it: any) => (
                  <button key={it.id} onClick={() => { onClose(); go(g.href(it)); }} className="btn-focus flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-surface2">
                    <Avatar name={it.name ?? it.customerName ?? it.jobNumber ?? it.invoiceNumber ?? it.quoteNumber ?? "?"} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{it.name ?? it.service ?? it.quoteNumber ?? it.invoiceNumber ?? it.jobNumber}</span>
                      <span className="block truncate text-[11.5px] text-mut">{it.suburb ?? it.phone ?? it.date ?? it.status}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
