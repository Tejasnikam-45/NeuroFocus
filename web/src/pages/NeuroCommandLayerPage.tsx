import { Link } from "react-router-dom";

const tree = [
  { id: "override", label: "Decision Override Engine", branch: "├──" },
  { id: "xai", label: "Cognitive Transparency (Explainable AI)", branch: "├──" },
  { id: "priority", label: "Priority Intelligence Designer", branch: "├──" },
  { id: "roadmap", label: "More features — roadmap", branch: "└──", muted: true },
] as const;

const capabilityRoutes: Record<Exclude<(typeof tree)[number]["id"], "roadmap">, string> = {
  override: "/decision-override",
  xai: "/cognitive-transparency",
  priority: "/priority-intelligence",
};

const featureCopy: Record<
  Exclude<(typeof tree)[number]["id"], "roadmap">,
  { title: string; body: string; accent: string }
> = {
  override: {
    title: "Decision Override Engine",
    body:
      "When the model’s default conflicts with your intent or policy, you can supersede it: approve, reject, or inject rules so Agent and notification DNA respect human authority on sensitive paths.",
    accent: "text-teal-300/90",
  },
  xai: {
    title: "Cognitive Transparency (Explainable AI)",
    body:
      "Every surfaced plan shows why — signals used, tradeoffs (urgency vs interruption cost), and which subsystem ran. Reduces black-box anxiety and builds trust in high-stakes moments.",
    accent: "text-violet-300/90",
  },
  priority: {
    title: "Priority Intelligence Designer",
    body:
      "Shape how urgency, sender importance, and context combine — not just mute lists. Tune thresholds and batching so the layer matches your role, timezone, and deep-work blocks.",
    accent: "text-amber-300/90",
  },
};

export function NeuroCommandLayerPage() {
  return (
    <div className="space-y-10">
      <header>
        <h2 className="page-title">NeuroCommand Layer</h2>
        <p className="page-sub">
          The unified voice-and-text surface that interprets intent, fans out to the agent queue, flows, and notification DNA —
          without leaving flow state. Below is the capability tree — each branch is designed to extend further.
        </p>
        <blockquote className="mt-8 rounded-2xl border border-teal-500/20 bg-teal-950/15 px-5 py-4 text-base text-zinc-200 leading-relaxed">
          The NeuroCommand Layer ensures that AI decisions are not final — they are evaluated, explained, and aligned with user
          intent before execution.
        </blockquote>
      </header>

      <div className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6 overflow-x-auto">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-4">Full pipeline</p>
        <pre className="font-mono text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre min-w-[min(100%,640px)]">
          <span className="text-zinc-500">Incoming event / AI decision</span>
          {"\n"}
          <span className="text-zinc-400 dark:text-zinc-600">  →</span> <span className="text-amber-400/90">Priority Intelligence</span>{" "}
          <span className="text-zinc-400 dark:text-zinc-600">(scores, attention cost)</span>
          {"\n"}
          <span className="text-zinc-400 dark:text-zinc-600">  →</span> <span className="text-teal-400/90">Override Engine</span>{" "}
          <span className="text-zinc-400 dark:text-zinc-600">(user rules)</span>
          {"\n"}
          <span className="text-zinc-400 dark:text-zinc-600">  →</span> <span className="text-violet-400/90">Transparency Engine</span>{" "}
          <span className="text-zinc-400 dark:text-zinc-600">(why / what-if)</span>
          {"\n"}
          <span className="text-zinc-400 dark:text-zinc-600">  →</span> <span className="text-cyan-400/90">Control layer</span>{" "}
          <span className="text-zinc-400 dark:text-zinc-600">(confidence, safety)</span>
          {"\n"}
          <span className="text-zinc-400 dark:text-zinc-600">  →</span> <span className="text-zinc-200">Final output:</span>
          {"\n"}
          <span className="text-zinc-400 dark:text-zinc-600">       ├──</span> Execute
          {"\n"}
          <span className="text-zinc-400 dark:text-zinc-600">       ├──</span> Delay
          {"\n"}
          <span className="text-zinc-400 dark:text-zinc-600">       ├──</span> Suggest
          {"\n"}
          <span className="text-zinc-400 dark:text-zinc-600">       └──</span> Block
        </pre>
      </div>

      <div className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6 overflow-x-auto">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-4">Architecture</p>
        <pre className="font-mono text-sm text-zinc-200 leading-relaxed whitespace-pre min-w-[min(100%,560px)]">
          <span className="text-teal-400/90">NeuroCommand Layer</span>
          {"\n"}
          {tree.map((row) => (
            <span key={row.id}>
              <span className="text-zinc-400 dark:text-zinc-600">{row.branch}</span>{" "}
              <span className={"muted" in row && row.muted ? "text-zinc-500 italic" : undefined}>{row.label}</span>
              {"\n"}
            </span>
          ))}
        </pre>
      </div>

      <div className="space-y-6">
        <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">Capabilities</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {tree
            .filter((row) => row.id !== "roadmap")
            .map((row) => {
              const f = featureCopy[row.id];
              return (
                <Link
                  key={row.id}
                  to={capabilityRoutes[row.id]}
                  id={row.id}
                  className="surface rounded-2xl p-5 sm:p-6 border border-zinc-800/80 flex flex-col transition hover:border-teal-500/25 hover:bg-zinc-900/60 group"
                >
                  <h4 className={`font-display text-base font-semibold ${f.accent}`}>{f.title}</h4>
                  <p className="mt-3 text-sm text-zinc-400 leading-relaxed flex-1">{f.body}</p>
                  <p className="mt-4 text-xs font-medium text-teal-400/70 group-hover:text-teal-300">Open →</p>
                </Link>
              );
            })}
        </div>

        <div className="rounded-2xl border border-dashed border-zinc-600/80 bg-zinc-900 p-5 sm:p-6 text-zinc-100 dark:border-zinc-700/80 dark:bg-zinc-950/40">
          <h4 className="font-display text-base font-semibold text-zinc-300 dark:text-zinc-400">More features — roadmap</h4>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500 leading-relaxed">
            Additional branches will plug into the same layer: federated policies, team norms, audit trails, and deeper
            calendar / comms integrations — without fragmenting the command surface.
          </p>
        </div>
      </div>

      <div className="surface rounded-2xl p-5 sm:p-6 border border-zinc-800/80">
        <p className="text-sm text-zinc-300 leading-relaxed">
          Use the <span className="text-zinc-200 dark:text-zinc-100 font-medium">header command field</span> (press Enter) anytime. Successful
          parses show a short summary with optional pipeline details — the same path the extension and dashboard share.
        </p>
      </div>
    </div>
  );
}
