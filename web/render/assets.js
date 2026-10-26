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
  postcard: ['postcard-frame.svg', 640, 430],
  card: ['card-background.svg', 440, 310],
  slot: ['collection-slot.svg', 192, 200],
  progress: ['progress-track.svg', 620, 90],
};
const refreshUI = {
  primary: ['button-primary.svg', 320, 90], secondary: ['button-secondary.svg', 320, 90],
  panel: ['parchment-panel.svg', 720, 510], postcard: ['postcard-frame.svg', 900, 570],
  card: ['card.svg', 320, 380], slot: ['inventory-slot.svg', 120, 120], progress: ['progress-track.svg', 520, 38],
};
const couriers = new Set(['momo', 'lune', 'pip']);
const variant = (src, width, height, exact = false) => ({ src, width, height, exact });

// Pending paths are contracts, not claims that replacement art has shipped.
export const ASSETS = Object.freeze({
  ...Object.fromEntries(Object.entries(environmentSizes).map(([id, [width, height]]) => [
    `environment.${id}`, {
      status: ['post-office-interior', 'moonfield'].includes(id) ? 'candidate-v2-not-production' : 'prototype',
      layers: {
        background: {
          v2: ['post-office-interior', 'moonfield'].includes(id)
            ? [variant(`/assets/v2/environments/${id}/background.webp`, 2560, 1440, true), variant(`/assets/v2/environments/${id}/background-1280.webp`, 1280, 720, true)] : [],
          fallback: [
            variant(`/assets/environments/${id}/scene-native.png`, width, height, true),
            variant(`/assets/environments/${id}/scene-preview.webp`, 1600, 900, true),
          ],
        },
      },
    },
  ])),
  ...Object.fromEntries(Object.entries(uiFiles).map(([id, [file, width, height]]) => [
    `ui.${id}`, {
      status: 'candidate-v2-draft',
      v2: [variant(`/assets/v2/ui/${refreshUI[id][0]}`, refreshUI[id][1], refreshUI[id][2], true)],
      fallback: [variant(`/assets/ui/${file}`, width, height, true)],
    },
  ])),
  ...Object.fromEntries([...couriers].map(id => [
    `courier.${id}.portrait`, {
      status: id === 'momo' ? 'pending-v2' : 'prototype',
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
    element.dataset.assetStatus = result.status;
    element.dataset.assetReason = result.reason;
    if (result.src) {
      if (element.tagName === 'IMG') {
        element.src = result.src;
        if (element.dataset.asset?.startsWith('ui.') && element.parentElement) {
          const surface = element.classList.contains('panel-bg') ? element.closest('.panel')
            : element.classList.contains('postcard-frame') ? element.closest('.postcard')
            : element.closest('.btn, .courier-card, .route-card');
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
      for (const name of Object.keys(layers).filter(name => name !== 'background')) {
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

  async function atlas(src, meta, degraded, reason = '') {
    if (!validateCourierManifest(meta)) return null;
    const image = await inspectImage(src);
    if (image.error || !validateImageDimensions(image.value, {
      width: meta.frames * meta.frameWidth, height: meta.frameHeight, exact: true,
    })) return null;
    return {
      src, frames: meta.frames, fps: meta.fps, frameWidth: meta.frameWidth, frameHeight: meta.frameHeight,
      anchor: { ...meta.anchor }, degraded, status: degraded ? 'fallback' : 'v2', reason,
    };
  }

  async function loadCourier(id) {
    if (!couriers.has(id)) throw new RangeError(`Unknown courier: ${id}`);
    let reason = '';
    if (id === 'momo' && preferV2) {
      const manifest = await readJson('/assets/v2/couriers/momo/manifest.json');
      const supplied = manifest.value;
      const walk = supplied?.animations?.walk;
      const meta = walk ? { ...walk, anchor: supplied.recommendedAnchor } : supplied;
      const file = walk && validWalk(walk) ? walk.file : 'sprite.png';
      if (validateCourierManifest(meta)) {
        const sprite = await atlas(`/assets/v2/couriers/momo/${file}`, meta, false);
        if (sprite) return sprite;
        reason = 'invalid-v2-sprite';
      } else reason = manifest.error || 'invalid-v2-manifest';
    }
    const meta = await cached(metadata, `courier:${id}`, signal => loadJourneyMeta(
      (src, options) => fetchImpl(src, { ...options, signal }), id, { timeout: deadline },
    ));
    const walk = meta.value?.walk;
    if (validWalk(walk)) {
      const sprite = await atlas(`/assets/couriers/${id}/${walk.file}`,
        { ...walk, anchor: walk.anchor || { x: 0.5, y: 0.85 } }, true, reason || meta.value?.error || 'prototype-animation');
      if (sprite) return sprite;
    }
    const fallback = await atlas(`/assets/couriers/${id}/${FALLBACK_WALK.file}`,
      { ...FALLBACK_WALK, anchor: { x: 0.5, y: 0.85 } }, true, reason || meta.error || 'invalid-v1-manifest');
    if (fallback) return fallback;
    throw new Error(`Courier ${id}: no valid sprite atlas`);
  }

  return { resolveAsset, applyAssets, applyScene, preloadScene, loadCourier };
}

const registry = createAssetRegistry({ preferV2: typeof location !== 'undefined' && new URLSearchParams(location.search).get('art') === 'v2' });
export const { applyAssets, applyScene, preloadScene, loadCourier } = registry;
