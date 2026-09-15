import type { Metadata } from "next";
import Link from "next/link";
import { Icon, Logo } from "@/components/ui";

export const metadata: Metadata = {
  title: "BizPilot — Your AI business manager for South African SMEs",
  description:
    "BizPilot is the AI business operating system for South African service businesses. AI receptionist, AI CRM, WhatsApp automation, quoting, scheduling, invoicing and business intelligence — in one platform. Start free for 14 days.",
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "BizPilot",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "AI business manager for South African SMEs: AI receptionist, CRM, WhatsApp automation, quotes, scheduling, invoicing and analytics.",
      offers: [
        { "@type": "Offer", name: "Starter", price: "299", priceCurrency: "ZAR" },
        { "@type": "Offer", name: "Business", price: "699", priceCurrency: "ZAR" },
        { "@type": "Offer", name: "Pro", price: "1499", priceCurrency: "ZAR" },
      ],
      areaServed: "ZA",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "What is BizPilot?", acceptedAnswer: { "@type": "Answer", text: "BizPilot is an AI business manager for South African service businesses. It answers WhatsApp enquiries, qualifies leads, creates quotes, schedules jobs, sends invoices, chases payments and gives you a daily AI briefing — all from one dashboard." } },
        { "@type": "Question", name: "Which businesses is it built for?", acceptedAnswer: { "@type": "Answer", text: "Plumbers, electricians, handymen, builders, painters, cleaners, gardeners, appliance repair, mechanics, solar installers, security companies and HVAC businesses across South Africa." } },
        { "@type": "Question", name: "Does the AI make up prices or availability?", acceptedAnswer: { "@type": "Answer", text: "No. BizPilot's AI only ever reports data from your own business — your configured prices, your team's real availability and your actual invoices. If it doesn't have the data, it asks." } },
        { "@type": "Question", name: "How much does BizPilot cost?", acceptedAnswer: { "@type": "Answer", text: "Plans start at R299/month (Starter), R699/month (Business) and R1,499/month (Pro). Every new business gets a 14-day free trial with no credit card required. AI and WhatsApp usage may incur additional usage charges." } },
      ],
    },
  ],
};

const AGENTS = [
  { icon: "chat", title: "AI Receptionist", body: "Answers every WhatsApp, collects details, answers FAQs and books appointments — 24/7, in your tone." },
  { icon: "target", title: "AI Sales Agent", body: "Scores every enquiry 0–100, follows up high-intent leads and recovers abandoned enquiries." },
  { icon: "calendar", title: "AI Scheduling Agent", body: "Checks your team's real availability, skills and working hours. No double bookings, ever." },
  { icon: "wallet", title: "AI Finance Agent", body: "Watches invoices, flags overdue payments and drafts polite reminders you approve with one tap." },
  { icon: "star", title: "AI Customer Success Agent", body: "Checks in after every job, requests Google reviews and flags unhappy customers before they churn." },
  { icon: "chart", title: "AI Business Analyst", body: "Spots patterns in revenue, conversion and service profitability — with plain-English explanations." },
  { icon: "sparkles", title: "AI CEO Agent", body: "Combines everything into your morning briefing: what was handled, what needs you, what to do next." },
];

const FLOW = ["Enquiry", "AI response", "Lead scored", "Quote", "Booking", "Job", "Invoice", "Payment", "Follow-up", "Review", "Repeat"];

