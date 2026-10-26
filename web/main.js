// Dream Delivery main. DOM events -> dispatch -> render. Game rules live in game/state.js.
import { initialState, dispatch, COURIERS, ROUTES } from './game/state.js';
import { loadJourneyMeta } from './game/assetMeta.js';
import { createJourneyClock } from './game/journeyClock.js';
import {
  renderScreens, renderPostOffice, renderWrite, renderChoose,
  renderJourney, renderEncounter, renderRouteMap, renderPostcard, renderAlbum,
} from './render/screens.js';
import { SpriteAnimator } from './render/sprites.js';
import { Sfx } from './render/audio.js';

const $ = (id) => document.getElementById(id);
const journeyMetaCache = {};

function loadSave() {
  try {
    const raw = localStorage.getItem('dream-delivery-save');
    if (!raw) return null;
    const save = JSON.parse(raw);
    // Malformed save recovery: keep only well-typed fields. Corrupt values are dropped, not trusted.
    const stamps = Array.isArray(save?.stamps) ? save.stamps.filter(s => typeof s === 'string' && s.length < 64) : [];
    const letters = Array.isArray(save?.letters) ? save.letters.filter(l =>
      l && typeof l.recipient === 'string' && typeof l.message === 'string'
      && typeof l.routeId === 'string' && ROUTES[l.routeId]
      && typeof l.courierId === 'string' && COURIERS[l.courierId]
      && Number.isFinite(l.at)
    ).map(l => ({ recipient: l.recipient, message: l.message, routeId: l.routeId, courierId: l.courierId, at: l.at })) : [];
    return { stamps, letters };
  } catch {
    // Unparseable JSON: recover to empty collection rather than crashing startup.
    return null;
  }
}

function persist(state) {
  try {
    localStorage.setItem('dream-delivery-save', JSON.stringify({
      stamps: state.stamps, letters: state.letters,
    }));
  } catch { /* private mode: play without persistence */ }
}

let state = { ...initialState(), ...(loadSave() ?? {}) };
let animator = null;
const sfx = new Sfx();

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setState(next) {
  state = next;
  persist(state);
  renderScreens(state);
  if (state.screen === 'post-office') renderPostOffice(state);
  if (state.screen === 'write') renderWrite(state);
  if (state.screen === 'choose') renderChoose(state);
  if (state.screen === 'route-map') renderRouteMap(state);
  if (state.screen === 'journey') { renderJourney(state); startJourney(); }
  if (state.screen === 'encounter') { renderEncounter(state); bindContinue(); sfx.play('sparkle'); }
  if (state.screen === 'postcard') renderPostcard(state);
  if (state.screen === 'album') renderAlbum(state);
  if (state.screen !== 'journey' && animator) { animator.destroy(); animator = null; journeyRunning = false; }
}

// Screen wiring, in flow order: post office, write, choose, route map, journey, encounter, postcard, album.

$('btn-start').addEventListener('click', () => { sfx.play('send'); setState(dispatch(state, { type: 'START_WRITING' })); });
$('btn-album').addEventListener('click', () => setState(dispatch(state, { type: 'OPEN_ALBUM' })));
$('btn-album-back').addEventListener('click', () => setState(dispatch(state, { type: 'BACK' })));

$('btn-audio').addEventListener('click', () => {
  const on = sfx.toggle();
  $('btn-audio').setAttribute('aria-pressed', String(on));
  $('btn-audio').querySelector('.toggle-label').textContent = on ? 'Sound on' : 'Sound off';
  if (on) sfx.play('sparkle');
});

$('write-form').addEventListener('submit', (e) => {
  e.preventDefault();
  state = dispatch(
    { ...state, recipient: $('recipient').value, message: $('message').value },
    { type: 'SEAL_LETTER' },
  );
  if (state.sealPlaced) {
    sfx.play('stamp');
    setState({ ...state, screen: 'choose' }); // synchronous: no timer race between screens
  } else {
    $('seal-hint').textContent = 'Both fields, dreamer. Even magic needs an address.';
  }
});

$('courier-grid').addEventListener('click', (e) => {
  const card = e.target.closest('[data-courier]');
  if (!card) return;
  focusCourier(card);
  setState(dispatch(state, { type: 'CHOOSE_COURIER', courierId: card.dataset.courier }));
});

