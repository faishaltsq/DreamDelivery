import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpriteAnimator } from '../web/render/sprites.js';
import { loadJourneyMeta } from '../web/game/assetMeta.js';

function harness() {
  let frames = new Map(), id = 0;
  const images = [];
  globalThis.requestAnimationFrame = callback => { frames.set(++id,callback); return id; };
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  globalThis.matchMedia = () => ({ matches: false });
  const context = { clearRect(){},drawImage(){} };
  globalThis.document = { createElement: () => ({ style:{},getContext:()=>context,remove(){this.removed=true;} }) };
  globalThis.Image = class {
    constructor(){ images.push(this); }
    set src(value){this.url=value;}
  };
  const container = { style:{},append(){},closest:()=>({clientWidth:1440}) };
  return { images, container, frames };
}

test('successful atlas invokes ready once with exact natural dimensions and pixel scale', () => {
  const {images,container} = harness();
  let ready=0,errors=0;
  const sprite=new SpriteAnimator({src:'/walk.png',frames:4,frameWidth:64,frameHeight:64,fps:7,onReady:()=>ready++,onError:()=>errors++}).mount(container);
  Object.assign(images[0],{naturalWidth:256,naturalHeight:64}); images[0].onload();
  assert.equal(ready,1); assert.equal(errors,0);
  assert.equal(sprite.el.style.width,'192px'); assert.equal(container.style.marginLeft,'-96px');
  sprite.destroy(); assert.equal(sprite.el.removed,true);
});
test('corrupt atlas dimensions call error rather than drawing an invalid frame', () => {
  const {images,container}=harness(); let error=0;
  const sprite=new SpriteAnimator({src:'/bad.png',frames:4,frameWidth:64,frameHeight:64,onError:()=>error++}).mount(container);
  Object.assign(images[0],{naturalWidth:128,naturalHeight:128}); images[0].onload();
  assert.equal(error,1); assert.equal(sprite.loaded,false);
  sprite.destroy();
});
test('destroy before image response prevents stale ready/error callbacks and cancels frames', () => {
  const {images,container,frames}=harness(); let ready=0;
  const sprite=new SpriteAnimator({src:'/slow.png',frames:4,onReady:()=>ready++}).mount(container);
  sprite.destroy(); assert.equal(images[0].onload,null); assert.equal(images[0].onerror,null);
  assert.equal(frames.size,0); assert.equal(ready,0);
});
test('nonresolving metadata request times out to documented fallback', async () => {
  const result=await loadJourneyMeta(()=>new Promise(()=>{}),'momo',{timeout:10});
  assert.equal(result.degraded,true); assert.equal(result.walk.frames,4);
});
test('corrupt frame rate, dimensions or source path cannot enter animator', async () => {
  for(const patch of [{fps:0},{frames:-1},{frameHeight:NaN},{file:'../../secret.png'}]) {
    const result=await loadJourneyMeta(async()=>({ok:true,json:async()=>({animations:{walk:{file:'animations/walk.png',frames:4,fps:7,frameWidth:64,frameHeight:64,...patch}}})}),'momo');
    assert.equal(result.degraded,true);
  }
});
