document.getElementById("open").addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:5173/" });
});

document.getElementById("focus").addEventListener("click", () => {
  document.getElementById("out").textContent = "Deep Focus: hook chrome.declarativeNetRequest or badge + DNA delays.";
});

document.getElementById("api").addEventListener("click", async (e) => {
  e.preventDefault();
  const out = document.getElementById("out");
  try {
    const r = await fetch("http://localhost:3847/api/health");
    out.textContent = JSON.stringify(await r.json(), null, 2);
  } catch (err) {
    out.textContent = "API offline. Run: cd server && npm run dev";
  }
});
