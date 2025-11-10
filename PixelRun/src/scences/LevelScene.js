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
    this.facing = 'east';
    this.jumpAnimGraceMs = 0; // keep jump anim even if onFloor lingers
    this.jumpMode = null; // 'idle' | 'run'
    this.jumpFacing = 'east';
    this.spawnPoint = { x: 64, y: 400 };
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
      // Camera defaults
      this.cameras.main.setBackgroundColor('#101428');

      // Build level from object layer
      const map = this.make.tilemap({ key: `level-${this.levelId}` });
      const layer = map ? map.getObjectLayer('Objects') : null;
      if (!layer) {
        throw new Error('Level data missing object layer "Objects"');
      }
      const objects = layer.objects || [];

      const { width: worldWidth, height: worldHeight } = this.computeWorldBounds(objects);
      this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

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
          const centerX = x + width / 2;
          const centerY = y - height / 2;
          const ground = this.physics.add.staticImage(centerX, centerY, 'ground');
          ground.displayWidth = width;
          ground.displayHeight = height;
          if (ground.refreshBody) ground.refreshBody();
          this.platforms.add(ground);
        } else if (type === 'hazard') {
          // Build spikes per 16px tile. Each tile snaps pixelgenau auf die Plattformoberkante.
          const wholeTiles = Math.floor(width / 16);
          const remainder = width % 16;
          const tileLefts = [];
          const tileStart = x;
          for (let i = 0; i < wholeTiles; i++) tileLefts.push(tileStart + i * 16);
          // Decke Restbreite ab, falls >= 8px, indem wir eine letzte Kachel an die rechte Kante setzen
          if (remainder >= 8) {
            const extraLeft = x + width - 16;
            if (tileLefts.length === 0 || extraLeft > tileLefts[tileLefts.length - 1]) tileLefts.push(extraLeft);
          }
          // Falls Breite < 16 war, sorge für mindestens eine Kachel
          if (tileLefts.length === 0) tileLefts.push(x);

          for (const leftPos of tileLefts) {
            const tileCenterX = Math.round(leftPos + 8);
            const groundTopRaw = this.findGroundTopAtX(objects, tileCenterX);
            if (groundTopRaw == null) continue; // keine Unterstützung -> keine Spike
            const groundTop = Math.round(groundTopRaw);

            // Visual: Spike bündig auf der Plattformoberkante
            const spike = this.add.image(tileCenterX, groundTop, 'spike');
            spike.setOrigin(0.5, 1);

            // Hitbox: exakt 16x16 über der Oberkante (deckungsgleich zur Grafik)
            const hitbox = this.add.rectangle(tileCenterX, groundTop - 8, 16, 16, 0xd64545, 0.18);
            this.physics.add.existing(hitbox, true);
            this.hazards.add(hitbox);
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

      // Ensure static physics bodies match their game object sizes/positions
      // This prevents falling through floors and corrects hazard hitboxes
      if (this.platforms?.refresh) this.platforms.refresh();
      if (this.hazards?.refresh) this.hazards.refresh();
      if (this.coins?.refresh) this.coins.refresh();
      if (this.goals?.refresh) this.goals.refresh();

      // Player
      this.player = this.physics.add.sprite(spawn.x, spawn.y, 'char_idle');
      const VISUAL_SCALE = 1; // requested: visual scale 1
      this.player.setScale(VISUAL_SCALE);
      if (this.player.body?.setAllowGravity) this.player.body.setAllowGravity(false); // avoid initial sink before we settle spawn
      this.player.setCollideWorldBounds(true);
      this.player.setMaxVelocity(PHYSICS.PLAYER.MAX_VEL_X, PHYSICS.PLAYER.MAX_VEL_Y);
      this.player.setDragX(PHYSICS.PLAYER.DRAG_X);
      // Refit physics body to match scaled sprite size
      const dispW = this.player.displayWidth;
      const dispH = this.player.displayHeight;
      const bodyW = Math.round(dispW * 0.5);   // narrower than sprite for fair collisions
      const bodyH = Math.round(dispH * 0.8);   // leave a bit of headroom
      const offsetX = Math.round((dispW - bodyW) / 2);
      const offsetY = Math.round(dispH - bodyH - 2); // small foot clearance

      const unscaledW = bodyW / this.player.scaleX;
      const unscaledH = bodyH / this.player.scaleY;
      const unscaledOffX = offsetX / this.player.scaleX;
      const unscaledOffY = offsetY / this.player.scaleY;

      this.player.setBodySize(unscaledW, unscaledH);
      this.player.setOffset(unscaledOffX, unscaledOffY);
      if (this.player.body?.updateFromGameObject) this.player.body.updateFromGameObject();

      // Snap the player precisely onto the nearest ground (no drop)
      const supportTop = this.findGroundSupportTop(objects, spawn.x, this.player.body.width);
      if (supportTop != null) {
        // Place so the bottom of the physics body sits on the ground
        const desiredTop = Math.round(supportTop - this.player.body.height - 1);
        const desiredSpriteY = desiredTop + (this.player.displayHeight / 2) - this.player.body.offset.y;
        // Reset fully to avoid initial penetration and clear velocities
        if (this.player.body?.reset) {
          this.player.body.reset(this.player.x, desiredSpriteY);
        } else {
          this.player.setY(desiredSpriteY);
          if (this.player.body?.updateFromGameObject) this.player.body.updateFromGameObject();
        }
        this.spawnPoint = { x: spawn.x, y: desiredSpriteY };
      }

    // Animations
    if (!this.anims.exists('run_east')) {
      this.anims.create({
        key: 'run_east',
        frames: [
          { key: 'char_run_0' },
          { key: 'char_run_1' },
          { key: 'char_run_2' },
          { key: 'char_run_3' }
        ],
        frameRate: 10,
        repeat: -1
      });
    }
    if (!this.anims.exists('run_west')) {
      this.anims.create({
        key: 'run_west',
        frames: [
          { key: 'char_run_w_0' },
          { key: 'char_run_w_1' },
          { key: 'char_run_w_2' },
          { key: 'char_run_w_3' }
        ],
        frameRate: 10,
        repeat: -1
      });
    }
    if (!this.anims.exists('idle')) {
      this.anims.create({ key: 'idle', frames: [{ key: 'char_idle' }], frameRate: 1 });
    }
    if (!this.anims.exists('jump')) {
      this.anims.create({ key: 'jump', frames: [{ key: 'char_jump' }], frameRate: 1 });
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

      // Now that colliders are set and spawn is adjusted, enable gravity
      if (this.player.body?.setAllowGravity) this.player.body.setAllowGravity(true);

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
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setDeadzone(120, 80);

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

  computeWorldBounds(objects = []) {
    const MIN_WIDTH = 800;
    const MIN_HEIGHT = 480;

    if (!objects.length) {
      return { width: MIN_WIDTH, height: MIN_HEIGHT };
    }

    let maxX = MIN_WIDTH;
    let maxY = MIN_HEIGHT;

    objects.forEach(obj => {
      const objWidth = obj.width || 0;
      const objHeight = obj.height || 0;
      maxX = Math.max(maxX, obj.x + objWidth);
      maxY = Math.max(maxY, obj.y + objHeight);
    });

    return { width: Math.max(maxX, MIN_WIDTH), height: Math.max(maxY, MIN_HEIGHT) };
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
    this.respawnPlayer();
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

  respawnPlayer() {
    const p = this.spawnPoint || { x: 64, y: 400 };
    // Reset motion
    this.player.setAcceleration(0, 0);
    this.player.setVelocity(0, 0);
    this.jumpActive = false;
    this.jumpHeldMs = 0;
    this.jumpMode = null;
    this.jumpAnimGraceMs = 0;
    // Place exactly at spawn body position
    if (this.player.body?.reset) {
      this.player.body.reset(p.x, p.y);
    } else {
      this.player.setPosition(p.x, p.y);
      if (this.player.body?.updateFromGameObject) this.player.body.updateFromGameObject();
    }
    // Face right by default at spawn
    this.facing = 'east';
    this.player.anims.stop();
    this.player.setTexture('char_rot_e');
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
      this.facing = 'west';
    } else if (right) {
      this.player.setAccelerationX(PHYSICS.PLAYER.ACCEL);
      this.facing = 'east';
    } else {
      this.player.setAccelerationX(0);
    }

    const onFloor = this.player.body.onFloor();
    if (this.jumpAnimGraceMs > 0) this.jumpAnimGraceMs -= delta;
    let justJumped = false;

    // Start jump
    if (upPressed && onFloor) {
      this.player.setVelocityY(PHYSICS.PLAYER.JUMP_SPEED);
      this.jumpActive = true;
      this.jumpHeldMs = 0;
      justJumped = true;
      this.jumpAnimGraceMs = 140; // ms to ensure animation shows reliably
      // Snapshot jump mode and facing at takeoff
      this.jumpMode = (left || right) ? 'run' : 'idle';
      this.jumpFacing = this.facing;
      const takeoffKey = this.jumpMode === 'run'
        ? (this.jumpFacing === 'west' ? 'run_jump_west' : 'run_jump_east')
        : (this.jumpFacing === 'west' ? 'jump_west' : 'jump_east');
      // Force-restart jump animation at takeoff (ignoreIfPlaying = false)
      this.player.play(takeoffKey);
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

    // Animations / facing
    const vx = this.player.body.velocity.x;
    const vy = this.player.body.velocity.y;
    const airborne = justJumped || !onFloor || this.jumpAnimGraceMs > 0;
    if (airborne) {
      // Keep the jump animation chosen at takeoff until landing
      const mode = this.jumpMode || ((left || right) ? 'run' : 'idle');
      const face = this.jumpFacing || this.facing;
      const key = mode === 'run'
        ? (face === 'west' ? 'run_jump_west' : 'run_jump_east')
        : (face === 'west' ? 'jump_west' : 'jump_east');
      if (this.player.anims.currentAnim?.key !== key) this.player.play(key, true);
    } else if (Math.abs(vx) > 10) {
      if (vx > 0) {
        if (this.player.anims.currentAnim?.key !== 'run_east') this.player.play('run_east', true);
      } else {
        if (this.player.anims.currentAnim?.key !== 'run_west') this.player.play('run_west', true);
      }
    } else {
      // Idle should be a static facing frame (rotations east/west)
      const idleKey = this.facing === 'west' ? 'char_rot_w' : 'char_rot_e';
      this.player.anims.stop();
      this.player.setTexture(idleKey);
    }

    // Clear jump mode once firmly on ground and not pressing jump
    if (onFloor && !justJumped && !upDown) {
      this.jumpMode = null;
    }
  }

  // Return rotation texture key using only east/west
  directionKeyFor(vx, _vy) {
    const ax = Math.abs(vx);
    if (ax > 30) {
      return vx > 0 ? 'char_rot_e' : 'char_rot_w';
    }
    return this.facing === 'west' ? 'char_rot_w' : 'char_rot_e';
  }

  // Find the top Y of a ground object spanning x, or null
  findGroundTopAtX(objects, x) {
    let best = null;
    for (const obj of objects) {
      if (obj.type !== 'ground') continue;
      const left = obj.x;
      const right = obj.x + (obj.width || 0);
      if (x >= left && x <= right) {
        const top = obj.y - (obj.height || 0);
        if (best == null || top < best) best = top;
      }
    }
    return best;
  }

  // Find a supporting ground top considering the player's width
  findGroundSupportTop(objects, x, width) {
    const half = Math.max(1, Math.floor(width / 2));
    const a = this.findGroundTopAtX(objects, x - half);
    const b = this.findGroundTopAtX(objects, x);
    const c = this.findGroundTopAtX(objects, x + half);
    // Choose the highest available support (smallest Y)
    const candidates = [a, b, c].filter(v => v != null);
    if (!candidates.length) return null;
    return Math.min(...candidates);
  }
}
