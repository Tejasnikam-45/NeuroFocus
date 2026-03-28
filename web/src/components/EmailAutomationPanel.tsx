import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

type EmailSettings = {
  safeMode: boolean;
  openai: boolean;
  defaultSendDelayMs: number;
  suggestedDelayMs: number;
  inboxQueryDefault: string;
  inboxMaxDefault: number;
};

type InboxRow = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date?: string;
};

type ExtractedTask = {
  task: string;
  deadline: string;
  priority: string;
  requires_response: boolean;
};

type Extraction = {
  tasks: ExtractedTask[];
  summary: string;
};

type Tone = "formal" | "friendly" | "short";

export function EmailAutomationPanel() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [useDelayedSend, setUseDelayedSend] = useState(true);
  const [pendingUntil, setPendingUntil] = useState<number | null>(null);
  const [pendingSid, setPendingSid] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [meta, setMeta] = useState<{ subject: string; from: string; snippet: string } | null>(null);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [tone, setTone] = useState<Tone>("formal");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [confidenceReason, setConfidenceReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [forceSend, setForceSend] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadSettings = useCallback(() => {
    api
      .emailAutomationSettings()
      .then(setSettings)
      .catch(() =>
        setSettings({
          safeMode: false,
          openai: false,
          defaultSendDelayMs: 0,
          suggestedDelayMs: 8000,
          inboxQueryDefault: "is:unread",
          inboxMaxDefault: 5,
        })
      );
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!pendingUntil) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [pendingUntil]);

  useEffect(() => {
    if (!pendingUntil) return;
    if (Date.now() >= pendingUntil) {
      setPendingUntil(null);
      setPendingSid(null);
      setCanUndo(true);
      setToast("Scheduled send completed — you can Undo to move the message to trash.");
    }
  }, [pendingUntil, tick]);

  async function refreshInbox() {
    setInboxLoading(true);
    setErr(null);
    try {
      const q = unreadOnly ? "is:unread" : "in:inbox";
      const maxResults = settings?.inboxMaxDefault ?? 5;
      const r = await api.emailAutomationInbox(q, maxResults);
      setInbox(r.messages);
    } catch {
      setErr("Could not load inbox — connect Google and ensure Gmail API is enabled.");
      setInbox([]);
    } finally {
      setInboxLoading(false);
    }
  }

  async function cancelScheduledSend() {
    if (!pendingSid) return;
    setErr(null);
    try {
      await api.emailAutomationCancelScheduled(pendingSid);
      setPendingUntil(null);
      setPendingSid(null);
      setToast("Scheduled send cancelled.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  async function runAnalyze() {
    if (!selectedId) {
      setErr("Select an email first.");
      return;
    }
    setAnalyzeBusy(true);
    setErr(null);
    setSessionId(null);
    setExtraction(null);
    setMeta(null);
    setModalOpen(false);
    try {
      const r = await api.emailAutomationAnalyze(selectedId);
      setSessionId(r.sessionId);
      setExtraction(r.extraction);
      setMeta(r.meta);
      setToast("Tasks extracted — pick a tone and generate preview.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analyze failed");
    } finally {
      setAnalyzeBusy(false);
    }
  }

  async function runPreview() {
    if (!sessionId) return;
    setPreviewBusy(true);
    setErr(null);
    setForceSend(false);
    try {
      const r = await api.emailAutomationPreview(sessionId, tone);
      setDraftText(r.draftText);
      setConfidence(r.confidence);
      setConfidenceReason(r.confidenceReason);
      setModalOpen(true);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function runApprove() {
    if (!sessionId) return;
    setApproveBusy(true);
    setErr(null);
    try {
      let delayMs: number | undefined;
      if (settings?.safeMode) delayMs = undefined;
      else if (!useDelayedSend) delayMs = 0;
      else if ((settings?.defaultSendDelayMs ?? 0) > 0) delayMs = settings.defaultSendDelayMs;
      else delayMs = settings?.suggestedDelayMs ?? 8000;

      const result = await api.emailAutomationApprove(sessionId, draftText, {
        force: forceSend,
        delayMs: settings?.safeMode ? undefined : delayMs,
      });

      setModalOpen(false);
      setDraftText("");
      setConfidence(null);

      if (result.mode === "scheduled" && result.delayMs && result.sessionId) {
        setPendingUntil(Date.now() + result.delayMs);
        setPendingSid(result.sessionId);
        setSessionId(null);
        setExtraction(null);
        setMeta(null);
        setToast(`Send scheduled in ${Math.ceil(result.delayMs / 1000)}s — cancel from the banner if needed.`);
        return;
      }

      setSessionId(null);
      setExtraction(null);
      setMeta(null);
      setCanUndo(true);
      setToast(
        result.mode === "draft"
          ? "Draft saved — Undo removes it from Gmail."
          : "Reply sent — Undo moves it to trash (or sends a correction if trash fails)."
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("low_confidence")) {
        setErr("Confidence too low — edit the draft or enable “Force send anyway”.");
        return;
      }
      setErr(msg || "Approve failed");
    } finally {
      setApproveBusy(false);
    }
  }

  async function runReject() {
    if (sessionId) {
      try {
        await api.emailAutomationReject(sessionId);
      } catch {
        /* noop */
      }
    }
    setModalOpen(false);
    setSessionId(null);
    setExtraction(null);
    setMeta(null);
    setDraftText("");
    setToast("Preview discarded.");
  }

  async function runUndo() {
    setErr(null);
    try {
      const r = await api.emailAutomationUndo();
      setCanUndo(false);
      setToast(
        r.undone === "correction"
          ? r.message || "Sent correction notice in thread."
          : "Last action undone (draft removed or message trashed)."
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Undo failed");
    }
  }

  const confColor =
    confidence === null ? "bg-zinc-700" : confidence >= 70 ? "bg-teal-500" : confidence >= 40 ? "bg-amber-500" : "bg-red-500";

  const secondsLeft =
    pendingUntil !== null ? Math.max(0, Math.ceil((pendingUntil - Date.now()) / 1000)) : 0;

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-white">Email automation</h3>
          <p className="text-sm text-zinc-500">
            Read & extract → draft reply → preview with confidence → approve (human-in-the-loop). Fail-safe blocks send below 40%
            unless forced.
          </p>
        </div>
        {settings?.safeMode && (
          <span className="rounded-full border border-amber-500/40 bg-amber-950/50 px-3 py-1 text-xs text-amber-200">
            Safe mode — only Gmail drafts, no send
          </span>
        )}
        {settings && !settings.openai && (
          <span className="rounded-full border border-zinc-600 px-3 py-1 text-xs text-zinc-400">
            Set OPENAI_API_KEY on server for best extraction & drafts
          </span>
        )}
      </div>

      {toast && (
        <p className="rounded-xl border border-teal-500/30 bg-teal-950/30 px-4 py-2 text-sm text-teal-100">{toast}</p>
      )}

      {pendingUntil !== null && secondsLeft > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3">
          <p className="text-sm text-amber-100">
            <span className="font-semibold">Delayed send:</span> fires in{" "}
            <span className="font-mono text-lg">{secondsLeft}</span>s — cancel before the timer ends.
          </p>
          <button
            type="button"
            onClick={() => void cancelScheduledSend()}
            className="rounded-full border border-amber-400/60 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/40"
          >
            Cancel send
          </button>
        </div>
      )}

      {/* 1. Read & extract */}
      <div className="surface p-5 space-y-4">
        <h4 className="font-display text-sm font-semibold text-zinc-200">1. Read & extract tasks</h4>
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Unread only (matches Gmail <code className="text-zinc-400">is:unread</code>, max {settings?.inboxMaxDefault ?? 5})
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshInbox()}
            disabled={inboxLoading}
            className="rounded-full border border-zinc-600 bg-zinc-900/50 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            {inboxLoading ? "Loading…" : "Refresh inbox"}
          </button>
          <button
            type="button"
            onClick={() => void runAnalyze()}
            disabled={!selectedId || analyzeBusy}
            className="rounded-full bg-violet-500/90 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-400 disabled:opacity-40"
          >
            {analyzeBusy ? "Analyzing…" : "Analyze selected email"}
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto rounded-2xl border border-zinc-800/80">
          {inbox.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No messages loaded — refresh inbox (requires Google).</p>
          ) : (
            <ul className="divide-y divide-zinc-800/80">
              {inbox.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full text-left px-4 py-3 text-sm transition hover:bg-zinc-800/40 ${
                      selectedId === m.id ? "bg-violet-950/40 border-l-2 border-violet-500" : ""
                    }`}
                  >
                    <p className="font-medium text-zinc-100 line-clamp-1">{m.subject}</p>
                    <p className="text-xs text-zinc-500 line-clamp-1">{m.from}</p>
                    <p className="text-xs text-zinc-600 mt-1 line-clamp-2">{m.snippet}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {extraction && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Extracted</p>
            {meta && (
              <p className="text-xs text-zinc-400">
                <span className="text-zinc-500">Subject:</span> {meta.subject}
              </p>
            )}
            <p className="text-sm text-zinc-300">{extraction.summary}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-2">Task</th>
                    <th className="py-2 pr-2">Deadline</th>
                    <th className="py-2 pr-2">Priority</th>
                    <th className="py-2">Reply?</th>
                  </tr>
                </thead>
                <tbody>
                  {extraction.tasks.map((t, i) => (
                    <tr key={i} className="border-b border-zinc-800/60 text-zinc-300">
                      <td className="py-2 pr-2">{t.task}</td>
                      <td className="py-2 pr-2">{t.deadline}</td>
                      <td className="py-2 pr-2 capitalize">{t.priority}</td>
                      <td className="py-2">{t.requires_response ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 2. Draft + tone */}
      <div className="surface p-5 space-y-4">
        <h4 className="font-display text-sm font-semibold text-zinc-200">2. Draft reply</h4>
        <p className="text-xs text-zinc-500">Tone affects how the model writes. Generate a preview before sending.</p>
        <div className="flex flex-wrap gap-2">
          {(["formal", "friendly", "short"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              className={`rounded-full px-4 py-2 text-xs font-medium capitalize ${
                tone === t ? "bg-zinc-100 text-zinc-900" : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={!sessionId || previewBusy}
          className="rounded-full bg-teal-500/90 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-teal-400 disabled:opacity-40"
        >
          {previewBusy ? "Generating…" : "Generate draft & open preview"}
        </button>
      </div>

      {err && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200/90">{err}</p>
      )}

      {/* Undo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void runUndo()}
          disabled={!canUndo}
          className="rounded-full border border-zinc-600 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
        >
          Undo last action
        </button>
        <span className="text-[11px] text-zinc-600">
          Removes last draft or moves last sent reply to trash (Gmail).
        </span>
      </div>

      {/* Modal — Action preview */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="surface max-h-[90vh] w-full max-w-2xl overflow-hidden flex flex-col border border-zinc-700/80 shadow-2xl">
            <div className="border-b border-zinc-800 px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-display text-lg font-semibold text-white">Draft reply</h4>
                <p className="text-xs text-zinc-500 mt-1">Visible AI decision — review confidence before approve.</p>
              </div>
              <button
                type="button"
                onClick={() => runReject()}
                className="text-zinc-500 hover:text-zinc-300 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">Confidence score</span>
                  <span className="text-sm font-mono text-zinc-200">{confidence ?? "—"}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${confColor}`}
                    style={{ width: `${Math.min(100, Math.max(0, confidence ?? 0))}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">{confidenceReason}</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing((e) => !e)}
                  className="rounded-full border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  {editing ? "Done editing" : "✏️ Edit draft"}
                </button>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">Draft</p>
                {editing ? (
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={12}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 font-sans leading-relaxed focus:border-teal-500/40 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-200 font-sans leading-relaxed max-h-64 overflow-y-auto">
                    {draftText}
                  </pre>
                )}
              </div>

              {!settings?.safeMode && (
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDelayedSend}
                    onChange={(e) => setUseDelayedSend(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  Delay send ~{(settings?.suggestedDelayMs ?? 8000) / 1000}s (cancelable — human-in-the-loop window)
                </label>
              )}

              {confidence !== null && confidence < 40 && (
                <label className="flex items-center gap-2 text-xs text-amber-200/90 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceSend}
                    onChange={(e) => setForceSend(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  Force send anyway (bypasses fail-safe)
                </label>
              )}
            </div>

            <div className="border-t border-zinc-800 px-5 py-4 flex flex-wrap gap-3 justify-end bg-zinc-950/40">
              <button
                type="button"
                onClick={() => runReject()}
                className="rounded-full border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                ❌ Reject
              </button>
              <button
                type="button"
                onClick={() => void runApprove()}
                disabled={approveBusy || (confidence !== null && confidence < 40 && !forceSend)}
                className="rounded-full bg-teal-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-teal-400 disabled:opacity-40"
              >
                {approveBusy ? "…" : settings?.safeMode ? "✅ Approve → save draft" : "✅ Approve & send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
