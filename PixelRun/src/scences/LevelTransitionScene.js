import Phaser from 'phaser';

/**
 * Lightweight bridge scene that ensures we fully shut down the previous
 * LevelScene before spinning up the next one. Restarting the same scene
 * directly while it is still active occasionally caused Canvas textures to
 * render while their contexts were being torn down, which surfaced as
 * drawImage-null errors. By routing the flow through this scene we get a
 * clean hand-off without user-visible delay.
 */
export default class LevelTransitionScene extends Phaser.Scene {
  constructor() {
    super('LevelTransitionScene');
    this.nextLevelId = 1;
    this.scoreCarry = 0;
    this.playerCount = 1;
  }

  init(data = {}) {
    this.nextLevelId = data.levelId ?? 1;
    this.scoreCarry = data.scoreCarry ?? 0;
    this.playerCount = data.playerCount ?? 1;
  }

  create() {
    // Tiny delay keeps things smooth while the previous level finishes cleanup.
    this.time.delayedCall(40, () => {
      this.scene.start('LevelScene', {
        levelId: this.nextLevelId,
        scoreCarry: this.scoreCarry,
        playerCount: this.playerCount,
      });
    });
  }
}
