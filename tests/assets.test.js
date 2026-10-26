import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSETS, createAssetRegistry, validateCourierManifest, validateImageDimensions,
} from '../web/render/assets.js';

const walk = { file: 'animations/walk.png', frames: 4, fps: 7, frameWidth: 64, frameHeight: 64, anchor: { x: 0.5, y: 0.85 } };
const dimensions = (width, height) => ({ naturalWidth: width, naturalHeight: height });
const image = (src, width, height, exact = true) => ({ src, width, height, exact });
const json = value => ({ ok: true, json: async () => value });
const missing = async () => ({ ok: false, status: 404 });
const node = (asset, width = 200, height = 100) => ({
  tagName: 'IMG', dataset: { asset }, src: '/existing.png',
  getBoundingClientRect: () => ({ width, height }),
});

function prototypeProbe(src) {
  if (src.includes('/v2/')) throw new Error('HTTP 404');
  if (src.endsWith('/portrait.png')) return dimensions(384, 384);
  if (src.endsWith('/animations/walk.png')) return dimensions(256, 64);
  if (src.endsWith('/scene-preview.webp')) return dimensions(1600, 900);
  if (src.includes('/moonfield/scene-native.png')) return dimensions(159, 154);
  throw new Error(`Unexpected image: ${src}`);
}

test('pending replacements resolve to inventoried v1 without creating v2 art', async () => {
  const registry = createAssetRegistry({ fetchImpl: missing, probeImage: prototypeProbe });
  const result = await registry.resolveAsset('environment.moonfield', { width: 100, height: 100 });
  assert.equal(result.src, '/assets/environments/moonfield/scene-native.png');
  assert.equal(result.status, 'pending-v2');
  assert.equal(result.degraded, true);
  assert.match(result.reason, /404/);
  const courier = await registry.loadCourier('momo');
  assert.equal(courier.src, '/assets/couriers/momo/animations/walk.png');
  assert.deepEqual(courier.anchor, { x: 0.5, y: 0.85 });
  assert.equal(courier.frames, 4);
  assert.equal(courier.fps, 7);
  assert.equal(courier.degraded, true);
});

test('registry declares the exact pending production paths and UI fallbacks', () => {
  assert.equal(ASSETS['environment.post-office-interior'].layers.background.v2[0].src,
    '/assets/v2/environments/post-office-interior/background.webp');
  assert.equal(ASSETS['environment.moonfield'].layers.background.v2[0].src,
    '/assets/v2/environments/moonfield/background.webp');
  assert.equal(ASSETS['courier.momo.portrait'].v2[0].src, '/assets/v2/couriers/momo/portrait.png');
  // ui.postcard is intentionally unregistered: the frame is a border-image skin on .postcard only,
  // so no second decorative <img> can paint over it.
  for (const id of ['primary', 'secondary', 'panel', 'card', 'slot', 'progress']) {
    assert.match(ASSETS[`ui.${id}`].v2[0].src, /^\/assets\/v2\/ui\/.+\.svg$/);
    assert.match(ASSETS[`ui.${id}`].fallback[0].src, /^\/assets\/ui\/.+\.svg$/);
  }
});

test('selects the smallest sufficient variant before probing or decoding', async () => {
  const calls = [];
  const variants = [image('/large', 1600, 900), image('/small', 400, 225), image('/medium', 800, 450)];
  const registry = createAssetRegistry({
    assets: { scene: { v2: variants, fallback: [] } },
    probeImage: async src => {
      calls.push(src);
      const variant = variants.find(candidate => candidate.src === src);
      return dimensions(variant.width, variant.height);
    },
  });
  assert.equal((await registry.resolveAsset('scene', { width: 300, height: 180, dpr: 2 })).src, '/medium');
  assert.deepEqual(calls, ['/medium']);
  assert.equal((await registry.resolveAsset('scene', { width: 2000, height: 1200 })).src, '/large');
  assert.deepEqual(calls, ['/medium', '/large']);
});

test('invalid natural dimensions or corrupt variants continue to a valid fallback', async () => {
  const variants = [image('/corrupt', 400, 225), image('/wrong-aspect', 800, 450, false)];
  const calls = [];
  const registry = createAssetRegistry({
    assets: { scene: { v2: variants, fallback: [image('/real-v1', 100, 100)] } },
    probeImage: async src => {
      calls.push(src);
      if (src === '/corrupt') throw new Error('image-decode-failed');
      return src === '/wrong-aspect' ? dimensions(800, 800) : dimensions(100, 100);
    },
  });
  const result = await registry.resolveAsset('scene');
  assert.equal(result.src, '/real-v1');
  assert.equal(result.status, 'pending-v2');
  assert.deepEqual(calls, ['/corrupt', '/wrong-aspect', '/real-v1']);
});

