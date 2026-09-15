"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { BUSINESS_TYPES, SA_PROVINCES } from "@/lib/utils";
import { Button, Field, Icon, Logo, Spinner, Toggle, useToast } from "@/components/ui";

const STEPS = [
  { id: 1, label: "Your business", icon: "building" },
  { id: 2, label: "Services", icon: "wrench" },
  { id: 3, label: "Team", icon: "users" },
  { id: 4, label: "Hours", icon: "clock" },
  { id: 5, label: "Channels", icon: "chat" },
  { id: 6, label: "Configure AI", icon: "sparkles" },
];

interface Svc { name: string; description: string; basePrice: string; pricingType: string; durationMinutes: number; active: boolean }
interface Tm { name: string; role: string; phone: string; email: string; skills: string; serviceAreas: string; workingHours: string }

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState({ name: "", type: "", ownerName: "", phone: "", email: "", whatsapp: "", province: "", city: "", serviceArea: "", description: "" });
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [team, setTeam] = useState<Tm[]>([]);
  const [hours, setHours] = useState(Array.from({ length: 7 }, (_, i) => ({ day: i, opensAt: i === 0 ? "08:00" : "07:30", closesAt: i === 5 ? "16:00" : i === 6 ? "13:00" : "17:00", isClosed: false })));
  const [channels, setChannels] = useState({ website: true, whatsapp: true, email: true });
  const [ai, setAi] = useState({ tone: "friendly", autonomy: "confirm", rules: ["Never offer discounts above 10%", "Emergency jobs carry a 30% surcharge"] as string[], autoReminders: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const me = api<any>("/auth/me").then((r) => {
      if (!r?.user) router.push("/auth");
      else setBusiness((b) => ({ ...b, ownerName: b.ownerName || r.user.name, email: b.email || r.user.email }));
    });
    return () => { me.catch(() => {}); };
  }, [router]);

  const b = (k: string) => (e: React.ChangeEvent<any>) => setBusiness((x) => ({ ...x, [k]: e.target.value }));

  const next = () => {
    if (step === 1 && !business.name.trim()) {
      setError("Give your business a name to continue.");
      return;
    }
    setError("");
    setStep((s) => Math.min(6, s + 1));
  };

  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/onboarding", {
        method: "POST",
        body: {
          business,
          plan: "business",
          services: svcs.filter((s) => s.name.trim()).map((s) => ({ ...s, basePrice: s.basePrice === "" ? null : Number(s.basePrice), skills: [] })),
          team: team.filter((t) => t.name.trim()).map((t) => ({ ...t, skills: t.skills.split(",").map((s) => s.trim()).filter(Boolean), serviceAreas: t.serviceAreas.split(",").map((s) => s.trim()).filter(Boolean) })),
          hours,
          channels,
          ai: { tone: ai.tone, autonomy: ai.autonomy, rules: ai.rules.filter(Boolean) },
        },
      });
      toast(`Welcome aboard, ${business.name}. Your AI team is ready.`, "ok");
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="inline-flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-display text-[16px] font-semibold">BizPilot setup</span>
          </span>
          <button onClick={() => api("/auth/logout", { method: "POST" }).then(() => router.push("/auth"))} className="btn-focus text-[12.5px] font-medium text-mut hover:text-ink">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Stepper */}
        <div className="mb-8 flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <div className={`h-0.5 flex-1 rounded ${i === 0 ? "bg-transparent" : step >= s.id ? "bg-brand" : "bg-line"}`} />
                <span className={`btn-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition ${step > s.id ? "bg-brand text-white" : step === s.id ? "bg-brand text-white ring-4 ring-brand/20" : "bg-surface2 text-mut"}`}>
                  {step > s.id ? <Icon name="check" size={13} /> : s.id}
                </span>
                <div className={`h-0.5 flex-1 rounded ${i === STEPS.length - 1 ? "bg-transparent" : step >= s.id ? "bg-brand" : "bg-line"}`} />
              </div>
              <span className={`text-[10.5px] font-medium ${step === s.id ? "text-ink" : "text-mut"}`}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="anim-fade-up" key={step}>
          {step === 1 && (
            <section>
              <h1 className="font-display text-[24px] font-semibold tracking-tight">Tell us about your business.</h1>
              <p className="mt-1 text-[13.5px] text-mut">This is what the AI receptionist will introduce itself as.</p>
              <div className="mt-6 grid grid-cols-2 gap-3.5">
                <Field label="Business name" className="col-span-2 sm:col-span-1"><input className="input" value={business.name} onChange={b("name")} placeholder="e.g. Thando Plumbing & Electrical" /></Field>
                <Field label="Business type">
                  <select className="input" value={business.type} onChange={b("type")}>
                    <option value="">Select…</option>
                    {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Owner name"><input className="input" value={business.ownerName} onChange={b("ownerName")} /></Field>
                <Field label="Phone"><input className="input" value={business.phone} onChange={b("phone")} placeholder="+27 21 …" /></Field>
                <Field label="Email"><input className="input" type="email" value={business.email} onChange={b("email")} /></Field>
                <Field label="WhatsApp number" className="col-span-2 sm:col-span-1"><input className="input" value={business.whatsapp} onChange={b("whatsapp")} placeholder="+27 82 …" /></Field>
                <Field label="Province">
                  <select className="input" value={business.province} onChange={b("province")}>
                    <option value="">Select…</option>
                    {SA_PROVINCES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="City"><input className="input" value={business.city} onChange={b("city")} placeholder="Cape Town" /></Field>
                <Field label="Service area" className="col-span-2 sm:col-span-1"><input className="input" value={business.serviceArea} onChange={b("serviceArea")} placeholder="e.g. Cape Town northern & southern suburbs" /></Field>
                <Field label="Business description" className="col-span-2">
                  <textarea className="input min-h-[76px] resize-y" value={business.description} onChange={b("description")} placeholder="What you do, how long you've been trading…" />
                </Field>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="font-display text-[24px] font-semibold tracking-tight">What services do you offer?</h1>
              <p className="mt-1 text-[13.5px] text-mut">The AI only ever quotes from these prices — never invented numbers.</p>
              <div className="mt-6 space-y-3">
                {svcs.map((s, i) => (
                  <div key={i} className="card grid grid-cols-2 items-end gap-3 p-4 sm:grid-cols-[1.4fr_1fr_0.9fr_0.9fr_2rem]">
                    <Field label="Service name"><input className="input" value={s.name} onChange={(e) => setSvcs((xs) => xs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="e.g. Geyser repair" /></Field>
                    <Field label="Base price (R)"><input className="input" type="number" value={s.basePrice} onChange={(e) => setSvcs((xs) => xs.map((x, j) => (j === i ? { ...x, basePrice: e.target.value } : x)))} placeholder="1450" /></Field>
                    <Field label="Pricing">
                      <select className="input" value={s.pricingType} onChange={(e) => setSvcs((xs) => xs.map((x, j) => (j === i ? { ...x, pricingType: e.target.value } : x)))}>
                        <option value="fixed">Fixed</option>
                        <option value="starting_from">Starting from</option>
                        <option value="hourly">Hourly</option>
                        <option value="custom">Custom quote</option>
                      </select>
                    </Field>
                    <Field label="Est. duration (min)"><input className="input" type="number" value={String(s.durationMinutes)} onChange={(e) => setSvcs((xs) => xs.map((x, j) => (j === i ? { ...x, durationMinutes: Number(e.target.value) } : x)))} /></Field>
                    <button onClick={() => setSvcs((xs) => xs.filter((_, j) => j !== i))} className="btn-focus mb-0.5 rounded-lg p-2 text-mut hover:text-danger" aria-label="Remove service">
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" icon="plus" onClick={() => setSvcs((xs) => [...xs, { name: "", description: "", basePrice: "", pricingType: "fixed", durationMinutes: 90, active: true }])}>
                  Add service
                </Button>
                {svcs.length === 0 && <p className="rounded-xl border border-dashed border-linestrong px-4 py-6 text-center text-[12.5px] text-mut">Add at least the services you quote most. You can add more later in Settings.</p>}
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className="font-display text-[24px] font-semibold tracking-tight">Add your team.</h1>
              <p className="mt-1 text-[13.5px] text-mut">The AI scheduling agent books jobs onto these people, respecting their hours and skills.</p>
              <div className="mt-6 space-y-3">
                {team.map((t, i) => (
                  <div key={i} className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                    <Field label="Name"><input className="input" value={t.name} onChange={(e) => setTeam((xs) => xs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="e.g. Thabo Nkosi" /></Field>
                    <Field label="Role">
                      <select className="input" value={t.role} onChange={(e) => setTeam((xs) => xs.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}>
                        {["Plumber", "Electrician", "Handyman", "Technician", "Supervisor"].map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </Field>
                    <Field label="Phone"><input className="input" value={t.phone} onChange={(e) => setTeam((xs) => xs.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} /></Field>
                    <Field label="Skills (comma separated)"><input className="input" value={t.skills} onChange={(e) => setTeam((xs) => xs.map((x, j) => (j === i ? { ...x, skills: e.target.value } : x)))} placeholder="geysers, drains" /></Field>
                    <Field label="Working hours"><input className="input" value={t.workingHours} onChange={(e) => setTeam((xs) => xs.map((x, j) => (j === i ? { ...x, workingHours: e.target.value } : x)))} placeholder="Mon–Fri 07:30–17:00" /></Field>
                    <div className="flex items-end justify-end pb-0.5">
                      <button onClick={() => setTeam((xs) => xs.filter((_, j) => j !== i))} className="btn-focus rounded-lg p-2 text-mut hover:text-danger" aria-label="Remove member">
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="secondary" icon="plus" onClick={() => setTeam((xs) => [...xs, { name: "", role: "Plumber", phone: "", email: "", skills: "", serviceAreas: "", workingHours: "" }])}>
                  Add team member
                </Button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <h1 className="font-display text-[24px] font-semibold tracking-tight">Set your business hours.</h1>
              <p className="mt-1 text-[13.5px] text-mut">The AI will never schedule a job outside these hours, and will tell customers what you're open.</p>
              <div className="card mt-6 divide-y divide-line/70 p-2">
                {hours.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3">
                    <span className="w-24 text-[13px] font-medium">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]}</span>
                    {h.isClosed ? (
                      <Badge2>Closed</Badge2>
                    ) : (
                      <>
                        <input type="time" className="input w-28" value={h.opensAt} onChange={(e) => setHours((xs) => xs.map((x, j) => (j === i ? { ...x, opensAt: e.target.value } : x)))} />
                        <span className="text-[12px] text-mut">to</span>
                        <input type="time" className="input w-28" value={h.closesAt} onChange={(e) => setHours((xs) => xs.map((x, j) => (j === i ? { ...x, closesAt: e.target.value } : x)))} />
                      </>
                    )}
                    <button onClick={() => setHours((xs) => xs.map((x, j) => (j === i ? { ...x, isClosed: !x.isClosed } : x)))} className={`btn-focus ml-auto rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold ${h.isClosed ? "border-danger/30 bg-dangersoft text-danger" : "border-line text-mut"}`}>
                      {h.isClosed ? "Reopen" : "Close"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {step === 5 && (
            <section>
              <h1 className="font-display text-[24px] font-semibold tracking-tight">Connect your channels.</h1>
              <p className="mt-1 text-[13.5px] text-mut">Where do your customers find you? The AI answers on every connected channel.</p>
              <div className="mt-6 space-y-3">
                {[
                  { key: "whatsapp" as const, icon: "chat", title: "WhatsApp", sub: "The primary channel for SA businesses. Full WhatsApp Business API connects once you add credentials." },
                  { key: "website" as const, icon: "globe", title: "Website / web form", sub: "Embeddable chat widget — visitors become leads automatically." },
                  { key: "email" as const, icon: "send", title: "Email", sub: "Enquiries by email are answered in your tone and converted to leads." },
                ].map((c) => (
                  <div key={c.key} className="card flex items-center gap-3.5 p-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brandsoft text-brand"><Icon name={c.icon} size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold">{c.title}</div>
                      <div className="text-[12px] leading-snug text-mut">{c.sub}</div>
                    </div>
                    <Toggle checked={channels[c.key]} onChange={(v) => setChannels((x) => ({ ...x, [c.key]: v }))} label={c.title} />
                  </div>
                ))}
                <div className="flex items-center gap-3.5 rounded-xl border border-dashed border-linestrong p-4 opacity-70">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 text-mut"><Icon name="users" size={18} /></span>
                  <div>
                    <div className="text-[13.5px] font-semibold">Facebook & Instagram</div>
                    <div className="text-[12px] text-mut">Coming soon — the integration slot is already built.</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === 6 && (
            <section>
              <h1 className="font-display text-[24px] font-semibold tracking-tight">Let BizPilot configure your AI.</h1>
              <p className="mt-1 text-[13.5px] text-mut">Your AI already knows your services, prices, hours and areas. Now set its personality.</p>
              <div className="card mt-6 space-y-5 p-5">
                <div>
                  <div className="mb-2 text-[13px] font-medium">Tone of voice</div>
                  <div className="flex flex-wrap gap-2">
                    {["friendly", "professional", "casual", "formal"].map((t) => (
                      <button key={t} onClick={() => setAi((x) => ({ ...x, tone: t }))} className={`btn-focus rounded-lg border px-3.5 py-2 text-[13px] font-medium capitalize ${ai.tone === t ? "border-brand bg-brandsoft text-brandstrong" : "border-line text-mut"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[13px] font-medium">Autonomy</div>
                  <div className="flex flex-wrap gap-2">
                    {[["suggest", "Suggest only"], ["confirm", "Ask before actions"], ["autonomous", "Automate routine tasks"]].map(([id, label]) => (
                      <button key={id} onClick={() => setAi((x) => ({ ...x, autonomy: id }))} className={`btn-focus rounded-lg border px-3.5 py-2 text-[13px] font-medium ${ai.autonomy === id ? "border-brand bg-brandsoft text-brandstrong" : "border-line text-mut"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[13px] font-medium">Business rules</div>
                  <div className="space-y-2">
                    {ai.rules.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-surface2/60 px-3 py-2 text-[12.5px]">
                        <Icon name="shield" size={13} className="shrink-0 text-brand" />
                        <input className="flex-1 bg-transparent outline-none" value={r} onChange={(e) => setAi((x) => ({ ...x, rules: x.rules.map((rr, j) => (j === i ? e.target.value : rr)) }))} />
                        <button onClick={() => setAi((x) => ({ ...x, rules: x.rules.filter((_, j) => j !== i) }))} className="btn-focus text-mut hover:text-danger" aria-label="Remove rule">
                          <Icon name="x" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setAi((x) => ({ ...x, rules: [...x.rules, ""] }))} className="btn-focus mt-2 text-[12.5px] font-semibold text-brand hover:underline">+ Add rule</button>
                </div>
                <label className="flex items-center justify-between rounded-xl border border-line bg-surface2/60 px-3.5 py-3">
                  <span>
                    <span className="block text-[13px] font-semibold">Automatic payment reminders</span>
                    <span className="block text-[11.5px] text-mut">AI Finance Agent chases overdue invoices for you</span>
                  </span>
                  <Toggle checked={ai.autoReminders} onChange={(v) => setAi((x) => ({ ...x, autoReminders: v }))} label="Auto reminders" />
                </label>
              </div>
              <div className="mt-4 rounded-xl bg-brandsoft/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink">
                <strong>What the AI now knows:</strong> {svcs.filter((s) => s.name).length} services with pricing · {team.filter((t) => t.name).length} team members · your hours and service area ({business.city || "—"}, {business.province || "—"}). It will learn more as you add documents to the knowledge base.
              </div>
            </section>
          )}

          {error && <div className="mt-4 flex items-start gap-2 rounded-lg bg-dangersoft px-3.5 py-2.5 text-[13px] font-medium text-danger" role="alert"><Icon name="alert" size={15} className="mt-0.5 shrink-0" />{error}</div>}

          <div className="mt-7 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || busy}>
              <Icon name="chevron-left" size={15} /> Back
            </Button>
            {step < 6 ? (
              <Button onClick={next} icon="arrow-right" size="lg">Continue</Button>
            ) : (
              <Button onClick={finish} disabled={busy} size="lg">
                {busy ? <><Spinner size={15} /> Setting up your AI team…</> : "Launch my business cockpit"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Badge2({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-medium text-mut">{children}</span>;
}
