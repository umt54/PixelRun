import Phaser from "phaser";
import levelsData from "../level/levels.json";
import { DEFAULTS, PHYSICS, UI, CONTROLS, playBeep } from "../config.js";
import { loadProgress, saveProgress } from "../state/saveSystem.js";

// Grafik nach unten rücken (nur VISUELL)
const PLATFORM_Y_OFFSET = 40;


export default class LevelScene extends Phaser.Scene {
  constructor() {
    super("LevelScene");
    this.levelId = DEFAULTS.START_LEVEL;
    this.score = 0;
    this.timeLeft = DEFAULTS.TIME_LIMIT;
    this.player = null;
    this.players = [];
    this.playerCount = 1;
    this.playersAtGoal = new Set();
    this.cameraTarget = null;
    this.platformSurfaces = [];
    this.platformTextureKey = "platform";
    this.platformDisplaySize = { width: 140, height: 60 };
    this.stageLayer = null;
    this.platformLayer = null;
    this.coinLayer = null;
    this.playerLayer = null;
    this.allCoinsCollected = false;
    this.goalWarningCooldown = 0;
    this.isLevelComplete = false;
    this.levelCoinTotal = 0;
    this.levelCoinsCollected = 0;
    this.coinProgressRetryTimer = null;
    this.pauseMenu = null;
    this.pauseMenuButtons = { resume: null, quit: null };
    this.isPauseMenuVisible = false;
    this.pauseHotkeyHandler = null;
    this.wasPhysicsPausedBeforeMenu = false;
    this.pauseMenuUiWasActive = false;
  }

  init(data) {
    this.levelId = data.levelId ?? DEFAULTS.START_LEVEL;
    this.score = data.scoreCarry ?? 0;
    this.playerCount = Phaser.Math.Clamp(
      data.playerCount ?? this.registry?.get?.("playerCount") ?? 1,
      1,
      2
    );
    this.players = [];
    this.playersAtGoal = new Set();
    this.player = null;
    this.cameraTarget = null;
    this.allCoinsCollected = false;
    this.goalWarningCooldown = 0;
    this.isLevelComplete = false;
    this.levelCoinTotal = 0;
    this.levelCoinsCollected = 0;
    this.coinProgressRetryTimer = null;
    this.isPauseMenuVisible = false;
    this.pauseMenu = null;
    this.pauseMenuButtons = { resume: null, quit: null };
    this.pauseHotkeyHandler = null;
    this.wasPhysicsPausedBeforeMenu = false;
    this.pauseMenuUiWasActive = false;
  }

  preload() {
    // Load selected level map JSON via an ESM-friendly URL resolution
    const meta = levelsData.levels.find((l) => l.id === this.levelId);
    if (!meta) throw new Error("Invalid level id");
    this.levelMeta = meta;
    const url = new URL(`../level/maps/${meta.map}`, import.meta.url);
    this.load.tilemapTiledJSON(`level-${this.levelId}`, url.href);
    if (!this.textures.exists("platform")) {
      const platUrl = new URL("../elements/plattform.png", import.meta.url)
        .href;
      this.load.image("platform", platUrl);
    }
    if (this.levelId === 2 && !this.textures.exists("platform_snow")) {
      const snowPlatUrl = new URL(
        "../elements/snow-plattform.png",
        import.meta.url
      ).href;
      this.load.image("platform_snow", snowPlatUrl);
    }
    if (this.levelId === 3 && !this.textures.exists("platform_desert")) {
      const desertPlatUrl = new URL(
        "../elements/desert-plattform.png",
        import.meta.url
      ).href;
      this.load.image("platform_desert", desertPlatUrl);
    }
  }

