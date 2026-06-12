/** WebAudio 程序化合成音效：零素材、零加载 */

type Win = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

export function unlockAudio(): void {
  if (!ctx) {
    try {
      const AC = window.AudioContext ?? (window as Win).webkitAudioContext;
      if (AC) ctx = new AC();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  slideTo?: number;
  delay?: number;
}

function tone(freq: number, dur: number, opts: ToneOpts = {}): void {
  if (!ctx || ctx.state !== 'running') return;
  const { type = 'sine', vol = 0.12, slideTo, delay = 0 } = opts;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol: number, delay = 0): void {
  if (!ctx || ctx.state !== 'running') return;
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(1200, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

export const sfx = {
  click: (): void => tone(660, 0.06, { type: 'square', vol: 0.05 }),
  swap: (): void => tone(330, 0.08, { vol: 0.07, slideTo: 440 }),
  invalid: (): void => tone(180, 0.12, { type: 'square', vol: 0.06, slideTo: 140 }),
  pop: (combo = 1): void => {
    const f = 392 * Math.pow(1.122, Math.min(combo - 1, 9));
    tone(f, 0.13, { type: 'triangle', vol: 0.11 });
    tone(f * 1.5, 0.1, { vol: 0.05, delay: 0.025 });
  },
  laser: (): void => tone(1400, 0.2, { type: 'sawtooth', vol: 0.07, slideTo: 220 }),
  boom: (): void => {
    noise(0.28, 0.16);
    tone(95, 0.28, { vol: 0.18, slideTo: 45 });
  },
  sing: (): void => {
    tone(523, 0.45, { vol: 0.09, slideTo: 1046 });
    tone(659, 0.45, { vol: 0.07, delay: 0.06, slideTo: 1318 });
  },
  garbage: (): void => tone(150, 0.13, { type: 'square', vol: 0.09, slideTo: 95 }),
  lock: (): void => {
    tone(880, 0.06, { type: 'square', vol: 0.07 });
    tone(880, 0.06, { type: 'square', vol: 0.07, delay: 0.09 });
  },
  lockHit: (): void => tone(740, 0.05, { type: 'square', vol: 0.08 }),
  unlock: (): void => tone(523, 0.16, { vol: 0.1, slideTo: 784 }),
  hurt: (): void => {
    noise(0.13, 0.11);
    tone(220, 0.16, { type: 'sawtooth', vol: 0.09, slideTo: 110 });
  },
  charge: (): void => tone(440, 0.1, { vol: 0.05, slideTo: 660 }),
  ult: (): void => {
    tone(196, 0.55, { type: 'sawtooth', vol: 0.11, slideTo: 392 });
    noise(0.4, 0.09, 0.05);
  },
  shuffle: (): void => tone(520, 0.2, { type: 'triangle', vol: 0.07, slideTo: 260 }),
  glitch: (): void => {
    tone(840, 0.05, { type: 'square', vol: 0.07, slideTo: 620 });
    tone(430, 0.06, { type: 'square', vol: 0.07, delay: 0.06, slideTo: 980 });
  },
  win: (): void => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.24, { vol: 0.11, delay: i * 0.14 })),
  lose: (): void => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.32, { type: 'triangle', vol: 0.09, delay: i * 0.18 })),
};
