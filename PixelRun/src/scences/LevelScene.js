import Phaser from 'phaser';
import levelsData from '../level/levels.json';
import { DEFAULTS, PHYSICS, UI, CONTROLS, playBeep } from '../config.js';
import { loadProgress, saveProgress } from '../state/saveSystem.js';

export default class LevelScene extends Phaser.Scene {
  constructor() {
    super('LevelScene');
    this.levelId = DEFAULTS.START_LEVEL;
    this.score = 0;
    this.timeLeft = DEFAULTS.TIME_LIMIT;
    this.player = null;
    this.cursors = null;
    this.keys = null;
    this.jumpHeldMs = 0;
    this.jumpActive = false;
  }

  init(data) {
    this.levelId = data.levelId ?? DEFAULTS.START_LEVEL;
    this.score = data.scoreCarry ?? 0;
  }

  preload() {
    // Load selected level map JSON via an ESM-friendly URL resolution
    const meta = levelsData.levels.find(l => l.id === this.levelId);
    if (!meta) throw new Error('Invalid level id');
    this.levelMeta = meta;
    const url = new URL(`../level/maps/${meta.map}`, import.meta.url);
    this.load.tilemapTiledJSON(`level-${this.levelId}`, url.href);
  }

  create() {
    try {
      // Camera/world bounds (keep generous in case of wide maps)
      this.cameras.main.setBackgroundColor('#101428');
      this.physics.world.setBounds(0, 0, 1600, 480);

      // Build level from object layer
      const map = this.make.tilemap({ key: `level-${this.levelId}` });
      const layer = map ? map.getObjectLayer('Objects') : null;
      if (!layer) {
        throw new Error('Level data missing object layer "Objects"');
      }
      const objects = layer.objects || [];

    // Groups
    this.platforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();
    this.coins = this.physics.add.staticGroup();
    this.goals = this.physics.add.staticGroup();

      // Player spawn
      const spawn = objects.find(o => o.type === 'spawn') || { x: 64, y: 400 };

    // Build from objects
      objects.forEach(obj => {
        const { type, x, y, width = 16, height = 16 } = obj;
        if (type === 'ground') {
          const ground = this.add.image(x + width / 2, y - height / 2, 'ground');
          ground.displayWidth = width;
          ground.displayHeight = height;
          this.physics.add.existing(ground, true);
          this.platforms.add(ground);
        } else if (type === 'hazard') {
          const centerX = x + width / 2;
          const centerY = y - height / 2;

          // Use either individual spike sprites or a flat hazard body for wider areas
          if (width <= 32) {
            const spike = this.add.image(centerX, centerY, 'spike');
            this.physics.add.existing(spike, true);

            const bodyWidth = width || spike.width;
            const bodyHeight = height || spike.height;
            spike.body.setSize(bodyWidth, bodyHeight, true);

            this.hazards.add(spike);
          } else {
            const rect = this.add.rectangle(centerX, centerY, width, height, 0xd64545, 0.25);
            this.physics.add.existing(rect, true);
            this.hazards.add(rect);

            // Decorate with spike tiles across the width for visual feedback
            const tileCount = Math.max(1, Math.ceil(width / 16));
            const tileSpacing = width / tileCount;
            for (let i = 0; i < tileCount; i++) {
              const tileX = x + (i + 0.5) * tileSpacing;
              this.add.image(tileX, centerY, 'spike');
            }
          }
        } else if (type === 'coin') {
          const coin = this.add.image(x, y, 'coin');
          this.physics.add.existing(coin, true);
          this.coins.add(coin);
        } else if (type === 'goal') {
          const flag = this.add.image(x + 8, y - 10, 'flag');
          this.physics.add.existing(flag, true);
          this.goals.add(flag);
        }
      });

      // Player
      this.player = this.physics.add.sprite(spawn.x, spawn.y, 'player0');
      this.player.setCollideWorldBounds(true);
      this.player.setMaxVelocity(PHYSICS.PLAYER.MAX_VEL_X, PHYSICS.PLAYER.MAX_VEL_Y);
      this.player.setDragX(PHYSICS.PLAYER.DRAG_X);
      this.player.setBodySize(12, 18);
      this.player.setOffset(2, 2);

    // Animations
    if (!this.anims.exists('run')) {
      this.anims.create({
        key: 'run',
        frames: [{ key: 'player1' }, { key: 'player2' }, { key: 'player3' }],
        frameRate: 12,
        repeat: -1
      });
    }
    if (!this.anims.exists('idle')) {
      this.anims.create({ key: 'idle', frames: [{ key: 'player0' }], frameRate: 1 });
    }
    if (!this.anims.exists('jump')) {
      this.anims.create({ key: 'jump', frames: [{ key: 'player4' }], frameRate: 1 });
    }

    // Physics
      this.physics.add.collider(this.player, this.platforms);

      this.physics.add.overlap(this.player, this.coins, (player, coin) => {
        coin.destroy();
        this.score += UI.SCORE_PER_COIN;
        this.game.events.emit('score:add', UI.SCORE_PER_COIN, this.score);
        playBeep(this, 1046, 80, 'square');
      });

      this.physics.add.overlap(this.player, this.hazards, () => {
        this.onPlayerDeath();
      });

      this.physics.add.overlap(this.player, this.goals, () => {
        this.onLevelComplete();
      });

    // Controls
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({
        W: 'W',
        A: 'A',
        D: 'D',
        SPACE: 'SPACE',
        M: CONTROLS.MUTE_TOGGLE_KEY,
        P: CONTROLS.PAUSE_TOGGLE_KEY
      });

      this.input.keyboard.on(`keydown-${CONTROLS.PAUSE_TOGGLE_KEY}`, () => this.togglePause(), this);

    // Camera
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setBounds(0, 0, 800, 480);

    // HUD / UI
      this.scene.run('UIScene', {
        score: this.score,
        timeLimit: this.levelMeta.timeLimit || DEFAULTS.TIME_LIMIT
      });

    // Listen UI timer
      this.game.events.on('timer:expired', this.onTimeExpired, this);
      this.game.events.on('pause:toggle', this.togglePause, this);

      playBeep(this, 700, 60, 'triangle');
    } catch (err) {
      // Show a friendly in-game error message instead of a blank screen
      console.error('Level load error:', err);
      const msg = 'Fehler beim Laden des Levels. Drücke ESC für Menü.';
      this.add.text(400, 220, msg, { fontSize: 18, color: '#E7F0FF', align: 'center' }).setOrigin(0.5);
      this.add.text(400, 260, String(err?.message || err), { fontSize: 14, color: '#A0A8BD', align: 'center' }).setOrigin(0.5);
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('MainMenuScene'));
    }
  }

  shutdown() {
    this.game.events.off('timer:expired', this.onTimeExpired, this);
    this.game.events.off('pause:toggle', this.togglePause, this);
  }

  onTimeExpired() {
    this.onPlayerDeath();
  }

  onPlayerDeath() {
    playBeep(this, 180, 150, 'sawtooth');
    this.scene.stop('UIScene');
    this.scene.start('GameOverScene', {
      levelId: this.levelId,
      score: this.score,
      reason: 'dead'
    });
  }

  onLevelComplete() {
    playBeep(this, 880, 120, 'triangle');
    // Unlock next level and save highscore if improved
    const nextLevel = Math.min(this.levelId + 1, DEFAULTS.MAX_LEVELS);
    const progress = loadProgress();
    const updated = saveProgress({
      unlockedLevel: Math.max(progress.unlockedLevel, nextLevel),
      highScore: Math.max(progress.highScore, this.score)
    });

    // If last level, go to GameOver summary
    this.scene.stop('UIScene');
    if (this.levelId >= DEFAULTS.MAX_LEVELS) {
      this.scene.start('GameOverScene', {
        levelId: this.levelId,
        score: this.score,
        reason: 'complete',
        final: true
      });
    } else {
      // Continue to next level
      this.scene.restart({ levelId: this.levelId + 1, scoreCarry: this.score });
    }
  }

  togglePause() {
    if (this.scene.isPaused()) {
      this.scene.resume();
      this.physics.world.isPaused = false;
      this.game.events.emit('pause:state', false);
      playBeep(this, 760, 60, 'square');
    } else {
      this.scene.pause();
      this.physics.world.isPaused = true;
      this.game.events.emit('pause:state', true);
      playBeep(this, 320, 60, 'square');
    }
  }

  update(time, delta) {
    if (!this.player || this.physics.world.isPaused) return;

    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const upPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
    const upDown = this.cursors.up.isDown || this.keys.W.isDown || this.keys.SPACE.isDown;

    // Horizontal movement via acceleration
    if (left) {
      this.player.setAccelerationX(-PHYSICS.PLAYER.ACCEL);
      this.player.setFlipX(true);
    } else if (right) {
      this.player.setAccelerationX(PHYSICS.PLAYER.ACCEL);
      this.player.setFlipX(false);
    } else {
      this.player.setAccelerationX(0);
    }

    const onFloor = this.player.body.onFloor();

    // Start jump
    if (upPressed && onFloor) {
      this.player.setVelocityY(PHYSICS.PLAYER.JUMP_SPEED);
      this.jumpActive = true;
      this.jumpHeldMs = 0;
      playBeep(this, 520, 80, 'triangle');
    }

    // Variable jump height by hold duration
    if (this.jumpActive) {
      if (upDown && this.jumpHeldMs < PHYSICS.PLAYER.JUMP_MAX_HOLD_MS) {
        this.jumpHeldMs += delta;
        this.player.setVelocityY(PHYSICS.PLAYER.JUMP_SPEED);
      } else {
        this.jumpActive = false;
      }
    }
    if (onFloor && !upDown) {
      this.jumpActive = false;
    }

    // Animations
    if (!onFloor) {
      this.player.play('jump', true);
    } else if (Math.abs(this.player.body.velocity.x) > 10) {
      this.player.play('run', true);
    } else {
      this.player.play('idle', true);
    }
  }
}
