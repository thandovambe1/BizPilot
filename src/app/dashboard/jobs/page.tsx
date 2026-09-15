"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatZAR, relativeDayLabel, todayISO } from "@/lib/utils";
import { Badge, Button, Card, Drawer, EmptyState, Field, Icon, Modal, StatusBadge, useToast } from "@/components/ui";

const NEXT_STEP: Record<string, { to: string; label: string; icon: string } | null> = {
  new: { to: "scheduled", label: "Schedule", icon: "calendar" },
  scheduled: { to: "confirmed", label: "Confirm", icon: "check" },
  confirmed: { to: "en_route", label: "En route", icon: "arrow-right" },
  en_route: { to: "on_site", label: "Arrived", icon: "pin" },
  on_site: { to: "in_progress", label: "Start job", icon: "play" },
  in_progress: { to: "completed", label: "Complete job", icon: "check" },
  completed: null,
  cancelled: null,
};

export default function JobsPage() {
  const [tab, setTab] = useState<"today" | "upcoming" | "all">("today");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new") === "1");
  const toast = useToast();

  const load = useCallback(() => {
    api<{ items: any[] }>(`/jobs?view=${tab === "all" ? "all" : tab}`)
      .then((r) => setJobs(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, status } : j)));
    try {
      await api("/jobs", { method: "PATCH", body: { id, status } });
      if (status === "completed") toast("Job completed. The AI Customer Success Agent will request a review.", "ok");
      if (detail?.item?.id === id) setDetail((d: any) => ({ ...d, item: { ...d.item, status } }));
      load();
    } catch (e: any) {
      toast(e.message, "danger");
      load();
    }
  };

  const openDetail = async (id: string) => {
    try {
      const r = await api<any>(`/jobs/${id}`);
      setDetail(r);
    } catch (e: any) {
      toast(e.message, "danger");
    }
  };

  const grouped: [string, any[]][] = [];
  for (const j of [...jobs].sort((a, b) => (a.date + a.startsAt).localeCompare(b.date + b.startsAt))) {
    const key = j.date;
    const g = grouped.find(([k]) => k === key);
    if (g) g[1].push(j);
    else grouped.push([key, [j]]);
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">Jobs</h1>
          <p className="text-[12.5px] text-mut">Job cards with technician workflow — schedule, dispatch, complete, invoice.</p>
        </div>
        <Button size="sm" icon="plus" onClick={() => setNewOpen(true)}>
          Schedule job
        </Button>
      </div>

      <div className="flex w-fit rounded-lg border border-line bg-surface p-0.5 text-[12.5px] font-medium">
        {(["today", "upcoming", "all"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("btn-focus rounded-md px-3.5 py-1.5 capitalize transition", tab === t ? "bg-brand text-white shadow-sm" : "text-mut hover:text-ink")}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface2" />)}</div>
      ) : jobs.length === 0 ? (
        <EmptyState icon="wrench" title={tab === "today" ? "No jobs today" : "No jobs scheduled"} body={tab === "today" ? "A quiet day. New bookings from WhatsApp land here automatically." : "Schedule your first job or let the AI book it for you — try “Book Sarah for tomorrow at 10” in the AI panel."} ctaLabel="Schedule a job" action={() => setNewOpen(true)} />
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, list]) => (
            <div key={date}>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-display text-[13px] font-semibold">{relativeDayLabel(date)}</span>
                <span className="text-[11.5px] text-mut">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "long" })} · {list.length} job{list.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {list.map((j) => {
                  const step = NEXT_STEP[j.status];
                  return (
                    <Card key={j.id} className="flex flex-wrap items-center gap-3 p-3.5 transition hover:shadow-md">
                      <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-surface2 px-2 py-1.5">
                        <span className="font-display text-[15px] font-bold text-brand">{j.startsAt}</span>
                        {j.endsAt && <span className="text-[10px] text-mut">→ {j.endsAt}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-semibold">{j.customerName ?? "Unassigned customer"}</span>
                          <Badge tone="neutral">{j.jobNumber}</Badge>
                          {j.priority === "emergency" && <Badge tone="danger">emergency</Badge>}
                          {j.priority === "high" && <Badge tone="warn">high priority</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-mut">
                          <span className="inline-flex items-center gap-1"><Icon name="wrench" size={11} />{j.service}</span>
                          {j.suburb && <span className="inline-flex items-center gap-1"><Icon name="pin" size={11} />{j.suburb}</span>}
                          <span className="inline-flex items-center gap-1"><Icon name="user" size={11} />{j.teamMemberName ?? "Unassigned"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={j.status} />
                        {step && (
                          <Button size="sm" variant={j.status === "in_progress" || j.status === "on_site" ? "primary" : "secondary"} icon={step.icon} onClick={() => setStatus(j.id, step.to)}>
                            {step.label}
                          </Button>
                        )}
                        <button onClick={() => openDetail(j.id)} className="btn-focus rounded-lg border border-line bg-surface p-2 text-mut shadow-sm hover:text-ink" aria-label={`Open ${j.jobNumber}`}>
                          <Icon name="chevron-right" size={14} />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <JobDrawer detail={detail} setDetail={setDetail} onClose={() => setDetail(null)} onStatus={setStatus} onDone={load} />
      <NewJobModal open={newOpen || autoOpen} onClose={() => { setNewOpen(false); setAutoOpen(false); if (window.location.search.includes("new=")) window.history.replaceState(null, "", "/dashboard/jobs"); }} onDone={load} />
    </div>
  );
}

function JobDrawer({ detail, setDetail, onClose, onStatus, onDone }: { detail: any; setDetail: (d: any) => void; onClose: () => void; onStatus: (id: string, s: string) => void; onDone: () => void }) {
  const [photo, setPhoto] = useState({ name: "", type: "after", caption: "" });
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const j = detail?.item;
  const step = j ? NEXT_STEP[j.status] : null;

  const uploadPhoto = async (file: File | null) => {
    if (!file || !j) return;
    if (file.size > 1_500_000) {
      toast("Photo is too large — please keep it under 1.5 MB.", "danger");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await api("/jobs/photos", { method: "POST", body: { jobId: j.id, name: file.name, type: photo.type, caption: photo.caption, url: dataUrl } });
      toast("Photo attached to the job card.", "ok");
      const r = await api<any>(`/jobs/${j.id}`);
      setDetail(r);
      setPhoto({ name: "", type: "after", caption: "" });
    } catch (e: any) {
      toast(e.message, "danger");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Drawer open={!!j} onClose={onClose} title={j ? `${j.jobNumber} — ${j.service}` : ""} sub={j ? `${relativeDayLabel(j.date)} · ${j.startsAt}${j.teamMemberName ? " · " + j.teamMemberName : ""}` : undefined}>
      {j && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={j.status} />
            {j.priority !== "normal" && <Badge tone={j.priority === "emergency" ? "danger" : "warn"}>{j.priority}</Badge>}
            {step && (
              <Button size="sm" icon={step.icon} onClick={() => onStatus(j.id, step.to)}>
                {step.label}
              </Button>
            )}
            {["scheduled", "confirmed"].includes(j.status) && (
              <Button size="sm" variant="ghost" onClick={async () => { await api("/jobs", { method: "PATCH", body: { id: j.id, status: "cancelled" } }); toast("Job cancelled.", "info"); setDetail(null); onDone(); }}>
                Cancel job
              </Button>
            )}
          </div>

          {j.customer && (
            <div className="rounded-xl border border-line bg-surface2/60 p-3.5">
              <div className="text-[10.5px] font-medium uppercase tracking-wide text-mut">Customer</div>
              <div className="mt-1.5 text-[14px] font-semibold">{j.customer.name}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-mut">
                {j.customer.phone && (
                  <a href={`tel:${j.customer.phone}`} className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
                    <Icon name="phone" size={12} />
                    {j.customer.phone}
                  </a>
                )}
                {(j.address || j.customer.address || j.suburb) && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${j.customer.address ?? ""} ${j.suburb ?? j.customer.suburb ?? ""} South Africa`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
                  >
                    <Icon name="pin" size={12} />
                    {j.address ?? j.customer.address ?? j.suburb ?? j.customer.suburb ?? "View on map"}
                  </a>
                )}
              </div>
            </div>
          )}

          {j.description && (
            <div className="rounded-xl border border-line bg-surface p-3.5">
              <div className="text-[10.5px] font-medium uppercase tracking-wide text-mut">Job details</div>
              <p className="mt-1.5 text-[13px] leading-relaxed">{j.description}</p>
              {j.notes && <p className="mt-2 border-t border-line pt-2 text-[12.5px] leading-relaxed text-mut">Notes: {j.notes}</p>}
            </div>
          )}

          <div>
            <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-mut">Photos & documents</h4>
            <div className="grid grid-cols-3 gap-2">
              {j.photos?.map((p: any) => (
                <div key={p.id} className="overflow-hidden rounded-lg border border-line bg-surface2">
                  {p.url ? (
                    <img src={p.url} alt={p.name} className="h-20 w-full object-cover" />
                  ) : (
                    <div className="flex h-20 items-center justify-center bg-surface2 text-mut"><Icon name="camera" size={20} /></div>
                  )}
                  <div className="px-2 py-1.5">
                    <div className="truncate text-[10.5px] font-medium">{p.caption ?? p.name}</div>
                    <Badge tone={p.type === "before" ? "info" : "ok"}>{p.type}</Badge>
                  </div>
                </div>
              ))}
              {(!j.photos || j.photos.length === 0) && <p className="col-span-3 py-4 text-center text-[12px] text-mut">No photos yet. Add before/after photos from the technician's phone.</p>}
            </div>
            <div className="mt-2.5 flex flex-wrap items-end gap-2">
              <Field label="Type">
                <select className="input w-28" value={photo.type} onChange={(e) => setPhoto((p) => ({ ...p, type: e.target.value }))}>
                  <option value="before">Before</option>
                  <option value="after">After</option>
                  <option value="document">Document</option>
                </select>
              </Field>
              <Field label="Caption" className="min-w-[140px] flex-1">
                <input className="input" value={photo.caption} onChange={(e) => setPhoto((p) => ({ ...p, caption: e.target.value }))} placeholder="New geyser installed" />
              </Field>
              <label className="btn-focus inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 text-[13px] font-medium shadow-sm transition hover:border-linestrong">
                <Icon name="camera" size={15} />
                {uploading ? "Uploading…" : "Add photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function NewJobModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [f, setF] = useState({ customerId: "", service: "", date: todayISO(), startsAt: "09:00", teamMemberId: "", address: "", suburb: "", description: "", priority: "normal" });
  const [slot, setSlot] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    api<{ items: any[] }>("/customers").then((r) => setCustomers(r.items)).catch(() => {});
    api<{ items: any[] }>("/services").then((r) => setServices(r.items.filter((s) => s.active))).catch(() => {});
    api<{ items: any[] }>("/team").then((r) => setTeam(r.items.filter((t) => t.active))).catch(() => {});
  }, [open]);

  const checkSlot = useCallback(async () => {
    if (!f.date) return;
    const dur = services.find((s) => s.name === f.service)?.durationMinutes ?? 60;
    try {
      const r = await api<any>(`/team/availability?date=${f.date}&start=${f.startsAt}&durationMin=${dur}${f.teamMemberId ? `&member=${f.teamMemberId}` : ""}`);
      setSlot(r);
    } catch {
      setSlot(null);
    }
  }, [f.date, f.startsAt, f.teamMemberId, f.service, services]);

  useEffect(() => {
    if (open) checkSlot();
  }, [checkSlot, open]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const cust = customers.find((c) => c.id === f.customerId);
      const tm = team.find((t) => t.id === f.teamMemberId);
      const svc = services.find((s) => s.name === f.service);
      await api("/jobs", {
        method: "POST",
        body: {
          customerId: f.customerId || undefined,
          customerName: cust?.name,
          service: f.service,
          serviceId: svc?.id,
          date: f.date,
          startsAt: slot?.ok ? slot.time : f.startsAt,
          teamMemberId: tm?.id,
          teamMemberName: tm?.name,
          address: f.address || cust?.address,
          suburb: f.suburb || cust?.suburb,
          description: f.description,
          priority: f.priority,
        },
      });
      toast(`Job scheduled for ${f.date} at ${slot?.ok ? slot.time : f.startsAt}.`, "ok");
      onDone();
      onClose();
      setF({ customerId: "", service: "", date: todayISO(), startsAt: "09:00", teamMemberId: "", address: "", suburb: "", description: "", priority: "normal" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule a job" wide>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Customer">
          <select className="input" value={f.customerId} onChange={set("customerId")}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.suburb ? ` — ${c.suburb}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Service">
          <select className="input" value={f.service} onChange={set("service")}>
            <option value="">Select service…</option>
            {services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" className="input" value={f.date} onChange={set("date")} />
        </Field>
        <Field label="Start time">
          <input type="time" className="input" value={f.startsAt} onChange={set("startsAt")} />
        </Field>
        <Field label="Technician">
          <select className="input" value={f.teamMemberId} onChange={set("teamMemberId")}>
            <option value="">Auto-assign (best available)</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="input" value={f.priority} onChange={set("priority")}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="emergency">Emergency</option>
          </select>
        </Field>
        <Field label="Address override (optional)">
          <input className="input" value={f.address} onChange={set("address")} placeholder="Defaults to customer address" />
        </Field>
        <Field label="Suburb">
          <input className="input" value={f.suburb} onChange={set("suburb")} placeholder="Defaults to customer suburb" />
        </Field>
        <Field label="Job description" className="col-span-2">
          <textarea className="input min-h-[60px] resize-y" value={f.description} onChange={set("description")} placeholder="What needs to be done, parts to bring, access notes…" />
        </Field>
      </div>

      {slot && (
        <div className={cn("mt-3.5 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[12.5px] leading-snug", slot.ok ? "border border-ok/30 bg-oksoft text-ink" : "border border-danger/30 bg-dangersoft text-ink")}>
          <Icon name={slot.ok ? "check" : "alert"} size={15} className={cn("mt-0.5 shrink-0", slot.ok ? "text-ok" : "text-danger")} />
          {slot.ok ? (
            <span>
              <strong>{slot.member.name}</strong> is available {slot.suggested ? `at ${slot.time} (next free slot)` : `at ${f.startsAt}`} on {f.date}. Booking at <strong>{slot.time}</strong>.
            </span>
          ) : (
            <span>{slot.reason}</span>
          )}
        </div>
      )}
      {error && <div className="mt-3 rounded-lg bg-dangersoft px-3 py-2 text-[12.5px] font-medium text-danger">{error}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !f.date || !f.service || !f.customerId}>
          {busy ? "Scheduling…" : "Schedule job"}
        </Button>
      </div>
    </Modal>
  );
}
