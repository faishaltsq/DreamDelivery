export class SpriteAnimator {
  constructor({ src, frames, fps = 6, frameWidth = 64, frameHeight = 64, anchor = { x: 0.5, y: 0.85 }, onReady, onError }) {
    Object.assign(this, { frames, fps, frameWidth, frameHeight, anchor, onReady, onError });
    this.el = document.createElement('canvas');
    this.el.width = frameWidth;
    this.el.height = frameHeight;
    this.el.className = 'pixel-art';
    this.ctx = this.el.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.image = new Image();
    this.frame = 0;
    this.elapsed = 0;
    this.running = false;
    this.destroyed = false;
    this.loaded = false;
    this.failed = false;
    this.timer = setTimeout(() => this.fail(), 5000);
    this.image.onload = () => {
      if (this.destroyed || this.failed) return;
      if (this.image.naturalWidth !== frames * frameWidth || this.image.naturalHeight !== frameHeight) return this.fail();
      clearTimeout(this.timer);
      this.loaded = true;
      this.draw();
      this.onReady?.();
    };
    this.image.onerror = () => this.fail();
    this.image.decoding = 'async';
    try {
      this.image.src = src;
    } catch {
      // A malformed URL must surface as a visible art failure, not an exception that skips onError.
      queueMicrotask(() => this.fail());
    }
  }
  fail() {
    if (this.destroyed || this.failed) return;
    clearTimeout(this.timer);
    this.failed = true;
    this.stop();
    this.onError?.();
  }
  mount(container, { maxScale = 3 } = {}) {
    container.append(this.el);
    const scale = Math.max(1, Math.min(maxScale, Math.floor(container.closest('.scene').clientWidth / 450) + 1));
    this.scale = scale;
    this.el.style.width = `${this.frameWidth * scale}px`;
    this.el.style.height = `${this.frameHeight * scale}px`;
    container.style.marginLeft = `${-Math.round(this.frameWidth * scale * this.anchor.x)}px`;
    container.style.marginTop = `${-Math.round(this.frameHeight * scale * this.anchor.y)}px`;
    this.start();
    return this;
  }
  draw() {
    if (!this.loaded || this.destroyed) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = reduced ? 0 : this.frame;
    this.ctx.clearRect(0, 0, this.frameWidth, this.frameHeight);
    this.ctx.drawImage(this.image, frame * this.frameWidth, 0, this.frameWidth, this.frameHeight, 0, 0, this.frameWidth, this.frameHeight);
  }
  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.last = null;
    const tick = now => {
      if (!this.running) return;
      if (this.last !== null) this.elapsed += Math.min(0.5, (now - this.last) / 1000);
      this.last = now;
      this.frame = Math.floor(this.elapsed * this.fps) % this.frames;
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() {
    this.destroyed = true;
    this.stop();
    clearTimeout(this.timer);
    this.image.onload = this.image.onerror = null;
    this.el.remove();
  }
}