  create() {
    try {
      // Camera defaults
      this.cameras.main.setBackgroundColor("#101428");
      this.allCoinsCollected = false;
      this.goalWarningCooldown = 0;
      this.isLevelComplete = false;

      // Build level from object layer
      const map = this.make.tilemap({ key: `level-${this.levelId}` });
      const layer = map ? map.getObjectLayer("Objects") : null;
      if (!layer) {
        throw new Error('Level data missing object layer "Objects"');
      }
      const objects = layer.objects || [];

      const { width: worldWidth, height: worldHeight } =
        this.computeWorldBounds(objects);
      this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

      // Parallax background covering the viewport; repeats horizontally
      const cam = this.cameras.main;
      this.cameras.main.setZoom(1).setRoundPixels(false);
      const canvas = this.game.canvas;
      if (canvas?.style) {
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
      }
      const bgKey = this.getBackgroundTextureKey();
      const bgHeight = cam.height;
      const bgWidth = Math.max(worldWidth, cam.width);
      this.bg = this.add
        .tileSprite(0, 0, bgWidth, bgHeight, bgKey)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-1000);
      const bgSrc = this.textures.get(bgKey)?.getSourceImage?.();
      if (bgSrc && bgSrc.height) {
        const tScale = bgHeight / bgSrc.height;
        this.bg.setTileScale(tScale, tScale);
      }

      this.platformTextureKey = this.getPlatformTextureKey();
      this.platformDisplaySize = this.getPlatformDisplaySize();
      this.initializeRenderLayers();
      this.resetPlatformVisuals(true);
      this.logLayerDepths();

      // Groups
      this.platforms = this.physics.add.staticGroup();
      this.hazards = this.physics.add.staticGroup();
      this.coins = this.physics.add.staticGroup();
      this.goals = this.physics.add.staticGroup();

      // Determine base stage ground (lowest ground rect) and add visible stage image
      this.stageRect = objects
        .filter((o) => o.type === "ground")
        .reduce((best, o) => (!best || o.y > best.y ? o : best), null);
      const stageTop = this.stageRect
        ? Math.round(this.stageRect.y - (this.stageRect.height || 0))
        : worldHeight - 64;
      const stageVisual = this.getStageVisualConfig();
      const stageKey = stageVisual.key;
      const stageTex = stageKey
        ? this.textures.get(stageKey)?.getSourceImage?.()
        : null;
      if (stageKey && stageTex) {
        const texHeight =
          stageTex.height || stageTex.source?.[0]?.height || 64;
        const stageHeight = stageVisual.height ?? texHeight;
        this.stageImage = this.add
          .tileSprite(0, stageTop, worldWidth, stageHeight, stageKey)
          .setOrigin(0, 0)
          .setDepth(0)
          .setScrollFactor(1, 1);
        const tileScaleX = stageVisual.scaleX ?? 1;
        const tileScaleY =
          stageVisual.scaleY ??
          (texHeight ? stageHeight / texHeight : 1);
        this.stageImage.setTileScale(tileScaleX, tileScaleY);
        this.stageLayer.add(this.stageImage);
      }

      // Player spawn
      const spawn = objects.find((o) => o.type === "spawn") || {
        x: 64,
        y: 400,
      };

      // Build from objects
      objects.forEach((obj) => {
        const { type, x, y, width = 16, height = 16 } = obj;
        if (type === "ground") {
          if (this.isFloatingPlatform({ height })) {
            this.createPlatformSurface({ x, y, width, height });
          } else {
            this.createStageSegment({ x, y, width, height });
          }
        } else if (type === "hazard") {
          // Build spikes per 16px tile. Each tile snaps pixelgenau auf die Plattformoberkante.
          const wholeTiles = Math.floor(width / 16);
          const remainder = width % 16;
          const tileLefts = [];
          const tileStart = x;
          for (let i = 0; i < wholeTiles; i++)
            tileLefts.push(tileStart + i * 16);
          // Decke Restbreite ab, falls >= 8px, indem wir eine letzte Kachel an die rechte Kante setzen
          if (remainder >= 8) {
            const extraLeft = x + width - 16;
            if (
              tileLefts.length === 0 ||
              extraLeft > tileLefts[tileLefts.length - 1]
            )
              tileLefts.push(extraLeft);
          }
          // Falls Breite < 16 war, sorge fグr mindestens eine Kachel
          if (tileLefts.length === 0) tileLefts.push(x);

          for (const leftPos of tileLefts) {
            const tileCenterX = Math.round(leftPos + 8);
            const groundTopRaw = this.findGroundTopAtX(objects, tileCenterX);
            if (groundTopRaw == null) continue; // keine Untersttzung -> keine Spike
            const groundTop = Math.round(groundTopRaw);

            // Visual: Spike bグndig auf der Plattformoberkante
            const spike = this.add.image(tileCenterX, groundTop, "spike");
            spike.setOrigin(0.5, 1);

            // Hitbox: exakt 16x16 グber der Oberkante (deckungsgleich zur Grafik)
            const hitbox = this.add.rectangle(
              tileCenterX,
              groundTop - 8,
              16,
              16,
              0xd64545,
              0.18
            );
            this.physics.add.existing(hitbox, true);
            hitbox._sprite = spike;
            this.hazards.add(hitbox);
          }
        } else if (type === "goal") {
          const flag = this.add.image(x + 8, y - 10, "flag");
          this.physics.add.existing(flag, true);
          this.goals.add(flag);
        }
      });

      // KEIN this.platforms.refresh() hier, damit manuell gesetzte Body-Grβßen bestehen bleiben.
      this.time.delayedCall(0, () => this.buildVisiblePlatformsFromLines());
      this.time.delayedCall(1, () => this.spawnCoinsForPlatforms());
      // After building objects, refine spike placement for fairness/clarity
      this.refineSpikePlacement(objects);

      if (this.hazards?.refresh) this.hazards.refresh();
      if (this.coins?.refresh) this.coins.refresh();
      if (this.goals?.refresh) this.goals.refresh();

      // Players (single oder 2-Spieler-Koop)
      this.playerCount = Phaser.Math.Clamp(
        Number.isFinite(this.playerCount) ? this.playerCount : 1,
        1,
        2
      );
      this.playersAtGoal = new Set();
      this.players = this.createPlayers(spawn, objects);
      this.player = this.players[0]?.sprite || null;

      // Animations (fallback, PreloadScene already creates them once)
      this.ensurePlayerAnimationsExist();

      // Physics & overlaps
      this.players.forEach((pState) => {
        if (!pState?.sprite) return;
        this.physics.add.collider(pState.sprite, this.platforms);
        this.physics.add.overlap(
          pState.sprite,
          this.coins,
          (_player, coin) => this.onCoinCollected(coin),
          null,
          this
        );
        this.physics.add.overlap(
          pState.sprite,
          this.hazards,
          () => this.onPlayerDeath(pState),
          null,
          this
        );
        this.physics.add.overlap(
          pState.sprite,
          this.goals,
          () => this.handleGoalOverlap(pState),
          null,
          this
        );
      });

      // Now that colliders are set and spawn is adjusted, enable gravity
      this.players.forEach((pState) => {
        if (pState?.sprite?.body?.setAllowGravity) {
          pState.sprite.body.setAllowGravity(true);
        }
      });

      // Camera follows a shared target to keep beide Spieler im Bild
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
      this.ensureCameraTarget(spawn);
      this.cameras.main.startFollow(this.cameraTarget, true, 0.1, 0.1);
      this.cameras.main.setDeadzone(140, 90);
      this.updateCameraTarget();

      // HUD / UI
      this.scene.stop("UIScene");
      this.scene.run("UIScene", {
        score: this.score,
        coinInfo: {
          collected: this.levelCoinsCollected,
          remaining: this.getRemainingActiveCoins(),
          total: this.levelCoinTotal,
        },
      });

      this.ensurePauseMenu();
      this.registerPauseHotkeys();

      playBeep(this, 700, 60, "triangle");
    } catch (err) {
      // Show a friendly in-game error message instead of a blank screen
      console.error("Level load error:", err);
      const msg = "Fehler beim Laden des Levels. Drücke ESC für Menü.";
      this.add
        .text(400, 220, msg, {
          fontSize: 18,
          color: "#E7F0FF",
          align: "center",
        })
        .setOrigin(0.5);
      this.add
        .text(400, 260, String(err?.message || err), {
          fontSize: 14,
          color: "#A0A8BD",
          align: "center",
        })
        .setOrigin(0.5);
      this.input.keyboard.once("keydown-ESC", () =>
        this.scene.start("MainMenuScene")
      );
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

    objects.forEach((obj) => {
      const objWidth = obj.width || 0;
      const objHeight = obj.height || 0;
      maxX = Math.max(maxX, obj.x + objWidth);
      maxY = Math.max(maxY, obj.y + objHeight);
    });

    return {
      width: Math.max(maxX, MIN_WIDTH),
      height: Math.max(maxY, MIN_HEIGHT),
    };
  }

