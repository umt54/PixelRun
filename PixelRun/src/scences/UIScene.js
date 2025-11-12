import Phaser from 'phaser';
import { CONTROLS } from '../config.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
    this.score = 0;
    this.noticeText = null;
    this.noticeTimer = null;
  }

  init(data) {
    this.score = data.score || 0;
  }

  create() {
    this.scoreText = this.add.text(16, 10, `Score: ${this.score}`, { fontSize: 18, color: '#E7F0FF' }).setDepth(1000);

    // Listen to game events
    this.game.events.on('score:add', this.onScoreAdd, this);
    this.game.events.on('ui:notify', this.onNotify, this);

    // Simple hint (no pause/time shown)
    const hint = this.add.text(400, 460, `Mute: ${CONTROLS.MUTE_TOGGLE_KEY}`, { fontSize: 12, color: '#A0A8BD' }).setOrigin(0.5, 1);
    hint.setDepth(1000);

    this.noticeText = this.add.text(400, 80, '', { fontSize: 16, color: '#FFECAA', backgroundColor: 'rgba(20,20,20,0.6)', padding: { x: 12, y: 6 } })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0)
      .setAlpha(0);
    this.noticeTimer = null;
  }

  onScoreAdd(delta, total) {
    this.score = total;
    this.scoreText.setText(`Score: ${this.score}`);
  }

  onNotify(message = '', duration = 2000) {
    if (!this.noticeText) return;
    this.noticeText.setText(message);
    this.noticeText.setAlpha(1);
    if (this.noticeTimer) {
      this.noticeTimer.remove(false);
    }
    this.noticeTimer = this.time.addEvent({
      delay: Math.max(500, duration),
      callback: () => this.noticeText?.setAlpha(0),
    });
  }

  shutdown() {
    this.game.events.off('score:add', this.onScoreAdd, this);
    this.game.events.off('ui:notify', this.onNotify, this);
  }
}
