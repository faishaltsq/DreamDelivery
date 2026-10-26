// Sprite atlas animator. Reads animations.json metadata {frames, fps, frameWidth, frameHeight}.
// Quality note: these atlases are placeholder-animation; driver stays frame-count agnostic so
// re-registered professional atlases drop in without code changes.
export class SpriteAnimator {
  constructor({ src, frames, fps = 6, frameWidth = 64, frameHeight = 64 }) {
    this.src = src; this.frames = frames; this.fps = fps;
    this.frameWidth = frameWidth; this.frameHeight = frameHeight;
    this.frame = 0; this.accumulator = 0; this.lastT = null; this.running = false;
    this.el = document.createElement('canvas');
    this.el.width = frameWidth; this.el.height = frameHeight;
    this.el.className = 'pixel-art';
    this.ctx = this.el.getContext('2d');
    this.image = new Image();
    this.image.src = src;
    this.image.decoding = 'async';
  }

  mount(container) {
    container.append(this.el);
    this.start();
    return this;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = null;
    requestAnimationFrame(this._tick);
  }

  stop() { this.running = false; }

  destroy() { this.stop(); this.el.remove(); }

  _tick = (t) => {
    if (!this.running) return;
    if (this.lastT == null) this.lastT = t;
    const dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (this.image.complete && this.image.naturalWidth > 0) {
      this.accumulator += dt;
      const frameDur = 1 / this.fps;
      while (this.accumulator >= frameDur) {
        this.accumulator -= frameDur;
        this.frame = (this.frame + 1) % this.frames;
      }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const drawFrame = reduced ? 0 : this.frame;
      this.ctx.clearRect(0, 0, this.frameWidth, this.frameHeight);
      this.ctx.drawImage(this.image,
        drawFrame * this.frameWidth, 0, this.frameWidth, this.frameHeight,
        0, 0, this.frameWidth, this.frameHeight);
    }
    requestAnimationFrame(this._tick);
  };
}
