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

export type NotificationDNA = {
  id: string;
  title: string;
  urgency: number;
  relevance: number;
  interruptionCost: number;
  senderImportance: number;
  decision: "show_now" | "delay" | "summarize_later";
  delayMinutes?: number;
  summary?: string;
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

export type AnalyticsPayload = {
  focusScoreWeek: number;
  distractionMinutes: number;
  trendPercent: number;
  streakDays: number;
  deepWorkHoursWeek: number;
  weeklyFocusByDay: { day: string; focus: number }[];
  timeAllocationMinutes: { key: string; label: string; minutes: number }[];
  dnaDecisionsWeek: { label: string; count: number }[];
  insightHeadline: string;
  insightBullets: string[];
};

export const api = {
  neuroScore: () => get<NeuroScore>("/neuro-score"),
  intent: () => get<Intent>("/intent"),
  predict: () => get<Prediction>("/predict-attention"),
  notifications: () => get<{ items: NotificationDNA[] }>("/notifications/dna"),
  focusExit: () => get<FocusExit>("/focus-exit"),
  agentQueue: () => get<{ actions: AgentAction[] }>("/agent/queue"),
  flows: () => get<{ flows: { id: string; name: string; steps: FlowStep[]; enabled: boolean }[] }>("/flows"),
  analytics: () => get<AnalyticsPayload>("/analytics"),
  command: (text: string) => post<{ interpreted: string; actions: string[] }>("/voice-command", { text }),
  refreshContext: () => post<{ ok: boolean }>("/context/refresh", {}),
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
