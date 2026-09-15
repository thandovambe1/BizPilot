"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Icon, Logo, Spinner } from "@/components/ui";
import { useTheme } from "@/components/theme-init";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const { dark, setDark } = useTheme();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        await api("/auth/login", { method: "POST", body: { email: f.email, password: f.password } });
      } else {
        const r = await api("/auth/register", { method: "POST", body: f });
        if (r?.ok) {
          router.push("/onboarding");
          return;
        }
      }
      // login: figure out where to send
      const me = await api<any>("/auth/me");
      router.push(me.user?.businessId ? "/dashboard" : "/onboarding");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setDemoBusy(true);
    setError("");
    try {
      await api("/demo", { method: "POST" });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
      setDemoBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-brand p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo size={38} />
          <span className="font-display text-[22px] font-semibold tracking-tight">BizPilot</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-[34px] font-semibold leading-[1.15] tracking-tight">
            Your AI business manager.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">
            BizPilot handles your leads, WhatsApp, quotes, bookings, invoices and follow-ups — so you can focus on running your business.
          </p>
          <ul className="mt-8 space-y-3.5">
            {[
              ["chat", "AI receptionist answers every WhatsApp, 24/7"],
              ["target", "Every enquiry becomes a scored lead automatically"],
              ["file", "Quotes and invoices in seconds, from your own prices"],
              ["sparkles", "A daily AI briefing tells you exactly what needs you"],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-[14px] text-white/90">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                  <Icon name={icon} size={15} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[12px] text-white/60">Built for South African service businesses · ZAR · WhatsApp-first</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex w-full max-w-sm items-center justify-between lg:hidden">
          <span className="inline-flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-display text-[19px] font-semibold">BizPilot</span>
          </span>
          <button onClick={() => setDark(!dark)} className="btn-focus rounded-lg border border-line bg-surface p-2 text-mut" aria-label="Toggle theme">
            <Icon name={dark ? "sun" : "moon"} size={15} />
          </button>
        </div>
        <div className="w-full max-w-sm anim-fade-up">
          <h1 className="font-display text-[24px] font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1.5 text-[13.5px] text-mut">
            {mode === "login" ? "Sign in to your business cockpit." : "Free for 14 days. No credit card required."}
          </p>

          <div className="mt-6 flex rounded-xl border border-line bg-surface2 p-1 text-[13px] font-medium">
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} className={`btn-focus flex-1 rounded-lg py-2 transition ${mode === m ? "bg-surface text-ink shadow-sm" : "text-mut"}`}>
                {m === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {mode === "register" && (
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-mut">Your name</span>
                <input className="input" value={f.name} onChange={set("name")} placeholder="e.g. Thando Mokoena" autoComplete="name" />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-mut">Email</span>
              <input className="input" type="email" value={f.email} onChange={set("email")} placeholder="you@business.co.za" autoComplete="email" required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-mut">Password</span>
              <input className="input" type="password" value={f.password} onChange={set("password")} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} autoComplete={mode === "register" ? "new-password" : "current-password"} required />
            </label>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-dangersoft px-3 py-2.5 text-[12.5px] font-medium text-danger" role="alert">
                <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? <Spinner size={16} /> : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-mut">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" className="w-full" size="lg" icon="play" onClick={demo} disabled={demoBusy}>
            {demoBusy ? "Preparing your demo…" : "Explore the live demo business"}
          </Button>
          <p className="mt-3 text-center text-[11.5px] leading-relaxed text-mut">
            Demo signs you into <strong className="text-ink">Thando Plumbing &amp; Electrical</strong> — a fully seeded Cape Town business.
            <br />
            Platform admin: admin@bizpilot.co.za / admin1234
          </p>
        </div>
      </div>
    </div>
  );
}