const FAQS = [
  ["What is BizPilot?", "BizPilot is an AI business manager for South African service businesses. It answers WhatsApp enquiries, qualifies leads, creates quotes, schedules jobs, sends invoices, chases payments and gives you a daily AI briefing — all from one dashboard that works on your phone."],
  ["Will the AI make up prices or availability?", "No. This is the core promise: BizPilot only ever reports data from your own business — your configured prices, your team's real availability, your actual invoices. If information is missing, it asks. Consequential actions (sending reminders, booking jobs, creating quotes) always show a confirmation card before anything happens."],
  ["I'm not technical. Will I manage it?", "If you can use WhatsApp, you can use BizPilot. The whole platform is built mobile-first, in plain language, with ZAR pricing and South African date formats. The AI does the admin; you approve it."],
  ["How does WhatsApp work?", "Your conversations live in the BizPilot inbox. The AI receptionist replies to routine enquiries in your tone, escalates angry or complex customers to you, and every conversation becomes a scored lead, quote and job as the customer moves forward. Full WhatsApp Business API connectivity activates once you connect your number."],
  ["How much does it cost?", "Starter is R299/month, Business is R699/month and Pro is R1,499/month. Every business starts with a 14-day free trial — no credit card required. AI/WhatsApp usage may incur additional usage charges."],
  ["Which businesses is it built for?", "Service businesses first: plumbers, electricians, handymen, builders, painters, cleaners, gardeners, appliance repair, mechanics, solar installers, security and HVAC — anywhere in South Africa. The architecture is built to expand to more African markets."],
  ["What happens to my data?", "Your business is its own isolated tenant. No other business can see your data, and every AI action is logged in an audit trail you can inspect at any time."],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="inline-flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-display text-[18px] font-semibold tracking-tight">BizPilot</span>
          </span>
          <nav className="hidden items-center gap-6 text-[13.5px] font-medium text-mut md:flex" aria-label="Main">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#ai" className="hover:text-ink">AI team</a>
            <a href="#whatsapp" className="hover:text-ink">WhatsApp</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth" className="btn-focus hidden rounded-[10px] px-3.5 py-2 text-[13.5px] font-medium text-mut hover:text-ink sm:block">
              Sign in
            </Link>
            <Link href="/auth?mode=register" className="btn-focus rounded-[10px] bg-brand px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-brandstrong">
              Start for free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-brandsoft/70 to-transparent" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="anim-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-mut shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Built for South African service businesses
            </div>
            <h1 className="mt-5 font-display text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[54px]">
              Your AI business manager.
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-mut">
              BizPilot handles your leads, WhatsApp, quotes, bookings, invoices and follow-ups — so you can focus on running your business.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/auth?mode=register" className="btn-focus rounded-xl bg-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-md transition hover:bg-brandstrong">
                Start for free
              </Link>
              <a href="#how" className="btn-focus rounded-xl border border-line bg-surface px-6 py-3.5 text-[15px] font-medium text-ink shadow-sm transition hover:border-linestrong">
                See how it works
              </a>
            </div>
            <p className="mt-4 text-[12.5px] text-mut">14-day free trial · No credit card · Cancel anytime · R299/mo to start</p>
          </div>

          {/* Crafted dashboard mock */}
          <div className="anim-fade-up relative" style={{ animationDelay: "120ms" }}>
            <div className="card p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Logo size={24} />
                  <span className="text-[12.5px] font-semibold">Thando Plumbing &amp; Electrical</span>
                </div>
                <span className="rounded-full bg-brandsoft px-2 py-0.5 text-[10px] font-bold text-brandstrong">LIVE</span>
              </div>
              {/* briefing */}
              <div className="mt-3 rounded-xl border border-brand/20 bg-brandsoft/50 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brandstrong">
                  <Icon name="sparkles" size={11} />
                  BizPilot daily briefing
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed">
                  Good morning 👋 You have <strong>6 jobs today</strong>. 4 new leads overnight — <strong>R12,850 booked</strong>. R8,400 in overdue invoices. 1 customer waiting for a quote.
                </p>
                <div className="mt-2 flex gap-1.5">
                  <span className="rounded-md bg-brand px-2 py-1 text-[9.5px] font-bold text-white">Send follow-ups</span>
                  <span className="rounded-md bg-surface px-2 py-1 text-[9.5px] font-semibold text-brandstrong shadow-sm">Review invoices</span>
                </div>
              </div>
              {/* KPI chips */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[["Jobs today", "6"], ["New leads", "4"], ["Booked", "R12.9k"], ["Outstanding", "R8.4k"]].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-line bg-surface2/70 px-2 py-1.5">
                    <div className="text-[8.5px] font-medium text-mut">{l}</div>
                    <div className="font-display text-[13px] font-bold">{v}</div>
                  </div>
                ))}
              </div>
              {/* mini chart */}
              <div className="mt-3 flex h-16 items-end gap-1 rounded-lg border border-line bg-surface2/40 p-2">
                {[38, 55, 42, 70, 58, 85, 62, 95, 74, 60, 88, 100, 79, 91].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-[3px] bg-brand" style={{ height: `${h}%`, opacity: 0.45 + (i / 14) * 0.55 }} />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[8.5px] text-mut"><span>Revenue, last 14 days</span><span className="font-semibold text-ok">▲ 18% this month</span></div>
            </div>
            {/* floating whatsapp bubble */}
            <div className="card absolute -bottom-6 -left-4 hidden w-60 p-3 shadow-xl sm:block" style={{ animation: "bp-fade-up .5s .5s both" }}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-brandstrong">
                <Icon name="chat" size={11} />
                WhatsApp · just now
              </div>
              <div className="mt-1.5 rounded-lg rounded-tl-none bg-surface2 px-2.5 py-1.5 text-[10.5px] leading-snug">Hi, my geyser is leaking 😬</div>
              <div className="mt-1 rounded-lg rounded-tr-none bg-brand px-2.5 py-1.5 text-[10.5px] leading-snug text-white">
                Hi Sarah 👋 Could you send your suburb and a photo? I'll get Thabo over tomorrow.
                <span className="mt-0.5 block text-[8px] font-bold text-white/60">BIZPILOT AI · lead score 92</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Strip */}
      <section className="border-y border-line bg-surface2/50 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-[12.5px] font-medium text-mut">
          <span className="text-[11px] font-bold uppercase tracking-widest text-mut/70">Built for</span>
          {["Plumbers", "Electricians", "Handymen", "Builders", "Painters", "Cleaners", "Gardeners", "Appliance repair", "Mechanics", "Solar installers", "Security", "HVAC"].map((b) => (
            <span key={b} className="whitespace-nowrap">{b}</span>
          ))}
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" id="problem">
        <div className="max-w-2xl">
          <h2 className="font-display text-[30px] font-semibold tracking-tight">You didn't start a plumbing business to chase WhatsApp replies.</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mut">
            SA's service businesses lose customers every day to the same problems: missed calls at 22:00, quotes that take two days, customers who don't pay, and a brain that has to remember eight jobs, six invoices and three follow-ups.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["43%", "of service enquiries go to the first business that replies — usually the one with an AI answering in 30 seconds"],
            ["R8,400", "is what the average SA SME carries in forgotten overdue invoices at any time"],
            ["7 hrs/wk", "spends on admin: quotes, chasing, scheduling, invoicing. That's your billable time, gone."],
          ].map(([big, sub]) => (
            <div key={sub} className="card p-5">
              <div className="font-display text-[32px] font-semibold text-danger">{big}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mut">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section className="border-y border-line bg-surface2/40 py-16" id="how">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-[30px] font-semibold tracking-tight">The whole customer journey, on autopilot.</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-mut">Never miss a customer again. BizPilot carries every enquiry from first message to repeat booking — you stay in control at every consequential step.</p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {FLOW.map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium ${i < 3 ? "border-brand/30 bg-brandsoft text-brandstrong" : "border-line bg-surface text-ink"}`}>
                  {i === 1 && <Icon name="sparkles" size={12} className="text-brand" />}
                  {s}
                </span>
                {i < FLOW.length - 1 && <Icon name="chevron-right" size={13} className="text-mut/50" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* AI agents */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" id="ai">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-[30px] font-semibold tracking-tight">Not one chatbot. A full AI team.</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-mut">Seven specialised agents run your business's admin — each one only ever reports what's actually in your books. Every action is logged, and consequential ones need your approval.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-mut">
            <Icon name="shield" size={13} className="text-brand" />
            Human-approved actions · full audit trail
          </span>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a) => (
            <div key={a.title} className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brandsoft text-brand transition group-hover:bg-brand group-hover:text-white">
                <Icon name={a.icon} size={18} />
              </span>
              <h3 className="mt-3.5 font-display text-[15.5px] font-semibold">{a.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mut">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WhatsApp */}
      <section className="border-y border-line bg-surface2/40 py-16" id="whatsapp">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-[30px] font-semibold tracking-tight">WhatsApp is where your business happens. So is BizPilot.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-mut">
              Every WhatsApp message lands in a beautiful inbox. The AI receptionist replies in your tone, asks for exactly the details you need, scores the lead, and hands off to you the moment something needs a human — an angry customer, a refund request, a negotiation.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "AI replies in seconds, 24/7 — with your prices, hours and areas",
                "Auto lead scoring from 0–100 with a written reason",
                "Smart escalation: the AI knows when to call you, not text you",
                "One-tap reminders, follow-ups and review requests",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2.5 text-[14px]">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-oksoft text-ok"><Icon name="check" size={11} /></span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="card mx-auto w-full max-w-sm p-4 shadow-lg">
            <div className="flex items-center gap-2.5 border-b border-line pb-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brandsoft text-brand"><Icon name="user" size={16} /></span>
              <div>
                <div className="text-[13px] font-semibold">Sarah van Wyk</div>
                <div className="text-[10.5px] text-mut">Sea Point · lead score 92</div>
              </div>
              <span className="ml-auto rounded-full bg-oksoft px-2 py-0.5 text-[9.5px] font-bold text-ok">AI HANDLING</span>
            </div>
            <div className="space-y-2 py-4 text-[12.5px]">
              <div className="max-w-[80%] rounded-xl rounded-tl-md border border-line bg-surface2/70 px-3 py-2 leading-snug">
                Hi, my geyser is leaking and the hot water is gone 😬
                <span className="mt-0.5 block text-right text-[9px] text-mut">21:14</span>
              </div>
              <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-md bg-brand px-3 py-2 leading-snug text-white">
                Hi Sarah 👋 I'm so sorry — that's stressful. Could you send me: 1. your suburb 2. a photo of the geyser 3. is water leaking heavily? I'll arrange the next technician.
                <span className="mt-0.5 block text-right text-[9px] text-white/60">21:14 · BizPilot AI</span>
              </div>
              <div className="max-w-[80%] rounded-xl rounded-tl-md border border-line bg-surface2/70 px-3 py-2 leading-snug">
                It's in Sea Point. Just dripping for now.
                <span className="mt-0.5 block text-right text-[9px] text-mut">21:18</span>
              </div>
              <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-md bg-brand px-3 py-2 leading-snug text-white">
                Thanks Sarah. Thabo has 09:00 tomorrow morning — Geyser replacement from R4,850 incl. VAT. Shall I lock that in?
                <span className="mt-0.5 block text-right text-[9px] text-white/60">21:18 · BizPilot AI</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-brandsoft/60 px-3 py-2 text-[11px] font-medium text-brandstrong">
              <Icon name="sparkles" size={12} />
              Lead created · score 92 · job offered · quote draft ready
            </div>
          </div>
        </div>
      </section>

      {/* Feature rows */}
      <section className="mx-auto max-w-6xl space-y-4 px-4 py-16 sm:px-6">
        {[
          ["CRM that thinks", "users", "Every customer profile carries their spend, jobs, quotes, invoices and the full conversation timeline. The AI knows who's been quiet for 90 days and who to call."],
          ["Scheduling without clashes", "calendar", "Jobs go onto real people with real hours. The scheduling agent checks availability, skills and travel, and flags conflicts before they become angry customers."],
          ["Quotes & invoices that close", "receipt", "One-tap quotes from your configured prices, printable PDFs, VAT included. Invoices go out, payments get recorded, and overdue ones get politely chased — by AI, with your approval."],
          ["Business intelligence in plain English", "chart", "Revenue, conversion, service profitability, technician output — plus AI-detected insights like “your quote acceptance dropped from 64% to 48%” with a suggested fix."],
        ].map(([title, icon, body], i) => (
          <div key={title} className={`card flex flex-col gap-4 p-6 sm:flex-row sm:items-center ${i % 2 ? "sm:flex-row-reverse" : ""}`}>
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brandsoft text-brand"><Icon name={icon} size={22} /></span>
            <div>
              <h3 className="font-display text-[18px] font-semibold">{title}</h3>
              <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-mut">{body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Testimonials */}
      <section className="border-y border-line bg-surface2/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-[30px] font-semibold tracking-tight">Trusted by busy owners.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["“I used to lose 3–4 jobs a week to businesses that answered faster. Now the AI answers in 30 seconds and I just show up.”", "Thando M.", "Plumber, Cape Town"],
              ["“The morning briefing tells me exactly what needs me. The rest it handles — quotes, follow-ups, even chasing the R8,400 I'd forgotten about.”", "Anele K.", "Electrician, Johannesburg"],
              ["“We quoted 3x more and closed 40% better. The AI never gives a price I haven't set — that's the difference.”", "Lerato M.", "Solar installer, Durban"],
            ].map(([q, name, sub]) => (
              <figure key={name} className="card p-5">
                <div className="flex gap-0.5 text-accent">
                  {[...Array(5)].map((_, i) => <Icon key={i} name="star" size={13} className="fill-current" />)}
                </div>
                <blockquote className="mt-3 text-[13.5px] leading-relaxed">{q}</blockquote>
                <figcaption className="mt-4 text-[12px] font-semibold">
                  {name} <span className="font-normal text-mut">· {sub}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" id="pricing">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-[30px] font-semibold tracking-tight">Simple pricing, in Rand.</h2>
          <p className="mt-3 text-[15px] text-mut">Every plan starts with a 14-day free trial. No credit card required.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { name: "Starter", price: 299, tag: "Solo operators getting started", feats: ["AI receptionist", "Leads & customers", "Basic messaging", "Quotes", "Follow-ups"] },
            { name: "Business", price: 699, tag: "Growing service businesses", feats: ["Everything in Starter", "Scheduling & jobs", "Invoices & payment tracking", "Analytics", "AI business assistant"], hot: true },
            { name: "Pro", price: 1499, tag: "Teams that need it all", feats: ["Everything in Business", "Advanced automation", "Multiple team members", "Advanced AI agents", "Voice AI", "Advanced analytics & custom workflows"] },
          ].map((p) => (
            <div key={p.name} className={`card relative flex flex-col p-6 ${p.hot ? "border-brand ring-1 ring-brand/25" : ""}`}>
              {p.hot && <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-[10.5px] font-bold text-white">MOST POPULAR</span>}
              <div className="text-[15px] font-semibold">{p.name}</div>
              <div className="mt-0.5 text-[12px] text-mut">{p.tag}</div>
              <div className="mt-4 font-display text-[34px] font-semibold">
                R{p.price.toLocaleString("en-ZA")}
                <span className="text-[13px] font-medium text-mut">/month</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {p.feats.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px]">
                    <Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth?mode=register" className={`btn-focus mt-6 rounded-xl px-4 py-3 text-center text-[14px] font-semibold transition ${p.hot ? "bg-brand text-white hover:bg-brandstrong" : "border border-line bg-surface hover:border-linestrong"}`}>
                Start 14-day trial
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-[12px] text-mut">AI/WhatsApp usage may incur additional usage charges. Your price is locked for 12 months.</p>
      </section>

      {/* FAQ */}
      <section className="border-t border-line bg-surface2/40 py-16" id="faq">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center font-display text-[30px] font-semibold tracking-tight">Questions, answered.</h2>
          <div className="mt-8 space-y-2.5">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group card overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-[14.5px] font-medium marker:content-none list-none">
                  {q}
                  <Icon name="chevron-down" size={16} className="shrink-0 text-mut transition group-open:rotate-180" />
                </summary>
                <p className="border-t border-line/70 px-5 py-4 text-[13.5px] leading-relaxed text-mut">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-brand py-16 text-white">
        <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-[32px] font-semibold tracking-tight sm:text-[38px]">Never miss a customer again.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">
            You focus on the job. BizPilot handles the admin. Set up takes ten minutes, and your AI team is on shift tonight.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth?mode=register" className="btn-focus rounded-xl bg-white px-7 py-3.5 text-[15px] font-semibold text-brand transition hover:bg-white/90">
              Start for free
            </Link>
            <Link href="/auth" className="btn-focus rounded-xl border border-white/30 px-7 py-3.5 text-[15px] font-medium text-white transition hover:bg-white/10">
              Try the live demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-surface2/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <span className="inline-flex items-center gap-2.5">
              <Logo size={30} />
              <span className="font-display text-[17px] font-semibold">BizPilot</span>
            </span>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mut">
              Your AI business manager. The AI business operating system for South African SMEs — and the future infrastructure for African small business.
            </p>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-mut">Product</div>
            <ul className="mt-3 space-y-2 text-[13px]">
              {[["AI receptionist", "#whatsapp"], ["AI agents", "#ai"], ["Scheduling", "#how"], ["Invoicing", "#how"], ["Pricing", "#pricing"]].map(([l, h]) => (
                <li key={l}><a href={h} className="text-mut hover:text-ink">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-mut">Built for</div>
            <ul className="mt-3 space-y-2 text-[13px] text-mut">
              <li>AI for plumbers & electricians</li>
              <li>WhatsApp business automation SA</li>
              <li>AI CRM South Africa</li>
              <li>AI business software South Africa</li>
            </ul>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-mut">Company</div>
            <ul className="mt-3 space-y-2 text-[13px]">
              <li><Link href="/auth" className="text-mut hover:text-ink">Sign in</Link></li>
              <li><Link href="/auth?mode=register" className="text-mut hover:text-ink">Start free trial</Link></li>
              <li><span className="text-mut">Pretoria, South Africa</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line py-5 text-center text-[11.5px] text-mut">
          © {new Date().getFullYear()} BizPilot (Pty) Ltd · All prices in ZAR, VAT extra where applicable · AI/WhatsApp usage may incur additional charges
        </div>
      </footer>
    </div>
  );
}
