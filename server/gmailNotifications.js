/**
 * Map Gmail list rows → Attention Market raw scores → enriched notifications.
 */

import { listInboxMessages } from "./emailAutomation.js";
import { enrichNotification } from "./attentionMarket.js";

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** Infer DNA-style scores from subject, snippet, and From (no extra Gmail API calls). */
export function gmailRowToRaw(msg) {
  const subj = String(msg.subject || "(no subject)").trim();
  const snippet = String(msg.snippet || "").trim();
  const from = String(msg.from || "").trim();
  const blob = `${subj} ${snippet} ${from}`.toLowerCase();

  let urgency = 38;
  let relevance = 52;
  const interruptionCost = clamp(48 + Math.min(22, Math.floor(snippet.length / 80)), 28, 92);
  let senderImportance = 48;

  if (/\b(urgent|asap|immediately|immediate|critical|p0|sev[12]|action required|deadline|eod|cob|asap)\b/i.test(blob)) {
    urgency += 42;
  }
  if (/\b(meeting|calendar|invitation|zoom|teams|google calendar)\b/i.test(blob)) {
    relevance += 24;
    urgency += 14;
  }
  if (/\b(hr|legal|payroll|invoice|contract|ceo|exec)\b/i.test(blob)) {
    senderImportance += 32;
    relevance += 12;
  }
  if (/\b(newsletter|noreply|no-reply|unsubscribe|digest|promo|marketing|mailer)\b/i.test(blob)) {
    relevance -= 34;
    urgency -= 22;
    senderImportance -= 28;
  }
  if (/\b(fyi|for your information|cc:)\b/i.test(blob)) urgency -= 10;

  return {
    id: `gmail:${msg.id}`,
    channel: "gmail",
    title: subj.length > 140 ? `${subj.slice(0, 137)}…` : subj,
    summary: snippet ? snippet.slice(0, 280) + (snippet.length > 280 ? "…" : "") : undefined,
    urgency: clamp(urgency, 5, 100),
    relevance: clamp(relevance, 5, 100),
    interruptionCost,
    senderImportance: clamp(senderImportance, 5, 100),
  };
}

/**
 * @param {import("google-auth-library").OAuth2Client} auth
 * @param {{ maxResults?: number; q?: string }} [opts]
 */
export async function fetchEnrichedGmailNotifications(auth, opts = {}) {
  const maxResults = opts.maxResults ?? 20;
  const q = opts.q ?? "in:inbox newer_than:7d";
  const rows = await listInboxMessages(auth, { maxResults, q });
  return rows.map((row) => enrichNotification(gmailRowToRaw(row)));
}
