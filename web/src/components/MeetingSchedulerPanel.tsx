import { useCallback, useState } from "react";
import { api } from "../lib/api";

function fmtRange(isoStart: string, isoEnd: string) {
  const a = new Date(isoStart);
  const b = new Date(isoEnd);
  return `${a.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} → ${b.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

type Busy = { summary: string; start: string; end: string };
type Suggestion = {
  start: string;
  end: string;
  reason: string;
  conflicts?: Busy[];
};

export function MeetingSchedulerPanel({ googleConnected }: { googleConnected: boolean }) {
  const [duration, setDuration] = useState(60);
  const [days, setDays] = useState(7);
  const [title, setTitle] = useState("Meeting");
  const [loading, setLoading] = useState<"avail" | "suggest" | "confirm" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{
    timeZone: string;
    range: { from: string; to: string };
    busy: Busy[];
    freeSlotCount: number;
  } | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  const checkCalendar = useCallback(async () => {
    if (!googleConnected) return;
    setErr(null);
    setSuccessLink(null);
    setLoading("avail");
    try {
      const data = await api.meetingSchedulerAvailability(days, duration);
      setAvailability(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Availability failed");
      setAvailability(null);
    } finally {
      setLoading(null);
    }
  }, [googleConnected, days, duration]);

  const suggestTimes = useCallback(async () => {
    if (!googleConnected) return;
    setErr(null);
    setSuccessLink(null);
    setProposalId(null);
    setSuggestions([]);
    setLoading("suggest");
    try {
      const data = await api.meetingSchedulerSuggest({
        durationMinutes: duration,
        daysAhead: days,
        title: title.trim() || "Meeting",
      });
      setProposalId(data.proposalId);
      setSuggestions(data.suggestions || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Suggest failed");
    } finally {
      setLoading(null);
    }
  }, [googleConnected, days, duration, title]);

  const confirmSlot = useCallback(
    async (slotIndex: number) => {
      if (!googleConnected || !proposalId) return;
      setErr(null);
      setLoading("confirm");
      try {
        const data = await api.meetingSchedulerConfirm(proposalId, slotIndex);
        setSuccessLink(data.htmlLink || null);
        setProposalId(null);
        setSuggestions([]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Confirm failed");
      } finally {
        setLoading(null);
      }
    },
    [googleConnected, proposalId]
  );

  if (!googleConnected) {
    return (
      <section className="surface p-5 space-y-2 opacity-60">
        <h3 className="font-display text-sm font-semibold text-white">Meeting scheduler</h3>
        <p className="text-xs text-zinc-500">Connect Google above to check Calendar and propose times.</p>
      </section>
    );
  }

  return (
    <section className="surface p-5 space-y-5">
      <div>
        <h3 className="font-display text-sm font-semibold text-white">Meeting scheduler</h3>
        <p className="mt-1 text-xs text-zinc-500 max-w-2xl">
          Calendar is read to find busy blocks and free windows. Suggested times avoid focus blocks (9–11, 14–16 local) when
          possible. <strong className="text-zinc-400">Nothing is added to Google Calendar until you confirm.</strong>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 w-48"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Duration (min)
          <input
            type="number"
            min={15}
            max={180}
            step={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 60)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 w-24"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Horizon (days)
          <input
            type="number"
            min={1}
            max={14}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 7)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 w-20"
          />
        </label>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void checkCalendar()}
          className="rounded-full border border-zinc-600 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
        >
          {loading === "avail" ? "Checking…" : "2.1 Check calendar"}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void suggestTimes()}
          className="rounded-full bg-teal-500/90 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-teal-400 disabled:opacity-40"
        >
          {loading === "suggest" ? "Suggesting…" : "2.2 Suggest times (top 3)"}
        </button>
      </div>

      {err && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200/90">{err}</p>
      )}

      {successLink && (
        <p className="rounded-xl border border-teal-500/40 bg-teal-950/30 px-3 py-2 text-xs text-teal-100/90">
          Event created.{" "}
          <a href={successLink} target="_blank" rel="noreferrer" className="text-teal-300 underline">
            Open in Google Calendar
          </a>
        </p>
      )}

      {availability && (
        <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/50 p-4 space-y-2">
          <p className="text-xs font-semibold text-zinc-300">Availability ({availability.timeZone})</p>
          <p className="text-xs text-zinc-500">
            Window {new Date(availability.range.from).toLocaleDateString()} –{" "}
            {new Date(availability.range.to).toLocaleDateString()} · heuristic free slots:{" "}
            <strong className="text-zinc-300">{availability.freeSlotCount}</strong>
          </p>
          <ol className="list-decimal list-inside text-xs text-zinc-400 space-y-1 max-h-36 overflow-y-auto">
            {availability.busy.length === 0 ? (
              <li>No busy events in range (still may respect work hours).</li>
            ) : (
              availability.busy.map((b, i) => (
                <li key={i}>
                  {b.summary} — {fmtRange(b.start, b.end)}
                </li>
              ))
            )}
          </ol>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-amber-200/90">2.3 Approval required — pick one slot</p>
          <ul className="space-y-3">
            {suggestions.map((s, i) => (
              <li
                key={i}
                className="rounded-xl border border-zinc-700/90 bg-zinc-900/40 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-sm text-zinc-100 font-medium">{fmtRange(s.start, s.end)}</p>
                  <p className="text-xs text-zinc-500">{s.reason}</p>
                  {s.conflicts && s.conflicts.length > 0 && (
                    <p className="text-xs text-amber-200/80">
                      Conflicts: {s.conflicts.map((c) => c.summary).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={loading === "confirm"}
                    onClick={() => void confirmSlot(i)}
                    className="rounded-full bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={loading !== null}
                    onClick={() => void suggestTimes()}
                    className="rounded-full border border-zinc-600 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    Change (re-suggest)
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
