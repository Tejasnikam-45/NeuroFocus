import { google } from "googleapis";
import { parse } from "chrono-node";

export function getTimezone() {
  return process.env.GOOGLE_TIMEZONE || "Asia/Kolkata";
}

export async function fetchInboxSummary(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 8,
    q: "in:inbox",
  });
  const ids = res.data.messages || [];
  if (ids.length === 0) return "Inbox is empty.";

  const lines = [];
  for (const m of ids.slice(0, 7)) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: m.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });
    const headers = full.data.payload?.headers || [];
    const subj = headers.find((h) => h.name === "Subject")?.value || "(no subject)";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const shortFrom = from.replace(/<.*>/, "").trim() || from.slice(0, 48);
    lines.push(`• ${subj} — ${shortFrom}`);
  }
  return lines.join("\n");
}

function extractMeetingTitle(text) {
  const stripped = text.replace(/\b(schedule|book|a|the|meeting|calendar|invite|for|on)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (stripped.length > 2 && stripped.length < 90) return stripped.slice(0, 80);
  return "NeuroFocus meeting";
}

export async function createCalendarEventFromPrompt(auth, promptText) {
  const tz = getTimezone();
  const ref = new Date();
  const results = parse(promptText, ref, { forwardDate: true });

  let start;
  let end;
  if (results.length && results[0].start) {
    start = results[0].start.date();
    end = results[0].end ? results[0].end.date() : new Date(start.getTime() + 60 * 60 * 1000);
  } else {
    start = new Date(ref);
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  const summary = extractMeetingTitle(promptText);
  const calendar = google.calendar({ version: "v3", auth });
  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description: `Created by NeuroFocus Agent.\n\nOriginal request:\n${promptText}`,
      start: { dateTime: start.toISOString(), timeZone: tz },
      end: { dateTime: end.toISOString(), timeZone: tz },
    },
  });

  const link = event.data.htmlLink ? ` Open: ${event.data.htmlLink}` : "";
  return {
    message: `Google Calendar: “${summary}” — ${start.toLocaleString()} → ${end.toLocaleString()}.${link}`,
    htmlLink: event.data.htmlLink,
  };
}

export async function createTriageDraft(auth, bodyText) {
  const oauth2 = google.oauth2({ version: "v2", auth });
  const { data: me } = await oauth2.userinfo.get();
  const to = me.email || "me";

  const subject = "NeuroFocus — inbox triage";
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    typeof bodyText === "string" ? bodyText : JSON.stringify(bodyText),
  ];
  const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");

  const gmail = google.gmail({ version: "v1", auth });
  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });
  return draft.data.id || "draft";
}

export async function createCalendarEventAt(auth, { summary, start, end, description }) {
  const calendar = google.calendar({ version: "v3", auth });
  const tz = getTimezone();
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description: description || "Created by NeuroFocus Meeting Scheduler (user confirmed).",
      start: { dateTime: new Date(start).toISOString(), timeZone: tz },
      end: { dateTime: new Date(end).toISOString(), timeZone: tz },
    },
  });
  return { htmlLink: res.data.htmlLink, id: res.data.id };
}

export async function listUpcomingEvents(auth, max = 5) {
  const calendar = google.calendar({ version: "v3", auth });
  const tz = getTimezone();
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: max,
    singleEvents: true,
    orderBy: "startTime",
    timeZone: tz,
  });
  const items = res.data.items || [];
  return items.map((ev) => ({
    id: ev.id,
    summary: ev.summary || "(no title)",
    start: ev.start?.dateTime || ev.start?.date || "",
    htmlLink: ev.htmlLink,
  }));
}
