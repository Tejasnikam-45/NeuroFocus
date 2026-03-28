import { google } from "googleapis";
import { getTimezone } from "./googleAgent.js";

const FOCUS_BLOCKS_HOURS = [
  [9, 11],
  [14, 16],
];

function hourInTimeZone(date, timeZone) {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const part = h.find((p) => p.type === "hour");
  return part ? parseInt(part.value, 10) : 0;
}

function getWorkHours() {
  const start = Number(process.env.MEETING_WORK_START_HOUR) || 9;
  const end = Number(process.env.MEETING_WORK_END_HOUR) || 18;
  return { start, end };
}

/**
 * @param {import("google-auth-library").OAuth2Client} auth
 */
export async function fetchCalendarEventsInRange(auth, timeMin, timeMax) {
  const calendar = google.calendar({ version: "v3", auth });
  const tz = getTimezone();
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    timeZone: tz,
    maxResults: 250,
  });
  return res.data.items || [];
}

export function eventToBusy(ev) {
  const s = ev.start?.dateTime || ev.start?.date;
  const e = ev.end?.dateTime || ev.end?.date;
  if (!s || !e) return null;
  const start = new Date(s);
  let end = new Date(e);
  if (!ev.start?.dateTime && ev.start?.date) {
    end = new Date(ev.end?.date || ev.start.date);
    end.setMilliseconds(end.getMilliseconds() - 1);
  }
  return {
    start,
    end,
    summary: ev.summary || "(busy)",
    id: ev.id,
  };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function slotOverlapsFocus(start, end, timeZone) {
  const sh = hourInTimeZone(start, timeZone);
  const eh = hourInTimeZone(end, timeZone);
  for (const [fs, fe] of FOCUS_BLOCKS_HOURS) {
    if (sh < fe && eh > fs) return true;
  }
  return false;
}

/**
 * Generate candidate free slots in [timeMin, timeMax], duration in ms, step 30 min.
 */
export function findCandidateSlots({
  timeMin,
  timeMax,
  busy,
  durationMs,
  timeZone,
  stepMs = 30 * 60 * 1000,
}) {
  const { start: workStartH, end: workEndH } = getWorkHours();
  const candidates = [];
  let t = Math.ceil(timeMin.getTime() / stepMs) * stepMs;
  const endLimit = timeMax.getTime();

  while (t + durationMs <= endLimit) {
    const slotStart = new Date(t);
    const slotEnd = new Date(t + durationMs);
    const sh = hourInTimeZone(slotStart, timeZone);
    const ehM = hourInTimeZone(new Date(slotEnd.getTime() - 1), timeZone);

    if (sh < workStartH || slotEnd > timeMax) {
      t += stepMs;
      continue;
    }
    if (ehM >= workEndH) {
      t += stepMs;
      continue;
    }

    let blocked = false;
    for (const b of busy) {
      if (overlaps(slotStart, slotEnd, b.start, b.end)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      const inFocus = slotOverlapsFocus(slotStart, slotEnd, timeZone);
      let score = 100;
      if (inFocus) score -= 40;
      if (sh >= 10 && sh <= 12) score += 8;
      if (sh >= 15 && sh <= 17) score += 5;
      candidates.push({ start: slotStart, end: slotEnd, score, inFocus });
    }
    t += stepMs;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function summarizeBusyForLlm(busy) {
  return busy
    .slice(0, 20)
    .map((b) => `${b.summary}: ${b.start.toISOString()}–${b.end.toISOString()}`)
    .join("\n");
}

export async function suggestTopSlotsWithLlm({ durationMinutes, candidates, busySummary, timeZone }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || candidates.length === 0) {
    return candidates.slice(0, 3).map((c, i) => ({
      start: c.start.toISOString(),
      end: c.end.toISOString(),
      reason: c.inFocus
        ? "Open slot (overlaps a focus block — still available if needed)"
        : "Open slot; avoids focus blocks when possible",
      score: c.score,
      index: i,
    }));
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const payload = candidates.slice(0, 24).map((c, i) => ({
    i,
    start: c.start.toISOString(),
    end: c.end.toISOString(),
    inFocusBlock: c.inFocus,
    heuristicScore: c.score,
  }));

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You pick the best 3 meeting times from candidates. Avoid scheduling during user focus blocks (9–11, 14–16 local) when alternatives exist. Prefer typical meeting hours. Return JSON only: {\"picks\":[{\"index\":number,\"reason\":string}]}. Exactly 3 picks with distinct indices from candidates.",
          },
          {
            role: "user",
            content: JSON.stringify({
              durationMinutes,
              timeZone,
              busySummary,
              candidates: payload,
            }),
          },
        ],
        max_tokens: 500,
        temperature: 0.35,
      }),
    });
    if (!r.ok) throw new Error("openai");
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("empty");
    const parsed = JSON.parse(text);
    const picks = Array.isArray(parsed.picks) ? parsed.picks : [];
    const out = [];
    const seen = new Set();
    for (const p of picks) {
      const idx = Number(p.index);
      if (seen.has(idx) || idx < 0 || idx >= candidates.length) continue;
      seen.add(idx);
      const c = candidates[idx];
      out.push({
        start: c.start.toISOString(),
        end: c.end.toISOString(),
        reason: String(p.reason || "Suggested slot"),
        score: c.score,
        index: idx,
      });
      if (out.length >= 3) break;
    }
    if (out.length >= 1) return out;
  } catch {
    /* fall through */
  }

  return candidates.slice(0, 3).map((c, i) => ({
    start: c.start.toISOString(),
    end: c.end.toISOString(),
    reason: c.inFocus
      ? "Heuristic pick (overlaps focus — confirm only if needed)"
      : "Heuristic pick — avoids focus blocks",
    score: c.score,
    index: i,
  }));
}

