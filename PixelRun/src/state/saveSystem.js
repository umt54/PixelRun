import { DEFAULTS, STORAGE_KEYS } from '../config.js';

function parseJsonSafe(text, fallback) {
  try {
    if (!text) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
  const parsed = parseJsonSafe(raw, null);
  if (!parsed) {
    return {
      unlockedLevel: DEFAULTS.START_LEVEL,
      highScore: 0
    };
  }
  const unlockedLevel = Number(parsed.unlockedLevel) || DEFAULTS.START_LEVEL;
  const highScore = Number(parsed.highScore) || 0;
  return { unlockedLevel, highScore };
}

export function saveProgress({ unlockedLevel, highScore }) {
  try {
    const current = loadProgress();
    const data = {
      unlockedLevel: Math.max(current.unlockedLevel, Number(unlockedLevel) || current.unlockedLevel),
      highScore: Math.max(current.highScore, Number(highScore) || 0)
    };
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(data));
    return data;
  } catch {
    return loadProgress();
  }
}

export function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  const parsed = parseJsonSafe(raw, null);
  if (!parsed) {
    return {
      soundEnabled: true
    };
  }
  return {
    soundEnabled: Boolean(parsed.soundEnabled)
  };
}

export function saveSettings({ soundEnabled }) {
  try {
    const data = { soundEnabled: Boolean(soundEnabled) };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data));
    return data;
  } catch {
    return loadSettings();
  }
}
