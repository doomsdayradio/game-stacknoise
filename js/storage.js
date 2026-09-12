const STORAGE_KEY = "cosmic-noise-save-v1";

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveState(serialized) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
}

export function clearSave() {
  localStorage.removeItem(STORAGE_KEY);
}
