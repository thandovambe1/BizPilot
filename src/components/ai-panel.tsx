"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon, Spinner, useToast } from "./ui";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { formatZAR } from "@/lib/utils";

interface Part {
  t: "status" | "text" | "card" | "action";
  text?: string;
  agent?: string;
  card?: any;
  action?: any;
  state?: "pending" | "working" | "done" | "cancelled" | "failed";
  result?: string;
}
interface Msg {
  id: number;
  role: "user" | "ai";
  parts: Part[];
  streaming?: boolean;
}

const QUICK = [
  "How is my business doing?",
  "Which invoices are overdue?",
  "Who should I follow up with today?",
  "How much did we make this month?",
  "Show me all jobs tomorrow",
  "Book Sarah for tomorrow at 10",
];

let mid = 0;

export function AiPanel({ open, onClose, businessId }: { open: boolean; onClose: () => void; businessId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const toast = useToast();

  useEffect(() => {
    if (open) setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 60);
  }, [messages, open]);

  const pushUser = (text: string) => {
    setMessages((m) => [...m, { id: ++idRef.current, role: "user", parts: [{ t: "text", text }] }]);
  };
  const appendAi = (fn: (msg: Msg) => Msg) => {
    setMessages((m) => {
      const last = m[m.length - 1];
      if (last && last.role === "ai") return [...m.slice(0, -1), fn(last)];
      const base: Msg = { id: ++idRef.current, role: "ai", parts: [], streaming: true };
      return [...m, fn(base)];
    });
  };

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      pushUser(q);
      setBusy(true);
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, conversationId: convId }),
        });
        if (!res.ok || !res.body) {
          let msg = "I couldn't reach the AI service. Please try again.";
          try {
            const j = await res.json();
            msg = j.error ?? msg;
          } catch {
            /* ignore */
          }
          appendAi((m) => ({ ...m, parts: [...m.parts, { t: "text", text: msg }], streaming: false }));
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line) continue;
            let ev: any;
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }
            if (ev.t === "status") appendAi((m) => ({ ...m, parts: [...m.parts, { t: "status", text: ev.text, agent: ev.agent }], streaming: true }));
            else if (ev.t === "card") appendAi((m) => ({ ...m, parts: [...m.parts, { t: "card", card: ev.card }], streaming: true }));
            else if (ev.t === "text") appendAi((m) => ({ ...m, parts: [...m.parts, { t: "text", text: ev.text }], streaming: true }));
            else if (ev.t === "action") appendAi((m) => ({ ...m, parts: [...m.parts, { t: "action", action: ev.action, state: "pending" }], streaming: true }));
            else if (ev.t === "error") appendAi((m) => ({ ...m, parts: [...m.parts, { t: "text", text: ev.text }], streaming: false }));
            else if (ev.t === "done") appendAi((m) => ({ ...m, streaming: false }));
          }
        }
      } catch {
        appendAi((m) => ({ ...m, parts: [...m.parts, { t: "text", text: "I hit a connection problem. Please try again in a moment." }], streaming: false }));
      } finally {
        setBusy(false);
      }
    },
    [busy, convId]
  );

  const confirmAction = async (msgId: number, partIdx: number, action: any, approve: boolean) => {
    const mark = (state: Part["state"], result?: string) =>
      setMessages((ms) =>
        ms.map((m) => (m.id === msgId ? { ...m, parts: m.parts.map((p, i) => (i === partIdx ? { ...p, state, result } : p)) } : m))
      );
    mark("working");
    try {
      const r = await fetch("/api/ai/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: action.id, approve }),
      }).then((r) => r.json());
      mark(approve ? "done" : "cancelled", r.text ?? null);
    } catch {
      mark("failed", "Something went wrong while confirming.");
    }
  };

  const startNew = () => {
    setMessages([]);
    setConvId(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex justify-end" role="dialog" aria-modal="true" aria-label="BizPilot AI assistant">
      <div className="absolute inset-0 bg-black/40 anim-fade-in" onClick={onClose} />
      <div className="relative flex h-full w-full flex-col border-l border-line bg-canvas anim-slide-in sm:w-[460px]">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3.5">
          <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
            <Icon name="sparkles" size={17} />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-ok ring-2 ring-surface" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14.5px] font-semibold leading-tight">BizPilot AI</div>
            <div className="text-[11px] text-mut">AI CEO Agent · working from your live business data</div>
          </div>
          <button onClick={startNew} className="btn-focus rounded-lg border border-line bg-surface2 p-2 text-mut hover:text-ink" aria-label="New conversation" title="New conversation">
            <Icon name="refresh" size={14} />
          </button>
          <button onClick={onClose} className="btn-focus rounded-lg p-2 text-mut hover:bg-surface2 hover:text-ink" aria-label="Close AI panel">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="anim-fade-up mt-6">
              <div className="mb-4">
                <div className="font-display text-[17px] font-semibold">What would you like to do?</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-mut">
                  I can check your numbers, chase payments, draft quotes, book jobs and follow up with customers — and I only report what's actually in your business.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => send(q)} className="btn-focus rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-medium text-mut shadow-sm transition hover:border-brand/40 hover:text-brandstrong">
                    {q}
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-line bg-surface p-3.5">
                <div className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-mut">
                  <Icon name="shield" size={13} className="text-brand" />
                  How I work
                </div>
                <ul className="space-y-1.5 text-[12px] leading-relaxed text-mut">
                  <li className="flex gap-2"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" /> I only answer from your real data — no invented numbers.</li>
                  <li className="flex gap-2"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" /> Consequential actions (reminders, bookings, quotes) need your confirmation.</li>
                  <li className="flex gap-2"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" /> Every action is logged in your AI activity trail.</li>
                </ul>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "ai" ? (
                <div className="flex max-w-[92%] gap-2.5">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
                    <Icon name="sparkles" size={13} />
                  </span>
                  <div className="min-w-0 space-y-2.5">
                    {m.parts.map((p, i) => {
                      if (p.t === "status")
                        return (
                          <div key={i} className="flex items-center gap-2 text-[11.5px] font-medium text-mut">
                            <Spinner size={12} className="text-brand" />
                            <span className="text-brandstrong">{p.agent}:</span> {p.text}
                          </div>
                        );
                      if (p.t === "text")
                        return (
                          <div key={i} className="anim-fade-up whitespace-pre-wrap rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm">
                            {p.text}
                          </div>
                        );
                      if (p.t === "card") return <AiCard key={i} card={p.card} />;
                      if (p.t === "action")
                        return (
                          <div key={i} className="anim-pop overflow-hidden rounded-xl border border-brand/30 bg-surface shadow-sm">
                            <div className="flex items-center gap-2 border-b border-brand/20 bg-brandsoft/60 px-3.5 py-2 text-[11.5px] font-semibold text-brandstrong">
                              <Icon name="zap" size={13} />
                              {p.action.label}
                            </div>
                            <div className="px-3.5 py-3">
                              <p className="text-[12.5px] leading-relaxed text-mut">{p.action.description}</p>
                              {p.state === "pending" && (
                                <div className="mt-3 flex gap-2">
                                  <button onClick={() => confirmAction(m.id, i, p.action, true)} className="btn-focus flex-1 rounded-[9px] bg-brand py-2 text-[12.5px] font-semibold text-white transition hover:bg-brandstrong">
                                    {p.action.confirmLabel}
                                  </button>
                                  <button onClick={() => confirmAction(m.id, i, p.action, false)} className="btn-focus flex-1 rounded-[9px] border border-line bg-surface py-2 text-[12.5px] font-medium text-mut transition hover:text-ink">
                                    {p.action.cancelLabel}
                                  </button>
                                </div>
                              )}
                              {p.state === "working" && (
                                <div className="mt-3 flex items-center justify-center gap-2 rounded-[9px] bg-surface2 py-2 text-[12px] font-medium text-mut">
                                  <Spinner size={13} /> Executing…
                                </div>
                              )}
                              {p.state === "done" && (
                                <div className="mt-3 flex items-start gap-2 rounded-[9px] bg-oksoft px-3 py-2 text-[12px] font-medium text-ok">
                                  <Icon name="check" size={14} className="mt-0.5 shrink-0" />
                                  {p.result ?? "Done."}
                                </div>
                              )}
                              {p.state === "cancelled" && <div className="mt-3 rounded-[9px] bg-surface2 px-3 py-2 text-[12px] font-medium text-mut">Cancelled — nothing was changed.</div>}
                              {p.state === "failed" && <div className="mt-3 rounded-[9px] bg-dangersoft px-3 py-2 text-[12px] font-medium text-danger">{p.result ?? "Action failed."}</div>}
                            </div>
                          </div>
                        );
                      return null;
                    })}
                    {m.streaming && m.parts.every((p) => p.t === "status") && (
                      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2.5 shadow-sm">
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mut" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mut" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-mut" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="anim-fade-up max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-brand px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white shadow-sm">{m.parts[0]?.text}</div>
              )}
            </div>
          ))}
        </div>

        {/* composer */}
        <div className="border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask about revenue, leads, jobs, invoices…"
              className="input max-h-28 min-h-[42px] flex-1 resize-none py-2.5"
              aria-label="Message BizPilot AI"
            />
            <button type="submit" disabled={busy || !input.trim()} className="btn-focus inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-brand text-white shadow-sm transition hover:bg-brandstrong disabled:opacity-40" aria-label="Send message">
              {busy ? <Spinner size={16} /> : <Icon name="send" size={16} />}
            </button>
          </form>
          <div className="mt-1.5 text-center text-[10.5px] text-mut/80">BizPilot AI only reports data from your business. Actions require your approval.</div>
        </div>
      </div>
    </div>
  );
}

