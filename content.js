/***********************
 * GLOBAL STATE
 ***********************/
let popup = null;
let selectedText = "";

let sentences = [];
let currentSentenceIndex = 0;

let currentVoice = null;
let currentRate = 1;

let isSpeaking = false;
let isPaused = false;
let isRestarting = false;

let speedLabel = null;

/***********************
 * THEME
 ***********************/
function isDarkMode() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/***********************
 * TEXT SELECTION
 ***********************/
document.addEventListener("mouseup", () => {
  setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      removePopup();
      return;
    }

    selectedText = selection.toString().trim();
    if (!selectedText) {
      removePopup();
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    showPopup(rect);
  }, 10);
});

/***********************
 * POPUP UI
 ***********************/
function showPopup(rect) {
  removePopup();

  popup = document.createElement("div");
  Object.assign(popup.style, {
    position: "fixed",
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    background: isDarkMode() ? "#111" : "#fff",
    color: isDarkMode() ? "#fff" : "#111",
    padding: "8px 10px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    zIndex: "2147483647",
    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
    fontFamily: "system-ui, sans-serif",
    opacity: "0",
    transform: "translateY(4px)",
    transition: "opacity 120ms ease-out, transform 120ms ease-out"
  });

  const readBtn = createButton("🔊", () => startReading(selectedText));
  const pauseBtn = createButton("⏸", togglePause);
  const stopBtn = createButton("⏹", stopSpeech);
  const slowerBtn = createButton("⏪", () => changeRate(-0.25));
  const fasterBtn = createButton("⏩", () => changeRate(0.25));

  speedLabel = document.createElement("span");
  speedLabel.textContent = formatRate(currentRate);
  Object.assign(speedLabel.style, {
    fontSize: "13px",
    minWidth: "42px",
    textAlign: "center",
    opacity: "0.9",
    color: isDarkMode() ? "#ddd" : "#333"
  });

  popup.append(
    readBtn,
    pauseBtn,
    stopBtn,
    slowerBtn,
    speedLabel,
    fasterBtn
  );

  document.body.appendChild(popup);

  requestAnimationFrame(() => {
    popup.style.opacity = "1";
    popup.style.transform = "translateY(0)";
  });
}

function removePopup() {
  if (popup) {
    popup.remove();
    popup = null;
  }
}

/***********************
 * BUTTON
 ***********************/
function createButton(label, action) {
  const btn = document.createElement("button");
  btn.textContent = label;

  Object.assign(btn.style, {
    cursor: "pointer",
    fontSize: "14px",
    background: isDarkMode() ? "#222" : "#f1f1f1",
    color: isDarkMode() ? "#fff" : "#111",
    border: "none",
    borderRadius: "6px",
    padding: "4px 6px"
  });

  btn.onmouseenter = () => {
    btn.style.background = isDarkMode() ? "#333" : "#e2e2e2";
  };

  btn.onmouseleave = () => {
    btn.style.background = isDarkMode() ? "#222" : "#f1f1f1";
  };

  btn.onclick = (e) => {
    e.stopPropagation();
    action();
  };

  return btn;
}

/***********************
 * SPEECH — SENTENCE MODE
 ***********************/
function startReading(text) {
  if (!text) return;

  // Split into sentences (robust enough for v1)
  sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  currentSentenceIndex = 0;
  isPaused = false;

  speakCurrentSentence();
}

function speakCurrentSentence() {
  if (currentSentenceIndex >= sentences.length) {
    isSpeaking = false;
    return;
  }

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(
    sentences[currentSentenceIndex]
  );
  utterance.rate = currentRate;
  utterance.lang = document.documentElement.lang || "en-US";

  if (currentVoice) utterance.voice = currentVoice;

  utterance.onstart = () => {
    isSpeaking = true;
  };

  utterance.onend = () => {
    if (!isPaused && !isRestarting) {
      currentSentenceIndex++;
      speakCurrentSentence();
    }
  };

  utterance.onerror = () => {
    isSpeaking = false;
  };

  speechSynthesis.speak(utterance);
}

/***********************
 * PAUSE / STOP
 ***********************/
function togglePause() {
  if (!speechSynthesis.speaking) return;

  if (speechSynthesis.paused) {
    speechSynthesis.resume();
    isPaused = false;
  } else {
    speechSynthesis.pause();
    isPaused = true;
  }
}

function stopSpeech() {
  speechSynthesis.cancel();
  isSpeaking = false;
  isPaused = false;
}

/***********************
 * SPEED CONTROL
 ***********************/
function changeRate(delta) {
  const newRate = Math.min(2, Math.max(0.5, currentRate + delta));
  if (newRate === currentRate) return;

  currentRate = newRate;

  if (speedLabel) {
    speedLabel.textContent = formatRate(currentRate);
    speedLabel.animate(
      [
        { transform: "scale(1)", opacity: 0.7 },
        { transform: "scale(1.15)", opacity: 1 },
        { transform: "scale(1)", opacity: 0.9 }
      ],
      { duration: 180, easing: "ease-out" }
    );
  }

  // Restart ONLY current sentence
  if (isSpeaking && !isPaused) {
    isRestarting = true;
    speechSynthesis.cancel();
    isRestarting = false;
    speakCurrentSentence();
  }
}

function formatRate(rate) {
  return rate.toFixed(2) + "×";
}

/***********************
 * VOICES
 ***********************/
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (!voices || !voices.length) return;

  currentVoice =
    voices.find(v => v.lang.toLowerCase().startsWith("en")) || null;
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

/***********************
 * KEYBOARD SHORTCUT
 ***********************/
document.addEventListener("keydown", (e) => {
  if (e.altKey && e.key.toLowerCase() === "r") {
    const text = window.getSelection().toString().trim();
    if (text) startReading(text);
  }
});

/***********************
 * SAFE DISMISS
 ***********************/
document.addEventListener("click", (e) => {
  if (popup && !popup.contains(e.target)) {
    removePopup();
  }
});
