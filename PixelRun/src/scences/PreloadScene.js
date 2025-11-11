import Phaser from 'phaser';
import { playBeep } from '../config.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    // Load external character assets and generate fallback textures for other items.
    // Level background image
    const bgUrl = new URL('../background/background.png', import.meta.url).href;
    this.load.image('level_bg', bgUrl);
    // Platform image for jumpable platforms
    const platUrl = new URL('../elements/plattform.png', import.meta.url).href;
    this.load.image('platform', platUrl);
    // Walkable stage image
    const stageUrl = new URL('../elements/stage.png', import.meta.url).href;
    this.load.image('stage', stageUrl);
    this.loadCharacterAssets();
    this.createGeneratedTextures();
  }

  create() {
    // Tiny "ready" beep to confirm audio path
    playBeep(this, 660, 60, 'triangle');
    // Prepare global animations using the loaded character assets
    this.createCharacterAnimations();
    this.scene.start('MainMenuScene');
  }

  createGeneratedTextures() {
    // Note: Player sprites now come from external assets.

    // Coin texture (simple circle)
    const cg = this.make.graphics({ x: 0, y: 0, add: false });
    cg.fillStyle(0xffd54a, 1);
    cg.fillCircle(8, 8, 7);
    cg.fillStyle(0xfff6a8, 1);
    cg.fillCircle(8, 8, 4);
    cg.generateTexture('coin', 16, 16);

    // Ground block
    const gg = this.make.graphics({ x: 0, y: 0, add: false });
    gg.fillStyle(0x2f915a, 1);
    gg.fillRect(0, 0, 32, 16);
    gg.lineStyle(2, 0x1e5e3b, 1);
    gg.strokeRect(0, 0, 32, 16);
    gg.generateTexture('ground', 32, 16);

    // Spike (hazard)
    const sg = this.make.graphics({ x: 0, y: 0, add: false });
    sg.fillStyle(0xd64545, 1);
    sg.beginPath();
    sg.moveTo(0, 16); sg.lineTo(8, 0); sg.lineTo(16, 16); sg.closePath();
    sg.fillPath();
    sg.generateTexture('spike', 16, 16);

    // Flag (goal)
    const fg = this.make.graphics({ x: 0, y: 0, add: false });
    fg.fillStyle(0xffffff, 1);
    fg.fillRect(6, 4, 2, 12);
    fg.fillStyle(0x7cceff, 1);
    fg.fillRect(8, 4, 8, 6);
    fg.generateTexture('flag', 16, 20);
  }

  loadCharacterAssets() {
    // Use ESM-friendly URLs; assets now live in src/character (unzipped folder)
    const base = (p) => new URL(`../character/${p}`, import.meta.url).href;
    // Rotations (8-way)
    this.load.image('char_rot_n', base('rotations/north.png'));
    this.load.image('char_rot_ne', base('rotations/north-east.png'));
    this.load.image('char_rot_e', base('rotations/east.png'));
    this.load.image('char_rot_se', base('rotations/south-east.png'));
    this.load.image('char_rot_s', base('rotations/south.png'));
    this.load.image('char_rot_sw', base('rotations/south-west.png'));
    this.load.image('char_rot_w', base('rotations/west.png'));
    this.load.image('char_rot_nw', base('rotations/north-west.png'));

    // Back-compat keys (still load simple placeholders)
    this.load.image('char_idle', base('rotations/east.png'));
    this.load.image('char_jump', base('rotations/north-east.png'));

    // Run frames (east/west)
    this.load.image('char_run_0', base('animations/running-4-frames/east/frame_000.png'));
    this.load.image('char_run_1', base('animations/running-4-frames/east/frame_001.png'));
    this.load.image('char_run_2', base('animations/running-4-frames/east/frame_002.png'));
    this.load.image('char_run_3', base('animations/running-4-frames/east/frame_003.png'));
    this.load.image('char_run_w_0', base('animations/running-4-frames/west/frame_000.png'));
    this.load.image('char_run_w_1', base('animations/running-4-frames/west/frame_001.png'));
    this.load.image('char_run_w_2', base('animations/running-4-frames/west/frame_002.png'));
    this.load.image('char_run_w_3', base('animations/running-4-frames/west/frame_003.png'));

    // Idle animation frames (east/west)
    for (let i = 0; i <= 8; i++) {
      const n = String(i).padStart(3, '0');
      this.load.image(`char_idle_e_${i}`, base(`animations/idle-jumping/east/frame_${n}.png`));
      this.load.image(`char_idle_w_${i}`, base(`animations/idle-jumping/west/frame_${n}.png`));
    }

    // Jump-in-place animation frames (reuse idle-jumping as jump)
    for (let i = 0; i <= 8; i++) {
      const n = String(i).padStart(3, '0');
      this.load.image(`char_jump_e_${i}`, base(`animations/idle-jumping/east/frame_${n}.png`));
      this.load.image(`char_jump_w_${i}`, base(`animations/idle-jumping/west/frame_${n}.png`));
    }

    // Running jump frames (east/west)
    for (let i = 0; i <= 7; i++) {
      const n = String(i).padStart(3, '0');
      this.load.image(`char_runjump_e_${i}`, base(`animations/running-jump/east/frame_${n}.png`));
      this.load.image(`char_runjump_w_${i}`, base(`animations/running-jump/west/frame_${n}.png`));
    }
  }

  createCharacterAnimations() {
    // Create or replace the standard animation keys used by LevelScene
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
    // Idle loop (east/west)
    if (!this.anims.exists('idle_east')) {
      this.anims.create({
        key: 'idle_east',
        frames: Array.from({ length: 9 }, (_, i) => ({ key: `char_idle_e_${i}` })),
        frameRate: 10,
        repeat: -1
      });
    }
    if (!this.anims.exists('idle_west')) {
      this.anims.create({
        key: 'idle_west',
        frames: Array.from({ length: 9 }, (_, i) => ({ key: `char_idle_w_${i}` })),
        frameRate: 10,
        repeat: -1
      });
    }
    // Jump in place (east/west) — loop while in air
    if (!this.anims.exists('jump_east')) {
      this.anims.create({
        key: 'jump_east',
        frames: Array.from({ length: 9 }, (_, i) => ({ key: `char_jump_e_${i}` })),
        frameRate: 12,
        repeat: -1
      });
    }
    if (!this.anims.exists('jump_west')) {
      this.anims.create({
        key: 'jump_west',
        frames: Array.from({ length: 9 }, (_, i) => ({ key: `char_jump_w_${i}` })),
        frameRate: 12,
        repeat: -1
      });
    }
    // Running jump (east/west)
    if (!this.anims.exists('run_jump_east')) {
      this.anims.create({
        key: 'run_jump_east',
        frames: Array.from({ length: 8 }, (_, i) => ({ key: `char_runjump_e_${i}` })),
        frameRate: 14,
        repeat: -1
      });
    }
    if (!this.anims.exists('run_jump_west')) {
      this.anims.create({
        key: 'run_jump_west',
        frames: Array.from({ length: 8 }, (_, i) => ({ key: `char_runjump_w_${i}` })),
        frameRate: 14,
        repeat: -1
      });
    }
    // Back-compat single-frame keys
    if (!this.anims.exists('idle')) this.anims.create({ key: 'idle', frames: [{ key: 'char_idle' }], frameRate: 1 });
    if (!this.anims.exists('jump')) this.anims.create({ key: 'jump', frames: [{ key: 'char_jump' }], frameRate: 1 });
  }
}
