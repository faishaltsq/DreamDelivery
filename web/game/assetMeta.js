export const FALLBACK_WALK = Object.freeze({ file: 'animations/walk.png', frames: 4, fps: 7, frameWidth: 64, frameHeight: 64 });

export function validWalk(walk) {
  return !!walk && typeof walk.file === 'string' && /^animations\/[a-z0-9-]+\.png$/i.test(walk.file)
    && Number.isInteger(walk.frames) && walk.frames > 0 && walk.frames <= 64
    && Number.isFinite(walk.fps) && walk.fps > 0 && walk.fps <= 60
    && Number.isInteger(walk.frameWidth) && walk.frameWidth > 0 && walk.frameWidth <= 1024
    && Number.isInteger(walk.frameHeight) && walk.frameHeight > 0 && walk.frameHeight <= 1024;
}

export async function loadJourneyMeta(fetchImpl, courierId, { timeout = 3000 } = {}) {
  const controller = new AbortController();
  let timer;
  try {
    const request = (async () => {
      const res = await fetchImpl(`/assets/couriers/${courierId}/animations.json`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const meta = await res.json();
      const walk = meta?.animations?.walk;
      if (!validWalk(walk)) throw new Error('Invalid animation frame metadata');
      return { walk, degraded: false };
    })();
    return await Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Animation metadata timed out')); }, timeout);
    })]);
  } catch (error) {
    return { walk: { ...FALLBACK_WALK }, degraded: true, error: String(error.message || error) };
  } finally { clearTimeout(timer); }
}
