import { loadJourneyMeta, FALLBACK_WALK, validWalk } from '../game/assetMeta.js';

const environmentSizes = {
  'post-office-exterior': [417, 284],
  'post-office-interior': [368, 204],
  cloudpath: [169, 154],
  moonfield: [159, 154],
  'forest-of-whispers': [170, 154],
  starport: [180, 154],
};
const uiFiles = {
  primary: ['primary-button.svg', 320, 180],
  secondary: ['secondary-button.svg', 320, 180],
  panel: ['parchment-panel.svg', 640, 440],
  card: ['card-background.svg', 440, 310],
  slot: ['collection-slot.svg', 192, 200],
  progress: ['progress-track.svg', 620, 90],
};
const refreshUI = {
  primary: ['button-primary.svg', 320, 90], secondary: ['button-secondary.svg', 320, 90],
  panel: ['parchment-panel.svg', 720, 510],
  card: ['card.svg', 320, 380], slot: ['inventory-slot.svg', 120, 120], progress: ['progress-track.svg', 520, 38],
  route: ['route-card.svg', 420, 300], input: ['input-frame.svg', 560, 90], textarea: ['textarea-frame.svg', 560, 240],
  divider: ['divider-stars.svg', 480, 40], seal: ['wax-seal.svg', 128, 128], moon: ['moon-icon.svg', 128, 128],
  tab: ['tab-active.svg', 240, 72],
};
// v1 files or CSS-native decoration for the same slots; no slot exists without a real fallback.
const refreshFallbacks = {
  route: ['/assets/ui/card-background.svg', 440, 310, true],
  input: ['/assets/ui/message-input.svg', 640, 420, true],
  textarea: null,
  divider: ['/assets/ui/divider.svg', 454, 58, true],
  seal: ['/assets/ui/mail-seal.svg', 128, 128, true],
  moon: ['/assets/ui/moon-mark.svg', 132, 132, true],
  tab: ['/assets/ui/tab-active.svg', 320, 128, true],
};
// Real geometry of supplied candidates: one 2560x1440 export, one 1280x720 export.
const environmentCandidate = base => [
  variant(`${base}.webp`, 2560, 1440, true), variant(`${base}-1280.webp`, 1280, 720, true),
];
// Supplied alternates stay named layers until a screen explicitly opts in; no parallax is implied.
const environmentAlternates = {
  'post-office-interior': { 'interior-alt': '/assets/v2/environments/post-office-interior/empty-background' },
  moonfield: { river: '/assets/v2/environments/moonfield/river-background' },
};
const couriers = new Set(['momo', 'lune', 'pip']);
const variant = (src, width, height, exact = false) => ({ src, width, height, exact });

// Honest quality label carried on every entry and surfaced in DOM status attributes.
// Momo states come from the supplied manifest; journey=walk, encounter=reaction, coda=sleep.
const QUALITY = Object.freeze({
  upscaled: 'UPSCALED_PREVIEW_NOT_NATIVE_HD', poseReuse: 'POSE_REUSE_NOT_FINAL',
  svgDraft: 'SCALABLE_SVG_V2_DRAFT', nativePrototype: 'PROTOTYPE_V1',
});
const MOMO_STATES = Object.freeze({
  journey: { animation: 'walk', fallbackFile: 'animations/walk.png' },
  encounter: { animation: 'reaction', fallbackFile: 'animations/walk.png' },
  coda: { animation: 'sleep', fallbackFile: 'animations/walk.png' },
  idle: { animation: 'idle', fallbackFile: 'animations/walk.png' },
});
export const MOMO_STATE_ANIMATIONS = MOMO_STATES;

