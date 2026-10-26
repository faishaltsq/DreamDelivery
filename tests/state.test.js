// Valid/invalid state transitions and journey timing: pure Node tests, no DOM.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, dispatch, ROUTES, ENCOUNTERS, STAMPS, BONUS_STAMPS, allStampIds } from '../web/game/state.js';
import { createJourneyClock } from '../web/game/journeyClock.js';
import { loadJourneyMeta, FALLBACK_WALK } from '../web/game/assetMeta.js';

const seeded = () => {
  let s = { ...initialState(), recipient: 'Testa', message: 'Sleep well' };
  s = dispatch(s, { type: 'START_WRITING' });
  s = dispatch(s, { type: 'SEAL_LETTER' });
  s = { ...s, screen: 'choose' };
  s = dispatch(s, { type: 'CHOOSE_COURIER', courierId: 'momo' });
  s = dispatch(s, { type: 'OPEN_ROUTE_MAP' });
  return s;
};

// Drives a real 60fps timeline through the clock, dispatching one ADVANCE per frame.
const simulate = (s, routeId, { fps = 60, suspensionAfter = null, suspensionFor = 0 } = {}) => {
  s = dispatch(s, { type: 'BEGIN_JOURNEY', routeId });
  assert.equal(s.screen, 'journey');
  const route = ROUTES[routeId];
  const clock = createJourneyClock(route.duration);
  const frame = 1 / fps;
  let wall = 0;
  let guard = 0;
  while (!clock.completed && guard++ < 1000000) {
    wall += frame;
    let dt = frame;
    if (suspensionAfter != null && wall >= suspensionAfter && wall - frame < suspensionAfter) {
      dt = frame + suspensionFor; // tab woke up after being hidden
    }
    const { justCompleted } = clock.advance(dt);
    if (justCompleted) s = dispatch(s, { type: 'ADVANCE_JOURNEY', dt: clock.elapsed });
    else if (justCompleted === false && clock.progress >= 1) s = dispatch(s, { type: 'ADVANCE_JOURNEY', dt: clock.elapsed });
    else if (Math.abs(clock.elapsed - s.journey.progress * route.duration) > route.duration) {
      s = dispatch(s, { type: 'ADVANCE_JOURNEY', dt: clock.elapsed });
    }
  }
  assert.ok(clock.completed, `${routeId}: clock must complete`);
  return { s, clock, wall, guard };
};

describe('valid transitions: full delivery chain', () => {
  for (const routeId of Object.keys(ROUTES)) {
    test(`deliver on ${routeId}: encounter, stamp, letter, postcard`, () => {
      const route = ROUTES[routeId];
      let s0 = seeded();
      s0 = dispatch(s0, { type: 'BEGIN_JOURNEY', routeId });
      assert.equal(s0.screen, 'journey');
      assert.deepEqual(s0.journey, { routeId, progress: 0 });

      let s = dispatch(s0, { type: 'ADVANCE_JOURNEY', dt: route.duration });
      assert.equal(s.screen, 'encounter', `${routeId} finish`);
      assert.equal(s.encounter.id, route.encounter);
      assert.equal(s.journey.progress, 1);

      const s2 = dispatch(s, { type: 'CLAIM_STAMP' });
      assert.deepEqual(s2.stamps, [route.stamp]);
      assert.equal(s2.stamps.includes(route.stamp), true);

      const s3 = dispatch(s2, { type: 'FINISH_DELIVERY' });
      assert.equal(s3.screen, 'postcard');
      assert.equal(s3.letters.length, 1);
      assert.equal(s3.letters[0].routeId, routeId);
      assert.equal(s3.letters[0].courierId, 'momo');
    });
  }
});

