import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PriorityAnalyzeResult, type PriorityPreferences } from "../lib/api";

const DEMO_LINE =
  "We don't treat all tasks equally — we design intelligence around what truly deserves your attention.";

const CHANNELS = ["email", "chat", "social", "calendar", "other"] as const;

function costColor(c: string) {
  if (c === "low") return "text-emerald-400/90";
  if (c === "medium") return "text-amber-300/90";
  return "text-rose-400/90";
}

function priorityColor(p: string) {
  if (p === "high") return "text-rose-300/90";
  if (p === "medium") return "text-amber-200/90";
  return "text-zinc-400";
}

export function PriorityIntelligencePage() {
  const [prefs, setPrefs] = useState<PriorityPreferences | null>(null);
  const [task, setTask] = useState("Review Q3 deck from Alex");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("email");
  const [urgencySignals, setUrgencySignals] = useState(72);
  const [taskImportance, setTaskImportance] = useState(68);
  const [senderScore, setSenderScore] = useState(85);
  const [userFocus, setUserFocus] = useState(34);
  const [pastBehavior, setPastBehavior] = useState(55);
  const [deadlineHours, setDeadlineHours] = useState<number | "">(3);
  const [deepFocus, setDeepFocus] = useState(true);
  const [inMeeting, setInMeeting] = useState(false);

  const [loading, setLoading] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<PriorityAnalyzeResult | null>(null);

  const loadPrefs = useCallback(() => {
    api
      .priorityPreferences()
      .then((r) => setPrefs(r.preferences))
      .catch(() => setPrefs({ emails_over_chats: true, work_over_social: true, morning_deep_work: true }));
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  async function savePreferences(next: PriorityPreferences) {
    setSavingPrefs(true);
    try {
      const r = await api.prioritySetPreferences(next);
      setPrefs(r.preferences);
    } catch {
      /* ignore */
    } finally {
      setSavingPrefs(false);
    }
  }

  async function runAnalyze() {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await api.priorityAnalyze({
        task,
        channel,
        urgency_signals: urgencySignals,
        task_importance: taskImportance,
        sender_score: senderScore,
        user_focus: userFocus,
        past_behavior: pastBehavior,
        deadline_hours: deadlineHours === "" ? null : Number(deadlineHours),
        deep_focus: deepFocus,
        in_meeting: inMeeting,
      });
      setResult(r);
    } catch {
      setErr("Could not reach priority API — start the server (port 3847).");
    } finally {
      setLoading(false);
    }
  }

  function loadPreset(which: "deep_email" | "social_noise" | "chat_ping") {
    if (which === "deep_email") {
      setTask("Client contract review");
      setChannel("email");
      setUrgencySignals(78);
      setTaskImportance(88);
      setSenderScore(90);
      setUserFocus(30);
      setPastBehavior(70);
      setDeadlineHours(5);
      setDeepFocus(true);
      setInMeeting(false);
    } else if (which === "social_noise") {
      setTask("Trending reel on social");
      setChannel("social");
      setUrgencySignals(22);
      setTaskImportance(15);
      setSenderScore(20);
      setUserFocus(45);
      setPastBehavior(40);
      setDeadlineHours("");
      setDeepFocus(false);
      setInMeeting(false);
    } else {
      setTask("Team standup ping");
      setChannel("chat");
      setUrgencySignals(55);
      setTaskImportance(50);
      setSenderScore(48);
      setUserFocus(40);
      setPastBehavior(60);
      setDeadlineHours(1);
      setDeepFocus(true);
      setInMeeting(false);
    }
    setResult(null);
  }

  return (
    <div className="space-y-10">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
          <Link to="/neuro-command-layer" className="text-teal-400/90 hover:text-teal-300">
            NeuroCommand Layer
          </Link>
          <span className="text-zinc-600"> / </span>
          <span className="text-zinc-400">Priority Intelligence</span>
        </p>
        <h2 className="page-title">Priority Intelligence Designer</h2>
        <p className="page-sub">
          Dynamically assign priority, attention cost, and execution strategy from goals, context, behavior, and task
          importance — then hand off to overrides and explainability.
        </p>
        <p className="mt-4 text-sm italic text-amber-400/85 border-l-2 border-amber-500/40 pl-4">{DEMO_LINE}</p>
      </header>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5 font-mono text-xs text-zinc-400">
        <span className="text-zinc-500">Flow · </span>
        <span className="text-zinc-300">Incoming task</span>
        <span className="text-zinc-600"> → </span>
        <span className="text-amber-400/90">Priority engine</span>
        <span className="text-zinc-600"> → </span>
        <span className="text-zinc-300">Scores</span>
        <span className="text-zinc-600"> → </span>
        <span className="text-teal-300/90">Decision / Override / Explain</span>
      </div>

      <section className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6 space-y-5">
        <h3 className="font-display text-lg font-semibold text-white">User customization</h3>
        <p className="text-sm text-zinc-500">
          Stored server-side for this session (<code className="text-zinc-400">GET/POST /api/priority/preferences</code>).
        </p>
        {prefs && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-4">
            {(
              [
                ["emails_over_chats", "Emails rank above chats"],
                ["work_over_social", "Work ranks above social"],
                ["morning_deep_work", "Morning = deep-work bias"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => {
                    const next = { ...prefs, [key]: e.target.checked };
                    setPrefs(next);
                    savePreferences(next);
                  }}
                  disabled={savingPrefs}
                  className="rounded border-zinc-600"
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6 space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-white">Task & signals</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Inputs mirror <code className="text-zinc-400">POST /api/priority/analyze</code>: sender importance, deadline,
            focus state, past behavior.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadPreset("deep_email")}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80"
          >
            Preset: urgent email + Deep Focus
          </button>
          <button
            type="button"
            onClick={() => loadPreset("social_noise")}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80"
          >
            Preset: social noise
          </button>
          <button
            type="button"
            onClick={() => loadPreset("chat_ping")}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80"
          >
            Preset: chat during focus
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-500">Task</span>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Channel</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
          <label className="block text-sm">
            <span className="text-zinc-500">Urgency signals (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={urgencySignals}
              onChange={(e) => setUrgencySignals(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Task importance (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={taskImportance}
              onChange={(e) => setTaskImportance(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Sender importance (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={senderScore}
              onChange={(e) => setSenderScore(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">User focus (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={userFocus}
              onChange={(e) => setUserFocus(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Past behavior alignment (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={pastBehavior}
              onChange={(e) => setPastBehavior(Number(e.target.value))}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={deepFocus} onChange={(e) => setDeepFocus(e.target.checked)} className="rounded" />
            Deep Focus
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={inMeeting} onChange={(e) => setInMeeting(e.target.checked)} className="rounded" />
            In meeting
          </label>
        </div>

        <button
          type="button"
          onClick={runAnalyze}
          disabled={loading}
          className="rounded-full bg-amber-500/90 text-zinc-950 px-5 py-2 text-sm font-semibold hover:bg-amber-400 disabled:opacity-40"
        >
          {loading ? "Running…" : "Run priority engine"}
        </button>
        {err && <p className="text-sm text-red-300/90">{err}</p>}
      </section>

      {result && (
        <>
          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="surface rounded-2xl border border-zinc-800/80 p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Urgency</p>
              <p className="mt-1 font-display text-2xl font-bold text-white tabular-nums">{result.urgency}</p>
            </div>
            <div className="surface rounded-2xl border border-zinc-800/80 p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Importance</p>
              <p className="mt-1 font-display text-2xl font-bold text-white tabular-nums">{result.importance}</p>
            </div>
            <div className="surface rounded-2xl border border-zinc-800/80 p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Attention cost</p>
              <p className={`mt-1 font-display text-2xl font-bold capitalize ${costColor(result.attention_cost)}`}>
                {result.attention_cost}
              </p>
            </div>
            <div className="surface rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Final priority</p>
              <p className={`mt-1 font-display text-2xl font-bold capitalize ${priorityColor(result.final_priority)}`}>
                {result.final_priority}
              </p>
            </div>
          </section>

          <section className="surface rounded-2xl border border-emerald-500/15 bg-emerald-950/10 p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-emerald-200/90">Attention economy engine</h3>
            <p className="text-sm text-zinc-400">
              If attention cost outweighs value → delay. If high value + urgent → show immediately.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-zinc-500">Value score</p>
                <p className="text-xl font-mono text-white">{result.attention_economy.value_score}</p>
              </div>
              <div>
                <p className="text-zinc-500">Net value (after cost)</p>
                <p className="text-xl font-mono text-white">{result.attention_economy.net_value}</p>
              </div>
              <div className="sm:col-span-1">
                <p className="text-zinc-500">Rule</p>
                <p className="text-zinc-200 leading-snug">{result.attention_economy.rule_fired}</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="text-zinc-500 text-sm">Recommended action</span>
              <span className="rounded-full bg-zinc-100 text-zinc-900 px-3 py-1 text-sm font-semibold font-mono">
                {result.recommended_action}
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">{result.rationale}</p>
          </section>

          <section className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">JSON</p>
            <pre className="text-xs font-mono text-zinc-400 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
          </section>
        </>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
        <Link to="/cognitive-transparency" className="text-violet-400/90 hover:text-violet-300">
          Cognitive Transparency
        </Link>
        <span className="text-zinc-700">·</span>
        <Link to="/decision-override" className="text-teal-400/90 hover:text-teal-300">
          Decision Override
        </Link>
      </div>
    </div>
  );
}
