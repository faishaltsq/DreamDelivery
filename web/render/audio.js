// Prototype SFX from assets/audio/prototype (synthetic-prototype-sfx placeholders).
// Off by default: user opts in via the sound toggle (also satisfies autoplay policy).
const FILES = {
  send: '/assets/audio/prototype/send.wav',
  arrival: '/assets/audio/prototype/arrival.wav',
  stamp: '/assets/audio/prototype/stamp.wav',
  sparkle: '/assets/audio/prototype/sparkle.wav',
  error: '/assets/audio/prototype/error.wav',
};

export class Sfx {
  constructor() {
    this.on = false;
    this.clips = Object.fromEntries(Object.entries(FILES).map(([k, src]) => {
      const a = new Audio(src);
      a.preload = 'none';
      return [k, a];
    }));
  }

  toggle() {
    this.on = !this.on;
    if (!this.on) Object.values(this.clips).forEach(a => a.pause());
    return this.on;
  }

  play(name) {
    if (!this.on || !this.clips[name]) return;
    // ponytail: restart-truncates long overlap; swap to a small pool if tones ever overlap musically
    const clip = this.clips[name];
    clip.currentTime = 0;
    clip.play().catch(() => {});
  }
}
