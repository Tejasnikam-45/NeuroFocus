const API = "http://127.0.0.1:3847/api";

let tabSwitchScore = 0;
let lastPostedDomain = "";

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
  if (msg?.type === "INGEST_TAB" && msg.url) {
    try {
      const host = new URL(msg.url).hostname;
      if (host && host !== lastPostedDomain) {
        tabSwitchScore += 1.2;
        lastPostedDomain = host;
      }
    } catch {
      /* ignore */
    }
    sendResponse({ ok: true });
  }
  return true;
});

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

async function ingestActiveTab() {
  let tab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  } catch {
    return;
  }
  if (!tab?.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;

  let domain = "";
  try {
    domain = new URL(tab.url).hostname;
  } catch {
    return;
  }

  const title = tab.title || "";
  const switchesPerMin = clamp(2 + tabSwitchScore + Math.sin(Date.now() / 9000) * 1.5, 1, 28);
  tabSwitchScore = clamp(tabSwitchScore * 0.88, 0, 40);

  const dwell = clamp(32 + title.length / 6, 12, 180);
  const backtrack = clamp(0.1 + tabSwitchScore * 0.008, 0.06, 0.45);

  try {
    await fetch(`${API}/context/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activeDomain: domain,
        activeTitle: title,
        tabSwitchesPerMin: switchesPerMin,
        dwellSeconds: dwell,
        backtrackRatio: backtrack,
      }),
    });
  } catch (e) {
    console.warn("[NeuroFocus] ingest failed", e?.message || e);
  }
}

chrome.tabs.onActivated.addListener(() => {
  tabSwitchScore += 0.9;
});

chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.status === "complete") tabSwitchScore += 0.35;
});

setInterval(() => {
  void ingestActiveTab();
}, 6000);
