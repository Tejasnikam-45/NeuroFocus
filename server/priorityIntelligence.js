/**
 * Priority Intelligence Designer — scores tasks, estimates attention cost,
 * applies attention-economy rules, returns recommended_action.
 */

function clamp(n, lo, hi) {
  const x = Number(n);
  if (Number.isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

const CHANNEL_WEIGHT = {
  email: 1.0,
  chat: 0.92,
  social: 0.55,
  calendar: 1.05,
  other: 0.85,
};

/**
 * @param {Record<string, unknown>} prefs
 */
export function defaultPreferences(prefs = {}) {
  return {
    emails_over_chats: prefs.emails_over_chats !== false,
    work_over_social: prefs.work_over_social !== false,
    morning_deep_work: prefs.morning_deep_work !== false,
  };
}

function hourOfDay() {
  return new Date().getHours();
}

function isMorningBlock() {
  const h = hourOfDay();
  return h >= 6 && h < 11;
}

/**
 * Map numeric strain to low | medium | high
 */
function attentionCostLevel(raw) {
  if (raw < 38) return "low";
  if (raw < 68) return "medium";
  return "high";
}

function mapBand(score) {
  if (score < 36) return "low";
  if (score < 66) return "medium";
  return "high";
}

/**
 * @param {Record<string, unknown>} raw
 * @param {Record<string, unknown>} preferences
 */
export function analyzePriority(raw, preferences) {
  const prefs = defaultPreferences(preferences);

  const taskLabel = String(raw.task ?? raw.task_label ?? "Untitled task");
  const channel = String(raw.channel ?? "other").toLowerCase();
  const chWeight = CHANNEL_WEIGHT[channel] ?? CHANNEL_WEIGHT.other;

  const urgencySignals = clamp(raw.urgency_signals ?? raw.urgency ?? 50, 0, 100);
  const taskImportance = clamp(raw.task_importance ?? raw.importance_input ?? 50, 0, 100);
  const senderScore = clamp(raw.sender_score ?? raw.sender_importance ?? 50, 0, 100);
  const userFocus = clamp(raw.user_focus ?? raw.focus_level ?? 55, 0, 100);
  const pastBehavior = clamp(raw.past_behavior ?? raw.past_behavior_score ?? 50, 0, 100);

  const deadlineHours =
    raw.deadline_hours != null && raw.deadline_hours !== ""
      ? Number(raw.deadline_hours)
      : null;

  const deepFocus = raw.deep_focus === true || raw.context?.deep_focus === true;
  const inMeeting = raw.in_meeting === true || raw.context?.in_meeting === true;

  /** Urgency: signals + deadline proximity */
  let urgency = urgencySignals;
  if (deadlineHours != null && !Number.isNaN(deadlineHours)) {
    if (deadlineHours <= 2) urgency = Math.min(100, urgency + 28);
    else if (deadlineHours <= 8) urgency = Math.min(100, urgency + 18);
    else if (deadlineHours <= 24) urgency = Math.min(100, urgency + 8);
  }
  if (inMeeting) urgency = Math.max(0, urgency - 12);
  urgency = clamp(urgency, 0, 100);

  /** Importance: task + sender + channel prefs + morning deep work */
  let importance = clamp((taskImportance + senderScore) / 2 + pastBehavior * 0.08, 0, 100);

  if (prefs.work_over_social && channel === "social") {
    importance *= 0.62;
  }
  if (prefs.emails_over_chats && channel === "chat") {
    importance *= 0.88;
  }
  if (prefs.emails_over_chats && channel === "email") {
    importance = Math.min(100, importance * 1.06);
  }

  if (prefs.morning_deep_work && isMorningBlock() && channel === "chat") {
    importance *= 0.82;
  }

  importance = clamp(importance, 0, 100);

  /** Raw attention strain (higher = more expensive to interrupt) */
  let attentionRaw = 32;
  attentionRaw += (100 - userFocus) * 0.35;
  if (deepFocus) attentionRaw += 22;
  if (inMeeting) attentionRaw += 12;
  if (channel === "chat") attentionRaw += prefs.emails_over_chats ? 14 : 6;
  if (channel === "social") attentionRaw += 8;
  attentionRaw = clamp(attentionRaw, 0, 100);

  const attention_cost = attentionCostLevel(attentionRaw);

  /** Combined score for final band */
  const combined = clamp(urgency * 0.45 + importance * 0.45 + (100 - attentionRaw) * 0.1, 0, 100);
  let final_priority = mapBand(combined);
  if (attention_cost === "high" && urgency < 72) {
    final_priority = final_priority === "high" ? "medium" : final_priority;
  }

  /** Attention economy: value vs cost */
  const valueScore = clamp((urgency + importance) / 2, 0, 100);
  const costPenalty = attention_cost === "high" ? 28 : attention_cost === "medium" ? 14 : 0;
  const netValue = clamp(valueScore - costPenalty + (deepFocus ? -6 : 0), 0, 100);

  let economyRule = "balanced";
  let recommended_action = "delay";

  if (attention_cost === "high" && netValue < 52) {
    economyRule = "attention_cost_exceeds_value → DELAY";
    recommended_action = "delay";
  } else if (valueScore >= 76 && urgency >= 68) {
    economyRule = "high_value_and_urgent → SHOW";
    recommended_action = "show";
  } else if (importance < 32 && urgency < 40 && channel === "social") {
    economyRule = "low_value_channel → BLOCK_or_BATCH";
    recommended_action = "block";
  } else if (urgency < 45 && importance < 50) {
    economyRule = "defer_summarization";
    recommended_action = "summarize";
  } else if (attention_cost === "high" && urgency >= 80) {
    economyRule = "urgent_despite_cost → SHOW";
    recommended_action = "show";
  } else if (netValue >= 58) {
    recommended_action = urgency > 62 ? "show" : "delay";
    economyRule = "net_value_ok";
  } else {
    recommended_action = "delay";
    economyRule = "protect_focus";
  }

  const rationale = buildRationale({
    taskLabel,
    channel,
    urgency,
    importance,
    attention_cost,
    final_priority,
    economyRule,
    recommended_action,
    deepFocus,
    prefs,
  });

  return {
    task: taskLabel,
    urgency: Math.round(urgency * 10) / 10,
    importance: Math.round(importance * 10) / 10,
    attention_cost,
    final_priority,
    priority: final_priority,
    attention_economy: {
      value_score: Math.round(valueScore * 10) / 10,
      net_value: Math.round(netValue * 10) / 10,
      rule_fired: economyRule,
    },
    recommended_action,
    rationale,
  };
}

function buildRationale(s) {
  const bits = [];
  bits.push(
    `Task “${s.taskLabel}” (${s.channel}): urgency ${Math.round(s.urgency)}, importance ${Math.round(s.importance)}.`
  );
  bits.push(`Attention cost is ${s.attention_cost} — ${s.deepFocus ? "Deep Focus amplifies protection." : "context is normal."}`);
  bits.push(`Attention economy: ${s.economyRule}.`);
  bits.push(`Mapped to ${s.final_priority} final priority → recommended_action: ${s.recommended_action}.`);
  if (s.prefs.emails_over_chats) bits.push("Preference: emails rank above chats.");
  if (s.prefs.work_over_social) bits.push("Preference: work surfaces above social noise.");
  if (s.prefs.morning_deep_work) bits.push("Preference: morning blocks bias toward deep work.");
  return bits.join(" ");
}
