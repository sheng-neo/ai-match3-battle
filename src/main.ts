import Phaser from 'phaser';
import { BG_COLOR, GAME_H, GAME_W } from './config';
import { unlockAudio } from './game/audio/sfx';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { CharacterSelectScene } from './game/scenes/CharacterSelectScene';
import { BattleScene } from './game/scenes/BattleScene';
import { ResultScene } from './game/scenes/ResultScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: BG_COLOR,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, CharacterSelectScene, BattleScene, ResultScene],
});

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game = game;
}

// 首次手势解锁 WebAudio（iOS 必需）
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });
