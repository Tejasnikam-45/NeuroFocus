import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type NeuroScore, type Intent, type Prediction } from "../lib/api";
import { ScoreGauge } from "../components/ScoreGauge";

type StreamPayload = {
  neuroScore: NeuroScore;
  intent: Intent;
  prediction: Prediction;
  signals?: { hasLiveIngest?: boolean; activeDomain?: string; activeTitle?: string };
  serverTime: number;
};

export function Dashboard() {
  const [score, setScore] = useState<NeuroScore | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [predict, setPredict] = useState<Prediction | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [extensionLive, setExtensionLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [s, i, p] = await Promise.all([api.neuroScore(), api.intent(), api.predict()]);
        if (cancelled) return;
        setScore(s);
        setIntent(i);
        setPredict(p);
        setErr(null);
      } catch {
        if (!cancelled) setErr("API offline — run `npm run dev` in /server (port 3847).");
      }
    }
    void bootstrap();

    const es = new EventSource("/api/dashboard/stream");
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data) as StreamPayload;
        setScore(d.neuroScore);
        setIntent(d.intent);
        setPredict(d.prediction);
        setLastSync(d.serverTime);
        setExtensionLive(Boolean(d.signals?.hasLiveIngest));
        setErr(null);
      } catch {
        /* ignore malformed chunk */
      }
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-col gap-8">
      <section className="surface relative shrink-0 overflow-hidden rounded-3xl border border-zinc-800/80 p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-teal-500/[0.12] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-violet-500/[0.1] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-400/90">Command center</p>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              Attention, live
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Cognitive state, intent, and timeline — refreshed every ~2s via{" "}
              <strong className="font-medium text-zinc-200">Server-Sent Events</strong>. Feed tab context with the extension →{" "}
              <code className="rounded bg-zinc-950/80 px-1.5 py-0.5 text-[13px] text-zinc-500">POST /api/context/ingest</code>.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 text-xs sm:items-end">
            {lastSync != null && (
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-950/40 px-3 py-1.5 text-cyan-100/95">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                </span>
                Live · {new Date(lastSync).toLocaleTimeString()}
              </span>
            )}
            {extensionLive && (
              <span className="text-right font-medium text-emerald-400/95">Extension ingest active</span>
            )}
          </div>
        </div>
        <nav className="relative mt-6 flex flex-wrap gap-2">
          {[
            { to: "/analytics", label: "Analytics" },
            { to: "/agent", label: "Agent" },
            { to: "/notifications", label: "Notifications" },
            { to: "/flows", label: "Flows" },
          ].map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="rounded-full border border-zinc-700/90 bg-zinc-950/40 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-teal-500/35 hover:text-white"
            >
              {q.label}
            </Link>
          ))}
        </nav>
      </section>

      {err && (
        <div className="shrink-0 rounded-xl border border-rose-900/40 bg-rose-950/25 px-4 py-3 text-sm text-rose-200/90">
          {err}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-3">
        <div className="surface flex flex-col rounded-2xl border border-zinc-800/80 p-5 sm:p-6 lg:col-span-2">
          <div className="mb-5 flex shrink-0 items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-cyan-400">NeuroScore</h3>
              <p className="text-sm text-zinc-500">Browser signals → interpretable scores</p>
            </div>
            {score?.deepFocusSuggested && (
              <span className="whitespace-nowrap rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 font-mono text-xs text-violet-200">
                Deep Focus suggested
              </span>
            )}
          </div>
          {score ? (
            <div className="flex flex-col sm:flex-row gap-6 flex-1 min-h-0">
              <div className="flex justify-center sm:justify-start shrink-0">
                <div
                  className="relative flex h-28 w-28 items-center justify-center rounded-full border-[3px] border-zinc-700/90 p-1 shadow-[0_0_40px_-12px_rgba(45,212,191,0.35)]"
                  style={{
                    background: (() => {
                      const f = score.focus;
                      const s = score.stress;
                      const c = score.confusion;
                      const a = f;
                      const b = Math.min(100, f + s);
                      const d = Math.min(100, f + s + c);
                      return `conic-gradient(from -90deg, rgb(34 211 238) 0% ${a}%, rgb(251 113 133) ${a}% ${b}%, rgb(167 139 250) ${b}% ${d}%, rgb(39 39 42) ${d}% 100%)`;
                    })(),
                  }}
                >
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-950">
                    <span className="font-display font-bold text-2xl text-white tabular-nums">{score.focus}</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">focus</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-4 min-w-0">
                <ScoreGauge value={score.focus} label="Focus level" colorClass="bg-cyan-400" />
                <ScoreGauge value={score.stress} label="Stress / overload" colorClass="bg-rose-400" />
                <ScoreGauge value={score.confusion} label="Confusion (tabs / backtrack)" colorClass="bg-violet-400" />
              </div>
            </div>
          ) : (
            <p className="text-zinc-500 animate-pulse">Loading NeuroScore…</p>
          )}
          {score && (
            <p className="text-sm text-zinc-300 border-t border-zinc-800 mt-5 pt-4 shrink-0">
              <span className="text-amber-400 font-medium">{score.label}</span>
              {" — "}
              {score.recommendation}
            </p>
          )}
        </div>

        <div className="surface flex min-h-0 flex-col gap-6 overflow-y-auto rounded-2xl border border-zinc-800/80 p-5 sm:p-6">
          <div>
            <h3 className="font-display mb-2 text-lg font-semibold text-emerald-400/90">Intent engine</h3>
            {intent ? (
              <>
                <p className="text-2xl font-display font-bold capitalize text-white">{intent.intent.replace(/_/g, " ")}</p>
                <p className="text-sm text-zinc-500 mt-1">Confidence {(intent.confidence * 100).toFixed(0)}%</p>
                <ul className="mt-3 text-xs font-mono text-zinc-400 space-y-1.5">
                  {intent.signals.map((s) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-zinc-500 text-sm">Inferring…</p>
            )}
          </div>
          <div className="border-t border-zinc-800/80 pt-5">
            <h3 className="font-display mb-2 text-lg font-semibold text-amber-400/90">Attention timeline</h3>
            {predict ? (
              <>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Likely finishing <span className="text-white font-medium">{predict.taskLabel}</span> in ~{" "}
                  <span className="text-cyan-400 font-mono">{predict.estimatedMinutesRemaining} min</span>
                </p>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{predict.rationale}</p>
              </>
            ) : (
              <p className="text-zinc-500 text-sm">Predicting…</p>
            )}
          </div>
        </div>
      </div>

      <section className="surface shrink-0 rounded-2xl border border-zinc-800/80 p-5 sm:p-6">
        <h3 className="font-display mb-4 text-lg font-semibold text-white">How the stack connects</h3>
        <div className="grid gap-3 text-sm text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "01", c: "text-cyan-400", t: "Chrome extension", d: "Tabs, switches, dwell → NeuroScore + intent." },
            { n: "02", c: "text-violet-400", t: "Backend + LLM", d: "DNA decisions, NeuroAgent, preference learning." },
            { n: "03", c: "text-amber-400", t: "Notification DNA", d: "Urgency × relevance × cost → route interruptions." },
            { n: "04", c: "text-emerald-400", t: "This surface", d: "Analytics, flows, focus exit — command view." },
          ].map((x) => (
            <div
              key={x.n}
              className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4 transition hover:border-zinc-700/90"
            >
              <span className={`font-mono text-xs ${x.c}`}>{x.n}</span>
              <p className="mt-1 font-medium text-zinc-200">{x.t}</p>
              <p className="mt-2 leading-relaxed text-zinc-500">{x.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
