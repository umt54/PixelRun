// Global configuration and small helpers

export const GAME = {
  WIDTH: 800,
  HEIGHT: 480,
  BACKGROUND_COLOR: 0x101428
};

export const PHYSICS = {
  GRAVITY_Y: 1100,
  PLAYER: {
    ACCEL: 900,
    MAX_VEL_X: 300,
    MAX_VEL_Y: 1000,
    DRAG_X: 900,
    JUMP_SPEED: -420,
    JUMP_MAX_HOLD_MS: 180
  },
  WORLD_BOUNDS: { x: 0, y: 0, width: 8000, height: 2000 }
};

export const UI = {
  SCORE_PER_COIN: 10
};

export const DEFAULTS = {
  TIME_LIMIT: 120, // seconds
  START_LEVEL: 1,
  MAX_LEVELS: 3
};

export const STORAGE_KEYS = {
  PROGRESS: 'jumprun.progress',
  SETTINGS: 'jumprun.settings'
};

export const CONTROLS = {
  MUTE_TOGGLE_KEY: 'M',
  PAUSE_TOGGLE_KEY: 'P'
};

// Tiny SFX helper using WebAudio via Phaser Sound context.
// Generates placeholder beeps; respects saved "soundEnabled".
export function playBeep(scene, freq = 440, durMs = 120, type = 'sine') {
  const settings = scene.registry.get('settings') || { soundEnabled: true };
  if (!settings.soundEnabled) return;

  const ctx = scene.sound?.context;
  if (!ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
  o.connect(g).connect(ctx.destination);
  o.start(now);
  o.stop(now + durMs / 1000 + 0.02);
}
