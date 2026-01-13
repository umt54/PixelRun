import Phaser from 'phaser';
import levelsData from '../level/levels.json';
import { loadProgress, loadSettings, saveSettings } from '../state/saveSystem.js';
import { GAME, DEFAULTS, CONTROLS, playBeep } from '../config.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
    this.mode = 'root'; // root | levelselect | settings
    this.menuTexts = [];
    this.playerCount = 1;
    this.ui = {
      fontFamily: 'Trebuchet MS, sans-serif',
      colors: {
        title: '#FFF2C9',
        body: '#F4E9CF',
        accent: '#FFD27A',
        hover: '#FFEAA6',
        disabled: '#7A7F8C',
        shadow: '#1a1208'
      }
    };
  }

  create() {
    const bg = this.add.image(GAME.WIDTH / 2, GAME.HEIGHT / 2, 'menu_bg');
    const scale = Math.max(GAME.WIDTH / bg.width, GAME.HEIGHT / bg.height);
    bg.setScale(scale).setDepth(-10);

    this.add
      .text(400, 100, 'PixelRun', {
        fontFamily: this.ui.fontFamily,
        fontSize: 52,
        color: this.ui.colors.title,
        stroke: this.ui.colors.shadow,
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setShadow(0, 3, this.ui.colors.shadow, 6, false, true);

    this.progress = loadProgress();
    const settings = loadSettings();
    this.registry.set('settings', settings);
    this.playerCount = this.registry.get('playerCount') || 1;

    const info = [
      `Enter/Click: Auswahl`,
      `Tasten: Pfeile/WASD zum Bewegen, Space zum Springen`,
      `M: Mute/Unmute`
    ];
    this.add
      .text(400, 150, info.join('\n'), {
        fontFamily: this.ui.fontFamily,
        fontSize: 15,
        color: this.ui.colors.body,
        align: 'center',
        stroke: this.ui.colors.shadow,
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setShadow(0, 2, this.ui.colors.shadow, 4, false, true);

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
    const title = this.add
      .text(400, 210, 'Modus wählen', {
        fontFamily: this.ui.fontFamily,
        fontSize: 32,
        color: this.ui.colors.title,
        stroke: this.ui.colors.shadow,
        strokeThickness: 5
      })
      .setOrigin(0.5);
    title.setShadow(0, 3, this.ui.colors.shadow, 6, false, true);
    this.menuTexts.push(title);
    const items = [
      { label: 'Singleplayer', action: () => this.setPlayerMode(1) },
      { label: '2 Spieler (Koop)', action: () => this.setPlayerMode(2) }
    ];
    this.createButtons(items, 250);
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
      .text(400, 195, `Aktueller Modus: ${currentMode}`, {
        fontFamily: this.ui.fontFamily,
        fontSize: 18,
        color: this.ui.colors.accent,
        stroke: this.ui.colors.shadow,
        strokeThickness: 3
      })
      .setOrigin(0.5);
    modeLabel.setShadow(0, 2, this.ui.colors.shadow, 4, false, true);
    this.menuTexts.push(modeLabel);
    const items = [
      { label: 'Modus ändern', action: () => this.renderPlayerModePrompt() },
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
        fontFamily: this.ui.fontFamily,
        fontSize: 24,
        color: enabled ? this.ui.colors.body : this.ui.colors.disabled,
        stroke: this.ui.colors.shadow,
        strokeThickness: 3
      }).setOrigin(0.5).setInteractive({ useHandCursor: enabled });
      t.setShadow(0, 2, this.ui.colors.shadow, 4, false, true);

      if (enabled) {
        t.on('pointerover', () => t.setColor(this.ui.colors.hover));
        t.on('pointerout', () => t.setColor(this.ui.colors.body));
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
