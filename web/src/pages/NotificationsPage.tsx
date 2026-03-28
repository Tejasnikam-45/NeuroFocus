import { useEffect, useState } from "react";
import { api, type NotificationDNA } from "../lib/api";

function DecisionBadge({ d }: { d: NotificationDNA["decision"] }) {
  const map = {
    show_now: "bg-rose-950/50 text-rose-200 border-rose-900/40",
    delay: "bg-amber-950/40 text-amber-200 border-amber-900/40",
    summarize_later: "bg-violet-950/40 text-violet-200 border-violet-900/40",
  };
  const labels = { show_now: "Now", delay: "Delay", summarize_later: "Batch" };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${map[d]}`}>{labels[d]}</span>
  );
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationDNA[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .notifications()
      .then((r) => {
        setItems(r.items);
        setErr(null);
      })
      .catch(() => setErr("Turn on the API to load notification DNA."));
  }, []);

  return (
    <div className="space-y-10">
      <header>
        <h2 className="page-title">Notifications</h2>
        <p className="page-sub">Each item is scored for urgency and cost — then scheduled, not spammed.</p>
      </header>
      {err && <p className="text-sm text-red-300/90">{err}</p>}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="p-4 font-medium">From</th>
                <th className="p-4 w-16">U</th>
                <th className="p-4 w-16">R</th>
                <th className="p-4 w-16">I</th>
                <th className="p-4 w-16">S</th>
                <th className="p-4">Plan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id} className="border-b border-zinc-800/80 hover:bg-zinc-800/20 transition-colors">
                  <td className="p-4">
                    <p className="text-zinc-100">{n.title}</p>
                    {n.summary && <p className="text-xs text-zinc-500 mt-1 max-w-md">{n.summary}</p>}
                  </td>
                  <td className="p-4 tabular-nums text-rose-300/90">{n.urgency}</td>
                  <td className="p-4 tabular-nums text-teal-300/90">{n.relevance}</td>
                  <td className="p-4 tabular-nums text-amber-200/80">{n.interruptionCost}</td>
                  <td className="p-4 tabular-nums text-violet-300/90">{n.senderImportance}</td>
                  <td className="p-4">
                    <DecisionBadge d={n.decision} />
                    {n.delayMinutes != null && (
                      <span className="text-xs text-zinc-500 ml-2">+{n.delayMinutes}m</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
