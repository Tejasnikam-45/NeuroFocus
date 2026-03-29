import { Link, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";

const nav = [
  { to: "/landing", label: "Home" },
  { to: "/", label: "Command" },
  { to: "/agent", label: "Agent" },
  { to: "/notifications", label: "Notifications" },
  { to: "/flows", label: "Flows" },
  { to: "/neuro-command-layer", label: "NeuroCommand Layer" },
  { to: "/analytics", label: "Analytics" },
];

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const [cmd, setCmd] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; summary: string; detail?: string } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("nf-theme") !== "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("nf-theme", isDark ? "dark" : "light");
  }, [isDark]);

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
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-zinc-100 dark:bg-[#09090b]">
      <header className="shrink-0 z-50 border-b border-zinc-200/90 dark:border-zinc-800/80 bg-white/95 dark:bg-[#09090b]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
            <Link to="/landing" className="flex items-center gap-3 shrink-0 group">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-400/20 to-cyan-500/10 border border-zinc-300/90 dark:border-zinc-700/80 flex items-center justify-center group-hover:border-teal-400/40 transition-colors">
                <span className="font-display font-semibold text-teal-600 dark:text-teal-300 text-sm">N</span>
              </div>
              <div>
                <h1 className="font-display font-semibold text-lg text-zinc-900 dark:text-white leading-tight">NeuroFocus</h1>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-500">Attention OS · brain-aware layer</p>
              </div>
            </Link>

            <form onSubmit={runCommand} className="hidden sm:flex flex-1 max-w-xl ml-4 md:ml-6 gap-2 items-center">
              <input
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                placeholder='Try: "Focus mode on" · "Summarize notifications" — Enter to run'
                aria-label="Voice or text command, press Enter to run"
                className="flex-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-zinc-400 dark:focus:border-zinc-700 disabled:opacity-50"
                disabled={loading}
              />
            </form>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsDark((d) => !d)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-amber-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-amber-300 dark:hover:bg-zinc-700"
                aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
                title={isDark ? "Light theme" : "Dark theme"}
              >
                {isDark ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
          </div>

          <form onSubmit={runCommand} className="sm:hidden flex gap-2 pb-3 items-center">
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              placeholder="Command… (Enter)"
              aria-label="Command, press Enter to run"
              className="flex-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:opacity-50"
              disabled={loading}
            />
          </form>

          {feedback && (
            <div
              className={`mb-3 rounded-2xl px-4 py-3 flex flex-col gap-2 border ${
                feedback.ok
                  ? "bg-zinc-100/90 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300"
                  : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-900 dark:text-red-200/90"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-snug">{feedback.summary}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {feedback.detail && (
                    <button
                      type="button"
                      onClick={() => setShowDetail((v) => !v)}
                      className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline-offset-2 hover:underline"
                    >
                      {showDetail ? "Hide" : "Details"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={dismissFeedback}
                    className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 text-lg leading-none px-1"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </div>
              {showDetail && feedback.detail && (
                <p className="text-xs font-mono text-zinc-600 dark:text-zinc-500 border-t border-zinc-200 dark:border-zinc-800/80 pt-2">
                  {feedback.detail}
                </p>
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
                      ? "bg-violet-500/15 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 border border-violet-400/40 dark:border-violet-500/30 font-medium"
                      : "text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full text-zinc-900 dark:text-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-h-full">{children}</div>
      </main>

      <footer className="shrink-0 border-t border-zinc-200/90 dark:border-zinc-800/60 py-3 text-center text-zinc-500 text-[11px] px-4">
        NeuroFocus is not another productivity tool — it is an AI layer that understands context and shapes your digital world.
      </footer>
    </div>
  );
}
