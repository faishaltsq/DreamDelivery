// Dream Delivery render layer: read-only projection of game state to DOM. No game rules here.
import { COURIERS, ROUTES, ENCOUNTERS, STAMPS, BONUS_STAMPS, allStampIds } from '../game/state.js';
import { applyAssets, applyScene } from './assets.js';

const SCREENS = ['post-office', 'write', 'choose', 'route-map', 'journey', 'encounter', 'postcard', 'album'];

export function renderScreens(state) {
  for (const s of SCREENS) {
    document.getElementById(`screen-${s}`).hidden = state.screen !== s;
  }
}

export function renderPostOffice(state) {
  // quiet persistence nudge under the title when the player already delivered letters
  const back = $('po-welcome-back');
  if (state.letters.length) {
    back.hidden = false;
    back.textContent = `Welcome back, dreamer. ${state.letters.length} letter${state.letters.length > 1 ? 's' : ''} delivered so far.`;
  }
}

export function renderWrite(state) {
  $('recipient').value = state.recipient;
  $('message').value = state.message;
  $('seal-img').hidden = !state.sealPlaced;
  $('seal-hint').textContent = state.sealPlaced ? 'Sealed with a dream' : 'No seal yet';
}

export function renderChoose(state) {
  const grid = $('courier-grid');
  const hadFocus = document.activeElement?.dataset?.courier ?? null;
  grid.replaceChildren(...Object.values(COURIERS).map(c => courierCard(c, state.courierId === c.id)));
  void applyAssets(grid);
  $('btn-confirm-courier').disabled = !state.courierId;
  // Keep focus on the selected card (arrow-key selection re-renders the group);
  // fall back to the selected card, else first card, so the group always has exactly one tab stop.
  const target = grid.querySelector('[aria-checked="true"]')
    || (hadFocus && grid.querySelector(`[data-courier=${hadFocus}]`))
    || grid.querySelector('[data-courier]');
  if (target) {
    for (const c of grid.querySelectorAll('[data-courier]')) c.tabIndex = c === target ? 0 : -1;
    if (hadFocus) target.focus();
  }
}

function courierCard(c, selected) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'courier-card';
  btn.dataset.courier = c.id;
  btn.setAttribute('role', 'radio');
  btn.setAttribute('aria-checked', String(selected));
  btn.tabIndex = selected ? 0 : -1;
  btn.innerHTML = `
    <img class="frame" data-asset="ui.card" src="/assets/ui/card-background.svg" alt="" aria-hidden="true">
    <img class="face" data-asset="courier.${c.id}.portrait" src="/assets/couriers/${c.id}/portrait.png" alt="Portrait of ${c.name}">
    <span class="name">${c.name}</span>
    <span class="role">${c.title}</span>`;
  return btn;
}

export function renderRouteMap(state) {
  const grid = $('route-grid');
  grid.replaceChildren(...Object.values(ROUTES).map(r => routeCard(r)));
  $('route-hint').textContent = state.courierId
    ? `${COURIERS[state.courierId].name} is ready. Where to?`
    : 'Choose a courier first.';
}

function routeCard(r) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'route-card';
  btn.dataset.route = r.id;
  btn.innerHTML = `
    <img class="frame" data-asset="ui.card" src="/assets/ui/card-background.svg" alt="" aria-hidden="true">
    <img class="tile" src="${r.tile}" alt="" aria-hidden="true">
    <span class="name">${r.label}</span>`;
  return btn;
}

export function renderJourney(state) {
  const route = ROUTES[state.journey?.routeId];
  if (!route) return;
  const background = $('journey-bg');
  if (background.dataset.environment !== route.id) {
    background.dataset.environment = route.id;
    void applyScene(background, route.id);
  }
  $('journey-title').textContent = `${route.label} Journey`;
  const progress = Math.max(0, Math.min(1, state.journey.progress));
  $('journey-bar').style.width = `${progress * 100}%`;
  $('journey-progress').setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  const stage = $('courier-stage');
  const scene = stage.closest('.scene');
  const position = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 0.14 + progress * 0.72;
  stage.style.left = `${Math.round(scene.clientWidth * position)}px`;
  stage.style.top = `${Math.round(scene.clientHeight * 0.68)}px`;
  stage.dataset.progress = String(progress);
  $('journey-hint').textContent = `${COURIERS[state.courierId ?? 'momo'].name} travels the ${route.label.toLowerCase()}…`;
}

export function renderEncounter(state) {
  const enc = state.encounter;
  if (!enc) return;
  $('encounter-title').textContent = enc.title;
  $('encounter-text').textContent = enc.text;
  $('encounter-effect').src = enc.effectAsset;
  $('encounter-bg').dataset.environment = state.journey.routeId;
  void applyScene($('encounter-bg'), state.journey.routeId);
  $('encounter-courier').dataset.asset = `courier.${state.courierId ?? 'momo'}.portrait`;
  $('encounter-courier').src = `/assets/couriers/${state.courierId ?? 'momo'}/portrait.png`;
}

export function renderPostcard(state) {
  const route = ROUTES[state.journey?.routeId];
  $('pc-photo').src = `/assets/postcards/${route?.id ?? 'moonfield'}-sample.png`;
  $('pc-stamp').src = STAMPS[route?.stamp ?? 'moonrise'];
  const courier = COURIERS[state.courierId ?? 'momo'];
  $('pc-byline').innerHTML = `DELIVERED BY<br><strong>${courier.name.toUpperCase()}</strong><br>${courier.title.toUpperCase()}`;
  $('pc-caption').textContent = state.message ? `“${state.message}”` : '';
  $('pc-to').textContent = state.recipient ? `For ${state.recipient}` : '';
}

export function renderAlbum(state) {
  const owned = new Set(state.stamps);
  const grid = $('album-grid');
  grid.replaceChildren(...allStampIds().map(id => {
    const slot = document.createElement('div');
    slot.className = 'album-slot' + (owned.has(id) ? ' owned' : '');
    slot.innerHTML = `
      <img class="frame" data-asset="ui.slot" src="/assets/ui/collection-slot.svg" alt="" aria-hidden="true">
      ${owned.has(id) ? `<img class="stamp pixel-art" src="${STAMPS[id] ?? BONUS_STAMPS[id]}" alt="Stamp ${id}">`
                      : `<span class="unknown">?</span>`}`;
    return slot;
  }));
  $('album-count').textContent = `${owned.size} of ${allStampIds().length} stamps`;
  $('album-history').textContent = state.letters.length
    ? `${state.letters.length} letter${state.letters.length > 1 ? 's' : ''} delivered. Latest: ${state.letters.at(-1).recipient}, via ${ROUTES[state.letters.at(-1).routeId].label}.`
    : 'No letters yet. The night is young.';
}

function $(id) { return document.getElementById(id); }
