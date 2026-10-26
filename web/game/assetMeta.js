// Courier animation metadata loading with a documented fallback.
// Fallback values come from the pack contract (64x64 frames, 4-frame walk @7fps), not invented art.
export const FALLBACK_WALK = Object.freeze({
  file: 'animations/walk.png',
  frames: 4, fps: 7, frameWidth: 64, frameHeight: 64,
});

export async function loadJourneyMeta(fetchImpl, courierId) {
  try {
    const res = await fetchImpl(`/assets/couriers/${courierId}/animations.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const meta = await res.json();
    const walk = meta?.animations?.walk;
    if (!walk || !Number.isFinite(walk.frames) || !Number.isFinite(walk.frameWidth)) throw new Error('malformed meta');
    return { walk, degraded: false };
  } catch (err) {
    // Meta request failed: keep the journey playable with pack-contract defaults.
    return { walk: { ...FALLBACK_WALK }, degraded: true, error: String(err.message || err) };
  }
}
