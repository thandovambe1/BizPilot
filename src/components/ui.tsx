"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* ----------------------------- Icons ----------------------------- */

const PATHS: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18.5 15.4c1.6.8 2.7 2.4 3 4.6" /></>,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c1-3.7 4-5.7 7.5-5.7s6.5 2 7.5 5.7" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></>,
  wrench: <><path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 0 0 5.6-6L14.5 12l-2.5-2.5Z" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></>,
  receipt: <><path d="M5 21 4 3h16l-1 18-5-2-5 2Z" /><path d="M8.5 8h7M8.5 12h7" /></>,
  chart: <><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" rx="0.5" /><rect x="12" y="8" width="3" height="10" rx="0.5" /><rect x="17" y="5" width="3" height="13" rx="0.5" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></>,
  sparkles: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z" /><path d="M5 2l.7 1.8L7.5 4.5l-1.8.7L5 7l-.7-1.8L2.5 4.5l1.8-.7Z" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  x: <><path d="M18 6 6 18M6 6l12 12" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
  phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9" /></>,
  chat: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.8-.3-4-1L3 20l1-5.5a8.5 8.5 0 1 1 17-3" /></>,
  zap: <><path d="M13 2 3 14h8l-1 8 11-13h-8l1-7" /></>,
  shield: <><path d="M12 2 4 5.5V11c0 5.2 3.4 9.5 8 11 4.6-1.5 8-5.8 8-11V5.5Z" /><path d="m8.5 11.5 2.5 2.5 4.5-4.5" /></>,
  sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
  moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  dots: <><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9.5h18" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" /><path d="M12 9v4.5M12 17.5h.01" /></>,
  star: <><path d="m12 2.5 2.9 5.9 6.6 1-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-1Z" /></>,
  bot: <><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M8.5 4h7" /><circle cx="9" cy="14" r="1.1" fill="currentColor" /><circle cx="15" cy="14" r="1.1" fill="currentColor" /><path d="M9.5 17h5" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  camera: <><path d="M4 7h3l2-3h6l2 3h3a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19V8.5A1.5 1.5 0 0 1 4 7" /><circle cx="12" cy="13.5" r="3.5" /></>,
  grip: <><circle cx="9" cy="6" r="1.2" fill="currentColor" /><circle cx="15" cy="6" r="1.2" fill="currentColor" /><circle cx="9" cy="12" r="1.2" fill="currentColor" /><circle cx="15" cy="12" r="1.2" fill="currentColor" /><circle cx="9" cy="18" r="1.2" fill="currentColor" /><circle cx="15" cy="18" r="1.2" fill="currentColor" /></>,
  "arrow-right": <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  trash: <><path d="M3 6h18M8 6V4a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 4v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.3" /><path d="M21 3v6h-6" /></>,
  wallet: <><path d="M20 7H5a2 2 0 0 1 0-4h13v4" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1" /><circle cx="16.5" cy="14" r="1.2" fill="currentColor" /></>,
  "trend-up": <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  "trend-down": <><path d="m3 7 6 6 4-4 8 8" /><path d="M15 17h6v-6" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" /></>,
  key: <><circle cx="8" cy="15" r="4.5" /><path d="m11.5 11.5 8-8M17 5l3 3M14 8l2.5 2.5" /></>,
  layers: <><path d="m12 2 9 5-9 5-9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7" /><circle cx="12" cy="12" r="3" /></>,
  command: <><path d="M9 9V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z" /></>,
  play: <path d="M7 4.5v15l12-7.5Z" />,
  pause: <><path d="M9 4v16M15 4v16" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 8 5-5 5 5M12 3v12" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
};

