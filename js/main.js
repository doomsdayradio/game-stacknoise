import { STRINGS, t } from "./i18n.js";
import { STAGES } from "./stages.js";
import { loadSave, saveState, clearSave } from "./storage.js";
import { createInitialState, serializeState, defaultControls } from "./state.js";
import { COMPLETION_CLARITY, COMPLETION_CONFIDENCE, evaluateSignal } from "./signal-engine.js";
import { createRenderer } from "./render.js";
import { wireControls } from "./controls.js";
import { ensureAudioStarted, updateAudio } from "./audio.js";

const state = createInitialState(loadSave());

function applyLoadStartValues() {
  state.controls = defaultControls(state.stageIndex);
  state.attempts = 0;
  state.clarity = 0;
  state.confidence = 0;
  state.decodedText = "";
  state.codewordSeen = false;
  state.hints = [];
  state.justCompleted = false;
}

applyLoadStartValues();

const canvas = document.getElementById("signal-canvas");
const renderer = createRenderer(canvas);

const clarityLabel = document.getElementById("clarity-label");
const lockClarityLeds = document.getElementById("lock-clarity-leds");
const lockProgressLeds = document.getElementById("lock-progress-leds");
const lockClarityValue = document.getElementById("lock-clarity-value");
const lockProgressValue = document.getElementById("lock-progress-value");
const debugFit = document.getElementById("debug-fit");
const debugNoise = document.getElementById("debug-noise");
const debugCurve = document.getElementById("debug-curve");
const outputScreen = document.getElementById("signal-output");
const hintOpen = document.getElementById("hint-open");
const hintText = document.getElementById("hint-text");
const hintNext = document.getElementById("hint-next");
const codewordInput = document.getElementById("codeword-input");
const codewordSubmit = document.getElementById("codeword-submit");
const stageChip = document.getElementById("stage-chip");
const helpOpen = document.getElementById("help-open");

const tutorialOverlay = document.getElementById("tutorial-overlay");
const tutorialTitle = document.getElementById("tutorial-title");
const tutorialBody = document.getElementById("tutorial-body");
const tutorialPrev = document.getElementById("tutorial-prev");
const tutorialNext = document.getElementById("tutorial-next");
const tutorialSkip = document.getElementById("tutorial-skip");
const stageOverlay = document.getElementById("stage-overlay");
const stageTitle = document.getElementById("stage-title");
const stageBody = document.getElementById("stage-body");
const stageContinue = document.getElementById("stage-continue");
const victoryOverlay = document.getElementById("victory-overlay");
const victoryTitle = document.getElementById("victory-title");
const victoryBody = document.getElementById("victory-body");
const victoryClose = document.getElementById("victory-close");
const helpOverlay = document.getElementById("help-overlay");
const helpClose = document.getElementById("help-close");
const hintOverlay = document.getElementById("hint-overlay");
const hintClose = document.getElementById("hint-close");

let tutorialStep = 0;
let lastLiveEvalAt = 0;
let hintIndex = 0;
let lastHintSignature = "";

const ui = wireControls({
  state,
  onChange: () => {
    save();
  },
  onAddPatch: (route) => {
    if (!state.controls.patches.includes(route)) {
      state.controls.patches.push(route);
    }
  },
  onClearPatches: () => {
    state.controls.patches = [];
  },
  onSetLanguage: setLanguage,
  onToggleAudio: toggleAudio,
  onResetProgress: resetProgress,
});

function currentStage() {
  return STAGES[state.stageIndex];
}

function save() {
  saveState(serializeState(state));
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCodewordEntryUnlocked() {
  return Boolean(state.controls.power) && state.clarity >= 80 && state.codewordSeen;
}

function applyLanguage() {
  const langStrings = STRINGS[state.language];
  document.documentElement.lang = state.language;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    node.textContent = langStrings[key] ?? key;
  });

  document.querySelectorAll("[data-help-lang]").forEach((node) => {
    node.hidden = node.dataset.helpLang !== state.language;
  });

  ui.setLanguageValue(state.language);
  ui.setAudioLabel(t(state.language, state.audioEnabled ? "audioOn" : "audioOff"));
}

