import Phaser from 'phaser';
import { loadSettings } from '../state/saveSystem.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Load persisted settings into registry (global shared store)
    const settings = loadSettings();
    this.registry.set('settings', settings);

    // Apply mute state for generated SFX (we'll use WebAudio directly)
    if (this.sound) {
      // Phaser's Sound mute only affects decoded audio; our WebAudio helper checks registry
      this.sound.setMute(!settings.soundEnabled);
    }

    // Minimal boot transition
    this.scene.start('PreloadScene');
  }
}
