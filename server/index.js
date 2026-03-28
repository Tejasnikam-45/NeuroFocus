import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3847;

app.use(cors({ origin: true }));
app.use(express.json());

/** Simulated signals — replace with extension POST /context/ingest */
function mockSignals() {
  const t = Date.now() / 8000;
  return {
    tabSwitchesPerMin: 4 + Math.sin(t) * 3,
    dwellSeconds: 45 + Math.cos(t) * 20,
    backtrackRatio: 0.15 + Math.sin(t * 0.7) * 0.1,
    activeDomain: "github.com",
    titleKeywords: ["pull request", "typescript", "review"],
  };
}

app.get("/api/neuro-score", (_req, res) => {
  const s = mockSignals();
  const confusion = Math.min(100, Math.round(s.backtrackRatio * 100 + s.tabSwitchesPerMin * 4));
  const stress = Math.min(100, Math.round(30 + (s.tabSwitchesPerMin > 6 ? 25 : 0)));
  const focus = Math.max(0, Math.min(100, 100 - confusion / 2 - stress / 3));
  const deepFocusSuggested = focus < 42 || confusion > 55;

  let label = "Stable attention";
  let recommendation = "Maintain current rhythm; batch low-priority pings.";
  if (deepFocusSuggested) {
    label = "Focus decay detected";
    recommendation = "User is losing focus → activate Deep Focus Mode; delay non-critical notifications.";
  } else if (stress > 60) {
    label = "Overload risk";
    recommendation = "Reduce context switches; surface only high-DNA notifications.";
  }

  res.json({
    focus: Math.round(focus),
    stress: Math.round(stress),
    confusion,
    label,
    recommendation,
    deepFocusSuggested,
  });
});

app.get("/api/intent", (_req, res) => {
  const s = mockSignals();
  let intent = "coding";
  let confidence = 0.78;
  const signals = [`Domain: ${s.activeDomain}`, `Keywords: ${s.titleKeywords.slice(0, 2).join(", ")}`];
  if (s.titleKeywords.some((k) => /lecture|video|course/i.test(k))) {
    intent = "studying";
    confidence = 0.71;
  } else if (s.tabSwitchesPerMin > 8) {
    intent = "browsing";
    confidence = 0.62;
  }
  res.json({ intent, confidence, signals });
});

app.get("/api/predict-attention", (_req, res) => {
  res.json({
    taskLabel: "Code review on PR #184",
    estimatedMinutesRemaining: 6,
    confidence: 0.74,
    rationale: "Stable dwell on diff view + low backtrack → you’ll likely finish coding in ~6 min; delay notifications.",
  });
});

app.get("/api/notifications/dna", (_req, res) => {
  res.json({
    items: [
      {
        id: "1",
        title: "Slack: @you in #eng-incidents",
        urgency: 88,
        relevance: 72,
        interruptionCost: 82,
        senderImportance: 90,
        decision: "show_now",
        summary: "Production alert thread",
      },
      {
        id: "2",
        title: "Newsletter: Weekly digest",
        urgency: 12,
        relevance: 22,
        interruptionCost: 65,
        senderImportance: 15,
        decision: "summarize_later",
        summary: "Batch with other newsletters after focus block",
      },
      {
        id: "3",
        title: "Calendar: 1:1 with manager",
        urgency: 45,
        relevance: 80,
        interruptionCost: 40,
        senderImportance: 85,
        decision: "delay",
        delayMinutes: 8,
        summary: "Remind when predicted task window ends",
      },
    ],
  });
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

app.get("/api/agent/queue", (_req, res) => {
  res.json({
    actions: [
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
    ],
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

app.get("/api/analytics", (_req, res) => {
  const weeklyFocusByDay = [
    { day: "Mon", focus: 71 },
    { day: "Tue", focus: 84 },
    { day: "Wed", focus: 62 },
    { day: "Thu", focus: 79 },
    { day: "Fri", focus: 88 },
    { day: "Sat", focus: 55 },
    { day: "Sun", focus: 48 },
  ];
  const timeAllocationMinutes = [
    { key: "deep", label: "Deep work", minutes: 420 },
    { key: "meetings", label: "Meetings & calls", minutes: 195 },
    { key: "distraction", label: "Distraction / context loss", minutes: 94 },
    { key: "shallow", label: "Shallow tasks & email", minutes: 165 },
    { key: "breaks", label: "Breaks & recovery", minutes: 118 },
  ];
  const dnaDecisionsWeek = [
    { label: "Delayed wisely", count: 132 },
    { label: "Batched / summarized", count: 91 },
    { label: "Shown immediately", count: 38 },
  ];
  const totalMin = timeAllocationMinutes.reduce((a, x) => a + x.minutes, 0);
  const deepPct = Math.round((timeAllocationMinutes[0].minutes / totalMin) * 100);

  res.json({
    focusScoreWeek: 78,
    distractionMinutes: 94,
    trendPercent: 23,
    streakDays: 5,
    deepWorkHoursWeek: 7.0,
    weeklyFocusByDay,
    timeAllocationMinutes,
    dnaDecisionsWeek,
    insightHeadline: `Deep work is about ${deepPct}% of your tracked week — up with fewer “show now” interruptions.`,
    insightBullets: [
      "Mid-week dip (Wed) aligns with meeting load; DNA delayed 68% of pings that day.",
      "Friday is your strongest focus day — good candidate for maker blocks.",
      "Distraction time is down 23% vs last week; batching is doing the heavy lifting.",
    ],
  });
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
  res.json({ ok: true, ingested: mockSignals() });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "neurofocus-api" });
});

app.listen(PORT, () => {
  console.log(`NeuroFocus API http://localhost:${PORT}`);
});
