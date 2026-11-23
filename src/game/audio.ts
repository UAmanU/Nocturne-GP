function makeSoftClipCurve(amount = 18): Float32Array<ArrayBuffer> {
  const n = 512;
  const buf = new ArrayBuffer(n * 4);
  const curve = new Float32Array(buf);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Multi-harmonic sports engine nodes
  private oscFund: OscillatorNode | null = null; // combustion fundamental
  private oscHarm2: OscillatorNode | null = null; // 1.5x fifth harmonic growl
  private oscHarm3: OscillatorNode | null = null; // 2.0x upper overtone
  private subGain: GainNode | null = null;
  private harm2Gain: GainNode | null = null;
  private harm3Gain: GainNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Intake roar + nitro jet + tire screech + pursuit siren
  private intakeFilter: BiquadFilterNode | null = null;
  private intakeGain: GainNode | null = null;
  private nitroFilter: BiquadFilterNode | null = null;
  private nitroGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;
  private driftGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  private prevGear = 1;
  private shiftDip = 0;
  private muted = false;
  private initialized = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.34,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  public ensureStarted(): void {
    if (typeof window === 'undefined') return;
    if (!this.initialized) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.34;
        this.masterGain.connect(this.ctx.destination);

        // Soft-saturation waveshaper + resonant engine lowpass
        this.shaper = this.ctx.createWaveShaper();
        this.shaper.curve = makeSoftClipCurve(16);
        this.shaper.oversample = '2x';

        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 340;
        this.engineFilter.Q.value = 2.1;

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;

        this.subGain = this.ctx.createGain();
        this.subGain.gain.value = 0.52;
        this.harm2Gain = this.ctx.createGain();
        this.harm2Gain.gain.value = 0.28;
        this.harm3Gain = this.ctx.createGain();
        this.harm3Gain.gain.value = 0.22;

        this.oscFund = this.ctx.createOscillator();
        this.oscFund.type = 'triangle';
        this.oscFund.frequency.value = 46;

        this.oscHarm2 = this.ctx.createOscillator();
        this.oscHarm2.type = 'sawtooth';
        this.oscHarm2.frequency.value = 69;

        this.oscHarm3 = this.ctx.createOscillator();
        this.oscHarm3.type = 'sawtooth';
        this.oscHarm3.frequency.value = 92;

        this.oscFund.connect(this.subGain);
        this.oscHarm2.connect(this.harm2Gain);
        this.oscHarm3.connect(this.harm3Gain);

        this.subGain.connect(this.shaper);
        this.harm2Gain.connect(this.shaper);
        this.harm3Gain.connect(this.shaper);

        this.shaper.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.oscFund.start();
        this.oscHarm2.start();
        this.oscHarm3.start();

        // Shared looping white-noise buffer for intake roar, nitro wind/jet, and tire screech
        const bufferSize = Math.floor(this.ctx.sampleRate * 1.5);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        // Air-intake mechanical roar
        this.intakeFilter = this.ctx.createBiquadFilter();
        this.intakeFilter.type = 'bandpass';
        this.intakeFilter.frequency.value = 260;
        this.intakeFilter.Q.value = 1.4;
        this.intakeGain = this.ctx.createGain();
        this.intakeGain.gain.value = 0;
        noise.connect(this.intakeFilter);
        this.intakeFilter.connect(this.intakeGain);
        this.intakeGain.connect(this.masterGain);

        // Nitro boost turbine whoosh
        this.nitroFilter = this.ctx.createBiquadFilter();
        this.nitroFilter.type = 'bandpass';
        this.nitroFilter.frequency.value = 720;
        this.nitroFilter.Q.value = 1.6;
        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.value = 0;
        noise.connect(this.nitroFilter);
        this.nitroFilter.connect(this.nitroGain);
        this.nitroGain.connect(this.masterGain);

        // Drift tire screech layer
        this.driftFilter = this.ctx.createBiquadFilter();
        this.driftFilter.type = 'bandpass';
        this.driftFilter.frequency.value = 1480;
        this.driftFilter.Q.value = 4.6;
        this.driftGain = this.ctx.createGain();
        this.driftGain.gain.value = 0;
        noise.connect(this.driftFilter);
        this.driftFilter.connect(this.driftGain);
        this.driftGain.connect(this.masterGain);

        // Pursuit police hi-lo siren oscillator (inaudible unless active in Pursuit)
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 620;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.masterGain);
        this.sirenOsc.start();

        noise.start();
        this.initialized = true;
      } catch {
        // AudioContext blocked or unsupported
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public updateEngine(
    speedRatio: number,
    isNitro: boolean,
    isDrifting: boolean,
    active: boolean
  ): void {
    if (
      !this.initialized ||
      !this.ctx ||
      !this.oscFund ||
      !this.oscHarm2 ||
      !this.oscHarm3 ||
      !this.engineGain ||
      !this.engineFilter ||
      !this.intakeFilter ||
      !this.intakeGain ||
      !this.nitroGain ||
      !this.nitroFilter ||
      !this.driftGain ||
      !this.driftFilter
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.intakeGain.gain.setTargetAtTime(0, now, 0.08);
      this.nitroGain.gain.setTargetAtTime(0, now, 0.06);
      this.driftGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    // Realistic 6-speed gearbox RPM sawtooth with shift dip
    const norm = Math.max(0, Math.min(2.35, speedRatio));
    const gearFloat = Math.min(5.99, norm * 2.55);
    const gear = Math.floor(gearFloat) + 1;
    const gearFrac = gearFloat - Math.floor(gearFloat);
    if (gear !== this.prevGear) {
      if (gear > this.prevGear) {
        this.shiftDip = 1.0;
      }
      this.prevGear = gear;
    }
    this.shiftDip *= 0.86;

    const rpmNorm = Math.min(1.08, 0.24 + gearFrac * 0.72 + (isNitro ? 0.14 : 0));
    const fundFreq = (38 + rpmNorm * 82 + norm * 14) * (1 - this.shiftDip * 0.11);

    this.oscFund.frequency.setTargetAtTime(fundFreq, now, 0.035);
    this.oscHarm2.frequency.setTargetAtTime(fundFreq * 1.5, now, 0.035);
    this.oscHarm3.frequency.setTargetAtTime(fundFreq * 2.02, now, 0.035);

    this.engineFilter.frequency.setTargetAtTime(
      260 + rpmNorm * 720 + (isNitro ? 420 : 0),
      now,
      0.045
    );
    this.engineGain.gain.setTargetAtTime(
      (0.14 + rpmNorm * 0.12) * (1 - this.shiftDip * 0.22),
      now,
      0.05
    );

    this.intakeFilter.frequency.setTargetAtTime(220 + rpmNorm * 380, now, 0.05);
    this.intakeGain.gain.setTargetAtTime(0.03 + rpmNorm * 0.055, now, 0.06);

    this.nitroGain.gain.setTargetAtTime(isNitro ? 0.22 : 0, now, 0.06);
    this.nitroFilter.frequency.setTargetAtTime(isNitro ? 1280 : 540, now, 0.08);

    // Drift tire screech when sliding at speed
    const screechLevel = isDrifting && norm > 0.25 ? Math.min(0.16, 0.08 + norm * 0.05) : 0;
    this.driftGain.gain.setTargetAtTime(screechLevel, now, 0.04);
    this.driftFilter.frequency.setTargetAtTime(1320 + rpmNorm * 420, now, 0.05);
  }

  public updatePursuitSiren(active: boolean, proximity: number, elapsed: number): void {
    if (!this.initialized || !this.ctx || !this.sirenOsc || !this.sirenGain) return;
    const now = this.ctx.currentTime;
    if (!active || this.muted || proximity <= 0.02) {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }
    const clampedProx = Math.min(1, Math.max(0, proximity));
    const hiTone = Math.floor(elapsed * 2.4) % 2 === 0;
    this.sirenOsc.frequency.setTargetAtTime(hiTone ? 740 : 560, now, 0.03);
    this.sirenGain.gain.setTargetAtTime(0.018 + clampedProx * 0.045, now, 0.08);
  }

  public playOrbPickup(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 880, 1174.66];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.001, now + i * 0.045);
      gain.gain.linearRampToValueAtTime(0.22, now + i * 0.045 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.24);
    });
  }

  public playCollision(strength: number): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    gain.gain.setValueAtTime(Math.min(0.35, 0.12 + strength * 0.28), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playCountdownBeep(isGo: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isGo ? 0.28 : 0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.36 : 0.18));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.38 : 0.2));

    if (isGo) {
      const harmony = this.ctx.createOscillator();
      const hGain = this.ctx.createGain();
      harmony.type = 'sine';
      harmony.frequency.setValueAtTime(1318.5, now);
      hGain.gain.setValueAtTime(0.001, now);
      hGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      harmony.connect(hGain);
      hGain.connect(this.masterGain);
      harmony.start(now);
      harmony.stop(now + 0.38);
    }
  }

  public playLapOrFinish(isWin: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const chord = isWin
      ? [523.25, 659.25, 783.99, 1046.5]
      : [293.66, 261.63, 220.0, 174.61];
    chord.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isWin ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * (isWin ? 0.07 : 0.11));
      gain.gain.setValueAtTime(0.001, now + i * (isWin ? 0.07 : 0.11));
      gain.gain.linearRampToValueAtTime(isWin ? 0.2 : 0.14, now + i * (isWin ? 0.07 : 0.11) + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * (isWin ? 0.07 : 0.11) + 0.55);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * (isWin ? 0.07 : 0.11));
      osc.stop(now + i * (isWin ? 0.07 : 0.11) + 0.58);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.initialized = false;
  }
}
