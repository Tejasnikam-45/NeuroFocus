import "./loadEnv.js";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import {
  createOAuthClient,
  saveTokens,
  clearTokens,
  verifyAllowedEmail,
  googleOAuthConfigured,
  getRedirectUri,
  getRedirectUriForRequest,
  getBrowserOriginFromRequest,
  isGoogleRedirectUriLockedByEnv,
  getFrontendOriginForRequest,
  getGoogleClientId,
  getGoogleClientSecret,
  getOAuthClientWithRefresh,
  getConnectedEmail,
  getEmailFromClient,
  GOOGLE_SCOPES,
} from "./googleAuth.js";
import {
  fetchInboxSummary,
  createCalendarEventAt,
  createTriageDraft,
  listUpcomingEvents,
} from "./googleAgent.js";
import { computeAvailabilityOnly, computeMeetingPlan } from "./meetingScheduler.js";
import { applyOverrideEngine, defaultOverrideRules } from "./decisionOverrideEngine.js";
import { analyzeExplainability } from "./cognitiveTransparency.js";
import { analyzePriority, defaultPreferences } from "./priorityIntelligence.js";
import { getAttentionQueue, FAILSAFE_CONFIDENCE } from "./attentionMarket.js";
import { fetchEnrichedGmailNotifications } from "./gmailNotifications.js";
import {
  ingestContext,
  getNeuroScorePayload,
  getIntentPayload,
  getPredictionPayload,
  getDashboardPayload,
  getIngestMeta,
} from "./contextSignals.js";
import { buildAnalyticsPayload } from "./analyticsEngine.js";
import {
  listInboxMessages,
  getMessageFull,
  extractTasksFromEmail,
  draftReplyEmail,
  evaluateDraftConfidence,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  createReplyDraft,
  sendReplyMessage,
  sendCorrectionNotice,
  deleteDraft,
  trashMessage,
  parseEmailAddress,
  getLastUndo,
  setLastUndo,
  clearLastUndo,
  isEmailSafeMode,
} from "./emailAutomation.js";

/** sessionId -> scheduled send timeout (delayed send / cancel window) */
const pendingEmailSends = new Map();

const oauthStates = new Map();

const meetingProposals = new Map();

let overrideRules = defaultOverrideRules();
const overrideLearnCounts = new Map();

