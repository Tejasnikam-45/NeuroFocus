const base = "/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${base}${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    let msg = text.length > 280 ? `${text.slice(0, 280)}…` : text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j?.error === "string") msg = j.error;
    } catch {
      /* plain text */
    }
    throw new Error(msg);
  }
  return JSON.parse(text) as T;
}

async function del<T>(path: string): Promise<T> {
  const r = await fetch(`${base}${path}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export type NeuroScore = {
  focus: number;
  stress: number;
  confusion: number;
  label: string;
  recommendation: string;
  deepFocusSuggested: boolean;
};

export type Intent = {
  intent: string;
  confidence: number;
  signals: string[];
};

export type Prediction = {
  taskLabel: string;
  estimatedMinutesRemaining: number;
  confidence: number;
  rationale: string;
};

export type NotificationDecision = "show_now" | "delay" | "summarize_later" | "block";

export type NotificationDNA = {
  id: string;
  title: string;
  channel?: string;
  summary?: string;
  urgency: number;
  relevance: number;
  interruptionCost: number;
  senderImportance: number;
  attention_cost: number;
  attention_value: number;
  confidence: number;
  focusMinutesEstimate: number;
  valueLabel: "high" | "medium" | "low";
  proposedDecision: NotificationDecision;
  decision: NotificationDecision;
  failSafeApplied?: boolean;
  suggestionNote?: string;
  delayMinutes?: number;
  digestInMinutes?: number;
  why: string[];
  flowLog: string[];
  userOverride?: boolean;
  overrideLabel?: string;
};

export type NotificationsGmailMeta = {
  connected: boolean;
  email: string | null;
  fetchedAt: number | null;
  error: string | null;
  source: "gmail" | "demo";
};

export type NotificationsPayload = {
  items: NotificationDNA[];
  failSafeConfidence: number;
  tagline: string;
  gmail?: NotificationsGmailMeta;
};

export type FocusExit = {
  summary: string;
  missedHighlights: string[];
  suggestedActions: { label: string; priority: "high" | "medium" | "low" }[];
};

export type AgentAction = {
  id: string;
  type: string;
  description: string;
  status: "pending" | "running" | "done" | "needs_approval";
  result?: string;
};

export type FlowStep = { id: string; condition: string; action: string };

export type OverrideRule = {
  id: string;
  condition: { sender?: string; context?: string };
  action: string;
  priority: string;
  delayMinutes?: number;
  learned?: boolean;
  reinforcementCount?: number;
};

export type OverrideApplyResult = {
  final_decision: Record<string, unknown>;
  overridden: boolean;
  reason: string;
  matched_rule_id: string | null;
};

export type ExplainabilityAlternative = {
  scenario: string;
  would_decision: string;
  one_liner: string;
};

export type ExplainabilityResult = {
  explanation: string;
  key_factors: string[];
  confidence: number;
  confidence_reason: string;
  alternatives: ExplainabilityAlternative[];
};

export type PriorityPreferences = {
  emails_over_chats: boolean;
  work_over_social: boolean;
  morning_deep_work: boolean;
};

export type PriorityAnalyzeResult = {
  task: string;
  urgency: number;
  importance: number;
  attention_cost: "low" | "medium" | "high";
  final_priority: "low" | "medium" | "high";
  priority: "low" | "medium" | "high";
  attention_economy: {
    value_score: number;
    net_value: number;
    rule_fired: string;
  };
  recommended_action: "show" | "delay" | "summarize" | "block";
  rationale: string;
};

export type WeeklyStreakCell = {
  day: string;
  streak: number;
  dateLabel: string;
  beforeOrigin?: boolean;
  future?: boolean;
};

export type AnalyticsPayload = {
  focusScoreWeek: number;
  distractionMinutes: number;
  trendPercent: number;
  streakDays: number;
  /** Mon–Sun streak value per day; see server (28 Mar 2026 origin; past weeks = 7 each). */
  weeklyStreakByDay?: WeeklyStreakCell[];
  deepWorkHoursWeek: number;
  weeklyFocusByDay: { day: string; focus: number }[];
  timeAllocationMinutes: { key: string; label: string; minutes: number }[];
  dnaDecisionsWeek: { label: string; count: number }[];
  insightHeadline: string;
  insightBullets: string[];
  /** Present when payload comes from live engine / SSE */
  serverTime?: number;
  live?: boolean;
  /** 0 = this week; charts use a stable anchor for past weeks */
  weekOffset?: number;
  weekRangeLabel?: string;
};

export const api = {
  neuroScore: () => get<NeuroScore>("/neuro-score"),
  intent: () => get<Intent>("/intent"),
  predict: () => get<Prediction>("/predict-attention"),
  notifications: () => get<NotificationsPayload>("/notifications/dna"),
  notificationsAction: (id: string, action: "force_show" | "delay" | "digest" | "block_confirm" | "reset") =>
    post<{ ok: boolean; item: NotificationDNA }>("/notifications/action", { id, action }),
  notificationsLog: () => get<{ entries: Array<Record<string, unknown>> }>("/notifications/log"),
  notificationsFeedback: (id: string, helpful: boolean) =>
    post<{ ok: boolean; message?: string }>("/notifications/feedback", { id, helpful }),
  focusExit: () => get<FocusExit>("/focus-exit"),
  agentQueue: () => get<{ actions: AgentAction[] }>("/agent/queue"),
  flows: () => get<{ flows: { id: string; name: string; steps: FlowStep[]; enabled: boolean }[] }>("/flows"),
  analytics: (weekOffset = 0) =>
    get<AnalyticsPayload>(`/analytics${weekOffset > 0 ? `?weekOffset=${weekOffset}` : ""}`),
  command: (text: string) => post<{ interpreted: string; actions: string[] }>("/voice-command", { text }),

  overrideRules: () => get<{ override_rules: OverrideRule[] }>("/overrides/rules"),
  overrideApply: (body: {
    ai_decision: { decision: string; delayMinutes?: number };
    context: Record<string, unknown>;
  }) => post<OverrideApplyResult>("/overrides/apply", body),
  overrideAddRule: (body: {
    condition: { sender?: string; context?: string };
    action: string;
    priority?: string;
    delayMinutes?: number;
  }) => post<{ ok: boolean; rule: OverrideRule }>("/overrides/rules", body),
  overrideDeleteRule: (id: string) => del<{ ok: boolean }>(`/overrides/rules/${encodeURIComponent(id)}`),
  overrideLearn: (body: { sender: string; action: string; context?: string }) =>
    post<{ ok: boolean; rule: OverrideRule; reinforcementCount: number; message: string }>("/overrides/learn", body),

  explainabilityAnalyze: (body: {
    decision: string;
    focus_level?: number;
    urgency?: number;
    context?: { deep_focus?: boolean; in_meeting?: boolean };
    sender_importance?: number;
    deadline_hours?: number | null;
    user_history?: string;
    delay_minutes?: number;
  }) => post<ExplainabilityResult>("/explainability/analyze", body),

  priorityPreferences: () => get<{ preferences: PriorityPreferences }>("/priority/preferences"),
  prioritySetPreferences: (preferences: Partial<PriorityPreferences>) =>
    post<{ ok: boolean; preferences: PriorityPreferences }>("/priority/preferences", preferences),
  priorityAnalyze: (body: {
    task?: string;
    channel?: string;
    urgency_signals?: number;
    task_importance?: number;
    sender_score?: number;
    user_focus?: number;
    past_behavior?: number;
    deadline_hours?: number | null;
    deep_focus?: boolean;
    in_meeting?: boolean;
    preferences?: Partial<PriorityPreferences>;
  }) => post<PriorityAnalyzeResult>("/priority/analyze", body),

  refreshContext: () =>
    post<{ ok: boolean; neuroScore?: NeuroScore; intent?: Intent; prediction?: Prediction }>("/context/refresh", {}),
  contextIngest: (body: Record<string, unknown>) =>
    post<{
      ok: boolean;
      ingested: Record<string, unknown>;
      dashboard: {
        neuroScore: NeuroScore;
        intent: Intent;
        prediction: Prediction;
        serverTime: number;
      };
    }>("/context/ingest", body),
  agentMessage: (text: string) => post<{ reply: string; enqueued: AgentAction[] }>("/agent/message", { text }),
  agentApprove: (id: string) => post<{ ok: boolean; action: AgentAction }>("/agent/approve", { id }),
  agentReject: (id: string) => post<{ ok: boolean; action: AgentAction }>("/agent/reject", { id }),
  agentClearDone: () => post<{ ok: boolean; removed: number }>("/agent/clear-done", {}),
  googleStatus: () =>
    get<{ configured: boolean; connected: boolean; email: string | null }>("/google/status"),
  googlePreview: () =>
    get<{
      configured: boolean;
      connected: boolean;
      email?: string;
      inboxSummary?: string;
      upcoming?: { id?: string; summary: string; start: string; htmlLink?: string | null }[];
      error?: string;
    }>("/google/preview"),
  googleDisconnect: () => post<{ ok: boolean }>("/google/disconnect", {}),

  meetingSchedulerAvailability: (days?: number, durationMin?: number) => {
    const p = new URLSearchParams();
    if (days !== undefined) p.set("days", String(days));
    if (durationMin !== undefined) p.set("durationMin", String(durationMin));
    const qs = p.toString();
    return get<{
      timeZone: string;
      range: { from: string; to: string };
      busy: { summary: string; start: string; end: string }[];
      freeSlotCount: number;
    }>(`/meeting-scheduler/availability${qs ? `?${qs}` : ""}`);
  },
  meetingSchedulerSuggest: (body: { durationMinutes: number; daysAhead?: number; title?: string }) =>
    post<{
      proposalId: string;
      policy: string;
      timeZone: string;
      range: { from: string; to: string };
      busy: { summary: string; start: string; end: string }[];
      suggestions: Array<{
        start: string;
        end: string;
        reason: string;
        score?: number;
        index?: number;
        conflicts?: { summary: string; start: string; end: string }[];
      }>;
    }>("/meeting-scheduler/suggest", body),
  meetingSchedulerConfirm: (proposalId: string, slotIndex: number) =>
    post<{ ok: boolean; htmlLink?: string; eventId?: string }>("/meeting-scheduler/confirm", { proposalId, slotIndex }),

  emailAutomationSettings: () =>
    get<{
      safeMode: boolean;
      openai: boolean;
      defaultSendDelayMs: number;
      suggestedDelayMs: number;
      inboxQueryDefault: string;
      inboxMaxDefault: number;
    }>("/email-automation/settings"),
  emailAutomationInbox: (q?: string, maxResults?: number) => {
    const params = new URLSearchParams();
    if (q !== undefined) params.set("q", q);
    if (maxResults !== undefined) params.set("maxResults", String(maxResults));
    const qs = params.toString();
    return get<{
      messages: Array<{
        id: string;
        threadId: string;
        subject: string;
        from: string;
        snippet: string;
        date?: string;
      }>;
      query: string;
      maxResults: number;
    }>(`/email-automation/inbox${qs ? `?${qs}` : ""}`);
  },
  emailAutomationAnalyze: (messageId: string) =>
    post<{
      sessionId: string;
      extraction: {
        tasks: Array<{
          task: string;
          deadline: string;
          priority: string;
          requires_response: boolean;
        }>;
        summary: string;
      };
      meta: { subject: string; from: string; snippet: string };
    }>("/email-automation/analyze", { messageId }),
  emailAutomationPreview: (sessionId: string, tone: "formal" | "friendly" | "short") =>
    post<{ draftText: string; confidence: number; confidenceReason: string }>("/email-automation/preview", {
      sessionId,
      tone,
    }),
  emailAutomationApprove: async (
    sessionId: string,
    body: string,
    opts?: { force?: boolean; delayMs?: number }
  ) => {
    const payload: Record<string, unknown> = { sessionId, body, force: !!opts?.force };
    if (opts?.delayMs !== undefined) payload.delayMs = opts.delayMs;
    const r = await fetch(`${base}/email-automation/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    if (r.status === 422) {
      let j: { confidence?: number; message?: string } = {};
      try {
        j = JSON.parse(text) as { confidence?: number; message?: string };
      } catch {
        /* ignore */
      }
      throw new Error(`low_confidence:${j.confidence ?? 0}:${j.message ?? ""}`);
    }
    if (!r.ok) throw new Error(text);
    return JSON.parse(text) as {
      ok: boolean;
      mode: string;
      message?: string;
      draftId?: string;
      messageId?: string;
      delayMs?: number;
      sessionId?: string;
    };
  },
  emailAutomationReject: (sessionId: string) => post<{ ok: boolean }>("/email-automation/reject", { sessionId }),
  emailAutomationCancelScheduled: (sessionId: string) =>
    post<{ ok: boolean; message?: string }>("/email-automation/cancel-scheduled", { sessionId }),
  emailAutomationUndo: () => post<{ ok: boolean; undone?: string; message?: string }>("/email-automation/undo", {}),
};
