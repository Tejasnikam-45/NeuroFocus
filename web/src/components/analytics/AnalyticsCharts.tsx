import { useMemo } from "react";
import { Pie, Bar } from "react-chartjs-2";
import type { AnalyticsPayload } from "../../lib/api";
import "../../chart/register";

const COLORS = {
  deep: "rgba(45, 212, 191, 0.85)",
  meetings: "rgba(99, 102, 241, 0.85)",
  distraction: "rgba(251, 113, 133, 0.85)",
  shallow: "rgba(251, 191, 36, 0.8)",
  breaks: "rgba(148, 163, 184, 0.75)",
};

const colorByKey: Record<string, string> = {
  deep: COLORS.deep,
  meetings: COLORS.meetings,
  distraction: COLORS.distraction,
  shallow: COLORS.shallow,
  breaks: COLORS.breaks,
};

const chartFont = { family: "'DM Sans', system-ui, sans-serif" };

const commonTooltip = {
  backgroundColor: "rgba(24, 24, 27, 0.95)",
  titleColor: "#fafafa",
  bodyColor: "#d4d4d8",
  borderColor: "rgba(63, 63, 70, 0.9)",
  borderWidth: 1,
  padding: 12,
  cornerRadius: 10,
  titleFont: { ...chartFont, size: 13, weight: "600" as const },
  bodyFont: { ...chartFont, size: 12 },
  displayColors: true,
};

type Props = {
  data: AnalyticsPayload;
  selectedDayIndex: number | null;
  onSelectDay: (index: number | null) => void;
  selectedPieIndex: number | null;
  onSelectPieSlice: (index: number | null) => void;
};