let priorityPreferences = defaultPreferences({});
function makeOverrideRuleId() {
  return `or_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
function pruneMeetingProposals() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [k, v] of meetingProposals.entries()) {
    if (v.createdAt < cutoff) meetingProposals.delete(k);
  }
}
function makeMeetingProposalId() {
  return `ms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function pruneOAuthStates() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, t] of oauthStates.entries()) {
    if (t < cutoff) oauthStates.delete(k);
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3847;

app.use(cors({ origin: true }));
app.use(express.json());

/** NeuroScore / intent / timeline — unified on contextSignals (+ optional POST /api/context/ingest). */
app.get("/api/neuro-score", (_req, res) => {
  res.json(getNeuroScorePayload());
});

app.get("/api/intent", (_req, res) => {
  res.json(getIntentPayload());
});

app.get("/api/predict-attention", (_req, res) => {
  res.json(getPredictionPayload());
});

/** Extension / clients push tab signals; drives all dashboard metrics. */
app.post("/api/context/ingest", (req, res) => {
  try {
    const merged = ingestContext(req.body || {});
    res.json({ ok: true, ingested: merged, dashboard: getDashboardPayload() });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/** Single SSE stream: NeuroScore + intent + prediction ~every 2s (aligned snapshot). */
app.get("/api/dashboard/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const push = () => {
    res.write(`data: ${JSON.stringify(getDashboardPayload())}\n\n`);
  };
  push();
  const interval = setInterval(push, 2000);
  req.on("close", () => clearInterval(interval));
});

/** Unified live snapshot for Flows architecture diagram (~2s). */
app.get("/api/architecture/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const push = () => {
    const dash = getDashboardPayload();
    const queue = getNotificationQueueSnapshot();
    const dna = getDnaActionCountsForAnalytics();
    const ingest = getIngestMeta();
    const pendingAgent = agentQueue.filter((a) => a.status !== "done").length;
    const needsApproval = agentQueue.filter((a) => a.status === "needs_approval").length;
    const runningAgent = agentQueue.filter((a) => a.status === "running").length;

    const payload = {
      serverTime: Date.now(),
      ingest: {
        lastIngestAt: ingest.lastIngestAt,
        hasLiveIngest: dash.signals.hasLiveIngest,
      },
      signals: dash.signals,
      neuroScore: dash.neuroScore,
      intent: dash.intent,
      prediction: dash.prediction,
      notifications: {
        queueSize: queue.length,
        gmailConnected: gmailNotificationCache.connected,
        gmailEmail: gmailNotificationCache.email,
        gmailFetchedAt: gmailNotificationCache.fetchedAt,
        inboxSource:
          gmailNotificationCache.items && gmailNotificationCache.items.length > 0 ? "gmail" : "demo",
      },
      dna: {
        delayed: dna.delayed,
        batched: dna.batched,
        shown: dna.shown,
        failSafeConfidence: FAILSAFE_CONFIDENCE,
      },
      agent: {
        total: agentQueue.length,
        pending: pendingAgent,
        needsApproval,
        running: runningAgent,
      },
      flows: {
        activeAutomations: 2,
        streamIntervalMs: 2000,
      },
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  push();
  const interval = setInterval(push, 2000);
  req.on("close", () => clearInterval(interval));
});

/** Attention Market — user overrides + action log (in-memory demo) */
const notificationUserOverrides = new Map();
const notificationActionLog = [];

/** Gmail inbox snapshot for Attention Market (refreshed on DNA GET + SSE tick) */
let gmailNotificationCache = {
  connected: false,
  email: null,
  items: null,
  error: null,
  fetchedAt: null,
};

async function refreshGmailNotificationCache() {
  const auth = await getOAuthClientWithRefresh();
  if (!auth) {
    gmailNotificationCache = {
      connected: false,
      email: null,
      items: null,
      error: null,
      fetchedAt: Date.now(),
    };
    return gmailNotificationCache;
  }
  let email = null;
  try {
    email = await getEmailFromClient(auth);
  } catch {
    email = null;
  }
  try {
    const items = await fetchEnrichedGmailNotifications(auth, {
      maxResults: 20,
      q: "in:inbox newer_than:7d",
    });
    gmailNotificationCache = {
      connected: true,
      email,
      items,
      error: null,
      fetchedAt: Date.now(),
    };
  } catch (e) {
    gmailNotificationCache = {
      connected: true,
      email,
      items: null,
      error: String(e.message || e),
      fetchedAt: Date.now(),
    };
  }
  return gmailNotificationCache;
}

function getNotificationQueueSnapshot() {
  if (gmailNotificationCache.items && gmailNotificationCache.items.length > 0) {
    return gmailNotificationCache.items;
  }
  return getAttentionQueue();
}

function applyNotificationOverrides(item) {
  const o = notificationUserOverrides.get(item.id);
  if (!o) return { ...item, userOverride: false };
  const out = {
    ...item,
    decision: o.decision,
    userOverride: true,
    overrideLabel: o.label || "Manual override",
  };
  // Do not use ?? here: undefined must clear delay/digest when switching decisions (e.g. force show).
  if (Object.prototype.hasOwnProperty.call(o, "delayMinutes")) {
    out.delayMinutes = o.delayMinutes;
  }
  if (o.decision === "summarize_later") {
    out.digestInMinutes = item.digestInMinutes;
  } else {
    out.digestInMinutes = undefined;
  }
  return out;
}

app.get("/api/notifications/dna", async (_req, res) => {
  await refreshGmailNotificationCache();
  const items = getNotificationQueueSnapshot().map(applyNotificationOverrides);
  res.json({
    items,
    failSafeConfidence: FAILSAFE_CONFIDENCE,
    tagline: "We don't just filter notifications — we economically evaluate them.",
    gmail: {
      connected: gmailNotificationCache.connected,
      email: gmailNotificationCache.email,
      fetchedAt: gmailNotificationCache.fetchedAt,
      error: gmailNotificationCache.error,
      source:
        gmailNotificationCache.items && gmailNotificationCache.items.length > 0 ? "gmail" : "demo",
    },
  });
});

app.get("/api/notifications/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const push = async () => {
    await refreshGmailNotificationCache();
    const items = getNotificationQueueSnapshot().map(applyNotificationOverrides);
    const payload = {
      items,
      failSafeConfidence: FAILSAFE_CONFIDENCE,
      tagline: "We don't just filter notifications — we economically evaluate them.",
      gmail: {
        connected: gmailNotificationCache.connected,
        email: gmailNotificationCache.email,
        fetchedAt: gmailNotificationCache.fetchedAt,
        error: gmailNotificationCache.error,
        source:
          gmailNotificationCache.items && gmailNotificationCache.items.length > 0 ? "gmail" : "demo",
      },
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    await push();
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify(String(e.message || e))}\n\n`);
  }

  const interval = setInterval(() => {
    push().catch(() => {});
  }, 30000);

  req.on("close", () => {
    clearInterval(interval);
  });
});

app.post("/api/notifications/action", (req, res) => {
  const id = String(req.body?.id ?? "");
  const action = String(req.body?.action ?? "").toLowerCase();
  if (!id) return res.status(400).json({ error: "id required" });
  const allowed = new Set(["force_show", "delay", "digest", "block_confirm", "reset"]);
  if (!allowed.has(action)) {
    return res.status(400).json({ error: "invalid action" });
  }

  const base = getNotificationQueueSnapshot().find((x) => x.id === id);
  if (!base) return res.status(404).json({ error: "unknown notification id" });

  let patch = { decision: base.decision, delayMinutes: base.delayMinutes, label: "" };
  if (action === "force_show") {
    patch = { decision: "show_now", delayMinutes: undefined, label: "You chose: show now" };
  } else if (action === "delay") {
    patch = {
      decision: "delay",
      delayMinutes: clampNotificationDelay(base.delayMinutes ?? 15),
      label: "You chose: snooze / delay",
    };
  } else if (action === "digest") {
    patch = { decision: "summarize_later", delayMinutes: undefined, label: "You chose: batch to digest" };
  } else if (action === "block_confirm") {
    patch = { decision: "block", delayMinutes: undefined, label: "You confirmed block" };
  } else if (action === "reset") {
    notificationUserOverrides.delete(id);
    notificationActionLog.unshift({
      at: new Date().toISOString(),
      id,
      action: "reset",
      note: "Cleared override — back to engine",
    });
    const cleared = getNotificationQueueSnapshot().find((x) => x.id === id);
    return res.json({ ok: true, item: applyNotificationOverrides(cleared || base) });
  }

  notificationUserOverrides.set(id, patch);
  notificationActionLog.unshift({
    at: new Date().toISOString(),
    id,
    action,
    previousDecision: base.decision,
  });
  const fresh = getNotificationQueueSnapshot().find((x) => x.id === id);
  res.json({ ok: true, item: applyNotificationOverrides(fresh || base) });
});

function clampNotificationDelay(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 15;
  return Math.min(120, Math.max(3, Math.round(x)));
}

app.get("/api/notifications/log", (_req, res) => {
  res.json({ entries: notificationActionLog.slice(0, 50) });
});

app.post("/api/notifications/feedback", (req, res) => {
  const id = String(req.body?.id ?? "");
  const helpful = req.body?.helpful;
  if (!id) return res.status(400).json({ error: "id required" });
  notificationActionLog.unshift({
    at: new Date().toISOString(),
    id,
    action: "feedback",
    helpful: Boolean(helpful),
  });
  res.json({ ok: true, message: "Thanks — this tunes future attention weights (demo log)." });
});

app.get("/api/focus-exit", (_req, res) => {
  res.json({
    summary: "You were in Deep Focus for 52 minutes. Here is what mattered while you were away.",
    missedHighlights: [
      "2 urgent emails flagged by NeuroAgent (HR + client)",
      "Meeting moved to 5:00 PM — conflict with standup",
    ],
    suggestedActions: [
      { label: "Reply to 2 urgent emails", priority: "high" },
      { label: "Propose new slot for 5 PM meeting", priority: "medium" },
      { label: "Archive newsletter batch", priority: "low" },
    ],
  });
});

/** --- Agent queue (in-memory) --- */
function makeAgentId() {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

let agentQueue = [
  {
    id: "a1",
    type: "email_parse",
    description: "Read email from HR → extracted onboarding task → add to calendar next Tuesday 10:00",
    status: "needs_approval",
    result: "Draft event created (pending your OK)",
  },
  {
    id: "a2",
    type: "meeting_invite",
    description: "Invite for Fri 4pm → checked availability → suggest decline + propose Mon 9am",
    status: "running",
  },
  {
    id: "a3",
    type: "slack_draft",
    description: "DM from design: request for specs → drafted concise reply with doc link",
    status: "done",
    result: "Reply copied to clipboard in extension",
  },
];

function publicAction(row) {
  const { _approveOnComplete, ...rest } = row;
  return rest;
}

function resultForAgentType(type) {
  switch (type) {
    case "system_command":
      return "Deep Focus signal sent to extension; non-critical items delayed.";
    case "meeting_invite":
      return "Availability checked — best slot suggested and invite draft saved.";
    case "slack_draft":
      return "Reply drafted and copied to clipboard in extension.";
    case "notification_batch":
      return "Notifications summarized; low-priority items batched.";
    case "email_parse":
      return "Inbox triage complete — calendar draft ready if approval granted.";
    case "agent_task":
      return "Task executed with current context signals.";
    default:
      return "Completed.";
  }
}

function scheduleAgentProgress(row) {
  const id = row.id;
  const approveOnComplete = Boolean(row._approveOnComplete);

  setTimeout(() => {
    const i = agentQueue.findIndex((x) => x.id === id);
    if (i === -1) return;
    if (agentQueue[i].status !== "pending") return;
    agentQueue[i] = { ...agentQueue[i], status: "running" };
  }, 500 + Math.random() * 400);

  setTimeout(() => {
    void (async () => {
      const i = agentQueue.findIndex((x) => x.id === id);
      if (i === -1) return;
      if (agentQueue[i].status !== "running") return;
      const cur = agentQueue[i];
      try {
        if (approveOnComplete) {
          let result = "Draft ready — review and approve to apply.";
          const auth = await getOAuthClientWithRefresh();
          if (auth && cur.type === "email_parse") {
            try {
              const summary = await fetchInboxSummary(auth);
              result = `Connected Gmail snapshot:\n${summary}\n\nApprove to save a Gmail draft with this triage.`;
            } catch (e) {
              result += ` (Gmail read failed: ${e.message})`;
            }
          }
          agentQueue[i] = {
            ...cur,
            status: "needs_approval",
            result,
          };
        } else {
          let result = resultForAgentType(cur.type);
          if (cur.type === "meeting_invite") {
            result =
              "Meeting intent noted — NeuroFocus does not auto-write Calendar. Use Meeting Scheduler on the Agent page to pull your calendar, get suggested times, and confirm before anything is created.";
          }
          agentQueue[i] = {
            ...cur,
            status: "done",
            result,
          };
        }
      } catch (e) {
        agentQueue[i] = {
          ...publicAction(cur),
          status: "done",
          result: `Error: ${e.message}`,
        };
      }
    })();
  }, 2200 + Math.random() * 900);
}

function planUserMessage(text) {
  const t = text.toLowerCase();
  const enqueued = [];

  if ((/^\s*help\s*$/i.test(text) || /what can you do/i.test(t)) && t.length < 160) {
    return {
      reply:
        "Try: Deep Focus · Schedule a meeting Monday 10am · Draft a Slack reply · Summarize notifications · Email/HR triage. I’ll queue steps you can track below.",
      enqueued: [],
    };
  }

  if (/\b(deep\s*focus|focus mode|dnd|do not disturb)\b/.test(t)) {
    enqueued.push({
      id: makeAgentId(),
      type: "system_command",
      description: "Enable Deep Focus and delay non-critical notifications",
      status: "pending",
      _approveOnComplete: false,
      _prompt: text,
    });
    return { reply: "Queued a Deep Focus command for your extension and DNA rules.", enqueued };
  }

  if (
    (/\bsummarize\b/.test(t) && /\bnotification/.test(t)) ||
    /\b(summarize|summary)\b.*\b(notification|ping|slack|inbox)\b|\b(notification|ping)s?\b.*\b(summarize|digest)\b/.test(t)
  ) {
    enqueued.push({
      id: makeAgentId(),
      type: "notification_batch",
      description: "Batch and summarize pending notifications with DNA priorities",
      status: "pending",
      _approveOnComplete: false,
      _prompt: text,
    });
    return { reply: "I’m batching notifications and will surface a digest when the job finishes.", enqueued };
  }

  if (/\b(schedule|calendar|meeting|invite|book)\b/.test(t)) {
    const snippet = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    enqueued.push({
      id: makeAgentId(),
      type: "meeting_invite",
      description: `Parse meeting intent → check availability → draft invite: ${snippet}`,
      status: "pending",
      _approveOnComplete: false,
      _prompt: text,
    });
    return { reply: "Meeting workflow queued — I’ll check availability and draft an invite.", enqueued };
  }

  if (/\b(slack|dm|message)\b/.test(t) && /\b(draft|reply|write)\b/.test(t)) {
    enqueued.push({
      id: makeAgentId(),
      type: "slack_draft",
      description: "Draft a concise Slack reply using open tab and last DM context",
      status: "pending",
      _approveOnComplete: false,
      _prompt: text,
    });
    return { reply: "Slack draft queued — result lands in the extension clipboard when done.", enqueued };
  }

  if (/\b(email|inbox|hr|onboarding)\b/.test(t)) {
    enqueued.push({
      id: makeAgentId(),
      type: "email_parse",
      description: `Triage inbox intent and extract actionable items: ${text.slice(0, 160)}`,
      status: "pending",
      _approveOnComplete: true,
      _prompt: text,
    });
    return { reply: "Email triage queued — sensitive actions will ask for approval before applying.", enqueued };
  }

  if (/\b(slack|dm)\b/.test(t)) {
    enqueued.push({
      id: makeAgentId(),
      type: "slack_draft",
      description: `Draft Slack reply: ${text.slice(0, 160)}`,
      status: "pending",
      _approveOnComplete: false,
      _prompt: text,
    });
    return { reply: "Queued a Slack draft based on your message.", enqueued };
  }

  enqueued.push({
    id: makeAgentId(),
    type: "agent_task",
    description: text.length > 200 ? `${text.slice(0, 197)}…` : text,
    status: "pending",
    _approveOnComplete: false,
    _prompt: text,
  });
  return {
    reply: `Added your request to the agent queue — watch it move from pending → running → done.`,
    enqueued,
  };
}

async function agentLlmReply(userText) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are NeuroFocus Agent: a brief, practical copilot for focus, calendar, email, and Slack. Reply in under 120 words. No markdown code blocks.",
          },
          { role: "user", content: userText },
        ],
        max_tokens: 350,
        temperature: 0.6,
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const out = j.choices?.[0]?.message?.content?.trim();
    return out || null;
  } catch {
    return null;
  }
}

app.get("/api/agent/queue", (_req, res) => {
  res.json({ actions: agentQueue.map(publicAction) });
});

app.post("/api/agent/message", async (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text required" });

  const planned = planUserMessage(text);
  let reply = planned.reply;

  const llm = await agentLlmReply(text);
  if (llm) reply = llm;

  for (const row of planned.enqueued) {
    agentQueue.unshift(row);
    scheduleAgentProgress(row);
  }

  res.json({
    reply,
    enqueued: planned.enqueued.map(publicAction),
  });
});

app.post("/api/agent/approve", async (req, res) => {
  const id = String(req.body?.id ?? "");
  const i = agentQueue.findIndex((a) => a.id === id);
  if (i === -1) return res.status(404).json({ error: "not found" });
  if (agentQueue[i].status !== "needs_approval") {
    return res.status(400).json({ error: "not awaiting approval" });
  }
  const row = agentQueue[i];
  let result = "Approved and applied.";
  const client = await getOAuthClientWithRefresh();
  if (client && row.type === "email_parse") {
    try {
      await createTriageDraft(client, row.result || "");
      result = "Approved. Gmail draft created — open Gmail → Drafts to review and send.";
    } catch (e) {
      result = `Approved (draft failed: ${e.message})`;
    }
  }
  agentQueue[i] = {
    ...publicAction(row),
    status: "done",
    result,
  };
  res.json({ ok: true, action: agentQueue[i] });
});

app.post("/api/agent/reject", (req, res) => {
  const id = String(req.body?.id ?? "");
  const i = agentQueue.findIndex((a) => a.id === id);
  if (i === -1) return res.status(404).json({ error: "not found" });
  if (agentQueue[i].status !== "needs_approval") {
    return res.status(400).json({ error: "not awaiting approval" });
  }
  agentQueue[i] = {
    ...publicAction(agentQueue[i]),
    status: "done",
    result: "Declined — no changes applied.",
  };
  res.json({ ok: true, action: agentQueue[i] });
});

app.post("/api/agent/clear-done", (_req, res) => {
  const before = agentQueue.length;
  agentQueue = agentQueue.filter((a) => a.status !== "done");
  res.json({ ok: true, removed: before - agentQueue.length });
});

app.get("/api/google/status", async (_req, res) => {
  if (!googleOAuthConfigured()) {
    return res.json({ configured: false, connected: false, email: null });
  }
  const email = await getConnectedEmail();
  res.json({ configured: true, connected: Boolean(email), email });
});

app.get("/api/google/preview", async (_req, res) => {
  if (!googleOAuthConfigured()) {
    return res.json({ configured: false, connected: false });
  }
  const auth = await getOAuthClientWithRefresh();
  if (!auth) {
    return res.json({ configured: true, connected: false });
  }
  try {
    const email = await getEmailFromClient(auth);
    const [inboxSummary, upcoming] = await Promise.all([
      fetchInboxSummary(auth),
      listUpcomingEvents(auth, 5),
    ]);
    res.json({
      configured: true,
      connected: true,
      email,
      inboxSummary,
      upcoming,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function tokenExchangeOAuthError(e) {
  const data = e?.response?.data;
  if (data && typeof data === "object" && data.error) {
    return {
      code: String(data.error),
      description: String(data.error_description || ""),
    };
  }
  const msg = String(e?.message || "");
  if (/invalid_client/i.test(msg)) return { code: "invalid_client", description: msg };
  return { code: "", description: msg };
}

app.get("/api/google/oauth-debug", (req, res) => {
  const redirectUri = getRedirectUri();
  const id = getGoogleClientId();
  const secretLen = getGoogleClientSecret().length;
  const allDevRedirects = [
    "http://localhost:5173/api/google/oauth-callback",
    "http://127.0.0.1:5173/api/google/oauth-callback",
    "http://localhost:3847/api/google/oauth-callback",
    "http://127.0.0.1:3847/api/google/oauth-callback",
  ];
  res.json({
    configured: googleOAuthConfigured(),
    redirectUriUsedByApp: redirectUri,
    detectedBrowserOrigin: getBrowserOriginFromRequest(req),
    redirectUriForThisRequest: getRedirectUriForRequest(req),
    redirectUriRule: isGoogleRedirectUriLockedByEnv()
      ? "GOOGLE_REDIRECT_URI is set — register that exact string under Authorized redirect URIs. If you use 127.0.0.1 in the browser but .env has localhost, the server now prefers the browser host for loopback."
      : "GOOGLE_REDIRECT_URI is unset — redirect_uri follows your browser (Vite X-Forwarded-Host / Origin). Register both localhost and 127.0.0.1 redirect URIs in Cloud Console.",
    clientIdSuffix: id.length > 12 ? `…${id.slice(-12)}` : "(short)",
    clientIdLooksLikeOAuthWebClient: id.includes(".apps.googleusercontent.com"),
    clientSecretCharCount: secretLen,
    invalidClientHint:
      "invalid_client means Client ID and Client secret in server/.env must be copied as a pair from the same OAuth 2.0 Client row in Google Cloud (APIs & Services → Credentials). Use type Web application for this server flow.",
    addTheseRedirectUrisInGoogleConsole: [...new Set([redirectUri, redirectUri.replace("localhost", "127.0.0.1"), ...allDevRedirects])],
    authorizedJavaScriptOriginsSuggested: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3847",
    ],
    note: "redirect_uri_mismatch: under Authorized redirect URIs, add every URI your app might send (see redirectUriForThisRequest when opened from the app). Path must be /api/google/oauth-callback.",
  });
});

app.get("/api/google/auth", (req, res) => {
  if (!googleOAuthConfigured()) {
    return res.status(503).json({ error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env" });
  }
  pruneOAuthStates();
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, Date.now());
  const redirectUri = getRedirectUriForRequest(req);
  const client = createOAuthClient(redirectUri);
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
    redirect_uri: redirectUri,
  });
  res.redirect(url);
});

app.get("/api/google/oauth-callback", async (req, res) => {
  let frontend;
  try {
    frontend = getFrontendOriginForRequest(req);
  } catch {
    frontend = "http://localhost:5173";
  }

  try {
    if (req.query.error) {
      const e = encodeURIComponent(String(req.query.error));
      const d = encodeURIComponent(String(req.query.error_description || ""));
      return res.redirect(`${frontend}/agent?google_oauth_error=${e}&google_oauth_desc=${d}`);
    }
    const code = req.query.code;
    const state = req.query.state;
    if (!code || !state || !oauthStates.has(String(state))) {
      return res.redirect(`${frontend}/agent?google=badstate`);
    }
    oauthStates.delete(String(state));
    try {
      const redirectUri = getRedirectUriForRequest(req);
      const client = createOAuthClient(redirectUri);
      const { tokens } = await client.getToken({
        code: String(code),
        redirect_uri: redirectUri,
      });
      client.setCredentials(tokens);
      await verifyAllowedEmail(client);
      saveTokens(tokens);
      return res.redirect(`${frontend}/agent?google=connected`);
    } catch (e) {
      clearTokens();
      const { code: errCode, description } = tokenExchangeOAuthError(e);
      if (errCode === "invalid_client") {
        const d = encodeURIComponent(description || "Check server/.env credentials");
        return res.redirect(`${frontend}/agent?google_oauth_error=invalid_client&google_oauth_desc=${d}`);
      }
      return res.redirect(`${frontend}/agent?google=${encodeURIComponent(String(e.message || errCode || "token_exchange_failed"))}`);
    }
  } catch (e) {
    console.error("[oauth-callback] fatal", e);
    return res.redirect(`${frontend}/agent?google=${encodeURIComponent(String(e?.message || "oauth_callback_failed"))}`);
  }
});

app.post("/api/google/disconnect", (_req, res) => {
  clearTokens();
  res.json({ ok: true });
});

app.get("/api/meeting-scheduler/availability", async (req, res) => {
  const auth = await getOAuthClientWithRefresh();
  if (!auth) return res.status(401).json({ error: "Connect Google first" });
  try {
    pruneMeetingProposals();
    const days = Math.min(14, Math.max(1, Number(req.query.days) || 7));
    const durationMin = Math.min(180, Math.max(15, Number(req.query.durationMin) || 60));
    const out = await computeAvailabilityOnly(auth, { daysAhead: days, durationMinutes: durationMin });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/meeting-scheduler/suggest", async (req, res) => {
  const auth = await getOAuthClientWithRefresh();
  if (!auth) return res.status(401).json({ error: "Connect Google first" });
  try {
    pruneMeetingProposals();
    const durationMinutes = Math.min(180, Math.max(15, Number(req.body?.durationMinutes) || 60));
    const daysAhead = Math.min(14, Math.max(1, Number(req.body?.daysAhead) || 7));
    const title = String(req.body?.title || "Meeting").trim().slice(0, 120) || "Meeting";
    const plan = await computeMeetingPlan(auth, { daysAhead, durationMinutes, title });
    const proposalId = makeMeetingProposalId();
    meetingProposals.set(proposalId, {
      createdAt: Date.now(),
      title,
      suggestions: plan.suggestions,
    });
    res.json({
      proposalId,
      policy: "Calendar is never written until you confirm a slot below.",
      timeZone: plan.timeZone,
      range: plan.range,
      busy: plan.busy,
      suggestions: plan.suggestions,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/meeting-scheduler/confirm", async (req, res) => {
  const auth = await getOAuthClientWithRefresh();
  if (!auth) return res.status(401).json({ error: "Connect Google first" });
  const proposalId = String(req.body?.proposalId || "");
  const slotIndex = Number(req.body?.slotIndex);
  pruneMeetingProposals();
  const p = meetingProposals.get(proposalId);
  if (!p || !Array.isArray(p.suggestions) || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= p.suggestions.length) {
    return res.status(400).json({ error: "Invalid or expired proposal — run Suggest times again." });
  }
  const slot = p.suggestions[slotIndex];
  try {
    const r = await createCalendarEventAt(auth, {
      summary: p.title,
      start: slot.start,
      end: slot.end,
      description: `NeuroFocus Meeting Scheduler\n\n${slot.reason || ""}`,
    });
    meetingProposals.delete(proposalId);
    res.json({ ok: true, htmlLink: r.htmlLink, eventId: r.id });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/email-automation/inbox", async (req, res) => {
  const auth = await getOAuthClientWithRefresh();
  if (!auth) return res.status(401).json({ error: "Connect Google first" });
  try {
    const q = String(req.query.q || "is:unread");
    const maxResults = Math.min(50, Math.max(1, Number(req.query.maxResults) || 5));
    const messages = await listInboxMessages(auth, { maxResults, q });
    res.json({ messages, query: q, maxResults });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/email-automation/analyze", async (req, res) => {
  const messageId = String(req.body?.messageId ?? "");
  if (!messageId) return res.status(400).json({ error: "messageId required" });
  const auth = await getOAuthClientWithRefresh();
  if (!auth) return res.status(401).json({ error: "Connect Google first" });
  try {
    const full = await getMessageFull(auth, messageId);
    const extraction = await extractTasksFromEmail(full.subject, full.body, full.from);
    const session = createSession({
      messageId: full.id,
      threadId: full.threadId,
      subject: full.subject,
      from: full.from,
      body: full.body,
      messageIdHeader: full.messageIdHeader,
      extraction,
    });
    res.json({
      sessionId: session.id,
      extraction,
      meta: {
        subject: full.subject,
        from: full.from,
        snippet: full.snippet,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/email-automation/preview", async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? "");
  const tone = String(req.body?.tone ?? "formal");
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  const s = getSession(sessionId);
  if (!s) return res.status(404).json({ error: "Session expired — analyze an email again" });
  const validTones = ["formal", "friendly", "short"];
  const t = validTones.includes(tone) ? tone : "formal";
  try {
    const draftText = await draftReplyEmail(s.body, s.extraction, t, s.subject);
    const { confidence, reason } = await evaluateDraftConfidence(draftText, s.extraction, s.body);
    updateSession(sessionId, { tone: t, draftText, confidence, confidenceReason: reason });
    res.json({ draftText, confidence, confidenceReason: reason });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/email-automation/approve", async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? "");
  const draftBody = String(req.body?.body ?? "").trim();
  const force = Boolean(req.body?.force);
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  const s = getSession(sessionId);
  if (!s) return res.status(404).json({ error: "Session expired" });
  const text = draftBody || (s.draftText || "").trim();
  if (!text) return res.status(400).json({ error: "Empty draft" });

  const conf = s.confidence ?? 50;
  if (conf < 40 && !force) {
    return res.status(422).json({
      error: "low_confidence",
      confidence: conf,
      message: "Confidence below 40%. Edit the draft or check “Force send anyway”.",
    });
  }

  const auth = await getOAuthClientWithRefresh();
  if (!auth) return res.status(401).json({ error: "Connect Google first" });

  const to = parseEmailAddress(s.from);
  const safe = isEmailSafeMode();

  const envDelay = Number(process.env.EMAIL_SEND_DELAY_MS || 0);
  const bodyDelay = req.body?.delayMs;
  const delayMs =
    bodyDelay !== undefined && bodyDelay !== null && String(bodyDelay) !== ""
      ? Math.min(120000, Math.max(0, Number(bodyDelay)))
      : envDelay;

  function sentUndoPayload(sent) {
    return {
      type: "sent",
      messageId: sent.messageId,
      threadId: s.threadId,
      to,
      subject: s.subject,
      inReplyTo: s.messageIdHeader,
      references: s.messageIdHeader,
    };
  }

  try {
    if (safe) {
      const r = await createReplyDraft(auth, {
        to,
        subject: s.subject,
        threadId: s.threadId,
        body: text,
        inReplyTo: s.messageIdHeader,
        references: s.messageIdHeader,
      });
      setLastUndo({ type: "draft", draftId: r.draftId });
      deleteSession(sessionId);
      return res.json({
        ok: true,
        mode: "draft",
        draftId: r.draftId,
        message: "Safe mode: saved as Gmail draft only (nothing sent).",
      });
    }

    if (delayMs > 0) {
      const prev = pendingEmailSends.get(sessionId);
      if (prev) clearTimeout(prev);
      updateSession(sessionId, { pendingSendBody: text });
      const timeoutId = setTimeout(async () => {
        pendingEmailSends.delete(sessionId);
        try {
          const a = await getOAuthClientWithRefresh();
          if (!a) return;
          const s2 = getSession(sessionId);
          if (!s2) return;
          const bodyText = (s2.pendingSendBody || s2.draftText || "").trim();
          if (!bodyText) return;
          const to2 = parseEmailAddress(s2.from);
          const sent = await sendReplyMessage(a, {
            to: to2,
            subject: s2.subject,
            threadId: s2.threadId,
            body: bodyText,
            inReplyTo: s2.messageIdHeader,
            references: s2.messageIdHeader,
          });
          setLastUndo({
            type: "sent",
            messageId: sent.messageId,
            threadId: s2.threadId,
            to: to2,
            subject: s2.subject,
            inReplyTo: s2.messageIdHeader,
            references: s2.messageIdHeader,
          });
          deleteSession(sessionId);
        } catch (e) {
          console.error("Scheduled send failed:", e);
        }
      }, delayMs);
      pendingEmailSends.set(sessionId, timeoutId);
      return res.json({
        ok: true,
        mode: "scheduled",
        delayMs,
        sessionId,
        message: `Send scheduled in ${Math.round(delayMs / 1000)}s — cancel before it fires.`,
      });
    }

    const sent = await sendReplyMessage(auth, {
      to,
      subject: s.subject,
      threadId: s.threadId,
      body: text,
      inReplyTo: s.messageIdHeader,
      references: s.messageIdHeader,
    });
    setLastUndo(sentUndoPayload(sent));
    deleteSession(sessionId);
    return res.json({
      ok: true,
      mode: "sent",
      messageId: sent.messageId,
      message: "Reply sent via Gmail.",
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/email-automation/cancel-scheduled", (req, res) => {
  const sessionId = String(req.body?.sessionId ?? "");
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  const tid = pendingEmailSends.get(sessionId);
  if (!tid) return res.status(404).json({ error: "No pending send for this session" });
  clearTimeout(tid);
  pendingEmailSends.delete(sessionId);
  res.json({ ok: true, message: "Scheduled send cancelled." });
});

app.post("/api/email-automation/reject", (req, res) => {
  const sessionId = String(req.body?.sessionId ?? "");
  if (sessionId) {
    const tid = pendingEmailSends.get(sessionId);
    if (tid) {
      clearTimeout(tid);
      pendingEmailSends.delete(sessionId);
    }
    deleteSession(sessionId);
  }
  res.json({ ok: true });
});

app.post("/api/email-automation/undo", async (_req, res) => {
  const auth = await getOAuthClientWithRefresh();
  if (!auth) return res.status(401).json({ error: "Connect Google first" });
  const u = getLastUndo();
  if (!u) return res.status(400).json({ error: "Nothing to undo" });
  try {
    if (u.type === "draft" && u.draftId) {
      await deleteDraft(auth, u.draftId);
    } else if (u.type === "sent" && u.messageId) {
      try {
        await trashMessage(auth, u.messageId);
      } catch (trashErr) {
        if (u.threadId && u.to) {
          await sendCorrectionNotice(auth, {
            to: u.to,
            subject: u.subject,
            threadId: u.threadId,
            inReplyTo: u.inReplyTo,
            references: u.references,
          });
          clearLastUndo();
          return res.json({
            ok: true,
            undone: "correction",
            message: "Could not trash sent mail — sent correction notice in thread.",
          });
        }
        throw trashErr;
      }
    }
    clearLastUndo();
    res.json({ ok: true, undone: u.type });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/email-automation/settings", (_req, res) => {
  const d = Number(process.env.EMAIL_SEND_DELAY_MS || 0);
  res.json({
    safeMode: isEmailSafeMode(),
    openai: Boolean(process.env.OPENAI_API_KEY),
    defaultSendDelayMs: Number.isFinite(d) ? d : 0,
    suggestedDelayMs: 8000,
    inboxQueryDefault: "is:unread",
    inboxMaxDefault: 5,
  });
});

app.get("/api/flows", (_req, res) => {
  res.json({
    flows: [
      {
        id: "f1",
        name: "HR email → important → after meeting",
        enabled: true,
        from: "NeuroFocus Automations <flows@neurofocus.local>",
        to: "You <inbox@workspace.local>",
        subject: "Active flow: HR messages & meeting-aware delivery",
        date: "Sat, Mar 28, 2026, 9:41 AM",
        preview:
          "When email arrives from your HR domain, we elevate priority, pause noisy alerts during meetings, and recap when you exit focus…",
        greeting: "Hi there,",
        bodyIntro:
          "This message describes an automation that is currently **enabled** on your account. It runs in the background and only acts when the conditions below are true — similar to inbox rules, but aware of your calendar and NeuroScore so HR messages don’t derail deep work.",
        steps: [
          {
            id: "s1",
            condition: "Email from HR domain",
            action: "Mark important + tag #people",
            detail:
              "Any message whose sender matches your company’s HR mail domains is flagged as people-critical. We star it in your mail provider (when connected), sync the tag #people to NeuroFocus, and raise sender-importance in Notification DNA so it competes fairly against other urgent items.",
          },
          {
            id: "s2",
            condition: "User in meeting (calendar)",
            action: "Hold notification until meeting ends",
            detail:
              "If your calendar shows you in a meeting, non-critical banners and sounds are suppressed for this thread. The item stays in a “held” queue with a short summary so nothing is lost — you’ll see a gentle digest when the event ends or if the model detects a true emergency.",
          },
          {
            id: "s3",
            condition: "Focus exit",
            action: "Surface summary + one-tap reply drafts",
            detail:
              "When you leave Deep Focus or your predicted task window completes, we send a compact recap: who emailed, what they need, and 1–2 reply drafts generated by NeuroAgent. You can approve, edit, or snooze in one tap from the extension popup or this dashboard.",
          },
        ],
        closing:
          "You can disable this flow anytime from Flows settings. Replies to this notice are not monitored — configure alerts in the app.",
        tag: "Automation active",
      },
      {
        id: "f2",
        name: "Deep work shield",
        enabled: true,
        from: "NeuroFocus Shield <shield@neurofocus.local>",
        to: "You <inbox@workspace.local>",
        subject: "Active flow: Deep work shield & interruption batching",
        date: "Sat, Mar 28, 2026, 8:15 AM",
        preview:
          "When your focus score drops or you’re near the end of a task block, we tighten the notification gate and batch lower-priority items…",
        greeting: "Hello,",
        bodyIntro:
          "The **Deep work shield** flow protects concentration by combining live NeuroScore with attention timeline predictions. It does not block everything — it re-ranks and delays so only high-DNA items break through.",
        steps: [
          {
            id: "s1",
            condition: "NeuroScore focus < 45",
            action: "Enable Deep Focus; DNA delays non-critical",
            detail:
              "When measured focus falls below 45 (from tab churn, short dwell, or rapid context switching), we suggest or auto-enable Deep Focus mode in the extension. Notification DNA then applies stricter thresholds: low-urgency items are delayed 15–45 minutes by default, unless sender-importance overrides.",
          },
          {
            id: "s2",
            condition: "Predicted task end < 10 min",
            action: "Queue interruptions for batch",
            detail:
              "If our model estimates you’ll finish the current task in under ten minutes, we avoid mid-task pings. Eligible notifications are grouped into a single “batch card” delivered at the predicted break — with optional voice command “Summarize notifications” to hear the gist hands-free.",
          },
        ],
        closing:
          "Shield rules learn from what you actually open vs dismiss (self-learning brain). Adjust sensitivity under Analytics → preferences.",
        tag: "Protection on",
      },
    ],
  });
});

function getDnaActionCountsForAnalytics() {
  let delayed = 0;
  let batched = 0;
  let shown = 0;
  for (const e of notificationActionLog) {
    const a = e.action;
    if (a === "delay") delayed += 1;
    else if (a === "digest") batched += 1;
    else if (a === "force_show" || a === "block_confirm") shown += 1;
  }
  return { delayed, batched, shown };
}

function getAnalyticsResponseBody(weekOffset = 0) {
  const gmailCount = gmailNotificationCache.items?.length ?? 0;
  return buildAnalyticsPayload(getDnaActionCountsForAnalytics(), { gmailCount, weekOffset });
}

app.get("/api/analytics", (req, res) => {
  const weekOffset = parseInt(String(req.query.weekOffset ?? "0"), 10) || 0;
  res.json(getAnalyticsResponseBody(weekOffset));
});

app.get("/api/analytics/stream", (req, res) => {
  const weekOffset = parseInt(String(req.query.weekOffset ?? "0"), 10) || 0;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const push = () => {
    res.write(`data: ${JSON.stringify(getAnalyticsResponseBody(weekOffset))}\n\n`);
  };
  push();
  const interval = setInterval(push, 4000);
  req.on("close", () => clearInterval(interval));
});

app.post("/api/voice-command", (req, res) => {
  const text = String(req.body?.text ?? "").toLowerCase();
  let interpreted = "General query";
  const actions = [];

  if (/focus|deep/.test(text)) {
    interpreted = "Toggle Deep Focus mode";
    actions.push("extension.enableDeepFocus()", "api.delayNonCritical()");
  } else if (/summarize|summary/.test(text)) {
    interpreted = "Summarize pending notifications";
    actions.push("dna.batchSummarize()", "dashboard.openSummary()");
  } else if (/later|snooze|hold/.test(text)) {
    interpreted = "Defer interruptions";
    actions.push("dna.snoozeAll(15)", "notify.user('Paused 15m')");
  } else {
    interpreted = "Route to LLM planner (OpenAI/Gemini)";
    actions.push("llm.planIntent()", "agent.enqueue()");
  }

  res.json({ interpreted, actions });
});

app.post("/api/context/refresh", (_req, res) => {
  res.json({ ok: true, ...getDashboardPayload() });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "neurofocus-api" });
});

/** Decision Override Engine — rules + apply + learn from repeated overrides */
app.get("/api/overrides/rules", (_req, res) => {
  res.json({ override_rules: overrideRules });
});

app.post("/api/overrides/rules", (req, res) => {
  const body = req.body || {};
  const { condition, action, priority, delayMinutes } = body;
  if (!condition || typeof condition !== "object" || !action) {
    return res.status(400).json({ error: "condition (object) and action are required" });
  }
  const row = {
    id: makeOverrideRuleId(),
    condition,
    action,
    priority: priority || "medium",
    delayMinutes: delayMinutes != null ? Number(delayMinutes) : undefined,
    learned: false,
  };
  overrideRules.push(row);
  res.json({ ok: true, rule: row });
});

app.delete("/api/overrides/rules/:id", (req, res) => {
  const before = overrideRules.length;
  overrideRules = overrideRules.filter((r) => r.id !== req.params.id);
  res.json({ ok: overrideRules.length < before });
});

app.post("/api/overrides/apply", (req, res) => {
  const body = req.body || {};
  const aiDecision = body.ai_decision || body.aiDecision;
  const context = body.context || {};
  if (!aiDecision || typeof aiDecision.decision !== "string") {
    return res.status(400).json({ error: "ai_decision.decision (string) is required" });
  }
  const result = applyOverrideEngine(aiDecision, context, overrideRules);
  res.json(result);
});

/** Priority Intelligence — scoring, attention cost, recommended_action */
app.get("/api/priority/preferences", (_req, res) => {
  res.json({ preferences: priorityPreferences });
});

app.post("/api/priority/preferences", (req, res) => {
  priorityPreferences = defaultPreferences({ ...priorityPreferences, ...(req.body || {}) });
  res.json({ ok: true, preferences: priorityPreferences });
});

app.post("/api/priority/analyze", (req, res) => {
  try {
    const body = req.body || {};
    const prefs = body.preferences ? defaultPreferences(body.preferences) : priorityPreferences;
    const out = analyzePriority(body, prefs);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

/** Cognitive Transparency — explain decisions + what-if alternatives */
app.post("/api/explainability/analyze", (req, res) => {
  try {
    const out = analyzeExplainability(req.body || {});
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.post("/api/overrides/learn", (req, res) => {
  const { sender, action, context } = req.body || {};
  if (!sender || !action) {
    return res.status(400).json({ error: "sender and action are required" });
  }
  const key = `${String(sender).toLowerCase()}|${String(action)}`;
  const n = (overrideLearnCounts.get(key) || 0) + 1;
  overrideLearnCounts.set(key, n);
  const rule = {
    id: makeOverrideRuleId(),
    condition: { sender: String(sender), context: context || "any" },
    action: String(action),
    priority: "high",
    learned: true,
    reinforcementCount: n,
  };
  overrideRules.push(rule);
  res.json({
    ok: true,
    rule,
    reinforcementCount: n,
    message:
      n >= 2
        ? "Pattern reinforced — similar overrides will reuse this rule."
        : "Captured from your manual override; repeat similar overrides to reinforce.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NeuroFocus API http://127.0.0.1:${PORT} (and http://localhost:${PORT})`);
});
