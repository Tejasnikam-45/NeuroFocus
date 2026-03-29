import { useEffect, useState, type ReactNode } from "react";
import type { ArchitecturePayload } from "../../hooks/useArchitectureStream";

function formatHmsMs(ts: number | null | undefined) {
  if (ts == null || !Number.isFinite(ts)) return "—";
  const d = new Date(ts);
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${d.toLocaleTimeString(undefined, { hour12: false })}.${ms}`;
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <div className="h-6 w-px bg-gradient-to-b from-teal-500/50 to-violet-500/40" />
      <span className="rounded-full border border-zinc-700/80 bg-zinc-950/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="h-6 w-px bg-gradient-to-b from-violet-500/40 to-teal-500/30" />
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  tickTime,
  extraTimeLabel,
  extraTime,
  children,
}: {
  title: string;
  subtitle?: string;
  tickTime: number;
  extraTimeLabel?: string;
  extraTime?: number | null;
  children: ReactNode;
}) {
  return (
    <section className="surface-muted rounded-2xl border border-zinc-800/70 p-4 shadow-lg shadow-black/20">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800/60 pb-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>}
        </div>
        <div className="text-right font-mono text-[10px] leading-tight text-zinc-500">
          <div>
            <span className="text-zinc-600">frame </span>
            <span className="tabular-nums text-teal-400/90">{formatHmsMs(tickTime)}</span>
          </div>
          {extraTimeLabel != null && (
            <div className="mt-0.5">
              <span className="text-zinc-600">{extraTimeLabel} </span>
              <span className="tabular-nums text-violet-400/85">{formatHmsMs(extraTime ?? null)}</span>
            </div>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export function SystemArchitectureDiagram({ data, connected }: { data: ArchitecturePayload | null; connected: boolean }) {
  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setLocalNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  if (!data) {
    return (
      <div className="surface rounded-2xl border border-zinc-800/80 p-8 text-center">
        <p className="text-sm text-zinc-500">
          {connected ? "Waiting for architecture stream…" : "Start the server to load the live system map."}
        </p>
      </div>
    );
  }

  const t = data.serverTime;
  const s = data.signals;
  const n = data.neuroScore;
  const ageIngest = data.ingest.lastIngestAt != null ? Math.max(0, localNow - data.ingest.lastIngestAt) : null;

  return (
    <div className="space-y-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Live map · SSE <code className="text-zinc-600">/api/architecture/stream</code> every{" "}
          <span className="tabular-nums text-zinc-400">{data.flows.streamIntervalMs}ms</span>
        </p>
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500">
          <span>
            client clock{" "}
            <span className="tabular-nums text-zinc-300">{formatHmsMs(localNow)}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${
              connected ? "border-emerald-500/30 text-emerald-400/90" : "border-zinc-700 text-zinc-500"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-emerald-400" : "bg-zinc-600"}`} />
            {connected ? "stream open" : "offline"}
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        {/* Left column: ingress + context */}
        <div className="flex flex-col gap-0 lg:pr-4">
          <SectionShell
            title="Chrome extension"
            subtitle="Tab context → NeuroFocus API"
            tickTime={t}
            extraTimeLabel="last ingest"
            extraTime={data.ingest.lastIngestAt}
          >
            <ul className="space-y-1.5 font-mono text-[11px] text-zinc-400">
              <li className="flex justify-between gap-2">
                <span className="text-zinc-500">Live ingest</span>
                <span className={data.ingest.hasLiveIngest ? "text-emerald-400/90" : "text-amber-400/80"}>
                  {data.ingest.hasLiveIngest ? "active (<2m)" : "idle / demo drift"}
                </span>
              </li>
              {ageIngest != null && data.ingest.lastIngestAt != null && (
                <li className="flex justify-between gap-2">
                  <span className="text-zinc-500">Age</span>
                  <span className="tabular-nums text-zinc-300">{(ageIngest / 1000).toFixed(1)}s ago</span>
                </li>
              )}
              <li className="flex justify-between gap-2">
                <span className="text-zinc-500">Domain</span>
                <span className="truncate text-right text-cyan-400/90">{s.activeDomain}</span>
              </li>
              <li className="text-zinc-500">
                Title{" "}
                <span className="mt-0.5 block text-zinc-300">
                  {s.activeTitle.length > 64 ? `${s.activeTitle.slice(0, 61)}…` : s.activeTitle}
                </span>
              </li>
            </ul>
          </SectionShell>

          <FlowArrow label="POST /api/context/ingest · JSON" />

          <SectionShell title="Signal fusion" subtitle="Dwell · switches · backtrack → feature vector" tickTime={t}>
            <ul className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              <li className="rounded-lg bg-zinc-950/50 px-2 py-1.5 text-center">
                <div className="text-zinc-500">dwell</div>
                <div className="tabular-nums text-white">{Math.round(s.dwellSeconds)}s</div>
              </li>
              <li className="rounded-lg bg-zinc-950/50 px-2 py-1.5 text-center">
                <div className="text-zinc-500">tabs/min</div>
                <div className="tabular-nums text-white">{s.tabSwitchesPerMin.toFixed(1)}</div>
              </li>
              <li className="rounded-lg bg-zinc-950/50 px-2 py-1.5 text-center">
                <div className="text-zinc-500">backtrack</div>
                <div className="tabular-nums text-white">{(s.backtrackRatio * 100).toFixed(0)}%</div>
              </li>
            </ul>
          </SectionShell>
        </div>

        {/* Center spine */}
        <div className="hidden flex-col items-center py-2 lg:flex">
          <div className="w-px flex-1 min-h-[120px] bg-gradient-to-b from-transparent via-teal-500/25 to-transparent" />
          <span className="my-2 rotate-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">data</span>
          <div className="w-px flex-1 min-h-[120px] bg-gradient-to-b from-transparent via-violet-500/25 to-transparent" />
        </div>

        {/* Right column: intelligence + outputs */}
        <div className="flex flex-col gap-0 lg:pl-4">
          <SectionShell title="Cognitive core" subtitle="NeuroScore + intent + attention timeline" tickTime={t}>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Focus</div>
                <div className="font-display text-xl font-semibold text-teal-400 tabular-nums">{n.focus}</div>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Stress</div>
                <div className="font-display text-xl font-semibold text-rose-400 tabular-nums">{n.stress}</div>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Confusion</div>
                <div className="font-display text-xl font-semibold text-violet-400 tabular-nums">{n.confusion}</div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              <span className="font-medium text-amber-400/90">{n.label}</span>
              {n.deepFocusSuggested && (
                <span className="ml-2 rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-300">Deep focus</span>
              )}
            </p>
            <p className="mt-2 border-t border-zinc-800/60 pt-2 text-[11px] text-zinc-500">
              Intent <span className="text-zinc-200">{data.intent.intent.replace(/_/g, " ")}</span> ·{" "}
              <span className="tabular-nums">{(data.intent.confidence * 100).toFixed(0)}%</span>
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Timeline ~<span className="tabular-nums text-cyan-400/90">{data.prediction.estimatedMinutesRemaining}m</span>{" "}
              on <span className="text-zinc-300">{data.prediction.taskLabel}</span>
            </p>
          </SectionShell>

          <FlowArrow label="scores feed DNA + flows + agent" />

          <SectionShell
            title="Notification DNA + inbox"
            subtitle="Gmail / demo queue → economic decisions"
            tickTime={t}
            extraTimeLabel="Gmail sync"
            extraTime={data.notifications.gmailFetchedAt}
          >
            <ul className="space-y-1.5 font-mono text-[11px] text-zinc-400">
              <li className="flex justify-between gap-2">
                <span className="text-zinc-500">Queue</span>
                <span className="tabular-nums text-white">{data.notifications.queueSize} items</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-zinc-500">Source</span>
                <span className="text-violet-400/90">{data.notifications.inboxSource}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-zinc-500">Gmail</span>
                <span className={data.notifications.gmailConnected ? "text-emerald-400/90" : "text-zinc-500"}>
                  {data.notifications.gmailConnected
                    ? data.notifications.gmailEmail ?? "connected"
                    : "not connected"}
                </span>
              </li>
              <li className="flex justify-between gap-2 border-t border-zinc-800/50 pt-1.5">
                <span className="text-zinc-500">DNA actions (log)</span>
                <span className="text-right text-zinc-300">
                  delay {data.dna.delayed} · batch {data.dna.batched} · show {data.dna.shown}
                </span>
              </li>
            </ul>
          </SectionShell>

          <FlowArrow label="GET /api/agent/queue · voice / commands" />

          <SectionShell title="Agent & automations" subtitle="NeuroAgent queue + active flow rules" tickTime={t}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-[11px]">
              <div className="rounded-lg bg-zinc-950/50 px-2 py-1.5">
                <div className="text-zinc-500">Agent jobs</div>
                <div className="tabular-nums text-white">{data.agent.total}</div>
              </div>
              <div className="rounded-lg bg-zinc-950/50 px-2 py-1.5">
                <div className="text-zinc-500">Pending</div>
                <div className="tabular-nums text-amber-400/90">{data.agent.pending}</div>
              </div>
              <div className="rounded-lg bg-zinc-950/50 px-2 py-1.5">
                <div className="text-zinc-500">Needs OK</div>
                <div className="tabular-nums text-rose-400/90">{data.agent.needsApproval}</div>
              </div>
              <div className="rounded-lg bg-zinc-950/50 px-2 py-1.5">
                <div className="text-zinc-500">Running</div>
                <div className="tabular-nums text-cyan-400/90">{data.agent.running}</div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Flow engine: <span className="tabular-nums text-teal-400/90">{data.flows.activeAutomations}</span>{" "}
              automations described below · Analytics SSE <code className="text-zinc-600">/api/analytics/stream</code>
            </p>
          </SectionShell>
        </div>
      </div>

      {/* Mobile vertical connectors */}
      <div className="mt-2 space-y-2 lg:hidden">
        <FlowArrow label="end-to-end path" />
      </div>
    </div>
  );
}
