/**
 * Lightweight activity hints — extend to count switches, dwell, visibility API.
 */
let lastUrl = location.href;
let switches = 0;

setInterval(() => {
  if (location.href !== lastUrl) {
    switches += 1;
    lastUrl = location.href;
    chrome.runtime.sendMessage({ type: "INGEST_TAB", url: lastUrl, switches }).catch(() => {});
  }
}, 2000);

document.addEventListener("visibilitychange", () => {
  chrome.runtime.sendMessage({ type: "INGEST_TAB", visible: !document.hidden }).catch(() => {});
});
