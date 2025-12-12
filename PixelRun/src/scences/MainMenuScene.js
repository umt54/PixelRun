import Phaser from 'phaser';
import levelsData from '../level/levels.json';
import { loadProgress, loadSettings, saveSettings } from '../state/saveSystem.js';
import { DEFAULTS, CONTROLS, playBeep } from '../config.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
    this.mode = 'root'; // root | levelselect | settings
    this.menuTexts = [];
    this.playerCount = 1;
  }

  create() {
    this.add.text(400, 100, 'PixelRun', { fontSize: 48, color: '#E7F0FF' }).setOrigin(0.5);

    this.progress = loadProgress();
    const settings = loadSettings();
    this.registry.set('settings', settings);
    this.playerCount = this.registry.get('playerCount') || 1;

    const info = [
      `Enter/Click: Auswahl`,
      `Tasten: Pfeile/WASD zum Bewegen, Space zum Springen`,
      `M: Mute/Unmute`
    ];
    this.add.text(400, 150, info.join('\n'), { fontSize: 14, color: '#A0A8BD', align: 'center' }).setOrigin(0.5);

    this.renderPlayerModePrompt();

    this.input.keyboard.on('keydown-ESC', () => {
      this.mode = 'root';
      this.renderRootMenu();
    });
  }

  clearMenu() {
    this.menuTexts.forEach(t => t.destroy());
    this.menuTexts = [];
  }

  renderPlayerModePrompt() {
    this.clearMenu();
    this.mode = 'modeSelect';
    const title = this.add.text(400, 210, 'Modus waehlen', { fontSize: 32, color: '#E7F0FF' }).setOrigin(0.5);
    const hint = this.add
      .text(400, 245, 'Singleplayer oder 2-Spieler-Koop?', { fontSize: 16, color: '#A0A8BD' })
      .setOrigin(0.5);
    this.menuTexts.push(title, hint);

    const items = [
      { label: 'Singleplayer', action: () => this.setPlayerMode(1) },
      { label: '2 Spieler (Koop)', action: () => this.setPlayerMode(2) }
    ];
    this.createButtons(items, 280);
  }

  setPlayerMode(count) {
    this.playerCount = count === 2 ? 2 : 1;
    this.registry.set('playerCount', this.playerCount);
    this.mode = 'root';
    this.renderRootMenu();
  }

  renderRootMenu() {
    this.clearMenu();
    const currentMode = this.playerCount === 2 ? '2 Spieler (Koop)' : 'Singleplayer';
    const modeLabel = this.add
      .text(400, 195, `Aktueller Modus: ${currentMode}`, { fontSize: 18, color: '#7cceff' })
      .setOrigin(0.5);
    this.menuTexts.push(modeLabel);
    const items = [
      { label: 'Modus aendern', action: () => this.renderPlayerModePrompt() },
      { label: 'Start (Level 1)', action: () => this.startLevel(DEFAULTS.START_LEVEL) },
      { label: 'Levelauswahl', action: () => { this.mode = 'levelselect'; this.renderLevelSelect(); } },
      { label: 'Einstellungen', action: () => { this.mode = 'settings'; this.renderSettings(); } }
    ];
    this.createButtons(items, 220);
  }

  renderLevelSelect() {
    this.clearMenu();
    const unlocked = this.progress.unlockedLevel;
    const toLabel = (lvl) => lvl <= unlocked ? `Level ${lvl}: ${levelsData.levels.find(l => l.id === lvl)?.name || ''}` : `Level ${lvl}: [gesperrt]`;
    const items = levelsData.levels.map(l => ({
      label: toLabel(l.id),
      action: () => {
        if (l.id <= unlocked) {
          this.startLevel(l.id);
        } else {
          playBeep(this, 160, 80, 'sawtooth');
        }
      },
      enabled: l.id <= unlocked
    }));
    items.push({ label: 'Zurück', action: () => { this.mode = 'root'; this.renderRootMenu(); } });
    this.createButtons(items, 220);
  }

  renderSettings() {
    this.clearMenu();
    const settings = this.registry.get('settings');
    const items = [
      {
        label: `Sound: ${settings.soundEnabled ? 'AN' : 'AUS'} (Taste ${CONTROLS.MUTE_TOGGLE_KEY})`,
        action: () => {
          const s = saveSettings({ soundEnabled: !settings.soundEnabled });
          this.registry.set('settings', s);
          this.renderSettings();
          playBeep(this, s.soundEnabled ? 880 : 220, 100, 'square');
        }
      },
      { label: 'Zurück', action: () => { this.mode = 'root'; this.renderRootMenu(); } }
    ];
    this.createButtons(items, 220);

    // Also allow keyboard toggle
    this.input.keyboard.once(`keydown-${CONTROLS.MUTE_TOGGLE_KEY}`, () => {
      const s = saveSettings({ soundEnabled: !settings.soundEnabled });
      this.registry.set('settings', s);
      this.renderSettings();
      playBeep(this, s.soundEnabled ? 880 : 220, 100, 'square');
    });
  }

  createButtons(items, startY) {
    let y = startY;
    items.forEach(({ label, action, enabled = true }) => {
      const t = this.add.text(400, y, label, {
        fontSize: 24,
        color: enabled ? '#E7F0FF' : '#666C80'
      }).setOrigin(0.5).setInteractive({ useHandCursor: enabled });

      if (enabled) {
        t.on('pointerover', () => t.setColor('#7cceff'));
        t.on('pointerout', () => t.setColor('#E7F0FF'));
        t.on('pointerup', () => action());
      }

      this.menuTexts.push(t);
      y += 40;
    });

    // Keyboard Enter selects the first
    this.input.keyboard.once('keydown-ENTER', () => {
      const first = items.find(i => i.enabled !== false);
      if (first) first.action();
    });
  }

  startLevel(levelId) {
    playBeep(this, 520, 80, 'triangle');
    this.scene.start('LevelScene', { levelId, scoreCarry: 0, playerCount: this.playerCount });
  }
}
