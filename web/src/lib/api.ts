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
};
