import Phaser from "phaser";
import levelsData from "../level/levels.json";
import { DEFAULTS, PHYSICS, UI, CONTROLS, playBeep } from "../config.js";
import { loadProgress, saveProgress } from "../state/saveSystem.js";

// Grafik nach unten rücken (nur VISUELL)
const PLATFORM_Y_OFFSET = 40;
const SPLIT_DISTANCE_ON = 520;
const SPLIT_DISTANCE_OFF = 420;
const REACTION_DISTANCE = 64;
const COIN_X_OFFSET = 0;
const COIN_Y_OFFSET = 0;
const SPIKE_ZONE_X_OFFSET = 0;
const SPIKE_ZONE_WIDTH_SCALE = 1;
const GOAL_SAFE_BUFFER = 192;
const PRINT_LAYOUT_IDS = false;
const EDITOR_ACCESS_TOKEN = "secret1";
const EDITOR_GRID_SIZE = 16;
const EDITOR_HISTORY_LIMIT = 50;
const LEVEL_OVERRIDES = {
  // "1": {
  //   coins: [
  //     { id: "c1", dx: 10, dy: 25 },
  //     { id: "c7", remove: true },
  //     { id: "c99", add: true, x: 420, y: 260 },
  //   ],
  //   platforms: [
  //     { id: "p2", dx: 32, dy: -16 },
  //     { id: "p6", remove: true },
  //     { id: "p20", add: true, x: 640, y: 320, width: 140, height: 16 },
  //   ],
  //   spikes: [
  //     { id: "s4", dx: -16, dy: 0 },
  //     { id: "s9", remove: true },
  //     { id: "s30", add: true, x: 720, y: 420 },
  //   ],
  // },
};

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
    this.splitCamera = null;
    this.splitActive = false;
    this.cameraTargetP1 = null;
    this.cameraTargetP2 = null;
    this.cameraTarget = null;
    this.platformSurfaces = [];
    this.groundSegments = [];
    this.groundGapRanges = [];
    this.spikeZones = [];
    this.safeGroundSegments = [];
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
    this.coinIdCounter = 0;
    this.spikeIdCounter = 0;
    this.platformIdCounter = 0;
    this.spikeTiles = [];
    this.pauseMenu = null;
    this.pauseMenuButtons = { resume: null, quit: null };
    this.isPauseMenuVisible = false;
    this.pauseHotkeyHandler = null;
    this.wasPhysicsPausedBeforeMenu = false;
    this.pauseMenuUiWasActive = false;
    this.skipOverrides = false;
    this.overrideApplied = false;
    this.overrideApplyPending = false;
    this.overrideApplyTimer = null;
    this.externalOverrides = null;
    this.externalOverridesReady = false;
    this.externalOverridesLoading = false;
    this.editorOverrides = {};
    this.editorEnabled = false;
    this.editorRequested = false;
    this.editorToken = null;
    this.editorUi = null;
    this.editorButtons = {};
    this.editorUiCamera = null;
    this.editorUiObjects = [];
    this.editorUiHoverLabel = null;
    this.editorTool = "select";
    this.editorSelection = null;
    this.editorOutline = null;
    this.editorDebugText = null;
    this.editorHoverId = null;
    this.editorHoverType = null;
    this.editorHitboxDrag = null;
    this.editorPanning = false;
    this.editorPanStart = null;
    this.editorPanKey = null;
    this.editorPanKeys = null;
    this.editorFreeze = true;
    this.editorHistory = [];
    this.editorRedo = [];
    this.editorDragStart = null;
    this.editorSnap = true;
    this.editorShowGrid = false;
    this.editorGrid = null;
    this.editorInputReady = false;
    this.layoutReady = false;
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
    this.splitCamera = null;
    this.splitActive = false;
    this.cameraTargetP1 = null;
    this.cameraTargetP2 = null;
    this.cameraTarget = null;
    this.groundSegments = [];
    this.groundGapRanges = [];
    this.spikeZones = [];
    this.safeGroundSegments = [];
    this.allCoinsCollected = false;
    this.goalWarningCooldown = 0;
    this.isLevelComplete = false;
    this.levelCoinTotal = 0;
    this.levelCoinsCollected = 0;
    this.coinProgressRetryTimer = null;
    this.coinIdCounter = 0;
    this.spikeIdCounter = 0;
    this.platformIdCounter = 0;
    this.spikeTiles = [];
    this.isPauseMenuVisible = false;
    this.pauseMenu = null;
    this.pauseMenuButtons = { resume: null, quit: null };
    this.pauseHotkeyHandler = null;
    this.wasPhysicsPausedBeforeMenu = false;
    this.pauseMenuUiWasActive = false;
    this.skipOverrides = data.skipOverrides ?? false;
    this.overrideApplied = false;
    this.overrideApplyPending = false;
    this.overrideApplyTimer = null;
    this.externalOverrides = data.externalOverrides ?? null;
    this.externalOverridesReady = data.externalOverridesReady ?? false;
    this.externalOverridesLoading = false;
    this.editorOverrides = data.editorOverrides ?? {};
    this.editorEnabled = data.editorEnabled ?? false;
    this.editorRequested = data.editorRequested ?? false;
    this.editorToken = data.editorToken ?? null;
    this.editorUi = null;
    this.editorButtons = {};
    this.editorUiCamera = null;
    this.editorUiObjects = [];
    this.editorUiHoverLabel = null;
    this.editorTool = "select";
    this.editorSelection = null;
    this.editorOutline = null;
    this.editorDebugText = null;
    this.editorHoverId = null;
    this.editorHoverType = null;
    this.editorHitboxDrag = null;
    this.editorPanning = false;
    this.editorPanStart = null;
    this.editorPanKey = null;
    this.editorPanKeys = null;
    this.editorFreeze = data.editorFreeze ?? true;
    this.editorHistory = data.editorHistory ?? [];
    this.editorRedo = data.editorRedo ?? [];
    this.editorDragStart = null;
    this.editorSnap = true;
    this.editorShowGrid = false;
    this.editorGrid = null;
    this.editorInputReady = false;
    this.layoutReady = false;
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
      this.loadExternalOverrides();
      this.checkEditorAccessFromUrl();

      // Build level from object layer
      const map = this.make.tilemap({ key: `level-${this.levelId}` });
      const layer = map ? map.getObjectLayer("Objects") : null;
      if (!layer) {
        throw new Error('Level data missing object layer "Objects"');
      }
      const rawObjects = layer.objects || [];
      const objects = this.applyLevelLayoutRules(rawObjects);

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
        if (this.groundGapRanges?.length && this.groundSegments?.length) {
          this.stageImage.setVisible(false);
          this.groundSegments.forEach((segment) => {
            const segWidth = Math.round(segment.width || 0);
            if (segWidth < 16) return;
            const segLeft = Math.round(segment.left ?? segment.x ?? 0);
            const segSprite = this.add
              .tileSprite(segLeft, stageTop, segWidth, stageHeight, stageKey)
              .setOrigin(0, 0)
              .setDepth(0)
              .setScrollFactor(1, 1);
            segSprite.setTileScale(tileScaleX, tileScaleY);
            this.stageLayer.add(segSprite);
          });
        }
      }

      // Player spawn
      const spawn = objects.find((o) => o.type === "spawn") || {
        x: 64,
        y: 400,
      };

      this.spikeIdCounter = 0;
      this.spikeTiles = [];
      this.platformIdCounter = 0;

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
          if (obj.name === "gapKill") {
            const gapWidth = Math.max(1, Math.round(width));
            if (gapWidth < 16) return;
            const gapLeft = Math.round(x);
            const gapTop = Math.round(stageTop + 8);
            const gapHeight = Math.max(16, Math.round(worldHeight - gapTop));
            const hitbox = this.add.rectangle(
              gapLeft + gapWidth * 0.5,
              gapTop + gapHeight * 0.5,
              gapWidth,
              gapHeight,
              0xd64545,
              0
            );
            this.physics.add.existing(hitbox, true);
            hitbox._gapKill = true;
            this.hazards.add(hitbox);
            return;
          }
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
            const groundTopRaw = this.findStageTopAtX(objects, tileCenterX);
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
            const spikeId = `s${this.spikeIdCounter++}`;
            spike._overrideId = spikeId;
            hitbox._overrideId = spikeId;
            hitbox._sprite = spike;
            this.hazards.add(hitbox);
            this.spikeTiles.push(hitbox);
          }
        } else if (type === "goal") {
          const flag = this.add.image(x + 8, y - 10, "flag");
          this.physics.add.existing(flag, true);
          this.goals.add(flag);
        }
      });

      // KEIN this.platforms.refresh() hier, damit manuell gesetzte Body-Grβßen bestehen bleiben.
      this.time.delayedCall(0, () => this.buildVisiblePlatformsFromLines());
      this.time.delayedCall(1, () => {
        this.spawnCoinsForPlatforms();
        this.applyLayoutOverrides();
      });
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
      this.ensurePlayerCameraTargets(spawn);
      this.createSplitCamera();
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
      if (this.editorEnabled) {
        this.prepareEditorCameraForEditing();
      } else {
        this.setSplitMode(false);
        this.updateCameraTarget();
      }

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

    if (this.editorEnabled) {
      this.updateEditorCameraPan(delta);
      this.updateEditorDebugOverlay(this.input?.activePointer);
      if (this.editorFreeze) {
        this.freezePlayersForEditor();
        return;
      }
      if (this.players?.length)
        this.players.forEach((pState) => this.updatePlayerState(pState, delta));
      return;
    }

    if (!this.players?.length) return;
    this.players.forEach((pState) => this.updatePlayerState(pState, delta));
    this.updateCameraTarget();
    this.updateSplitScreenLogic();
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

  updateSplitScreenLogic() {
    if (this.playerCount <= 1 || this.players.length < 2) {
      if (this.splitActive) this.setSplitMode(false);
      return;
    }
    const p1 = this.players[0]?.sprite;
    const p2 = this.players[1]?.sprite;
    if (!p1 || !p2) {
      if (this.splitActive) this.setSplitMode(false);
      return;
    }
    if (this.splitActive) {
      this.updateSplitCameraFollows();
    }
    const dist = Math.abs(p1.x - p2.x);
    if (!this.splitActive && dist > SPLIT_DISTANCE_ON) {
      this.setSplitMode(true);
    } else if (this.splitActive && dist < SPLIT_DISTANCE_OFF) {
      this.setSplitMode(false);
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
      : this.findGroundSupportTop(
          objects,
          startX,
          sprite.body?.width || sprite.displayWidth
        );
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

  ensurePlayerCameraTargets(spawn = { x: 0, y: 0 }) {
    if (!this.cameraTargetP1) {
      this.cameraTargetP1 = this.add.rectangle(
        spawn.x || 0,
        spawn.y || 0,
        2,
        2,
        0x000000,
        0
      );
      this.cameraTargetP1.setDepth(-999);
    }
    if (!this.cameraTargetP2) {
      this.cameraTargetP2 = this.add.rectangle(
        spawn.x || 0,
        spawn.y || 0,
        2,
        2,
        0x000000,
        0
      );
      this.cameraTargetP2.setDepth(-999);
    }
  }

  createSplitCamera() {
    if (this.splitCamera) return;
    const w = this.scale?.width ?? 800;
    const h = this.scale?.height ?? 480;
    this.splitCamera = this.cameras.add(0, 0, w / 2, h);
    this.splitCamera.setBackgroundColor("#101428");
    this.splitCamera.setBounds(
      0,
      0,
      this.physics.world.bounds.width,
      this.physics.world.bounds.height
    );
    this.splitCamera.setVisible(false);
  }

  setSplitMode(active) {
    const width = this.scale?.width ?? 800;
    const height = this.scale?.height ?? 480;
    this.splitActive =
      !!active && this.playerCount > 1 && this.players.length > 1;
    if (!this.splitActive) {
      this.cameras.main.setViewport(0, 0, width, height);
      this.cameras.main.startFollow(this.cameraTarget, true, 0.1, 0.1);
      this.cameras.main.setDeadzone(140, 90);
      if (this.splitCamera) {
        this.splitCamera.setVisible(false);
        this.splitCamera.stopFollow();
      }
      this.dividerLine?.setVisible(false);
      return;
    }

    // Split vertically (links P1, rechts P2)
    this.cameras.main.setViewport(0, 0, width / 2, height);
    this.splitCamera?.setViewport(width / 2, 0, width / 2, height);
    this.splitCamera?.setVisible(true);
    this.ensureDividerLine(width, height);
    this.updateSplitCameraFollows();
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
    if (this.cameraTargetP1 && this.players[0]?.sprite) {
      this.cameraTargetP1.setPosition(
        this.players[0].sprite.x,
        this.players[0].sprite.y
      );
    }
    if (this.cameraTargetP2 && this.players[1]?.sprite) {
      this.cameraTargetP2.setPosition(
        this.players[1].sprite.x,
        this.players[1].sprite.y
      );
    }
  }

  getPlayersOrderedByX() {
    return (this.players || [])
      .filter((p) => p?.sprite)
      .slice()
      .sort((a, b) => (a.sprite.x ?? 0) - (b.sprite.x ?? 0));
  }

  updateSplitCameraFollows() {
    if (!this.splitActive || !this.splitCamera) return;
    const ordered = this.getPlayersOrderedByX();
    if (ordered.length < 2) return;
    const left = ordered[0];
    const right = ordered[ordered.length - 1];
    const leftTarget =
      this.cameraTargetP1 && this.players[0] === left
        ? this.cameraTargetP1
        : left.sprite;
    const rightTarget =
      this.cameraTargetP2 && this.players[1] === right
        ? this.cameraTargetP2
        : right.sprite;
    this.cameras.main.startFollow(leftTarget, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(80, 60);
    this.splitCamera.startFollow(rightTarget, true, 0.12, 0.12);
    this.splitCamera.setDeadzone(80, 60);
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

  ensureDividerLine(width, height) {
    if (!this.dividerLine) {
      this.dividerLine = this.add.rectangle(0, 0, 2, height, 0x000000, 1);
      this.dividerLine.setOrigin(0.5, 0);
      this.dividerLine.setScrollFactor(0);
      this.dividerLine.setDepth(5000);
    }
    this.dividerLine.setVisible(this.splitActive);
    this.dividerLine.setPosition(width / 2, 0);
    this.dividerLine.displayHeight = height;
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
    const platformId = `p${this.platformIdCounter++}`;
    surfaceRecord.overrideId = platformId;
    collider._overrideId = platformId;

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
    this.coinIdCounter = 0;

    const coinTex = this.textures.get("coin")?.getSourceImage?.();
    const baseCoinHeight = coinTex?.height || 16;

    let platformCoinSources = 0;
    this.platformSurfaces.forEach((surface) => {
      platformCoinSources += 1;
      const offsets = this.coinOffsetsForWidth(surface.width);
      offsets.forEach((offset) => {
        if (surface.left == null || surface.top == null) return;
        const surfaceRight =
          surface.right ?? surface.left + (surface.width || 0);
        let coinX = surface.left + offset + COIN_X_OFFSET;
        if (coinX < surface.left + 8) coinX = surface.left + 8;
        if (coinX > surfaceRight - 8) coinX = surfaceRight - 8;
        const coin = this.physics.add
          .staticImage(coinX, surface.top, "coin")
          .setDepth(40)
          .setVisible(true);
        const coinId = `c${this.coinIdCounter++}`;
        coin._overrideId = coinId;
        const coinHeight = coin.displayHeight || coin.height || baseCoinHeight;
        coin.setY(surface.top - coinHeight * 0.5 - 30 - COIN_Y_OFFSET);
        if (coin.body?.updateFromGameObject) coin.body.updateFromGameObject();
        this.coinLayer?.add?.(coin);
        this.coins.add(coin);
      });
    });
    const stageTop = this.stageRect
      ? Math.round(this.stageRect.y - (this.stageRect.height || 0))
      : Math.round(this.cameras.main.height - 64);
    let totalCoins = this.getRemainingActiveCoins();
    const groundSegments = this.groundSegments || [];
    const spikeZones = this.spikeZones || [];
    const gapRanges = this.groundGapRanges || [];
    const goalSafeRange = this.goalSafeRange;
    const isInGoalSafeZone = (x) =>
      goalSafeRange && x >= goalSafeRange.left && x <= goalSafeRange.right;
    const obstacleCoinSources =
      spikeZones.length + gapRanges.length + platformCoinSources;
    const minCoinTarget = Phaser.Math.Clamp(
      Math.floor(obstacleCoinSources * 1.2),
      12,
      28
    );
    const extraCoinsMax = Math.max(24, minCoinTarget, obstacleCoinSources * 2);
    const minBaseCoins = 12;
    let extraCoins = 0;
    let groundCoinPlaced = false;

    const isInSpikeZone = (x) =>
      spikeZones.some((zone) => x >= zone.left + 8 && x <= zone.right - 8);

    const jumpSpeed = Math.abs(PHYSICS.PLAYER.JUMP_SPEED || 0);
    const gravityY = Math.max(1, PHYSICS.GRAVITY_Y || 1);
    const playerJumpReach = jumpSpeed
      ? Math.round((jumpSpeed * jumpSpeed) / (2 * gravityY))
      : 80;
    const maxJumpDistanceRaw = jumpSpeed
      ? Math.round(
          (PHYSICS.PLAYER.MAX_VEL_X || 0) * ((2 * jumpSpeed) / gravityY)
        )
      : 220;
    const jumpHeightLimit = Math.max(48, playerJumpReach - 8);
    const jumpDistanceLimit = Math.max(96, maxJumpDistanceRaw - 24);
    const hazardRunup = 64;
    const hazardClearance = 32;
    const hazardCoinOffset = 60 + COIN_Y_OFFSET;
    const groundCoinOffset = 36 + COIN_Y_OFFSET;
    const safeGroundSegments = this.safeGroundSegments || [];
    const platformSurfaces = this.platformSurfaces || [];
    const safeSurfaces = safeGroundSegments
      .map((segment) => ({
        left: segment.left,
        right: segment.right,
        top: segment.top,
        width: segment.width,
        isPlatform: false,
      }))
      .concat(
        platformSurfaces.map((surface) => ({
          left: surface.left,
          right: surface.right,
          top: surface.top,
          width: surface.width,
          isPlatform: true,
        }))
      );

    const surfaceWidth = (surface) =>
      surface.width ?? Math.max(0, surface.right - surface.left);
    const hasRunup = (surface) => surfaceWidth(surface) >= hazardRunup;

    const isSurfaceReachable = (surface, coinX, coinY) => {
      const left = surface.left;
      const right = surface.right;
      const dist =
        coinX < left ? left - coinX : coinX > right ? coinX - right : 0;
      if (dist > jumpDistanceLimit) return false;
      const heightAbove = Math.max(0, surface.top - coinY);
      if (heightAbove > jumpHeightLimit) return false;
      return true;
    };

    const findNearestSurfaceLeft = (x) => {
      let best = null;
      let bestDist = Number.POSITIVE_INFINITY;
      safeSurfaces.forEach((surface) => {
        if (surface.right > x) return;
        const dist = x - surface.right;
        if (dist < bestDist) {
          bestDist = dist;
          best = surface;
        }
      });
      return best;
    };

    const findNearestSurfaceRight = (x) => {
      let best = null;
      let bestDist = Number.POSITIVE_INFINITY;
      safeSurfaces.forEach((surface) => {
        if (surface.left < x) return;
        const dist = surface.left - x;
        if (dist < bestDist) {
          bestDist = dist;
          best = surface;
        }
      });
      return best;
    };

    const canReachCoin = (
      coinX,
      coinY,
      requireBothSides,
      requireSurfaceAtX
    ) => {
      if (!safeSurfaces.length) return false;
      const surfaceAtX = safeSurfaces.find(
        (surface) => coinX >= surface.left && coinX <= surface.right
      );
      if (requireSurfaceAtX) {
        return surfaceAtX
          ? isSurfaceReachable(surfaceAtX, coinX, coinY)
          : false;
      }
      if (requireBothSides) {
        const leftSurface = findNearestSurfaceLeft(coinX);
        const rightSurface = findNearestSurfaceRight(coinX);
        if (!leftSurface || !rightSurface) return false;
        if (!hasRunup(leftSurface) || !hasRunup(rightSurface)) return false;
        if (!isSurfaceReachable(leftSurface, coinX, coinY)) return false;
        if (!isSurfaceReachable(rightSurface, coinX, coinY)) return false;
        return true;
      }
      if (surfaceAtX && isSurfaceReachable(surfaceAtX, coinX, coinY))
        return true;
      const leftSurface = findNearestSurfaceLeft(coinX);
      if (leftSurface && isSurfaceReachable(leftSurface, coinX, coinY))
        return true;
      const rightSurface = findNearestSurfaceRight(coinX);
      if (rightSurface && isSurfaceReachable(rightSurface, coinX, coinY))
        return true;
      return false;
    };

    const placeExtraCoin = (coinX, baseTop, offsetY) => {
      if (extraCoins >= extraCoinsMax) return false;
      const coin = this.physics.add
        .staticImage(coinX, baseTop, "coin")
        .setDepth(40)
        .setVisible(true);
      const coinId = `c${this.coinIdCounter++}`;
      coin._overrideId = coinId;
      const coinHeight = coin.displayHeight || coin.height || baseCoinHeight;
      coin.setY(baseTop - coinHeight * 0.5 - offsetY);
      if (coin.body?.updateFromGameObject) coin.body.updateFromGameObject();
      this.coinLayer?.add?.(coin);
      this.coins.add(coin);
      extraCoins += 1;
      totalCoins += 1;
      return true;
    };

    const maxCoinTries = 3;
    const tryPlaceCoin = (
      candidateXs,
      baseTop,
      offsetY,
      requireBothSides,
      requireSurfaceAtX,
      hazardBounds
    ) => {
      let tries = 0;
      for (const coinX of candidateXs) {
        if (extraCoins >= extraCoinsMax) return false;
        if (tries >= maxCoinTries) break;
        tries += 1;
        const coinY = baseTop - baseCoinHeight * 0.5 - offsetY;
        const coinTop = coinY - baseCoinHeight * 0.5;
        const coinBottom = coinY + baseCoinHeight * 0.5;
        const overlapsPlatform = platformSurfaces.some((surface) => {
          if (coinX < surface.left || coinX > surface.right) return false;
          const surfaceTop = surface.top;
          const surfaceBottom = surface.top + (surface.height || 0);
          return coinBottom > surfaceTop && coinTop < surfaceBottom;
        });
        if (overlapsPlatform) continue;
        const platformAbove = platformSurfaces.find(
          (surface) =>
            coinX >= surface.left &&
            coinX <= surface.right &&
            coinY > surface.top
        );
        if (platformAbove) {
          const leftSurface = findNearestSurfaceLeft(coinX);
          if (!leftSurface || leftSurface.isPlatform) continue;
        }
        if (!canReachCoin(coinX, coinY, requireBothSides, requireSurfaceAtX))
          continue;
        if (hazardBounds) {
          const leftSurface = findNearestSurfaceLeft(coinX);
          const rightSurface = findNearestSurfaceRight(coinX);
          if (!leftSurface || !rightSurface) continue;
          if (leftSurface.right > hazardBounds.left - hazardBounds.clearance)
            continue;
          if (rightSurface.left < hazardBounds.right + hazardBounds.clearance)
            continue;
        }
        if (placeExtraCoin(coinX, baseTop, offsetY)) return true;
      }
      return false;
    };

    const placePreHazardCoin = (hazardLeft) => {
      const runwayLeft = hazardLeft - REACTION_DISTANCE;
      const runwayRight = hazardLeft - 16;
      if (runwayRight <= runwayLeft) return false;
      for (let i = 0; i < safeGroundSegments.length; i++) {
        const segment = safeGroundSegments[i];
        if (segment.right <= runwayLeft) continue;
        if (segment.left >= runwayRight) continue;
        const segLeft = Math.max(segment.left, runwayLeft);
        const segRight = Math.min(segment.right, runwayRight);
        if (segRight - segLeft < 16) continue;
        const candidates = [segRight - 8, segRight - 24, segRight - 40]
          .map((x) => x + COIN_X_OFFSET)
          .filter((x) => x >= segLeft + 8 && x <= segRight - 8)
          .filter((x) => !isInGoalSafeZone(x));
        if (!candidates.length) continue;
        if (
          tryPlaceCoin(candidates, segment.top, groundCoinOffset, false, true)
        )
          return true;
      }
      return false;
    };

    spikeZones.forEach((zone) => {
      if (extraCoins >= extraCoinsMax) return;
      placePreHazardCoin(zone.left);
    });

    gapRanges.forEach((gap) => {
      if (extraCoins >= extraCoinsMax) return;
      placePreHazardCoin(gap.left);
    });

    const spikeZonesOrdered = spikeZones
      .slice()
      .sort((a, b) => (b.followUp ? 1 : 0) - (a.followUp ? 1 : 0));
    spikeZonesOrdered.forEach((zone) => {
      if (extraCoins >= extraCoinsMax) return;
      const width = zone.right - zone.left;
      if (width < 16) return;
      const center = zone.left + width * 0.5;
      const candidates = [center, center - 16, center + 16]
        .map((x) => x + COIN_X_OFFSET)
        .filter((x) => x >= zone.left + 8 && x <= zone.right - 8)
        .filter((x) => !isInGoalSafeZone(x));
      if (
        tryPlaceCoin(candidates, stageTop, hazardCoinOffset, true, false, {
          left: zone.left,
          right: zone.right,
          clearance: hazardClearance,
        })
      )
        return;
    });

    gapRanges.forEach((gap) => {
      if (extraCoins >= extraCoinsMax) return;
      const width = gap.right - gap.left;
      if (width < 16) return;
      const center = gap.left + width * 0.5;
      const candidates = [center, center - 16, center + 16]
        .map((x) => x + COIN_X_OFFSET)
        .filter((x) => x >= gap.left + 8 && x <= gap.right - 8)
        .filter((x) => !isInGoalSafeZone(x));
      if (
        tryPlaceCoin(candidates, stageTop, hazardCoinOffset, true, false, {
          left: gap.left,
          right: gap.right,
          clearance: hazardClearance,
        })
      )
        return;
    });

    const allowGroundCoins = false;
    if (allowGroundCoins) {
      groundSegments.forEach((segment, index) => {
        if (extraCoins >= extraCoinsMax) return;
        const width = segment.width || 0;
        if (width < 160) return;
        if (index % 2 !== 0 && groundCoinPlaced) return;
        const center = segment.left + width * 0.5;
        const candidates = [
          center,
          segment.left + width * 0.35,
          segment.left + width * 0.65,
        ].filter((x) => !isInSpikeZone(x));
        if (!candidates.length) return;
        if (tryPlaceCoin(candidates, stageTop, groundCoinOffset, false, true))
          groundCoinPlaced = true;
      });
    }
    if (totalCoins < minBaseCoins) {
      const extraOffsets = [0, -16, 16, -32, 32];
      spikeZones.forEach((zone) => {
        if (extraCoins >= extraCoinsMax) return;
        if (totalCoins >= minBaseCoins) return;
        const width = zone.right - zone.left;
        if (width < 16) return;
        const center = zone.left + width * 0.5;
        const candidates = extraOffsets
          .map((offset) => center + offset + COIN_X_OFFSET)
          .filter((x) => x >= zone.left + 8 && x <= zone.right - 8)
          .filter((x) => !isInGoalSafeZone(x));
        if (
          tryPlaceCoin(candidates, stageTop, hazardCoinOffset, true, false, {
            left: zone.left,
            right: zone.right,
            clearance: hazardClearance,
          })
        )
          return;
      });
      gapRanges.forEach((gap) => {
        if (extraCoins >= extraCoinsMax) return;
        if (totalCoins >= minBaseCoins) return;
        const width = gap.right - gap.left;
        if (width < 16) return;
        const center = gap.left + width * 0.5;
        const candidates = extraOffsets
          .map((offset) => center + offset + COIN_X_OFFSET)
          .filter((x) => x >= gap.left + 8 && x <= gap.right - 8)
          .filter((x) => !isInGoalSafeZone(x));
        if (
          tryPlaceCoin(candidates, stageTop, hazardCoinOffset, true, false, {
            left: gap.left,
            right: gap.right,
            clearance: hazardClearance,
          })
        )
          return;
      });
    }
    if (totalCoins < minCoinTarget) {
      const extraOffsets = [0, -16, 16, -32, 32];
      spikeZones.forEach((zone) => {
        if (extraCoins >= extraCoinsMax) return;
        if (totalCoins >= minCoinTarget) return;
        const width = zone.right - zone.left;
        if (width < 16) return;
        const center = zone.left + width * 0.5;
        const candidates = extraOffsets
          .map((offset) => center + offset + COIN_X_OFFSET)
          .filter((x) => x >= zone.left + 8 && x <= zone.right - 8)
          .filter((x) => !isInGoalSafeZone(x));
        if (
          tryPlaceCoin(candidates, stageTop, hazardCoinOffset, true, false, {
            left: zone.left,
            right: zone.right,
            clearance: hazardClearance,
          })
        )
          return;
      });
      gapRanges.forEach((gap) => {
        if (extraCoins >= extraCoinsMax) return;
        if (totalCoins >= minCoinTarget) return;
        const width = gap.right - gap.left;
        if (width < 16) return;
        const center = gap.left + width * 0.5;
        const candidates = extraOffsets
          .map((offset) => center + offset + COIN_X_OFFSET)
          .filter((x) => x >= gap.left + 8 && x <= gap.right - 8)
          .filter((x) => !isInGoalSafeZone(x));
        if (
          tryPlaceCoin(candidates, stageTop, hazardCoinOffset, true, false, {
            left: gap.left,
            right: gap.right,
            clearance: hazardClearance,
          })
        )
          return;
      });
    }
    const activeCoins = this.getRemainingActiveCoins();
    this.levelCoinTotal = activeCoins;
    this.levelCoinsCollected = 0;
    this.emitCoinProgress();
  }

  applyLayoutOverrides() {
    if (this.skipOverrides) {
      this.onLayoutReady();
      if (PRINT_LAYOUT_IDS) this.printLayoutIds();
      return;
    }
    if (!this.externalOverridesReady) {
      this.overrideApplyPending = true;
      if (!this.overrideApplyTimer && this.time) {
        this.overrideApplyTimer = this.time.delayedCall(32, () => {
          this.overrideApplyTimer = null;
          this.applyLayoutOverrides();
        });
      }
      return;
    }
    if (this.overrideApplied) {
      this.onLayoutReady();
      if (PRINT_LAYOUT_IDS) this.printLayoutIds();
      return;
    }
    this.overrideApplied = true;
    this.overrideApplyPending = false;
    const { seedKey, levelKey, levelAlias } = this.getOverrideKeys();
    const combined = this.getCombinedOverrides();
    const overrides =
      (seedKey && combined[seedKey]) ||
      (levelKey && combined[levelKey]) ||
      (levelAlias && combined[levelAlias]);
    const coins = this.coins?.getChildren?.() || [];
    const platforms = this.platformSurfaces || [];
    const spikeTiles = this.spikeTiles?.length
      ? this.spikeTiles
      : (this.hazards?.getChildren?.() || []).filter(
          (hazard) => hazard && !hazard._gapKill && hazard._sprite
        );
    const warnMissing = (type, id) =>
      console.warn(`Override ${type} id not found: ${id}`);
    const coinById = new Map();
    const platformById = new Map();
    const spikeById = new Map();

    coins.forEach((coin) => {
      if (coin?._overrideId) coinById.set(coin._overrideId, coin);
    });
    platforms.forEach((surface) => {
      if (surface?.overrideId) platformById.set(surface.overrideId, surface);
    });
    spikeTiles.forEach((spike) => {
      if (spike?._overrideId) spikeById.set(spike._overrideId, spike);
    });

    if (overrides?.coins?.length) {
      overrides.coins.forEach((entry) => {
        if (!entry) return;
        const id = entry.id;
        const target = id ? coinById.get(id) : null;
        const wantsAdd = entry.add === true;
        if (!target) {
          if (!wantsAdd && id) {
            warnMissing("coin", id);
            return;
          }
          const x = Number.isFinite(entry.x) ? entry.x : null;
          const y = Number.isFinite(entry.y) ? entry.y : null;
          if (x == null || y == null) return;
          const coin = this.physics.add
            .staticImage(x, y, "coin")
            .setDepth(40)
            .setVisible(true);
          const coinId = id || `c${this.coinIdCounter++}`;
          coin._overrideId = coinId;
          if (coin.body?.updateFromGameObject) coin.body.updateFromGameObject();
          this.coinLayer?.add?.(coin);
          this.coins.add(coin);
          coinById.set(coinId, coin);
          return;
        }
        if (entry.remove) {
          if (this.coins?.remove) this.coins.remove(target, true, true);
          else target.destroy?.();
          coinById.delete(id);
          return;
        }
        let nextX = target.x;
        let nextY = target.y;
        if (Number.isFinite(entry.x)) nextX = entry.x;
        if (Number.isFinite(entry.y)) nextY = entry.y;
        if (Number.isFinite(entry.dx)) nextX += entry.dx;
        if (Number.isFinite(entry.dy)) nextY += entry.dy;
        target.setPosition(nextX, nextY);
        if (target.body?.updateFromGameObject)
          target.body.updateFromGameObject();
      });
    }

    if (overrides?.platforms?.length) {
      overrides.platforms.forEach((entry) => {
        if (!entry) return;
        const id = entry.id;
        const target = id ? platformById.get(id) : null;
        const wantsAdd = entry.add === true;
        if (!target) {
          if (!wantsAdd && id) {
            warnMissing("platform", id);
            return;
          }
          const x = Number.isFinite(entry.x) ? entry.x : null;
          const y = Number.isFinite(entry.y) ? entry.y : null;
          if (x == null || y == null) return;
          const width = Number.isFinite(entry.width)
            ? entry.width
            : this.platformDisplaySize?.width || 140;
          const height = Number.isFinite(entry.height) ? entry.height : 16;
          this.createPlatformSurface({ x, y: y + height, width, height });
          const surface =
            this.platformSurfaces[this.platformSurfaces.length - 1];
          if (surface && id) {
            surface.overrideId = id;
            if (surface.collider) surface.collider._overrideId = id;
            platformById.set(id, surface);
          }
          return;
        }
        if (entry.remove) {
          if (target.collider && this.platforms?.remove)
            this.platforms.remove(target.collider, true, true);
          (target.visuals || []).forEach((sprite) => sprite?.destroy?.());
          target.visuals = [];
          platformById.delete(id);
          this.platformSurfaces = this.platformSurfaces.filter(
            (surface) => surface !== target
          );
          return;
        }
        let left = target.left ?? 0;
        let top = target.top ?? 0;
        let width = target.width ?? 0;
        let height = target.height ?? 0;
        if (Number.isFinite(entry.x)) left = entry.x;
        if (Number.isFinite(entry.y)) top = entry.y;
        if (Number.isFinite(entry.dx)) left += entry.dx;
        if (Number.isFinite(entry.dy)) top += entry.dy;
        if (Number.isFinite(entry.width)) width = entry.width;
        if (Number.isFinite(entry.height)) height = entry.height;
        target.left = Math.round(left);
        target.top = Math.round(top);
        target.width = Math.round(width);
        target.height = Math.round(height);
        target.right = target.left + target.width;
        if (target.collider?.setPosition)
          target.collider.setPosition(target.left, target.top);
        if (target.collider) {
          target.collider.width = target.width;
          target.collider.height = target.height;
        }
        if (target.collider?.body?.setSize)
          target.collider.body.setSize(target.width, target.height, true);
        if (target.collider?.body?.updateFromGameObject)
          target.collider.body.updateFromGameObject();
        this.positionPlatformVisuals(
          target,
          target.left,
          target.top,
          target.width,
          target.height
        );
        this.alignColliderToPlatformSprite(target);
      });
    }

    if (overrides?.spikes?.length) {
      overrides.spikes.forEach((entry) => {
        if (!entry) return;
        const id = entry.id;
        const target = id ? spikeById.get(id) : null;
        const wantsAdd = entry.add === true;
        if (!target) {
          if (!wantsAdd && id) {
            warnMissing("spike", id);
            return;
          }
          const x = Number.isFinite(entry.x) ? entry.x : null;
          const y = Number.isFinite(entry.y) ? entry.y : null;
          if (x == null || y == null) return;
          const spike = this.add.image(x, y, "spike");
          spike.setOrigin(0.5, 1);
          const hitbox = this.add.rectangle(x, y - 8, 16, 16, 0xd64545, 0.18);
          this.physics.add.existing(hitbox, true);
          const spikeId = id || `s${this.spikeIdCounter++}`;
          spike._overrideId = spikeId;
          hitbox._overrideId = spikeId;
          hitbox._sprite = spike;
          if (hitbox.body?.updateFromGameObject)
            hitbox.body.updateFromGameObject();
          this.hazards.add(hitbox);
          this.spikeTiles.push(hitbox);
          spikeById.set(spikeId, hitbox);
          return;
        }
        if (entry.remove) {
          if (target._sprite?.destroy) target._sprite.destroy();
          if (this.hazards?.remove) this.hazards.remove(target, true, true);
          else target.destroy?.();
          spikeById.delete(id);
          target._removed = true;
          return;
        }
        let nextX = target._sprite?.x ?? target.x;
        let nextY = target._sprite?.y ?? target.y + 8;
        if (Number.isFinite(entry.x)) nextX = entry.x;
        if (Number.isFinite(entry.y)) nextY = entry.y;
        if (Number.isFinite(entry.dx)) nextX += entry.dx;
        if (Number.isFinite(entry.dy)) nextY += entry.dy;
        if (target._sprite?.setPosition)
          target._sprite.setPosition(nextX, nextY);
        if (target.setPosition) target.setPosition(nextX, nextY - 8);
        if (target.body?.updateFromGameObject)
          target.body.updateFromGameObject();
      });
    }

    if (this.spikeTiles?.length) {
      this.spikeTiles = this.spikeTiles.filter(
        (spike) => spike && !spike._removed
      );
    }
    if (this.hazards?.refresh) this.hazards.refresh();
    if (this.coins?.refresh) this.coins.refresh();
    const activeCoins = this.getRemainingActiveCoins();
    this.levelCoinTotal = activeCoins;
    this.levelCoinsCollected = 0;
    this.emitCoinProgress();
    this.onLayoutReady();
    if (PRINT_LAYOUT_IDS) this.printLayoutIds();
  }

  printLayoutIds() {
    const platforms = this.platformSurfaces || [];
    const coins = this.coins?.getChildren?.() || [];
    const spikeTiles = this.spikeTiles?.length
      ? this.spikeTiles
      : (this.hazards?.getChildren?.() || []).filter(
          (hazard) => hazard && !hazard._gapKill && hazard._sprite
        );
    platforms.forEach((surface) => {
      if (!surface?.overrideId) return;
      console.log(
        `[layout] ${surface.overrideId} platform x=${Math.round(
          surface.left
        )} y=${Math.round(surface.top)} w=${Math.round(
          surface.width
        )} h=${Math.round(surface.height)}`
      );
    });
    coins.forEach((coin) => {
      if (!coin?._overrideId) return;
      console.log(
        `[layout] ${coin._overrideId} coin x=${Math.round(
          coin.x
        )} y=${Math.round(coin.y)}`
      );
    });
    spikeTiles.forEach((spike) => {
      if (!spike?._overrideId) return;
      const sprite = spike._sprite;
      const x = sprite?.x ?? spike.x;
      const y = sprite?.y ?? spike.y + 8;
      console.log(
        `[layout] ${spike._overrideId} spike x=${Math.round(x)} y=${Math.round(
          y
        )} w=16 h=16`
      );
    });
  }

  loadExternalOverrides() {
    if (this.externalOverridesReady || this.externalOverridesLoading) return;
    this.externalOverridesLoading = true;
    fetch("level-overrides.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        this.externalOverrides = data || {};
        this.externalOverridesReady = true;
        this.externalOverridesLoading = false;
        if (this.overrideApplyPending) this.applyLayoutOverrides();
      })
      .catch(() => {
        this.externalOverrides = {};
        this.externalOverridesReady = true;
        this.externalOverridesLoading = false;
        if (this.overrideApplyPending) this.applyLayoutOverrides();
      });
  }

  checkEditorAccessFromUrl() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("editor") === "1") this.editorRequested = true;
    const token = params.get("editorToken");
    if (token && token === EDITOR_ACCESS_TOKEN) {
      this.editorEnabled = true;
      this.editorToken = token;
    }
  }

  getOverrideKeys() {
    const seedKey =
      this.levelMeta?.seed != null ? `seed_${this.levelMeta.seed}` : null;
    const levelKey = this.levelId != null ? String(this.levelId) : null;
    const levelAlias = levelKey ? `level_${levelKey}` : null;
    return { seedKey, levelKey, levelAlias };
  }

  mergeOverrideEntries(baseList, extraList) {
    const byId = new Map();
    const additions = [];
    const pushEntry = (entry) => {
      if (!entry) return;
      if (entry.id) {
        byId.set(entry.id, { ...entry });
      } else {
        additions.push({ ...entry });
      }
    };
    (baseList || []).forEach(pushEntry);
    (extraList || []).forEach(pushEntry);
    return Array.from(byId.values()).concat(additions);
  }

  mergeOverrideLevel(base, extra) {
    if (!base && !extra) return null;
    return {
      coins: this.mergeOverrideEntries(base?.coins, extra?.coins),
      platforms: this.mergeOverrideEntries(base?.platforms, extra?.platforms),
      spikes: this.mergeOverrideEntries(base?.spikes, extra?.spikes),
    };
  }

  getCombinedOverrides() {
    const combined = {};
    const applySet = (set) => {
      if (!set) return;
      Object.keys(set).forEach((key) => {
        combined[key] = this.mergeOverrideLevel(combined[key], set[key]);
      });
    };
    applySet(LEVEL_OVERRIDES);
    applySet(this.externalOverrides);
    applySet(this.editorOverrides);
    return combined;
  }

  onLayoutReady() {
    if (this.layoutReady) return;
    this.layoutReady = true;
    if (this.editorEnabled) {
      this.enableEditorMode();
      return;
    }
    if (this.editorRequested) this.showEditorLoginButton();
  }

  showEditorLoginButton() {
    if (this.editorUi) return;
    this.ensureEditorUiCamera();
    const login = this.add
      .text(12, 12, "Editor Login", {
        fontSize: 14,
        color: "#E7F0FF",
        backgroundColor: "#1f2942",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0, 0)
      .setDepth(6000)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.registerEditorUiObject(login, "Login");
    login.on("pointerdown", () => this.requestEditorAccess());
    this.editorUi = login;
    this.applyEditorUiCameraFilters();
  }

  requestEditorAccess() {
    const token = window?.prompt?.("Enter editor token:");
    if (!token) return;
    if (token !== EDITOR_ACCESS_TOKEN) {
      console.warn("Editor token rejected.");
      return;
    }
    this.editorEnabled = true;
    this.editorToken = token;
    if (this.editorUi?.destroy) this.editorUi.destroy();
    this.editorUi = null;
    this.enableEditorMode();
  }

  enableEditorMode() {
    if (this.editorInputReady) return;
    this.setupEditorUi();
    this.setupEditorInteractions();
    this.bindEditorHotkeys();
    this.prepareEditorCameraForEditing();
    this.applyEditorFreezeState();
    this.input.mouse?.disableContextMenu?.();
    if (!this.editorHistory.length) this.pushEditorHistory();
    if (PRINT_LAYOUT_IDS) this.printLayoutIds();
  }

  setupEditorUi() {
    this.ensureEditorUiCamera();
    const panel = this.add.container(12, 12).setDepth(6000).setScrollFactor(0);
    const bg = this.add
      .rectangle(0, 0, 260, 250, 0x121a2e, 0.85)
      .setOrigin(0, 0);
    this.registerEditorUiObject(bg, "PanelBg");
    panel.add(bg);
    this.registerEditorUiObject(panel, "Panel");
    let rowY = 8;
    const rowPair = (labelA, cbA, labelB, cbB) => {
      const btnA = this.createEditorButton(8, rowY, labelA, cbA);
      const btnB = this.createEditorButton(128, rowY, labelB, cbB);
      panel.add([btnA, btnB]);
      rowY += 22;
      return { btnA, btnB };
    };
    const tools = rowPair(
      "Select",
      () => this.setEditorTool("select"),
      "Coin",
      () => this.setEditorTool("coin")
    );
    this.editorButtons.select = tools.btnA;
    this.editorButtons.coin = tools.btnB;
    const tools2 = rowPair(
      "Platform",
      () => this.setEditorTool("platform"),
      "Spike",
      () => this.setEditorTool("spike")
    );
    this.editorButtons.platform = tools2.btnA;
    this.editorButtons.spike = tools2.btnB;
    rowPair("Delete", () => this.deleteSelectedEditorObject(), "Undo", () =>
      this.undoEditorAction()
    );
    rowPair("Redo", () => this.redoEditorAction(), "Save", () =>
      this.saveEditorOverrides()
    );
    const snapRow = rowPair("Revert", () => this.revertToProcedural(), "Snap", () =>
      this.toggleEditorSnap()
    );
    this.editorButtons.snap = snapRow.btnB;
    const gridRow = rowPair("Grid", () => this.toggleEditorGrid(), "Import", () =>
      this.importEditorOverrides()
    );
    this.editorButtons.grid = gridRow.btnA;
    const freezeBtn = this.createEditorButton(8, rowY, "Freeze", () =>
      this.toggleEditorFreeze()
    );
    panel.add(freezeBtn);
    this.editorButtons.freeze = freezeBtn;
    rowY += 22;
    rowPair("W-", () => this.adjustSelectedPlatformSize(-16, 0), "W+", () =>
      this.adjustSelectedPlatformSize(16, 0)
    );
    rowPair("H-", () => this.adjustSelectedPlatformSize(0, -8), "H+", () =>
      this.adjustSelectedPlatformSize(0, 8)
    );
    rowPair("Spike-", () => this.adjustSelectedSpikeWidth(-1), "Spike+", () =>
      this.adjustSelectedSpikeWidth(1)
    );
    this.editorButtons.inspector = this.add.text(8, rowY + 4, "", {
      fontSize: 12,
      color: "#A0A8BD",
    });
    panel.add(this.editorButtons.inspector);
    this.registerEditorUiObject(this.editorButtons.inspector, "Inspector");
    this.editorUi = panel;
    this.setEditorTool("select");
    if (this.editorButtons.snap?.setText) {
      this.editorButtons.snap.setText(this.editorSnap ? "Snap ON" : "Snap OFF");
    }
    if (this.editorButtons.grid?.setText) {
      this.editorButtons.grid.setText(this.editorShowGrid ? "Grid ON" : "Grid OFF");
    }
    if (this.editorButtons.freeze?.setText) {
      this.editorButtons.freeze.setText(
        this.editorFreeze ? "Freeze ON" : "Freeze OFF"
      );
    }
    this.applyEditorUiCameraFilters();
    if (!this.editorDebugText) {
      this.editorDebugText = this.add
        .text(12, 270, "", {
          fontSize: 12,
          color: "#7ee2a8",
          backgroundColor: "#0e1426",
          padding: { x: 6, y: 4 },
        })
        .setOrigin(0, 0)
        .setDepth(6001)
        .setScrollFactor(0);
      this.registerEditorUiObject(this.editorDebugText, "Debug");
    }
    this.updateEditorInspector();
    this.updateEditorDebugOverlay(this.input?.activePointer);
    this.applyEditorUiCameraFilters();
  }

  createEditorButton(x, y, label, callback) {
    const btn = this.add
      .text(x, y, label, {
        fontSize: 12,
        color: "#E7F0FF",
        backgroundColor: "#1f2942",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.registerEditorUiObject(btn, label);
    btn.on("pointerdown", callback);
    return btn;
  }

  setEditorTool(tool) {
    this.editorTool = tool;
    const active = "#384a72";
    const idle = "#1f2942";
    if (tool !== "select") this.clearEditorSelection();
    Object.keys(this.editorButtons).forEach((key) => {
      const btn = this.editorButtons[key];
      if (!btn || !btn.setStyle) return;
      if (key === tool) {
        btn.setStyle({ backgroundColor: active });
      } else if (key !== "inspector" && key !== "snap" && key !== "grid") {
        btn.setStyle({ backgroundColor: idle });
      }
    });
  }

  setupEditorInteractions() {
    if (this.editorInputReady) return;
    this.editorInputReady = true;
    const registerCoins = () => {
      (this.coins?.getChildren?.() || []).forEach((coin) => {
        if (!coin?.setInteractive) return;
        coin._editorType = "coin";
        coin.setInteractive({ useHandCursor: true });
        this.input.setDraggable(coin);
      });
    };
    const registerPlatforms = () => {
      (this.platformSurfaces || []).forEach((surface) => {
        const sprite = surface?.visuals?.[0];
        if (!sprite?.setInteractive) return;
        sprite._editorType = "platform";
        sprite._editorSurface = surface;
        sprite.setInteractive({ useHandCursor: true });
        this.input.setDraggable(sprite);
        const hitbox = surface?.collider;
        if (hitbox?.setStrokeStyle) {
          hitbox.setStrokeStyle(1, 0x00ff55);
          hitbox.setFillStyle(0x00ff55, 0.12);
        }
        if (hitbox?.setDepth) hitbox.setDepth(5998);
        if (hitbox?.setInteractive) {
          hitbox._editorType = "platform";
          hitbox._editorSurface = surface;
          hitbox.setInteractive({ useHandCursor: true });
          this.input.setDraggable(hitbox);
        }
      });
    };
    const registerSpikes = () => {
      const spikes =
        this.spikeTiles?.length
          ? this.spikeTiles
          : (this.hazards?.getChildren?.() || []).filter(
              (hazard) => hazard && !hazard._gapKill && hazard._sprite
            );
      spikes.forEach((hitbox) => {
        const sprite = hitbox?._sprite;
        if (!sprite?.setInteractive) return;
        sprite._editorType = "spike";
        sprite._editorSpike = hitbox;
        sprite.setInteractive({ useHandCursor: true });
        this.input.setDraggable(sprite);
      });
    };
    registerCoins();
    registerPlatforms();
    registerSpikes();

    this.input.on("gameobjectdown", (pointer, gameObject) => {
      if (!this.editorEnabled) return;
      if (this.isPointerOverEditorUi(pointer)) return;
      if (
        this.editorPanning ||
        pointer.middleButtonDown?.() ||
        this.editorPanKey?.isDown ||
        pointer.rightButtonDown?.()
      )
        return;
      const type = gameObject?._editorType;
      if (!type) return;
      this.selectEditorObject(type, gameObject);
    });

    this.input.on("pointerdown", (pointer, currentlyOver) => {
      if (!this.editorEnabled) return;
      if (this.isPointerOverEditorUi(pointer)) return;
      if (pointer.rightButtonDown?.()) {
        const hitTarget = (currentlyOver || []).find(
          (obj) => obj?._editorSurface && obj?._editorType === "platform"
        );
        if (hitTarget) {
          this.startEditorHitboxDrag(pointer, hitTarget);
          return;
        }
      }
      if (
        pointer.middleButtonDown?.() ||
        (this.editorPanKey?.isDown && pointer.leftButtonDown?.())
      ) {
        this.startEditorPan(pointer);
        return;
      }
      if (currentlyOver?.length) return;
      if (!this.editorTool || this.editorTool === "select") {
        const hover = this.getEditorHoverInfo(pointer);
        if (hover?.object) {
          this.selectEditorObject(hover.type, hover.object);
          return;
        }
        this.clearEditorSelection();
        return;
      }
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;
      if (this.editorTool === "coin") this.addEditorCoinAt(worldX, worldY);
      if (this.editorTool === "platform")
        this.addEditorPlatformAt(worldX, worldY);
      if (this.editorTool === "spike") this.addEditorSpikeAt(worldX, worldY);
    });

    this.input.on("dragstart", (_pointer, gameObject) => {
      if (!this.editorEnabled || this.editorTool !== "select") return;
      if (this.editorPanning || this.editorHitboxDrag) return;
      const type = gameObject?._editorType;
      if (!type) return;
      if (type === "platform") {
        const surface = gameObject._editorSurface;
        if (!surface?.overrideId) return;
        this.editorDragStart = {
          type,
          id: surface.overrideId,
          left: surface.left,
          top: surface.top,
          width: surface.width,
          height: surface.height,
        };
        return;
      }
      const id = gameObject?._overrideId;
      if (!id) return;
      this.editorDragStart = { type, id, x: gameObject.x, y: gameObject.y };
    });

    this.input.on("drag", (_pointer, gameObject, dragX, dragY) => {
      if (!this.editorEnabled || this.editorTool !== "select") return;
      if (this.editorPanning || this.editorHitboxDrag) return;
      const type = gameObject?._editorType;
      if (!type) return;
      if (type === "coin") {
        let nextX = dragX;
        let nextY = dragY;
        if (this.editorSnap) {
          nextX = this.snapValue(nextX);
          nextY = this.snapValue(nextY);
        }
        gameObject.setPosition(nextX, nextY);
        if (gameObject.body?.updateFromGameObject)
          gameObject.body.updateFromGameObject();
        this.updateEditorOutline();
        return;
      }
      if (type === "spike") {
        let nextX = dragX;
        let nextY = dragY;
        if (this.editorSnap) {
          nextX = this.snapValue(nextX);
          nextY = this.snapValue(nextY);
        }
        const hitbox = gameObject._editorSpike;
        gameObject.setPosition(nextX, nextY);
        if (hitbox?.setPosition) hitbox.setPosition(nextX, nextY - 8);
        if (hitbox?.body?.updateFromGameObject)
          hitbox.body.updateFromGameObject();
        this.updateEditorOutline();
        return;
      }
      if (type === "platform") {
        const surface = gameObject._editorSurface;
        if (!surface) return;
        let nextLeft = dragX;
        let nextTop = dragY - PLATFORM_Y_OFFSET;
        if (this.editorSnap) {
          nextLeft = this.snapValue(nextLeft);
          nextTop = this.snapValue(nextTop);
        }
        this.updatePlatformSurface(
          surface,
          nextLeft,
          nextTop,
          surface.width,
          surface.height
        );
        this.updateEditorOutline();
      }
    });

    this.input.on("dragend", (_pointer, gameObject) => {
      if (!this.editorEnabled || this.editorTool !== "select") return;
      if (this.editorPanning || this.editorHitboxDrag) return;
      const type = gameObject?._editorType;
      if (!type || !this.editorDragStart) return;
      if (type === "platform") {
        const surface = gameObject._editorSurface;
        if (!surface?.overrideId) return;
        const changed =
          surface.left !== this.editorDragStart.left ||
          surface.top !== this.editorDragStart.top;
        if (changed) {
          this.recordEditorOverride("platforms", {
            id: surface.overrideId,
            x: surface.left,
            y: surface.top,
            width: surface.width,
            height: surface.height,
          });
          this.pushEditorHistory();
        }
        this.updateEditorInspector();
        this.editorDragStart = null;
        return;
      }
      const id = gameObject._overrideId;
      if (!id) return;
      const changed =
        gameObject.x !== this.editorDragStart.x ||
        gameObject.y !== this.editorDragStart.y;
      if (changed) {
        const entryType = type === "spike" ? "spikes" : "coins";
        this.recordEditorOverride(entryType, {
          id,
          x: gameObject.x,
          y: gameObject.y,
        });
        this.pushEditorHistory();
      }
      this.updateEditorInspector();
      this.editorDragStart = null;
    });

    this.input.on("pointermove", (pointer) => {
      if (!this.editorEnabled) return;
      this.updateEditorDebugOverlay(pointer);
      if (this.editorPanning) {
        this.updateEditorPanFromPointer(pointer);
        return;
      }
      if (this.editorHitboxDrag) this.updateEditorHitboxDrag(pointer);
    });

    this.input.on("pointerup", () => {
      if (!this.editorEnabled) return;
      if (this.editorPanning) this.stopEditorPan();
      if (this.editorHitboxDrag) this.finishEditorHitboxDrag();
    });
  }

  bindEditorHotkeys() {
    if (!this.input?.keyboard) return;
    if (!this.editorPanKey)
      this.editorPanKey = this.input.keyboard.addKey("SPACE");
    if (!this.editorPanKeys) {
      this.editorPanKeys = this.input.keyboard.addKeys({
        left: "LEFT",
        right: "RIGHT",
        up: "UP",
        down: "DOWN",
        w: "W",
        a: "A",
        s: "S",
        d: "D",
      });
    }
    this.input.keyboard.on("keydown-DELETE", () => {
      if (!this.editorEnabled) return;
      this.deleteSelectedEditorObject();
    });
    this.input.keyboard.on("keydown-BACKSPACE", () => {
      if (!this.editorEnabled) return;
      this.deleteSelectedEditorObject();
    });
    this.input.keyboard.on("keydown-Z", (event) => {
      if (!this.editorEnabled) return;
      if (event.ctrlKey) this.undoEditorAction();
    });
    this.input.keyboard.on("keydown-Y", (event) => {
      if (!this.editorEnabled) return;
      if (event.ctrlKey) this.redoEditorAction();
    });
    this.input.keyboard.on("keydown-F", () => {
      if (!this.editorEnabled) return;
      this.toggleEditorFreeze();
    });
  }

  ensureEditorUiCamera() {
    if (this.editorUiCamera) return;
    const width = this.scale?.width ?? this.cameras?.main?.width ?? 800;
    const height = this.scale?.height ?? this.cameras?.main?.height ?? 480;
    this.editorUiCamera = this.cameras.add(0, 0, width, height);
    this.editorUiCamera.setScroll(0, 0);
  }

  registerEditorUiObject(obj, label) {
    if (!obj) return;
    obj._editorUi = true;
    if (label) obj._editorUiLabel = label;
    if (obj.setScrollFactor) obj.setScrollFactor(0);
    if (!this.editorUiObjects.includes(obj)) this.editorUiObjects.push(obj);
  }

  applyEditorUiCameraFilters() {
    if (!this.editorUiCamera || !this.editorUiObjects?.length) return;
    const uiObjects = this.editorUiObjects.filter(Boolean);
    const worldObjects = (this.children?.list || []).filter(
      (obj) => obj && !obj._editorUi
    );
    if (worldObjects.length) this.editorUiCamera.ignore(worldObjects);
    this.cameras.main.ignore(uiObjects);
    if (this.splitCamera) this.splitCamera.ignore(uiObjects);
  }

  prepareEditorCameraForEditing() {
    const cam = this.cameras?.main;
    if (!cam) return;
    const width = this.scale?.width ?? cam.width ?? 800;
    const height = this.scale?.height ?? cam.height ?? 480;
    this.splitActive = false;
    cam.stopFollow();
    cam.setViewport(0, 0, width, height);
    cam.setDeadzone(0, 0);
    if (this.splitCamera) {
      this.splitCamera.stopFollow();
      this.splitCamera.setVisible(false);
    }
    this.dividerLine?.setVisible(false);
  }

  updateEditorCameraPan(delta) {
    if (!this.editorPanKeys) return;
    const cam = this.cameras?.main;
    if (!cam) return;
    const speed = 420;
    const step = (speed * delta) / 1000;
    let moveX = 0;
    let moveY = 0;
    if (this.editorPanKeys.left.isDown || this.editorPanKeys.a.isDown)
      moveX -= step;
    if (this.editorPanKeys.right.isDown || this.editorPanKeys.d.isDown)
      moveX += step;
    if (this.editorPanKeys.up.isDown || this.editorPanKeys.w.isDown)
      moveY -= step;
    if (this.editorPanKeys.down.isDown || this.editorPanKeys.s.isDown)
      moveY += step;
    if (moveX || moveY) {
      cam.scrollX += moveX;
      cam.scrollY += moveY;
      this.clampEditorCamera(cam);
    }
  }

  clampEditorCamera(cam) {
    const worldW = this.physics.world.bounds.width;
    const worldH = this.physics.world.bounds.height;
    const maxX = Math.max(0, worldW - cam.width);
    const maxY = Math.max(0, worldH - cam.height);
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, maxX);
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, maxY);
  }

  startEditorPan(pointer) {
    const cam = this.cameras?.main;
    if (!cam) return;
    this.editorPanning = true;
    this.editorPanStart = {
      x: pointer.x,
      y: pointer.y,
      scrollX: cam.scrollX,
      scrollY: cam.scrollY,
    };
  }

  updateEditorPanFromPointer(pointer) {
    const cam = this.cameras?.main;
    if (!cam || !this.editorPanStart) return;
    const dx = pointer.x - this.editorPanStart.x;
    const dy = pointer.y - this.editorPanStart.y;
    cam.scrollX = this.editorPanStart.scrollX - dx;
    cam.scrollY = this.editorPanStart.scrollY - dy;
    this.clampEditorCamera(cam);
  }

  stopEditorPan() {
    this.editorPanning = false;
    this.editorPanStart = null;
  }

  toggleEditorFreeze() {
    this.editorFreeze = !this.editorFreeze;
    if (this.editorButtons.freeze?.setText) {
      this.editorButtons.freeze.setText(
        this.editorFreeze ? "Freeze ON" : "Freeze OFF"
      );
    }
    this.applyEditorFreezeState();
  }

  applyEditorFreezeState() {
    const freeze = this.editorFreeze;
    (this.players || []).forEach((pState) => {
      const sprite = pState?.sprite;
      if (!sprite?.body) return;
      if (freeze) {
        sprite.body.setAllowGravity?.(false);
        sprite.setVelocity?.(0, 0);
        sprite.setAcceleration?.(0, 0);
      } else {
        sprite.body.setAllowGravity?.(true);
      }
    });
  }

  freezePlayersForEditor() {
    (this.players || []).forEach((pState) => {
      const sprite = pState?.sprite;
      if (!sprite?.body) return;
      sprite.setVelocity?.(0, 0);
      sprite.setAcceleration?.(0, 0);
      sprite.body.setAllowGravity?.(false);
    });
  }

  startEditorHitboxDrag(pointer, gameObject) {
    const surface = gameObject?._editorSurface;
    if (!surface) return;
    const left = surface.left ?? 0;
    const top = surface.top ?? 0;
    const width = surface.width ?? 0;
    const height = surface.height ?? 0;
    const right = left + width;
    const bottom = top + height;
    const margin = 6;
    const px = pointer.worldX;
    const py = pointer.worldY;
    let edge = {
      left: Math.abs(px - left) <= margin,
      right: Math.abs(px - right) <= margin,
      top: Math.abs(py - top) <= margin,
      bottom: Math.abs(py - bottom) <= margin,
    };
    if (edge.left && edge.right) edge.left = edge.right = false;
    if (edge.top && edge.bottom) edge.top = edge.bottom = false;
    const wantsMove = !!pointer.event?.altKey;
    const hasEdge = edge.left || edge.right || edge.top || edge.bottom;
    if (!hasEdge && !wantsMove) return;
    const mode = wantsMove ? "move" : "resize";
    if (wantsMove) {
      edge = { left: false, right: false, top: false, bottom: false };
    }
    this.editorHitboxDrag = {
      surface,
      mode,
      edge,
      startX: px,
      startY: py,
      startLeft: left,
      startTop: top,
      startWidth: width,
      startHeight: height,
    };
    this.selectEditorObject("platform", gameObject);
  }

  updateEditorHitboxDrag(pointer) {
    const drag = this.editorHitboxDrag;
    if (!drag) return;
    const dx = pointer.worldX - drag.startX;
    const dy = pointer.worldY - drag.startY;
    const minW = 16;
    const minH = 8;
    let left = drag.startLeft;
    let top = drag.startTop;
    let width = drag.startWidth;
    let height = drag.startHeight;
    const right = drag.startLeft + drag.startWidth;
    const bottom = drag.startTop + drag.startHeight;

    if (drag.mode === "move") {
      left = drag.startLeft + dx;
      top = drag.startTop + dy;
    } else {
      if (drag.edge.left) {
        left = drag.startLeft + dx;
        width = right - left;
      }
      if (drag.edge.right) {
        width = drag.startWidth + dx;
      }
      if (drag.edge.top) {
        top = drag.startTop + dy;
        height = bottom - top;
      }
      if (drag.edge.bottom) {
        height = drag.startHeight + dy;
      }
      if (width < minW) {
        width = minW;
        if (drag.edge.left) left = right - minW;
      }
      if (height < minH) {
        height = minH;
        if (drag.edge.top) top = bottom - minH;
      }
    }

    if (this.editorSnap) {
      left = this.snapValue(left);
      top = this.snapValue(top);
      if (drag.mode === "resize") {
        width = this.snapValue(width);
        height = this.snapValue(height);
        width = Math.max(minW, width);
        height = Math.max(minH, height);
      }
    }

    this.updatePlatformSurface(drag.surface, left, top, width, height);
    this.updateEditorOutline();
    this.updateEditorInspector();
  }

  finishEditorHitboxDrag() {
    const drag = this.editorHitboxDrag;
    if (!drag) return;
    const surface = drag.surface;
    const changed =
      surface.left !== drag.startLeft ||
      surface.top !== drag.startTop ||
      surface.width !== drag.startWidth ||
      surface.height !== drag.startHeight;
    if (changed && surface.overrideId) {
      this.recordEditorOverride("platforms", {
        id: surface.overrideId,
        x: surface.left,
        y: surface.top,
        width: surface.width,
        height: surface.height,
      });
      this.pushEditorHistory();
    }
    this.editorHitboxDrag = null;
    this.updateEditorInspector();
  }

  snapValue(value) {
    return Math.round(value / EDITOR_GRID_SIZE) * EDITOR_GRID_SIZE;
  }

  selectEditorObject(type, gameObject) {
    this.editorSelection = null;
    if (type === "platform") {
      const surface = gameObject._editorSurface;
      if (!surface) return;
      this.editorSelection = { type, surface, sprite: gameObject };
    } else if (type === "spike") {
      const hitbox = gameObject._editorSpike;
      this.editorSelection = { type, sprite: gameObject, hitbox };
    } else if (type === "coin") {
      this.editorSelection = { type, sprite: gameObject };
    }
    this.updateEditorOutline();
    this.updateEditorInspector();
  }

  clearEditorSelection() {
    this.editorSelection = null;
    if (this.editorOutline) this.editorOutline.setVisible(false);
    this.updateEditorInspector();
  }

  updateEditorOutline() {
    if (!this.editorSelection) return;
    if (!this.editorOutline) {
      this.editorOutline = this.add
        .rectangle(0, 0, 10, 10, 0x00ff99, 0)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0x00ff99)
        .setDepth(6001);
    }
    const selection = this.editorSelection;
    let bounds = null;
    if (selection.type === "platform") {
      bounds = {
        x: selection.surface.left,
        y: selection.surface.top,
        width: selection.surface.width,
        height: selection.surface.height,
      };
    } else if (selection.sprite?.getBounds) {
      bounds = selection.sprite.getBounds();
    }
    if (!bounds) return;
    this.editorOutline.setPosition(bounds.x, bounds.y);
    this.editorOutline.setSize(bounds.width, bounds.height);
    this.editorOutline.setVisible(true);
  }

  updateEditorInspector() {
    const label = this.editorButtons.inspector;
    if (!label?.setText) return;
    if (!this.editorSelection) {
      label.setText("");
      return;
    }
    const type = this.editorSelection.type;
    if (type === "platform") {
      const surface = this.editorSelection.surface;
      label.setText(
        `${surface.overrideId} platform w=${Math.round(
          surface.width
        )} h=${Math.round(surface.height)}`
      );
      return;
    }
    if (type === "spike") {
      const sprite = this.editorSelection.sprite;
      label.setText(
        `${sprite?._overrideId || "spike"} spike x=${Math.round(
          sprite.x
        )} y=${Math.round(sprite.y)}`
      );
      return;
    }
    if (type === "coin") {
      const sprite = this.editorSelection.sprite;
      label.setText(
        `${sprite?._overrideId || "coin"} coin x=${Math.round(
          sprite.x
        )} y=${Math.round(sprite.y)}`
      );
      return;
    }
    label.setText("");
  }

  updateEditorDebugOverlay(pointer) {
    if (!this.editorDebugText?.setText) return;
    const cam = this.cameras?.main;
    const worldX = pointer?.worldX ?? 0;
    const worldY = pointer?.worldY ?? 0;
    const scrollX = cam?.scrollX ?? 0;
    const scrollY = cam?.scrollY ?? 0;
    const uiHover = this.getEditorUiHoverLabel(pointer);
    this.editorUiHoverLabel = uiHover;
    const hover = this.getEditorHoverInfo(pointer);
    this.editorHoverId = hover?.id || null;
    this.editorHoverType = hover?.type || null;
    const hoverLabel = hover
      ? `${hover.id || "?"} ${hover.type}`
      : "none";
    this.editorDebugText.setText(
      `mouse ${Math.round(worldX)},${Math.round(worldY)} | cam ${Math.round(
        scrollX
      )},${Math.round(scrollY)} | hover ${hoverLabel} | ui ${
        uiHover || "none"
      }`
    );
  }

  getEditorUiHoverLabel(pointer) {
    if (!pointer || !this.editorUiObjects?.length) return null;
    const cam = this.editorUiCamera || this.cameras?.main;
    if (!cam?.getWorldPoint) return null;
    const point = cam.getWorldPoint(pointer.x, pointer.y);
    for (let i = this.editorUiObjects.length - 1; i >= 0; i--) {
      const obj = this.editorUiObjects[i];
      if (!obj?.visible) continue;
      const bounds = obj.getBounds?.();
      if (!bounds) continue;
      if (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      ) {
        return obj._editorUiLabel || "ui";
      }
    }
    return null;
  }

  isPointerOverEditorUi(pointer) {
    return !!this.getEditorUiHoverLabel(pointer);
  }

  getEditorHoverInfo(pointer) {
    const worldX = pointer?.worldX;
    const worldY = pointer?.worldY;
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
    const contains = (x, y, bounds) =>
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height;
    const coins = this.coins?.getChildren?.() || [];
    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      if (!coin?.getBounds) continue;
      const bounds = coin.getBounds();
      if (contains(worldX, worldY, bounds)) {
        return { type: "coin", id: coin._overrideId, object: coin };
      }
    }
    const spikes =
      this.spikeTiles?.length
        ? this.spikeTiles
        : (this.hazards?.getChildren?.() || []).filter(
            (hazard) => hazard && !hazard._gapKill && hazard._sprite
          );
    for (let i = spikes.length - 1; i >= 0; i--) {
      const hitbox = spikes[i];
      const sprite = hitbox?._sprite;
      const bounds = sprite?.getBounds?.();
      if (bounds && contains(worldX, worldY, bounds)) {
        return { type: "spike", id: hitbox._overrideId, object: sprite };
      }
      const hbBounds = hitbox?.getBounds?.();
      if (hbBounds && contains(worldX, worldY, hbBounds)) {
        return { type: "spike", id: hitbox._overrideId, object: sprite || hitbox };
      }
    }
    const platforms = this.platformSurfaces || [];
    for (let i = platforms.length - 1; i >= 0; i--) {
      const surface = platforms[i];
      if (!surface) continue;
      const bounds = {
        x: surface.left,
        y: surface.top,
        width: surface.width,
        height: surface.height,
      };
      if (contains(worldX, worldY, bounds)) {
        const target = surface.collider || surface.visuals?.[0];
        return { type: "platform", id: surface.overrideId, object: target };
      }
    }
    return null;
  }

  updatePlatformSurface(surface, left, top, width, height) {
    const nextLeft = Math.round(left);
    const nextTop = Math.round(top);
    const nextWidth = Math.max(16, Math.round(width));
    const nextHeight = Math.max(8, Math.round(height));
    surface.left = nextLeft;
    surface.top = nextTop;
    surface.width = nextWidth;
    surface.height = nextHeight;
    surface.right = nextLeft + nextWidth;
    if (surface.collider?.setPosition)
      surface.collider.setPosition(nextLeft, nextTop);
    if (surface.collider) {
      surface.collider.width = nextWidth;
      surface.collider.height = nextHeight;
    }
    if (surface.collider?.body?.setSize)
      surface.collider.body.setSize(nextWidth, nextHeight, true);
    if (surface.collider?.body?.updateFromGameObject)
      surface.collider.body.updateFromGameObject();
    this.positionPlatformVisuals(surface, nextLeft, nextTop, nextWidth, nextHeight);
    this.alignColliderToPlatformSprite(surface);
  }

  getEditorOverrideBucket() {
    const { seedKey, levelKey, levelAlias } = this.getOverrideKeys();
    const key = seedKey || levelKey || levelAlias;
    if (!key) return null;
    if (!this.editorOverrides[key]) {
      this.editorOverrides[key] = { coins: [], platforms: [], spikes: [] };
    }
    return this.editorOverrides[key];
  }

  recordEditorOverride(type, entry) {
    const bucket = this.getEditorOverrideBucket();
    if (!bucket) return;
    if (!bucket[type]) bucket[type] = [];
    const list = bucket[type];
    const idx = entry.id ? list.findIndex((item) => item?.id === entry.id) : -1;
    if (entry.remove) {
      const record = { id: entry.id, remove: true };
      if (idx >= 0) list[idx] = record;
      else list.push(record);
      return;
    }
    const record = { ...entry };
    if (idx >= 0) list[idx] = { ...list[idx], ...record };
    else list.push(record);
  }

  pushEditorHistory() {
    const snapshot = JSON.stringify(this.editorOverrides || {});
    const last = this.editorHistory[this.editorHistory.length - 1];
    if (snapshot === last) return;
    this.editorHistory.push(snapshot);
    if (this.editorHistory.length > EDITOR_HISTORY_LIMIT) {
      this.editorHistory.shift();
    }
    this.editorRedo = [];
  }

  undoEditorAction() {
    if (this.editorHistory.length <= 1) return;
    const current = this.editorHistory.pop();
    this.editorRedo.push(current);
    const prev = this.editorHistory[this.editorHistory.length - 1];
    this.editorOverrides = JSON.parse(prev);
    this.restartWithEditorOverrides(false);
  }

  redoEditorAction() {
    if (!this.editorRedo.length) return;
    const next = this.editorRedo.pop();
    this.editorHistory.push(next);
    this.editorOverrides = JSON.parse(next);
    this.restartWithEditorOverrides(false);
  }

  restartWithEditorOverrides(skipOverrides) {
    this.scene.start("LevelScene", {
      levelId: this.levelId,
      scoreCarry: this.score,
      playerCount: this.playerCount,
      editorOverrides: this.editorOverrides,
      editorEnabled: true,
      editorRequested: this.editorRequested,
      editorToken: this.editorToken,
      editorFreeze: this.editorFreeze,
      editorHistory: this.editorHistory,
      editorRedo: this.editorRedo,
      externalOverrides: this.externalOverrides,
      externalOverridesReady: this.externalOverridesReady,
      skipOverrides: skipOverrides === true,
    });
  }

  saveEditorOverrides() {
    const data = this.getCombinedOverrides();
    this.exportOverridesJson(data);
  }

  importEditorOverrides() {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result || "{}");
          this.externalOverrides = parsed || {};
          this.externalOverridesReady = true;
          this.externalOverridesLoading = false;
          this.editorOverrides = {};
          this.editorHistory = [];
          this.editorRedo = [];
          this.restartWithEditorOverrides(false);
        } catch (err) {
          console.warn("Failed to import overrides.", err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  exportOverridesJson(data) {
    if (typeof document === "undefined") return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "level-overrides.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  revertToProcedural() {
    this.editorOverrides = {};
    this.editorHistory = [];
    this.editorRedo = [];
    this.restartWithEditorOverrides(true);
  }

  addEditorCoinAt(x, y) {
    let nextX = x;
    let nextY = y;
    if (this.editorSnap) {
      nextX = this.snapValue(nextX);
      nextY = this.snapValue(nextY);
    }
    const coin = this.physics.add
      .staticImage(nextX, nextY, "coin")
      .setDepth(40)
      .setVisible(true);
    const coinId = `c${this.coinIdCounter++}`;
    coin._overrideId = coinId;
    coin._editorType = "coin";
    coin.setInteractive({ useHandCursor: true });
    this.input.setDraggable(coin);
    if (coin.body?.updateFromGameObject) coin.body.updateFromGameObject();
    this.coinLayer?.add?.(coin);
    this.coins.add(coin);
    this.recordEditorOverride("coins", { id: coinId, add: true, x: nextX, y: nextY });
    this.selectEditorObject("coin", coin);
    this.pushEditorHistory();
    this.applyEditorUiCameraFilters();
  }

  addEditorPlatformAt(x, y) {
    let nextX = x;
    let nextY = y;
    if (this.editorSnap) {
      nextX = this.snapValue(nextX);
      nextY = this.snapValue(nextY);
    }
    const width = this.platformDisplaySize?.width || 140;
    const height = 16;
    this.createPlatformSurface({ x: nextX, y: nextY + height, width, height });
    const surface = this.platformSurfaces[this.platformSurfaces.length - 1];
    if (!surface) return;
    const sprite = surface.visuals?.[0];
    if (sprite) {
      sprite._editorType = "platform";
      sprite._editorSurface = surface;
      sprite.setInteractive({ useHandCursor: true });
      this.input.setDraggable(sprite);
    }
    this.recordEditorOverride("platforms", {
      id: surface.overrideId,
      add: true,
      x: surface.left,
      y: surface.top,
      width: surface.width,
      height: surface.height,
    });
    if (sprite) this.selectEditorObject("platform", sprite);
    this.pushEditorHistory();
    this.applyEditorUiCameraFilters();
  }

  addEditorSpikeAt(x, y) {
    let nextX = x;
    let nextY = y;
    if (this.editorSnap) {
      nextX = this.snapValue(nextX);
      nextY = this.snapValue(nextY);
    }
    const spike = this.add.image(nextX, nextY, "spike");
    spike.setOrigin(0.5, 1);
    const hitbox = this.add.rectangle(nextX, nextY - 8, 16, 16, 0xd64545, 0.18);
    this.physics.add.existing(hitbox, true);
    const spikeId = `s${this.spikeIdCounter++}`;
    spike._overrideId = spikeId;
    hitbox._overrideId = spikeId;
    hitbox._sprite = spike;
    hitbox._editorSpike = hitbox;
    this.hazards.add(hitbox);
    this.spikeTiles.push(hitbox);
    spike._editorType = "spike";
    spike._editorSpike = hitbox;
    spike.setInteractive({ useHandCursor: true });
    this.input.setDraggable(spike);
    if (hitbox.body?.updateFromGameObject) hitbox.body.updateFromGameObject();
    this.recordEditorOverride("spikes", { id: spikeId, add: true, x: nextX, y: nextY });
    this.selectEditorObject("spike", spike);
    this.pushEditorHistory();
    this.applyEditorUiCameraFilters();
  }

  deleteSelectedEditorObject() {
    if (!this.editorSelection) return;
    if (this.editorSelection.type === "coin") {
      const coin = this.editorSelection.sprite;
      const id = coin?._overrideId;
      if (id) this.recordEditorOverride("coins", { id, remove: true });
      if (this.coins?.remove) this.coins.remove(coin, true, true);
      else coin?.destroy?.();
      this.clearEditorSelection();
      this.pushEditorHistory();
      return;
    }
    if (this.editorSelection.type === "platform") {
      const surface = this.editorSelection.surface;
      const id = surface?.overrideId;
      if (id) this.recordEditorOverride("platforms", { id, remove: true });
      if (surface?.collider && this.platforms?.remove)
        this.platforms.remove(surface.collider, true, true);
      (surface?.visuals || []).forEach((sprite) => sprite?.destroy?.());
      this.platformSurfaces = this.platformSurfaces.filter(
        (entry) => entry !== surface
      );
      this.clearEditorSelection();
      this.pushEditorHistory();
      return;
    }
    if (this.editorSelection.type === "spike") {
      const hitbox = this.editorSelection.hitbox;
      const sprite = this.editorSelection.sprite;
      const id = hitbox?._overrideId;
      if (id) this.recordEditorOverride("spikes", { id, remove: true });
      if (sprite?.destroy) sprite.destroy();
      if (this.hazards?.remove) this.hazards.remove(hitbox, true, true);
      this.spikeTiles = this.spikeTiles.filter((entry) => entry !== hitbox);
      this.clearEditorSelection();
      this.pushEditorHistory();
    }
  }

  adjustSelectedPlatformSize(deltaW, deltaH) {
    if (!this.editorSelection) return;
    if (this.editorSelection.type === "platform") {
      const surface = this.editorSelection.surface;
      const nextWidth = Math.max(16, (surface.width || 0) + deltaW);
      const nextHeight = Math.max(8, (surface.height || 0) + deltaH);
      this.updatePlatformSurface(
        surface,
        surface.left,
        surface.top,
        nextWidth,
        nextHeight
      );
      this.recordEditorOverride("platforms", {
        id: surface.overrideId,
        x: surface.left,
        y: surface.top,
        width: surface.width,
        height: surface.height,
      });
      this.updateEditorOutline();
      this.updateEditorInspector();
      this.pushEditorHistory();
      return;
    }
  }

  adjustSelectedSpikeWidth(deltaTiles) {
    if (!this.editorSelection || this.editorSelection.type !== "spike") return;
    const sprite = this.editorSelection.sprite;
    const hitbox = this.editorSelection.hitbox;
    if (!sprite || !hitbox) return;
    const baseX = sprite.x;
    const baseY = sprite.y;
    if (deltaTiles > 0) {
      const nextX = baseX + 16;
      const existing = this.spikeTiles.find(
        (entry) => entry?._sprite?.x === nextX && entry?._sprite?.y === baseY
      );
      if (existing) return;
      this.addEditorSpikeAt(nextX, baseY);
      return;
    }
    if (deltaTiles < 0) {
      const target = this.spikeTiles.find(
        (entry) => entry?._sprite?.x === baseX + 16 && entry?._sprite?.y === baseY
      );
      if (target) {
        const tempSelection = this.editorSelection;
        this.editorSelection = { type: "spike", sprite: target._sprite, hitbox: target };
        this.deleteSelectedEditorObject();
        this.editorSelection = tempSelection;
      }
    }
  }

  toggleEditorSnap() {
    this.editorSnap = !this.editorSnap;
    if (this.editorButtons.snap?.setText) {
      this.editorButtons.snap.setText(this.editorSnap ? "Snap ON" : "Snap OFF");
    }
  }

  toggleEditorGrid() {
    this.editorShowGrid = !this.editorShowGrid;
    if (this.editorButtons.grid?.setText) {
      this.editorButtons.grid.setText(this.editorShowGrid ? "Grid ON" : "Grid OFF");
    }
    this.drawEditorGrid();
  }

  drawEditorGrid() {
    if (this.editorGrid) {
      this.editorGrid.destroy();
      this.editorGrid = null;
    }
    if (!this.editorShowGrid) return;
    const worldW = this.physics.world.bounds.width;
    const worldH = this.physics.world.bounds.height;
    const graphics = this.add.graphics();
    graphics.setDepth(5999);
    graphics.lineStyle(1, 0x1f2a44, 0.35);
    for (let x = 0; x <= worldW; x += EDITOR_GRID_SIZE) {
      graphics.lineBetween(x, 0, x, worldH);
    }
    for (let y = 0; y <= worldH; y += EDITOR_GRID_SIZE) {
      graphics.lineBetween(0, y, worldW, y);
    }
    this.editorGrid = graphics;
  }

  coinOffsetsForWidth(width) {
    if (width < 48) return [width / 2];
    if (width < 112) return [width * 0.5];
    return [width * 0.35, width * 0.65];
  }

  applyLevelLayoutRules(objects = []) {
    let maxId = 0;
    let spawn = null;
    let goal = null;
    const stageGround = [];
    const platforms = [];
    const platformCandidates = [];
    const keptPlatforms = new Set();

    objects.forEach((obj) => {
      if (Number.isFinite(obj?.id)) maxId = Math.max(maxId, obj.id);
      if (obj.type === "spawn") spawn = obj;
      if (obj.type === "goal") goal = obj;
      if (obj.type !== "ground") return;
      if (this.isFloatingPlatform(obj)) {
        platformCandidates.push(obj);
      } else {
        stageGround.push(obj);
      }
    });

    const jumpSpeed = Math.abs(PHYSICS.PLAYER.JUMP_SPEED || 0);
    const gravityY = Math.max(1, PHYSICS.GRAVITY_Y || 1);
    const playerJumpReach = jumpSpeed
      ? Math.round((jumpSpeed * jumpSpeed) / (2 * gravityY))
      : 80;
    const maxPlatformRise = Math.max(48, playerJumpReach - 8);
    const stageTopAtX = (x) => {
      let best = null;
      stageGround.forEach((ground) => {
        const left = ground.x;
        const right = ground.x + (ground.width || 0);
        if (x >= left && x <= right) {
          const top = ground.y - (ground.height || 0);
          if (best == null || top > best) best = top;
        }
      });
      return best;
    };

    if (platformCandidates.length) {
      const sortedPlatforms = platformCandidates
        .slice()
        .sort((a, b) => a.x - b.x);
      let lastKept = null;
      const minPlatformGap = Math.round(
        (this.platformDisplaySize?.width || 140) * 1.4
      );
      sortedPlatforms.forEach((platform) => {
        const platformTop = platform.y - (platform.height || 0);
        const centerX = platform.x + (platform.width || 0) * 0.5;
        let safeTop = stageTopAtX(centerX);
        if (lastKept) {
          const lastTop = lastKept.y - (lastKept.height || 0);
          if (safeTop == null || lastTop < safeTop) safeTop = lastTop;
        }
        if (safeTop != null && safeTop - platformTop > maxPlatformRise) return;
        if (!lastKept) {
          platforms.push(platform);
          keptPlatforms.add(platform);
          lastKept = platform;
          return;
        }
        const lastRight = lastKept.x + (lastKept.width || 0);
        const gap = platform.x - lastRight;
        if (gap < minPlatformGap) return;
        platforms.push(platform);
        keptPlatforms.add(platform);
        lastKept = platform;
      });
    }

    let groundGaps = this.buildGroundGapRanges(
      stageGround,
      spawn,
      goal,
      platforms
    );
    const goalSafeLeft = goal
      ? Math.round((goal.x || 0) - GOAL_SAFE_BUFFER)
      : null;
    const goalSafeRight = goal
      ? Math.round((goal.x || 0) + (goal.width || 0) + GOAL_SAFE_BUFFER)
      : null;
    const overlapsGoalSafe = (left, right) =>
      goalSafeLeft != null && right > goalSafeLeft && left < goalSafeRight;
    if (goalSafeLeft != null) {
      groundGaps = groundGaps.filter(
        (gap) => !overlapsGoalSafe(gap.left, gap.right)
      );
    }
    let spikeZones = this.buildSpikeZones(platforms, groundGaps);
    if (goalSafeLeft != null) {
      spikeZones = spikeZones.filter(
        (zone) => !overlapsGoalSafe(zone.left, zone.right)
      );
    }
    this.goalSafeRange =
      goalSafeLeft != null
        ? { left: goalSafeLeft, right: goalSafeRight }
        : null;
    const followUpZones = [];
    const followUpWidth = Math.round((96 * SPIKE_ZONE_WIDTH_SCALE) / 16) * 16;
    const minFollowUpWidth = 48;
    const groundRuns = [];
    stageGround.forEach((segment) => {
      const split = this.splitGroundWithGaps(segment, groundGaps, 0);
      split.segments.forEach((seg) => {
        groundRuns.push({
          left: seg.x,
          right: seg.x + (seg.width || 0),
        });
      });
    });
    const findRunForX = (x) => {
      for (let i = 0; i < groundRuns.length; i++) {
        const run = groundRuns[i];
        if (x >= run.left && x < run.right) return { run, index: i };
      }
      return null;
    };
    const overlapsHazard = (left, right) =>
      groundGaps.some((gap) => right > gap.left && left < gap.right) ||
      spikeZones.some((zone) => right > zone.left && left < zone.right) ||
      followUpZones.some((zone) => right > zone.left && left < zone.right);
    const addFollowUpZone = (triggerX) => {
      const found = findRunForX(triggerX);
      if (!found) return;
      let zoneLeft = Math.ceil((triggerX + REACTION_DISTANCE) / 16) * 16;
      const runRight = found.run.right;
      if (zoneLeft < found.run.left + REACTION_DISTANCE) {
        zoneLeft = Math.ceil((found.run.left + REACTION_DISTANCE) / 16) * 16;
      }
      zoneLeft = Math.round((zoneLeft + SPIKE_ZONE_X_OFFSET) / 16) * 16;
      if (zoneLeft < found.run.left + REACTION_DISTANCE) {
        zoneLeft = Math.ceil((found.run.left + REACTION_DISTANCE) / 16) * 16;
      }
      let zoneRight = zoneLeft + followUpWidth;
      if (zoneRight > runRight) zoneRight = runRight;
      if (zoneRight - zoneLeft < minFollowUpWidth) return;
      if (overlapsGoalSafe(zoneLeft, zoneRight)) return;
      if (overlapsHazard(zoneLeft, zoneRight)) return;
      followUpZones.push({ left: zoneLeft, right: zoneRight, followUp: true });
    };
    groundGaps.forEach((gap) => addFollowUpZone(gap.right));
    platforms.forEach((platform) =>
      addFollowUpZone(platform.x + (platform.width || 0))
    );
    if (followUpZones.length) spikeZones = spikeZones.concat(followUpZones);
    this.groundGapRanges = groundGaps;
    this.spikeZones = spikeZones;
    this.groundSegments = [];

    const nextObjects = [];
    let nextId = maxId + 1;

    objects.forEach((obj) => {
      if (obj.type === "hazard") return;
      if (obj.type === "ground" && this.isFloatingPlatform(obj)) {
        if (keptPlatforms.size && !keptPlatforms.has(obj)) return;
      }
      if (obj.type === "ground" && !this.isFloatingPlatform(obj)) {
        const split = this.splitGroundWithGaps(obj, groundGaps, nextId);
        nextId = split.nextId;
        split.segments.forEach((segment) => {
          nextObjects.push(segment);
          this.groundSegments.push({
            left: segment.x,
            right: segment.x + (segment.width || 0),
            width: segment.width || 0,
            height: segment.height || 0,
            top: segment.y - (segment.height || 0),
          });
        });
        return;
      }
      nextObjects.push(obj);
    });

    spikeZones.forEach((zone) => {
      const width = zone.right - zone.left;
      if (width <= 0) return;
      nextObjects.push({
        id: nextId++,
        name: "jumpSpikes",
        type: "hazard",
        x: zone.left,
        y: 0,
        width,
        height: 16,
      });
    });
    groundGaps.forEach((gap) => {
      const width = gap.right - gap.left;
      if (width < 16) return;
      nextObjects.push({
        id: nextId++,
        name: "gapKill",
        type: "hazard",
        x: gap.left,
        y: 0,
        width,
        height: 16,
      });
    });

    this.safeGroundSegments = this.buildSafeGroundSegments(
      this.groundSegments,
      spikeZones
    );

    return nextObjects;
  }

  buildGroundGapRanges(segments, spawn, goal, platforms) {
    const gaps = [];
    if (!segments?.length) return gaps;
    const TILE = 16;
    const MIN_SEGMENT = 640;
    const EDGE_BUFFER = 96;
    const SAFE_BUFFER = 160;
    const PLATFORM_BUFFER = 0;
    const reactionDistance = REACTION_DISTANCE;
    const spawnX = spawn?.x ?? -99999;
    const goalX = goal?.x ?? 99999;
    const platformRanges = (platforms || []).map((platform) => ({
      left: platform.x,
      right: platform.x + (platform.width || 0),
    }));
    const sorted = segments.slice().sort((a, b) => a.x - b.x);
    const nearestPlatformRight = (x) => {
      let best = null;
      platformRanges.forEach((range) => {
        if (range.right > x) return;
        if (best == null || range.right > best) best = range.right;
      });
      return best;
    };

    sorted.forEach((segment, index) => {
      const left = segment.x;
      const right = segment.x + (segment.width || 0);
      const width = right - left;
      if (width < MIN_SEGMENT) return;
      const gapCount = Math.max(1, Math.floor(width / 800));
      const spacing = width / (gapCount + 1);

      for (let i = 1; i <= gapCount; i++) {
        const gapWidth = (i + index) % 2 === 0 ? 96 : 64;
        const center = left + spacing * i;
        let gapLeft = Math.round((center - gapWidth / 2) / TILE) * TILE;
        let gapRight = gapLeft + gapWidth;
        if (gapLeft < left + EDGE_BUFFER) continue;
        if (gapRight > right - EDGE_BUFFER) continue;
        let gapCenter = gapLeft + gapWidth / 2;
        const priorPlatformRight = nearestPlatformRight(gapLeft);
        if (
          priorPlatformRight != null &&
          gapLeft - priorPlatformRight < reactionDistance
        ) {
          gapLeft =
            Math.round((priorPlatformRight + reactionDistance) / TILE) * TILE;
          gapRight = gapLeft + gapWidth;
          if (gapLeft < left + EDGE_BUFFER) continue;
          if (gapRight > right - EDGE_BUFFER) continue;
          gapCenter = gapLeft + gapWidth / 2;
        }
        if (Math.abs(gapCenter - spawnX) < SAFE_BUFFER) continue;
        if (Math.abs(gapCenter - goalX) < SAFE_BUFFER) continue;
        if (PLATFORM_BUFFER > 0) {
          const gapLeftBuffered = gapLeft - PLATFORM_BUFFER;
          const gapRightBuffered = gapRight + PLATFORM_BUFFER;
          const nearPlatform = platformRanges.some(
            (range) =>
              gapRightBuffered > range.left && gapLeftBuffered < range.right
          );
          if (nearPlatform) continue;
        }
        gaps.push({ left: gapLeft, right: gapRight });
      }
    });

    return gaps;
  }

  buildSpikeZones(platforms, gapRanges) {
    const zones = [];
    if (!platforms?.length) return zones;
    const MIN_GAP = 16;
    const MAX_GAP = 240;
    const REACTION_BUFFER = REACTION_DISTANCE;
    const MIN_ZONE_WIDTH = 48;
    const gaps = (gapRanges || []).slice().sort((a, b) => a.left - b.left);
    const sorted = platforms.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const leftEdge = sorted[i].x + (sorted[i].width || 0);
      const rightEdge = sorted[i + 1].x;
      const gap = rightEdge - leftEdge;
      if (gap < MIN_GAP || gap > MAX_GAP) continue;
      const maxBuffer = Math.max(0, Math.floor((gap - 16) / 2));
      const buffer = Math.min(REACTION_BUFFER, maxBuffer);
      const corridorLeft = Math.ceil((leftEdge + buffer) / 16) * 16;
      const corridorRight = Math.floor((rightEdge - buffer) / 16) * 16;
      let zoneLeft = corridorLeft;
      let zoneRight = corridorRight;
      if (zoneRight - zoneLeft < MIN_ZONE_WIDTH) continue;
      if (gaps.length) {
        let nearestGapRight = null;
        gaps.forEach((gapRange) => {
          if (gapRange.right > zoneLeft) return;
          if (nearestGapRight == null || gapRange.right > nearestGapRight)
            nearestGapRight = gapRange.right;
        });
        if (
          nearestGapRight != null &&
          zoneLeft - nearestGapRight < REACTION_DISTANCE
        ) {
          zoneLeft = Math.ceil((nearestGapRight + REACTION_DISTANCE) / 16) * 16;
          if (zoneRight - zoneLeft < MIN_ZONE_WIDTH) continue;
        }
      }
      zoneLeft = Math.round((zoneLeft + SPIKE_ZONE_X_OFFSET) / 16) * 16;
      zoneRight = Math.round((zoneRight + SPIKE_ZONE_X_OFFSET) / 16) * 16;
      if (zoneLeft < corridorLeft) zoneLeft = corridorLeft;
      if (zoneRight > corridorRight) zoneRight = corridorRight;
      let zoneWidth = zoneRight - zoneLeft;
      zoneWidth = Math.round((zoneWidth * SPIKE_ZONE_WIDTH_SCALE) / 16) * 16;
      if (zoneWidth < MIN_ZONE_WIDTH) continue;
      if (zoneLeft + zoneWidth > corridorRight) {
        zoneWidth = corridorRight - zoneLeft;
      }
      zoneRight = zoneLeft + zoneWidth;
      if (zoneRight - zoneLeft < MIN_ZONE_WIDTH) continue;
      if (
        zones.length &&
        zoneLeft - zones[zones.length - 1].right < MAX_GAP / 2
      )
        continue;
      zones.push({ left: zoneLeft, right: zoneRight });
    }
    return zones;
  }

  buildSafeGroundSegments(segments, spikeZones) {
    const safeSegments = [];
    const zones = (spikeZones || []).slice().sort((a, b) => a.left - b.left);
    (segments || []).forEach((segment) => {
      const leftEdge = segment.left ?? segment.x ?? 0;
      const rightEdge =
        segment.right ?? (segment.x || 0) + (segment.width || 0);
      const top = segment.top ?? segment.y - (segment.height || 0);
      let cursor = leftEdge;
      zones.forEach((zone) => {
        if (zone.right <= leftEdge || zone.left >= rightEdge) return;
        const cutLeft = Math.max(leftEdge, zone.left);
        const cutRight = Math.min(rightEdge, zone.right);
        if (cutLeft > cursor) {
          const width = cutLeft - cursor;
          if (width >= 16) {
            safeSegments.push({
              left: cursor,
              right: cutLeft,
              width,
              top,
            });
          }
        }
        cursor = Math.max(cursor, cutRight);
      });
      if (cursor < rightEdge) {
        const width = rightEdge - cursor;
        if (width >= 16) {
          safeSegments.push({
            left: cursor,
            right: rightEdge,
            width,
            top,
          });
        }
      }
    });
    return safeSegments;
  }

  splitGroundWithGaps(ground, gaps, idSeed) {
    const segments = [];
    const leftEdge = ground.x;
    const rightEdge = ground.x + (ground.width || 0);
    const height = ground.height || 0;
    const relevant = (gaps || [])
      .filter((gap) => gap.right > leftEdge && gap.left < rightEdge)
      .sort((a, b) => a.left - b.left);
    let cursor = leftEdge;
    let nextId = idSeed;

    relevant.forEach((gap) => {
      const gapLeft = Math.max(leftEdge, gap.left);
      const gapRight = Math.min(rightEdge, gap.right);
      if (gapLeft > cursor) {
        const width = gapLeft - cursor;
        if (width >= 16) {
          segments.push({
            ...ground,
            id: nextId++,
            x: cursor,
            width,
            height,
          });
        }
      }
      cursor = Math.max(cursor, gapRight);
    });

    if (cursor < rightEdge) {
      const width = rightEdge - cursor;
      if (width >= 16) {
        segments.push({
          ...ground,
          id: nextId++,
          x: cursor,
          width,
          height,
        });
      }
    }

    return { segments, nextId };
  }

  findStageTopAtX(objects, x) {
    let best = null;
    for (const obj of objects) {
      if (obj.type !== "ground") continue;
      if (this.isFloatingPlatform(obj)) continue;
      const left = obj.x;
      const right = obj.x + (obj.width || 0);
      if (x >= left && x <= right) {
        const top = obj.y - (obj.height || 0);
        if (best == null || top > best) best = top;
      }
    }
    return best;
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
    const stageLeft = 0;
    const stageRight = worldW;
    const spikeZones = this.spikeZones || [];
    const safeGroundSegments = this.safeGroundSegments || [];
    const isInSpikeZone = (x) =>
      spikeZones.some((zone) => x >= zone.left + 8 && x <= zone.right - 8);
    const isOnSafeGround = (x) =>
      safeGroundSegments.some(
        (segment) => x >= segment.left && x <= segment.right
      );
    const seen = new Set();
    const kept = [];
    for (const h of hazards) {
      if (h._gapKill) continue;
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
      const snapX = stageLeft + 8 + idx * 16;
      const inSpikeZone = isInSpikeZone(snapX);
      if (!inSpikeZone) {
        if (h._sprite?.destroy) h._sprite.destroy();
        if (h.destroy) h.destroy();
        continue;
      }
      if (isOnSafeGround(snapX)) {
        if (h._sprite?.destroy) h._sprite.destroy();
        if (h.destroy) h.destroy();
        continue;
      }
      const stageTopRaw = this.findStageTopAtX(objects, snapX);
      if (stageTopRaw == null) {
        if (h._sprite?.destroy) h._sprite.destroy();
        if (h.destroy) h.destroy();
        continue;
      }
      const stageTop = Math.round(stageTopRaw);
      seen.add(idx);
      kept.push(h);
      // Place flush on stage top
      if (h.setPosition) h.setPosition(snapX, stageTop - 8);
      if (h.body?.updateFromGameObject) h.body.updateFromGameObject();
      if (h._sprite?.setPosition)
        h._sprite.setPosition(snapX, stageTop).setOrigin(0.5, 1);
    }
    this.spikeTiles = kept;
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
