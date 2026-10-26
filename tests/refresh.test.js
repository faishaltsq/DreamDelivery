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