// Supplied v2 UI files with no honest slot in the current screens. Documented, not forced.
export const UNUSED_V2_UI = Object.freeze({
  'modal-frame.svg': 'No modal dialog exists; journey is a full scene and screens never stack a second panel.',
  'notification.svg': 'Toasts would duplicate existing aria-live hints and the journey status label.',
  'tab-inactive.svg': 'No tab strip exists; couriers use a radiogroup, routes a grid. ui.tab ships only the active frame.',
});
// Registered alternatives: supplied environment candidates a screen may opt into by layer name.
export const ENVIRONMENT_ALTERNATES = Object.freeze({
  'post-office-interior': Object.freeze({ 'interior-alt': 'empty room without the writing clerk; opt-in layer only' }),
  moonfield: Object.freeze({ river: 'river/lake context candidate' }),
});
// Prototype contact-sheet thumbnails: real files, but each is a cropped tile with burned-in
// caption text (moonburst.png is 44x35 reading "Particles"). Referenced by the encounter data and
// deliberately never mounted; not substituted either.
export const UNMOUNTED_EFFECTS = Object.freeze({
  'cloud-fluff.png': 50, 'magic-swirl.png': 46, 'moonburst.png': 44, 'petals.png': 47,
  'portal.png': 45, 'sparkles.png': 49, 'star-glow.png': 50, 'stardust.png': 43,
});
export const ART_TOGGLE = Object.freeze({
  param: 'art', value: 'v2',
  read: search => (typeof search === 'string' ? new URLSearchParams(search) : new URLSearchParams()).get('art') === 'v2',
});

// Pending paths are contracts, not claims that replacement art has shipped.
const v2Environment = id => ['post-office-interior', 'moonfield'].includes(id);
export const ASSETS = Object.freeze({
  ...Object.fromEntries(Object.entries(environmentSizes).map(([id, [width, height]]) => {
    const isV2 = v2Environment(id);
    const layers = { background: {
      v2: isV2 ? environmentCandidate('/assets/v2/environments/' + id + '/background') : [],
      quality: isV2 ? 'UPSCALED_PREVIEW_NOT_NATIVE_HD' : 'PROTOTYPE_V1',
      fallback: [variant('/assets/environments/' + id + '/scene-native.png', width, height, true),
                 variant('/assets/environments/' + id + '/scene-preview.webp', 1600, 900, true)],
    } };
    for (const [layer, file] of Object.entries(environmentAlternates[id] || {})) {
      layers[layer] = { v2: environmentCandidate(file), fallback: [], quality: 'UPSCALED_PREVIEW_NOT_NATIVE_HD' };
    }
    return ['environment.' + id, {
      status: isV2 ? 'candidate-v2-not-production' : 'prototype',
      quality: isV2 ? QUALITY.upscaled : QUALITY.nativePrototype,
      reason: isV2 ? 'UPSCALED_PREVIEW_NOT_NATIVE_HD' : 'V1_PROTOTYPE_SCENE',
      layers,
    }];
  })),
  ...Object.fromEntries(Object.keys(refreshUI).map(id => {
    const [file, width, height] = uiFiles[id] || [];
    const fb = refreshFallbacks[id] || (file ? ['/assets/ui/' + file, width, height, true] : null);
    const asset = { status: 'candidate-v2-draft', quality: QUALITY.svgDraft, reason: 'SCALABLE_SVG_V2_DRAFT' };
    asset.v2 = [variant('/assets/v2/ui/' + refreshUI[id][0], refreshUI[id][1], refreshUI[id][2], true)];
    asset.fallback = fb ? [variant(fb[0], fb[1], fb[2], fb[3])] : [];
    return ['ui.' + id, asset];
  })),
  ...Object.fromEntries([...couriers].map(id => [
    `courier.${id}.portrait`, {
      status: id === 'momo' ? 'pending-v2' : 'prototype',
      quality: QUALITY.nativePrototype, reason: 'V1_PROTOTYPE_PORTRAIT',
      v2: id === 'momo' ? [variant('/assets/v2/couriers/momo/portrait.png', 384, 384)] : [],
      fallback: [variant(`/assets/couriers/${id}/portrait.png`, 384, 384, true)],
    },
  ])),
});

const positive = value => Number.isFinite(value) && value > 0;

export function validateImageDimensions(image, candidate) {
  const width = image?.naturalWidth ?? image?.width;
  const height = image?.naturalHeight ?? image?.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return false;
  if (candidate.exact) return width === candidate.width && height === candidate.height;
  return width >= candidate.width && height >= candidate.height
    && Math.abs(width / height / (candidate.width / candidate.height) - 1) <= 0.04;
}

export function validateCourierManifest(meta) {
  return !!meta && Number.isInteger(meta.frames) && meta.frames >= 1 && meta.frames <= 256
    && positive(meta.fps) && meta.fps <= 60
    && Number.isInteger(meta.frameWidth) && meta.frameWidth >= 1 && meta.frameWidth <= 2048
    && Number.isInteger(meta.frameHeight) && meta.frameHeight >= 1 && meta.frameHeight <= 2048
    && positive(meta.frames * meta.frameWidth) && meta.frames * meta.frameWidth <= 16384
    && !!meta.anchor && Number.isFinite(meta.anchor.x) && meta.anchor.x >= 0 && meta.anchor.x <= 1
    && Number.isFinite(meta.anchor.y) && meta.anchor.y >= 0 && meta.anchor.y <= 1;
}

