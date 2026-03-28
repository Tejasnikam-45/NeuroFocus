import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type ExplainabilityResult } from "../lib/api";

const DEMO_LINE = "Users don't just see what AI did — they understand why it did it.";

export function CognitiveTransparencyPage() {
  const [decision, setDecision] = useState<"delay" | "show_now" | "summarize_later">("delay");
  const [focusLevel, setFocusLevel] = useState(38);
  const [urgency, setUrgency] = useState(82);
  const [senderImportance, setSenderImportance] = useState(0.78);
  const [deadlineHours, setDeadlineHours] = useState<number | "">(6);
  const [userHistory, setUserHistory] = useState("often_batches_slack");
  const [deepFocus, setDeepFocus] = useState(true);
  const [inMeeting, setInMeeting] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(25);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainabilityResult | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await api.explainabilityAnalyze({
        decision,
        focus_level: focusLevel,
        urgency,
        sender_importance: senderImportance,
        deadline_hours: deadlineHours === "" ? null : Number(deadlineHours),
        user_history: userHistory || undefined,
        delay_minutes: decision === "delay" ? delayMinutes : undefined,
        context: { deep_focus: deepFocus, in_meeting: inMeeting },
      });
      setResult(r);
    } catch {
      setErr("Could not reach explainability API — start the server (port 3847).");
    } finally {
      setLoading(false);
    }
  }

  function loadPreset(which: "deep_focus_delay" | "urgent_show" | "meeting_batch") {
    if (which === "deep_focus_delay") {
      setDecision("delay");
      setFocusLevel(35);
      setUrgency(55);
      setSenderImportance(0.45);
      setDeadlineHours(48);
      setUserHistory("often_batches_slack");
      setDeepFocus(true);
      setInMeeting(false);
      setDelayMinutes(30);
    } else if (which === "urgent_show") {
      setDecision("show_now");
      setFocusLevel(62);
      setUrgency(92);
      setSenderImportance(0.9);
      setDeadlineHours(4);
      setUserHistory("replies_fast_to_client");
      setDeepFocus(false);
      setInMeeting(false);
    } else {
      setDecision("summarize_later");
      setFocusLevel(55);
      setUrgency(48);
      setSenderImportance(0.5);
      setDeadlineHours(72);
      setUserHistory("");
      setDeepFocus(false);
      setInMeeting(true);
    }
    setResult(null);
    setErr(null);
  }

  const pct = result ? Math.round(result.confidence * 100) : null;

  return (
    <div className="space-y-10">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
          <Link to="/neuro-command-layer" className="text-teal-400/90 hover:text-teal-300">
            NeuroCommand Layer
          </Link>
          <span className="text-zinc-600"> / </span>
          <span className="text-zinc-400">Cognitive Transparency</span>
        </p>
        <h2 className="page-title">Cognitive Transparency (Explainable AI)</h2>
        <p className="page-sub">
          For every action: why it was chosen, which factors fired, what else could have happened — before you trust or
          override it.
        </p>
        <p className="mt-4 text-sm italic text-violet-400/85 border-l-2 border-violet-500/40 pl-4">{DEMO_LINE}</p>
      </header>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5 font-mono text-xs text-zinc-400">
        <span className="text-zinc-500">Flow · </span>
        <span className="text-zinc-300">AI decision</span>
        <span className="text-zinc-600"> → </span>
        <span className="text-cyan-400/90">Extract factors</span>
        <span className="text-zinc-600"> → </span>
        <span className="text-zinc-300">Generate explanation</span>
        <span className="text-zinc-600"> → </span>
        <span className="text-violet-300/90">Transparency panel</span>
      </div>

      <section className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6 space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-white">Factor inputs</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Mirrors <code className="text-zinc-400">POST /api/explainability/analyze</code> — same signals as notification DNA
            and NeuroScore.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadPreset("deep_focus_delay")}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80"
          >
            Preset: Deep Focus delay
          </button>
          <button
            type="button"
            onClick={() => loadPreset("urgent_show")}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80"
          >
            Preset: urgent — show now
          </button>
          <button
            type="button"
            onClick={() => loadPreset("meeting_batch")}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80"
          >
            Preset: in meeting — batch
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-zinc-500">AI decision</span>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as typeof decision)}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            >
              <option value="delay">delay</option>
              <option value="show_now">show_now</option>
              <option value="summarize_later">summarize_later</option>
            </select>
          </label>
          {decision === "delay" && (
            <label className="block text-sm">
              <span className="text-zinc-500">Delay (minutes)</span>
              <input
                type="number"
                min={1}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-zinc-500">Focus level (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={focusLevel}
              onChange={(e) => setFocusLevel(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Notification urgency (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={urgency}
              onChange={(e) => setUrgency(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Sender importance (0–1)</span>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={senderImportance}
              onChange={(e) => setSenderImportance(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Deadline (hours, optional)</span>
            <input
              type="number"
              min={0}
              value={deadlineHours}
              onChange={(e) => setDeadlineHours(e.target.value === "" ? "" : Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-500">User history (free text)</span>
            <input
              value={userHistory}
              onChange={(e) => setUserHistory(e.target.value)}
              placeholder="e.g. often_batches_slack"
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={deepFocus} onChange={(e) => setDeepFocus(e.target.checked)} className="rounded" />
            Deep Focus
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={inMeeting} onChange={(e) => setInMeeting(e.target.checked)} className="rounded" />
            In a meeting
          </label>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-full bg-violet-500/90 text-white px-5 py-2 text-sm font-semibold hover:bg-violet-400 disabled:opacity-40"
        >
          {loading ? "Generating…" : "Generate explanation"}
        </button>
        {err && <p className="text-sm text-red-300/90">{err}</p>}
      </section>

      {result && (
        <>
          <section className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 surface rounded-2xl border border-violet-500/20 bg-violet-950/10 p-5 sm:p-6 space-y-4">
              <h3 className="font-display text-base font-semibold text-white">Why this action</h3>
              <p className="text-sm text-zinc-200 leading-relaxed">{result.explanation}</p>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">Human-readable line</p>
                <ul className="space-y-2 text-sm text-zinc-300">
                  {result.key_factors.slice(0, 4).map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-teal-500/90 shrink-0">·</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6 flex flex-col justify-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Confidence</p>
              <p className="mt-2 font-display text-4xl font-bold text-white tabular-nums">{pct}%</p>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{result.confidence_reason}</p>
            </div>
          </section>

          <section className="surface rounded-2xl border border-amber-500/15 bg-amber-950/10 p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-amber-200/90">What-if simulation</h3>
            <p className="text-sm text-zinc-500 mt-1 mb-4">
              Alternatives that clarify policy — not predictions of your next click.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.alternatives.map((a, i) => (
                <div key={i} className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                  <p className="text-xs font-medium text-amber-400/90">{a.scenario}</p>
                  <p className="mt-2 text-sm text-zinc-200 font-mono">→ {a.would_decision}</p>
                  <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{a.one_liner}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">Raw response</p>
            <pre className="text-xs font-mono text-zinc-400 overflow-x-auto">
              {JSON.stringify(
                {
                  explanation: result.explanation,
                  key_factors: result.key_factors,
                  confidence: result.confidence,
                  confidence_reason: result.confidence_reason,
                  alternatives: result.alternatives,
                },
                null,
                2
              )}
            </pre>
          </section>
        </>
      )}

      <p className="text-sm text-zinc-500">
        Pair with{" "}
        <Link to="/decision-override" className="text-teal-400/90 hover:text-teal-300">
          Decision Override Engine
        </Link>{" "}
        when explanation is not enough — you keep final say.
      </p>
    </div>
  );
}
