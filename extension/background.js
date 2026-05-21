// Service worker coordinating sidebar injection toggles
chrome.action.onClicked.addListener((tab) => {
  if (tab.id && tab.url && (tab.url.includes("force.com") || tab.url.includes("salesforce.com"))) {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
  }
});
