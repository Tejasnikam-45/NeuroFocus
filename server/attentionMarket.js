/**
 * Attention Market Layer — treat attention as currency.
 * value vs cost → allow / delay / batch / (block only when confidence ≥ threshold).
 */

export const FAILSAFE_CONFIDENCE = 70;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function normalizeNotification(raw) {
  return {
    id: String(raw.id),
    title: String(raw.title || "(no title)"),
    channel: String(raw.channel || "system"),
    urgency: clamp(Number(raw.urgency) || 0, 0, 100),
    relevance: clamp(Number(raw.relevance) || 0, 0, 100),
    interruptionCost: clamp(Number(raw.interruptionCost) || 0, 0, 100),
    senderImportance: clamp(Number(raw.senderImportance) || 0, 0, 100),
    summary: raw.summary != null ? String(raw.summary) : undefined,
  };
}

/** ~minutes of focus “spent” if you context-switch to this ping (0.5–6 min scale). */
export function estimateFocusMinutes(interruptionCost) {
  const c = clamp(Number(interruptionCost) || 0, 0, 100);
  const minutes = 0.5 + (c / 100) * 5.5;
  return Math.round(minutes * 10) / 10;
}

/**
 * attention_cost: how expensive interrupting is (higher = worse to show now).
 * attention_value: how much this notice is worth attending to.
 */
export function computeAttentionEconomy(n) {
  const attention_cost = Math.round(
    0.5 * n.interruptionCost + 0.2 * (100 - n.relevance) + 0.15 * (100 - n.urgency) + 0.15 * (50 - n.senderImportance * 0.5)
  );
  const attention_value = Math.round(
    0.3 * n.urgency + 0.3 * n.relevance + 0.25 * n.senderImportance + 0.15 * (100 - n.interruptionCost * 0.6)
  );

  const spread = attention_value - attention_cost;
  const signal = (n.urgency + n.relevance + n.senderImportance) / 3;
  const confidence = clamp(Math.round(48 + spread * 0.28 + signal * 0.22), 12, 97);

  return {
    attention_cost: clamp(attention_cost, 0, 100),
    attention_value: clamp(attention_value, 0, 100),
    confidence,
  };
}

function valueLabel(attention_value) {
  if (attention_value >= 66) return "high";
  if (attention_value >= 38) return "medium";
  return "low";
}

/**
 * Proposed path before fail-safe.
 * effective decision never auto-blocks when confidence < FAILSAFE_CONFIDENCE.
 */
export function decideAttentionMarket(n, economy) {
  const { attention_cost, attention_value, confidence } = economy;
  const net = attention_value - attention_cost;

  let proposed = "delay";
  if (net > 8) proposed = "show_now";
  else if (net >= -12) proposed = "delay";
  else if (net >= -32) proposed = "summarize_later";
  else proposed = "block";

  let decision = proposed;
  let failSafeApplied = false;
  let suggestionNote = "";

  if (proposed === "block" && confidence < FAILSAFE_CONFIDENCE) {
    decision = "summarize_later";
    failSafeApplied = true;
    suggestionNote =
      "Low model confidence — block is shown as a suggestion only (not auto-blocked).";
  }

  let delayMinutes;
  if (decision === "delay") {
    delayMinutes = clamp(Math.round(5 + attention_cost * 0.22), 3, 60);
  }

  let digestInMinutes;
  if (decision === "summarize_later") {
    digestInMinutes = clamp(Math.round(12 + attention_cost * 0.2), 8, 90);
  }

  const why = buildWhyLines(n, economy, proposed, decision, failSafeApplied);

  return {
    proposedDecision: proposed,
    decision,
    failSafeApplied,
    suggestionNote: failSafeApplied ? suggestionNote : undefined,
    valueLabel: valueLabel(attention_value),
    focusMinutesEstimate: estimateFocusMinutes(n.interruptionCost),
    delayMinutes,
    digestInMinutes,
    why,
    flowLog: buildFlowLog(n, economy, proposed, decision),
  };
}

function buildWhyLines(n, economy, proposed, decision, failSafe) {
  const lines = [];
  const { attention_cost, attention_value, confidence } = economy;
  lines.push(
    `Attention economy: value ${attention_value} vs cost ${attention_cost} (net ${attention_value - attention_cost}).`
  );
  lines.push(`DNA signals — urgency ${n.urgency}, relevance ${n.relevance}, interruption ${n.interruptionCost}, sender ${n.senderImportance}.`);
  lines.push(`Model confidence in this classification: ${confidence}%.`);
  if (attention_value > attention_cost) {
    lines.push("Value exceeds cost → by default we allow surfacing (subject to overrides).");
  } else {
    lines.push("Cost meets or exceeds value → defer, batch, or block (policy + fail-safe).");
  }
  if (failSafe) {
    lines.push(
      `Fail-safe: confidence under ${FAILSAFE_CONFIDENCE}% — we do not auto-block; we batch instead.`
    );
  } else if (proposed === "block" && decision === "block") {
    lines.push("High-confidence block — still reviewable in the queue.");
  }
  return lines;
}

function buildFlowLog(n, economy, proposed, decision) {
  return [
    "① Notification ingested & normalized",
    `② DNA + Attention Market → value ${economy.attention_value}, cost ${economy.attention_cost}, conf ${economy.confidence}%`,
    `③ Decision engine proposed: ${proposed}`,
    `④ Control layer + fail-safe → effective: ${decision}`,
    "⑤ Ready for delivery / delay / digest (extension applies)",
  ];
}

/** Demo queue — replace with real bus later */
export const SEED_NOTIFICATIONS = [
  {
    id: "nf-1",
    channel: "slack",
    title: "Slack: @you in #eng-incidents",
    urgency: 88,
    relevance: 72,
    interruptionCost: 82,
    senderImportance: 90,
    summary: "Production alert thread — paging on-call",
  },
  {
    id: "nf-2",
    channel: "email",
    title: "Newsletter: Weekly digest",
    urgency: 12,
    relevance: 22,
    interruptionCost: 65,
    senderImportance: 15,
    summary: "Marketing roundup — safe to batch",
  },
  {
    id: "nf-3",
    channel: "calendar",
    title: "Calendar: 1:1 with manager",
    urgency: 45,
    relevance: 80,
    interruptionCost: 40,
    senderImportance: 85,
    summary: "Starts in 25 minutes",
  },
  {
    id: "nf-4",
    channel: "social",
    title: "Social: 12 new reactions",
    urgency: 18,
    relevance: 14,
    interruptionCost: 55,
    senderImportance: 10,
    summary: "Low-signal engagement — good candidate to suppress",
  },
  {
    id: "nf-5",
    channel: "slack",
    title: "Slack: random meme in #random",
    urgency: 8,
    relevance: 12,
    interruptionCost: 48,
    senderImportance: 8,
    summary: "Noise — should lose to cost",
  },
];

export function enrichNotification(raw) {
  const n = normalizeNotification(raw);
  const economy = computeAttentionEconomy(n);
  const d = decideAttentionMarket(n, economy);
  return {
    ...n,
    ...economy,
    ...d,
  };
}

export function getAttentionQueue() {
  return SEED_NOTIFICATIONS.map(enrichNotification);
}
