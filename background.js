chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchRMP") {
    fetch(request.url)
      .then(res => res.text())
      .then(html => sendResponse({ success: true, html }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // important: keep message channel open
  }
});