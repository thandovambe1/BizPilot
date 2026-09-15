"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, daysOverdue, formatZAR, todayISO } from "@/lib/utils";
import { Badge, Button, Card, Drawer, EmptyState, Field, Icon, Modal, StatusBadge, useToast } from "@/components/ui";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "open", label: "Open" },
  { id: "paid", label: "Paid" },
];

export default function InvoicesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [payFor, setPayFor] = useState<any>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new") === "1");
  const toast = useToast();

  const load = useCallback(() => {
    api<{ items: any[] }>("/invoices")
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const visible = items.filter((q) => {
    if (filter === "overdue") return q.status === "overdue";
    if (filter === "paid") return q.status === "paid";
    if (filter === "open") return ["sent", "viewed", "partial"].includes(q.status);
    return true;
  });

  const outstanding = items.reduce((s, i) => (["sent", "viewed", "partial", "overdue"].includes(i.status) ? s + Number(i.balance ?? 0) : s), 0);
  const overdue = items.filter((i) => i.status === "overdue").reduce((s, i) => s + Number(i.balance ?? 0), 0);

  const openDetail = async (id: string) => {
    const r = await api<any>(`/invoices/${id}`);
    setDetail(r);
  };

  const remind = (inv: any) => {
    window.dispatchEvent(new CustomEvent("bp:open-ai"));
    toast(`Ask BizPilot: “Send a payment reminder for ${inv.invoiceNumber}”`, "info");
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Invoices</h1>
          <p className="text-[12.5px] text-mut">
            {formatZAR(outstanding)} outstanding · {overdue > 0 ? <span className="font-semibold text-danger">{formatZAR(overdue)} overdue</span> : "nothing overdue"}
          </p>
        </div>
        <Button size="sm" icon="plus" onClick={() => setNewOpen(true)}>
          New invoice
        </Button>
      </div>

      <div className="flex w-fit rounded-lg border border-line bg-surface p-0.5 text-[12.5px] font-medium">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={cn("btn-focus rounded-md px-3.5 py-1.5 transition", filter === f.id ? "bg-brand text-white shadow-sm" : "text-mut hover:text-ink")}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface2" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={filter === "overdue" ? "No overdue invoices" : "No invoices here"}
          body={filter === "overdue" ? "You're all clear — when invoices pass their due date the AI Finance Agent flags them and can send reminders." : "Complete a job and the AI can turn it into an invoice in one click."}
          ctaLabel={filter === "overdue" ? undefined : "New invoice"}
          action={filter === "overdue" ? undefined : () => setNewOpen(true)}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface2/60 text-[11px] uppercase tracking-wide text-mut">
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Balance</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id} onClick={() => openDetail(i.id)} className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-surface2/60">
                    <td className="px-4 py-3 font-semibold">{i.invoiceNumber}</td>
                    <td className="px-4 py-3 text-mut">{i.customerName ?? "—"}</td>
                    <td className="px-4 py-3 font-display font-semibold">{formatZAR(i.total)}</td>
                    <td className={cn("px-4 py-3 font-medium", Number(i.balance) > 0 && i.status === "overdue" ? "text-danger" : "text-mut")}>{formatZAR(i.balance)}</td>
                    <td className="px-4 py-3 text-mut">
                      {i.status === "overdue" ? `${daysOverdue(i.dueDate)}d overdue` : new Date(i.dueDate + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {Number(i.balance) > 0 && !["cancelled"].includes(i.status) && (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="secondary" icon="wallet" onClick={() => setPayFor(i)}>Record payment</Button>
                          {i.status === "overdue" && <Button size="sm" variant="ghost" icon="send" onClick={() => remind(i)}>Remind</Button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <InvoiceDrawer detail={detail} setDetail={setDetail} onClose={() => setDetail(null)} onDone={load} setPayFor={setPayFor} remind={remind} />
      <PaymentModal inv={payFor} onClose={() => setPayFor(null)} onDone={load} />
      <InvoiceModal open={newOpen || autoOpen} onClose={() => { setNewOpen(false); setAutoOpen(false); if (window.location.search.includes("new=")) window.history.replaceState(null, "", "/dashboard/invoices"); }} onDone={load} />
    </div>
  );
}

function InvoiceDrawer({ detail, setDetail, onClose, onDone, setPayFor, remind }: { detail: any; setDetail: (d: any) => void; onClose: () => void; onDone: () => void; setPayFor: (i: any) => void; remind: (i: any) => void }) {
  const i = detail?.item;
  const [status, setStatus] = useState("");
  const toast = useToast();

  useEffect(() => setStatus(i?.status ?? ""), [i?.status, i?.id]);

  const cancelInvoice = async () => {
    await api("/invoices", { method: "PATCH", body: { id: i.id, status: "cancelled" } });
    toast("Invoice cancelled.", "info");
    setDetail({ ...detail, item: { ...i, status: "cancelled" } });
    onDone();
  };

  return (
    <Drawer open={!!i} onClose={onClose} title={i ? i.invoiceNumber : ""} sub={i ? `${i.customerName ?? "No customer"} · issued ${new Date(i.issueDate + "T00:00:00").toLocaleDateString("en-ZA")}` : undefined}>
      {i && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={i.status} />
            {i.status === "overdue" && <Badge tone="danger">{daysOverdue(i.dueDate)} days past due</Badge>}
            {i.lastReminderAt && <Badge tone="info">Last reminder {new Date(i.lastReminderAt).toLocaleDateString("en-ZA")}</Badge>}
          </div>

          <div className="rounded-xl border border-line bg-surface2/50">
            {(i.items ?? []).map((it: any) => (
              <div key={it.id} className="flex justify-between gap-3 border-b border-line/60 px-3.5 py-2.5 text-[13px] last:border-0">
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-[10.5px] uppercase tracking-wide text-mut">{Number(it.qty).toLocaleString("en-ZA")} × {formatZAR(it.unitPrice)}</div>
                </div>
                <div className="font-semibold">{formatZAR(it.amount)}</div>
              </div>
            ))}
            <div className="px-3.5 py-3 text-[13px]">
              <div className="flex justify-between text-mut"><span>Subtotal</span><span>{formatZAR(i.subtotal, true)}</span></div>
              <div className="flex justify-between text-mut"><span>VAT ({i.vatRate}%)</span><span>{formatZAR(i.vatAmount, true)}</span></div>
              <div className="flex justify-between text-mut"><span>Paid</span><span className="text-ok">-{formatZAR(i.paidAmount, true)}</span></div>
              <div className="mt-1.5 flex justify-between border-t border-line pt-2 font-display text-[16px] font-bold"><span>Balance</span><span>{formatZAR(Number(i.total) - Number(i.paidAmount), true)}</span></div>
            </div>
          </div>

          {i.payments?.length > 0 && (
            <div>
              <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-mut">Payment history</h4>
              <div className="space-y-1.5">
                {i.payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px]">
                    <span className="font-medium">{formatZAR(p.amount, true)}</span>
                    <span className="text-mut">{p.method.toUpperCase()} · {p.reference} · {new Date(p.createdAt).toLocaleDateString("en-ZA")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {Number(i.total) - Number(i.paidAmount) > 0 && !["cancelled"].includes(i.status) && (
              <Button size="sm" icon="wallet" onClick={() => setPayFor(i)}>Record payment</Button>
            )}
            {i.status === "overdue" && <Button size="sm" variant="secondary" icon="send" onClick={() => remind(i)}>Send reminder (AI)</Button>}
            {!["paid", "cancelled"].includes(i.status) && <Button size="sm" variant="ghost" onClick={cancelInvoice}>Cancel invoice</Button>}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function PaymentModal({ inv, onClose, onDone }: { inv: any; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(inv?.balance ?? inv?.total ?? ""));
  const [method, setMethod] = useState("eft");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<any>("/payments", { method: "POST", body: { invoiceId: inv.id, amount: Number(amount), method, reference: reference || undefined } });
      toast(`${method === "yoco" || method === "card" ? "Card payment via Yoco" : "Payment"} recorded — invoice ${r.status === "paid" ? "is fully paid" : "partially paid"}.`, "ok");
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!inv} onClose={onClose} title={`Record payment — ${inv?.invoiceNumber ?? ""}`}>
      <div className="space-y-3.5">
        <div className="rounded-xl bg-surface2 px-3.5 py-2.5 text-[13px]">
          <div className="flex justify-between text-mut"><span>Balance due</span><span className="font-semibold text-ink">{formatZAR(inv?.balance ?? 0, true)}</span></div>
        </div>
        <Field label="Amount (R)">
          <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Method">
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="eft">EFT (manual)</option>
            <option value="cash">Cash</option>
            <option value="card">Card — Yoco</option>
            <option value="other">Other</option>
          </select>
        </Field>
        {method === "card" && <div className="rounded-lg bg-warnsoft px-3 py-2 text-[12px] font-medium text-warn">Yoco is not configured yet, so card charging is disabled. Use EFT for now — the Yoco integration activates automatically once credentials are added.</div>}
        <Field label="Reference (optional)">
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Payment reference" />
        </Field>
        {error && <div className="rounded-lg bg-dangersoft px-3 py-2 text-[12.5px] font-medium text-danger">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !Number(amount) || (method === "card")}>{busy ? "Recording…" : "Record payment"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [f, setF] = useState({ customerId: "", quoteId: "", jobId: "", description: "", amount: "", dueDays: "7", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    api<{ items: any[] }>("/customers").then((r) => setCustomers(r.items)).catch(() => {});
    api<{ items: any[] }>("/quotes").then((r) => setQuotes(r.items.filter((q) => ["accepted", "sent", "viewed"].includes(q.status)))).catch(() => {});
    api<{ items: any[] }>("/jobs?view=all").then((r) => setJobs(r.items.filter((j) => j.status === "completed"))).catch(() => {});
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/invoices", {
        method: "POST",
        body: {
          customerId: f.customerId,
          quoteId: f.quoteId || undefined,
          jobId: f.jobId || undefined,
          amount: f.amount || undefined,
          dueDays: Number(f.dueDays),
          notes: f.description || f.notes,
        },
      });
      toast("Invoice issued and sent (in-app + WhatsApp/email mock channels).", "ok");
      onDone();
      onClose();
      setF({ customerId: "", quoteId: "", jobId: "", description: "", amount: "", dueDays: "7", notes: "" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New invoice" wide>
      <div className="space-y-3.5">
        <Field label="Customer">
          <select className="input" value={f.customerId} onChange={set("customerId")}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From accepted quote (optional)" hint="Line items are copied automatically">
            <select className="input" value={f.quoteId} onChange={set("quoteId")}>
              <option value="">None</option>
              {quotes.map((q) => <option key={q.id} value={q.id}>{q.quoteNumber} — {q.customerName} · {formatZAR(q.total)}</option>)}
            </select>
          </Field>
          <Field label="From completed job (optional)">
            <select className="input" value={f.jobId} onChange={set("jobId")}>
              <option value="">None</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.jobNumber} — {j.customerName ?? "customer"} · {j.service}</option>)}
            </select>
          </Field>
        </div>
        {!f.quoteId && !f.jobId && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Description">
              <input className="input" value={f.description} onChange={set("description")} placeholder="e.g. Geyser replacement" />
            </Field>
            <Field label="Amount (R, excl. VAT)">
              <input className="input" type="number" value={f.amount} onChange={set("amount")} placeholder="4850" />
            </Field>
          </div>
        )}
        <Field label="Payment terms">
          <select className="input" value={f.dueDays} onChange={set("dueDays")}>
            <option value="0">Due on receipt</option>
            <option value="7">Due in 7 days</option>
            <option value="14">Due in 14 days</option>
            <option value="30">Due in 30 days</option>
          </select>
        </Field>
        {error && <div className="rounded-lg bg-dangersoft px-3 py-2 text-[12.5px] font-medium text-danger">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !f.customerId}>{busy ? "Issuing…" : "Issue invoice"}</Button>
        </div>
      </div>
    </Modal>
  );
}
