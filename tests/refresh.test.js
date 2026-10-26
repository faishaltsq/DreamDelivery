import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAssetRegistry } from '../web/render/assets.js';

test('actual delivered Momo manifest selects its walk atlas, not the single-frame sprite', async () => {
  const manifest=JSON.parse(await readFile('public/assets/v2/couriers/momo/manifest.json','utf8'));
  const registry=createAssetRegistry({
    fetchImpl:async()=>({ok:true,json:async()=>manifest}),
    probeImage:async src=>src.endsWith('/animations/walk.png') ? {naturalWidth:256,naturalHeight:64} : {naturalWidth:64,naturalHeight:64},
  });
  const result=await registry.loadCourier('momo');
  assert.equal(result.src,'/assets/v2/couriers/momo/animations/walk.png');
  assert.equal(result.frames,4); assert.equal(result.degraded,false);
});

test('v1 rollback does not probe delivered v2 candidate art', async () => {
  const probes=[];
  const registry=createAssetRegistry({preferV2:false,probeImage:async src=>{
    probes.push(src); return {naturalWidth:159,naturalHeight:154};
  }});
  const result=await registry.resolveAsset('environment.moonfield',{width:100,height:100});
  assert.equal(result.src,'/assets/environments/moonfield/scene-native.png');
  assert.ok(probes.every(src=>!src.includes('/v2/')));
});

test('mobile delivered environment uses 1280 variant without decoding 2560', async () => {
  const probes=[];
  const registry=createAssetRegistry({probeImage:async src=>{
    probes.push(src); return {naturalWidth:1280,naturalHeight:720};
  }});
  const result=await registry.resolveAsset('environment.moonfield',{width:390,height:700});
  assert.equal(result.src,'/assets/v2/environments/moonfield/background-1280.webp');
  assert.equal(probes.length,1);
});

// --- v2 completeness: every registered path must exist; alternates and unused files stay documented ---
import { test as t2 } from 'node:test';
import { access, readdir } from 'node:fs/promises';
import {
  ASSETS as REG, UNUSED_V2_UI, ENVIRONMENT_ALTERNATES, MOMO_STATE_ANIMATIONS, ART_TOGGLE,
} from '../web/render/assets.js';

const candidates = (asset, layer = 'background') => {
  const source = asset?.layers ? asset.layers[layer] : asset;
  return source ? [...(source.v2 || []), ...(source.fallback || [])] : [];
};

async function exists(publicPath) {
  try { await access(`public${publicPath}`); return true; } catch { return false; }
}

t2('every registered v2 and fallback file exists on disk', async () => {
  const missing = [];
  for (const [id, asset] of Object.entries(REG)) {
    const layers = asset.layers ? Object.keys(asset.layers) : [null];
    for (const layer of layers) {
      for (const candidate of candidates(asset, layer || 'background')) {
        if (!(await exists(candidate.src))) missing.push(`${id}${layer ? `/${layer}` : ''} -> ${candidate.src}`);
      }
    }
  }
  assert.deepEqual(missing, [], `registered paths missing from public/: ${missing.join(', ')}`);
});

t2('supplied alternate environments register as named layers with real geometry', () => {
  const interior = REG['environment.post-office-interior'].layers;
  const moon = REG['environment.moonfield'].layers;
  assert.deepEqual(Object.keys(interior).sort(), ['background', 'interior-alt']);
  assert.deepEqual(Object.keys(moon).sort(), ['background', 'river']);
  for (const [asset, file] of [[interior, 'interior-alt'], [moon, 'river']]) {
    const layer = asset[file];
    assert.equal(layer.v2.length, 2);
    assert.deepEqual(layer.v2.map(v => [v.width, v.height]), [[2560, 1440], [1280, 720]]);
    assert.deepEqual(layer.fallback, [], 'alternates never borrow a different v1 scene');
  }
  assert.match(interior['interior-alt'].v2[0].src, /post-office-interior\/empty-background\.webp$/);
  assert.match(moon.river.v2[0].src, /moonfield\/river-background\.webp$/);
  assert.deepEqual(Object.keys(ENVIRONMENT_ALTERNATES).sort(), ['moonfield', 'post-office-interior']);
});

t2('alternate layers are opt-in: default scene resolution and parallax count stay unchanged', async () => {
  const probes = [];
  const registry = createAssetRegistry({ probeImage: async src => { probes.push(src); return { naturalWidth: 1280, naturalHeight: 720 }; } });
  const result = await registry.resolveAsset('environment.moonfield', { width: 390, height: 700 });
  assert.equal(result.src, '/assets/v2/environments/moonfield/background-1280.webp');
  assert.ok(probes.every(src => !src.includes('river-background')));
  const river = await registry.resolveAsset('environment.moonfield', { width: 390, height: 700, layer: 'river' });
  assert.equal(river.src, '/assets/v2/environments/moonfield/river-background-1280.webp');
  assert.equal(river.layer, 'river');
});