export function findConflictsForSlot(slotStart, slotEnd, busy) {
  return busy.filter((b) => overlaps(slotStart, slotEnd, b.start, b.end));
}

export function eventsToBusy(events) {
  return events.map(eventToBusy).filter(Boolean);
}

/**
 * @param {import("google-auth-library").OAuth2Client} auth
 */
export async function computeAvailabilityOnly(auth, { daysAhead = 7, durationMinutes = 60 }) {
  const tz = getTimezone();
  const durationMs = Math.min(180, Math.max(15, durationMinutes)) * 60 * 1000;
  const days = Math.min(14, Math.max(1, daysAhead));
  const timeMin = new Date(Date.now() + 15 * 60 * 1000);
  const timeMax = new Date(timeMin.getTime() + days * 24 * 60 * 60 * 1000);
  const events = await fetchCalendarEventsInRange(auth, timeMin, timeMax);
  const busy = eventsToBusy(events);
  const candidates = findCandidateSlots({
    timeMin,
    timeMax,
    busy,
    durationMs,
    timeZone: tz,
  });
  return {
    timeZone: tz,
    range: { from: timeMin.toISOString(), to: timeMax.toISOString() },
    busy: busy.map((b) => ({
      summary: b.summary,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
    })),
    freeSlotCount: candidates.length,
  };
}

export async function computeMeetingPlan(auth, { daysAhead = 7, durationMinutes = 60, title = "Meeting" }) {
  const tz = getTimezone();
  const durationMs = Math.min(180, Math.max(15, durationMinutes)) * 60 * 1000;
  const days = Math.min(14, Math.max(1, daysAhead));
  const timeMin = new Date(Date.now() + 15 * 60 * 1000);
  const timeMax = new Date(timeMin.getTime() + days * 24 * 60 * 60 * 1000);

  const events = await fetchCalendarEventsInRange(auth, timeMin, timeMax);
  const busy = eventsToBusy(events);

  const candidates = findCandidateSlots({
    timeMin,
    timeMax,
    busy,
    durationMs,
    timeZone: tz,
  });

  const busySummary = summarizeBusyForLlm(busy);
  const suggestions = await suggestTopSlotsWithLlm({
    durationMinutes: durationMs / 60000,
    candidates,
    busySummary,
    timeZone: tz,
  });

  const withConflicts = suggestions.map((s) => {
    const start = new Date(s.start);
    const end = new Date(s.end);
    const conflicts = findConflictsForSlot(start, end, busy);
    return {
      ...s,
      conflicts: conflicts.map((c) => ({
        summary: c.summary,
        start: c.start.toISOString(),
        end: c.end.toISOString(),
      })),
    };
  });

  return {
    timeZone: tz,
    title,
    range: { from: timeMin.toISOString(), to: timeMax.toISOString() },
    busy: busy.map((b) => ({
      summary: b.summary,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
    })),
    suggestions: withConflicts,
  };
}