function ensureLedStrip(container) {
  if (!container || container.children.length) {
    return;
  }

  for (let i = 0; i < 20; i += 1) {
    const led = document.createElement("span");
    led.className = "lock-led";
    container.append(led);
  }
}

function paintLedStrip(container, value, warnThreshold = 50) {
  if (!container) {
    return;
  }

  const leds = Array.from(container.children);
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * leds.length);
  leds.forEach((led, index) => {
    const on = index < lit;
    led.classList.toggle("on", on);
    led.classList.toggle("warn", on && value < warnThreshold);
  });
}

function renderStatus() {
  const stage = currentStage();
  const stageCleared = state.justCompleted || state.stageIndex < state.maxUnlockedStage;
  const stageProgress = Math.max(0, Math.min(100, Math.round(((state.stageIndex + (stageCleared ? 1 : 0)) / STAGES.length) * 100)));
  const powerOn = Boolean(state.controls.power);
  let codewordHighlighted = false;

  stageChip.textContent = `${stage.name[state.language]} (${stage.id}/${STAGES.length})`;
  clarityLabel.textContent = `${state.clarity}%`;
  lockClarityValue.textContent = `${state.clarity}%`;
  lockProgressValue.textContent = `${stageProgress}%`;
  paintLedStrip(lockClarityLeds, state.clarity, 58);
  paintLedStrip(lockProgressLeds, stageProgress, 35);

  outputScreen.classList.toggle("display-off", !powerOn);

  if (!powerOn) {
    outputScreen.textContent = "";
  } else if (!state.decodedText) {
    outputScreen.textContent = "...";
  } else {
    const codeword = stage.codeword?.[state.language] ?? stage.codeword?.en ?? "";
    if (codeword) {
      const escaped = state.decodedText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const regex = new RegExp(escapeRegex(codeword), "gi");
      codewordHighlighted = regex.test(state.decodedText);
      regex.lastIndex = 0;
      const highlighted = escaped.replace(regex, match => `<span class='codeword-highlight'>${match}</span>`);
      outputScreen.innerHTML = highlighted;
    } else {
      outputScreen.textContent = state.decodedText;
    }
  }

  if (powerOn && codewordHighlighted && !state.codewordSeen) {
    state.codewordSeen = true;
    save();
  }

  const codewordUnlocked = isCodewordEntryUnlocked();
  codewordInput.disabled = !codewordUnlocked;
  codewordSubmit.disabled = !codewordUnlocked;

  renderHintDialog();
}

function renderHintDialog() {
  const hints = Array.isArray(state.hints) ? state.hints : [];
  const signature = hints.join("||");
  if (signature !== lastHintSignature) {
    hintIndex = 0;
    lastHintSignature = signature;
  }

  if (!hints.length) {
    hintText.textContent = "...";
    hintNext.disabled = true;
    return;
  }

  hintIndex = ((hintIndex % hints.length) + hints.length) % hints.length;
  hintText.textContent = hints[hintIndex];
  hintNext.disabled = false;
}

function runEvaluation({ countAttempt }) {
  const stage = currentStage();
  const result = evaluateSignal(stage, state.controls, state.language, (key) => t(state.language, key));
  const previousCompleted = state.justCompleted;
  const previousUnlocked = state.maxUnlockedStage;

  if (countAttempt) {
    state.attempts += 1;
  }

  state.clarity = result.clarity;
  state.confidence = result.confidence;
  state.decodedText = result.decoded;
  state.hints = result.hints;

  if (result.completed) {
    state.justCompleted = true;
    state.maxUnlockedStage = Math.max(state.maxUnlockedStage, Math.min(state.stageIndex + 1, STAGES.length - 1));
    if (!previousCompleted) {
      state.hints.unshift(
        state.stageIndex === STAGES.length - 1 ? t(state.language, "finalComplete") : t(state.language, "stageComplete")
      );
      if (state.stageIndex === STAGES.length - 1) {
        openVictoryDialog();
      }
    }
  } else {
    state.justCompleted = false;
  }

  if (countAttempt || previousUnlocked !== state.maxUnlockedStage) {
    save();
  }

  renderStatus();
}