test('dimension checks reject zero, undersized, distorted and incorrect exact assets', () => {
  const candidate = image('/production', 1600, 900, false);
  assert.equal(validateImageDimensions(dimensions(0, 900), candidate), false);
  assert.equal(validateImageDimensions(dimensions(800, 450), candidate), false);
  assert.equal(validateImageDimensions(dimensions(1600, 1600), candidate), false);
  assert.equal(validateImageDimensions(dimensions(3200, 1800), candidate), true);
  assert.equal(validateImageDimensions(dimensions(3200, 1800), { ...candidate, exact: true }), false);
  assert.equal(validateImageDimensions(dimensions(1600.5, 900), candidate), false);
});

test('layers resolve independently without inventing missing foreground art', async () => {
  const registry = createAssetRegistry({
    assets: { scene: { layers: {
      background: { v2: [image('/background', 100, 100)], fallback: [] },
      foreground: { v2: [image('/foreground', 100, 100)], fallback: [] },
    } } },
    probeImage: async () => dimensions(100, 100),
  });
  assert.equal((await registry.resolveAsset('scene', { layer: 'foreground' })).src, '/foreground');
  assert.equal((await registry.resolveAsset('scene')).src, '/background');
  const missingLayer = await registry.resolveAsset('scene', { layer: 'middle' });
  assert.equal(missingLayer.src, null);
  assert.equal(missingLayer.status, 'unavailable');
});

test('valid v2 courier manifest returns exact horizontal atlas metadata', async () => {
  const registry = createAssetRegistry({
    fetchImpl: async src => {
      assert.equal(src, '/assets/v2/couriers/momo/manifest.json');
      return json({ ...walk, frames: 8, fps: 12, frameWidth: 96, frameHeight: 80 });
    },
    probeImage: async src => {
      assert.equal(src, '/assets/v2/couriers/momo/sprite.png');
      return dimensions(768, 80);
    },
  });
  const result = await registry.loadCourier('momo');
  assert.equal(result.src, '/assets/v2/couriers/momo/sprite.png');
  assert.equal(result.frames, 8);
  assert.equal(result.fps, 12);
  assert.equal(result.frameWidth, 96);
  assert.equal(result.frameHeight, 80);
  assert.equal(result.degraded, false);
});

test('courier validation rejects malformed frame, fps, geometry and anchor values', () => {
  assert.equal(validateCourierManifest(walk), true);
  for (const patch of [
    { frames: 0 }, { frames: 1.5 }, { frames: 257 }, { fps: 0 }, { fps: Infinity }, { fps: 61 },
    { frameWidth: -1 }, { frameHeight: 0 }, { frameHeight: '64' },
    { anchor: null }, { anchor: { x: -0.1, y: 1 } }, { anchor: { x: 0.5, y: NaN } },
    { anchor: { x: 0.5, y: 1.01 } }, { frames: 256, frameWidth: 2048 },
  ]) assert.equal(validateCourierManifest({ ...walk, ...patch }), false, JSON.stringify(patch));
});

test('corrupt JSON and invalid v2 atlas geometry fall back to real v1 metadata', async () => {
  for (const corruptJson of [true, false]) {
    const registry = createAssetRegistry({
      fetchImpl: async src => {
        if (src.includes('/v2/')) return corruptJson
          ? { ok: true, json: async () => { throw new SyntaxError('corrupt JSON'); } }
          : json(walk);
        return json({ animations: { walk: { ...walk, frames: 6, fps: 9 } } });
      },
      probeImage: async src => src.includes('/v2/') ? dimensions(255, 64) : dimensions(384, 64),
    });
    const result = await registry.loadCourier('momo');
    assert.equal(result.src, '/assets/couriers/momo/animations/walk.png');
    assert.equal(result.frames, 6);
    assert.equal(result.fps, 9);
    assert.equal(result.degraded, true);
  }
});

test('missing metadata uses pack-contract defaults, unknown couriers reject', async () => {
  const registry = createAssetRegistry({ fetchImpl: missing, probeImage: prototypeProbe });
  const result = await registry.loadCourier('pip');
  assert.equal(result.src, '/assets/couriers/pip/animations/walk.png');
  assert.equal(result.frameWidth, 64);
  assert.equal(result.frameHeight, 64);
  await assert.rejects(registry.loadCourier('../momo'), RangeError);
});