  shutdown() {
    this.clearCoinProgressRetryTimer();
    this.removePauseHotkeys();
    this.destroyPauseMenu();
  }

  onPlayerDeath(playerState) {
    playBeep(this, 180, 150, "sawtooth");
    if (playerState?.id) {
      this.playersAtGoal.delete(playerState.id);
    }
    this.respawnPlayer(playerState);
  }

  onLevelComplete() {
    if (this.isLevelComplete) return;
    this.isLevelComplete = true;
    playBeep(this, 880, 120, "triangle");
    // Unlock next level and save highscore if improved
    const nextLevel = Math.min(this.levelId + 1, DEFAULTS.MAX_LEVELS);
    const progress = loadProgress();
    saveProgress({
      unlockedLevel: Math.max(progress.unlockedLevel, nextLevel),
      highScore: Math.max(progress.highScore, this.score),
    });

    // If last level, go to GameOver summary
    this.scene.stop("UIScene");
    this.clearCoinProgressRetryTimer();
    if (this.levelId >= DEFAULTS.MAX_LEVELS) {
      this.time.delayedCall(0, () => {
        this.scene.start("GameOverScene", {
          levelId: this.levelId,
          score: this.score,
          reason: "complete",
          final: true,
          playerCount: this.playerCount,
        });
      });
    } else {
      // Hand over to a tiny bridge scene so LevelScene can reboot cleanly.
      this.time.delayedCall(0, () => {
        this.scene.start("LevelTransitionScene", {
          levelId: this.levelId + 1,
          scoreCarry: this.score,
          playerCount: this.playerCount,
        });
      });
    }
  }

  togglePause(showMenu = !this.isPauseMenuVisible) {
    if (showMenu) {
      if (this.isPauseMenuVisible) return;
      this.ensurePauseMenu();
      this.pauseMenu.setVisible(true);
      this.setPauseMenuInteraction(true);
      this.wasPhysicsPausedBeforeMenu = this.physics.world.isPaused;
      if (!this.wasPhysicsPausedBeforeMenu) {
        this.physics.world.pause();
      }
      this.pauseMenuUiWasActive = !!this.scene?.isActive?.("UIScene");
      if (this.pauseMenuUiWasActive) {
        this.scene.pause("UIScene");
        this.scene.setVisible?.("UIScene", false);
      }
      this.isPauseMenuVisible = true;
      playBeep(this, 320, 90, "triangle");
      return;
    }

    if (!this.isPauseMenuVisible) return;
    this.pauseMenu.setVisible(false);
    this.setPauseMenuInteraction(false);
    if (!this.wasPhysicsPausedBeforeMenu) {
      this.physics.world.resume();
    }
    if (this.pauseMenuUiWasActive) {
      this.scene.resume("UIScene");
      this.scene.setVisible?.("UIScene", true);
    }
    this.wasPhysicsPausedBeforeMenu = false;
    this.pauseMenuUiWasActive = false;
    this.isPauseMenuVisible = false;
    playBeep(this, 520, 70, "triangle");
  }

  ensurePauseMenu() {
    if (this.pauseMenu) return;
    const width = this.scale?.width ?? 800;
    const height = this.scale?.height ?? 480;
    const container = this.add.container(0, 0);
    container.setDepth(5000);
    container.setScrollFactor?.(0);
    container.setVisible(false);

    const overlay = this.add
      .rectangle(0, 0, width, height, 0x050915, 0.72)
      .setOrigin(0, 0);
    overlay.setInteractive({ useHandCursor: false });
    overlay.setScrollFactor?.(0);

    const panelWidth = Math.min(420, width - 80);
    const panel = this.add
      .rectangle(width / 2, height / 2, panelWidth, 220, 0x1c2340, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x4aa3ff, 0.85);
    panel.setScrollFactor?.(0);

    const title = this.add
      .text(width / 2, height / 2 - 80, "Pause", {
        fontSize: 32,
        color: "#E7F0FF",
      })
      .setOrigin(0.5);
    title.setScrollFactor?.(0);

    const resumeBtn = this.createPauseButton(
      width / 2,
      height / 2 - 10,
      "Spiel fortsetzen",
      () => this.togglePause(false)
    );
    const menuBtn = this.createPauseButton(
      width / 2,
      height / 2 + 50,
      "Zurück zum Hauptmenü",
      () => this.exitToMainMenu()
    );

    container.add([overlay, panel, title, resumeBtn, menuBtn]);
    this.pauseMenu = container;
    this.pauseMenuButtons = { resume: resumeBtn, quit: menuBtn };
    this.setPauseMenuInteraction(false);
  }

