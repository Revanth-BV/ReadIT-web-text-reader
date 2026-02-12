/***********************
 * READIT WEB TEXT READER
 * FINAL – SHIPPABLE VERSION
 ***********************/

/* ---------- STATE ---------- */
let popup = null;
let voicePicker = null;
let highlightEl = null;

let selectedText = "";
let sentences = [];
let currentSentenceIndex = 0;

let currentRate = 1;
let isSpeaking = false;
let isPaused = false;
let isRestarting = false;

let voices = [];
let preferredVoices = JSON.parse(localStorage.getItem("preferredVoices") || "{}");
let isEnabled = true;

/* ---------- INIT ENABLE STATE (SINGLE SOURCE) ---------- */
chrome.storage.local.get("webTextReaderEnabled", res => {
  if (typeof res.webTextReaderEnabled === "boolean") {
    isEnabled = res.webTextReaderEnabled;
  }

  chrome.runtime.sendMessage({
    type: "READIT_TOGGLE",
    enabled: isEnabled
  });
});

/* ---------- HELPERS ---------- */
function isDarkMode() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function detectLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN";
  return document.documentElement.lang || "en-US";
}

/* ---------- VOICES ---------- */
function loadVoices() {
  voices = speechSynthesis.getVoices();
}
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function getVoiceForLang(lang) {
  if (preferredVoices[lang]) {
    const v = voices.find(v => v.voiceURI === preferredVoices[lang]);
    if (v) return v;
  }
  return voices.find(v => v.lang.startsWith(lang.split("-")[0])) || null;
}

/* ---------- TEXT SELECTION ---------- */
document.addEventListener("mouseup", () => {
  if (!isEnabled) return;

  setTimeout(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return removePopup();

    selectedText = sel.toString().trim();
    if (!selectedText) return removePopup();

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    showPopup(rect);
  }, 10);
});

/* ---------- POPUP ---------- */
function showPopup(rect) {
  removePopup();

  popup = document.createElement("div");
  Object.assign(popup.style, {
    position: "fixed",
    top: `${rect.bottom + 12}px`,
    left: `${rect.left}px`,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 12px",
    borderRadius: "999px",
    background: isDarkMode()
      ? "rgba(20,20,20,0.32)"
      : "rgba(255,255,255,0.28)",
    backdropFilter: "blur(22px) saturate(220%)",
    WebkitBackdropFilter: "blur(22px) saturate(220%)",
    border: isDarkMode()
      ? "1px solid rgba(255,255,255,0.14)"
      : "1px solid rgba(255,255,255,0.35)",
    boxShadow:
      "inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -1px 1px rgba(0,0,0,0.08), 0 18px 40px rgba(0,0,0,0.30)",
    zIndex: "2147483647",
    userSelect: "none"
  });

  popup.append(
    glassBtn("▶️", () => startReading(selectedText)),
    glassBtn("⏸", togglePause),
    glassBtn("⏹", stopSpeech),
    glassBtn("⏪", () => changeRate(-0.25)),
    speedLabel(),
    glassBtn("⏩", () => changeRate(0.25)),
    glassBtn("🎙️", toggleVoicePicker),
    glassBtn(isEnabled ? "🟢" : "⚪", toggleExtension)
  );

  document.body.appendChild(popup);
}

function removePopup() {
  if (popup) popup.remove();
  popup = null;
  closeVoicePicker();
}

/* ---------- BUTTON ---------- */
function glassBtn(label, action) {
  const b = document.createElement("button");
  b.textContent = label;
  Object.assign(b.style, {
    background: "transparent",
    border: "none",
    fontSize: "15px",
    cursor: "pointer"
  });
  b.onclick = e => {
    e.stopPropagation();
    action();
  };
  return b;
}

/* ---------- SPEED ---------- */
function speedLabel() {
  const s = document.createElement("span");
  s.textContent = `${currentRate.toFixed(2)}×`;
  s.style.minWidth = "36px";
  s.style.fontSize = "13px";
  s.style.opacity = "0.85";
  return s;
}

function changeRate(delta) {
  const next = Math.min(2, Math.max(0.5, currentRate + delta));
  if (next === currentRate) return;
  currentRate = next;

  if (isSpeaking && !isPaused) {
    isRestarting = true;
    speechSynthesis.cancel();
    isRestarting = false;
    speakCurrentSentence();
  }
}

/* ---------- VOICE PICKER ---------- */
function toggleVoicePicker() {
  if (voicePicker) return closeVoicePicker();

  const rect = popup.getBoundingClientRect();
  voicePicker = document.createElement("div");

  Object.assign(voicePicker.style, {
    position: "fixed",
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    minWidth: "220px",
    maxHeight: "220px",
    overflowY: "auto",
    padding: "8px",
    borderRadius: "14px",
    background: isDarkMode()
      ? "rgba(20,20,20,0.9)"
      : "rgba(255,255,255,0.9)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
    zIndex: "2147483647"
  });

  const lang = detectLanguage(selectedText);
  const list = voices.length ? voices : speechSynthesis.getVoices();

  list.forEach(v => {
    const item = document.createElement("div");
    item.textContent = `${v.name} (${v.lang})`;
    item.style.padding = "6px";
    item.style.cursor = "pointer";
    item.onclick = () => {
      preferredVoices[lang] = v.voiceURI;
      localStorage.setItem("preferredVoices", JSON.stringify(preferredVoices));
      closeVoicePicker();
      if (isSpeaking) speakCurrentSentence();
    };
    voicePicker.appendChild(item);
  });

  document.body.appendChild(voicePicker);
}

function closeVoicePicker() {
  if (voicePicker) voicePicker.remove();
  voicePicker = null;
}

/* ---------- SPEECH ---------- */
function startReading(text) {
  sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  currentSentenceIndex = 0;
  isPaused = false;
  speakCurrentSentence();
}

function speakCurrentSentence() {
  if (currentSentenceIndex >= sentences.length) {
    clearHighlight();
    isSpeaking = false;
    return;
  }

  const sentence = sentences[currentSentenceIndex];
  highlightSentence(sentence);

  const u = new SpeechSynthesisUtterance(sentence);
  u.rate = currentRate;
  u.lang = detectLanguage(sentence);

  const v = getVoiceForLang(u.lang);
  if (v) u.voice = v;

  isSpeaking = true;
  u.onend = () => {
    if (!isPaused && !isRestarting) {
      currentSentenceIndex++;
      speakCurrentSentence();
    }
  };

  speechSynthesis.speak(u);
}

/* ---------- HIGHLIGHT ---------- */
function highlightSentence(s) {
  clearHighlight();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const i = n.textContent.indexOf(s.trim());
    if (i !== -1) {
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + s.trim().length);
      highlightEl = document.createElement("span");
      highlightEl.style.background = isDarkMode()
        ? "rgba(255,255,255,0.25)"
        : "rgba(0,120,255,0.2)";
      highlightEl.style.borderRadius = "6px";
      highlightEl.style.padding = "2px 4px";
      r.surroundContents(highlightEl);
      break;
    }
  }
}

function clearHighlight() {
  if (highlightEl && highlightEl.parentNode) {
    const p = highlightEl.parentNode;
    p.replaceChild(document.createTextNode(highlightEl.textContent), highlightEl);
    p.normalize();
    highlightEl = null;
  }
}

/* ---------- CONTROLS ---------- */
function togglePause() {
  if (!speechSynthesis.speaking) return;
  speechSynthesis.paused
    ? speechSynthesis.resume()
    : speechSynthesis.pause();
}

function stopSpeech() {
  speechSynthesis.cancel();
  clearHighlight();
  isSpeaking = false;
  isPaused = false;
}

/* ---------- TOGGLE EXTENSION ---------- */
function toggleExtension() {
  isEnabled = !isEnabled;
  chrome.storage.local.set({ webTextReaderEnabled: isEnabled });

  stopSpeech();
  removePopup();

  chrome.runtime.sendMessage({
    type: "READIT_TOGGLE",
    enabled: isEnabled
  });
}

/* ---------- CLICK OUTSIDE DISMISS ---------- */
document.addEventListener("mousedown", e => {
  if (popup && popup.contains(e.target)) return;
  if (voicePicker && voicePicker.contains(e.target)) return;
  removePopup();
});

/* ---------- KEYBOARD ---------- */
document.addEventListener("keydown", e => {
  if (e.altKey && e.key.toLowerCase() === "t") toggleExtension();
  if (!isEnabled) return;
  if (e.altKey && e.key.toLowerCase() === "r") {
    const t = window.getSelection().toString().trim();
    if (t) startReading(t);
  }
});

/* ---------- MESSAGES ---------- */
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === "READIT_TOGGLE") {
    isEnabled = msg.enabled;
    if (!isEnabled) {
      stopSpeech();
      removePopup();
    }
  }
});