test('image cache shares concurrent probes, remembers failures and evicts at its bound', async () => {
  const calls = [];
  const registry = createAssetRegistry({
    cacheLimit: 2,
    assets: Object.fromEntries(['a', 'b', 'c'].map(id => [id, { v2: [], fallback: [image(`/${id}`, 1, 1)] }])),
    probeImage: async src => { calls.push(src); throw new Error('missing'); },
  });
  await Promise.all([registry.resolveAsset('a'), registry.resolveAsset('a')]);
  await registry.resolveAsset('a');
  assert.deepEqual(calls, ['/a']);
  await registry.resolveAsset('b');
  await registry.resolveAsset('c');
  await registry.resolveAsset('a');
  assert.deepEqual(calls, ['/a', '/b', '/c', '/a']);
});

test('hung image probes and metadata requests time out, abort and retain fallback', async () => {
  let imageAborted = false;
  const registry = createAssetRegistry({
    timeoutMs: 10,
    assets: { scene: { v2: [image('/hung', 1, 1)], fallback: [image('/v1', 1, 1)] } },
    probeImage: async (src, { signal }) => {
      if (src === '/v1') return dimensions(1, 1);
      signal.addEventListener('abort', () => { imageAborted = true; });
      return new Promise(() => {});
    },
  });
  assert.equal((await registry.resolveAsset('scene')).src, '/v1');
  assert.equal(imageAborted, true);
  const signals = [];
  const courierRegistry = createAssetRegistry({
    timeoutMs: 10,
    fetchImpl: async (_, { signal }) => { signals.push(signal); return new Promise(() => {}); },
    probeImage: prototypeProbe,
  });
  assert.equal((await courierRegistry.loadCourier('momo')).src, '/assets/couriers/momo/animations/walk.png');
  assert.equal(signals.length, 2);
  assert.ok(signals.every(signal => signal.aborted));
});

test('DOM bindings expose status and stale route resolution cannot overwrite the latest scene', async () => {
  let release;
  const registry = createAssetRegistry({
    assets: {
      'environment.old': { v2: [], fallback: [image('/old', 1, 1)] },
      'environment.new': { v2: [], fallback: [image('/new', 1, 1)] },
    },
    probeImage: src => src === '/old' ? new Promise(resolve => { release = resolve; }) : dimensions(1, 1),
  });
  const element = node('');
  const old = registry.applyScene(element, 'old');
  await Promise.resolve();
  await registry.applyScene(element, 'new');
  release(dimensions(1, 1));
  await old;
  assert.equal(element.src, '/new');
  assert.equal(element.dataset.assetStatus, 'fallback');
});

test('UI backgrounds and image bindings preserve semantic elements and report pending state', async () => {
  const registry = createAssetRegistry({
    assets: {
      skin: { v2: [image('/missing', 1, 1)], fallback: [image('/skin', 1, 1)] },
    },
    probeImage: async src => {
      if (src === '/missing') throw new Error('HTTP 404');
      return dimensions(1, 1);
    },
  });
  const properties = new Map();
  const panel = { ...node('skin'), tagName: 'BUTTON', style: { setProperty: (key, value) => properties.set(key, value) } };
  const portrait = node('skin');
  const root = { dataset: {}, querySelectorAll: () => [panel, portrait] };
  await registry.applyAssets(root);
  assert.equal(panel.style.backgroundImage, 'url("/skin")');
  assert.equal(properties.get('--asset-image'), 'url("/skin")');
  assert.equal(portrait.src, '/skin');
  assert.equal(panel.tagName, 'BUTTON');
  assert.equal(root.dataset.assetsStatus, 'pending-v2');
});

test('default browser probe fetches missing v2 before creating any image URL', async t => {
  const previousImage = globalThis.Image;
  const decoded = [];
  globalThis.Image = class {
    naturalWidth = 384;
    naturalHeight = 384;
    set src(value) { decoded.push(value); queueMicrotask(() => this.onload?.()); }
  };
  t.after(() => {
    if (previousImage === undefined) delete globalThis.Image;
    else globalThis.Image = previousImage;
  });
  const requested = [];
  const registry = createAssetRegistry({
    fetchImpl: async src => {
      requested.push(src);
      return src.includes('/v2/') ? { ok: false, status: 404 }
        : { ok: true, blob: async () => new Blob(['image']) };
    },
  });
  const result = await registry.resolveAsset('courier.momo.portrait');
  assert.equal(result.status, 'pending-v2');
  assert.deepEqual(requested, ['/assets/v2/couriers/momo/portrait.png', '/assets/couriers/momo/portrait.png']);
  assert.equal(decoded.length, 1);
  assert.match(decoded[0], /^blob:/);
});
