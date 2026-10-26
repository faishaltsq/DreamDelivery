import { initialState, dispatch, COURIERS, ROUTES } from './game/state.js';
import { createJourneyClock } from './game/journeyClock.js';
import {
  renderScreens, renderPostOffice, renderWrite, renderChoose,
  renderJourney, renderEncounter, renderRouteMap, renderPostcard, renderAlbum,
} from './render/screens.js';
import { applyAssets, applyScene, preloadScene, loadCourier } from './render/assets.js';
import { SpriteAnimator } from './render/sprites.js';
import { Sfx } from './render/audio.js';

const $ = (id) => document.getElementById(id);
function loadSave() {
  try {
    const save = JSON.parse(localStorage.getItem('dream-delivery-save'));
    const stamps = Array.isArray(save?.stamps) ? [...new Set(save.stamps.filter(s => typeof s === 'string' && s.length < 64))] : [];
    const letters = Array.isArray(save?.letters) ? save.letters.filter(l =>
      l && typeof l.recipient === 'string' && typeof l.message === 'string'
      && ROUTES[l.routeId] && COURIERS[l.courierId] && Number.isFinite(l.at)
    ).map(l => ({ recipient: l.recipient, message: l.message, routeId: l.routeId, courierId: l.courierId, at: l.at })) : [];
    return { stamps, letters };
  } catch { return { stamps: [], letters: [] }; }
}
function persist() {
  try {
    localStorage.setItem('dream-delivery-save', JSON.stringify({ stamps: state.stamps, letters: state.letters }));
  } catch { /* Storage may be unavailable; the current delivery remains playable. */ }
}

let state = { ...initialState(), ...loadSave() };
let animator = null;
let journeyRun = null;
const sfx = new Sfx();
function stopJourney() {
  if (journeyRun) cancelAnimationFrame(journeyRun.raf);
  journeyRun = null;
  animator?.destroy();
  animator = null;
}

function setState(next) {
  if (next === state) return;
  const previous = state;
  state = next;
  const entering = previous.screen !== next.screen;
  if (entering && previous.screen === 'journey') stopJourney();
  if (previous.letters !== next.letters || previous.stamps !== next.stamps) persist();
  renderScreens(state);
  if (state.screen === 'post-office') renderPostOffice(state);
  if (state.screen === 'write') renderWrite(state);
  if (state.screen === 'choose') renderChoose(state);
  if (state.screen === 'route-map') renderRouteMap(state);
  if (state.screen === 'journey') {
    renderJourney(state);
    if (entering) startJourney();
  }
  if (state.screen === 'encounter') {
    renderEncounter(state);
    if (entering) sfx.play('sparkle');
  }
  if (state.screen === 'postcard') renderPostcard(state);
  if (state.screen === 'album') renderAlbum(state);
  if (entering) {
    const screen = $(`screen-${state.screen}`);
    void applyAssets(screen);
    for (const image of screen.querySelectorAll('[data-environment]')) void applyScene(image, image.dataset.environment);
    if (state.screen === 'write' || state.screen === 'choose') void preloadScene('moonfield');
    const focus = screen.querySelector('h1, [role="radio"][tabindex="0"], input, button');
    if (focus) {
      if (focus.tagName === 'H1') focus.tabIndex = -1;
      focus.focus({ preventScroll: true });
    }
  }
}

