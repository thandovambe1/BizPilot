"use client";

import { useCallback, useEffect, useState } from "react";
import { api, CustomerDetail } from "@/lib/api";
import { cn, formatDate, formatZAR, timeAgo } from "@/lib/utils";
import { Avatar, Badge, Button, Card, Drawer, EmptyState, Field, Icon, Modal, StatusBadge, useToast } from "@/components/ui";

export default function CustomersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new") === "1");
  const toast = useToast();

  const load = useCallback(() => {
    api<{ items: any[] }>(`/customers?search=${encodeURIComponent(search)}`)
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openCustomer = async (id: string) => {
    try {
      const r = await api<{ item: CustomerDetail; timeline: any[] }>(`/customers/${id}`);
      setSelected(r.item);
      setTimeline(r.timeline);
    } catch (e: any) {
      toast(e.message, "danger");
    }
  };

  const kindIcon: Record<string, string> = { message: "chat", lead: "target", quote: "file", job: "wrench", invoice: "receipt", payment: "wallet", review: "star", ai: "sparkles" };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Customers</h1>
          <p className="text-[12.5px] text-mut">{items.length} in your CRM · spend, jobs and history in one profile</p>
        </div>
        <Button size="sm" icon="plus" onClick={() => setNewOpen(true)}>
          New customer
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut" />
        <input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone or suburb…" aria-label="Search customers" />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface2" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="users"
          title={search ? "No customers match your search" : "No customers yet"}
          body={search ? "Try a different name or number." : "Add your first customer, or let the AI receptionist create them automatically from enquiries."}
          ctaLabel={search ? undefined : "Add customer"}
          action={search ? undefined : () => setNewOpen(true)}
        />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {items.map((c) => (
            <button key={c.id} onClick={() => openCustomer(c.id)} className="card flex items-center gap-3.5 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <Avatar name={c.name} size={42} tone={c.status === "inactive" ? "info" : "brand"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-semibold">{c.name}</span>
                  {c.tags.includes("repeat") && <Badge tone="accent">repeat</Badge>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-mut">
                  {c.phone && <span className="inline-flex items-center gap-1"><Icon name="phone" size={11} />{c.phone}</span>}
                  {c.suburb && <span className="inline-flex items-center gap-1"><Icon name="pin" size={11} />{c.suburb}</span>}
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={c.status} />
                <div className="mt-1.5 text-[10.5px] text-mut">added {timeAgo(c.createdAt)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""} sub={selected ? `${selected.suburb ?? ""} ${selected.phone ? "· " + selected.phone : ""}` : undefined}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: "Total spend", v: formatZAR(selected.totalSpend), i: "wallet" },
                { l: "Jobs", v: String(selected.jobsCount), i: "wrench" },
                { l: "Outstanding", v: formatZAR(selected.outstanding), i: "receipt", warn: selected.outstanding > 0 },
              ].map((s) => (
                <div key={s.l} className={cn("rounded-xl border p-3 text-center", s.warn ? "border-warn/30 bg-warnsoft/60" : "border-line bg-surface2/60")}>
                  <div className="font-display text-[16px] font-semibold">{s.v}</div>
                  <div className="mt-0.5 text-[10.5px] font-medium text-mut">{s.l}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-medium uppercase tracking-wide text-mut">Contact</span>
                <span className="text-[10.5px] text-mut">Source: {selected.source ?? "manual"}</span>
              </div>
              <div className="mt-2 space-y-1.5 text-[13px]">
                {selected.email && <div className="flex items-center gap-2"><Icon name="chat" size={13} className="text-mut" />{selected.email}</div>}
                {selected.address && <div className="flex items-center gap-2"><Icon name="pin" size={13} className="text-mut" />{selected.address}, {selected.suburb}</div>}
                <div className="flex items-center gap-2"><Icon name="calendar" size={13} className="text-mut" />Last booking: {selected.lastBooking ? formatDate(selected.lastBooking) : "never"}</div>
              </div>
              {selected.notes && <p className="mt-2.5 border-t border-line pt-2.5 text-[12.5px] leading-relaxed text-mut">{selected.notes}</p>}
            </div>

            <div>
              <h4 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-mut">Timeline</h4>
              {timeline.length === 0 && <p className="text-[12.5px] text-mut">No recent activity for this customer.</p>}
              <div className="relative space-y-3 before:absolute before:bottom-1 before:left-[11px] before:top-1 before:w-px before:bg-line">
                {timeline.map((e) => (
                  <div key={`${e.kind}-${e.id}`} className="relative flex gap-3">
                    <span className={cn("z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ring-surface", e.kind === "payment" ? "bg-oksoft text-ok" : e.kind === "invoice" ? "bg-warnsoft text-warn" : e.kind === "lead" ? "bg-infosoft text-info" : e.kind === "job" ? "bg-brandsoft text-brand" : "bg-surface2 text-mut")}>
                      <Icon name={kindIcon[e.kind] ?? "info"} size={11} />
                    </span>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="text-[12.5px] font-medium leading-snug">
                        {e.title}
                        {e.value && <span className="ml-1.5 text-brand">{e.value}</span>}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-mut">
                        {e.detail} · {timeAgo(e.at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <CustomerModal open={newOpen || autoOpen} onClose={() => { setNewOpen(false); setAutoOpen(false); if (window.location.search.includes("new=")) window.history.replaceState(null, "", "/dashboard/customers"); }} onDone={load} />
    </div>
  );
}

function CustomerModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", suburb: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toast = useToast();

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/customers", { method: "POST", body: f });
      toast(`${f.name} added to your CRM.`, "ok");
      onDone();
      onClose();
      setF({ name: "", phone: "", email: "", address: "", suburb: "", notes: "" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New customer" wide>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Full name" className="col-span-2 sm:col-span-1">
          <input className="input" value={f.name} onChange={set("name")} placeholder="e.g. Sarah van Wyk" />
        </Field>
        <Field label="Phone / WhatsApp">
          <input className="input" value={f.phone} onChange={set("phone")} placeholder="082 123 4567" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={f.email} onChange={set("email")} placeholder="name@example.co.za" />
        </Field>
        <Field label="Address">
          <input className="input" value={f.address} onChange={set("address")} placeholder="12 Regent Road" />
        </Field>
        <Field label="Suburb">
          <input className="input" value={f.suburb} onChange={set("suburb")} placeholder="Sea Point" />
        </Field>
        <Field label="Notes" className="col-span-2">
          <textarea className="input min-h-[60px] resize-y" value={f.notes} onChange={set("notes")} placeholder="Preferences, access notes, anything useful…" />
        </Field>
      </div>
      {error && <div className="mt-3 rounded-lg bg-dangersoft px-3 py-2 text-[12.5px] font-medium text-danger">{error}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !f.name.trim()}>
          {busy ? "Adding…" : "Add customer"}
        </Button>
      </div>
    </Modal>
  );
}
