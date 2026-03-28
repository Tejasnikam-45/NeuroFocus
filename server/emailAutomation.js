import crypto from "crypto";
import { google } from "googleapis";

const sessions = new Map();
const SESSION_TTL_MS = 60 * 60 * 1000;

/** @type {{ type: 'draft' | 'sent'; draftId?: string; messageId?: string } | null } */
let lastUndo = null;

function pruneSessions() {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

function safeMode() {
  return String(process.env.EMAIL_SAFE_MODE || "").toLowerCase() === "true" || process.env.EMAIL_SAFE_MODE === "1";
}

export function getLastUndo() {
  return lastUndo;
}

export function clearLastUndo() {
  lastUndo = null;
}

export function isEmailSafeMode() {
  return safeMode();
}

export function setLastUndo(entry) {
  lastUndo = entry;
}

function extractPlainBody(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    try {
      return Buffer.from(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    } catch {
      return "";
    }
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      const t = extractPlainBody(p);
      if (t) return t;
    }
  }
  return "";
}

function headerMap(headers) {
  const m = {};
  for (const h of headers || []) {
    m[h.name.toLowerCase()] = h.value;
  }
  return m;
}

export async function listInboxMessages(auth, { maxResults = 15, q = "in:inbox" } = {}) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q,
  });
  const messages = res.data.messages || [];
  const out = [];
  for (const msg of messages) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });
    const headers = full.data.payload?.headers || [];
    const h = headerMap(headers);
    out.push({
      id: msg.id,
      threadId: full.data.threadId,
      snippet: full.data.snippet || "",
      subject: h.subject || "(no subject)",
      from: h.from || "",
      date: h.date || "",
    });
  }
  return out;
}

export function normalizeEmailBody(raw) {
  if (!raw) return "";
  let t = raw;
  if (/<[a-z][\s\S]*>/i.test(t)) {
    t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
    t = t.replace(/<[^>]+>/g, " ");
  }
  return t.replace(/\s+/g, " ").trim();
}

export async function getMessageFull(auth, messageId) {
  const gmail = google.gmail({ version: "v1", auth });
  const full = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });
  const payload = full.data.payload;
  const headers = headerMap(payload?.headers);
  const rawBody = extractPlainBody(payload) || full.data.snippet || "";
  const body = normalizeEmailBody(rawBody);
  return {
    id: full.data.id,
    threadId: full.data.threadId,
    snippet: full.data.snippet || "",
    subject: headers.subject || "(no subject)",
    from: headers.from || "",
    to: headers.to || "",
    date: headers.date || "",
    messageIdHeader: headers["message-id"] || "",
    body,
  };
}

async function openaiJson(messages, maxTokens = 800) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const text = j.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function openaiText(messages, maxTokens = 1200) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.5,
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || null;
}

export async function extractTasksFromEmail(subject, body, fromLine) {
  const cleanBody = normalizeEmailBody(body) || body;
  const fallback = {
    tasks: [
      {
        task: "Review and respond to this email",
        deadline: "unspecified",
        priority: "medium",
        requires_response: true,
      },
    ],
    summary: cleanBody.slice(0, 280) + (cleanBody.length > 280 ? "…" : ""),
  };

  const parsed = await openaiJson(
    [
      {
        role: "system",
        content:
          "You are an intelligent assistant that extracts actionable tasks from email content. Input is cleaned plain text. Return only valid JSON.",
      },
      {
        role: "user",
        content: `You are an intelligent assistant that extracts actionable tasks.\n\nSubject: ${subject}\nFrom: ${fromLine}\nBody (clean text):\n${cleanBody.slice(0, 12000)}\n\nReturn JSON only:\n{\n  "tasks": [\n    {\n      "task": "",\n      "deadline": "",\n      "priority": "low|medium|high",\n      "requires_response": true\n    }\n  ],\n  "summary": ""\n}`,
      },
    ],
    900
  );

  if (!parsed || !Array.isArray(parsed.tasks)) return fallback;
  return {
    tasks: parsed.tasks.map((t) => ({
      task: String(t.task || "").slice(0, 500),
      deadline: String(t.deadline || "unspecified").slice(0, 120),
      priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
      requires_response: Boolean(t.requires_response),
    })),
    summary: String(parsed.summary || "").slice(0, 800) || fallback.summary,
  };
}

const TONE_HINTS = {
  formal: "Use formal, professional language. Full sentences.",
  friendly: "Warm and approachable but still workplace-appropriate.",
  short: "Be extremely brief (3–6 sentences max). No fluff.",
};

