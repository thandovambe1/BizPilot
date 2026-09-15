"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BUSINESS_TYPES, SA_PROVINCES, cn, formatZAR, timeAgo } from "@/lib/utils";
import { Badge, Button, Card, Field, Icon, Modal, StatusBadge, Toggle, useToast } from "@/components/ui";

const TABS = [
  { id: "profile", label: "Business", icon: "building" },
  { id: "services", label: "Services", icon: "wrench" },
  { id: "team", label: "Team", icon: "users" },
  { id: "hours", label: "Hours & Areas", icon: "clock" },
  { id: "ai", label: "AI Settings", icon: "sparkles" },
  { id: "knowledge", label: "Knowledge", icon: "book" },
  { id: "integrations", label: "Integrations", icon: "zap" },
  { id: "subscription", label: "Subscription", icon: "card" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("tab") ?? "profile");
  const [business, setBusiness] = useState<any>(null);

  const load = useCallback(() => {
    api<any>("/business").then(setBusiness).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const go = (t: string) => {
    setTab(t);
    window.history.replaceState(null, "", `/dashboard/settings?tab=${t}`);
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div>
        <h1 className="font-display text-[20px] font-semibold tracking-tight">Settings</h1>
        <p className="text-[12.5px] text-mut">Business profile, pricing, team, AI behaviour and billing.</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => go(t.id)} className={cn("btn-focus flex shrink-0 items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[12.5px] font-medium transition", tab === t.id ? "border-brand bg-brandsoft text-brandstrong" : "border-line bg-surface text-mut hover:text-ink")}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {!business ? (
        <Card className="p-10 text-center text-[13px] text-mut">Loading settings…</Card>
      ) : (
        <>
          {tab === "profile" && <ProfileTab business={business} onSaved={load} />}
          {tab === "services" && <ServicesTab onSaved={load} />}
          {tab === "team" && <TeamTab />}
          {tab === "hours" && <HoursTab hours={business.workingHours} areas={business.business} />}
          {tab === "ai" && <AiTab business={business} onSaved={load} />}
          {tab === "knowledge" && <KnowledgeTab />}
          {tab === "integrations" && <IntegrationsTab integrations={business.integrations} onSaved={load} />}
          {tab === "subscription" && <SubscriptionTab business={business} trialDays={business.trialDays} onSaved={load} />}
        </>
      )}
    </div>
  );
}

/* ----------------------------- Profile ----------------------------- */

function ProfileTab({ business, onSaved }: { business: any; onSaved: () => void }) {
  const b = business.business;
  const [f, setF] = useState({ name: b.name, type: b.type ?? "", ownerName: b.ownerName ?? "", phone: b.phone ?? "", email: b.email ?? "", whatsapp: b.whatsapp ?? "", province: b.province ?? "", city: b.city ?? "", serviceArea: b.serviceArea ?? "", description: b.description ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toast = useToast();

  const save = async () => {
    setBusy(true);
    try {
      await api("/business", { method: "PUT", body: f });
      toast("Business profile saved. The AI updates its knowledge immediately.", "ok");
      onSaved();
    } catch (e: any) {
      toast(e.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-2xl p-5">
      <h3 className="font-display text-[15px] font-semibold">Business profile</h3>
      <p className="mb-4 mt-0.5 text-[12px] text-mut">This is what the AI represents you by — keep it accurate.</p>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Business name"><input className="input" value={f.name} onChange={set("name")} /></Field>
        <Field label="Business type">
          <select className="input" value={f.type} onChange={set("type")}>
            <option value="">Select…</option>
            {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Owner name"><input className="input" value={f.ownerName} onChange={set("ownerName")} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set("phone")} placeholder="+27 21 …" /></Field>
        <Field label="Email"><input className="input" value={f.email} onChange={set("email")} /></Field>
        <Field label="WhatsApp number"><input className="input" value={f.whatsapp} onChange={set("whatsapp")} placeholder="+27 82 …" /></Field>
        <Field label="Province">
          <select className="input" value={f.province} onChange={set("province")}>
            <option value="">Select…</option>
            {SA_PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="City"><input className="input" value={f.city} onChange={set("city")} /></Field>
        <Field label="Service area" className="col-span-2"><input className="input" value={f.serviceArea} onChange={set("serviceArea")} placeholder="e.g. Cape Town northern & southern suburbs" /></Field>
        <Field label="Description" className="col-span-2">
          <textarea className="input min-h-[80px] resize-y" value={f.description} onChange={set("description")} placeholder="What you do, how long you've been trading, what you're known for…" />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
      </div>
    </Card>
  );
}

/* ----------------------------- Services ----------------------------- */

function ServicesTab({ onSaved }: { onSaved: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const toast = useToast();
  const load = useCallback(() => api<{ items: any[] }>("/services").then((r) => setItems(r.items)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async (f: any) => {
    try {
      await api("/services", { method: "POST", body: f });
      toast(f.id ? "Service updated — the AI now uses the new price." : "Service added to your AI's knowledge.", "ok");
      setEditing(null);
      load();
      onSaved();
    } catch (e: any) {
      toast(e.message, "danger");
    }
  };

  const remove = async (id: string) => {
    await api("/services", { method: "DELETE", body: { id } });
    toast("Service removed.", "info");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-mut">The AI only quotes from these prices. Never invents numbers.</p>
        <Button size="sm" icon="plus" onClick={() => setEditing({ name: "", description: "", category: "general", basePrice: "", pricingType: "fixed", durationMinutes: 60, isEmergency: false, active: true })}>
          Add service
        </Button>
      </div>
      {items.map((s) => (
        <Card key={s.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold">{s.name}</span>
              {!s.active && <Badge tone="neutral">inactive</Badge>}
              {s.isEmergency && <Badge tone="danger">emergency</Badge>}
            </div>
            <div className="mt-0.5 text-[12px] text-mut">
              {s.description} · {s.durationMinutes} min · {s.pricingType.replace("_", " ")}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-[15px] font-semibold">{s.basePrice ? formatZAR(s.basePrice) : "no price"}</div>
            <div className="text-[10.5px] text-mut">{s.basePrice && s.pricingType === "starting_from" ? "starting from" : s.pricingType === "hourly" ? "per hour" : "fixed"}</div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(s)}>Edit</Button>
            <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(s.id)} aria-label={`Delete ${s.name}`} />
          </div>
        </Card>
      ))}
      {items.length === 0 && <Card className="p-10 text-center text-[13px] text-mut">No services yet. Add what you offer and price it.</Card>}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "Edit service" : "Add service"} wide>
          <ServiceForm initial={editing} onDone={save} />
        </Modal>
      )}
    </div>
  );
}

function ServiceForm({ initial, onDone }: { initial: any; onDone: (f: any) => void }) {
  const [f, setF] = useState({ ...initial, basePrice: initial.basePrice ? String(initial.basePrice) : "" });
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3.5">
      <Field label="Service name"><input className="input" value={f.name} onChange={set("name")} placeholder="e.g. Geyser replacement & installation" /></Field>
      <Field label="Description"><input className="input" value={f.description ?? ""} onChange={set("description")} placeholder="What's included…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pricing type">
          <select className="input" value={f.pricingType} onChange={set("pricingType")}>
            <option value="fixed">Fixed price</option>
            <option value="starting_from">Starting from</option>
            <option value="hourly">Hourly</option>
            <option value="custom">Custom quote</option>
          </select>
        </Field>
        <Field label={f.pricingType === "hourly" ? "Price per hour (R)" : "Base price (R)"} hint={f.pricingType === "custom" ? "Leave blank — AI will ask for a quote" : undefined}>
          <input className="input" type="number" value={f.basePrice} onChange={set("basePrice")} placeholder="1450" />
        </Field>
        <Field label="Est. duration (minutes)">
          <input className="input" type="number" value={String(f.durationMinutes)} onChange={(e) => setF((x: any) => ({ ...x, durationMinutes: Number(e.target.value) }))} />
        </Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={set("category")}>
            {["plumbing", "electrical", "general"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <Toggle checked={!!f.isEmergency} onChange={(v) => setF((x: any) => ({ ...x, isEmergency: v }))} label="Emergency service" />
          Emergency service
        </label>
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <Toggle checked={f.active !== false} onChange={(v) => setF((x: any) => ({ ...x, active: v }))} label="Active" />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => window.history.back()}>Cancel</Button>
        <Button
          onClick={async () => {
            setBusy(true);
            onDone({ ...f, basePrice: f.basePrice === "" ? null : Number(f.basePrice) });
          }}
          disabled={busy || !f.name.trim()}
        >
          {busy ? "Saving…" : "Save service"}
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- Team ----------------------------- */

function TeamTab() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const toast = useToast();
  const load = useCallback(() => api<{ items: any[] }>("/team").then((r) => setItems(r.items)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-mut">Technicians the AI scheduling agent can book jobs onto.</p>
        <Button size="sm" icon="plus" onClick={() => setEditing({ name: "", role: "technician", phone: "", email: "", skills: "", serviceAreas: "", workingHours: "" })}>
          Add team member
        </Button>
      </div>
      {items.map((tm) => (
        <Card key={tm.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold">{tm.name}</div>
            <div className="mt-0.5 text-[12px] text-mut">{tm.role} · {tm.workingHours ?? "flexible"}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(tm.skills ?? []).map((s: string) => <Badge key={s} tone="brand">{s}</Badge>)}
              {(tm.serviceAreas ?? []).map((s: string) => <Badge key={s} tone="neutral">{s}</Badge>)}
            </div>
          </div>
          {tm.phone && <a href={`tel:${tm.phone}`} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline"><Icon name="phone" size={13} />{tm.phone}</a>}
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(tm)}>Edit</Button>
            <Button size="sm" variant="ghost" icon="trash" aria-label="Remove" onClick={async () => { await api("/team", { method: "DELETE", body: { id: tm.id } }); load(); }} />
          </div>
        </Card>
      ))}
      {items.length === 0 && <Card className="p-10 text-center text-[13px] text-mut">No team yet. Add your technicians with skills and service areas.</Card>}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "Edit team member" : "Add team member"} wide>
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><input className="input" value={editing.name} onChange={(e) => setEditing((x: any) => ({ ...x, name: e.target.value }))} /></Field>
              <Field label="Role">
                <select className="input" value={editing.role} onChange={(e) => setEditing((x: any) => ({ ...x, role: e.target.value }))}>
                  {["technician", "Plumber", "Plumber / Handyman", "Electrician", "Handyman", "Supervisor"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Phone"><input className="input" value={editing.phone ?? ""} onChange={(e) => setEditing((x: any) => ({ ...x, phone: e.target.value }))} /></Field>
              <Field label="Email"><input className="input" value={editing.email ?? ""} onChange={(e) => setEditing((x: any) => ({ ...x, email: e.target.value }))} /></Field>
              <Field label="Skills (comma separated)"><input className="input" value={Array.isArray(editing.skills) ? editing.skills.join(", ") : editing.skills ?? ""} onChange={(e) => setEditing((x: any) => ({ ...x, skills: e.target.value }))} placeholder="geysers, drains" /></Field>
              <Field label="Service areas (comma separated)"><input className="input" value={Array.isArray(editing.serviceAreas) ? editing.serviceAreas.join(", ") : editing.serviceAreas ?? ""} onChange={(e) => setEditing((x: any) => ({ ...x, serviceAreas: e.target.value }))} placeholder="Northern Suburbs, Central" /></Field>
              <Field label="Working hours" className="col-span-2"><input className="input" value={editing.workingHours ?? ""} onChange={(e) => setEditing((x: any) => ({ ...x, workingHours: e.target.value }))} placeholder="Mon–Fri 07:30–17:00" /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                onClick={async () => {
                  const payload = { ...editing, skills: String(editing.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean), serviceAreas: String(editing.serviceAreas ?? "").split(",").map((s: string) => s.trim()).filter(Boolean) };
                  try {
                    await api("/team", { method: "POST", body: payload });
                    toast("Team member saved.", "ok");
                    setEditing(null);
                    load();
                  } catch (e: any) {
                    toast(e.message, "danger");
                  }
                }}
                disabled={!editing.name.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------------------- Hours ----------------------------- */

function HoursTab({ hours, areas }: { hours: any[]; areas: any }) {
  const [days, setDays] = useState<any[]>(
    Array.from({ length: 7 }, (_, i) => {
      const h = hours.find((x: any) => x.day === i);
      return { day: i, opensAt: h?.opensAt ?? "08:00", closesAt: h?.closesAt ?? "17:00", isClosed: h?.isClosed ?? false };
    })
  );
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="font-display text-[15px] font-semibold">Working hours</h3>
        <p className="mb-4 mt-0.5 text-[12px] text-mut">The AI scheduling agent will never book outside these hours.</p>
        <div className="space-y-2.5">
          {days.map((d) => (
            <div key={d.day} className="flex items-center gap-3">
              <span className="w-24 text-[12.5px] font-medium">{DAY_NAMES[d.day]}</span>
              {d.isClosed ? (
                <Badge tone="neutral">Closed</Badge>
              ) : (
                <>
                  <input type="time" className="input w-28" value={d.opensAt} onChange={(e) => setDays((xs) => xs.map((x) => (x.day === d.day ? { ...x, opensAt: e.target.value } : x)))} aria-label={`${DAY_NAMES[d.day]} opens`} />
                  <span className="text-[12px] text-mut">to</span>
                  <input type="time" className="input w-28" value={d.closesAt} onChange={(e) => setDays((xs) => xs.map((x) => (x.day === d.day ? { ...x, closesAt: e.target.value } : x)))} aria-label={`${DAY_NAMES[d.day]} closes`} />
                </>
              )}
              <button onClick={() => setDays((xs) => xs.map((x) => (x.day === d.day ? { ...x, isClosed: !x.isClosed } : x)))} className={cn("btn-focus ml-auto rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition", d.isClosed ? "border-danger/30 bg-dangersoft text-danger" : "border-line bg-surface text-mut hover:text-ink")}>
                {d.isClosed ? "Reopen" : "Close"}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={async () => {
              setBusy(true);
              try {
                await api("/business/hours", { method: "PUT", body: { days } });
                toast("Working hours saved.", "ok");
              } catch (e: any) {
                toast(e.message, "danger");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save hours"}
          </Button>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-display text-[15px] font-semibold">Service areas</h3>
        <p className="mb-3 mt-0.5 text-[12px] text-mut">The AI checks these when qualifying leads.</p>
        <div className="space-y-2 text-[13.5px]">
          <div className="flex items-center gap-2"><Icon name="pin" size={14} className="text-brand" /><span className="font-semibold">{areas.city ?? "—"}</span><span className="text-mut">, {areas.province ?? ""}</span></div>
          <div className="rounded-xl bg-surface2 px-3.5 py-3 text-[13px] leading-relaxed">{areas.serviceArea || "No service area defined yet — update it in the Business tab."}</div>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- AI ----------------------------- */

function AiTab({ business, onSaved }: { business: any; onSaved: () => void }) {
  const s = business.settings;
  const [tone, setTone] = useState(s?.aiTone ?? "friendly");
  const [autonomy, setAutonomy] = useState(s?.aiAutonomy ?? "confirm");
  const [rules, setRules] = useState<string[]>(s?.businessRules ?? []);
  const [newRule, setNewRule] = useState("");
  const [autoReminders, setAutoReminders] = useState(s?.autoReminders ?? true);
  const [agents, setAgents] = useState<any[]>(business.agents ?? []);
  const [activity, setActivity] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api<{ items: any[] }>("/ai/activity").then((r) => setActivity(r.items)).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api("/business/settings", { method: "PUT", body: { aiTone: tone, aiAutonomy: autonomy, businessRules: rules, autoReminders } });
      toast("AI settings saved — changes apply to the next conversation.", "ok");
      onSaved();
    } catch (e: any) {
      toast(e.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="font-display text-[15px] font-semibold">AI behaviour</h3>
        <div className="mt-4">
          <div className="mb-2 text-[12.5px] font-medium text-mut">Tone of voice</div>
          <div className="flex flex-wrap gap-2">
            {["friendly", "professional", "casual", "formal"].map((t) => (
              <button key={t} onClick={() => setTone(t)} className={cn("btn-focus rounded-lg border px-3 py-1.5 text-[12.5px] font-medium capitalize transition", tone === t ? "border-brand bg-brandsoft text-brandstrong" : "border-line bg-surface text-mut")}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 text-[12.5px] font-medium text-mut">Autonomy</div>
          <div className="space-y-2">
            {[
              ["suggest", "Suggest only", "The AI shows what it would do. Nothing happens without you."],
              ["confirm", "Ask before actions", "Reminders, quotes and bookings show a confirmation card first. (Recommended)"],
              ["autonomous", "Automate routine tasks", "Payment reminders and follow-ups run automatically. Quotes and bookings still confirm."],
            ].map(([id, label, sub]) => (
              <label key={id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition", autonomy === id ? "border-brand bg-brandsoft/50" : "border-line")}>
                <input type="radio" name="autonomy" checked={autonomy === id} onChange={() => setAutonomy(id)} className="mt-1 accent-[var(--bp-brand)]" />
                <span>
                  <span className="block text-[13px] font-semibold">{label}</span>
                  <span className="block text-[11.5px] leading-snug text-mut">{sub}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-xl border border-line bg-surface2/60 px-3.5 py-3">
          <div>
            <div className="text-[13px] font-semibold">Automatic payment reminders</div>
            <div className="text-[11.5px] text-mut">AI Finance Agent chases overdue invoices on your reminder schedule</div>
          </div>
          <Toggle checked={autoReminders} onChange={setAutoReminders} label="Automatic reminders" />
        </div>
        <div className="mt-5">
          <div className="mb-2 text-[12.5px] font-medium text-mut">Business rules the AI must follow</div>
          <div className="space-y-2">
            {rules.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px]">
                <Icon name="shield" size={13} className="shrink-0 text-brand" />
                <span className="flex-1">{r}</span>
                <button onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} className="btn-focus text-mut hover:text-danger" aria-label="Remove rule">
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newRule.trim()) {
                setRules((rs) => [...rs, newRule.trim()]);
                setNewRule("");
              }
            }}
          >
            <input className="input flex-1" value={newRule} onChange={(e) => setNewRule(e.target.value)} placeholder="e.g. Never schedule after 17:00" />
            <Button type="submit" variant="secondary" size="sm" icon="plus" disabled={!newRule.trim()}>Add</Button>
          </form>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save AI settings"}</Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="font-display text-[15px] font-semibold">AI agents</h3>
          <p className="mb-3 mt-0.5 text-[12px] text-mut">Each agent handles a slice of the business. Disable any at any time.</p>
          <div className="space-y-2">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface2/50 px-3.5 py-2.5">
                <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", a.active ? "bg-brandsoft text-brand" : "bg-surface2 text-mut")}>
                  <Icon name={a.key === "finance" ? "wallet" : a.key === "sales" ? "target" : a.key === "scheduling" ? "calendar" : a.key === "success" ? "star" : a.key === "analyst" ? "chart" : a.key === "ceo" ? "sparkles" : "chat"} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{a.name}</div>
                  <div className="truncate text-[11.5px] text-mut">{a.role}</div>
                </div>
                <Toggle
                  checked={a.active}
                  onChange={async (v) => {
                    setAgents((as) => as.map((x) => (x.id === a.id ? { ...x, active: v } : x)));
                    await api("/business/agents", { method: "PUT", body: { key: a.key, active: v } });
                    toast(`${a.name} ${v ? "enabled" : "disabled"}.`, "info");
                  }}
                  label={a.name}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-[15px] font-semibold">AI activity log</h3>
          <p className="mb-3 mt-0.5 text-[12px] text-mut">Every AI action, who confirmed it, and the result. Full audit trail.</p>
          <div className="max-h-[340px] space-y-2 overflow-y-auto">
            {activity.map((a) => (
              <div key={a.id} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <div className="flex items-center gap-2 text-[12px]">
                  <Icon name="sparkles" size={12} className="text-brand" />
                  <span className="font-semibold">{a.agent}</span>
                  <span className="text-mut">{a.action.replace(/_/g, " ")}</span>
                  <span className="ml-auto"><StatusBadge status={a.status === "executed" ? "completed" : a.status} /></span>
                </div>
                {a.result && <div className="mt-1 line-clamp-2 text-[11.5px] text-mut">{a.result}</div>}
                <div className="mt-1 text-[10.5px] text-mut/70">{timeAgo(a.createdAt)}</div>
              </div>
            ))}
            {activity.length === 0 && <p className="py-6 text-center text-[12.5px] text-mut">No AI actions yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------- Knowledge ----------------------------- */

function KnowledgeTab() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const load = useCallback(() => api<{ items: any[] }>(`/knowledge?q=${encodeURIComponent(q)}`).then((r) => setItems(r.items)).catch(() => {}), [q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" aria-label="Search knowledge base" />
        </div>
        <Button size="sm" icon="plus" onClick={() => setAdding(true)}>
          Add document
        </Button>
      </div>
      <p className="text-[12px] text-mut">Price lists, policies and FAQs the AI draws on when answering customers. PDFs and images can be attached; text is indexed immediately.</p>
      <div className="grid gap-2.5 md:grid-cols-2">
        {items.map((d) => (
          <Card key={d.id} className="flex items-start gap-3 p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brandsoft text-brand">
              <Icon name={d.type === "price_list" ? "wallet" : d.type === "faq" ? "chat" : d.type === "terms" ? "shield" : "book"} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold">{d.name}</span>
                <StatusBadge status={d.status === "ready" ? "completed" : "in_progress"} />
              </div>
              <div className="mt-0.5 text-[11.5px] text-mut capitalize">{d.type.replace("_", " ")} · {d.chunks} chunks indexed</div>
              {d.content && <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-mut">{d.content}</p>}
            </div>
            <button onClick={async () => { await api("/knowledge", { method: "DELETE", body: { id: d.id } }); toast("Document removed.", "info"); load(); }} className="btn-focus rounded-lg p-1.5 text-mut hover:text-danger" aria-label="Delete document">
              <Icon name="trash" size={14} />
            </button>
          </Card>
        ))}
      </div>
      {items.length === 0 && <Card className="p-10 text-center text-[13px] text-mut">Nothing here yet. Upload your price list and the AI will quote from it.</Card>}

      {adding && <KnowledgeModal onClose={() => setAdding(false)} onDone={load} />}
    </div>
  );
}

function KnowledgeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("price_list");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Modal open onClose={onClose} title="Add to knowledge base" wide>
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Document name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Price list 2026" /></Field>
          <Field label="Type">
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {["price_list", "policy", "faq", "terms", "manual", "document"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Content" hint="Paste the text now. PDF attachments stream in the production build.">
          <textarea className="input min-h-[140px] resize-y" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Geyser repair from R1 450…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={async () => {
              setBusy(true);
              try {
                await api("/knowledge", { method: "POST", body: { name, type, content } });
                toast("Document indexed. The AI now knows about it.", "ok");
                onDone();
                onClose();
              } catch (e: any) {
                toast(e.message, "danger");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy || !name.trim()}
          >
            {busy ? "Indexing…" : "Add document"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------- Integrations ----------------------------- */

function IntegrationsTab({ integrations, onSaved }: { integrations: any[]; onSaved: () => void }) {
  const toast = useToast();
  const [connecting, setConnecting] = useState<string | null>(null);
  const defs: Record<string, { icon: string; title: string; sub: string }> = {
    whatsapp: { icon: "chat", title: "WhatsApp Business", sub: "Conversations, reminders and AI replies over WhatsApp" },
    yoco: { icon: "card", title: "Yoco Payments", sub: "Card payments and online checkout for invoices" },
    email: { icon: "send", title: "Email", sub: "Transactional emails: invoices, reminders, reports" },
    google_calendar: { icon: "calendar", title: "Google Calendar", sub: "Sync jobs and availability (planned)" },
  };
  const get = (p: string) => integrations.find((i) => i.provider === p);
  const connect = async (provider: string, phone?: string) => {
    setConnecting(provider);
    try {
      const r = await api<any>("/business/integrations", { method: "POST", body: { provider, phone } });
      toast(r.mock ? `${defs[provider].title} set to pending — mock provider active until credentials are configured.` : `${defs[provider].title} connected.`, r.mock ? "info" : "ok");
      onSaved();
    } catch (e: any) {
      toast(e.message, "danger");
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Object.entries(defs).map(([provider, d]) => {
        const row = get(provider);
        const status = row?.status ?? "disconnected";
        const isConfigured = status === "connected";
        return (
          <Card key={provider} className="flex items-start gap-3.5 p-4">
            <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", isConfigured ? "bg-oksoft text-ok" : status === "pending" ? "bg-warnsoft text-warn" : "bg-surface2 text-mut")}>
              <Icon name={d.icon} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold">{d.title}</span>
                <Badge tone={isConfigured ? "ok" : status === "pending" ? "warn" : "neutral"}>{isConfigured ? "connected" : status === "pending" ? "pending" : "not connected"}</Badge>
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-mut">{d.sub}</p>
              {!isConfigured && status !== "pending" && provider !== "google_calendar" && (
                <Button size="sm" variant="secondary" className="mt-2.5" disabled={connecting === provider} onClick={() => connect(provider)}>
                  {connecting === provider ? "Connecting…" : "Connect"}
                </Button>
              )}
              {status === "pending" && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-warnsoft/70 px-2.5 py-1.5 text-[11.5px] leading-snug text-warn">
                  <Icon name="info" size={12} className="mt-0.5 shrink-0" />
                  Running on the mock provider — messages are logged in-app. Add credentials (env) to go live without any code changes.
                </div>
              )}
              {provider === "google_calendar" && <div className="mt-2 text-[11.5px] text-mut">Coming soon — architecture in place.</div>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ----------------------------- Subscription ----------------------------- */

const PLANS = [
  { id: "starter", name: "Starter", price: 299, tagline: "For solo operators getting started", features: ["AI receptionist", "Leads & customers", "Basic messaging", "Quotes & follow-ups"] },
  { id: "business", name: "Business", price: 699, tagline: "For growing service businesses", features: ["Everything in Starter", "Scheduling & jobs", "Invoices & payment tracking", "Analytics", "AI business assistant"], popular: true },
  { id: "pro", name: "Pro", price: 1499, tagline: "For teams that need it all", features: ["Everything in Business", "Advanced automation", "Multiple team members", "Advanced AI agents", "Advanced analytics"] },
];

function SubscriptionTab({ business, trialDays, onSaved }: { business: any; trialDays: number; onSaved: () => void }) {
  const sub = business.subscription;
  const [choosing, setChoosing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const current = PLANS.find((p) => p.id === sub?.plan) ?? PLANS[0];

  const upgrade = async () => {
    if (!choosing) return;
    setBusy(true);
    try {
      const r = await api<any>("/subscription/upgrade", { method: "POST", body: { plan: choosing } });
      toast(r.note ?? "Plan updated.", "ok");
      setChoosing(null);
      onSaved();
    } catch (e: any) {
      toast(e.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex-1">
          <div className="text-[12px] font-medium uppercase tracking-wide text-mut">Current plan</div>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="font-display text-[20px] font-semibold capitalize">{current.name}</span>
            <Badge tone={sub?.status === "trialing" ? "accent" : "ok"}>{sub?.status === "trialing" ? `trial · ${trialDays} days left` : sub?.status}</Badge>
          </div>
          <div className="mt-1 text-[12.5px] text-mut">{formatZAR(current.price)}/month · billed via Yoco when enabled</div>
        </div>
        {sub?.status === "trialing" && (
          <div className="w-full sm:w-56">
            <div className="mb-1 flex justify-between text-[11px] font-medium text-mut"><span>Trial progress</span><span>{trialDays}/14 days</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-surface2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(trialDays / 14) * 100}%` }} />
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = p.id === sub?.plan;
          return (
            <Card key={p.id} className={cn("relative flex flex-col p-5", p.popular && "border-brand ring-1 ring-brand/25")}>
              {p.popular && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-brand px-2.5 py-0.5 text-[10.5px] font-bold text-white">Most popular</span>
              )}
              <div className="text-[13.5px] font-semibold">{p.name}</div>
              <div className="mt-1 font-display text-[24px] font-semibold">
                {formatZAR(p.price)}
                <span className="text-[12px] font-medium text-mut">/month</span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-mut">{p.tagline}</div>
              <ul className="mt-3 flex-1 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[12px] leading-snug">
                    <Icon name="check" size={12} className="mt-0.5 shrink-0 text-ok" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-4" variant={isCurrent ? "secondary" : p.popular ? "primary" : "secondary"} disabled={isCurrent || busy} onClick={() => setChoosing(p.id)}>
                {isCurrent ? "Current plan" : sub?.status === "trialing" ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
              </Button>
            </Card>
          );
        })}
      </div>
      <p className="text-center text-[11.5px] text-mut">AI/WhatsApp usage may incur additional usage charges beyond your plan. Pricing can change — your current price is locked for 12 months.</p>

      <Modal open={!!choosing} onClose={() => setChoosing(null)} title={`Switch to ${PLANS.find((p) => p.id === choosing)?.name ?? ""}?`}>
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-mut">
            We'll update your plan to <strong className="text-ink">{PLANS.find((p) => p.id === choosing)?.name}</strong> at{" "}
            <strong className="text-ink">{formatZAR(PLANS.find((p) => p.id === choosing)?.price ?? 0)}/month</strong>. Yoco billing activates automatically once payment credentials are configured — for now your plan changes immediately at no charge.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setChoosing(null)}>Cancel</Button>
            <Button onClick={upgrade} disabled={busy}>{busy ? "Updating…" : "Confirm switch"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
