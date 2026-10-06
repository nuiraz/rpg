const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--lang=fr-FR'] });
  const page = await browser.newPage();
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => failed.push(r.url() + ' ' + r.failure().errorText));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url() + ' HTTP ' + r.status()); });
  await page.emulateTimezone('Europe/Brussels');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
  const hud = await page.evaluate(() => { const h = id => document.getElementById(id).innerText; return ({ lvl: h('h-lvl'), rank: h('h-rank'), gold: h('h-gold'), hp: h('t-hp'), en: h('t-en'), xp: h('t-xp'), chips: h('chips'), log: document.querySelector('.entry').innerText.slice(0, 200) }); });
  function h(){} // placeholder
  console.log('HUD', JSON.stringify(hud));
  // run a sequence via the real buttons
  const clickCmd = async (tabId, label) => {
    await page.click(`[data-tab="${tabId}"]`);
    const btns = await page.$$('.cmd-btn');
    for (const b of btns) { const t = await b.$eval('.lb', e => e.textContent); if (t === label) { await b.click(); return true; } }
    throw new Error('no button ' + label);
  };
  const lastEntry = () => page.$eval('.entry', e => e.innerText);
  const steps = [];
  for (const [tabId, label] of [['recolter', 'Bois'], ['recolter', 'Herbe'], ['recolter', 'Pierre'], ['combat', 'Combattre'], ['marche', 'Prix du jour'], ['quetes', 'Quêtes'], ['perso', 'Stats']]) {
    await clickCmd(tabId, label); await new Promise(r => setTimeout(r, 250));
    const vid = await page.$eval('#scene', v => ({ src: v.src.split('/').pop(), paused: v.paused, muted: v.muted, err: v.error && v.error.code }));
    steps.push({ label, vid, text: (await lastEntry()).split('\n').slice(0, 3).join(' | ') });
  }
  // picker: craft
  await clickCmd('recolter', 'Fabriquer'); await page.waitForSelector('#sheet:not(.hidden)');
  const opts = await page.$$eval('.opt', os => os.map(o => o.innerText.split('\n')[0] + (o.classList.contains('ok') ? ' [ok]' : '')));
  steps.push({ label: 'craft picker', opts });
  await page.click('#sheet-x');
  // picker: vendre -> first item -> qty
  await clickCmd('marche', 'Vendre'); await page.waitForSelector('#sheet:not(.hidden)');
  const sellOpts = await page.$$eval('.opt', os => os.map(o => o.innerText.replace(/\n/g, ' ')));
  steps.push({ label: 'sell picker', sellOpts });
  await page.screenshot({ path: '/workspace/rpg-web/test/screenshot-picker.png' });
  await page.click('#sheet-x');
  // combat sequence check: video should go combat -> victoire/mort
  await clickCmd('combat', 'Combattre');
  const seq1 = await page.$eval('#scene', v => v.src.split('/').pop());
  await new Promise(r => setTimeout(r, 2600));
  const seq2 = await page.$eval('#scene', v => v.src.split('/').pop());
  steps.push({ label: 'combat video sequence', seq: [seq1, seq2], text: (await lastEntry()).split('\n').slice(0, 4).join(' | ') });
  for (const s of steps) console.log(JSON.stringify(s));
  // final screenshot in clean-ish state: go to Récolter tab, scroll log top
  await page.click('[data-tab="recolter"]');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: '/workspace/rpg-web/screenshot.png' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rpg_nathan_save')));
  console.log('localStorage save lvl/or/energy/kills:', saved.lvl, saved.or, saved.energy, saved.kills);
  // desktop
  const p2 = await browser.newPage(); p2.on('pageerror', e => errors.push('pageerror(desktop): ' + e.message));
  await p2.setViewport({ width: 1366, height: 800 });
  await p2.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  await p2.screenshot({ path: '/workspace/rpg-web/test/screenshot-desktop.png' });
  const sw = await p2.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; });
  console.log('service worker registered:', sw);
  console.log('ERRORS:', errors.length ? errors : 'none');
  console.log('FAILED REQUESTS:', failed.length ? failed : 'none');
  await browser.close();
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