export function Icon({ name, size = 18, className, strokeWidth = 1.8 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={cn("shrink-0", className)} aria-hidden="true">
      {PATHS[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

export function MarkSvg({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="bpPlaneMark" x1="11" y1="47" x2="50" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1C7FF2" />
          <stop offset="1" stopColor="#16CFC7" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#0B1F3D" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13 V51" />
        <path d="M18 15 C 38 13 44.5 18.5 43.5 25 C 42.5 30.2 36 31 18 30" />
        <path d="M18 33 C 40 31 46.5 37 44.5 43.5 C 42.5 49.5 35 52.5 18 50.5" />
      </g>
      <path d="M50.5 9.5 L10 33.8 L26 36.6 L32.8 49.8 Z" fill="none" stroke="#ffffff" strokeWidth="5.5" strokeLinejoin="round" />
      <path d="M50.5 9.5 L10 33.8 L26 36.6 L32.8 49.8 Z" fill="url(#bpPlaneMark)" />
      <path d="M26 36.6 L50.5 9.5" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-[9px] border border-line bg-white shadow-sm", className)}
      style={{ width: size, height: size }}
    >
      <MarkSvg size={Math.round(size * 0.78)} />
    </span>
  );
}

export function Wordmark({ size = 30, dark }: { size?: number; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Logo size={size} />
      <span className={cn("font-display font-bold tracking-tight", dark ? "text-white" : "text-ink")} style={{ fontSize: size * 0.62 }}>
        <span className={cn(dark ? "text-white" : "text-[#0B1F3D] dark:text-white/95")}>Biz</span>
        <span
          style={{
            backgroundImage: "linear-gradient(92deg,#1C7FF2 0%,#16CFC7 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Pilot
        </span>
      </span>
    </span>
  );
}

/* ----------------------------- Buttons ----------------------------- */

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  icon,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"; size?: "sm" | "md" | "lg"; icon?: string }) {
  const base = "btn-focus inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };
  const variants = {
    primary: "bg-brand text-white hover:bg-brandstrong active:scale-[0.98] shadow-sm",
    accent: "bg-accent text-[#241a08] hover:brightness-95 active:scale-[0.98] shadow-sm",
    secondary: "bg-surface border border-line text-ink hover:border-linestrong hover:bg-surface2 active:scale-[0.98]",
    ghost: "text-mut hover:text-ink hover:bg-surface2",
    danger: "bg-dangersoft text-danger hover:brightness-95",
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}

/* ----------------------------- Surfaces ----------------------------- */

export function Card({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "brand" | "ok" | "warn" | "danger" | "info" | "accent"; className?: string }) {
  const tones = {
    neutral: "bg-surface2 text-mut border-line",
    brand: "bg-brandsoft text-brand border-brand/20",
    ok: "bg-oksoft text-ok border-ok/20",
    warn: "bg-warnsoft text-warn border-warn/20",
    danger: "bg-dangersoft text-danger border-danger/20",
    info: "bg-infosoft text-info border-info/20",
    accent: "bg-accentsoft text-accent border-accent/25",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", tones[tone], className)}>
      {children}
    </span>
  );
}

export const statusTone: Record<string, "neutral" | "brand" | "ok" | "warn" | "danger" | "info" | "accent"> = {
  new: "info",
  contacted: "info",
  qualified: "brand",
  quote_sent: "accent",
  negotiating: "warn",
  booked: "ok",
  won: "ok",
  lost: "danger",
  draft: "neutral",
  sent: "info",
  viewed: "accent",
  accepted: "ok",
  rejected: "danger",
  expired: "neutral",
  scheduled: "info",
  confirmed: "brand",
  en_route: "accent",
  on_site: "accent",
  in_progress: "warn",
  completed: "ok",
  cancelled: "danger",
  partial: "warn",
  paid: "ok",
  overdue: "danger",
  active: "ok",
  escalated: "danger",
  resolved: "ok",
  human: "warn",
  ai: "brand",
  hybrid: "info",
  emergency: "danger",
  high: "warn",
  normal: "neutral",
  low: "neutral",
  trialing: "accent",
  past_due: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

/* ----------------------------- Form bits ----------------------------- */

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-mut">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-mut/80">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[22px] w-[40px] rounded-full transition-colors duration-200 shrink-0", checked ? "bg-brand" : "bg-linestrong")}
    >
      <span className={cn("absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all duration-200", checked ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

/* ----------------------------- Modal / Drawer ----------------------------- */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/45 anim-fade-in backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn("relative w-full anim-pop rounded-t-2xl sm:rounded-2xl border border-line bg-surface shadow-2xl max-h-[92vh] flex flex-col", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-[15px] font-semibold">{title}</h3>
          <button onClick={onClose} className="btn-focus rounded-lg p-1.5 text-mut hover:bg-surface2 hover:text-ink" aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, sub }: { open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 anim-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-line bg-surface shadow-2xl anim-slide-in">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="font-display text-[16px] font-semibold">{title}</div>
            {sub && <div className="mt-0.5 text-[12.5px] text-mut">{sub}</div>}
          </div>
          <button onClick={onClose} className="btn-focus rounded-lg p-1.5 text-mut hover:bg-surface2 hover:text-ink" aria-label="Close panel">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ----------------------------- Misc ----------------------------- */

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("animate-spin", className)} aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Avatar({ name, size = 34, tone = "brand" }: { name: string; size?: number; tone?: "brand" | "accent" | "info" | "danger" }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const tones: Record<string, string> = { brand: "bg-brandsoft text-brand", accent: "bg-accentsoft text-accent", info: "bg-infosoft text-info", danger: "bg-dangersoft text-danger" };
  return (
    <span className={cn("inline-flex items-center justify-center rounded-full font-semibold shrink-0", tones[tone])} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function EmptyState({ icon, title, body, action, ctaLabel }: { icon: string; title: string; body: string; action?: () => void; ctaLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-linestrong bg-surface2/50 px-6 py-14 text-center">
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-mut shadow-sm">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="font-display text-[15px] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-mut">{body}</p>
      {action && ctaLabel && (
        <Button className="mt-5" size="sm" onClick={action}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}

export function Kpi({ label, value, sub, icon, tone = "brand" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: string; tone?: "brand" | "accent" | "info" | "danger" | "ok" | "warn" }) {
  const toneCls: Record<string, string> = {
    brand: "bg-brandsoft text-brand",
    accent: "bg-accentsoft text-accent",
    info: "bg-infosoft text-info",
    danger: "bg-dangersoft text-danger",
    ok: "bg-oksoft text-ok",
    warn: "bg-warnsoft text-warn",
  };
  return (
    <Card className="p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-mut">{label}</div>
          <div className="mt-1 font-display text-[22px] font-semibold leading-tight tracking-tight">{value}</div>
          {sub && <div className="mt-1 text-[11.5px] text-mut">{sub}</div>}
        </div>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-[10px]", toneCls[tone])}>
          <Icon name={icon} size={17} />
        </span>
      </div>
    </Card>
  );
}

/* ----------------------------- Toasts ----------------------------- */

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "danger" | "info";
}
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "anim-pop pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-lg",
              t.tone === "ok" && "border-ok/30 bg-surface text-ink",
              t.tone === "danger" && "border-danger/30 bg-surface text-ink",
              t.tone === "info" && "border-info/30 bg-surface text-ink"
            )}
          >
            <Icon name={t.tone === "ok" ? "check" : t.tone === "danger" ? "alert" : "info"} size={15} className={t.tone === "ok" ? "text-ok" : t.tone === "danger" ? "text-danger" : "text-info"} />
            <span className="leading-snug">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