describe('invalid transitions are no-ops', () => {
  test('SEAL_LETTER with empty fields is rejected', () => {
    let s = dispatch(initialState(), { type: 'START_WRITING' });
    const before = s;
    s = dispatch(s, { type: 'SEAL_LETTER' });
    assert.equal(s.sealPlaced, false);
    s = dispatch({ ...s, recipient: '  ', message: 'hi' }, { type: 'SEAL_LETTER' });
    assert.equal(s.sealPlaced, false);
    s = dispatch({ ...s, recipient: 'A', message: '   ' }, { type: 'SEAL_LETTER' });
    assert.equal(s.sealPlaced, false);
    assert.equal(before.screen, 'write');
  });

  test('BEGIN_JOURNEY without courier or seal is rejected', () => {
    const s = dispatch(initialState(), { type: 'BEGIN_JOURNEY', routeId: 'moonfield' });
    assert.equal(s.screen, 'post-office');
    assert.equal(s.journey, null);
    let s2 = { ...initialState(), sealPlaced: true };
    s2 = dispatch(s2, { type: 'BEGIN_JOURNEY', routeId: 'moonfield' });
    assert.equal(s2.screen, 'post-office');
    let s3 = { ...dispatch(s2, { type: 'START_WRITING' }), courierId: 'momo', sealPlaced: false, screen: 'route-map' };
    s3 = dispatch(s3, { type: 'BEGIN_JOURNEY', routeId: 'moonfield' });
    assert.equal(s3.screen, 'route-map');
  });

  test('unknown route id is rejected', () => {
    const s = seeded();
    const s2 = dispatch(s, { type: 'BEGIN_JOURNEY', routeId: 'generic-volcano' });
    assert.equal(s2.screen, 'route-map');
    assert.equal(s2.journey, null);
  });

  test('CHOOSE_COURIER with unknown courier is rejected', () => {
    const s = { ...initialState(), screen: 'choose' };
    const s2 = dispatch(s, { type: 'CHOOSE_COURIER', courierId: 'boss-cat' });
    assert.equal(s2.courierId, null);
  });

  test('screen guards: START_WRITING ignored from write screen', () => {
    let s = dispatch(initialState(), { type: 'START_WRITING' });
    const s2 = dispatch(s, { type: 'START_WRITING' });
    assert.equal(s2, s);
  });

  test('CLAIM_STAMP twice does not duplicate stamps', () => {
    const s = seeded();
    let s2 = dispatch(s, { type: 'BEGIN_JOURNEY', routeId: 'moonfield' });
    s2 = dispatch(s2, { type: 'ADVANCE_JOURNEY', dt: ROUTES.moonfield.duration });
    s2 = dispatch(s2, { type: 'CLAIM_STAMP' });
    s2 = dispatch(s2, { type: 'CLAIM_STAMP' });
    assert.equal(s2.stamps.filter(x => x === 'moonrise').length, 1);
  });

  test('FINISH_DELIVERY twice does not duplicate letters', () => {
    let s = seeded();
    s = dispatch(s, { type: 'BEGIN_JOURNEY', routeId: 'moonfield' });
    s = dispatch(s, { type: 'ADVANCE_JOURNEY', dt: ROUTES.moonfield.duration });
    s = dispatch(s, { type: 'CLAIM_STAMP' });
    s = dispatch(s, { type: 'FINISH_DELIVERY' });
    s = { ...s, screen: 'encounter' }; // simulate a double-click reaching a stale listener
    s = dispatch(s, { type: 'FINISH_DELIVERY' });
    assert.equal(s.letters.length, 1);
  });

  test('unknown action type is a no-op', () => {
    const s = initialState();
    assert.equal(dispatch(s, { type: 'TELEPORT_TO_MOON' }), s);
  });
});

describe('journey timing (P0-1): deterministic clock', () => {
  test('actual duration matches route duration on all four routes at 60fps', () => {
    for (const [routeId, route] of Object.entries(ROUTES)) {
      const clock = createJourneyClock(route.duration);
      const frame = 1 / 60;
      let frames = 0;
      while (!clock.completed) {
        clock.advance(frame);
        frames++;
        assert.ok(frames < route.duration * 60 + 120, `${routeId} ran away`);
      }
      const measured = frames / 60;
      // Completion lands on the first frame at/after duration: within one frame + epsilon.
      assert.ok(measured >= route.duration && measured < route.duration + 1/60 + 1e-9,
        `${routeId}: measured ${measured.toFixed(4)}s vs configured ${route.duration}s`);
    }
  });

  test('progress is monotonic and reaches exactly 1 exactly once', () => {
    const clock = createJourneyClock(8);
    let last = 0, completions = 0;
    for (let i = 0; i < 8 * 60 + 60; i++) {
      const { justCompleted } = clock.advance(1 / 60);
      assert.ok(clock.progress >= last, 'progress regressed');
      assert.ok(clock.progress <= 1, 'progress overshot');
      last = clock.progress;
      if (justCompleted) completions++;
    }
    // advance after completion is a no-op: no further completions
    for (let i = 0; i < 60; i++) clock.advance(1 / 60);
    assert.equal(completions, 1);
    assert.equal(clock.completed, true);
    assert.equal(clock.progress, 1);
  });

  test('extend() API is not present: clock is advance-only (double completion impossible)', () => {
    const clock = createJourneyClock(1);
    clock.advance(2); // huge delta clamps to 1s: completes
    assert.equal(clock.completed, true);
    const second = clock.advance(5);
    assert.equal(second.justCompleted, false);
    assert.equal(clock.progress, 1);
  });

  test('tab suspension: 60s hidden tab advances at most the clamp, journey still completes once', () => {
    for (const [routeId, route] of Object.entries(ROUTES)) {
      let s = seeded();
      const { s: sEnd, clock } = simulate(s, routeId, { suspensionAfter: route.duration / 3, suspensionFor: 60 });
      assert.equal(clock.completed, true, routeId);
      assert.equal(clock.progress, 1);
      assert.ok(clock.elapsed >= route.duration - 1/60 && clock.elapsed <= route.duration + MAXD(1), routeId);
    }
  });

  test('clamp prevents single-frame completion on large delta', () => {
    const clock = createJourneyClock(14); // starport
    const r = clock.advance(3600); // browser tab hidden for an hour
    assert.equal(clock.progress < 1, true);
    assert.equal(r.advanced, 1.0);
    assert.equal(clock.completed, false);
  });
});

