import { STAGES } from "./stages.js";

function lowestScoringValue(target, min, max) {
  const minDelta = Math.abs(min - target);
  const maxDelta = Math.abs(max - target);
  return minDelta >= maxDelta ? min : max;
}

function stageModulationDefaults(stageIndex = 0) {
  const stage = STAGES[clampStage(stageIndex)] ?? STAGES[0];
  return {
    freq: lowestScoringValue(stage.target.freq, 0, 100),
    fine: lowestScoringValue(stage.target.fine, -50, 50),
    gain: lowestScoringValue(stage.target.gain, 0, 100),
  };
}

export function defaultControls(stageIndex = 0) {
  const modulationDefaults = stageModulationDefaults(stageIndex);

  return {
    power: false,
    phase: false,
    freq: modulationDefaults.freq,
    fine: modulationDefaults.fine,
    gain: modulationDefaults.gain,
    colorR: 0,
    colorG: 0,
    colorB: 0,
    patches: [],
  };
}

export function createInitialState(saved) {
  const base = {
    language: "de",
    audioEnabled: false,
    stageIndex: 0,
    maxUnlockedStage: 0,
    attempts: 0,
    tutorialSeen: false,
    controls: defaultControls(0),
    clarity: 0,
    confidence: 0,
    decodedText: "",
    codewordSeen: false,
    hints: [],
    justCompleted: false,
  };

  if (!saved) {
    return base;
  }

  return {
    ...base,
    ...saved,
    stageIndex: clampStage(saved.stageIndex ?? 0),
    maxUnlockedStage: clampStage(saved.maxUnlockedStage ?? 0),
    controls: { ...defaultControls(saved.stageIndex ?? 0), ...(saved.controls ?? {}) },
    codewordSeen: Boolean(saved.codewordSeen),
    hints: Array.isArray(saved.hints) ? saved.hints : [],
  };
}

export function clampStage(value) {
  return Math.max(0, Math.min(STAGES.length - 1, value));
}

export function serializeState(state) {
  return {
    language: state.language,
    audioEnabled: state.audioEnabled,
    stageIndex: state.stageIndex,
    maxUnlockedStage: state.maxUnlockedStage,
    attempts: state.attempts,
    tutorialSeen: state.tutorialSeen,
    controls: state.controls,
    codewordSeen: state.codewordSeen,
  };
}
