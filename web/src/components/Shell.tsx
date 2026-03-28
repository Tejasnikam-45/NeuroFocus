import { Link, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { api } from "../lib/api";

const nav = [
  { to: "/", label: "Command" },
  { to: "/agent", label: "Agent" },
  { to: "/notifications", label: "Notifications" },
  { to: "/flows", label: "Flows" },
  { to: "/analytics", label: "Analytics" },
];

export function Shell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const [cmd, setCmd] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; summary: string; detail?: string } | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!cmd.trim()) return;
    setLoading(true);
    setFeedback(null);
    setShowDetail(false);
    try {
      const res = await api.command(cmd.trim());
      setFeedback({
        ok: true,
        summary: res.interpreted,
        detail: res.actions.join(" · "),
      });
    } catch {
      setFeedback({
        ok: false,
        summary: "Couldn’t reach the server",
        detail: "Run the API in /server on port 3847, then try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  function dismissFeedback() {
    setFeedback(null);
    setShowDetail(false);
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#09090b]">
      <header className="shrink-0 z-50 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3 sm:py-4">
            <Link to="/" className="flex items-center gap-3 shrink-0 group">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-400/20 to-cyan-500/10 border border-zinc-700/80 flex items-center justify-center group-hover:border-teal-400/30 transition-colors">
                <span className="font-display font-semibold text-teal-300 text-sm">N</span>
              </div>
              <div>
                <h1 className="font-display font-semibold text-lg text-white leading-tight">NeuroFocus</h1>
                <p className="text-[11px] text-zinc-500">Attention OS · brain-aware layer</p>
              </div>
            </Link>

            <form onSubmit={runCommand} className="hidden sm:flex flex-1 max-w-xl ml-6 gap-2 items-center">
              <input
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                placeholder='Try: "Focus mode on" · "Summarize notifications"'
                className="flex-1 rounded-full bg-zinc-900 border border-zinc-800 px-4 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-zinc-700"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 rounded-full bg-zinc-100 text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-40 transition-colors"
              >
                {loading ? "…" : "Voice / Cmd"}
              </button>
            </form>
          </div>

          <form onSubmit={runCommand} className="sm:hidden flex gap-2 pb-3">
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              placeholder="Command…"
              className="flex-1 rounded-full bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-zinc-100 text-zinc-900 px-4 py-2.5 text-sm font-medium disabled:opacity-40"
            >
              {loading ? "…" : "Run"}
            </button>
          </form>

          {feedback && (
            <div
              className={`mb-3 rounded-2xl px-4 py-3 flex flex-col gap-2 border ${
                feedback.ok
                  ? "bg-zinc-900/80 border-zinc-800 text-zinc-300"
                  : "bg-red-950/30 border-red-900/40 text-red-200/90"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-snug">{feedback.summary}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {feedback.detail && (
                    <button
                      type="button"
                      onClick={() => setShowDetail((v) => !v)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline"
                    >
                      {showDetail ? "Hide" : "Details"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={dismissFeedback}
                    className="text-zinc-500 hover:text-zinc-300 text-lg leading-none px-1"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </div>
              {showDetail && feedback.detail && (
                <p className="text-xs font-mono text-zinc-500 border-t border-zinc-800/80 pt-2">{feedback.detail}</p>
              )}
            </div>
          )}

          <nav className="flex gap-1 pb-2 overflow-x-auto -mx-1 px-1">
            {nav.map((item) => {
              const active = loc.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap px-3 py-2 rounded-full text-sm transition-colors ${
                    active
                      ? "bg-violet-500/20 text-violet-200 border border-violet-500/30 font-medium"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-h-full">{children}</div>
      </main>

      <footer className="shrink-0 border-t border-zinc-800/60 py-3 text-center text-zinc-600 text-[11px] px-4">
        NeuroFocus is not another productivity tool — it is an AI layer that understands context and shapes your digital world.
      </footer>
    </div>
  );
}
