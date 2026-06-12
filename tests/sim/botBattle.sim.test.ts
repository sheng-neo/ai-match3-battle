import { describe, expect, it } from 'vitest';
import { BattleController, type Side } from '../../src/battle/battleController';
import { CHARACTERS, charById } from '../../src/battle/characters';
import { BotPlayer } from '../../src/bot/botPlayer';
import { BATTLE, DIFFICULTIES, type DifficultyDef } from '../../src/config';

interface SimResult {
  winner: Side | 'draw';
  byTimeout: boolean;
  elapsed: number;
  dmg1: number;
  dmg2: number;
  combo1: number;
  combo2: number;
  ults: number;
}

function diffById(id: 'easy' | 'normal' | 'hard'): DifficultyDef {
  return DIFFICULTIES.find((d) => d.id === id)!;
}

/** 无头快进一整局：100ms 步长驱动控制器与双 bot */
function simulate(seed: number, d1: DifficultyDef, d2: DifficultyDef, char1 = 0, char2 = 1): SimResult {
  const ctrl = new BattleController({
    p1: { char: CHARACTERS[char1], seed: seed * 7 + 1 },
    p2: { char: CHARACTERS[char2], seed: seed * 7 + 2 },
    rngSeed: seed * 7 + 3,
  });
  const bot1 = new BotPlayer(ctrl, 'p1', d1, seed * 7 + 4);
  const bot2 = new BotPlayer(ctrl, 'p2', d2, seed * 7 + 5);

  let guard = 0;
  let result: SimResult | null = null;
  ctrl.on('gameOver', ({ winner, byTimeout }) => {
    result = {
      winner,
      byTimeout,
      elapsed: ctrl.elapsed,
      dmg1: ctrl.state('p1').stats.damageDealt,
      dmg2: ctrl.state('p2').stats.damageDealt,
      combo1: ctrl.state('p1').stats.maxCombo,
      combo2: ctrl.state('p2').stats.maxCombo,
      ults: ctrl.state('p1').stats.ultsCast + ctrl.state('p2').stats.ultsCast,
    };
  });
  ctrl.on('damage', ({ hp }) => {
    expect(hp).toBeGreaterThanOrEqual(0);
    expect(hp).toBeLessThanOrEqual(BATTLE.maxHp);
  });

  while (!ctrl.over && guard++ < 3000) {
    ctrl.update(100);
    bot1.update(100);
    bot2.update(100);
  }
  expect(result).toBeTruthy();
  return result!;
}

describe('bot vs bot 对局模拟', () => {
  it('NORMAL vs NORMAL ×60：必然终局、数值在界、胜负大致均衡', () => {
    const N = 60;
    let p1Wins = 0;
    let timeouts = 0;
    let totalElapsed = 0;
    let totalUlts = 0;
    let maxComboSeen = 0;
    for (let i = 0; i < N; i++) {
      const r = simulate(1000 + i, diffById('normal'), diffById('normal'), i % 3, (i + 1) % 3);
      expect(r.elapsed).toBeLessThanOrEqual(BATTLE.durationMs + 200);
      if (r.winner === 'p1') p1Wins++;
      if (r.byTimeout) timeouts++;
      totalElapsed += r.elapsed;
      totalUlts += r.ults;
      maxComboSeen = Math.max(maxComboSeen, r.combo1, r.combo2);
    }
    // eslint 风格的报表输出，供调平参考
    console.log(
      `[sim] NORMAL: p1胜率=${((p1Wins / N) * 100).toFixed(0)}% 超时局=${timeouts}/${N} ` +
        `平均局长=${(totalElapsed / N / 1000).toFixed(1)}s 平均大招=${(totalUlts / N).toFixed(1)} 最大combo=${maxComboSeen}`,
    );
    // 镜像对局胜率应大致均衡（角色轮换，放宽区间）
    expect(p1Wins / N).toBeGreaterThan(0.25);
    expect(p1Wins / N).toBeLessThan(0.75);
    // 至少打出过级联
    expect(maxComboSeen).toBeGreaterThanOrEqual(2);
  });

  it('EASY vs HARD ×30：HARD 显著占优', () => {
    const N = 30;
    let hardWins = 0;
    for (let i = 0; i < N; i++) {
      const r = simulate(5000 + i, diffById('easy'), diffById('hard'), i % 3, (i + 1) % 3);
      if (r.winner === 'p2') hardWins++;
    }
    console.log(`[sim] EASY vs HARD: HARD 胜率=${((hardWins / N) * 100).toFixed(0)}%`);
    expect(hardWins / N).toBeGreaterThan(0.65);
  });

  it('同种子完全可复现', () => {
    const a = simulate(424242, diffById('normal'), diffById('hard'));
    const b = simulate(424242, diffById('normal'), diffById('hard'));
    expect(a).toEqual(b);
  });

  it('技能全覆盖：三角色互打均能正常结算', () => {
    for (let c1 = 0; c1 < 3; c1++) {
      for (let c2 = 0; c2 < 3; c2++) {
        const r = simulate(9000 + c1 * 3 + c2, diffById('hard'), diffById('hard'), c1, c2);
        expect(['p1', 'p2', 'draw']).toContain(r.winner);
      }
    }
    expect(charById('omni').ult).toBe('overfit_storm');
  });
});
