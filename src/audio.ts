/** Small synthesized sound palette. No network assets; unlocked only by a gesture. */
export class RaceAudio {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private active = new Set<AudioScheduledSourceNode>();
  private lastStep = 0;
  private lastBreath = 0;
  muted = false;

  async unlock() {
    if (this.muted) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.output = this.context.createGain();
        this.output.gain.value = .18;
        this.output.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { /* Audio is optional when a browser or device blocks it. */ }
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.output) this.output.gain.value = muted ? 0 : .18;
    if (muted) this.quiet();
    else void this.unlock();
  }
  private tone(frequency: number, duration: number, volume: number, delay = 0) {
    if (this.muted || !this.context || !this.output || this.context.state !== 'running') return;
    const ctx = this.context;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * .7), start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + .012);
    envelope.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(envelope); envelope.connect(this.output);
    this.active.add(oscillator);
    oscillator.onended = () => { this.active.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }
  private noise(duration: number, volume: number, frequency: number) {
    if (this.muted || !this.context || !this.output || this.context.state !== 'running') return;
    const ctx = this.context;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / channel.length);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = frequency; gain.gain.value = volume;
    source.connect(filter); filter.connect(gain); gain.connect(this.output);
    this.active.add(source);
    source.onended = () => { this.active.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start();
  }
  tick(speed: number, energy: number, now: number) {
    if (now - this.lastStep > (speed > 4 ? 260 : 340)) { this.tone(85, .045, .32); this.lastStep = now; }
    if (energy < 25 && now - this.lastBreath > 1700) { this.noise(.45, .14, 700); this.lastBreath = now; }
  }
  cue(kind: 'start' | 'aid' | 'split' | 'finish' | 'crowd') {
    if (kind === 'crowd') { this.noise(.9, .17, 1500); return; }
    const notes = kind === 'finish' ? [523, 659, 784, 1047] : kind === 'aid' ? [660, 880] : kind === 'start' ? [440, 660] : [523];
    notes.forEach((frequency, i) => this.tone(frequency, kind === 'finish' ? .5 : .16, .36, i * .14));
  }
  quiet() {
    for (const source of this.active) { try { source.stop(); } catch { /* Already ended. */ } }
    this.active.clear(); this.lastStep = 0; this.lastBreath = 0;
  }
  dispose() { this.quiet(); void this.context?.close(); this.context = null; this.output = null; }
}
