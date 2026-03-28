/** @typedef {{ id: string, condition: { sender?: string, context?: string }, action: string, priority: string, delayMinutes?: number, learned?: boolean }} OverrideRule */
/** @typedef {{ decision: string, delayMinutes?: number, [k: string]: unknown }} AiDecision */

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

function priorityWeight(p) {
  return PRIORITY_WEIGHT[p] ?? 1;
}

function isWorkHours() {
  const h = new Date().getHours();
  return h >= 9 && h < 18;
}

/**
 * @param {string | undefined} ruleCtx
 * @param {Record<string, unknown>} ctx
 */
function contextMatches(ruleCtx, ctx) {
  if (!ruleCtx || ruleCtx === "any") return true;
  if (ruleCtx === "work_hours") return isWorkHours();
  if (ruleCtx === "meeting") return ctx.in_meeting === true;
  if (ruleCtx === "focus_mode") return ctx.deep_focus === true || ctx.focus_mode === true;
  return true;
}

/**
 * @param {string | undefined} ruleSender
 * @param {string | undefined} userSender
 */
function senderMatches(ruleSender, userSender) {
  if (!ruleSender) return true;
  if (!userSender) return false;
  return userSender.toLowerCase().includes(String(ruleSender).toLowerCase());
}

/**
 * @param {OverrideRule} rule
 * @param {Record<string, unknown>} userContext
 */
export function ruleMatches(rule, userContext) {
  const cond = rule.condition || {};
  if (!senderMatches(cond.sender, userContext.sender)) return false;
  if (!contextMatches(cond.context, userContext)) return false;
  return true;
}

/**
 * @param {OverrideRule} rule
 * @param {AiDecision} aiDecision
 */
function applyRuleAction(rule, aiDecision) {
  const out = { ...aiDecision };
  switch (rule.action) {
    case "always_notify":
    case "always_prioritize":
      out.decision = "show_now";
      delete out.delayMinutes;
      return out;
    case "always_delay":
      out.decision = "delay";
      out.delayMinutes = rule.delayMinutes ?? aiDecision.delayMinutes ?? 15;
      return out;
    case "never_batch":
      out.decision = "show_now";
      delete out.delayMinutes;
      return out;
    case "respect_ai":
      return { ...aiDecision };
    default:
      return { ...aiDecision };
  }
}

/**
 * @param {AiDecision} aiDecision
 * @param {Record<string, unknown>} userContext
 * @param {OverrideRule[]} rules
 */
export function applyOverrideEngine(aiDecision, userContext, rules) {
  const sorted = [...rules]
    .filter((r) => r.action !== "respect_ai")
    .sort((a, b) => {
      const pw = priorityWeight(b.priority) - priorityWeight(a.priority);
      if (pw !== 0) return pw;
      const sa = a.condition?.sender ? 1 : 0;
      const sb = b.condition?.sender ? 1 : 0;
      return sb - sa;
    });

  for (const rule of sorted) {
    if (!ruleMatches(rule, userContext)) continue;
    const final = applyRuleAction(rule, aiDecision);
    const overridden =
      final.decision !== aiDecision.decision ||
      final.delayMinutes !== aiDecision.delayMinutes;
    const reason = overridden
      ? `Rule "${rule.id}" (${rule.action}): ${rule.condition?.sender ? `sender matches ${rule.condition.sender}` : "sender open"}; ${
          rule.condition?.context && rule.condition.context !== "any" ? `context=${rule.condition.context}` : "any context"
        }`
      : "Rule matched but output matches AI — no change.";
    return {
      final_decision: final,
      overridden,
      reason: overridden ? reason : "No effective override; AI decision retained.",
      matched_rule_id: rule.id,
    };
  }

  return {
    final_decision: { ...aiDecision },
    overridden: false,
    reason: "No matching override rule — user intent defaults to AI path until a rule fires.",
    matched_rule_id: null,
  };
}

export function defaultOverrideRules() {
  return [
    {
      id: "rule_manager_work",
      condition: { sender: "boss@company.com", context: "work_hours" },
      action: "always_notify",
      priority: "high",
      learned: false,
    },
    {
      id: "rule_boss_deep_focus",
      condition: { sender: "boss@company.com", context: "focus_mode" },
      action: "always_notify",
      priority: "high",
      learned: false,
    },
    {
      id: "rule_focus_delay_other",
      condition: { context: "focus_mode" },
      action: "always_delay",
      priority: "medium",
      delayMinutes: 45,
      learned: false,
    },
    {
      id: "rule_meeting_batch",
      condition: { context: "meeting" },
      action: "always_delay",
      priority: "medium",
      delayMinutes: 60,
      learned: false,
    },
  ];
}
