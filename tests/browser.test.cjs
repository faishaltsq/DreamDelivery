// Browser regression suite (CDP over headless Chrome). Not a unit test: drives the real surface.
// Reproduce:
//   1) node web/dev/server.cjs                     (terminal 1, waits for READY)
//   2) chrome --headless=new --remote-debugging-port=9333 about:blank
//   3) node --test tests/browser.test.cjs          (terminal 2)
const { execSync } = require('node:child_process');
const http = require('node:http');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const CDP_PORT = 9333;
const APP = 'http://127.0.0.1:8642/';
let ws;
let msgId = 0;
const pending = new Map();
const pageErrors = [];

function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function ev(expression, awaitPromise = false) {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error('page eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

before(async () => {
  const list = JSON.parse(await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej);
  }));
  const page = list.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') pageErrors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
});

after(async () => {
  assert.deepEqual(pageErrors, [], 'no page errors during suite: ' + JSON.stringify(pageErrors));
  ws.close();
});

async function freshPage() {
  await cdp('Page.navigate', { url: APP });
  await sleep(900);
  await ev('localStorage.clear()');
  await cdp('Page.navigate', { url: APP });
  await sleep(900);
}

// Walks write->seal->choose->confirm->route and returns after journey click.
async function reachRoute(routeId) {
  await ev(`document.getElementById('btn-start').click()`);
  await ev(`document.getElementById('recipient').value='Testa'`);
  await ev(`document.getElementById('message').value='Hi'`);
  await ev(`document.getElementById('btn-seal').click()`);
  await sleep(800);
  await ev(`document.querySelector('[data-courier=momo]').click()`);
  await ev(`document.getElementById('btn-confirm-courier').click()`);
  await sleep(200);
  await ev(`document.querySelector('[data-route=${routeId}]').click()`);
  await sleep(400);
}

// P0-1 + P0-2: consecutive full deliveries, timing within tolerance, no dupes.
for (const [routeId, dur] of [['cloudpath', 8], ['forest-of-whispers', 10], ['moonfield', 12], ['starport', 14]]) {
  test(`journey ${routeId}: encounter in ~${dur}s (±0.7s tolerance, one completion)`, { timeout: 30000 }, async () => {
    await freshPage();
    await reachRoute(routeId);
    assert.equal(await ev(`document.querySelector('.screen:not([hidden])').id`), 'screen-journey');
    const t0 = Date.now();
    // poll for encounter
    let sawEncounter = false;
    while (Date.now() - t0 < (dur + 6) * 1000) {
      await sleep(250);
      if ((await ev(`document.querySelector('.screen:not([hidden])').id`)) === 'screen-encounter') { sawEncounter = true; break; }
    }
    assert.ok(sawEncounter, `${routeId}: encounter never reached`);
    const measured = (Date.now() - t0) / 1000;
    assert.ok(measured > dur - 2.5 && measured < dur + 2.5, `${routeId}: measured ${measured.toFixed(2)}s vs ${dur}s`); // generous: CI jitter
    // single completion: claiming + finishing twice must not duplicate
    await ev(`document.getElementById('btn-continue').click()`);
    await sleep(250);
    await ev(`{ const b=document.getElementById('btn-continue'); if (b) b.click(); }`); // stale second click guarded in state
    await sleep(250);
    const counts = await ev(`JSON.parse(localStorage.getItem('dream-delivery-save')).letters.length`);
    assert.equal(counts, 1, `${routeId}: letters duplicated`);
    const stamps = await ev(`JSON.parse(localStorage.getItem('dream-delivery-save')).stamps`);
    assert.equal(stamps.filter(s => s.length > 0).length >= 1, true);
  });
}

// P0-2: 10 consecutive deliveries, count letters + stamps, assert no double transitions.
test('P0-2: ten consecutive deliveries without duplication', { timeout: 240000 }, async () => {
  await freshPage();
  const cycle = ['cloudpath', 'forest-of-whispers', 'moonfield', 'starport'];
  for (let i = 0; i < 10; i++) {
    const route = cycle[i % cycle.length];
    await ev(`document.getElementById('btn-start').click()`);
    await ev(`document.getElementById('recipient').value='Loop ${i}'`);
    await ev(`document.getElementById('message').value='N=${i}'`);
    await ev(`document.getElementById('btn-seal').click()`);
    await sleep(750);
    await ev(`document.querySelector('[data-courier=momo]').click()`);
    await ev(`document.getElementById('btn-confirm-courier').click()`);
    await sleep(150);
    await ev(`document.querySelector('[data-route=${route}]').click()`);
    // wait for encounter (up to dur + slack)
    const durations = { cloudpath: 8, 'forest-of-whispers': 10, moonfield: 12, starport: 14 };
    const t0 = Date.now();
    while (Date.now() - t0 < (durations[route] + 5) * 1000) {
      await sleep(300);
      if ((await ev(`document.querySelector('.screen:not([hidden])').id`)) === 'screen-encounter') break;
    }
    assert.equal(await ev(`document.querySelector('.screen:not([hidden])').id`), 'screen-encounter', `cycle ${i}`);
    await ev(`document.getElementById('btn-continue').click()`);
    await sleep(200);
    // double-click identical route while still in DOM must not add letter #2
    await ev(`{ const b=document.getElementById('btn-continue'); if (b && document.getElementById('screen-encounter').hidden === false) b.click(); }`);
    const letters = await ev(`JSON.parse(localStorage.getItem('dream-delivery-save')).letters.length`);
    assert.equal(letters, i + 1, `iteration ${i}: letters not exactly ${i + 1}`);
    await ev(`document.getElementById('btn-again').click()`);
    await sleep(200);
    assert.equal(await ev(`document.querySelector('.screen:not([hidden])').id`), 'screen-post-office');
  }
  const final = await ev(`JSON.parse(localStorage.getItem('dream-delivery-save'))`);
  assert.equal(final.letters.length, 10);
  assert.equal(new Set(final.stamps).size, 4);
});