export function TimePieChart({ data, selectedPieIndex, onSelectPieSlice }: Props) {
  const total = useMemo(
    () => data.timeAllocationMinutes.reduce((a, x) => a + x.minutes, 0),
    [data.timeAllocationMinutes]
  );

  const pieData = useMemo(
    () => ({
      labels: data.timeAllocationMinutes.map((x) => x.label),
      datasets: [
        {
          data: data.timeAllocationMinutes.map((x) => x.minutes),
          backgroundColor: data.timeAllocationMinutes.map((x) => colorByKey[x.key] ?? "rgba(113, 113, 122, 0.8)"),
          borderColor: "#18181b",
          borderWidth: 2,
          hoverOffset: 14,
          offset: data.timeAllocationMinutes.map((_, i) => (selectedPieIndex === i ? 10 : 0)),
        },
      ],
    }),
    [data.timeAllocationMinutes, selectedPieIndex]
  );

  return (
    <div className="relative h-[280px] sm:h-[300px] w-full">
      <Pie
        data={pieData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 8 },
          onClick: (_, elements) => {
            if (elements[0]) onSelectPieSlice(elements[0].index);
            else onSelectPieSlice(null);
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#a1a1aa",
                padding: 14,
                usePointStyle: true,
                pointStyle: "circle",
                font: { ...chartFont, size: 11 },
              },
            },
            tooltip: {
              ...commonTooltip,
              callbacks: {
                label(ctx) {
                  const v = ctx.raw as number;
                  const pct = total ? ((v / total) * 100).toFixed(1) : "0";
                  const h = (v / 60).toFixed(1);
                  return ` ${ctx.label}: ${v} min (${pct}% · ~${h}h)`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}

export function FocusBarChart({ data, selectedDayIndex, onSelectDay }: Props) {
  const avg = useMemo(
    () => data.weeklyFocusByDay.reduce((a, x) => a + x.focus, 0) / data.weeklyFocusByDay.length,
    [data.weeklyFocusByDay]
  );

  const barData = useMemo(
    () => ({
      labels: data.weeklyFocusByDay.map((x) => x.day),
      datasets: [
        {
          label: "Focus score",
          data: data.weeklyFocusByDay.map((x) => x.focus),
          backgroundColor: data.weeklyFocusByDay.map((_, i) =>
            selectedDayIndex === i ? "rgba(45, 212, 191, 0.95)" : "rgba(45, 212, 191, 0.45)"
          ),
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: "rgba(45, 212, 191, 0.85)",
        },
      ],
    }),
    [data.weeklyFocusByDay, selectedDayIndex]
  );

  return (
    <div className="relative h-[260px] sm:h-[280px] w-full">
      <Bar
        data={barData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          onClick: (_, elements) => {
            if (elements[0]) onSelectDay(elements[0].index);
            else onSelectDay(null);
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#71717a", font: { ...chartFont, size: 11 } },
              border: { color: "#3f3f46" },
            },
            y: {
              min: 0,
              max: 100,
              grid: { color: "rgba(63, 63, 70, 0.45)" },
              ticks: { color: "#71717a", font: { ...chartFont, size: 11 }, stepSize: 20 },
              border: { display: false },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...commonTooltip,
              callbacks: {
                afterLabel(ctx) {
                  const val = ctx.raw as number;
                  if (val >= avg + 8) return "Above your week average — strong day.";
                  if (val <= avg - 8) return "Below average — check meetings & switches.";
                  return "Near your typical rhythm.";
                },
              },
            },
          },
        }}
      />
    </div>
  );
}

export function DnaHorizontalBar({ data }: Pick<Props, "data">) {
  const barData = useMemo(
    () => ({
      labels: data.dnaDecisionsWeek.map((x) => x.label),
      datasets: [
        {
          label: "Count",
          data: data.dnaDecisionsWeek.map((x) => x.count),
          backgroundColor: [
            "rgba(167, 139, 250, 0.75)",
            "rgba(45, 212, 191, 0.7)",
            "rgba(251, 113, 133, 0.75)",
          ],
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    }),
    [data.dnaDecisionsWeek]
  );

  return (
    <div className="relative h-[200px] w-full">
      <Bar
        data={barData}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: "rgba(63, 63, 70, 0.45)" },
              ticks: { color: "#71717a", font: chartFont },
              border: { display: false },
            },
            y: {
              grid: { display: false },
              ticks: { color: "#d4d4d8", font: { ...chartFont, size: 11 } },
              border: { color: "#3f3f46" },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...commonTooltip,
              callbacks: {
                label(ctx) {
                  const n = ctx.raw as number;
                  const sum = data.dnaDecisionsWeek.reduce((a, x) => a + x.count, 0);
                  const pct = sum ? ((n / sum) * 100).toFixed(0) : "0";
                  return ` ${n} decisions (${pct}% of DNA calls)`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}

export function weekAverageFocus(data: AnalyticsPayload) {
  const arr = data.weeklyFocusByDay;
  return arr.reduce((a, x) => a + x.focus, 0) / arr.length;
}

export function interpretDay(data: AnalyticsPayload, index: number) {
  const row = data.weeklyFocusByDay[index];
  if (!row) return "";
  const avg = weekAverageFocus(data);
  const diff = row.focus - avg;
  if (diff >= 10) return `${row.day}: Well above your weekly average (+${diff.toFixed(0)} pts). Protect this pattern — it’s when you ship.`;
  if (diff <= -10)
    return `${row.day}: Below average (${diff.toFixed(0)} vs mean). Often meeting-heavy or fragmented; try DNA “delay batch” earlier on this weekday.`;
  return `${row.day}: Close to your mean (${row.focus} vs ~${avg.toFixed(0)}). Steady attention — small tweaks to breaks could push it higher.`;
}

export function interpretPieSlice(data: AnalyticsPayload, index: number) {
  const slice = data.timeAllocationMinutes[index];
  if (!slice) return "";
  const total = data.timeAllocationMinutes.reduce((a, x) => a + x.minutes, 0);
  const pct = total ? ((slice.minutes / total) * 100).toFixed(1) : "0";
  const hints: Record<string, string> = {
    deep: "Healthy deep-work share usually lands 35–50% for knowledge work. Above that: elite focus weeks.",
    meetings: "High meeting share often predicts lower NeuroScore mid-week — consider DNA delays during back-to-backs.",
    distraction: "Directly feeds stress & confusion signals. Even small drops here show up as higher weekly focus.",
    shallow: "Necessary overhead. If this dominates, NeuroAgent can automate triage and drafts.",
    breaks: "Recovery time correlates with sustainable streaks — don’t zero this out.",
  };
  return `${slice.label}: ${pct}% of tracked time (${slice.minutes} min). ${hints[slice.key] ?? ""}`;
}
