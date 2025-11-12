import Phaser from 'phaser';
import { GAME, PHYSICS } from './config.js';
import BootScene from './scences/BootScene.js';
import PreloadScene from './scences/PreloadScene.js';
import MainMenuScene from './scences/MainMenuScene.js';
import LevelScene from './scences/LevelScene.js';
import UIScene from './scences/UIScene.js';
import GameOverScene from './scences/GameOverScene.js';
import LevelTransitionScene from './scences/LevelTransitionScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: GAME.BACKGROUND_COLOR,
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: PHYSICS.GRAVITY_Y },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    zoom: 1
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    LevelScene,
    LevelTransitionScene,
    UIScene,
    GameOverScene
  ]
};

new Phaser.Game(config);
