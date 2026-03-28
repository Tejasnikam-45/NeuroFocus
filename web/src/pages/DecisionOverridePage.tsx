import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type OverrideApplyResult, type OverrideRule } from "../lib/api";

const DEMO_LINE =
  "Even after AI decides, the system re-checks — because user intent always has the final say.";

const ACTION_OPTIONS = ["always_notify", "always_delay", "always_prioritize", "respect_ai"] as const;

const CONTEXT_OPTIONS = ["any", "work_hours", "meeting", "focus_mode"] as const;

export function DecisionOverridePage() {
  const [rules, setRules] = useState<OverrideRule[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [aiDecision, setAiDecision] = useState<"delay" | "show_now" | "summarize_later">("delay");
  const [delayMinutes, setDelayMinutes] = useState(20);
  const [sender, setSender] = useState("boss@company.com");
  const [inMeeting, setInMeeting] = useState(false);
  const [deepFocus, setDeepFocus] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [result, setResult] = useState<OverrideApplyResult | null>(null);

  const [newSender, setNewSender] = useState("");
  const [newContext, setNewContext] = useState<(typeof CONTEXT_OPTIONS)[number]>("any");
  const [newAction, setNewAction] = useState<(typeof ACTION_OPTIONS)[number]>("always_notify");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newDelayMin, setNewDelayMin] = useState(30);

  const [learnSender, setLearnSender] = useState("");
  const [learnAction, setLearnAction] = useState<(typeof ACTION_OPTIONS)[number]>("always_notify");
  const [learnMsg, setLearnMsg] = useState<string | null>(null);

  const loadRules = useCallback(() => {
    api
      .overrideRules()
      .then((r) => {
        setRules(r.override_rules);
        setLoadErr(null);
      })
      .catch(() => setLoadErr("API offline — start the server on port 3847."));
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  async function runApply() {
    setApplyLoading(true);
    setResult(null);
    try {
      const res = await api.overrideApply({
        ai_decision: {
          decision: aiDecision,
          ...(aiDecision === "delay" ? { delayMinutes } : {}),
        },
        context: {
          sender,
          in_meeting: inMeeting,
          deep_focus: deepFocus,
          focus_mode: deepFocus,
        },
      });
      setResult(res);
    } catch {
      setResult(null);
    } finally {
      setApplyLoading(false);
    }
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!newSender.trim()) return;
    try {
      await api.overrideAddRule({
        condition: { sender: newSender.trim(), context: newContext },
        action: newAction,
        priority: newPriority,
        delayMinutes: newAction === "always_delay" ? newDelayMin : undefined,
      });
      setNewSender("");
      loadRules();
    } catch {
      /* toast optional */
    }
  }

  async function removeRule(id: string) {
    try {
      await api.overrideDeleteRule(id);
      loadRules();
    } catch {
      /* */
    }
  }

  async function learn(e: React.FormEvent) {
    e.preventDefault();
    if (!learnSender.trim()) return;
    setLearnMsg(null);
    try {
      const r = await api.overrideLearn({
        sender: learnSender.trim(),
        action: learnAction,
        context: "any",
      });
      setLearnMsg(r.message);
      setLearnSender("");
      loadRules();
    } catch {
      setLearnMsg("Could not record — is the API running?");
    }
  }

  function loadPreset(which: "boss_delay" | "focus_ping" | "meeting") {
    if (which === "boss_delay") {
      setAiDecision("delay");
      setDelayMinutes(25);
      setSender("boss@company.com");
      setInMeeting(false);
      setDeepFocus(false);
    } else if (which === "focus_ping") {
      setAiDecision("show_now");
      setSender("news@digest.com");
      setInMeeting(false);
      setDeepFocus(true);
    } else {
      setAiDecision("show_now");
      setSender("peer@company.com");
      setInMeeting(true);
      setDeepFocus(false);
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
          <span className="text-zinc-400">Decision Override</span>
        </p>
        <h2 className="page-title">Decision Override Engine</h2>
        <p className="page-sub">
          Absolute control: manual overrides, rule-based memory, and contextual policies. AI proposes — rules and you dispose.
        </p>
        <p className="mt-4 text-sm italic text-teal-400/85 border-l-2 border-teal-500/40 pl-4">{DEMO_LINE}</p>
      </header>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5 font-mono text-xs text-zinc-400">
        <span className="text-zinc-500">Flow · </span>
        <span className="text-zinc-300">AI Decision</span>
        <span className="text-zinc-600"> → </span>
        <span className="text-teal-400/90">Override Engine</span>
        <span className="text-zinc-600"> → </span>
        <span className="text-zinc-300">Apply rules</span>
        <span className="text-zinc-600"> → </span>
        <span className="text-violet-300/90">Final decision</span>
      </div>

      <section className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6 space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-white">Live simulator</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Set an AI notification decision and context, then run through the engine (same contract as{" "}
            <code className="text-zinc-400">POST /api/overrides/apply</code>).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadPreset("boss_delay")}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80"
          >
            Preset: boss email, AI delays
          </button>
          <button
            type="button"
            onClick={() => loadPreset("focus_ping")}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80"
          >
            Preset: digest in Deep Focus
          </button>
          <button
            type="button"
            onClick={() => loadPreset("meeting")}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80"
          >
            Preset: in meeting
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-zinc-500">AI decision</span>
            <select
              value={aiDecision}
              onChange={(e) => setAiDecision(e.target.value as typeof aiDecision)}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200"
            >
              <option value="delay">delay</option>
              <option value="show_now">show_now</option>
              <option value="summarize_later">summarize_later</option>
            </select>
          </label>
          {aiDecision === "delay" && (
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
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-500">Sender (for rule matching)</span>
            <input
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-200 font-mono text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={inMeeting} onChange={(e) => setInMeeting(e.target.checked)} className="rounded" />
            In a meeting
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={deepFocus} onChange={(e) => setDeepFocus(e.target.checked)} className="rounded" />
            Deep Focus / focus mode
          </label>
        </div>

        <button
          type="button"
          onClick={runApply}
          disabled={applyLoading}
          className="rounded-full bg-teal-500/90 text-zinc-950 px-5 py-2 text-sm font-semibold hover:bg-teal-400 disabled:opacity-40"
        >
          {applyLoading ? "Running…" : "Run override engine"}
        </button>

        {result && (
          <div
            className={`rounded-xl border p-4 ${
              result.overridden ? "border-teal-500/40 bg-teal-950/20" : "border-zinc-800 bg-zinc-950/50"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Response</p>
            <pre className="mt-2 text-xs text-zinc-300 overflow-x-auto font-mono">
              {JSON.stringify(
                {
                  final_decision: result.final_decision,
                  overridden: result.overridden,
                  reason: result.reason,
                  matched_rule_id: result.matched_rule_id,
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-white">Rule-based override memory</h3>
          <p className="text-sm text-zinc-500">
            Add durable rules (e.g. IF sender matches Manager → always notify). Stored in-memory for this demo session.
          </p>
          <form onSubmit={addRule} className="space-y-3">
            <input
              placeholder="sender contains…"
              value={newSender}
              onChange={(e) => setNewSender(e.target.value)}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newContext}
                onChange={(e) => setNewContext(e.target.value as (typeof CONTEXT_OPTIONS)[number])}
                className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
              >
                {CONTEXT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={newAction}
                onChange={(e) => setNewAction(e.target.value as (typeof ACTION_OPTIONS)[number])}
                className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as typeof newPriority)}
                className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
              >
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
              {newAction === "always_delay" && (
                <input
                  type="number"
                  min={5}
                  value={newDelayMin}
                  onChange={(e) => setNewDelayMin(Number(e.target.value))}
                  className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
                  placeholder="delay min"
                />
              )}
            </div>
            <button type="submit" className="rounded-full border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800/80">
              Add rule
            </button>
          </form>
        </div>

        <div className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-white">Learn from manual override</h3>
          <p className="text-sm text-zinc-500">
            When you repeatedly correct the AI, we capture a high-priority rule so the same pattern sticks.
          </p>
          <form onSubmit={learn} className="space-y-3">
            <input
              placeholder="sender email or domain"
              value={learnSender}
              onChange={(e) => setLearnSender(e.target.value)}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
            />
            <select
              value={learnAction}
              onChange={(e) => setLearnAction(e.target.value as (typeof ACTION_OPTIONS)[number])}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
            >
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-full bg-violet-500/80 text-white px-4 py-2 text-sm font-medium hover:bg-violet-500">
              Record override pattern
            </button>
            {learnMsg && <p className="text-sm text-teal-400/90">{learnMsg}</p>}
          </form>
        </div>
      </section>

      <section className="surface rounded-2xl border border-zinc-800/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-white">Active override rules</h3>
          <button type="button" onClick={loadRules} className="text-xs text-zinc-500 hover:text-zinc-300">
            Refresh
          </button>
        </div>
        {loadErr && <p className="p-4 text-sm text-red-300/90">{loadErr}</p>}
        {!loadErr && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="p-4 font-medium">ID</th>
                  <th className="p-4 font-medium">Condition</th>
                  <th className="p-4 font-medium">Action</th>
                  <th className="p-4 font-medium">Priority</th>
                  <th className="p-4 w-24" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/20">
                    <td className="p-4 font-mono text-xs text-zinc-400 max-w-[140px] truncate">{r.id}</td>
                    <td className="p-4 text-zinc-300 font-mono text-xs">
                      {JSON.stringify(r.condition)}
                      {r.learned && (
                        <span className="ml-2 text-[10px] uppercase text-violet-400/90">learned</span>
                      )}
                    </td>
                    <td className="p-4 text-zinc-200">{r.action}</td>
                    <td className="p-4 text-zinc-400">{r.priority}</td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => removeRule(r.id)}
                        className="text-xs text-rose-400/90 hover:text-rose-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