function AiCard({ card }: { card: any }) {
  if (!card) return null;
  return (
    <div className="anim-pop overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="border-b border-line bg-surface2/70 px-3.5 py-2 text-[11.5px] font-semibold text-ink">{card.title}</div>
      {card.rows && (
        <div className="divide-y divide-line/70">
          {card.rows.map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-3.5 py-2 text-[12.5px]">
              <span className="text-mut">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
      )}
      {card.items && (
        <div className="divide-y divide-line/70">
          {card.items.map((it: any, i: number) => (
            <div key={i} className="flex items-center gap-2.5 px-3.5 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium">{it.title}</div>
                {it.sub && <div className="truncate text-[11px] text-mut">{it.sub}</div>}
              </div>
              {it.value && <div className="text-[12.5px] font-semibold">{it.value}</div>}
              {it.extra && <div className="rounded-full bg-surface2 px-2 py-0.5 text-[10.5px] font-medium text-mut">{it.extra}</div>}
            </div>
          ))}
        </div>
      )}
      {card.links && (
        <div className="flex gap-2 border-t border-line/70 px-3.5 py-2.5">
          {card.links.map((l: any, i: number) => (
            <a key={i} href={l.href} className="btn-focus rounded-lg bg-brandsoft px-3 py-1.5 text-[12px] font-semibold text-brandstrong transition hover:brightness-95">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
