let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBuffer(ac: AudioContext, duration: number): AudioBuffer {
  const samples = Math.ceil(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, samples, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Splash — white noise filtered down to simulate water impact
export function playMiss(): void {
  const ac = getCtx();
  const t = ac.currentTime;

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.9);

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(130, t + 0.9);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.28, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(t);
  src.stop(t + 0.9);
}

// Explosion — low noise burst + sub-bass punch
export function playHit(): void {
  const ac = getCtx();
  const t = ac.currentTime;

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.6);

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(450, t);
  filter.frequency.exponentialRampToValueAtTime(65, t + 0.5);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.6, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

  // Sub-bass thud
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.28);
  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.45, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  osc.connect(oscGain);
  oscGain.connect(ac.destination);

  src.start(t);
  src.stop(t + 0.6);
  osc.start(t);
  osc.stop(t + 0.3);
}

// Ship sunk — heavy double explosion with descending rumble
export function playSunk(): void {
  const ac = getCtx();
  const t = ac.currentTime;

  // First explosion
  const src1 = ac.createBufferSource();
  src1.buffer = noiseBuffer(ac, 1.4);
  const f1 = ac.createBiquadFilter();
  f1.type = 'lowpass';
  f1.frequency.setValueAtTime(650, t);
  f1.frequency.exponentialRampToValueAtTime(80, t + 1.2);
  const g1 = ac.createGain();
  g1.gain.setValueAtTime(0, t);
  g1.gain.linearRampToValueAtTime(0.75, t + 0.006);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

  // Descending rumble tone
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + 0.9);
  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.55, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

  // Second smaller explosion at 160ms
  const src2 = ac.createBufferSource();
  src2.buffer = noiseBuffer(ac, 0.55);
  const f2 = ac.createBiquadFilter();
  f2.type = 'lowpass';
  f2.frequency.setValueAtTime(350, t + 0.16);
  f2.frequency.exponentialRampToValueAtTime(70, t + 0.55);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0, t + 0.16);
  g2.gain.linearRampToValueAtTime(0.42, t + 0.165);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

  src1.connect(f1); f1.connect(g1); g1.connect(ac.destination);
  osc.connect(oscGain); oscGain.connect(ac.destination);
  src2.connect(f2); f2.connect(g2); g2.connect(ac.destination);

  src1.start(t); src1.stop(t + 1.4);
  osc.start(t); osc.stop(t + 0.9);
  src2.start(t + 0.16); src2.stop(t + 0.65);
}
