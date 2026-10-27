chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },  // every iframe too
    files: ["extract.js"],
  });
});

chrome.runtime.onMessage.addListener((payload, sender, sendResponse) => {
  fetch("http://localhost:5000/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json())
    .then(sendResponse);
  return true; // keep the reply channel open while fetch finishes
});