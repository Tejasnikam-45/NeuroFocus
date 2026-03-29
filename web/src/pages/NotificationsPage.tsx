import { useCallback, useEffect, useState } from "react";
import { api, type NotificationDNA, type NotificationsPayload } from "../lib/api";

const DECISION_STYLES: Record<
  NotificationDNA["decision"],
  { className: string; label: string }
> = {
  show_now: { className: "bg-emerald-950/50 text-emerald-200 border-emerald-800/50", label: "Show" },
  delay: { className: "bg-amber-950/50 text-amber-200 border-amber-800/50", label: "Delay" },
  summarize_later: { className: "bg-violet-950/50 text-violet-200 border-violet-800/50", label: "Digest" },
  block: { className: "bg-zinc-800 text-zinc-200 border-zinc-600", label: "Block" },
};

function DecisionTag({ d }: { d: NotificationDNA["decision"] }) {
  const m = DECISION_STYLES[d];
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${m.className}`}>{m.label}</span>
  );
}

function DnaMetric({
  label,
  value,
  color,
  bar,
}: {
  label: string;
  value: number;
  color: string;
  bar: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 min-w-[4.5rem]">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-lg font-mono font-semibold ${color}`}>{value}</p>
      <div className="mt-1.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function AttentionMeter({ n }: { n: NotificationDNA }) {
  const cost = Math.min(100, Math.max(0, n.attention_cost));
  const val = Math.min(100, Math.max(0, n.attention_value));
  const win = val > cost;
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-zinc-600">
        Both bars use the same 0–100 scale so you can compare cost vs value fairly.
      </p>
      <div className="flex justify-between text-[11px] text-zinc-500">
        <span>Attention cost (interrupt tax)</span>
        <span className="text-rose-300/90 font-mono tabular-nums">{cost}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
        <div
          className="h-full bg-gradient-to-r from-rose-600/90 to-rose-400/50 transition-all min-w-[2px]"
          style={{ width: `${cost}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-zinc-500">
        <span>Attention value (worth your focus)</span>
        <span className="text-emerald-300/90 font-mono tabular-nums">{val}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
        <div
          className="h-full bg-gradient-to-r from-emerald-700/90 to-teal-400/50 transition-all min-w-[2px]"
          style={{ width: `${val}%` }}
        />
      </div>
      <p className="text-xs text-zinc-400">
        {win ? (
          <span className="text-emerald-400/90">Value greater than cost — eligible to surface</span>
        ) : (
          <span className="text-amber-400/90">Cost meets or beats value — defer, batch, or block (policy)</span>
        )}
      </p>
    </div>
  );
}

function safeNotification(n: Partial<NotificationDNA> & { id: string }): NotificationDNA {
  const why = Array.isArray(n.why) ? n.why : [];
  const flowLog = Array.isArray(n.flowLog) ? n.flowLog : [];
  return {
    id: n.id,
    title: n.title ?? "",
    channel: n.channel,
    summary: n.summary,
    urgency: n.urgency ?? 0,
    relevance: n.relevance ?? 0,
    interruptionCost: n.interruptionCost ?? 0,
    senderImportance: n.senderImportance ?? 0,
    attention_cost: n.attention_cost ?? 0,
    attention_value: n.attention_value ?? 0,
    confidence: n.confidence ?? 0,
    focusMinutesEstimate: n.focusMinutesEstimate ?? 1,
    valueLabel: n.valueLabel ?? "medium",
    proposedDecision: n.proposedDecision ?? "delay",
    decision: n.decision ?? "delay",
    failSafeApplied: n.failSafeApplied,
    suggestionNote: n.suggestionNote,
    delayMinutes: n.delayMinutes,
    digestInMinutes: n.digestInMinutes,
    why,
    flowLog,
    userOverride: n.userOverride,
    overrideLabel: n.overrideLabel,
  };
}

export function NotificationsPage() {
  const [payload, setPayload] = useState<NotificationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState<string | null>(null);
  const [flowOpen, setFlowOpen] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback((opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    api
      .notifications()
      .then((r) => {
        setPayload({
          ...r,
          items: r.items.map((item) => safeNotification(item)),
        });
        setErr(null);
      })
      .catch(() => {
        if (!silent) setErr("Could not load Attention Market — start the API (port 3847) and refresh.");
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Server-Sent Events: inbox snapshot + Attention scores refresh ~every 30s when the API is running. */
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.onmessage = (ev) => {
      try {
        const r = JSON.parse(ev.data) as NotificationsPayload;
        setPayload({
          ...r,
          items: r.items.map((item) => safeNotification(item)),
        });
        setErr(null);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  async function runAction(id: string, action: Parameters<typeof api.notificationsAction>[1]) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await api.notificationsAction(id, action);
      if (res?.ok && res.item) {
        const updated = safeNotification(res.item);
        setPayload((prev) => {
          if (!prev) {
            return {
              items: [updated],
              failSafeConfidence: 70,
              tagline: "",
            };
          }
          return {
            ...prev,
            items: prev.items.map((it) => (it.id === id ? updated : it)),
          };
        });
      } else {
        load({ silent: true });
      }
      setToast(action === "reset" ? "Override cleared." : "Override applied.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      setErr(
        /fetch|failed to fetch|network/i.test(msg)
          ? "Network error — is the API running on port 3847? (cd server && npm run dev)"
          : msg
      );
    } finally {
      setBusyId(null);
      window.setTimeout(() => setToast(null), 3200);
    }
  }

  async function sendFeedback(id: string, helpful: boolean) {
    try {
      await api.notificationsFeedback(id, helpful);
      setToast(helpful ? "Thanks — logged for learning (demo)." : "Noted — we’ll weight less aggressive routing.");
    } catch {
      /* noop */
    }
    window.setTimeout(() => setToast(null), 2800);
  }

  const items = payload?.items ?? [];
  const failSafe = payload?.failSafeConfidence ?? 70;

  if (loading && !payload && !err) {
    return (
      <div className="space-y-6 max-w-5xl animate-pulse">
        <div className="h-8 bg-zinc-800 rounded w-1/3" />
        <div className="h-24 bg-zinc-900 rounded-xl border border-zinc-800" />
        <div className="h-64 bg-zinc-900 rounded-xl border border-zinc-800" />
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-5xl">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-500/90">Attention Market Layer</p>
        <h2 className="page-title">Notifications</h2>
        <p className="page-sub max-w-2xl">
          {payload?.tagline ??
            "Treat attention like currency — each ping has a cost and a value. We economically evaluate before we interrupt you."}
        </p>
        <div className="rounded-xl border border-teal-900/40 bg-teal-950/20 px-4 py-3 text-sm text-teal-100/90">
          <strong className="text-teal-200">Fail-safe:</strong> if model confidence is under{" "}
          <span className="font-mono">{failSafe}%</span>, we <strong>do not auto-block</strong> — we show a digest suggestion
          instead. Blocks require confidence or explicit confirmation.
        </div>

        {payload?.gmail?.source === "gmail" && payload.gmail.connected && payload.gmail.email && (
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-100/95 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-2 font-semibold text-emerald-300">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live Gmail inbox
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-200">{payload.gmail.email}</span>
            {payload.gmail.fetchedAt != null && (
              <span className="text-zinc-500">
                Last sync {new Date(payload.gmail.fetchedAt).toLocaleString()} · SSE ~30s
              </span>
            )}
          </div>
        )}
        {payload?.gmail?.connected && payload.gmail.source === "demo" && !payload.gmail.error && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-400">
            No inbox messages matched <code className="text-zinc-500">in:inbox newer_than:7d</code> — showing the demo queue.
            New mail will appear on the next refresh.
          </div>
        )}
        {payload?.gmail?.connected && payload.gmail.error && (
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90">
            Gmail: {payload.gmail.error}. Using demo notifications until this is resolved.
          </div>
        )}
        {!loading && payload && !payload.gmail?.connected && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
            <strong className="text-zinc-300">Real inbox:</strong>{" "}
            <a href="/api/google/auth" className="text-teal-400 underline hover:text-teal-300">
              Connect Google
            </a>{" "}
            (Gmail read scope) to load your messages. The list updates over{" "}
            <strong className="text-zinc-300">Server-Sent Events</strong> about every 30 seconds — no page refresh needed.
          </div>
        )}

        <p className="text-sm text-zinc-500 italic">
          “We don’t just filter notifications — we economically evaluate them.”
        </p>
      </header>

      {toast && (
        <p className="rounded-lg border border-teal-500/30 bg-teal-950/30 px-4 py-2 text-sm text-teal-100">{toast}</p>
      )}
      {err && <p className="rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-2 text-sm text-red-200">{err}</p>}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300">Notification queue</h3>
        {!loading && items.length === 0 && !err && (
          <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-8 text-center text-sm text-zinc-500">
            No notifications in the demo queue. Check the API response for <code className="text-zinc-400">/api/notifications/dna</code>.
          </p>
        )}
        <div className="grid gap-5">
          {items.map((n) => (
            <article
              key={n.id}
              className="surface p-5 space-y-5 border border-zinc-800/80 shadow-lg shadow-black/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">{n.channel || "notification"}</p>
                  <h4 className="text-base font-semibold text-zinc-100 mt-0.5">{n.title}</h4>
                  {n.summary && <p className="text-sm text-zinc-500 mt-1 max-w-xl">{n.summary}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DecisionTag d={n.decision} />
                  {n.userOverride && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/50 text-amber-200 border border-amber-800/40">
                      Override
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-zinc-950/50 border border-zinc-800/60 p-4 space-y-3">
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-zinc-400">
                    This notification costs ~<strong className="text-zinc-200">{n.focusMinutesEstimate} min</strong> of
                    focus
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">
                    Value:{" "}
                    <strong
                      className={
                        n.valueLabel === "high"
                          ? "text-emerald-400"
                          : n.valueLabel === "medium"
                            ? "text-amber-300"
                            : "text-zinc-400"
                      }
                    >
                      {n.valueLabel === "high" ? "High" : n.valueLabel === "medium" ? "Medium" : "Low"}
                    </strong>
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-500">
                    Confidence <span className="font-mono text-zinc-300">{n.confidence}%</span>
                  </span>
                </div>
                {n.proposedDecision !== n.decision && (
                  <p className="text-xs text-amber-200/90">
                    Engine proposed{" "}
                    <strong className="capitalize">{n.proposedDecision.replace(/_/g, " ")}</strong> → effective{" "}
                    <strong className="capitalize">{n.decision.replace(/_/g, " ")}</strong>
                    {n.failSafeApplied ? " (fail-safe)" : ""}
                  </p>
                )}
                {n.suggestionNote && <p className="text-xs text-violet-300/90">{n.suggestionNote}</p>}
                {n.overrideLabel && <p className="text-xs text-amber-200/80">{n.overrideLabel}</p>}
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-3">DNA score card</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <DnaMetric label="Urgency" value={n.urgency} color="text-rose-300" bar="bg-rose-500/80" />
                    <DnaMetric label="Relevance" value={n.relevance} color="text-teal-300" bar="bg-teal-500/80" />
                    <DnaMetric label="Interrupt cost" value={n.interruptionCost} color="text-amber-300" bar="bg-amber-500/80" />
                    <DnaMetric label="Sender" value={n.senderImportance} color="text-violet-300" bar="bg-violet-500/80" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-3">Attention cost meter</p>
                  <AttentionMeter n={n} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-800/80">
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => setWhyOpen(whyOpen === n.id ? null : n.id)}
                  className="rounded-full border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800/80"
                >
                  Why?
                </button>
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => setFlowOpen(flowOpen === n.id ? null : n.id)}
                  className="rounded-full border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800/80"
                >
                  Flow
                </button>
                <span className="text-zinc-600 self-center">|</span>
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => void runAction(n.id, "force_show")}
                  className="rounded-full bg-emerald-950/50 border border-emerald-800/50 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40"
                >
                  Force show
                </button>
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => void runAction(n.id, "delay")}
                  className="rounded-full bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/30"
                >
                  Snooze
                </button>
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => void runAction(n.id, "digest")}
                  className="rounded-full bg-violet-950/40 border border-violet-800/40 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-900/30"
                >
                  To digest
                </button>
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => void runAction(n.id, "block_confirm")}
                  className="rounded-full bg-zinc-800 border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700/80"
                >
                  Confirm block
                </button>
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => void runAction(n.id, "reset")}
                  className="rounded-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Reset
                </button>
                <span className="text-zinc-600 self-center">|</span>
                <button
                  type="button"
                  onClick={() => void sendFeedback(n.id, true)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Helpful
                </button>
                <button
                  type="button"
                  onClick={() => void sendFeedback(n.id, false)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Not helpful
                </button>
              </div>

              {whyOpen === n.id && (
                <div className="rounded-xl border border-zinc-700 bg-zinc-950/80 p-4 text-sm text-zinc-400 space-y-2">
                  <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Why this decision?</p>
                  <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
                    {(n.why ?? []).map((line: string, i: number) => (
                      <li key={i} className="leading-relaxed">
                        {line}
                      </li>
                    ))}
                  </ul>
                  {n.delayMinutes != null && (
                    <p className="text-xs text-zinc-500 pt-1">Delay window: ~{n.delayMinutes} min</p>
                  )}
                  {n.digestInMinutes != null && n.decision === "summarize_later" && (
                    <p className="text-xs text-zinc-500 pt-1">Digest bundle: ~{n.digestInMinutes} min</p>
                  )}
                </div>
              )}

              {flowOpen === n.id && (
                <div className="rounded-xl border border-zinc-700 bg-zinc-950/80 p-4 text-xs text-zinc-400 space-y-2 font-mono">
                  <p className="text-[11px] font-sans font-semibold text-zinc-300 uppercase tracking-wide">Pipeline</p>
                  <ol className="space-y-1.5 list-decimal pl-5">
                    {(n.flowLog ?? []).map((line: string, i: number) => (
                      <li key={i} className="leading-relaxed">
                        {line}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
