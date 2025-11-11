import Phaser from 'phaser';
import { CONTROLS } from '../config.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
    this.score = 0;
  }

  init(data) {
    this.score = data.score || 0;
  }

  create() {
    this.scoreText = this.add.text(16, 10, `Score: ${this.score}`, { fontSize: 18, color: '#E7F0FF' }).setDepth(1000);

    // Listen to game events
    this.game.events.on('score:add', this.onScoreAdd, this);

    // Simple hint (no pause/time shown)
    const hint = this.add.text(400, 460, `Mute: ${CONTROLS.MUTE_TOGGLE_KEY}`, { fontSize: 12, color: '#A0A8BD' }).setOrigin(0.5, 1);
    hint.setDepth(1000);
  }

  onScoreAdd(delta, total) {
    this.score = total;
    this.scoreText.setText(`Score: ${this.score}`);
  }

  shutdown() {
    this.game.events.off('score:add', this.onScoreAdd, this);
  }
}