$('btn-start').addEventListener('click', () => {
  if (state.screen !== 'post-office') return;
  sfx.play('send');
  setState(dispatch(state, { type: 'START_WRITING' }));
});
$('btn-album').addEventListener('click', () => setState(dispatch(state, { type: 'OPEN_ALBUM' })));
$('btn-album-back').addEventListener('click', () => setState(dispatch(state, { type: 'BACK' })));
$('btn-audio').addEventListener('click', () => {
  const on = sfx.toggle();
  $('btn-audio').setAttribute('aria-pressed', String(on));
  $('btn-audio').querySelector('.toggle-label').textContent = on ? 'Sound on' : 'Sound off';
  if (on) sfx.play('sparkle');
});
$('write-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (state.screen !== 'write') return;
  const sealed = dispatch({ ...state, recipient: $('recipient').value, message: $('message').value }, { type: 'SEAL_LETTER' });
  if (sealed.sealPlaced) {
    sfx.play('stamp');
    setState({ ...sealed, screen: 'choose' });
  } else {
    $('seal-hint').textContent = 'Both fields, dreamer. Even magic needs an address.';
    $('recipient').value.trim() ? $('message').focus() : $('recipient').focus();
  }
});
$('courier-grid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-courier]');
  if (!card || state.screen !== 'choose') return;
  setState(dispatch(state, { type: 'CHOOSE_COURIER', courierId: card.dataset.courier }));
  $('courier-grid').querySelector(`[data-courier="${card.dataset.courier}"]`)?.focus();
});
$('courier-grid').addEventListener('keydown', (event) => {
  if (state.screen !== 'choose' || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const cards = [...$('courier-grid').querySelectorAll('[data-courier]')];
  const current = Math.max(0, cards.indexOf(document.activeElement));
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1
    : (current + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + cards.length) % cards.length;
  const id = cards[index].dataset.courier;
  setState(dispatch(state, { type: 'CHOOSE_COURIER', courierId: id }));
  $('courier-grid').querySelector(`[data-courier="${id}"]`)?.focus();
});
$('btn-confirm-courier').addEventListener('click', () => {
  if (!state.courierId) return;
  setState(dispatch(state, { type: 'OPEN_ROUTE_MAP' }));
});
$('route-grid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-route]');
  if (!card) return;
  setState(dispatch(state, { type: 'BEGIN_JOURNEY', routeId: card.dataset.route }));
});

function startJourney() {
  stopJourney();
  const route = ROUTES[state.journey.routeId];
  const courier = COURIERS[state.courierId];
  const stage = $('courier-stage');
  const run = { clock: createJourneyClock(route.duration), last: performance.now(), raf: 0 };
  journeyRun = run;
  stage.replaceChildren();
  stage.classList.add('courier-loading');
  const label = document.createElement('span');
  label.className = 'courier-loading-label';
  label.setAttribute('role', 'status');
  label.textContent = `Waking ${courier.name}…`;
  stage.append(label);
  // The timeline starts independently: slow or failed artwork cannot lock delivery.
  function tick(now) {
    if (journeyRun !== run || state.screen !== 'journey') return;
    const result = run.clock.advance((now - run.last) / 1000);
    run.last = now;
    const remaining = route.duration * (1 - state.journey.progress);
    setState(dispatch(state, { type: 'ADVANCE_JOURNEY', dt: result.justCompleted ? remaining : result.advanced }));
    if (journeyRun === run) run.raf = requestAnimationFrame(tick);
  }
  run.raf = requestAnimationFrame(tick);
  void loadCourier(courier.id).then(asset => {
    if (journeyRun !== run) return;
    animator = new SpriteAnimator({
      ...asset,
      onReady: () => {
        if (journeyRun !== run) return;
        label.remove();
        stage.classList.remove('courier-loading');
      },
      onError: () => {
        if (journeyRun !== run) return;
        stage.classList.add('courier-loading');
        label.textContent = `${courier.name}'s artwork could not load. Delivery continues.`;
      },
    }).mount(stage);
    animator.el.setAttribute('aria-hidden', 'true');
  }).catch(() => {
    if (journeyRun === run) label.textContent = `${courier.name}'s artwork could not load. Delivery continues.`;
  });
}

// Registered once. Claim and finish are committed together before any SFX or render.
$('btn-continue').addEventListener('click', () => {
  if (state.screen !== 'encounter' || state._delivered) return;
  const claimed = dispatch(state, { type: 'CLAIM_STAMP' });
  const finished = dispatch(claimed, { type: 'FINISH_DELIVERY' });
  if (finished.screen !== 'postcard') return;
  setState(finished);
  sfx.play('stamp');
  sfx.play('arrival');
});
$('btn-again').addEventListener('click', () => setState(dispatch(state, { type: 'RESET' })));
addEventListener('pagehide', stopJourney);
addEventListener('resize', () => { if (state.screen === 'journey') renderJourney(state); });
renderScreens(state);
renderPostOffice(state);
void applyAssets($('screen-post-office'));
for (const image of $('screen-post-office').querySelectorAll('[data-environment]')) void applyScene(image, image.dataset.environment);
persist();
