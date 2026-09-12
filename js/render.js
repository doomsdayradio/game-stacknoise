const THREE_MODULE_URL = "https://unpkg.com/three@0.162.0/build/three.module.js";
let threeModulePromise = null;

function loadThreeModule() {
  if (!threeModulePromise) {
    threeModulePromise = import(THREE_MODULE_URL);
  }
  return threeModulePromise;
}

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uClarity;
uniform float uConfidence;
uniform float uPower;
uniform float uPhase;
uniform float uFreq;
uniform float uFine;
uniform float uGain;
uniform float uDial;
uniform vec3 uColorErrVec;
uniform float uPatchCount;
uniform float uStage;
uniform float uFit;
uniform float uErrPower;
uniform float uErrPhase;
uniform float uErrFreq;
uniform float uErrFine;
uniform float uErrGain;
uniform float uErrDial;
uniform float uErrRoute;
uniform float uRouteSigX;
uniform float uRouteSigY;
uniform float uRouteSigZ;
uniform float uRouteLoop;
uniform float uRouteFeedback;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.45);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) +
         (c - a) * u.y * (1.0 - u.x) +
         (d - b) * u.x * u.y;
}

float linePulse(float y, float t) {
  float band = smoothstep(0.98, 1.0, sin(y * 820.0 + t * 2.8));
  float drift = smoothstep(0.96, 1.0, sin(y * 420.0 - t * 1.9));
  return max(band, drift);
}

float bars(vec2 uv, float t, float speed, float density) {
  float v = sin((uv.y + t * speed) * density);
  return smoothstep(0.85, 1.0, v);
}