async function handleStageContinue() {
  closeStageBriefing();

  await ensureAudioStarted();
  state.audioEnabled = true;
  ui.setAudioLabel(t(state.language, "audioOn"));
  save();
}

function advanceStage() {
  if (!state.justCompleted && state.stageIndex >= state.maxUnlockedStage) {
    state.hints = [t(state.language, "statusLocked")];
    renderStatus();
    return;
  }

  const next = Math.min(state.stageIndex + 1, STAGES.length - 1);
  if (next === state.stageIndex) {
    return;
  }

  state.stageIndex = next;
  state.controls = defaultControls(state.stageIndex);
  state.attempts = 0;
  state.clarity = 0;
  state.confidence = 0;
  state.decodedText = "";
  state.codewordSeen = false;
  state.hints = [];
  state.justCompleted = false;
  codewordInput.value = "";

  ui.syncControls();
  save();
  renderStatus();
  openStageBriefing();
}

function normalizeWord(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\u00c4/g, "AE")
    .replace(/\u00d6/g, "OE")
    .replace(/\u00dc/g, "UE")
    .replace(/\u1e9e/g, "SS")
    .replace(/\u00df/g, "SS")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function submitCodeword() {
  if (!isCodewordEntryUnlocked()) {
    return;
  }

  const stage = currentStage();
  const expected = normalizeWord(stage.codeword?.[state.language] ?? stage.codeword?.en ?? "");
  const submitted = normalizeWord(codewordInput.value);

  if (!expected || !submitted) {
    return;
  }

  if (submitted === expected) {
    const isFinalStage = state.stageIndex === STAGES.length - 1;
    state.justCompleted = true;
    state.maxUnlockedStage = Math.max(state.maxUnlockedStage, Math.min(state.stageIndex + 1, STAGES.length - 1));

    if (isFinalStage) {
      state.hints.unshift(t(state.language, "finalComplete"));
      save();
      renderStatus();
      openVictoryDialog();
      return;
    }

    advanceStage();
    return;
  }

  state.hints.unshift(t(state.language, "codewordFail"));
  window.alert(t(state.language, "codewordFailPopup"));
  renderStatus();
}

function setLanguage(nextLanguage) {
  if (nextLanguage !== "de" && nextLanguage !== "en") {
    return;
  }

  state.language = nextLanguage;
  applyLanguage();
  if (stageOverlay.classList.contains("visible")) {
    renderStageBriefing();
  }
  if (victoryOverlay.classList.contains("visible")) {
    renderVictoryDialog();
  }
  renderStatus();
  save();
}

async function toggleAudio() {
  if (!state.audioEnabled) {
    await ensureAudioStarted();
  }
  state.audioEnabled = !state.audioEnabled;
  ui.setAudioLabel(t(state.language, state.audioEnabled ? "audioOn" : "audioOff"));
  save();
}

function resetProgress() {
  if (!window.confirm(t(state.language, "resetAsk"))) {
    return;
  }

  clearSave();
  const fresh = createInitialState(null);
  Object.assign(state, fresh);
  applyLanguage();
  ui.syncControls();
  renderStatus();
  openTutorial();
}

function openTutorial() {
  tutorialStep = 0;
  tutorialOverlay.classList.add("visible");
  renderTutorial();
}

function closeTutorial() {
  tutorialOverlay.classList.remove("visible");
  state.tutorialSeen = true;
  save();
  openStageBriefing();
}

