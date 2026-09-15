"use client";

import { useState } from "react";
import { formatZAR } from "@/lib/utils";

export function BarChart({ data, height = 160, money = false }: { data: { label: string; value: number }[]; height?: number; money?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-[5px]" style={{ height }} role="img" aria-label="Bar chart">
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div
              className="rounded-t-[5px] bg-brand/85 transition-all duration-200 group-hover:bg-brand"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, opacity: hover === null || hover === i ? 1 : 0.35 }}
            />
            {hover === i && (
              <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium shadow-lg">
                <span className="block text-mut">{d.label}</span>
                {money ? formatZAR(d.value) : d.value.toLocaleString("en-ZA")}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-mut">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function MiniBars({ data, height = 44 }: { data: number[]; height?: number }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }} aria-hidden="true">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-[3px] bg-brand/70" style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export function Donut({ parts, size = 132, label, sub }: { parts: { value: number; color: string; name: string }[]; size?: number; label: string; sub?: string }) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  let acc = 0;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bp-line)" strokeWidth="13" />
          {parts.map((p, i) => {
            const frac = p.value / total;
            const dash = `${frac * c} ${c}`;
            const offset = -acc * c;
            acc += frac;
            return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth="13" strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="butt" />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[17px] font-semibold leading-tight">{label}</span>
          {sub && <span className="text-[10.5px] text-mut">{sub}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
            <span className="text-mut">{p.name}</span>
            <span className="ml-auto font-medium">{Math.round((p.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBars({ data, money = false }: { data: { label: string; value: number; sub?: string }[]; money?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
            <span className="font-medium">{d.label}</span>
            <span className="text-mut">
              {money ? formatZAR(d.value) : d.value.toLocaleString("en-ZA")}
              {d.sub ? ` · ${d.sub}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div className="flex flex-col gap-1.5">
      {stages.map((s, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-right text-[12px] text-mut">{s.label}</div>
          <div className="h-[26px] flex-1 overflow-hidden rounded-md bg-surface2">
            <div className="flex h-full items-center rounded-md bg-brand pl-2 text-[11px] font-semibold text-white transition-all duration-500" style={{ width: `${Math.max(8, (s.value / max) * 100)}%`, opacity: 1 - i * 0.13 }}>
              {s.value}
            </div>
          </div>
          <div className="w-10 shrink-0 text-[11px] text-mut">{max ? Math.round((s.value / max) * 100) : 0}%</div>
        </div>
      ))}
    </div>
  );
}