void main() {
  vec2 uv = vUv;
  float t = uTime;

  float quality = clamp(uClarity, 0.0, 1.0);
  float trust = clamp(uConfidence, 0.0, 1.0);
  float fit = clamp(uFit, 0.0, 1.0);
  float lock = smoothstep(0.9, 1.0, fit);
  float mismatch = 1.0 - fit;
  float dialDirect = abs(sin(uDial * 18.8495559));
  float patchDirect = clamp(uPatchCount / 6.0, 0.0, 1.0);

  float freqBias = abs(uFreq - 0.5) * 1.6 + uErrFreq * 0.35;
  float fineBias = abs(uFine - 0.5) * 1.6 + uErrFine * 0.38;
  float gainBoost = pow(uGain, 1.15);
  float patchChaos = patchDirect + uErrRoute * 0.34;
  float dialChaos = abs(sin(uDial * 60.0));
  float phaseKick = uErrPhase * 0.3;

  float controlStress = uErrPower * 0.55 + uErrPhase * 0.6 + uErrFreq * 0.75 + uErrFine * 0.72 + uErrGain * 0.66 + uErrDial * 0.7 + uErrRoute * 0.8;
  float stress = clamp(controlStress / 4.8, 0.0, 1.0);

  float dirt = mismatch * 0.55 + (1.0 - quality) * 0.3 + gainBoost * 0.16 + freqBias * 0.06 + fineBias * 0.055;
  dirt += patchChaos * 0.1 + dialChaos * 0.04 + phaseKick;
  dirt += patchDirect * 0.12 + dialDirect * 0.1;
  dirt += stress * 0.18;
  dirt = clamp(dirt, 0.0, 1.0);

  float baseWarp = (0.03 + dirt * 0.14) * (0.45 + uErrFreq * 0.45 + uErrDial * 0.28 + dialDirect * 0.35 + patchDirect * 0.25);
  float horizontalWarp = (noise(vec2(t * 3.2, uv.y * 45.0 + uStage * 0.2)) - 0.5) * baseWarp;
  horizontalWarp += sin(uv.y * 42.0 + t * 11.0) * uErrRoute * 0.024;
  uv.x += horizontalWarp;

  float chroma = (0.002 + dirt * 0.0075) * (1.0 - lock * 0.85);
  float uvShiftR = noise(vec2(uv.y * 70.0, t * 6.0 + 1.7)) * chroma;
  float uvShiftB = noise(vec2(uv.y * 70.0, t * 6.0 + 5.2)) * chroma;

  float routeGlitchAmt = max(uErrRoute, patchDirect * 0.72);
  float dialRollAmt = max(uErrDial, dialDirect * 0.85);
  float routeSpeed = 1.35 + routeGlitchAmt * 1.1 + uRouteSigX * 0.7;
  float routeDensity = 240.0 + routeGlitchAmt * 420.0 + uRouteSigY * 260.0;
  float routeGlitch = bars(uv, t, routeSpeed, routeDensity) * routeGlitchAmt;
  float dialRoll = bars(uv, t, 0.35 + dialRollAmt * 0.7, 120.0 + dialRollAmt * 140.0) * dialRollAmt;
  float patchComb = sin((uv.x + t * (0.22 + uRouteSigZ * 0.4) + uDial * 0.4) * (30.0 + uPatchCount * 18.0 + uRouteSigX * 30.0));
  float patchMask = smoothstep(0.82, 1.0, patchComb) * (0.12 + patchDirect * 0.35);
  float phaseRipple = sin((uv.x + t * 0.35) * (18.0 + uErrPhase * 26.0) + sin(uv.y * 9.0 + t * 2.0)) * (0.018 * uErrPhase);
  uv.x += phaseRipple;

  float snowA = hash(vec2(floor(uv.x * uResolution.x * (0.7 + dirt * 0.8)), floor(uv.y * uResolution.y * (0.9 + dirt * 0.9)) + floor(t * 80.0)));
  float snowB = noise(vec2(uv.x * 540.0 + t * 15.0, uv.y * 330.0 - t * 11.0));
  float tvSnow = mix(snowA, snowB, 0.45);

  float grain = noise(vec2(uv.x * 260.0 + t * 2.2, uv.y * 160.0 - t * 1.7));
  float scan = 0.78 + 0.22 * sin((uv.y + t * 0.01) * uResolution.y * 0.72);
  float tearing = linePulse(uv.y, t) * (0.02 + dirt * 0.09);
  float freqTear = bars(uv, t, 2.3 + uErrFreq * 2.7 + uRouteSigY * 0.9, 220.0 + uErrFreq * 320.0 + uRouteSigZ * 120.0) * (0.025 + uErrFreq * 0.08 + uRouteLoop * 0.03);

  float signalFreq = 18.0 + uFreq * 58.0 + uErrFreq * 14.0;
  float phase = uPhase > 0.5 ? 3.14159265 : 0.0;
  float amp = (0.003 + mismatch * 0.085 + uErrFine * 0.04 + uErrGain * 0.022) * (1.0 - lock * 0.78);
  float center = 0.5 + sin(uv.x * signalFreq + t * (1.2 + uFine * 2.4) + phase) * amp;
  center += sin(uv.x * (signalFreq * 0.31) - t * 0.8) * (uFine - 0.5) * (0.02 + mismatch * 0.035);
  center += (noise(vec2(uv.x * 30.0, t * 3.0)) - 0.5) * (0.018 * mismatch + 0.008 * uErrRoute + uRouteLoop * 0.01);
  center += (noise(vec2(uv.x * 140.0 + t * 10.0, uv.y * 120.0 - t * 7.0)) - 0.5) * (0.02 * uErrFine);
  center += sin((uv.y + t * 0.8) * (10.0 + uRouteSigZ * 26.0)) * uRouteFeedback * 0.016;

  float band = abs(uv.y - center);
  float bandWidth = mix(0.013, 0.05, mismatch);
  float carrier = smoothstep(bandWidth + dirt * 0.015, 0.0, band);

  float signalCore = smoothstep(0.008, 0.0, band);
  float cleanLine = signalCore * lock * 0.95;

  vec3 bg = vec3(0.01, 0.018, 0.016);
  vec3 snowColor = vec3(tvSnow * (0.2 + dirt * 0.75));
  vec3 phosphor = vec3(0.20 + uErrFreq * 0.5, 0.95, 0.72 + uErrFine * 0.25) * carrier * (0.28 + trust * 0.9);
  vec3 neon = vec3(0.98, 0.18 + uErrRoute * 0.32, 0.62 + uErrDial * 0.24) * carrier * (0.12 + mismatch * 0.5);
  vec3 amberTag = vec3(0.95, 0.72, 0.28) * smoothstep(0.18, 0.0, length(uv - vec2(0.5, 0.5))) * (0.03 + quality * 0.15);
  vec3 gainTint = vec3(0.1 + uErrGain * 0.45, 0.05, 0.18 + uErrGain * 0.3);
  vec3 colorErrorTint = uColorErrVec * (0.12 + dialDirect * 0.14 + carrier * 0.24 + routeGlitchAmt * 0.08);
  vec3 patchTint = vec3(
    0.08 + patchDirect * (0.12 + uRouteSigX * 0.24),
    0.2 + patchDirect * (0.1 + uRouteSigY * 0.3),
    0.16 + patchDirect * (0.08 + uRouteSigZ * 0.22)
  );

  vec3 color = bg;
  color += snowColor * (0.22 + dirt * 0.6) * scan * (1.0 - lock * 0.7);
  color += phosphor;
  color += neon;
  color += amberTag;
  color += gainTint * (0.03 + uErrGain * 0.12) * (1.0 - lock * 0.55);
  color += colorErrorTint * (1.0 - lock * 0.42);
  color += patchTint * patchMask * (1.0 - lock * 0.5);
  color += (grain - 0.5) * (0.02 + dirt * 0.1) * (1.0 - lock * 0.7);
  color += tearing * (1.0 - lock * 0.72);
  color += routeGlitch * vec3(0.22 + uRouteSigX * 0.2, 0.24 + uRouteSigY * 0.25, 0.28 + uRouteSigZ * 0.25);
  color += dialRoll * vec3(0.14, 0.06, 0.22);
  color += freqTear * vec3(0.16, 0.25, 0.22);
  color += patchMask * uRouteFeedback * vec3(0.09, 0.13, 0.16);

  color.r += cleanLine * 0.35 + uvShiftR;
  color.g += cleanLine * 0.75;
  color.b += cleanLine * 0.28 + uvShiftB;

  float bloom = smoothstep(0.18, 0.0, abs(uv.y - 0.5)) * lock * 0.05;
  color += vec3(0.4, 0.9, 0.7) * bloom;

  if (uPower < 0.5) {
    float deadNoise = hash(vec2(floor(vUv.x * uResolution.x), floor(vUv.y * uResolution.y) + floor(t * 100.0)));
    color = vec3(deadNoise * 0.28);
    color += vec3(0.06, 0.08, 0.09) * linePulse(vUv.y, t);
  } else if (uErrPower > 0.0) {
    float brownout = bars(vUv, t, 0.5, 40.0) * uErrPower;
    color *= 1.0 - brownout * 0.45;
    color += vec3(0.05, 0.02, 0.02) * brownout;
  }

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
`;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function closeness(value, target, tolerance) {
  const safeTol = Math.max(1, tolerance || 1);
  return clamp01(1 - Math.abs(value - target) / safeTol);
}

function getColorMix(controls) {
  return {
    r: clamp01((controls.colorR || 0) / 255),
    g: clamp01((controls.colorG || 0) / 255),
    b: clamp01((controls.colorB || 0) / 255),
  };
}

function getColorDrive(controls) {
  const r = Math.max(0, Math.min(255, Math.round(controls.colorR || 0)));
  const g = Math.max(0, Math.min(255, Math.round(controls.colorG || 0)));
  const b = Math.max(0, Math.min(255, Math.round(controls.colorB || 0)));
  const spread = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
  const composite = (r * 17 + g * 31 + b * 47 + spread * 13) % 1000;
  return composite / 999;
}

function getColorErrorVec(controls, target) {
  return {
    r: clamp01(Math.abs((controls.colorR || 0) - (target.colorR || 0)) / 255),
    g: clamp01(Math.abs((controls.colorG || 0) - (target.colorG || 0)) / 255),
    b: clamp01(Math.abs((controls.colorB || 0) - (target.colorB || 0)) / 255),
  };
}

function routeMatchScore(currentRoutes, expectedRoutes) {
  const currentSet = new Set(currentRoutes || []);
  const expectedSet = new Set(expectedRoutes || []);

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

function routeFingerprint(route) {
  let hash = 2166136261;
  for (let i = 0; i < route.length; i += 1) {
    hash ^= route.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const x = ((hash >>> 0) % 997) / 997;
  const y = (((hash >>> 10) >>> 0) % 991) / 991;
  const z = (((hash >>> 20) >>> 0) % 983) / 983;
  return { x, y, z };
}

function buildRouteSignature(routes) {
  if (!Array.isArray(routes) || routes.length === 0) {
    return {
      x: 0,
      y: 0,
      z: 0,
      loop: 0,
      feedback: 0,
    };
  }

  let sx = 0;
  let sy = 0;
  let sz = 0;
  let loops = 0;
  let feedback = 0;

  for (const route of routes) {
    const fp = routeFingerprint(route);
    sx += fp.x;
    sy += fp.y;
    sz += fp.z;

    const [from, to] = route.split("->");
    if (from && to && from === to) {
      loops += 1;
    }
    if (route === "DEC->ANT" || route === "ANT->DEC") {
      feedback += 1;
    }
  }

  const count = routes.length;
  return {
    x: clamp01(sx / count),
    y: clamp01(sy / count),
    z: clamp01(sz / count),
    loop: clamp01(loops / Math.max(1, count)),
    feedback: clamp01(feedback / Math.max(1, count)),
  };
}

function computeVisualMetrics(stage, controls) {
  const target = stage.target;
  const tol = stage.tolerance;

  const powerScore = controls.power === target.power ? 1 : 0;
  const phaseScore = controls.phase === target.phase ? 1 : 0;
  const freqScore = closeness(controls.freq, target.freq, tol.freq);
  const fineScore = closeness(controls.fine, target.fine, tol.fine);
  const gainScore = closeness(controls.gain, target.gain, tol.gain);
  const colorRScore = closeness(controls.colorR, target.colorR, tol.colorR);
  const colorGScore = closeness(controls.colorG, target.colorG, tol.colorG);
  const colorBScore = closeness(controls.colorB, target.colorB, tol.colorB);
  const colorScore = (colorRScore + colorGScore + colorBScore) / 3;
  const driveScore = closeness(getColorDrive(controls), getColorDrive(target), 0.22);
  const routeScore = routeMatchScore(controls.patches, target.routes);
  const routeSig = buildRouteSignature(controls.patches);
  const colorErrVec = getColorErrorVec(controls, target);

  const fit = clamp01(
    powerScore * 0.16 +
      phaseScore * 0.08 +
      freqScore * 0.2 +
      fineScore * 0.16 +
      gainScore * 0.16 +
      colorScore * 0.14 +
      routeScore * 0.1
  );

  return {
    fit,
    errPower: 1 - powerScore,
    errPhase: 1 - phaseScore,
    errFreq: 1 - freqScore,
    errFine: 1 - fineScore,
    errGain: 1 - gainScore,
    errDial: 1 - driveScore,
    errRoute: 1 - routeScore,
    colorErrVec,
    routeSig,
  };
}

function computeDebugSnapshot(metrics, clarity, controls) {
  const quality = clamp01(clarity / 100);
  const gain = clamp01(controls.gain / 100);
  const dialDirect = Math.abs(Math.sin(getColorDrive(controls) * Math.PI * 6));
  const patchDirect = clamp01((controls.patches?.length || 0) / 6);
  const lock = clamp01((metrics.fit - 0.9) / 0.1);

  const noiseBase = clamp01(
    (1 - metrics.fit) * 0.65 +
      (1 - quality) * 0.28 +
      gain * 0.18 +
      metrics.errRoute * 0.08 +
      metrics.errFine * 0.07 +
      metrics.errFreq * 0.08 +
      metrics.errPower * 0.08 +
      metrics.errPhase * 0.06 +
      metrics.errDial * 0.07 +
      patchDirect * 0.12 +
      dialDirect * 0.1 +
      metrics.routeSig.feedback * 0.06
  );
  const noise = clamp01(noiseBase * (1 - lock * 0.72));

  const curveAmp = (0.003 + metrics.errFine * 0.055 + (1 - metrics.fit) * 0.08) * (1 - lock * 0.75);
  const curve = clamp01(curveAmp / 0.16);

  return {
    fit: clamp01(metrics.fit),
    noise,
    curve,
  };
}

function resizeRenderer(canvas, renderer) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
  }

  return { width, height };
}

function buildFallbackTracePath(width, height, time, controls, metrics, lock) {
  const path = new Path2D();
  const xStep = Math.max(1, Math.floor(width / 320));

  for (let x = 0; x <= width; x += xStep) {
    const xNorm = x / Math.max(1, width);
    const yPos =
      height *
      (0.5 +
        Math.sin((xNorm) * (16 + controls.freq * 0.6 + metrics.errFreq * 14) + time * (1.2 + controls.fine * 0.03) + (controls.phase ? Math.PI : 0) + metrics.errPhase * 0.8) *
          ((0.003 + metrics.errFine * 0.055 + (1 - metrics.fit) * 0.08) * (1 - lock * 0.75)));

    if (x === 0) {
      path.moveTo(x, yPos);
    } else {
      path.lineTo(x, yPos);
    }
  }

  return path;
}

function drawFallback2d(ctx, canvas, frame, clarity, confidence, controls, stage) {
  const width = canvas.width;
  const height = canvas.height;
  const quality = clamp01(clarity / 100);
  const trust = clamp01(confidence / 100);
  const metrics = computeVisualMetrics(stage, controls);
  const gain = clamp01(controls.gain / 100);
  const dialNorm = getColorDrive(controls);
  const colorMix = getColorMix(controls);
  const colorErrVec = metrics.colorErrVec;
  const dialDirect = Math.abs(Math.sin(dialNorm * Math.PI * 6));
  const patchDirect = clamp01((controls.patches?.length || 0) / 6);
  const dirt = clamp01(
    (1 - metrics.fit) * 0.65 +
      (1 - quality) * 0.28 +
      gain * 0.18 +
      metrics.errRoute * 0.08 +
      metrics.errFine * 0.07 +
      metrics.errFreq * 0.08 +
      metrics.errPower * 0.08 +
      metrics.errPhase * 0.06 +
      metrics.errDial * 0.07 +
      patchDirect * 0.12 +
      dialDirect * 0.1
  );
  const lock = clamp01((metrics.fit - 0.9) / 0.1);

  ctx.fillStyle = "#020605";
  ctx.fillRect(0, 0, width, height);

  const img = ctx.createImageData(width, height);
  const pixels = img.data;
  const time = frame * 0.016;
  const powerOn = controls.power;

  for (let y = 0; y < height; y++) {
    const scan = 0.82 + 0.18 * Math.sin(y * 0.6 + time * 4);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const jitter = Math.sin(y * 0.12 + time * 8 + stage.id * 0.31) * (4 + dirt * 22 + metrics.errRoute * 8 + patchDirect * 12 + metrics.routeSig.x * 9);
      const dialWobble = Math.sin(y * 0.06 + time * (5 + metrics.errDial * 8 + dialDirect * 10)) * (metrics.errDial + dialDirect * 0.9) * 10;
      const sx = Math.max(0, Math.min(width - 1, x + jitter));
      const snow = (Math.sin(sx * 12.9898 + y * 78.233 + time * 190) * 43758.5453) % 1;
      const tv = Math.abs(snow);
      const grain = (Math.sin(sx * 0.35 + y * 0.77 + time * 13.2) + 1) * 0.5;

      const carrierCenter =
        height * (0.5 +
          Math.sin((x / width) * (16 + controls.freq * 0.6 + metrics.errFreq * 14) + time * (1.2 + controls.fine * 0.03) + (controls.phase ? Math.PI : 0) + metrics.errPhase * 0.8) *
            ((0.003 + metrics.errFine * 0.055 + (1 - metrics.fit) * 0.08) * (1 - lock * 0.75)));
      const dist = Math.abs(y - carrierCenter) / height;
      const carrier = Math.max(0, 1 - dist / (0.02 + (1 - metrics.fit) * 0.05 + dirt * 0.015));
      const cleanLine = Math.max(0, 1 - dist / 0.008) * lock;

      let base = tv * (0.16 + dirt * 0.7 + patchDirect * 0.25) * scan * (1 - lock * 0.7) + (grain - 0.5) * (0.06 + dirt * 0.12) * (1 - lock * 0.7);
      base += carrier * (0.2 + trust * 0.8);
      base += Math.max(0, Math.sin((y / height) * (50 + metrics.errFreq * 80) + time * 12)) * metrics.errFreq * 0.08;
      base += Math.max(0, Math.sin((x / width) * (40 + patchDirect * 100 + metrics.routeSig.y * 80) + time * (6 + dialDirect * 8 + metrics.routeSig.z * 3))) * patchDirect * 0.08;

      if (!powerOn) {
        base = tv * 0.34 + Math.max(0, Math.sin(y * 0.35 + time * 5)) * 0.08;
      } else if (metrics.errPower > 0) {
        base *= 1 - Math.max(0, Math.sin(y * 0.12 + time * 3.4)) * metrics.errPower * 0.35;
      }

      const chroma = (1 - metrics.fit) * 55 + patchDirect * 24;
      const routeFlash = Math.max(0, Math.sin((y / height) * (180 + metrics.routeSig.z * 120) + time * (18 + metrics.routeSig.x * 6))) * Math.max(metrics.errRoute * 24, patchDirect * 18);
      const phaseTint = metrics.errPhase * 16;
      const colorCancelR = colorErrVec.r * (40 + carrier * 68 + dialDirect * 24);
      const colorCancelG = colorErrVec.g * (40 + carrier * 68 + dialDirect * 24);
      const colorCancelB = colorErrVec.b * (40 + carrier * 68 + dialDirect * 24);
      const r = Math.min(255, Math.max(0, (base * 120 + carrier * (28 + chroma * 0.35) + cleanLine * 90 + routeFlash + phaseTint + dialWobble + metrics.routeSig.x * 10 + colorCancelR) * 1.03));
      const g = Math.min(255, Math.max(0, base * 190 + carrier * 120 + cleanLine * 170 + routeFlash * 0.4 + metrics.routeSig.y * 15 + colorCancelG));
      const b = Math.min(255, Math.max(0, base * 160 + carrier * (72 + chroma * 0.2) + cleanLine * 70 + metrics.errGain * 18 + metrics.routeSig.z * 14 + colorCancelB));

      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  if (powerOn) {
    const tracePath = buildFallbackTracePath(width, height, time, controls, metrics, lock);
    const glowColor = `rgba(${Math.round(110 + colorMix.r * 45)}, ${Math.round(215 + colorMix.g * 25)}, ${Math.round(150 + colorMix.b * 35)}, ${0.22 + trust * 0.16})`;
    const traceColor = `rgba(${Math.round(210 + colorMix.r * 25)}, ${Math.round(245 + colorMix.g * 10)}, ${Math.round(220 + colorMix.b * 18)}, 0.95)`;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    ctx.strokeStyle = glowColor;
    ctx.lineWidth = Math.max(5, height * 0.016);
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = Math.max(10, height * 0.026);
    ctx.stroke(tracePath);

    ctx.strokeStyle = traceColor;
    ctx.lineWidth = Math.max(1.5, height * 0.0035);
    ctx.shadowBlur = Math.max(4, height * 0.01);
    ctx.stroke(tracePath);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(8, 16, 12, 0.08)";
  for (let y = 0; y < height; y += 3) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.restore();
}

function buildThreeRenderer(canvas, THREE) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
    uClarity: { value: 0 },
    uConfidence: { value: 0 },
    uPower: { value: 0 },
    uPhase: { value: 0 },
    uFreq: { value: 0.5 },
    uFine: { value: 0.5 },
    uGain: { value: 0.4 },
    uDial: { value: 0 },
    uColorErrVec: { value: new THREE.Vector3(0, 0, 0) },
    uPatchCount: { value: 0 },
    uStage: { value: 1 },
    uFit: { value: 0 },
    uErrPower: { value: 1 },
    uErrPhase: { value: 1 },
    uErrFreq: { value: 1 },
    uErrFine: { value: 1 },
    uErrGain: { value: 1 },
    uErrDial: { value: 1 },
    uErrRoute: { value: 1 },
    uRouteSigX: { value: 0 },
    uRouteSigY: { value: 0 },
    uRouteSigZ: { value: 0 },
    uRouteLoop: { value: 0 },
    uRouteFeedback: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthWrite: false,
    depthTest: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  return { renderer, scene, camera, uniforms };
}

export function createRenderer(canvas) {
  let ctx2d = null;
  let frame = 0;
  let threeReady = null;
  let loadingStarted = false;
  let loadingFailed = false;

  function get2dContext() {
    if (!ctx2d) {
      ctx2d = canvas.getContext("2d");
    }
    return ctx2d;
  }

  function ensureThree() {
    if (loadingStarted || loadingFailed) {
      return;
    }

    loadingStarted = true;
    loadThreeModule()
      .then((THREE) => {
        threeReady = buildThreeRenderer(canvas, THREE);
      })
      .catch(() => {
        loadingFailed = true;
      });
  }

  function draw({ clarity, confidence, controls, stage }) {
    frame += 1;
    ensureThree();
    const metrics = computeVisualMetrics(stage, controls);
    const debug = computeDebugSnapshot(metrics, clarity, controls);

    if (!threeReady || loadingFailed) {
      if (loadingFailed) {
        drawFallback2d(get2dContext(), canvas, frame, clarity, confidence, controls, stage);
      }
      return debug;
    }

    const { renderer, scene, camera, uniforms } = threeReady;
    const size = resizeRenderer(canvas, renderer);
    uniforms.uResolution.value.set(size.width, size.height);
    uniforms.uTime.value += 0.016;

    uniforms.uClarity.value = clamp01(clarity / 100);
    uniforms.uConfidence.value = clamp01(confidence / 100);
    uniforms.uPower.value = controls.power ? 1 : 0;
    uniforms.uPhase.value = controls.phase ? 1 : 0;
    uniforms.uFreq.value = clamp01(controls.freq / 100);
    uniforms.uFine.value = clamp01((controls.fine + 50) / 100);
    uniforms.uGain.value = clamp01(controls.gain / 100);
    uniforms.uDial.value = getColorDrive(controls);
    uniforms.uColorErrVec.value.set(metrics.colorErrVec.r, metrics.colorErrVec.g, metrics.colorErrVec.b);
    uniforms.uPatchCount.value = Array.isArray(controls.patches) ? controls.patches.length : 0;
    uniforms.uStage.value = stage.id;
    uniforms.uFit.value = metrics.fit;
    uniforms.uErrPower.value = metrics.errPower;
    uniforms.uErrPhase.value = metrics.errPhase;
    uniforms.uErrFreq.value = metrics.errFreq;
    uniforms.uErrFine.value = metrics.errFine;
    uniforms.uErrGain.value = metrics.errGain;
    uniforms.uErrDial.value = metrics.errDial;
    uniforms.uErrRoute.value = metrics.errRoute;
    uniforms.uRouteSigX.value = metrics.routeSig.x;
    uniforms.uRouteSigY.value = metrics.routeSig.y;
    uniforms.uRouteSigZ.value = metrics.routeSig.z;
    uniforms.uRouteLoop.value = metrics.routeSig.loop;
    uniforms.uRouteFeedback.value = metrics.routeSig.feedback;

    renderer.render(scene, camera);
    return debug;
  }

  return { draw };
}
