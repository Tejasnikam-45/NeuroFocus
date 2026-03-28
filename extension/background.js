const API = "http://localhost:3847/api";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("neurofocus-heartbeat", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "neurofocus-heartbeat") return;
  try {
    const res = await fetch(`${API}/health`);
    if (res.ok) console.log("[NeuroFocus] API reachable");
  } catch {
    console.warn("[NeuroFocus] API offline — start server on 3847");
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "INGEST_TAB") {
    // Forward to your backend for real NeuroScore / intent (POST /context/ingest when you add it)
    sendResponse({ ok: true });
  }
  return true;
});
