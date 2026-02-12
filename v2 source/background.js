// ReadIt Web Text Reader — Badge & Toggle Manager

const ON_COLOR = "#2ecc71";
const OFF_COLOR = "#9e9e9e";

function updateBadge(isEnabled) {
  chrome.action.setBadgeText({
    text: isEnabled ? "ON" : "OFF"
  });
  chrome.action.setBadgeBackgroundColor({
    color: isEnabled ? ON_COLOR : OFF_COLOR
  });
}

function getState(cb) {
  chrome.storage.local.get(["webTextReaderEnabled"], (res) => {
    cb(res.webTextReaderEnabled !== false);
  });
}

function setState(enabled) {
  chrome.storage.local.set({ webTextReaderEnabled: enabled });
  updateBadge(enabled);

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (!tab.id) return;

      chrome.tabs.sendMessage(
        tab.id,
        { type: "READIT_TOGGLE", enabled },
        () => {
          // Ignore tabs without content script (expected)
          if (chrome.runtime.lastError) {}
        }
      );
    });
  });
}

// On install / browser restart
chrome.runtime.onInstalled.addListener(() => {
  getState(updateBadge);
});

// Toolbar icon click toggles ON/OFF
chrome.action.onClicked.addListener(() => {
  getState(current => setState(!current));
});

// Listen from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "READIT_TOGGLE") {
    setState(msg.enabled);
  }
});
