import Phaser from 'phaser';
import { loadProgress } from '../state/saveSystem.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.levelId = data.levelId;
    this.score = data.score || 0;
    this.reason = data.reason || 'dead';
    this.final = Boolean(data.final);
    this.playerCount = data.playerCount ?? 1;
  }

  create() {
    const title = this.final ? 'Alle Level geschafft!' : 'Game Over';
    this.add.text(400, 120, title, { fontSize: 40, color: '#E7F0FF' }).setOrigin(0.5);

    const p = loadProgress();
    const lines = [
      `Level: ${this.levelId}`,
      `Score: ${this.score}`,
      `Highscore: ${p.highScore}`
    ];
    this.add.text(400, 180, lines.join('\n'), { fontSize: 20, color: '#A0A8BD', align: 'center' }).setOrigin(0.5);

    const buttons = [
      { label: 'Retry', action: () => this.retry() },
      { label: 'Zurück zum Menü', action: () => this.scene.start('MainMenuScene') }
    ];

    let y = 260;
    buttons.forEach(b => {
      const t = this.add.text(400, y, b.label, { fontSize: 24, color: '#E7F0FF' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#7cceff'));
      t.on('pointerout', () => t.setColor('#E7F0FF'));
      t.on('pointerup', b.action);
      y += 40;
    });

    this.input.keyboard.once('keydown-ENTER', () => this.retry());
  }

  retry() {
    this.scene.start('LevelScene', { levelId: this.levelId, scoreCarry: 0, playerCount: this.playerCount });
  }
}
