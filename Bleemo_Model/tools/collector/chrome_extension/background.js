// Clicking the toolbar icon runs the extractor in every frame of the current tab.
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true }, // every iframe too
    files: ["extract.js"],
  });
});

// The page sends its fields here; the background script forwards them to the local collector.
// It runs outside the page, so the site's Content Security Policy doesn't apply.
chrome.runtime.onMessage.addListener((payload, sender, sendResponse) => {
  fetch("http://localhost:5000/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json())
    .then(sendResponse)
    .catch((error) => sendResponse({ error: String(error) })); // server down: always answer
  return true; // keep the reply channel open while fetch finishes
});