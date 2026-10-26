// Real-browser regression + screenshot runner. No third-party dependencies.
// node tests/reconstruction.cjs [--update]; CHROME_PATH overrides the local Chrome binary.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const previewV2 = process.argv.includes('--v2');
const APP = `http://127.0.0.1:8642/${previewV2 ? '?art=v2' : ''}`;
const PORT = 9444;
const output = path.resolve(previewV2 ? 'qa/reconstruction-v2' : 'qa/reconstruction');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dream-qa-'));
const chromePath = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
let server, chrome, ws;
let seq = 0;
const pending = new Map();
const exceptions = [];
const results = { screenshots: [], checks: [], failures: [] };
const delay = ms => new Promise(r => setTimeout(r, ms));
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(60); }
  throw new Error(`Timed out: ${expression}`);
}
async function click(selector) {
  await until(`!!document.querySelector(${JSON.stringify(selector)})`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
async function navigate() {
  await send('Page.navigate', { url: APP });
  await until(`!!document.getElementById('btn-start') && !!document.querySelector('#screen-post-office:not([hidden])')`);
  await delay(300);
}
async function compose() {
  await click('#btn-start');
  await evaluate(`document.getElementById('recipient').value='Luna of the Hill Farm'; document.getElementById('message').value='May your harvest moon rise slowly. '+ 'A'.repeat(100)`);
}
async function choose(route = 'moonfield') {
  await click('#btn-seal');
  await click('[data-courier="momo"]');
  await click('#btn-confirm-courier');
  await click(`[data-route="${route}"]`);
}
async function inspect(name, width) {
  await delay(200);
  const issues = await evaluate(`(() => {
    const screen = document.querySelector('.screen:not([hidden])');
    const W = innerWidth, H = innerHeight;
    const controls = [...screen.querySelectorAll('button,input,textarea')].filter(e => e.getClientRects().length);
    const issues = [];
    for (const e of controls) {
      const r = e.getBoundingClientRect();
      if (r.left < -1 || r.right > W+1) issues.push('horizontal control overflow: '+e.id);
      if (r.height < 44-0.5) issues.push('small target: '+e.id+' '+r.height);
      if (e.scrollWidth > e.clientWidth+2 && e.tagName === 'BUTTON') issues.push('clipped button: '+e.id);
    }
    for (let i=0;i<controls.length;i++) for(let j=i+1;j<controls.length;j++) {
      const a=controls[i].getBoundingClientRect(), b=controls[j].getBoundingClientRect();
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2) issues.push('overlap: '+controls[i].id+'/'+controls[j].id);
    }
    for (const img of screen.querySelectorAll('img')) {
      if(getComputedStyle(img).display==='none') continue;
      if(img.complete && !img.naturalWidth) issues.push('broken image: '+img.getAttribute('src'));
      if(img.classList.contains('scene-bg') && getComputedStyle(img).imageRendering !== 'auto') issues.push('pixelated painting');
    }
    if(document.documentElement.scrollWidth>W+1) issues.push('horizontal document overflow');
    return issues;
  })()`);
  results.checks.push({ name, width, issues });
  for (const issue of issues) results.failures.push(`${width}/${name}: ${issue}`);
  const file = `${width}-${name}.png`;
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, file), Buffer.from(screenshot.data, 'base64'));
  results.screenshots.push(file);
}
async function press(key, code, value, text) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: value, ...(text ? { text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: value });
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  try { await fetch(APP); } catch { server = spawn(process.execPath, ['web/dev/server.cjs'], { stdio: 'ignore' }); await delay(1000); }
  chrome = spawn(chromePath, ['--headless=new','--disable-gpu',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'], { stdio: 'ignore' });
  let targets;
  for(let i=0;i<100;i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; } catch { await delay(100); } }
  assert.ok(targets, 'Chrome CDP must start');
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = event => {
    const m = JSON.parse(event.data);
    if(m.id && pending.has(m.id)) { const p=pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    if(m.method==='Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  };
  await send('Page.enable'); await send('Runtime.enable');
  for(const [width,height] of [[390,844],[768,1024],[1440,900],[1920,1080]]) {
    await send('Emulation.setDeviceMetricsOverride', { width,height,deviceScaleFactor:1,mobile:false });
    await navigate();
    await inspect('post-office',width);
    await click('#btn-album'); await inspect('stamp-album',width); await click('#btn-album-back');
    await compose(); await inspect('write-letter',width);
    await click('#btn-seal'); await inspect('courier-selection',width);
    await click('[data-courier="momo"]'); await click('#btn-confirm-courier'); await inspect('route-selection',width);
    await click('[data-route="moonfield"]');
    await until(`document.querySelector('#courier-stage canvas') && !document.querySelector('.courier-loading-label')`);
    const sync = await evaluate(`(() => { const p=Number(document.querySelector('#courier-stage').dataset.progress); return {p,bar:parseFloat(document.querySelector('#journey-bar').style.width)/100,left:parseFloat(document.querySelector('#courier-stage').style.left),width:document.querySelector('#courier-stage').closest('.scene').clientWidth}; })()`);
    assert.ok(Math.abs(sync.p-sync.bar)<0.001, 'clock and bar synchronized');
    if (previewV2) {
      await until(`document.getElementById('journey-bg').dataset.assetStatus === 'v2'`);
      assert.ok((await evaluate(`document.getElementById('journey-bg').src`)).includes('/assets/v2/'));
    }
    assert.ok(Math.abs(sync.left-Math.round(sync.width*(0.14+sync.p*0.72)))<2,'pixel position synchronized');
    await inspect('journey',width);
    await until(`!document.getElementById('screen-encounter').hidden`,17000);
    await inspect('encounter',width);
    await click('#btn-continue'); await inspect('story-postcard',width);
    console.log(`Captured eight screens at ${width}x${height}`);
  }
  // Accelerated rAF tests simulate elapsed frames; normal-duration screenshots above run in real time.
  await navigate();
  await evaluate(`localStorage.clear()`); await navigate();
  await evaluate(`(() => { const real=requestAnimationFrame; let t=performance.now(); window.requestAnimationFrame=cb=>real(()=>{t+=250;cb(t)}); window.__sfx=[]; HTMLMediaElement.prototype.play=function(){window.__sfx.push(this.src.split('/').pop());return Promise.resolve()}; })()`);
  await click('#btn-audio');
  for(let i=0;i<10;i++) {
    await compose(); await choose('cloudpath');
    await until(`!document.getElementById('screen-encounter').hidden`,10000);
    await evaluate(`window.__sfx=[]; document.getElementById('btn-continue').click();document.getElementById('btn-continue').click()`);
    const transaction=await evaluate(`({save:JSON.parse(localStorage.getItem('dream-delivery-save')),sounds:window.__sfx})`);
    assert.equal(transaction.save.letters.length,i+1,'one letter per transaction');
    assert.deepEqual(transaction.sounds,['stamp.wav','arrival.wav'],'one SFX pair per transaction');
    await click('#btn-again');
    assert.equal(await evaluate(`document.querySelectorAll('#courier-stage canvas').length`),0);
  }
  results.checks.push({name:'ten-deliveries-and-double-click-sfx',pass:true});
  await navigate(); await compose(); await click('#btn-seal');
  await press('Tab','Tab',9);
  assert.equal(await evaluate(`document.activeElement.dataset.courier`),'momo');
  await press('End','End',35); assert.equal(await evaluate(`document.activeElement.dataset.courier`),'pip');
  await press('Home','Home',36); assert.equal(await evaluate(`document.activeElement.dataset.courier`),'momo');
  await press('Tab','Tab',9); await press('Enter','Enter',13,'\r');
  assert.equal(await evaluate(`document.getElementById('screen-route-map').hidden`),false);
  results.checks.push({name:'keyboard-tab-home-end-confirm',pass:true});
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate();
  await evaluate(`(() => { const real=fetch; window.fetch=(url,...args)=> /animations\\.json|animations\\/walk\\.png/.test(String(url)) ? Promise.resolve(new Response('',{status:503})) : real(url,...args); const raf=requestAnimationFrame;let t=performance.now();window.requestAnimationFrame=cb=>raf(()=>{t+=150;cb(t)}); })()`);
  await compose(); await choose('cloudpath');
  await until(`document.querySelector('.courier-loading-label')?.textContent.includes('could not load')`,5000);
  assert.equal(await evaluate(`parseFloat(document.getElementById('courier-stage').style.left)`), 960, 'reduced-motion courier stays centered');
  await until(`!document.getElementById('screen-encounter').hidden`,10000);
  await click('#btn-continue');
  assert.equal(await evaluate(`document.getElementById('screen-postcard').hidden`),false);
  results.checks.push({name:'missing-metadata-and-atlas-do-not-lock-reduced-motion',pass:true});
  await send('Emulation.setEmulatedMedia', { features: [] });
  assert.deepEqual(exceptions,[],'no uncaught browser exceptions');
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
  const images=results.screenshots.map(file=>`<figure><img src="${file}"><figcaption>${file}</figcaption></figure>`).join('');
  fs.writeFileSync(path.join(output,'comparison.html'),`<!doctype html><title>Dream Delivery visual review</title><style>body{font:16px system-ui;background:#141d38;color:#fff5e8;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}img{max-width:100%}figure{margin:0}header img{max-width:1000px}</style><header><h1>Approved master reference</h1><img src="../../DreamDelivery_AssetPack_Prototype_v1/DreamDelivery_ArtPack_v0.1/references/master-original.png"><p>Compare composition, visible environment area, portrait registration, legibility and painting/sprite separation. Palette similarity is not visual fidelity.</p></header><main>${images}</main>`);
  assert.deepEqual(results.failures,[], 'layout findings: '+results.failures.join('; '));
  console.log(`PASS: ${results.screenshots.length} screenshots; layout, clock-position sync, 10 deliveries, SFX dedup, keyboard.`);
}
main().catch(error => { console.error(error); process.exitCode=1; fs.mkdirSync(output,{recursive:true}); fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...results,error:String(error)},null,2)); }).finally(async()=>{
  ws?.close(); chrome?.kill(); server?.kill();
});