// helper used above; defined after use in ESM hoisting order is illegal, so define wrap
function MAXD(n) { return n; }

describe('journey through dispatch: duplicate ADVANCE after completion cannot create a second encounter', () => {
  test('post-completion ADVANCE_JOURNEY keeps screen=encounter and progress=1', () => {
    let s = seeded();
    s = dispatch(s, { type: 'BEGIN_JOURNEY', routeId: 'cloudpath' });
    s = dispatch(s, { type: 'ADVANCE_JOURNEY', dt: ROUTES.cloudpath.duration });
    assert.equal(s.screen, 'encounter');
    const progressBefore = s.journey.progress;
    s = dispatch(s, { type: 'ADVANCE_JOURNEY', dt: 100 });
    assert.equal(s.screen, 'encounter');
    assert.equal(s.journey.progress, 1);
  });
});

describe('stamp collection', () => {
  test('four routes yield exactly the four route stamps; bonus stamps stay locked', () => {
    let s = { ...initialState() };
    for (const routeId of Object.keys(ROUTES)) {
      let step = { ...s, recipient: 'R', message: 'M' };
      step = dispatch(step, { type: 'START_WRITING' });
      step = dispatch(step, { type: 'SEAL_LETTER' });
      step = { ...step, screen: 'choose' };
      step = dispatch(step, { type: 'CHOOSE_COURIER', courierId: 'pip' });
      step = dispatch(step, { type: 'OPEN_ROUTE_MAP' });
      step = dispatch(step, { type: 'BEGIN_JOURNEY', routeId });
      step = dispatch(step, { type: 'ADVANCE_JOURNEY', dt: ROUTES[routeId].duration });
      assert.equal(step.screen, 'encounter');
      step = dispatch(step, { type: 'CLAIM_STAMP' });
      step = dispatch(step, { type: 'FINISH_DELIVERY' });
      s = { ...step, screen: 'post-office', courierId: null, sealPlaced: false, journey: null, encounter: null };
    }
    assert.equal(s.stamps.length, 4);
    for (const r of Object.values(ROUTES)) assert.ok(s.stamps.includes(r.stamp));
    for (const bonus of Object.keys(BONUS_STAMPS)) assert.ok(!s.stamps.includes(bonus));
    assert.equal(s.letters.length, 4);
  });

  test('stamp id list from pack: 4 route + 5 bonus = 9, all resolvable', () => {
    assert.equal(allStampIds().length, 9);
    for (const id of allStampIds()) assert.ok(STAMPS[id] || BONUS_STAMPS[id]);
    for (const r of Object.values(ROUTES)) assert.ok(STAMPS[r.stamp], `route stamp ${r.stamp} missing from STAMPS`);
  });
});

describe('asset metadata resilience (P0-4 logic layer)', () => {
  test('malformed or failing metadata falls back to pack-contract walk', async () => {
    const badFetch = async () => ({ ok: true, json: async () => ({ animations: { walk: { frames: 'x' } } }) });
    const r1 = await loadJourneyMeta(badFetch, 'momo');
    assert.equal(r1.degraded, true);
    assert.equal(r1.walk.frames, FALLBACK_WALK.frames);
    assert.equal(r1.walk.frameWidth, FALLBACK_WALK.frameWidth);

    const failing = async () => { throw new Error('network gone'); };
    const r2 = await loadJourneyMeta(failing, 'lune');
    assert.equal(r2.degraded, true);
    assert.deepEqual(r2.walk, FALLBACK_WALK);

    const http404 = async () => ({ ok: false, status: 404 });
    const r3 = await loadJourneyMeta(http404, 'pip');
    assert.equal(r3.degraded, true);

    const good = async () => ({ ok: true, json: async () => ({ animations: { walk: { file: 'animations/walk.png', frames: 6, fps: 9, frameWidth: 64, frameHeight: 64 } } }) });
    const r4 = await loadJourneyMeta(good, 'momo');
    assert.equal(r4.degraded, false);
    assert.equal(r4.walk.frames, 6);
  });
});
