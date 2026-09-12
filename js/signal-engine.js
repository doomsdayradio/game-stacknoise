function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export const COMPLETION_CLARITY = 88;
export const COMPLETION_CONFIDENCE = 84;

function closeness(value, target, tolerance) {
  const delta = Math.abs(value - target);
  return clamp01(1 - delta / tolerance);
}

function routeMatches(current, expected) {
  const currentSet = new Set(current);
  const expectedSet = new Set(expected);
  let exact = 0;
  for (const route of currentSet) {
    if (expectedSet.has(route)) {
      exact += 1;
    }
  }
  const coverage = expectedSet.size === 0 ? 1 : exact / expectedSet.size;
  const noisePenalty = currentSet.size > expectedSet.size ? (currentSet.size - expectedSet.size) * 0.07 : 0;
  return clamp01(coverage - noisePenalty);
}

function getRequiredPatchPorts(routes) {
  const portOrder = ["ANT", "PRE", "FLT", "DEC"];
  const ports = new Set();

  for (const route of routes || []) {
    const [from, to] = String(route).split("->");
    if (from) {
      ports.add(from);
    }
    if (to) {
      ports.add(to);
    }
  }

  return portOrder.filter((port) => ports.has(port));
}

function formatList(items, language) {
  if (!items.length) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return language === "de" ? `${items[0]} und ${items[1]}` : `${items[0]} and ${items[1]}`;
  }

  const last = items[items.length - 1];
  const rest = items.slice(0, -1).join(", ");
  return language === "de" ? `${rest} und ${last}` : `${rest}, and ${last}`;
}

function getWeakColorChannels(scores, language, textLookup) {
  const ranked = [
    { label: textLookup("colorRed"), score: scores.colorR },
    { label: textLookup("colorGreen"), score: scores.colorG },
    { label: textLookup("colorBlue"), score: scores.colorB },
  ]
    .filter((entry) => entry.score < 0.84)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((entry) => entry.label);

  return formatList(ranked, language);
}

export function evaluateSignal(stage, controls, language, textLookup) {
  const target = stage.target;
  const tol = stage.tolerance;
  const colorEnabled = stage.id > 1;

  const powerScore = controls.power === target.power ? 1 : 0;
  const phaseScore = controls.phase === target.phase ? 1 : 0;
  const freqScore = closeness(controls.freq, target.freq, tol.freq);
  const fineScore = closeness(controls.fine, target.fine, tol.fine);
  const gainScore = closeness(controls.gain, target.gain, tol.gain);
  const colorRScore = closeness(controls.colorR, target.colorR, tol.colorR);
  const colorGScore = closeness(controls.colorG, target.colorG, tol.colorG);
  const colorBScore = closeness(controls.colorB, target.colorB, tol.colorB);
  const colorScore = (colorRScore + colorGScore + colorBScore) / 3;
  const routeScore = routeMatches(controls.patches, target.routes);

  const weights = colorEnabled
    ? { power: 0.16, phase: 0.08, freq: 0.14, fine: 0.1, gain: 0.1, color: 0.32, route: 0.1 }
    : { power: 0.16, phase: 0.08, freq: 0.2, fine: 0.16, gain: 0.16, color: 0.14, route: 0.1 };

  const weighted =
    powerScore * weights.power +
    phaseScore * weights.phase +
    freqScore * weights.freq +
    fineScore * weights.fine +
    gainScore * weights.gain +
    colorScore * weights.color +
    routeScore * weights.route;

  const clarity = Math.round(clamp01(weighted) * 100);
  const confidence = Math.round(clamp01(weighted * 0.88 + routeScore * 0.12) * 100);

  const hints = [];

  const outputText = stage.message[language] || stage.message.en;
  const decoded = scrambleMessage(outputText, clarity);
  const completed = clarity >= COMPLETION_CLARITY && confidence >= COMPLETION_CONFIDENCE;

  if (!controls.power) {
    hints.unshift(textLookup("hintPowerOff"));
  } else if (clarity < 45) {
    hints.unshift(textLookup("hintFar"));
  } else if (clarity < 75) {
    hints.unshift(textLookup("hintClose"));
  } else {
    hints.unshift(textLookup("hintPowerOn"));
  }

  if (colorEnabled && colorScore < 0.95) {
    hints.push(colorScore < 0.5 ? textLookup("hintRgbFar") : textLookup("hintRgbClose"));
    const weakChannels = getWeakColorChannels(
      { colorR: colorRScore, colorG: colorGScore, colorB: colorBScore },
      language,
      textLookup
    );
    if (weakChannels) {
      hints.push(textLookup("hintRgbChannels").replace("{channels}", weakChannels));
    }
  }

  const requiredPatchPorts = getRequiredPatchPorts(target.routes);
  if (requiredPatchPorts.length && routeScore < 1) {
    hints.push(textLookup("hintPatchPorts").replace("{ports}", requiredPatchPorts.join(", ")));
  }

  return { clarity, confidence, hints, decoded, completed };
}

function scrambleMessage(message, clarity) {
  const revealChance = clarity / 100;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let output = "";

  for (const char of message) {
    if (char === " " || char === "." || char === "," || char === "-") {
      output += char;
      continue;
    }

    if (Math.random() < revealChance) {
      output += char;
      continue;
    }

    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return output;
}