function renderStageBriefing() {
  const stage = currentStage();
  stageTitle.textContent = `${t(state.language, "stageBriefing")} - ${stage.name[state.language]} (${stage.id}/${STAGES.length})`;
  stageBody.textContent = stage.briefing?.[state.language] ?? stage.briefing?.en ?? "";
  stageContinue.textContent = t(state.language, "stageContinue");
}

function renderVictoryDialog() {
  victoryTitle.textContent = t(state.language, "victoryTitle");
  victoryBody.textContent = t(state.language, "victoryBody");
  victoryClose.textContent = t(state.language, "victoryClose");
}

function openVictoryDialog() {
  renderVictoryDialog();
  victoryOverlay.classList.add("visible");
}

function closeVictoryDialog() {
  victoryOverlay.classList.remove("visible");
}

function openHelpDialog() {
  helpOverlay.classList.add("visible");
}

function closeHelpDialog() {
  helpOverlay.classList.remove("visible");
}

function openHintDialog() {
  renderHintDialog();
  hintOverlay.classList.add("visible");
}

function closeHintDialog() {
  hintOverlay.classList.remove("visible");
}

function openInsiderPage() {
  closeVictoryDialog();
  window.location.href = "./insider.html";
}

function openStageBriefing() {
  if (tutorialOverlay.classList.contains("visible")) {
    return;
  }

  renderStageBriefing();
  stageOverlay.classList.add("visible");
}

function closeStageBriefing() {
  stageOverlay.classList.remove("visible");
}

function renderTutorial() {
  const steps = STRINGS[state.language].tutorial;
  const item = steps[tutorialStep];
  tutorialTitle.textContent = item.title;
  tutorialBody.textContent = item.body;
  tutorialPrev.disabled = tutorialStep === 0;
  tutorialNext.textContent = tutorialStep === steps.length - 1 ? t(state.language, "tutorialDone") : t(state.language, "tutorialNext");
}

tutorialPrev.addEventListener("click", () => {
  tutorialStep = Math.max(0, tutorialStep - 1);
  renderTutorial();
});

tutorialNext.addEventListener("click", () => {
  const max = STRINGS[state.language].tutorial.length - 1;
  if (tutorialStep >= max) {
    closeTutorial();
    return;
  }
  tutorialStep += 1;
  renderTutorial();
});

tutorialSkip.addEventListener("click", closeTutorial);
stageContinue.addEventListener("click", handleStageContinue);
victoryClose.addEventListener("click", openInsiderPage);
helpOpen.addEventListener("click", openHelpDialog);
helpClose.addEventListener("click", closeHelpDialog);
hintOpen.addEventListener("click", openHintDialog);
hintClose.addEventListener("click", closeHintDialog);
hintNext.addEventListener("click", () => {
  if (!state.hints.length) {
    return;
  }
  hintIndex = (hintIndex + 1) % state.hints.length;
  renderHintDialog();
});
codewordSubmit.addEventListener("click", submitCodeword);
codewordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitCodeword();
  }
});

function gameLoop() {
  const now = performance.now();
  if (now - lastLiveEvalAt >= 180) {
    runEvaluation({ countAttempt: false });
    lastLiveEvalAt = now;
  }

  const visual = renderer.draw({
    clarity: state.clarity,
    confidence: state.confidence,
    controls: state.controls,
    stage: currentStage(),
  });

  if (visual) {
    debugFit.textContent = `${Math.round(visual.fit * 100)}%`;
    debugNoise.textContent = `${Math.round(visual.noise * 100)}%`;
    debugCurve.textContent = `${Math.round(visual.curve * 100)}%`;
  }

  updateAudio({
    enabled: state.audioEnabled,
    confidence: state.confidence,
    stageIndex: state.stageIndex,
  });

  requestAnimationFrame(gameLoop);
}

applyLanguage();
ensureLedStrip(lockClarityLeds);
ensureLedStrip(lockProgressLeds);
ui.syncControls();
renderStatus();
if (!state.tutorialSeen) {
  openTutorial();
} else {
  openStageBriefing();
}

gameLoop();
