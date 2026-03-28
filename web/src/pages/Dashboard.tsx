import { useEffect, useState } from "react";
import { api, type NeuroScore, type Intent, type Prediction } from "../lib/api";
import { ScoreGauge } from "../components/ScoreGauge";

export function Dashboard() {
  const [score, setScore] = useState<NeuroScore | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [predict, setPredict] = useState<Prediction | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [s, i, p] = await Promise.all([api.neuroScore(), api.intent(), api.predict()]);
        if (!alive) return;
        setScore(s);
        setIntent(i);
        setPredict(p);
        setErr(null);
      } catch {
        if (alive) setErr("API offline — run `npm run dev` in /server (port 3847).");
      }
    }
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="flex flex-col gap-8 min-h-0">
      <section className="shrink-0">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Command center</h2>
        <p className="text-zinc-400 mt-2 max-w-3xl text-sm sm:text-base leading-relaxed">
          Live cognitive state, intent, and attention timeline — the brain-aware layer that decides when to interrupt you.
        </p>
      </section>

      {err && (
        <div className="shrink-0 rounded-xl border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-rose-200/90 text-sm">{err}</div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 min-h-0 flex-1">
        <div className="lg:col-span-2 surface rounded-2xl p-5 sm:p-6 border border-zinc-800/80 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-5 shrink-0">
            <div>
              <h3 className="font-display text-lg font-semibold text-cyan-400">NeuroScore</h3>
              <p className="text-sm text-zinc-500">Cognitive state engine (browser signals → scores)</p>
            </div>
            {score?.deepFocusSuggested && (
              <span className="text-xs font-mono px-2 py-1 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/25 whitespace-nowrap">
                Deep Focus suggested
              </span>
            )}
          </div>
          {score ? (
            <div className="flex flex-col sm:flex-row gap-6 flex-1 min-h-0">
              <div className="flex justify-center sm:justify-start shrink-0">
                <div
                  className="relative w-28 h-28 rounded-full border-[3px] border-zinc-700 flex items-center justify-center p-1"
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
                  <div className="w-20 h-20 rounded-full bg-zinc-900 flex flex-col items-center justify-center border border-zinc-700">
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

        <div className="surface rounded-2xl p-5 sm:p-6 border border-zinc-800/80 flex flex-col gap-6 min-h-0 overflow-y-auto">
          <div>
            <h3 className="font-display text-lg font-semibold text-emerald-400/90 mb-2">Intent engine</h3>
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
          <div className="border-t border-zinc-800 pt-5">
            <h3 className="font-display text-lg font-semibold text-amber-400/90 mb-2">Attention timeline</h3>
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

      <section className="surface rounded-2xl p-5 sm:p-6 border border-zinc-800/80 shrink-0">
        <h3 className="font-display text-lg font-semibold text-white mb-4">How the full system connects</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-zinc-400">
          <div className="rounded-xl bg-zinc-950/50 p-4 border border-zinc-800/80">
            <span className="text-cyan-400 font-mono text-xs">01</span>
            <p className="text-zinc-200 font-medium mt-1">Chrome extension</p>
            <p className="mt-1 leading-relaxed">Tracks tabs, switches, dwell time → feeds NeuroScore + intent.</p>
          </div>
          <div className="rounded-xl bg-zinc-950/50 p-4 border border-zinc-800/80">
            <span className="text-violet-400 font-mono text-xs">02</span>
            <p className="text-zinc-200 font-medium mt-1">Backend + LLM</p>
            <p className="mt-1 leading-relaxed">Classifies notifications, runs NeuroAgent actions, learns preferences.</p>
          </div>
          <div className="rounded-xl bg-zinc-950/50 p-4 border border-zinc-800/80">
            <span className="text-amber-400 font-mono text-xs">03</span>
            <p className="text-zinc-200 font-medium mt-1">Notification DNA</p>
            <p className="mt-1 leading-relaxed">Urgency × relevance × cost → show, delay, or batch summarize.</p>
          </div>
          <div className="rounded-xl bg-zinc-950/50 p-4 border border-zinc-800/80">
            <span className="text-emerald-400 font-mono text-xs">04</span>
            <p className="text-zinc-200 font-medium mt-1">This dashboard</p>
            <p className="mt-1 leading-relaxed">Analytics, flows, focus exit recap — your attention command center.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
