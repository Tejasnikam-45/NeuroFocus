/**
 * Live context for NeuroScore / Intent / Attention timeline.
 * Updated by POST /api/context/ingest (Chrome extension or manual).
 * When nothing ingested recently, defaults + gentle time drift keep the UI alive.
 */

let ingested = null;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function parseKeywords(fromTitle) {
  const s = String(fromTitle || "");
  const words = s.split(/[^a-z0-9]+/i).filter((w) => w.length > 2);
  const uniq = [...new Set(words.map((w) => w.toLowerCase()))];
  return uniq.slice(0, 10);
}

/**
 * @param {Record<string, unknown>} body
 */
export function ingestContext(body) {
  const b = body && typeof body === "object" ? body : {};
  const prev = ingested || {};
  const title = b.activeTitle != null ? String(b.activeTitle) : prev.activeTitle || "";
  const kw =
    Array.isArray(b.titleKeywords) && b.titleKeywords.length
      ? b.titleKeywords.map(String).slice(0, 12)
      : b.activeTitle
        ? parseKeywords(b.activeTitle)
        : prev.titleKeywords?.length
          ? prev.titleKeywords
          : parseKeywords(title);

  ingested = {
    tabSwitchesPerMin:
      b.tabSwitchesPerMin != null ? clamp(Number(b.tabSwitchesPerMin), 0, 40) : prev.tabSwitchesPerMin ?? 4,
    dwellSeconds: b.dwellSeconds != null ? clamp(Number(b.dwellSeconds), 5, 600) : prev.dwellSeconds ?? 45,
    backtrackRatio:
      b.backtrackRatio != null ? clamp(Number(b.backtrackRatio), 0, 0.95) : prev.backtrackRatio ?? 0.15,
    activeDomain: b.activeDomain != null ? String(b.activeDomain) : prev.activeDomain || "github.com",
    titleKeywords: kw,
    activeTitle: title || prev.activeTitle || "Focused work",
    updatedAt: Date.now(),
  };
  return ingested;
}

/** Blend ingested snapshot with subtle drift so charts move in real time. */
export function getSignals() {
  const tick = Date.now() / 5000;
  const base = ingested;
  const defaults = {
    tabSwitchesPerMin: 4,
    dwellSeconds: 48,
    backtrackRatio: 0.14,
    activeDomain: "github.com",
    titleKeywords: ["pull request", "typescript", "review"],
    activeTitle: "Code review on PR #184",
  };
  const b = base || defaults;
  return {
    tabSwitchesPerMin: clamp(b.tabSwitchesPerMin + Math.sin(tick) * 1.8, 0.5, 38),
    dwellSeconds: clamp(b.dwellSeconds + Math.cos(tick) * 14, 8, 200),
    backtrackRatio: clamp(b.backtrackRatio + Math.sin(tick * 0.73) * 0.06, 0.04, 0.55),
    activeDomain: b.activeDomain || defaults.activeDomain,
    titleKeywords: (b.titleKeywords && b.titleKeywords.length ? b.titleKeywords : defaults.titleKeywords).slice(),
    activeTitle: b.activeTitle || defaults.activeTitle,
    hasLiveIngest: Boolean(base && Date.now() - base.updatedAt < 120000),
  };
}

export function getNeuroScorePayload() {
  const s = getSignals();
  const confusion = Math.min(100, Math.round(s.backtrackRatio * 100 + s.tabSwitchesPerMin * 4));
  const stress = Math.min(100, Math.round(28 + (s.tabSwitchesPerMin > 7 ? 28 : 0) + (s.tabSwitchesPerMin > 12 ? 18 : 0)));
  const focus = Math.max(0, Math.min(100, Math.round(100 - confusion / 2 - stress / 3)));
  const deepFocusSuggested = focus < 42 || confusion > 55;

  let label = "Stable attention";
  let recommendation = "Maintain current rhythm; batch low-priority pings.";
  if (deepFocusSuggested) {
    label = "Focus decay detected";
    recommendation = "User is losing focus → activate Deep Focus Mode; delay non-critical notifications.";
  } else if (stress > 60) {
    label = "Overload risk";
    recommendation = "Reduce context switches; surface only high-DNA notifications.";
  }

  return {
    focus,
    stress,
    confusion,
    label,
    recommendation,
    deepFocusSuggested,
  };
}

export function getIntentPayload() {
  const s = getSignals();
  const domain = String(s.activeDomain || "").toLowerCase();
  const blob = `${domain} ${(s.titleKeywords || []).join(" ")} ${s.activeTitle}`.toLowerCase();

  let intent = "coding";
  let confidence = 0.78;

  if (/youtube|course|lecture|udemy|coursera|khan/.test(blob)) {
    intent = "studying";
    confidence = 0.72;
  } else if (/mail\.google|gmail|outlook|slack|teams\.microsoft/.test(blob)) {
    intent = "communication";
    confidence = 0.74;
  } else if (s.tabSwitchesPerMin > 10) {
    intent = "browsing";
    confidence = 0.62;
  } else if (/figma|design|canva/.test(blob)) {
    intent = "designing";
    confidence = 0.75;
  }

  const signals = [
    `Domain: ${s.activeDomain}`,
    `Keywords: ${(s.titleKeywords || []).slice(0, 3).join(", ")}`,
  ];
  return { intent, confidence, signals };
}

export function getPredictionPayload() {
  const s = getSignals();
  const dwell = s.dwellSeconds;
  const sw = s.tabSwitchesPerMin;
  const est = clamp(Math.round(8 + (60 / Math.max(3, dwell)) * 6 - sw * 0.35), 2, 28);

  const title = s.activeTitle || "Current task";
  const taskLabel = title.length > 52 ? `${title.slice(0, 49)}…` : title;

  const conf = clamp(0.55 + (s.hasLiveIngest ? 0.18 : 0) + (dwell > 40 ? 0.08 : 0) - sw * 0.01, 0.45, 0.92);

  let rationale = `Stable dwell on ${s.activeDomain} + ${sw < 9 ? "low" : "elevated"} tab churn → ~${est} min to a natural break; delay non-critical notifications.`;
  if (sw > 10) {
    rationale = `High context switching (${sw.toFixed(1)}/min) — batch pings until focus stabilizes; estimated break in ~${est} min.`;
  }

  return {
    taskLabel,
    estimatedMinutesRemaining: est,
    confidence: Math.round(conf * 100) / 100,
    rationale,
  };
}

export function getDashboardPayload() {
  return {
    neuroScore: getNeuroScorePayload(),
    intent: getIntentPayload(),
    prediction: getPredictionPayload(),
    signals: getSignals(),
    serverTime: Date.now(),
  };
}

/** For live architecture / flows diagram — last client ingest timestamp. */
export function getIngestMeta() {
  return {
    lastIngestAt: ingested?.updatedAt ?? null,
  };
}
