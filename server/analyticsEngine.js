/**
 * Live analytics derived from contextSignals (NeuroScore inputs) + optional DNA action counts.
 */

import { getNeuroScorePayload, getSignals } from "./contextSignals.js";

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday 00:00 local for the calendar week containing `d`. */
function startOfWeekMondayMs(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Stable midpoint of the selected week (for frozen historical charts). */
function weekAnchorMs(weekOffset) {
  const mon = startOfWeekMondayMs(new Date());
  const monMs = mon - weekOffset * 7 * 86400000;
  return monMs + 3.5 * 86400000;
}

function formatWeekRangeLabel(weekOffset) {
  const mon = new Date(startOfWeekMondayMs(new Date()) - weekOffset * 7 * 86400000);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const o = { month: "short", day: "numeric" };
  const a = mon.toLocaleDateString(undefined, o);
  const b = sun.toLocaleDateString(undefined, o);
  const y = sun.getFullYear();
  return `${a} – ${b}, ${y}`;
}

function startOfDayMs(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Streak counter starts on this calendar day (local). */
const STREAK_ORIGIN_MS = (() => {
  const d = new Date(2026, 2, 28);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
})();

/**
 * Per weekday streak for the selected week.
 * - Older weeks (weekOffset > 0): every day shows 7.
 * - This week: 0 before 28 Mar 2026; from that date through today, 1..7 capped; future days 0 (flagged).
 */
function buildWeeklyStreakByDay(weekOffset) {
  const monMs = startOfWeekMondayMs(new Date()) - weekOffset * 7 * 86400000;
  const todayStart = startOfDayMs(Date.now());

  if (weekOffset > 0) {
    return DAYS.map((day, i) => {
      const dayStart = startOfDayMs(monMs + i * 86400000);
      const dateLabel = new Date(dayStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return { day, streak: 7, dateLabel };
    });
  }

  return DAYS.map((day, i) => {
    const dayStart = startOfDayMs(monMs + i * 86400000);
    const dateLabel = new Date(dayStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });

    if (dayStart < STREAK_ORIGIN_MS) {
      return { day, streak: 0, dateLabel, beforeOrigin: true };
    }
    if (dayStart > todayStart) {
      return { day, streak: 0, dateLabel, future: true };
    }
    const deltaDays = Math.round((dayStart - STREAK_ORIGIN_MS) / 86400000) + 1;
    return { day, streak: clamp(deltaDays, 1, 7), dateLabel };
  });
}

function resolveHeadlineStreakDays(weekOffset, weeklyStreakByDay) {
  if (weekOffset > 0) return 7;
  const todayStart = startOfDayMs(Date.now());
  const monMs = startOfWeekMondayMs(new Date());
  for (let i = 0; i < 7; i++) {
    if (startOfDayMs(monMs + i * 86400000) === todayStart) {
      return weeklyStreakByDay[i].streak;
    }
  }
  const past = weeklyStreakByDay.filter((x) => !x.future);
  if (!past.length) return 0;
  return Math.max(...past.map((x) => x.streak));
}

/**
 * @param {{ delayed?: number; batched?: number; shown?: number }} dnaCounts from notificationActionLog
 * @param {{ gmailCount?: number; weekOffset?: number }} opts weekOffset 0 = this week, 1 = previous, …
 */
export function buildAnalyticsPayload(dnaCounts = {}, opts = {}) {
  const delayed = Number(dnaCounts.delayed) || 0;
  const batched = Number(dnaCounts.batched) || 0;
  const shown = Number(dnaCounts.shown) || 0;
  const gmailCount = Number(opts.gmailCount) || 0;
  const weekOffset = clamp(Math.floor(Number(opts.weekOffset) || 0), 0, 52);

  const neuro = getNeuroScorePayload();
  const sig = getSignals();
  const live = weekOffset === 0;
  const anchorMs = live ? Date.now() : weekAnchorMs(weekOffset);
  const t = anchorMs / 120000;

  const baseFocus = live ? neuro.focus : clamp(50 + Math.sin(t * 0.62) * 28 + (weekOffset % 4) * 3, 32, 96);
  const stress = live ? neuro.stress : clamp(Math.round(26 + Math.sin(t * 1.15) * 24), 12, 82);
  const confusion = live ? neuro.confusion : clamp(Math.round(17 + Math.cos(t * 0.95) * 18), 6, 64);
  const tabChurn = live ? sig.tabSwitchesPerMin : Math.max(0.35, 1.15 + Math.sin(t * 0.72) * 0.95);

  /** Seven daily points: center on live focus, weekday vs weekend shape, slow drift */
  const weeklyFocusByDay = DAYS.map((day, i) => {
    const weekend = i >= 5 ? -12 : 0;
    const midweek = i === 2 ? -8 : 0;
    const wave = Math.sin(t + i * 0.7) * 6;
    const f = clamp(baseFocus + weekend + midweek + wave + Math.cos(t * 1.1 + i) * 4, 28, 98);
    return { day, focus: Math.round(f) };
  });

  const focusScoreWeek = Math.round(
    weeklyFocusByDay.reduce((a, x) => a + x.focus, 0) / weeklyFocusByDay.length
  );

  const distractionMinutes = clamp(Math.round(stress * 1.1 + tabChurn * 2.8 + confusion * 0.35), 18, 220);
  const trendPercent = clamp(Math.round(Math.sin(t * 2.3) * 14 + (baseFocus - 72) * 0.35), -18, 32);

  const weeklyStreakByDay = buildWeeklyStreakByDay(weekOffset);
  const streakDays = resolveHeadlineStreakDays(weekOffset, weeklyStreakByDay);

  const deepMinutes = clamp(
    Math.round(280 + baseFocus * 3.2 - stress * 1.4 + (gmailCount > 0 ? gmailCount * 3 : 0)),
    120,
    720
  );
  const meetMin = clamp(120 + Math.round(Math.sin(t) * 40), 60, 280);
  const shallowMin = clamp(90 + gmailCount * 4 + shown * 2, 45, 400);
  const breakMin = clamp(95 + confusion * 0.6, 40, 200);

  const timeAllocationMinutes = [
    { key: "deep", label: "Deep work", minutes: deepMinutes },
    { key: "meetings", label: "Meetings & calls", minutes: meetMin },
    { key: "distraction", label: "Distraction / context loss", minutes: distractionMinutes },
    { key: "shallow", label: "Shallow tasks & email", minutes: shallowMin },
    { key: "breaks", label: "Breaks & recovery", minutes: breakMin },
  ];

  const totalMin = timeAllocationMinutes.reduce((a, x) => a + x.minutes, 0);
  const deepPct = Math.round((timeAllocationMinutes[0].minutes / totalMin) * 100);

  const baseDelay = 48 + delayed * 3;
  const baseBatch = 36 + batched * 3;
  const baseShow = 22 + shown * 2;
  const dnaDecisionsWeek = [
    { label: "Delayed wisely", count: clamp(Math.round(baseDelay + Math.sin(t) * 8), 12, 900) },
    { label: "Batched / summarized", count: clamp(Math.round(baseBatch + Math.cos(t * 0.9) * 6), 8, 600) },
    { label: "Shown immediately", count: clamp(Math.round(baseShow + Math.sin(t * 1.2) * 5), 4, 400) },
  ];

  const deepWorkHoursWeek = Math.round((deepMinutes / 60) * 10) / 10;

  const insightHeadline = `Deep work is about ${deepPct}% of your tracked window — ${baseFocus >= 68 ? "strong" : "building"} focus${
    live ? " with live NeuroScore inputs" : " for this calendar week"
  }.`;

  const insightBullets = [
    `${live ? "Live" : "Recorded"} focus ${baseFocus} · stress ${stress} · tab churn ${tabChurn.toFixed(1)}/min shapes distraction (${distractionMinutes} min).`,
    weeklyFocusByDay[4].focus >= weeklyFocusByDay[2].focus
      ? "Friday trending above mid-week — good window for maker time."
      : "Mid-week shows more load — DNA delays are compensating.",
    weekOffset > 0
      ? "Historical weeks show a full 7-day streak strip per day; live week uses streak from 28 Mar 2026 forward (capped at 7)."
      : "Daily streak in the strip starts 28 Mar 2026; days before show 0, future days are dimmed until they arrive.",
    dnaCounts.delayed + dnaCounts.batched + dnaCounts.shown > 0
      ? `Session DNA actions: ${delayed} delays, ${batched} digests, ${shown} force-shows — charts reflect your overrides.`
      : "Interact with Notification DNA (delay / digest / show) to grow real decision counts here.",
  ];

  return {
    focusScoreWeek,
    distractionMinutes,
    trendPercent,
    streakDays,
    weeklyStreakByDay,
    deepWorkHoursWeek,
    weeklyFocusByDay,
    timeAllocationMinutes,
    dnaDecisionsWeek,
    insightHeadline,
    insightBullets,
    serverTime: Date.now(),
    live,
    weekOffset,
    weekRangeLabel: formatWeekRangeLabel(weekOffset),
  };
}
