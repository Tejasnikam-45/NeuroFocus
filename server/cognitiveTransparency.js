/**
 * Cognitive Transparency — deterministic explainability + what-if alternatives.
 * @param {Record<string, unknown>} raw
 */
export function analyzeExplainability(raw) {
  const decision = String(raw.decision ?? "delay").toLowerCase();
  const focusLevel = clampNum(raw.focus_level ?? raw.focusLevel ?? 50, 0, 100);
  const urgency = clampNum(raw.urgency ?? 50, 0, 100);
  const ctx = raw.context && typeof raw.context === "object" ? raw.context : {};
  const deepFocus = ctx.deep_focus === true || ctx.deepFocus === true;
  const inMeeting = ctx.in_meeting === true || ctx.inMeeting === true;
  const senderImportance = clampNum(
    raw.sender_importance != null ? Number(raw.sender_importance) : raw.senderImportance != null
      ? Number(raw.senderImportance)
      : 0.5,
    0,
    1
  );
  const deadlineHours =
    raw.deadline_hours != null
      ? Number(raw.deadline_hours)
      : raw.deadlineHours != null
        ? Number(raw.deadlineHours)
        : null;
  const userHistory = String(raw.user_history ?? raw.userHistory ?? "").trim();

  const key_factors = [];

  key_factors.push(`Focus level: ${Math.round(focusLevel)}% — ${focusLevel < 45 ? "fragile attention" : "stable attention"}.`);

  if (deepFocus) {
    key_factors.push("Deep Focus is ON — the gate delays non-critical interruptions.");
  }

  if (inMeeting) {
    key_factors.push("Calendar context: in a meeting — batching is preferred.");
  }

  key_factors.push(`Notification urgency (DNA): ${Math.round(urgency)}%.`);

  key_factors.push(
    `Sender / thread importance score: ${Math.round(senderImportance * 100)}% — ${senderImportance >= 0.7 ? "elevated" : "baseline"}.`
  );

  if (deadlineHours != null && !Number.isNaN(deadlineHours)) {
    key_factors.push(
      deadlineHours <= 24
        ? `Deadline pressure: due within ~${Math.round(deadlineHours)}h — raises priority.`
        : `Deadline is farther out (~${Math.round(deadlineHours)}h) — less time-critical.`
    );
  }

  if (userHistory) {
    key_factors.push(`User history signal: ${userHistory} — used to tune batching vs immediate surface.`);
  }

  const explanation = buildNarrative(decision, {
    focusLevel,
    urgency,
    deepFocus,
    inMeeting,
    senderImportance,
    deadlineHours,
    delayMinutes: raw.delay_minutes != null ? Number(raw.delay_minutes) : raw.delayMinutes != null ? Number(raw.delayMinutes) : undefined,
  });

  const confidence = computeConfidence({ focusLevel, urgency, deepFocus, senderImportance });
  const confidence_reason = confidenceReason(confidence, { deepFocus, urgency, senderImportance });

  const alternatives = buildWhatIfs(decision, {
    focusLevel,
    urgency,
    deepFocus,
    inMeeting,
    senderImportance,
  });

  return {
    explanation,
    key_factors,
    confidence: Math.round(confidence * 100) / 100,
    confidence_reason,
    alternatives,
  };
}

function clampNum(n, min, max) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function buildNarrative(decision, s) {
  const parts = [];
  if (decision === "delay" || decision === "summarize_later") {
    if (s.deepFocus) {
      parts.push(
        `This was ${decision === "summarize_later" ? "batched for digest" : "delayed"} because you are in Deep Focus — the system protects your current block.`
      );
    } else if (s.inMeeting) {
      parts.push(`Delayed because you appear to be in a meeting; interruptions are held until you exit.`);
    } else {
      parts.push(
        `The model chose to ${decision === "summarize_later" ? "batch this into a summary" : "delay delivery"} to reduce context switching.`
      );
    }
  } else if (decision === "show_now") {
    parts.push(`Shown immediately: urgency and sender weight crossed the “now” threshold.`);
  } else {
    parts.push(`Decision: ${decision}.`);
  }

  if (s.urgency >= 75) {
    parts.push(`High priority due to urgency (${Math.round(s.urgency)}%)${s.deadlineHours != null && s.deadlineHours <= 24 ? " and an approaching deadline" : ""}.`);
  }

  if (s.senderImportance >= 0.75) {
    parts.push("Sender or thread importance is high — that competes with focus rules.");
  }

  parts.push(`Focus was estimated at ${Math.round(s.focusLevel)}% — that feeds the attention gate alongside DNA scores.`);

  return parts.join(" ");
}

function computeConfidence({ focusLevel, urgency, deepFocus, senderImportance }) {
  const spread = Math.abs(urgency - focusLevel) / 100;
  let c = 0.62 + spread * 0.18 + (deepFocus ? 0.08 : 0.04) + senderImportance * 0.12;
  c += (Math.abs(urgency - 50) / 100) * 0.06;
  return clampNum(c, 0.68, 0.94);
}

function confidenceReason(confidence, { deepFocus, urgency, senderImportance }) {
  const bits = [];
  bits.push(`Model confidence is ${Math.round(confidence * 100)}%.`);
  if (deepFocus) {
    bits.push("Strong agreement: focus mode is an explicit signal.");
  }
  if (urgency > 70 || urgency < 30) {
    bits.push("Urgency is far from the mid-band — clearer DNA classification.");
  } else {
    bits.push("Urgency sits in a mixed band — slightly wider uncertainty.");
  }
  if (senderImportance > 0.72) {
    bits.push("Sender importance aligns with the chosen action.");
  }
  return bits.join(" ");
}

function buildWhatIfs(decision, s) {
  const alts = [];

  if (s.deepFocus && (decision === "delay" || decision === "summarize_later")) {
    alts.push({
      scenario: "If not in Deep Focus",
      would_decision: "show_now",
      one_liner: "If not in focus → this would likely be shown instantly (same urgency).",
    });
  }

  if (s.inMeeting && decision === "delay") {
    alts.push({
      scenario: "If not in a meeting",
      would_decision: s.urgency >= 75 ? "show_now" : "delay",
      one_liner:
        s.urgency >= 75
          ? "Outside the meeting, urgency would probably surface this immediately."
          : "Outside the meeting, it might still delay — but with a shorter hold.",
    });
  }

  if (decision !== "show_now" && s.urgency >= 80) {
    alts.push({
      scenario: "If urgency were lower (e.g. under 40%)",
      would_decision: "summarize_later",
      one_liner: "With low urgency (under 40%), the default would shift toward batching instead of interrupting.",
    });
  }

  if (decision === "show_now" && s.deepFocus) {
    alts.push({
      scenario: "If Deep Focus matched this sender as critical",
      would_decision: "show_now",
      one_liner: "Even in focus, VIP / deadline overrides can still win — same outcome, different path.",
    });
  }

  if (decision === "show_now" && s.urgency >= 72 && !s.deepFocus) {
    alts.push({
      scenario: "If urgency were much lower",
      would_decision: "summarize_later",
      one_liner: "Below the interrupt threshold, this would land in a digest instead of a banner.",
    });
  }

  if (alts.length === 0) {
    alts.push({
      scenario: "Baseline comparison",
      would_decision: decision,
      one_liner: "Toggling context flags would not flip this decision in the current policy band.",
    });
  }

  return alts;
}