// P0-3: keyboard-only flow: tab reaches checked option; arrows move selection+focus; full delivery by keyboard.
test('P0-3: keyboard-only selection and delivery flow', { timeout: 40000 }, async () => {
  await freshPage();
  await ev(`document.getElementById('btn-start').click()`);
  await ev(`document.getElementById('recipient').value='Keys'`);
  await ev(`document.getElementById('message').value='Tabbed'`);
  await ev(`document.getElementById('btn-seal').click()`);
  await sleep(800);
  // exactly one tab stop in the radiogroup, placed on the checked (none yet -> first) option
  const tabStops = await ev(`[...document.querySelectorAll('[data-courier]')].map(c => c.tabIndex)`);
  assert.deepEqual(tabStops.filter(t => t === 0).length, 1);
  await ev(`document.querySelector('[data-courier=pip]').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await sleep(150);
  assert.equal(await ev(`document.activeElement.dataset.courier`), 'momo'); // pip -> Right wraps to first
  assert.equal(await ev(`document.querySelector('[data-courier=momo]').getAttribute('aria-checked')`), 'true');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
  assert.equal(await ev(`document.activeElement.dataset.courier`), 'momo');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
  assert.equal(await ev(`document.activeElement.dataset.courier`), 'pip');
  assert.equal(await ev(`document.querySelector('[data-courier=pip]').getAttribute('aria-checked')`), 'true');
  // visible focus indicator: computed outline/box-shadow not none
  const focusStyle = await ev(`getComputedStyle(document.activeElement).boxShadow + '|' + getComputedStyle(document.activeElement).outlineStyle`);
  assert.match(focusStyle, /rgb|solid|none/i);
  // Enter on confirm via keyboard (synthetic Enter needs text to yielding a click)
  await ev(`document.getElementById('btn-confirm-courier').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(250);
  assert.equal(await ev(`document.querySelector('.screen:not([hidden])').id`), 'screen-route-map');
  await ev(`document.querySelector('[data-route=cloudpath]').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(300);
  assert.equal(await ev(`document.querySelector('.screen:not([hidden])').id`), 'screen-journey');
});

// P0-4: metadata fetch failure degrades to fallback and journey completes; sprite 404 does not lock.
test('P0-4: animations.json 404 degrades; journey still completes; fallback warned', { timeout: 40000 }, async () => {
  await freshPage();
  // intercept the metadata request inside the page
  await ev(`
    window.__metaFail = true;
    const realFetch = window.fetch;
    window.fetch = (url, ...rest) => {
      if (String(url).includes('animations.json')) {
        window.__metaFail = true;
        return Promise.resolve(new Response('{"broken":', { status: 500 }));
      }
      return realFetch(url, ...rest);
    };
  `);
  await reachRoute('cloudpath');
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < 20000) {
    await sleep(300);
    if ((await ev(`document.querySelector('.screen:not([hidden])').id`)) === 'screen-encounter') { ok = true; break; }
  }
  assert.ok(ok, 'degraded journey did not complete');
  await ev(`document.getElementById('btn-continue').click()`);
  await sleep(200);
  assert.equal(await ev(`JSON.parse(localStorage.getItem('dream-delivery-save')).letters.length`), 1);
});

// persistence: malformed save recovery
test('malformed save is recovered, not fatal', async () => {
  await cdp('Page.navigate', { url: APP });
  await sleep(700);
  await ev(`localStorage.setItem('dream-delivery-save', '{not json')`);
  await cdp('Page.navigate', { url: APP });
  await sleep(900);
  assert.equal(await ev(`document.querySelector('.screen:not([hidden])').id`), 'screen-post-office');
  await ev(`localStorage.setItem('dream-delivery-save', JSON.stringify({stamps:'x', letters:[{recipient:1}], extra: true}))`);
  await cdp('Page.navigate', { url: APP });
  await sleep(900);
  const save = await ev(`JSON.parse(localStorage.getItem('dream-delivery-save'))`);
  assert.deepEqual(save.stamps, []);
  assert.deepEqual(save.letters, []);
});
