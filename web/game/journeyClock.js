// Journey timeline: pure, deterministic time accounting for the delivery ride.
// Accumulates clamped per-frame deltas against a route duration; completes exactly once.
export const MAX_FRAME_STEP = 1.0; // seconds of route time a single frame may advance

export function createJourneyClock(duration, { maxFrameStep = MAX_FRAME_STEP } = {}) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('duration must be positive seconds');
  let accumulated = 0;
  let completed = false;
  return {
    get elapsed() { return accumulated; },
    get progress() { return Math.min(1, accumulated / duration); },
    get completed() { return completed; },
    // Returns {advanced, justCompleted}. `dt` is per-frame wall time; clamped internally.
    advance(dt) {
      if (completed) return { advanced: 0, justCompleted: false };
      const step = Math.min(maxFrameStep, Math.max(0, Number(dt) || 0));
      accumulated += step;
      if (accumulated >= duration) {
        accumulated = duration;
        completed = true;
        return { advanced: step, justCompleted: true };
      }
      return { advanced: step, justCompleted: false };
    },
  };
}
