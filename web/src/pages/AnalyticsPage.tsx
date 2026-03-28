import { useEffect, useState, useMemo } from "react";
import { api, type AnalyticsPayload } from "../lib/api";
import {
  TimePieChart,
  FocusBarChart,
  DnaHorizontalBar,
  interpretDay,
  interpretPieSlice,
  weekAverageFocus,
} from "../components/analytics/AnalyticsCharts";

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [exitSummary, setExitSummary] = useState<{
    summary: string;
    missedHighlights: string[];
    suggestedActions: { label: string; priority: string }[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedPieIndex, setSelectedPieIndex] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.analytics(), api.focusExit()])
      .then(([a, e]) => {
        setData(a);
        setExitSummary(e);
        setErr(null);
      })
      .catch(() => setErr("Start the server for analytics."));
  }, []);

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

  return (
    <div className="flex flex-col gap-8 min-h-0 pb-6">
      <header className="shrink-0">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Analytics</h2>
        <p className="text-zinc-400 mt-2 max-w-2xl text-sm sm:text-base leading-relaxed">
          Interactive charts — click a day or a time slice for a plain-language read. Data is demo-grade until the extension feeds real telemetry.
        </p>
      </header>
      {err && <p className="text-sm text-red-300/90 shrink-0">{err}</p>}

      {data && (
        <>
          <section className="surface rounded-2xl p-5 sm:p-7 border border-zinc-800/80 shrink-0">
            <p className="text-xs uppercase tracking-widest text-teal-400/90 font-medium mb-2">Interpretation</p>
            <p className="text-lg sm:text-xl text-zinc-100 leading-snug font-medium">{data.insightHeadline}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
              {data.insightBullets.map((b) => (
                <li key={b} className="flex gap-2.5">
                  <span className="text-teal-500/80 shrink-0">→</span>
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-500">
              <span>
                Week avg focus: <strong className="text-zinc-300 tabular-nums">{avgFocus.toFixed(0)}</strong>
              </span>
              <span className="text-zinc-700">·</span>
              <span>
                Deep work: <strong className="text-zinc-300 tabular-nums">{data.deepWorkHoursWeek}h</strong> tracked
              </span>
              <span className="text-zinc-700">·</span>
              <span>
                Trend:{" "}
                <strong className={data.trendPercent >= 0 ? "text-teal-400" : "text-rose-400"}>
                  {data.trendPercent >= 0 ? "+" : ""}
                  {data.trendPercent}%
                </strong>{" "}
                vs last week
              </span>
            </div>
          </section>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
            {[
              { label: "Weekly focus", value: data.focusScoreWeek, suffix: "", tone: "text-teal-400" },
              { label: "Distraction", value: data.distractionMinutes, suffix: " min", tone: "text-rose-400" },
              { label: "Streak", value: data.streakDays, suffix: "d", tone: "text-violet-400" },
              { label: "DNA calls", value: data.dnaDecisionsWeek.reduce((a, x) => a + x.count, 0), suffix: "", tone: "text-amber-400/90" },
            ].map((k) => (
              <div key={k.label} className="surface-muted rounded-2xl p-4 border border-zinc-800/60">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{k.label}</p>
                <p className={`font-display text-2xl sm:text-3xl font-semibold mt-1 tabular-nums ${k.tone}`}>
                  {k.value}
                  {k.suffix}
                </p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="surface rounded-2xl p-5 sm:p-6 border border-zinc-800/80">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">Where your week went</h3>
                  <p className="text-xs text-zinc-500 mt-1">Minutes by category — click a slice to drill in</p>
                </div>
              </div>
              {chartProps && <TimePieChart {...chartProps} />}
              <div className="min-h-[4.5rem] mt-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-4 py-3">
                {selectedPieIndex !== null ? (
                  <p className="text-sm text-zinc-300 leading-relaxed">{interpretPieSlice(data, selectedPieIndex)}</p>
                ) : (
                  <p className="text-sm text-zinc-500">Click any pie segment for a short explanation of what it means.</p>
                )}
              </div>
            </div>

            <div className="surface rounded-2xl p-5 sm:p-6 border border-zinc-800/80">
              <div className="mb-1">
                <h3 className="font-display text-lg font-semibold text-white">Daily focus scores</h3>
                <p className="text-xs text-zinc-500 mt-1">0–100 index per day — click a bar to compare to your mean</p>
              </div>
              {chartProps && <FocusBarChart {...chartProps} />}
              <div className="min-h-[4.5rem] mt-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-4 py-3">
                {selectedDayIndex !== null ? (
                  <p className="text-sm text-zinc-300 leading-relaxed">{interpretDay(data, selectedDayIndex)}</p>
                ) : (
                  <p className="text-sm text-zinc-500">Click a bar to see how that day compares to your weekly average.</p>
                )}
              </div>
            </div>
          </div>

          <div className="surface rounded-2xl p-5 sm:p-6 border border-zinc-800/80">
            <h3 className="font-display text-lg font-semibold text-white">Notification DNA — weekly mix</h3>
            <p className="text-xs text-zinc-500 mt-1 mb-4">
              How often the engine delayed, batched, or let something through immediately (hover bars for % of total)
            </p>
            <DnaHorizontalBar data={data} />
          </div>
        </>
      )}

      {exitSummary && (
        <section className="surface rounded-2xl p-6 sm:p-8 border border-zinc-800/80 shrink-0">
          <h3 className="font-display text-lg font-semibold text-teal-400/95 mb-3">After focus</h3>
          <p className="text-zinc-300 leading-relaxed">{exitSummary.summary}</p>
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
                className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                  a.priority === "high"
                    ? "border-rose-900/50 bg-rose-950/30 text-rose-200 hover:bg-rose-950/50"
                    : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
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
