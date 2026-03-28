import { useEffect, useState } from "react";
import { api, type AgentAction } from "../lib/api";

export function AgentPage() {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .agentQueue()
      .then((r) => {
        setActions(r.actions);
        setErr(null);
      })
      .catch(() => setErr("Start the API server to load the queue."));
  }, []);

  const statusStyle: Record<AgentAction["status"], string> = {
    pending: "bg-zinc-800 text-zinc-400",
    running: "bg-teal-950/60 text-teal-300 border border-teal-900/50",
    done: "bg-zinc-100 text-zinc-900",
    needs_approval: "bg-amber-950/40 text-amber-200 border border-amber-900/40",
  };

  return (
    <div className="space-y-10">
      <header>
        <h2 className="page-title">Agent</h2>
        <p className="page-sub">Autonomous steps — email, calendar, chat — shown as a simple queue.</p>
      </header>
      {err && <p className="text-sm text-red-300/90">{err}</p>}
      <ul className="space-y-3">
        {actions.map((a) => (
          <li key={a.id} className="surface p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">{a.type.replace(/_/g, " ")}</span>
              <p className="text-zinc-100 font-medium mt-1 leading-snug">{a.description}</p>
              {a.result && <p className="text-sm text-teal-400/90 mt-2">{a.result}</p>}
            </div>
            <span className={`text-xs font-medium px-3 py-1.5 rounded-full shrink-0 ${statusStyle[a.status]}`}>
              {a.status.replace(/_/g, " ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