export async function draftReplyEmail(emailBody, extraction, tone, subject) {
  const hint = TONE_HINTS[tone] || TONE_HINTS.formal;
  const ctx = JSON.stringify(extraction, null, 2);
  const clean = normalizeEmailBody(emailBody) || emailBody;

  const text = await openaiText(
    [
      {
        role: "system",
        content:
          "You are drafting an email reply. Return only the reply body text (no subject). Be clear and concise. No markdown fences.",
      },
      {
        role: "user",
        content: `Draft a reply.\n\nEmail (clean text):\n${clean.slice(0, 10000)}\n\nTone: ${tone}. ${hint}\n\nExtracted tasks (JSON):\n${ctx}\n\nSubject (context): ${subject}\n\nReturn only the reply text.`,
      },
    ],
    1200
  );

  if (text) return text;

  const sum = extraction.summary || "";
  return `Hi,\n\nThanks for your email. I've noted the following: ${sum.slice(0, 200)}\n\nI'll follow up shortly.\n\nBest regards`;
}

export async function evaluateDraftConfidence(draftText, extraction, emailBody) {
  const fallback = { confidence: 72, reason: "Heuristic baseline (no LLM confidence)." };

  const parsed = await openaiJson(
    [
      {
        role: "system",
        content:
          'Evaluate confidence of the email reply. Return JSON only: {"confidence": number 0-100, "reason": string}',
      },
      {
        role: "user",
        content: `Criteria: completeness, clarity, relevance to the original email.\n\nOriginal email excerpt:\n${emailBody.slice(0, 4000)}\n\nExtracted tasks:\n${JSON.stringify(extraction?.tasks || [])}\n\nDraft reply:\n${draftText.slice(0, 8000)}`,
      },
    ],
    400
  );

  let c = typeof parsed?.confidence === "number" ? parsed.confidence : 70;
  let reason = String(parsed?.reason || fallback.reason);

  if (!/\b(thank|thanks)\b/i.test(draftText)) {
    c = Math.max(0, c - 10);
    reason += " · Rule: no thank/thanks phrasing (−10)";
  }
  if (draftText.length < 50) {
    c = Math.max(0, c - 15);
    reason += " · Rule: reply under 50 chars (−15)";
  } else if (draftText.length < 60) {
    c = Math.max(0, c - 5);
    reason += " · Rule: reply quite short (−5)";
  }

  if (!extraction?.tasks?.length) {
    c = Math.min(c, 52);
    reason += " · No structured tasks";
  }
  if (/\b(tbd|unsure|maybe|unclear)\b/i.test(draftText)) {
    c = Math.min(c, 42);
    reason += " · Ambiguous phrasing";
  }
  if (!emailBody || emailBody.length < 20) {
    c = Math.min(c, 45);
    reason += " · Thin original content";
  }

  return {
    confidence: Math.max(0, Math.min(100, Math.round(c))),
    reason: reason.trim(),
  };
}

function parseEmailAddress(fromHeader) {
  const m = fromHeader?.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  return (fromHeader || "").split(",")[0].trim();
}

function buildMimeReply({ fromMe, toAddr, subject, inReplyTo, references, body }) {
  const subj = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  const lines = [
    `From: ${fromMe}`,
    `To: ${toAddr}`,
    `Subject: ${subj}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push("", body);
  return lines.join("\r\n");
}

export async function createReplyDraft(auth, { to, subject, threadId, body, inReplyTo, references }) {
  const oauth2 = google.oauth2({ version: "v2", auth });
  const { data: me } = await oauth2.userinfo.get();
  const fromMe = me.email || "me";
  const mime = buildMimeReply({ fromMe, toAddr: to, subject, inReplyTo, references, body });
  const raw = Buffer.from(mime, "utf8").toString("base64url");
  const gmail = google.gmail({ version: "v1", auth });
  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw, threadId },
    },
  });
  return { draftId: draft.data.id, messageId: draft.data.message?.id };
}

export async function sendReplyMessage(auth, { to, subject, threadId, body, inReplyTo, references }) {
  const oauth2 = google.oauth2({ version: "v2", auth });
  const { data: me } = await oauth2.userinfo.get();
  const fromMe = me.email || "me";
  const mime = buildMimeReply({ fromMe, toAddr: to, subject, inReplyTo, references, body });
  const raw = Buffer.from(mime, "utf8").toString("base64url");
  const gmail = google.gmail({ version: "v1", auth });
  const sent = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId,
    },
  });
  return { messageId: sent.data.id, threadId: sent.data.threadId };
}

export async function sendCorrectionNotice(auth, { to, subject, threadId, inReplyTo, references }) {
  const body =
    "Correction: Please disregard my previous message in this thread. I will follow up with a corrected response shortly.";
  return sendReplyMessage(auth, { to, subject, threadId, body, inReplyTo, references });
}

export async function deleteDraft(auth, draftId) {
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.drafts.delete({ userId: "me", id: draftId });
}

export async function trashMessage(auth, messageId) {
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.messages.trash({ userId: "me", id: messageId });
}

export function createSession(meta) {
  pruneSessions();
  const id = crypto.randomUUID();
  const session = {
    id,
    createdAt: Date.now(),
    ...meta,
    tone: null,
    draftText: null,
    confidence: null,
    confidenceReason: null,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(sessionId) {
  pruneSessions();
  return sessions.get(sessionId) || null;
}

export function updateSession(sessionId, patch) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  Object.assign(s, patch);
  return s;
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

export { parseEmailAddress };
