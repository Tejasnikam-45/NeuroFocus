import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AnalyticsPayload } from "../lib/api";
import {
  TimePieChart,
  FocusBarChart,
  DnaHorizontalBar,
  interpretDay,
  interpretPieSlice,
  weekAverageFocus,
} from "../components/analytics/AnalyticsCharts";

const MAX_WEEK_OFFSET = 52;

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [exitSummary, setExitSummary] = useState<{
    summary: string;
    missedHighlights: string[];
    suggestedActions: { label: string; priority: string }[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedPieIndex, setSelectedPieIndex] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .focusExit()
      .then((e) => {
        if (!cancelled) setExitSummary(e);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedDayIndex(null);
    setSelectedPieIndex(null);
  }, [weekOffset]);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;

    api
      .analytics(weekOffset)
      .then((a) => {
        if (cancelled) return;
        setData(a);
        setErr(null);
        if (a.serverTime != null) setLastSync(a.serverTime);
      })
      .catch(() => {
        if (!cancelled) setErr("Start the server for analytics.");
      });

    if (weekOffset === 0) {
      es = new EventSource("/api/analytics/stream");
      es.onmessage = (ev) => {
        try {
          const next = JSON.parse(ev.data) as AnalyticsPayload;
          setData(next);
          setLastSync(next.serverTime ?? Date.now());
          setErr(null);
        } catch {
          /* ignore */
        }
      };
    }

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [weekOffset]);

  const avgFocus = useMemo(() => (data ? weekAverageFocus(data) : 0), [data]);

  const chartProps = data
    ? {
        data,
        selectedDayIndex,
        onSelectDay: setSelectedDayIndex,
        selectedPieIndex,
        onSelectPieSlice: setSelectedPieIndex,
      }
    : null;

  const handleAfterFocusAction = useCallback(
    (label: string, priority: string) => {
      setActionFeedback(label);
      window.setTimeout(() => setActionFeedback(null), 4500);
      const lower = label.toLowerCase();
      if (lower.includes("email") || lower.includes("reply")) {
        navigate("/notifications");
        return;
      }
      if (lower.includes("meeting") || lower.includes("slot")) {
        navigate("/flows");
        return;
      }
      if (lower.includes("archive") || lower.includes("newsletter")) {
        navigate("/notifications");
        return;
      }
      if (priority === "high") {
        navigate("/agent");
      }
    },
    [navigate]
  );

  return (
    <div className="flex min-h-0 flex-col gap-8 pb-6">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            Analytics
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
            Interactive charts — pick a week to compare history. This week updates every ~4s via{" "}
            <strong className="text-zinc-800 dark:text-zinc-300">Server-Sent Events</strong> (
            <code className="text-zinc-600 dark:text-zinc-500">GET /api/analytics/stream</code>
            ).
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {lastSync != null && weekOffset === 0 && (
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs text-cyan-900 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-200/90">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              Live · {new Date(lastSync).toLocaleTimeString()}
            </span>
          )}
          {weekOffset > 0 && (
            <span className="inline-flex rounded-full border border-zinc-600/80 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-400">
              Historical week (frozen snapshot)
            </span>
          )}
        </div>
      </header>

      {data && (
        <div className="surface-muted flex shrink-0 flex-col gap-3 rounded-2xl border border-zinc-800/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Weekly focus</p>
            <p className="font-display mt-0.5 text-lg font-semibold text-white">{data.weekRangeLabel ?? "This week"}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {weekOffset === 0 ? "Live NeuroScore drives today’s curve." : "Values anchored to that calendar week."}
            </p>
            {data.weeklyStreakByDay && data.weeklyStreakByDay.length === 7 && (
              <div className="mt-4 w-full border-t border-zinc-800/60 pt-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Streak by weekday
                  <span className="ml-2 font-normal normal-case text-zinc-600">
                    {weekOffset === 0
                      ? "· counts from 28 Mar 2026 (max 7 / day)"
                      : "· 7 for each day in historical weeks"}
                  </span>
                </p>
                <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
                  {data.weeklyStreakByDay.map((cell) => {
                    const dim = Boolean(cell.beforeOrigin || cell.future);
                    const hot = !dim && cell.streak > 0;
                    return (
                      <div
                        key={cell.day}
                        className={`rounded-xl border px-0.5 py-2 text-center sm:px-1 ${
                          dim
                            ? "border-zinc-800/50 bg-zinc-950/40"
                            : hot
                              ? "border-violet-500/35 bg-violet-500/10"
                              : "border-zinc-800/70 bg-zinc-900/40"
                        }`}
                      >
                        <div className="text-[9px] font-medium text-zinc-500">{cell.day}</div>
                        <div className="truncate text-[8px] text-zinc-600 sm:text-[9px]">{cell.dateLabel}</div>
                        <div
                          className={`font-display mt-1 text-base font-semibold tabular-nums sm:text-lg ${
                            dim ? "text-zinc-600" : "text-violet-300"
                          }`}
                        >
                          {cell.streak}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={weekOffset >= MAX_WEEK_OFFSET}
              onClick={() => setWeekOffset((w) => Math.min(MAX_WEEK_OFFSET, w + 1))}
              className="rounded-full border border-zinc-600/90 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-teal-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Older week
            </button>
            <button
              type="button"
              disabled={weekOffset <= 0}
              onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
              className="rounded-full border border-zinc-600/90 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-teal-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Newer week →
            </button>
            {weekOffset > 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="rounded-full bg-gradient-to-r from-teal-500/90 to-cyan-600/90 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm shadow-teal-500/20"
              >
                This week
              </button>
            )}
          </div>
        </div>
      )}

      {err && <p className="shrink-0 text-sm text-red-300/90">{err}</p>}

      {actionFeedback && (
        <div
          className="shrink-0 rounded-xl border border-teal-500/30 bg-teal-950/40 px-4 py-3 text-sm text-teal-100/95"
          role="status"
        >
          <span className="font-medium text-teal-300">Queued:</span> {actionFeedback} — follow up in the app section we opened.
        </div>
      )}

      {data && (
        <>
          <section className="surface shrink-0 rounded-2xl border border-zinc-800/80 p-5 sm:p-7">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-teal-400/90">Interpretation</p>
            <p className="text-lg font-medium leading-snug text-zinc-100 sm:text-xl">{data.insightHeadline}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
              {data.insightBullets.map((b) => (
                <li key={b} className="flex gap-2.5">
                  <span className="shrink-0 text-teal-500/80">→</span>
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-500">
              <span>
                Week avg focus: <strong className="tabular-nums text-zinc-300">{avgFocus.toFixed(0)}</strong>
              </span>
              <span className="text-zinc-500">·</span>
              <span>
                Deep work: <strong className="tabular-nums text-zinc-300">{data.deepWorkHoursWeek}h</strong> tracked
              </span>
              <span className="text-zinc-500">·</span>
              <span>
                Trend:{" "}
                <strong className={data.trendPercent >= 0 ? "text-teal-400" : "text-rose-400"}>
                  {data.trendPercent >= 0 ? "+" : ""}
                  {data.trendPercent}%
                </strong>{" "}
                vs prior window
              </span>
            </div>
          </section>

          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {[
              { label: "Weekly focus", value: data.focusScoreWeek, suffix: "", tone: "text-teal-400" },
              { label: "Distraction", value: data.distractionMinutes, suffix: " min", tone: "text-rose-400" },
              {
                label: "Streak",
                value: data.streakDays,
                suffix: "d",
                tone: "text-violet-400",
                hint: weekOffset > 0 ? "week" : "today",
              },
              {
                label: "DNA calls",
                value: data.dnaDecisionsWeek.reduce((a, x) => a + x.count, 0),
                suffix: "",
                tone: "text-amber-400/90",
              },
            ].map((k) => (
              <div key={k.label} className="surface-muted rounded-2xl border border-zinc-800/60 p-4">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">{k.label}</p>
                <p className={`font-display mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${k.tone}`}>
                  {k.value}
                  {k.suffix}
                </p>
                {k.label === "Streak" && "hint" in k && (
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
                    {k.hint === "week" ? "Full strip · 7 / day" : "Today in this week"}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6">
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">Where your week went</h3>
                  <p className="mt-1 text-xs text-zinc-500">Minutes by category — click a slice to drill in</p>
                </div>
              </div>
              {chartProps && <TimePieChart {...chartProps} />}
              <div className="mt-3 min-h-[4.5rem] rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-3">
                {selectedPieIndex !== null ? (
                  <p className="text-sm leading-relaxed text-zinc-300">{interpretPieSlice(data, selectedPieIndex)}</p>
                ) : (
                  <p className="text-sm text-zinc-500">Click any pie segment for a short explanation of what it means.</p>
                )}
              </div>
            </div>

            <div className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6">
              <div className="mb-1">
                <h3 className="font-display text-lg font-semibold text-white">Daily focus scores</h3>
                <p className="mt-1 text-xs text-zinc-500">0–100 index per day — click a bar to compare to your mean</p>
              </div>
              {chartProps && <FocusBarChart {...chartProps} />}
              <div className="mt-3 min-h-[4.5rem] rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-3">
                {selectedDayIndex !== null ? (
                  <p className="text-sm leading-relaxed text-zinc-300">{interpretDay(data, selectedDayIndex)}</p>
                ) : (
                  <p className="text-sm text-zinc-500">Click a bar to see how that day compares to your weekly average.</p>
                )}
              </div>
            </div>
          </div>

          <div className="surface rounded-2xl border border-zinc-800/80 p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-white">Notification DNA — weekly mix</h3>
            <p className="mb-4 mt-1 text-xs text-zinc-500">
              How often the engine delayed, batched, or let something through immediately (hover bars for % of total)
            </p>
            <DnaHorizontalBar data={data} />
          </div>
        </>
      )}

      {exitSummary && (
        <section className="surface shrink-0 rounded-2xl border border-zinc-800/80 p-6 sm:p-8">
          <h3 className="font-display mb-3 text-lg font-semibold text-teal-400/95">After focus</h3>
          <p className="leading-relaxed text-zinc-300">{exitSummary.summary}</p>
          <ul className="mt-5 space-y-2 text-sm text-zinc-400">
            {exitSummary.missedHighlights.map((h) => (
              <li key={h} className="flex gap-2">
                <span className="text-zinc-600">·</span>
                {h}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            {exitSummary.suggestedActions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => handleAfterFocusAction(a.label, a.priority)}
                className={`rounded-full px-4 py-2 text-sm transition-all active:scale-[0.98] ${
                  a.priority === "high"
                    ? "border border-teal-500/40 bg-gradient-to-r from-teal-500/25 to-violet-600/25 font-medium text-white shadow-[0_0_24px_-8px_rgba(45,212,191,0.45)] hover:from-teal-500/35 hover:to-violet-600/35"
                    : "border border-zinc-600/90 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
