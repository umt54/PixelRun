import Phaser from 'phaser';
import { CONTROLS } from '../config.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
    this.score = 0;
    this.noticeText = null;
    this.noticeTimer = null;
    this.coinTotals = { collected: 0, remaining: 0, total: 0 };
    this.coinText = null;
  }

  init(data) {
    this.score = data.score || 0;
    this.coinTotals = data.coinInfo || { collected: 0, remaining: 0, total: 0 };
  }

  create() {
    this.scoreText = this.add.text(16, 10, `Score: ${this.score}`, { fontSize: 18, color: '#E7F0FF' }).setDepth(1000);
    this.coinText = this.add
      .text(16, 30, this.formatCoinText(), { fontSize: 16, color: '#FFD27F' })
      .setDepth(1000);

    // Listen to game events
    this.game.events.on('score:add', this.onScoreAdd, this);
    this.game.events.on('coins:update', this.onCoinsUpdate, this);
    this.game.events.on('ui:notify', this.onNotify, this);
    this.syncCoinTotalsFromLevel();

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

  onCoinsUpdate(data = {}) {
    const {
      collected = 0,
      remaining = 0,
      total = Math.max(collected + remaining, 0),
    } = data;
    this.coinTotals = { collected, remaining, total };
    this.coinText?.setText(this.formatCoinText());
  }

  formatCoinText() {
    const { collected = 0, remaining = 0, total = 0 } = this.coinTotals || {};
    const clampedRemaining = Math.max(remaining, 0);
    return `Muenzen: ${collected}/${total} (Rest: ${clampedRemaining})`;
  }

  syncCoinTotalsFromLevel() {
    const levelScene = this.scene.isActive('LevelScene')
      ? this.scene.get('LevelScene')
      : null;
    if (!levelScene) return;
    const remaining =
      typeof levelScene.getRemainingActiveCoins === 'function'
        ? levelScene.getRemainingActiveCoins()
        : Math.max(
            (levelScene.levelCoinTotal || 0) -
              (levelScene.levelCoinsCollected || 0),
            0
          );
    this.onCoinsUpdate({
      collected: levelScene.levelCoinsCollected || 0,
      remaining,
      total: levelScene.levelCoinTotal || remaining,
    });
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
    this.game.events.off('coins:update', this.onCoinsUpdate, this);
    this.game.events.off('ui:notify', this.onNotify, this);
  }
}
