import Phaser from 'phaser';
import { playBeep } from '../config.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    // Generate minimalistic textures at runtime to avoid external image assets.
    this.createGeneratedTextures();
  }

  create() {
    // Tiny "ready" beep to confirm audio path
    playBeep(this, 660, 60, 'triangle');
    this.scene.start('MainMenuScene');
  }

  createGeneratedTextures() {
    // Player: generate 5 separate frames as textures: player0..player4
    const w = 16, h = 20;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const drawPlayerFrame = (key, color, accent) => {
      g.clear();
      g.fillStyle(color, 1);
      g.fillRect(3, 4, 10, 14); // body
      g.fillStyle(accent, 1);
      g.fillRect(5, 6, 2, 2); // eye
      g.fillRect(9, 6, 2, 2); // eye
      g.fillRect(6, 14, 4, 2); // belt
      g.generateTexture(key, w, h);
    };

    // idle
    drawPlayerFrame('player0', 0x2ee6a6, 0x103c2f);
    // run 1..3
    drawPlayerFrame('player1', 0x2bd198, 0x0c3227);
    drawPlayerFrame('player2', 0x26bd8b, 0x0c3227);
    drawPlayerFrame('player3', 0x22a97e, 0x0c3227);
    // jump
    drawPlayerFrame('player4', 0x25c493, 0x0d382a);

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
}