  createPauseButton(x, y, label, callback) {
    const button = this.add
      .text(x, y, label, {
        fontSize: 22,
        color: "#E7F0FF",
        backgroundColor: "#1f2942",
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5);
    button.setScrollFactor?.(0);
    button.on("pointerover", () => button.setStyle({ color: "#7cceff" }));
    button.on("pointerout", () => button.setStyle({ color: "#E7F0FF" }));
    button.on("pointerup", () => callback?.());
    return button;
  }

  setPauseMenuInteraction(enabled) {
    const buttons = [
      this.pauseMenuButtons?.resume,
      this.pauseMenuButtons?.quit,
    ].filter(Boolean);
    buttons.forEach((btn) => {
      if (enabled) {
        btn.setInteractive({ useHandCursor: true });
      } else if (btn.disableInteractive && btn.input) {
        btn.disableInteractive();
      }
    });
  }

  registerPauseHotkeys() {
    if (!this.input?.keyboard) return;
    this.removePauseHotkeys();
    this.pauseHotkeyHandler = (event) => {
      if (event?.repeat) return;
      event?.preventDefault?.();
      if (this.isPauseMenuVisible) {
        this.togglePause(false);
        return;
      }
      if (this.isLevelComplete) return;
      this.togglePause(true);
    };
    this.input.keyboard.on("keydown-ESC", this.pauseHotkeyHandler);
    if (CONTROLS.PAUSE_TOGGLE_KEY) {
      this.input.keyboard.on(
        `keydown-${CONTROLS.PAUSE_TOGGLE_KEY}`,
        this.pauseHotkeyHandler
      );
    }
  }

  removePauseHotkeys() {
    if (!this.pauseHotkeyHandler || !this.input?.keyboard) return;
    this.input.keyboard.off("keydown-ESC", this.pauseHotkeyHandler);
    if (CONTROLS.PAUSE_TOGGLE_KEY) {
      this.input.keyboard.off(
        `keydown-${CONTROLS.PAUSE_TOGGLE_KEY}`,
        this.pauseHotkeyHandler
      );
    }
    this.pauseHotkeyHandler = null;
  }

  exitToMainMenu() {
    this.togglePause(false);
    this.scene.stop("UIScene");
    this.scene.start("MainMenuScene");
  }

  destroyPauseMenu() {
    if (this.pauseMenu) {
      this.pauseMenu.destroy(true);
    }
    this.pauseMenu = null;
    this.pauseMenuButtons = { resume: null, quit: null };
    this.isPauseMenuVisible = false;
    this.pauseMenuUiWasActive = false;
    this.wasPhysicsPausedBeforeMenu = false;
  }

  respawnPlayer(playerState) {
    const state = playerState || this.players[0];
    const sprite = state?.sprite || this.player;
    const spawn = state?.spawnPoint || { x: 64, y: 400 };
    if (!sprite) return;
    sprite.setAcceleration?.(0, 0);
    sprite.setVelocity?.(0, 0);
    state.jumpActive = false;
    state.jumpHeldMs = 0;
    state.jumpMode = null;
    state.jumpAnimGraceMs = 0;
    state.reachedGoal = false;
    if (sprite.body?.reset) {
      sprite.body.reset(spawn.x, spawn.y);
    } else {
      sprite.setPosition(spawn.x, spawn.y);
      sprite.body?.updateFromGameObject?.();
    }
    state.facing = "east";
    sprite.anims?.stop();
    const idleKey = state.animKeys?.rotEast || "char_rot_e";
    sprite.setTexture?.(idleKey);
  }

  update(time, delta) {
    if (this.bg) {
      this.bg.tilePositionX = this.cameras.main.scrollX * 0.3;
    }
    if (this.physics.world.isPaused) return;
    if (!this.players?.length) return;

    this.players.forEach((pState) => this.updatePlayerState(pState, delta));
    this.updateCameraTarget();
  }

  updatePlayerState(state, delta) {
    const sprite = state?.sprite;
    if (!sprite?.body) return;
    const controls = state.controls || {};
    const left = controls.left?.() || false;
    const right = controls.right?.() || false;
    const upPressed = controls.jumpJustDown?.() || false;
    const upDown = controls.jumpDown?.() || false;

    if (left) {
      sprite.setAccelerationX(-PHYSICS.PLAYER.ACCEL);
      state.facing = "west";
    } else if (right) {
      sprite.setAccelerationX(PHYSICS.PLAYER.ACCEL);
      state.facing = "east";
    } else {
      sprite.setAccelerationX(0);
    }

    const onFloor = sprite.body.onFloor();
    if (state.jumpAnimGraceMs > 0) state.jumpAnimGraceMs -= delta;
    let justJumped = false;

    if (upPressed && onFloor) {
      sprite.setVelocityY(PHYSICS.PLAYER.JUMP_SPEED);
      state.jumpActive = true;
      state.jumpHeldMs = 0;
      justJumped = true;
      state.jumpAnimGraceMs = 140;
      state.jumpMode = left || right ? "run" : "idle";
      state.jumpFacing = state.facing;
      const takeoffKey =
        state.jumpMode === "run"
          ? state.jumpFacing === "west"
            ? state.animKeys.runJumpWest
            : state.animKeys.runJumpEast
          : state.jumpFacing === "west"
          ? state.animKeys.jumpWest
          : state.animKeys.jumpEast;
      sprite.play(takeoffKey);
      playBeep(this, 520, 80, "triangle");
    }

    if (state.jumpActive) {
      if (upDown && state.jumpHeldMs < PHYSICS.PLAYER.JUMP_MAX_HOLD_MS) {
        state.jumpHeldMs += delta;
        sprite.setVelocityY(PHYSICS.PLAYER.JUMP_SPEED);
      } else {
        state.jumpActive = false;
      }
    }
    if (onFloor && !upDown) {
      state.jumpActive = false;
    }

    const vx = sprite.body.velocity.x;
    const airborne = justJumped || !onFloor || state.jumpAnimGraceMs > 0;
    if (airborne) {
      const mode = state.jumpMode || (left || right ? "run" : "idle");
      const face = state.jumpFacing || state.facing;
      const key =
        mode === "run"
          ? face === "west"
            ? state.animKeys.runJumpWest
            : state.animKeys.runJumpEast
          : face === "west"
          ? state.animKeys.jumpWest
          : state.animKeys.jumpEast;
      if (sprite.anims.currentAnim?.key !== key) sprite.play(key, true);
    } else if (Math.abs(vx) > 10) {
      const key = vx > 0 ? state.animKeys.runEast : state.animKeys.runWest;
      if (sprite.anims.currentAnim?.key !== key) sprite.play(key, true);
    } else {
      const idleKey = state.facing === "west" ? state.animKeys.rotWest : state.animKeys.rotEast;
      sprite.anims.stop();
      sprite.setTexture(idleKey);
    }

    if (onFloor && !justJumped && !upDown) {
      state.jumpMode = null;
    }
  }

  createPlayers(spawn, objects) {
    const players = [];
    const secondOffset = 32;
    const configs = [
      { id: "P1", prefix: "char", offset: 0, controls: this.createPlayerOneControls() },
    ];
    if (this.playerCount === 2) {
      configs.push({
        id: "P2",
        prefix: "char2",
        offset: secondOffset,
        controls: this.createPlayerTwoControls(),
      });
    }

    configs.forEach((cfg) => {
      const state = this.createSinglePlayer(spawn, objects, cfg);
      if (state) players.push(state);
    });
    return players;
  }

  createSinglePlayer(spawn, objects, cfg) {
    if (!spawn) return null;
    const { id, prefix, offset = 0, controls } = cfg || {};
    const startX = (spawn.x || 0) + offset;
    const startY = spawn.y || 0;
    const textureKey = prefix === "char2" ? "char2_idle" : "char_idle";
    const sprite = this.physics.add.sprite(startX, startY, textureKey);
    sprite.setScale(1);
    if (sprite.body?.setAllowGravity) sprite.body.setAllowGravity(false);
    sprite.setCollideWorldBounds(true);
    sprite.setMaxVelocity(PHYSICS.PLAYER.MAX_VEL_X, PHYSICS.PLAYER.MAX_VEL_Y);
    sprite.setDragX(PHYSICS.PLAYER.DRAG_X);
    sprite.setDepth(50);
    this.playerLayer?.add(sprite);

    const dispW = sprite.displayWidth;
    const dispH = sprite.displayHeight;
    const minBodyWidth = 8;
    const minBodyHeight = 8;
    const rawBodyW = Math.round(dispW - 100);
    const rawBodyH = Math.round(dispH * 0.8);
    const bodyW = Phaser.Math.Clamp(rawBodyW, minBodyWidth, Math.round(dispW));
    const bodyH = Phaser.Math.Clamp(rawBodyH, minBodyHeight, Math.round(dispH));
    const offsetX = Math.round((dispW - bodyW) / 2);
    const offsetY = Math.round(dispH - bodyH - 10);

    const unscaledW = bodyW / sprite.scaleX;
    const unscaledH = bodyH / sprite.scaleY;
    const unscaledOffX = offsetX / sprite.scaleX;
    const unscaledOffY = offsetY / sprite.scaleY;

    sprite.setBodySize(unscaledW, unscaledH);
    sprite.setOffset(unscaledOffX, unscaledOffY);
    sprite.body?.updateFromGameObject?.();

    const supportTop = this.stageRect
      ? Math.round(this.stageRect.y - (this.stageRect.height || 0))
      : this.findGroundSupportTop(objects, startX, sprite.body?.width || sprite.displayWidth);
    let spawnPoint = { x: startX, y: startY };
    if (supportTop != null) {
      const desiredTop = Math.round(
        supportTop - (sprite.body?.height || sprite.displayHeight) - 10
      );
      const desiredSpriteY =
        desiredTop + sprite.displayHeight / 2 - (sprite.body?.offset?.y ?? 0);
      if (sprite.body?.reset) {
        sprite.body.reset(startX, desiredSpriteY);
      } else {
        sprite.setY(desiredSpriteY);
        sprite.body?.updateFromGameObject?.();
      }
      spawnPoint = { x: startX, y: desiredSpriteY };
    }

    const animKeys = this.buildAnimKeys(prefix);
    return {
      id: id || prefix,
      sprite,
      controls,
      facing: "east",
      jumpActive: false,
      jumpHeldMs: 0,
      jumpMode: null,
      jumpFacing: "east",
      jumpAnimGraceMs: 0,
      spawnPoint,
      animKeys,
      reachedGoal: false,
    };
  }

  createPlayerOneControls() {
    const cursors = this.input.keyboard.createCursorKeys();
    return {
      left: () => cursors.left.isDown,
      right: () => cursors.right.isDown,
      jumpJustDown: () => Phaser.Input.Keyboard.JustDown(cursors.up),
      jumpDown: () => cursors.up.isDown,
    };
  }

  createPlayerTwoControls() {
    const keys = this.input.keyboard.addKeys({
      left: "A",
      right: "D",
      jump: "W",
      jumpAlt: "SPACE",
    });
    return {
      left: () => keys.left.isDown,
      right: () => keys.right.isDown,
      jumpJustDown: () =>
        Phaser.Input.Keyboard.JustDown(keys.jump) ||
        Phaser.Input.Keyboard.JustDown(keys.jumpAlt),
      jumpDown: () => keys.jump.isDown || keys.jumpAlt.isDown,
    };
  }

  buildAnimKeys(prefix = "char") {
    const isP2 = prefix === "char2";
    return {
      runEast: isP2 ? "char2_run_east" : "run_east",
      runWest: isP2 ? "char2_run_west" : "run_west",
      jumpEast: isP2 ? "char2_jump_east" : "jump_east",
      jumpWest: isP2 ? "char2_jump_west" : "jump_west",
      runJumpEast: isP2 ? "char2_run_jump_east" : "run_jump_east",
      runJumpWest: isP2 ? "char2_run_jump_west" : "run_jump_west",
      rotEast: isP2 ? "char2_rot_e" : "char_rot_e",
      rotWest: isP2 ? "char2_rot_w" : "char_rot_w",
    };
  }

  ensureCameraTarget(spawn = { x: 0, y: 0 }) {
    if (this.cameraTarget) return;
    this.cameraTarget = this.add.rectangle(
      spawn.x || 0,
      spawn.y || 0,
      2,
      2,
      0x000000,
      0
    );
    this.cameraTarget.setDepth(-999);
  }

  updateCameraTarget() {
    if (!this.cameraTarget) return;
    const active = (this.players || []).filter((p) => p?.sprite);
    if (!active.length) return;
    const sum = active.reduce(
      (acc, p) => {
        acc.x += p.sprite.x;
        acc.y += p.sprite.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    const avgX = sum.x / active.length;
    const avgY = sum.y / active.length;
    this.cameraTarget.setPosition(avgX, avgY);
  }

  ensurePlayerAnimationsExist() {
    if (!this.anims.exists("run_east")) {
      this.anims.create({
        key: "run_east",
        frames: [
          { key: "char_run_0" },
          { key: "char_run_1" },
          { key: "char_run_2" },
          { key: "char_run_3" },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists("run_west")) {
      this.anims.create({
        key: "run_west",
        frames: [
          { key: "char_run_w_0" },
          { key: "char_run_w_1" },
          { key: "char_run_w_2" },
          { key: "char_run_w_3" },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists("jump_east")) {
      this.anims.create({
        key: "jump_east",
        frames: Array.from({ length: 9 }, (_, i) => ({
          key: `char_jump_e_${i}`,
        })),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists("jump_west")) {
      this.anims.create({
        key: "jump_west",
        frames: Array.from({ length: 9 }, (_, i) => ({
          key: `char_jump_w_${i}`,
        })),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists("run_jump_east")) {
      this.anims.create({
        key: "run_jump_east",
        frames: Array.from({ length: 8 }, (_, i) => ({
          key: `char_runjump_e_${i}`,
        })),
        frameRate: 14,
        repeat: -1,
      });
    }
    if (!this.anims.exists("run_jump_west")) {
      this.anims.create({
        key: "run_jump_west",
        frames: Array.from({ length: 8 }, (_, i) => ({
          key: `char_runjump_w_${i}`,
        })),
        frameRate: 14,
        repeat: -1,
      });
    }
    if (!this.anims.exists("char2_run_east")) {
      this.anims.create({
        key: "char2_run_east",
        frames: [
          { key: "char2_run_0" },
          { key: "char2_run_1" },
          { key: "char2_run_2" },
          { key: "char2_run_3" },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists("char2_run_west")) {
      this.anims.create({
        key: "char2_run_west",
        frames: [
          { key: "char2_run_w_0" },
          { key: "char2_run_w_1" },
          { key: "char2_run_w_2" },
          { key: "char2_run_w_3" },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists("char2_jump_east")) {
      this.anims.create({
        key: "char2_jump_east",
        frames: Array.from({ length: 9 }, (_, i) => ({
          key: `char2_jump_e_${i}`,
        })),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists("char2_jump_west")) {
      this.anims.create({
        key: "char2_jump_west",
        frames: Array.from({ length: 9 }, (_, i) => ({
          key: `char2_jump_w_${i}`,
        })),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists("char2_run_jump_east")) {
      this.anims.create({
        key: "char2_run_jump_east",
        frames: Array.from({ length: 8 }, (_, i) => ({
          key: `char2_runjump_e_${i}`,
        })),
        frameRate: 14,
        repeat: -1,
      });
    }
    if (!this.anims.exists("char2_run_jump_west")) {
      this.anims.create({
        key: "char2_run_jump_west",
        frames: Array.from({ length: 8 }, (_, i) => ({
          key: `char2_runjump_w_${i}`,
        })),
        frameRate: 14,
        repeat: -1,
      });
    }
  }
  onCoinCollected(coin) {
    if (!coin?.active) return;
    coin.destroy();
    this.score += UI.SCORE_PER_COIN;
    this.game.events.emit("score:add", UI.SCORE_PER_COIN, this.score);
    playBeep(this, 1046, 80, "square");
    this.levelCoinsCollected = Math.min(
      this.levelCoinsCollected + 1,
      this.levelCoinTotal || Number.MAX_SAFE_INTEGER
    );
    this.emitCoinProgress();
    if (this.getRemainingActiveCoins() === 0) {
      this.allCoinsCollected = true;
      this.notifyUI("Alle Muenzen eingesammelt! Zur Flagge gehen.", 2200);
    }
  }

  // Return rotation texture key using only east/west
  directionKeyFor(state, vx, _vy) {
    const facing = state?.facing || "east";
    const ax = Math.abs(vx);
    if (ax > 30) {
      return vx > 0
        ? state?.animKeys?.rotEast || "char_rot_e"
        : state?.animKeys?.rotWest || "char_rot_w";
    }
    return facing === "west"
      ? state?.animKeys?.rotWest || "char_rot_w"
      : state?.animKeys?.rotEast || "char_rot_e";
  }
  initializeRenderLayers() {
    this.stageLayer?.destroy(true);
    this.platformLayer?.destroy(true);
    this.coinLayer?.destroy(true);
    this.playerLayer?.destroy(true);
    this.stageLayer = this.add.layer();
    this.stageLayer.setDepth(0);
    this.stageLayer.setScrollFactor?.(1);
    this.platformLayer = this.add.layer();
    this.platformLayer.setDepth(20);
    this.platformLayer.setScrollFactor?.(1);
    this.coinLayer = this.add.layer();
    this.coinLayer.setDepth(40);
    this.coinLayer.setScrollFactor?.(1);
    this.playerLayer = this.add.layer();
    this.playerLayer.setDepth(50);
    this.playerLayer.setScrollFactor?.(1);
    this.stageLayer?.parentContainer?.setScale?.(1, 1);
    this.platformLayer?.parentContainer?.setScale?.(1, 1);
    this.coinLayer?.parentContainer?.setScale?.(1, 1);
    this.playerLayer?.parentContainer?.setScale?.(1, 1);
    this.platformLayer?.clearMask?.();
    this.platformLayer?.setBlendMode?.(Phaser.BlendModes.NORMAL);
    this.platformLayer?.setAlpha?.(1);
  }

  logLayerDepths() {
    console.log("LAYER DEPTHS", {
      stage: this.stageLayer?.depth,
      platform: this.platformLayer?.depth,
      coin: this.coinLayer?.depth,
      player: this.playerLayer?.depth,
    });
  }

  resetPlatformVisuals(dropSurfaces = false) {
    if (this.platformLayer) {
      this.platformLayer.removeAll(true);
      this.platformLayer.clearMask?.();
      this.platformLayer.setBlendMode?.(Phaser.BlendModes.NORMAL);
      this.platformLayer.setAlpha?.(1);
    }
    if (dropSurfaces) {
      this.platformSurfaces = [];
      return;
    }
    this.platformSurfaces.forEach((surface) => {
      if (surface?.visuals?.length) {
        surface.visuals.forEach((v) => v?.destroy?.());
      }
      surface.visuals = [];
    });
  }

  isFloatingPlatform({ height }) {
    return (height || 0) > 0 && (height || 0) <= 20;
  }

  createStageSegment({ x, y, width = 32, height = 16 }) {
    const centerX = x + width / 2;
    const centerY = y - height / 2;
    const chunk = this.physics.add.staticImage(centerX, centerY, "ground");
    chunk.displayWidth = width;
    chunk.displayHeight = height;
    chunk.setVisible(false);
    if (chunk.refreshBody) chunk.refreshBody();
    this.platforms.add(chunk);
  }

  createPlatformSurface({ x, y, width = 32, height = 16 }) {
    const top = y - height;
    const left = Math.round(x);
    const topPx = Math.round(top);
    const widthPx = Math.max(1, Math.round(width));
    const heightPx = Math.max(1, Math.round(height));

    const collider = this.add
      .rectangle(left, topPx, widthPx, heightPx, 0xffffff, 0)
      .setOrigin(0, 0);
    this.physics.add.existing(collider, true);
    if (collider.body?.updateFromGameObject)
      collider.body.updateFromGameObject();
    this.platforms.add(collider);

    const visuals = this.stampPlatformOnLine(left, topPx, widthPx, heightPx);

    const surfaceRecord = {
      left,
      right: left + widthPx,
      width: widthPx,
      height: heightPx,
      top: topPx,
      collider,
      visuals,
    };

    this.alignColliderToPlatformSprite(surfaceRecord);
    this.platformSurfaces.push(surfaceRecord);
  }

  // >>> WICHTIG: Hitbox (Collider) exakt auf die Position & Breite der PNG legen,
  // aber Oberkante leicht in die Grafik versetzen (SURFACE_INSET_TOP), damit der Spieler nicht schwebt.
  alignColliderToPlatformSprite(surface) {
    const collider = surface?.collider;
    const sprite = surface?.visuals?.[0];
    const body = collider?.body;
    if (!collider || !sprite || !body) return;

    // Aktuelle Sprite-Maße (die Hitbox soll grundsätzlich zum Sprite passen)
    const spriteW = Math.round(sprite.displayWidth);
    const spriteH = Math.round(sprite.displayHeight);

    // --- ZUERST: Hitbox exakt an Sprite koppeln (ohne Position zu ändern) ---
    // Hier KEIN collider.setPosition(...); wir verändern nicht die Welt-Position.
    // Wir gehen davon aus: collider sitzt bereits am Sprite-TopLeft (oder wo du ihn platziert hast).
    // Setze daher NUR Größe/Offset so, dass Body dem Sprite entspricht:
    body.setSize(spriteW, spriteH, false);
    // Falls dein collider-GameObject TopLeft-Origin hat und schon korrekt steht:
    body.setOffset(body.offset?.x ?? 0, body.offset?.y ?? 0);
    body.updateFromGameObject?.();

    // --- DANN: links & rechts kürzen, OHNE die Position zu verändern ---
    const TRIM = 0; // je Seite X Pixel kürzen
    const newW = Math.max(4, spriteW - 2 * TRIM); // neue Breite
    const keepCenterOffsetX = (spriteW - newW) / 2; // zentriert kürzen ⇒ Zentrum bleibt gleich

    // Größe ändern, Offset so setzen, dass die Mitte identisch bleibt
    body.setSize(newW, spriteH, false);
    body.setOffset(
      (body.offset?.x ?? 0) + keepCenterOffsetX,
      body.offset?.y ?? 0
    );
    body.updateFromGameObject?.();


  }

  buildVisiblePlatformsFromLines() {
    const textureKey = this.platformTextureKey ?? "platform";
    if (!this.textures.exists(textureKey)) {
      console.error(`${textureKey} texture missing`);
      return;
    }

    this.platformSurfaces.forEach((surface) => {
      const left = Math.round(surface.left ?? 0);
      const top = Math.round(surface.top ?? 0);
      const widthPx = Math.max(1, Math.round(surface.width ?? 1));
      const heightPx = Math.max(1, Math.round(surface.height ?? 1));

      // Visuals erzeugen/positionieren (Sprite hat Origin (0,1) an (left, top))
      if (!surface.visuals?.length) {
        surface.visuals = this.stampPlatformOnLine(
          left,
          top,
          widthPx,
          heightPx
        );
      } else {
        this.positionPlatformVisuals(surface, left, top, widthPx, heightPx);
      }

      // Danach Collider exakt an Sprite anlegen
      this.alignColliderToPlatformSprite(surface);
    });
  }

  stampPlatformOnLine(left, top, widthPx, heightPx = 16) {
    const textureKey = this.platformTextureKey ?? "platform";
    const source = this.textures.get(textureKey)?.getSourceImage?.();
    if (!source) {
      console.error(`${textureKey} texture missing`);
      return [];
    }
    const { width, height } = this.platformDisplaySize ?? {
      width: 140,
      height: 60,
    };
    const lineLeft = Math.round(left);
    const lineTop = Math.round(top + PLATFORM_Y_OFFSET);
    const sprite = this.add
      .image(lineLeft, lineTop, textureKey)
      .setOrigin(0, 1)
      .setDepth(20)
      .setScrollFactor(1)
      .setVisible(true)
      .setAlpha(1);
    sprite.setDisplaySize(width, height);
    this.platformLayer?.add?.(sprite);
    return [sprite];
  }

  positionPlatformVisuals(surface, left, top, widthPx, heightPx = 16) {
    const { width, height } = this.platformDisplaySize ?? {
      width: 140,
      height: 60,
    };
    const posX = Math.round(left);
    const posY = Math.round(top + PLATFORM_Y_OFFSET);
    (surface.visuals || []).forEach((sprite) => {
      if (!sprite) return;
      sprite.setPosition(posX, posY);
      sprite.setDisplaySize(width, height);
      sprite.setDepth(20);
      sprite.setScrollFactor(1);
      sprite.setVisible(true);
      this.platformLayer?.add?.(sprite);
    });
  }

  spawnCoinsForPlatforms() {
    if (!this.coins) return;
    if (this.coins.clear) this.coins.clear(true, true);
    this.coinLayer?.removeAll(true);

    const coinTex = this.textures.get("coin")?.getSourceImage?.();
    const baseCoinHeight = coinTex?.height || 16;

    this.platformSurfaces.forEach((surface) => {
      const offsets = this.coinOffsetsForWidth(surface.width);
      offsets.forEach((offset) => {
        if (surface.left == null || surface.top == null) return;
        const coinX = surface.left + offset;
        const coin = this.physics.add
          .staticImage(coinX, surface.top, "coin")
          .setDepth(40)
          .setVisible(true);
        const coinHeight = coin.displayHeight || coin.height || baseCoinHeight;
        coin.setY(surface.top - coinHeight * 0.5 - 30);
        if (coin.body?.updateFromGameObject) coin.body.updateFromGameObject();
        this.coinLayer?.add?.(coin);
        this.coins.add(coin);
      });
    });
    const activeCoins = this.getRemainingActiveCoins();
    this.levelCoinTotal = activeCoins;
    this.levelCoinsCollected = 0;
    this.emitCoinProgress();
  }

  coinOffsetsForWidth(width) {
    if (width < 48) return [width / 2];
    if (width < 112) return [width * 0.5];
    return [width * 0.35, width * 0.65];
  }

  // Find the top Y of a ground object spanning x, or null
  findGroundTopAtX(objects, x) {
    let best = null;
    for (const obj of objects) {
      if (obj.type !== "ground") continue;
      const left = obj.x;
      const right = obj.x + (obj.width || 0);
      if (x >= left && x <= right) {
        const top = obj.y - (obj.height || 0);
        if (best == null || top < best) best = top;
      }
    }
    return best;
  }

  // Find the ground object (rect) spanning x with the highest surface (smallest top y)
  findGroundObjAtX(objects, x) {
    let bestObj = null;
    let bestTop = Number.POSITIVE_INFINITY;
    for (const obj of objects) {
      if (obj.type !== "ground") continue;
      const left = obj.x;
      const right = obj.x + (obj.width || 0);
      if (x >= left && x <= right) {
        const top = obj.y - (obj.height || 0);
        if (top < bestTop) {
          bestTop = top;
          bestObj = obj;
        }
      }
    }
    return bestObj;
  }

  // Nudge/remove spikes so they sit fully on platforms, never on background, and not over edges
  refineSpikePlacement(objects) {
    if (!this.hazards?.getChildren) return;
    const hazards = this.hazards
      .getChildren()
      .slice()
      .sort((a, b) => a.x - b.x);
    const worldW = this.physics.world.bounds.width;
    const stageTop = this.stageRect
      ? Math.round(this.stageRect.y - (this.stageRect.height || 0))
      : Math.round(this.cameras.main.height - 64);
    const stageLeft = 0;
    const stageRight = worldW;
    const seen = new Set();
    const kept = [];
    for (const h of hazards) {
      // Clamp within stage and snap to 16px grid
      const clampedX = Math.min(
        Math.max(Math.round(h.x), stageLeft + 8),
        stageRight - 8
      );
      const idx = Math.round((clampedX - (stageLeft + 8)) / 16);
      if (seen.has(idx)) {
        // duplicate/overlap -> remove
        if (h._sprite?.destroy) h._sprite.destroy();
        if (h.destroy) h.destroy();
        continue;
      }
      seen.add(idx);
      kept.push(h);
      // Place flush on stage top
      if (h.setPosition) h.setPosition(stageLeft + 8 + idx * 16, stageTop - 8);
      if (h.body?.updateFromGameObject) h.body.updateFromGameObject();
      if (h._sprite?.setPosition)
        h._sprite
          .setPosition(stageLeft + 8 + idx * 16, stageTop)
          .setOrigin(0.5, 1);
    }
  }

  // Find a supporting ground top considering the player's width
  findGroundSupportTop(objects, x, width) {
    const half = Math.max(1, Math.floor(width / 2));
    const a = this.findGroundTopAtX(objects, x - half);
    const b = this.findGroundTopAtX(objects, x);
    const c = this.findGroundTopAtX(objects, x + half);
    // Choose the highest available support (smallest Y)
    const candidates = [a, b, c].filter((v) => v != null);
    if (!candidates.length) return null;
    return Math.min(...candidates);
  }

  getPlatformDisplaySize() {
    const defaultSize = { width: 140, height: 60 };
    if (this.levelId === 2) {
      return { width: 112, height: 48 };
    }
    if (this.levelId === 3) {
      return { width: 120, height: 52 };
    }
    return defaultSize;
  }

  getPlatformTextureKey() {
    const levelSpecific = {
      2: "platform_snow",
      3: "platform_desert",
    };
    const preferred = levelSpecific[this.levelId];
    if (preferred && this.textures.exists(preferred)) {
      return preferred;
    }
    if (this.textures.exists("platform")) {
      return "platform";
    }
    if (this.textures.exists("platform_snow")) {
      return "platform_snow";
    }
    if (this.textures.exists("platform_desert")) {
      return "platform_desert";
    }
    return preferred || "platform";
  }

  getStageTextureKey() {
    const levelSpecific = {
      2: "stage_snow",
      3: "stage_desert",
    };
    const preferred = levelSpecific[this.levelId];
    if (preferred && this.textures.exists(preferred)) {
      return preferred;
    }
    if (this.textures.exists("stage")) {
      return "stage";
    }
    return preferred || "stage";
  }

  getStageVisualConfig() {
    const key = this.getStageTextureKey();
    const overrides = {
      stage_snow: { height: 64 },
    };
    return {
      key,
      ...(overrides[key] || {}),
    };
  }

  getBackgroundTextureKey() {
    const levelSpecific = {
      2: "level_bg_snow",
      3: "level_bg_desert",
    };
    const preferred = levelSpecific[this.levelId];
    if (preferred && this.textures.exists(preferred)) {
      return preferred;
    }
    if (this.textures.exists("level_bg")) {
      return "level_bg";
    }
    // Fall back to any other loaded background so we never render a blank screen.
    if (this.textures.exists("level_bg_desert")) return "level_bg_desert";
    if (this.textures.exists("level_bg_snow")) return "level_bg_snow";
    return preferred || "level_bg";
  }

  handleGoalOverlap(playerState) {
    if (!this.allCoinsCollected && this.getRemainingActiveCoins() > 0) {
      if (this.time.now >= this.goalWarningCooldown) {
        this.goalWarningCooldown = this.time.now + 1500;
        this.notifyUI("Es muessen alle Muenzen eingesammelt werden", 2000);
        playBeep(this, 300, 120, "sawtooth");
      }
      return;
    }
    if (this.playerCount <= 1 || !playerState) {
      this.onLevelComplete();
      return;
    }
    const id = playerState.id || `p-${this.playersAtGoal.size + 1}`;
    this.playersAtGoal.add(id);
    if (this.playersAtGoal.size >= this.playerCount) {
      this.onLevelComplete();
    } else {
      this.notifyUI("Warte auf Mitspieler an der Flagge", 1500);
    }
  }
  getRemainingActiveCoins() {
    return (this.coins?.getChildren?.() || []).filter((c) => c.active).length;
  }

  emitCoinProgress() {
    if (!this.scene?.isActive?.("UIScene")) {
      if (!this.coinProgressRetryTimer && this.time) {
        this.coinProgressRetryTimer = this.time.delayedCall(16, () => {
          this.coinProgressRetryTimer = null;
          this.emitCoinProgress();
        });
      }
      return;
    }
    this.clearCoinProgressRetryTimer();
    const remaining = this.getRemainingActiveCoins();
    const total = Math.max(
      this.levelCoinTotal || 0,
      remaining + (this.levelCoinsCollected || 0)
    );
    const collected = Math.min(this.levelCoinsCollected || 0, total);
    this.game?.events?.emit("coins:update", {
      collected,
      remaining,
      total,
    });
  }

  notifyUI(message, duration = 2000) {
    this.game?.events?.emit("ui:notify", message, duration);
  }

  clearCoinProgressRetryTimer() {
    if (this.coinProgressRetryTimer) {
      this.coinProgressRetryTimer.remove(false);
      this.coinProgressRetryTimer = null;
    }
  }
}




