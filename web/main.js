// Dream Delivery main. DOM events -> dispatch -> render. Game rules live in game/state.js.
import { initialState, dispatch, COURIERS, ROUTES } from './game/state.js';
import {
  renderScreens, renderPostOffice, renderWrite, renderChoose,
  renderJourney, renderEncounter, renderRouteMap, renderPostcard, renderAlbum,
} from './render/screens.js';
import { SpriteAnimator } from './render/sprites.js';
import { Sfx } from './render/audio.js';

const $ = (id) => document.getElementById(id);
const journeyMetaCache = {};

async function journeyMeta(courierId) {
  if (!journeyMetaCache[courierId]) {
    journeyMetaCache[courierId] = await (await fetch(`/assets/couriers/${courierId}/animations.json`)).json();
  }
  return journeyMetaCache[courierId];
}

function loadSave() {
  try {
    const raw = localStorage.getItem('dream-delivery-save');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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
  if (state.sealPlaced) sfx.play('stamp');
  setState(state);
  if (state.sealPlaced) {
    // Brief beat so the seal placement is visible, then to courier choice.
    setTimeout(() => setState({ ...state, screen: 'choose' }), reducedMotion() ? 0 : 650);
  } else {
    $('seal-hint').textContent = 'Both fields, dreamer. Even magic needs an address.';
  }
});

$('courier-grid').addEventListener('click', (e) => {
  const card = e.target.closest('[data-courier]');
  if (!card) return;
  setState(dispatch(state, { type: 'CHOOSE_COURIER', courierId: card.dataset.courier }));
});

// WAI-ARIA radio pattern: roving tabindex + arrow keys.
$('courier-grid').addEventListener('keydown', (e) => {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const cards = [...document.querySelectorAll('[data-courier]')];
  const i = cards.indexOf(document.activeElement);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1
    : i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1);
  const card = cards[(next + cards.length) % cards.length];
  card.focus();
  setState(dispatch(state, { type: 'CHOOSE_COURIER', courierId: card.dataset.courier }));
});

$('btn-confirm-courier').addEventListener('click', () => setState(dispatch(state, { type: 'OPEN_ROUTE_MAP' })));

$('route-grid').addEventListener('click', (e) => {
  const card = e.target.closest('[data-route]');
  if (!card) return;
  setState(dispatch(state, { type: 'BEGIN_JOURNEY', routeId: card.dataset.route }));
});

let journeyRunning = false;
async function startJourney() {
  if (journeyRunning) return;
  journeyRunning = true;
  const route = ROUTES[state.journey.routeId];
  const courier = COURIERS[state.courierId ?? 'momo'];
  const stage = $('courier-stage');
  const meta = await journeyMeta(courier.id);
  const walk = meta.animations.walk;
  animator?.destroy?.();
  animator = new SpriteAnimator({
    src: `/assets/couriers/${courier.id}/${walk.file}`,
    frames: walk.frames, fps: walk.fps,
    frameWidth: walk.frameWidth, frameHeight: walk.frameHeight,
    accent: courier.accent,
  }).mount(stage);
  const dur = reducedMotion() ? 0.8 : route.duration; // seconds; CSS trot eases to match
  animator.el.setAttribute('aria-hidden', 'true');
  $('courier-stage').style.animationDuration = `${dur}s`;

  const t0 = performance.now();
  function tick(t) {
    const dt = (t - t0) / 1000;
    const p = Math.min(1, dt / dur);
    setState(dispatch(state, { type: 'ADVANCE_JOURNEY', dt: dt }));
    if (p < 1 && state.screen === 'journey') requestAnimationFrame(tick);
    else journeyRunning = false;
  }
  requestAnimationFrame(tick);
}

let continueBound = false;
function bindContinue() {
  if (continueBound) return;
  continueBound = true;
  $('btn-continue').addEventListener('click', () => {
    continueBound = false;
    setState(dispatch(state, { type: 'CLAIM_STAMP' }));
    sfx.play('stamp');
    setState(dispatch(state, { type: 'FINISH_DELIVERY' }));
    sfx.play('arrival');
  });
}

$('btn-again').addEventListener('click', () => setState(dispatch(state, { type: 'RESET' })));

setState(state);
