import Phaser from 'phaser';
import { CONTROLS } from '../config.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
    this.score = 0;
    this.timeLeft = 0;
    this.timerEvent = null;
    this.paused = false;
  }

  init(data) {
    this.score = data.score || 0;
    this.timeLeft = data.timeLimit || 120;
  }

  create() {
    this.scoreText = this.add.text(16, 10, `Score: ${this.score}`, { fontSize: 18, color: '#E7F0FF' }).setDepth(1000);
    this.timeText = this.add.text(800 - 16, 10, `Zeit: ${this.timeLeft}`, { fontSize: 18, color: '#E7F0FF' }).setOrigin(1, 0).setDepth(1000);
    this.pauseText = this.add.text(400, 240, 'PAUSE', { fontSize: 32, color: '#7cceff' }).setOrigin(0.5).setVisible(false).setDepth(1000);

    // Listen to game events
    this.game.events.on('score:add', this.onScoreAdd, this);
    this.game.events.on('pause:state', this.onPauseState, this);

    // Timer tick
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.paused) return;
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        this.timeText.setText(`Zeit: ${this.timeLeft}`);
        if (this.timeLeft <= 0) {
          this.game.events.emit('timer:expired');
        }
      }
    });

    // Display a hint
    const hint = this.add.text(400, 460, `Mute: ${CONTROLS.MUTE_TOGGLE_KEY}  •  Pause: ${CONTROLS.PAUSE_TOGGLE_KEY}`, { fontSize: 12, color: '#A0A8BD' }).setOrigin(0.5, 1);
    hint.setDepth(1000);
  }

  onScoreAdd(delta, total) {
    this.score = total;
    this.scoreText.setText(`Score: ${this.score}`);
  }

  onPauseState(isPaused) {
    this.paused = isPaused;
    this.pauseText.setVisible(isPaused);
  }

  shutdown() {
    this.game.events.off('score:add', this.onScoreAdd, this);
    this.game.events.off('pause:state', this.onPauseState, this);
    if (this.timerEvent) this.timerEvent.remove(false);
  }
}
