// Visual QA: capture 8 screens at 390/768/1440 widths into shots/vqa/.
// Reproduce: server + chrome running (see tests/browser.test.cjs header), then `node tests/visual-qa.cjs`
const http = require('node:http');
const fs = require('node:fs');

let msgId = 0;
const pending = new Map();

function cdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const list = JSON.parse(await new Promise((res, rej) => {
    http.get('http://127.0.0.1:9333/json/list', (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej);
  }));
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
  };
  const send = (m, p) => cdp(ws, m, p);
  const ev = async (x) => {
    const r = await send('Runtime.evaluate', { expression: x, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || x);
    return r.result.value;
  };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  await send('Page.enable');
  await send('Runtime.enable');

  const widths = [['390-mobile', 390, 844, 2, true], ['768-tablet', 768, 1024, 1, false], ['1440-desktop', 1440, 900, 1, false]];
  fs.mkdirSync('shots/vqa', { recursive: true });

  for (const [wName, w, h, dsf, mobile] of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile });
    await send('Page.navigate', { url: 'http://127.0.0.1:8642/' });
    await sleep(900);
    await ev(`localStorage.clear()`);
    await send('Page.navigate', { url: 'http://127.0.0.1:8642/' });
    await sleep(900);

    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`shots/vqa/${wName}-${name}.png`, Buffer.from(r.data, 'base64'));
      console.log('shot', wName, name);
    };

    // 1 post office
    await shot('1-post-office');
    await ev(`document.getElementById('btn-album').click()`); await sleep(250);
    await shot('8-stamp-album');
    await ev(`document.getElementById('btn-album-back').click()`); await sleep(200);
    await ev(`document.getElementById('btn-start').click()`); await sleep(250);
    await ev(`document.getElementById('recipient').value='Luna'`);
    await ev(`document.getElementById('message').value='May your harvest moon rise slowly.'`);
    // 2 write
    await shot('2-write-letter');
    await ev(`document.getElementById('btn-seal').click()`); await sleep(900);
    // 3 courier selection
    await ev(`document.querySelector('[data-courier=momo]').click()`); await sleep(200);
    await shot('3-courier-selection');
    await ev(`document.getElementById('btn-confirm-courier').click()`); await sleep(250);
    // 4 route selection
    await shot('4-route-selection');
    await ev(`document.querySelector('[data-route=moonfield]').click()`); await sleep(450);
    // 5 journey tracker
    await shot('5-journey-tracker');
    // wait for encounter (12s route)
    const t0 = Date.now();
    while (Date.now() - t0 < 18000) {
      await sleep(300);
      if ((await ev(`document.querySelector('.screen:not([hidden])').id`)) === 'screen-encounter') break;
    }
    // 6 encounter
    await shot('6-encounter');
    await ev(`document.getElementById('btn-continue').click()`); await sleep(350);
    // 7 postcard
    await shot('7-story-postcard');
  }
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('VQA_FAIL', e); process.exit(1); });