function orderedVariants(variants, { width = 1, height = 1, dpr = 1 } = {}) {
  const ratio = Math.min(3, positive(dpr) ? dpr : 1);
  const targetWidth = (positive(width) ? width : 1) * ratio;
  const targetHeight = (positive(height) ? height : 1) * ratio;
  return [...variants].sort((a, b) => {
    const aFits = a.width >= targetWidth && a.height >= targetHeight;
    const bFits = b.width >= targetWidth && b.height >= targetHeight;
    if (aFits !== bFits) return aFits ? -1 : 1;
    return (aFits ? 1 : -1) * (a.width * a.height - b.width * b.height);
  });
}

function bounded(work, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('asset-timeout'));
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve().then(() => work(controller.signal)), timeout])
    .finally(() => clearTimeout(timer));
}

async function browserImageProbe(src, { signal, fetchImpl }) {
  // Fetch first: a missing pending asset never becomes a broken <img> request.
  const response = await fetchImpl(src, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (signal.aborted) throw new Error('asset-timeout');
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      const cleanup = () => {
        image.onload = image.onerror = null;
        signal.removeEventListener('abort', abort);
      };
      const fail = () => { cleanup(); reject(new Error('image-decode-failed')); };
      const abort = () => { cleanup(); image.src = ''; reject(new Error('asset-timeout')); };
      image.onload = () => {
        const dimensions = { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
        cleanup();
        resolve(dimensions);
      };
      image.onerror = fail;
      signal.addEventListener('abort', abort, { once: true });
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function createAssetRegistry({
  assets = ASSETS,
  fetchImpl = (...args) => globalThis.fetch(...args),
  probeImage = browserImageProbe,
  timeoutMs = 1500,
  cacheLimit = 96,
  preferV2 = true,
} = {}) {
  const images = new Map();
  const metadata = new Map();
  const bindings = new WeakMap();
  const sceneBindings = new WeakMap();
  const limit = Number.isInteger(cacheLimit) && cacheLimit > 0 ? cacheLimit : 96;
  const deadline = positive(timeoutMs) ? timeoutMs : 1500;

  function cached(cache, key, work) {
    if (cache.has(key)) return cache.get(key);
    const result = bounded(work, deadline).then(value => ({ value }), error => ({ error: String(error.message || error) }));
    cache.set(key, result);
    if (cache.size > limit) cache.delete(cache.keys().next().value);
    return result;
  }

  const inspectImage = src => cached(images, src, signal => probeImage(src, { signal, fetchImpl }));
  const readJson = src => cached(metadata, src, async signal => {
    const response = await fetchImpl(src, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });

  async function resolveAsset(id, size = {}) {
    const entry = assets[id];
    const layer = size.layer || 'background';
    const source = entry?.layers ? entry.layers[layer] : entry;
    if (!source) return { src: null, status: 'unavailable', degraded: true, reason: 'unknown-asset-or-layer', id, layer };
    let reason = '';
    for (const [tier, candidates] of [['v2', preferV2 ? source.v2 || [] : []], ['fallback', source.fallback || []]]) {
      for (const candidate of orderedVariants(candidates, size)) {
        const result = await inspectImage(candidate.src);
        if (result.error || !validateImageDimensions(result.value, candidate)) {
          reason ||= result.error || 'invalid-image-dimensions';
          continue;
        }
        return {
          id, layer, src: candidate.src,
          width: result.value.naturalWidth ?? result.value.width,
          height: result.value.naturalHeight ?? result.value.height,
          status: tier === 'v2' ? 'v2' : source.v2?.length ? 'pending-v2' : 'fallback',
          degraded: tier !== 'v2', reason,
        };
      }
    }
    return { id, layer, src: null, status: 'unavailable', degraded: true, reason: reason || 'no-variants' };
  }

  function elementSize(element) {
    const rect = element.getBoundingClientRect?.();
    return {
      width: rect?.width || element.clientWidth || 1,
      height: rect?.height || element.clientHeight || 1,
      dpr: globalThis.devicePixelRatio || 1,
      layer: element.dataset?.environmentLayer || 'background',
    };
  }

  async function apply(element, id, size) {
    const token = {};
    bindings.set(element, token);
    const result = await resolveAsset(id, size);
    if (bindings.get(element) !== token) return result;
    const quality = (assets[id]?.layers ? assets[id].layers[size.layer || 'background'] : assets[id])?.quality || '';
    element.dataset.assetStatus = result.status;
    element.dataset.assetReason = result.reason;
    if (quality) element.dataset.assetQuality = quality;
    else delete element.dataset.assetQuality;
    if (result.src) {
      if (element.tagName === 'IMG') {
        element.src = result.src;
        if (element.dataset.asset?.startsWith('ui.') && element.parentElement) {
          const surface = element.classList.contains('panel-bg') ? element.closest('.panel')
            : element.classList.contains('field-frame') ? element.closest('.field')
            : element.classList.contains('frame') ? element.closest('.courier-card, .route-card')
            : element.querySelector?.('[data-asset-surface]')
            || element.closest('[data-asset-surface]')
            || (element.dataset.asset.startsWith('ui.') && element.dataset.asset !== 'ui.seal' ? element.parentElement : null);
          surface?.style.setProperty('--skin-image', `url("${result.src}")`);
        }
      } else {
        element.style.backgroundImage = `url("${result.src}")`;
        element.style.setProperty('--asset-image', `url("${result.src}")`);
      }
    }
    return result;
  }

  async function applyScene(image, id) {
    const token = {};
    sceneBindings.set(image, token);
    const result = await apply(image, `environment.${id}`, elementSize(image));
    if (sceneBindings.get(image) !== token) return result;
    const scene = image.closest?.('.scene');
    if (scene) {
      for (const previous of scene.querySelectorAll('.scene-layer')) previous.remove();
      const layers = assets[`environment.${id}`]?.layers || {};
      const wanted = new Set((image.dataset.environmentLayers || '').split(/\s+/).filter(name => name && name !== 'background'));
      for (const name of Object.keys(layers).filter(name => wanted.has(name))) {
        const layer = document.createElement('img');
        layer.className = 'scene-bg scene-layer';
        layer.dataset.environmentLayer = name;
        layer.alt = '';
        layer.setAttribute('aria-hidden', 'true');
        const resolved = await apply(layer, `environment.${id}`, { ...elementSize(image), layer: name });
        if (resolved.src && sceneBindings.get(image) === token) scene.insertBefore(layer, image.nextSibling);
      }
    }
    return result;
  }

  function preloadScene(id, size = {}) {
    return resolveAsset(`environment.${id}`, {
      width: globalThis.innerWidth || 1280,
      height: globalThis.innerHeight || 720,
      dpr: globalThis.devicePixelRatio || 1,
      ...size,
    });
  }

  async function applyAssets(root = globalThis.document) {
    const elements = [...(root.querySelectorAll?.('[data-asset]') || [])];
    if (root.matches?.('[data-asset]')) elements.unshift(root);
    const results = await Promise.all(elements.map(element => apply(element, element.dataset.asset, elementSize(element))));
    if (root.dataset) root.dataset.assetsStatus = results.some(result => result.status === 'unavailable')
      ? 'unavailable' : results.some(result => result.status === 'pending-v2') ? 'pending-v2' : 'ready';
    return results;
  }

  async function atlas(src, meta, degraded, reason = '', quality = '') {
    if (!validateCourierManifest(meta)) return null;
    const image = await inspectImage(src);
    if (image.error || !validateImageDimensions(image.value, {
      width: meta.frames * meta.frameWidth, height: meta.frameHeight, exact: true,
    })) return null;
    return {
      src, frames: meta.frames, fps: meta.fps, frameWidth: meta.frameWidth, frameHeight: meta.frameHeight,
      anchor: { ...meta.anchor }, degraded, status: degraded ? 'fallback' : 'v2', reason, quality,
    };
  }

  async function loadCourier(id, state = 'journey') {
    if (!couriers.has(id)) throw new RangeError(`Unknown courier: ${id}`);
    const wanted = MOMO_STATES[state] ? state : 'journey';
    const mapping = MOMO_STATES[wanted];
    let reason = '';
    let animations = null;
    let supplied = null;
    if (id === 'momo' && preferV2) {
      // The manifest is live data here (not the cached wrapper) so a failed v1 request later can
      // still fall back onto a delivered v2 atlas.
      const payload = await readJson('/assets/v2/couriers/momo/manifest.json');
      const manifest = payload.value;
      supplied = manifest;
      // State frames come from the manifest; a missing or invalid state walks its own
      // order (walk, idle, reaction, sleep), then the single supplied pose. Never blocks the clock.
      animations = supplied && typeof supplied.animations === 'object' && supplied.animations !== null ? supplied.animations : null;
      const candidates = [];
      if (supplied && validWalk(supplied)) candidates.push(['pose', supplied]);
      if (animations) {
        for (const name of [mapping.animation, 'walk', 'idle', 'reaction', 'sleep']) {
          if (validWalk(animations[name])) candidates.push([name, animations[name]]);
        }
      }
      reason = candidates.some(([name]) => name === mapping.animation) ? '' : `state-missing:${mapping.animation}`;
      for (const [name, anim] of candidates) {
        const meta = { ...anim, anchor: supplied.recommendedAnchor || anim.anchor };
        if (!validateCourierManifest(meta)) continue;
        // A flat manifest's single atlas file stays at the root as sprite.png.
        const base = name === 'pose' ? '/assets/v2/couriers/momo/sprite.png' : `/assets/v2/couriers/momo/${anim.file}`;
        const exact = name === mapping.animation;
        const sprite = await atlas(base, meta, false, exact ? '' : reason || `state-substitute:${name}`, QUALITY.poseReuse);
        if (sprite) return { ...sprite, state: wanted, animation: exact ? name : 'walk', substitute: !exact };
      }
      const pose = supplied?.sprite ? { ...supplied, frames: 1, fps: 1, frameWidth: 64, frameHeight: 64, anchor: supplied.recommendedAnchor } : null;
      if (pose && validateCourierManifest(pose)) {
        const single = await atlas('/assets/v2/couriers/momo/sprite.png', pose, false,
          reason || 'single-pose-no-animation', QUALITY.poseReuse);
        if (single) return { ...single, state: wanted, animation: 'idle', substitute: true };
      }
      reason ||= payload.error || 'invalid-v2-manifest';
    }
    const meta = await cached(metadata, `courier:${id}`, signal => loadJourneyMeta(
      (src, options) => fetchImpl(src, { ...options, signal }), id, { timeout: deadline },
    ));
    const walk = meta.value?.walk;
    if (validWalk(walk)) {
      const sprite = await atlas(`/assets/couriers/${id}/${walk.file}`,
        { ...walk, anchor: walk.anchor || { x: 0.5, y: 0.85 } }, true,
        reason || meta.value?.error || 'prototype-animation', QUALITY.nativePrototype);
      if (sprite) return { ...sprite, state: wanted, animation: 'walk' };
    }
    // Last resort: any delivered v2 state atlas is still real Momo art. This is the only rung that
    // reads only manifest data and never touches the network, so a failed v1 request cannot hide it.
    if (id === 'momo' && preferV2 && animations) {
      for (const name of ['walk', 'idle', 'reaction', 'sleep']) {
        const anim = animations[name];
        if (!anim || !validWalk(anim)) continue;
        const pose = { ...anim, anchor: supplied.recommendedAnchor || anim.anchor };
        if (!validateCourierManifest(pose)) continue;
        const rescue = await atlas('/assets/v2/couriers/momo/' + anim.file, pose, true,
          reason || 'v1-atlas-unavailable', QUALITY.poseReuse);
        if (rescue) return { ...rescue, state: wanted, animation: name, substitute: name !== mapping.animation };
      }
    }
    const fallback = await atlas(`/assets/couriers/${id}/${FALLBACK_WALK.file}`,
      { ...FALLBACK_WALK, anchor: { x: 0.5, y: 0.85 } }, true,
      reason || meta.error || 'invalid-v1-manifest', QUALITY.nativePrototype);
    if (fallback) return { ...fallback, state: wanted, animation: 'walk' };
    throw new Error(`Courier ${id}: no valid sprite atlas`);
  }

  return { resolveAsset, applyAssets, applyScene, preloadScene, loadCourier };
}

const registry = createAssetRegistry({ preferV2: ART_TOGGLE.read(typeof location !== 'undefined' ? location.search : '') });
export const { applyAssets, applyScene, preloadScene, loadCourier } = registry;