// WAI-ARIA radio pattern: single tab stop, arrow keys move selection and focus.
$('courier-grid').addEventListener('keydown', (e) => {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const cards = [...document.querySelectorAll('[data-courier]')];
  const i = cards.indexOf(document.activeElement);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1
    : (i < 0 ? 0 : i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1));
  const card = cards[(next + cards.length) % cards.length];
  focusCourier(card);
  setState(dispatch(state, { type: 'CHOOSE_COURIER', courierId: card.dataset.courier }));
});

function focusCourier(card) {
  for (const c of document.querySelectorAll('[data-courier]')) c.tabIndex = c === card ? 0 : -1;
  card.focus();
}

$('btn-confirm-courier').addEventListener('click', () => setState(dispatch(state, { type: 'OPEN_ROUTE_MAP' })));

$('route-grid').addEventListener('click', (e) => {
  const card = e.target.closest('[data-route]');
  if (!card) return;
  setState(dispatch(state, { type: 'BEGIN_JOURNEY', routeId: card.dataset.route }));
});

let journeyRunning = false;
let journeyRaf = 0;

async function startJourney() {
  if (journeyRunning) return;
  journeyRunning = true;

  const route = ROUTES[state.journey.routeId];
  const courier = COURIERS[state.courierId ?? 'momo'];
  const stage = $('courier-stage');
  $('journey-title').textContent = `${route.label} Journey`;

  // P0-4: metadata or sprite failure must degrade, never lock. Stage shows a
  // labeled placeholder (no unrelated art substitution) until the sprite decodes.
  stage.replaceChildren();
  stage.classList.add('courier-loading');
  const loading = document.createElement('span');
  loading.className = 'courier-loading-label';
  loading.setAttribute('role', 'status');
  loading.textContent = `Waking ${courier.name}...`;
  stage.append(loading);

  const { walk, degraded, error } = await loadJourneyMeta(fetch, courier.id);
  if (degraded) console.warn(`animations.json for ${courier.id} failed (${error}); using pack-contract fallback`);
  if (state.screen !== 'journey') { journeyRunning = false; stage.classList.remove('courier-loading'); return; } // player backed out mid-fetch

  animator?.destroy?.();
  animator = new SpriteAnimator({
    src: `/assets/couriers/${courier.id}/${walk.file}`,
    frames: walk.frames, fps: walk.fps,
    frameWidth: walk.frameWidth, frameHeight: walk.frameHeight,
    onReady: () => stage.classList.remove('courier-loading'),
    onError: () => {
      // Sprite failed after meta succeeded: keep the timeline running with the
      // status label in place. The journey stays playable and completable.
      stage.classList.add('courier-loading');
      loading.textContent = `${courier.name} travels unseen`;
    },
  }).mount(stage);
  animator.el.setAttribute('aria-hidden', 'true');

  // Reduced motion keeps the full state timeline; only the visible animation
  // condenses, so stamps/letters/progress are identical to a full-speed run.
  const dur = reducedMotion() ? 0.8 : route.duration;
  stage.style.animationDuration = `${dur}s`;
  stage.style.animationPlayState = 'running';
  if (reducedMotion()) {
    document.getAnimations().forEach(a => { if (a.animationName === 'trot') a.finish(); });
  }

  const clock = createJourneyClock(route.duration);
  let last = performance.now();
  function tick(t) {
    if (state.screen !== 'journey' || !journeyRunning) { journeyRunning = false; return; } // stale frame guard
    const { justCompleted } = clock.advance((t - last) / 1000);
    last = t;
    renderJourney({ journey: { routeId: route.id, progress: clock.progress } });
    if (justCompleted) {
      // Single completion edge: advance to the encounter exactly once.
      setState(dispatch(state, { type: 'ADVANCE_JOURNEY', dt: route.duration }));
      journeyRunning = false;
      return;
    }
    journeyRaf = requestAnimationFrame(tick);
  }
  journeyRaf = requestAnimationFrame(tick);
}

let continueBound = false;
function bindContinue() {
  if (continueBound) return;
  continueBound = true;
  $('btn-continue').addEventListener('click', () => {
    continueBound = false;
    sfx.play('stamp');
    setState(dispatch(state, { type: 'CLAIM_STAMP' }));
    sfx.play('arrival');
    setState(dispatch(state, { type: 'FINISH_DELIVERY' }));
  });
}

addEventListener('pagehide', () => {
  cancelAnimationFrame(journeyRaf);
  journeyRunning = false;
});

$('btn-again').addEventListener('click', () => setState(dispatch(state, { type: 'RESET' })));

setState(state);