t2('every supplied v2 UI file is either registered or documented as unused, never silently dropped', async () => {
  const files = (await readdir('public/assets/v2/ui')).filter(name => name.endsWith('.svg'));
  const registered = new Set();
  for (const asset of Object.values(REG)) for (const file of asset.v2 || []) registered.add(file.src.split('/').pop());
  const undocumented = files.filter(file => !registered.has(file) && !(file in UNUSED_V2_UI));
  // postcard-frame.svg stays supplied but is mounted as a CSS border-image skin, not through the registry.
  assert.deepEqual(undocumented.filter(f => f !== 'postcard-frame.svg'), [],
    `undocumented supplied UI files: ${undocumented.join(', ')}`);
  for (const file of Object.keys(UNUSED_V2_UI)) {
    assert.ok(files.includes(file), `${file} is documented unused but no longer supplied`);
    assert.ok(UNUSED_V2_UI[file].length > 10, `${file} needs a real reason`);
  }
});

t2('UI entries carry honest quality metadata and a real fallback where CSS does not replace it', () => {
  for (const [id, asset] of Object.entries(REG)) {
    assert.ok(['UPSCALED_PREVIEW_NOT_NATIVE_HD', 'SCALABLE_SVG_V2_DRAFT', 'PROTOTYPE_V1']
      .includes(asset.quality ?? asset.layers?.background?.quality), `${id} quality label`);
    assert.ok(asset.reason, `${id} reason`);
  }
  assert.deepEqual(REG['ui.textarea'].fallback, [], 'textarea skin falls back to a native border');
  assert.ok(REG['ui.input'].fallback.length, 'input keeps a real v1 frame');
});

t2('Momo animates the state each screen actually uses and degrades visibly', async () => {
  const manifest = JSON.parse(await readFile('public/assets/v2/couriers/momo/manifest.json', 'utf8'));
  const probe = async src => /\/animations\/[a-z-]+\.png$/.test(src)
    ? { naturalWidth: 256, naturalHeight: 64 } : { naturalWidth: 64, naturalHeight: 64 };
  const make = () => createAssetRegistry({ fetchImpl: async () => ({ ok: true, json: async () => manifest }), probeImage: probe });
  const journey = await make().loadCourier('momo', 'journey');
  assert.equal(journey.animation, 'walk');
  assert.equal(journey.frames, 4);
  assert.equal(journey.fps, 7);
  assert.deepEqual(journey.anchor, manifest.recommendedAnchor);
  assert.equal(journey.substitute, false);
  assert.equal((await make().loadCourier('momo', 'encounter')).animation, 'reaction');
  assert.equal((await make().loadCourier('momo', 'coda')).animation, 'sleep');
  const idle = await make().loadCourier('momo', 'idle');
  assert.equal(idle.animation, 'idle');
  assert.equal(idle.fps, manifest.animations.idle.fps);
  assert.deepEqual(Object.keys(MOMO_STATE_ANIMATIONS), ['journey', 'encounter', 'coda', 'idle']);
});

t2('a state whose frames are missing substitutes the walk atlas with a visible reason', async () => {
  const manifest = JSON.parse(await readFile('public/assets/v2/couriers/momo/manifest.json', 'utf8'));
  delete manifest.animations.sleep;
  const registry = createAssetRegistry({
    fetchImpl: async () => ({ ok: true, json: async () => manifest }),
    probeImage: async src => src.includes('/animations/') ? { naturalWidth: 256, naturalHeight: 64 } : { naturalWidth: 64, naturalHeight: 64 },
  });
  const result = await registry.loadCourier('momo', 'coda');
  assert.equal(result.src, '/assets/v2/couriers/momo/animations/walk.png');
  assert.equal(result.animation, 'walk');
  assert.equal(result.substitute, true);
  assert.match(result.reason, /state-missing:sleep/);
});

t2('a missing v2 atlas file falls back to the real v1 walk instead of locking progress', async () => {
  const manifest = JSON.parse(await readFile('public/assets/v2/couriers/momo/manifest.json', 'utf8'));
  const v1 = JSON.parse(await readFile('public/assets/couriers/momo/animations.json', 'utf8'));
  const registry = createAssetRegistry({
    fetchImpl: async src => src.includes('/v2/') ? { ok: true, json: async () => manifest } : { ok: true, json: async () => v1 },
    probeImage: async src => src.includes('/v2/') ? Promise.reject(new Error('HTTP 404')) : { naturalWidth: 256, naturalHeight: 64 },
  });
  const result = await registry.loadCourier('momo', 'journey');
  assert.equal(result.src, '/assets/couriers/momo/animations/walk.png');
  assert.equal(result.degraded, true);
  assert.equal(result.quality, 'PROTOTYPE_V1');
});

t2('art toggle stays a URL parameter and never becomes visible chrome', () => {
  assert.equal(ART_TOGGLE.param, 'art');
  assert.equal(ART_TOGGLE.read('?art=v2'), true);
  assert.equal(ART_TOGGLE.read('?art=v1'), false);
  assert.equal(ART_TOGGLE.read(''), false);
  assert.equal(ART_TOGGLE.read(undefined), false);
});
