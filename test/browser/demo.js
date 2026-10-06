// Enregistre une courte démo (récolte + combat contre le dragon + passage de niveau) -> frames JPEG + horodatage, puis ffmpeg.
const puppeteer = require('puppeteer-core'); const fs = require('fs');
const URL = process.env.URL || 'http://127.0.0.1:8765/'; const DIR = process.env.DIR || '/tmp/demo/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.emulateTimezone('Europe/Brussels');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  const base = await page.evaluate(() => window.RPG_DEFAULT_SAVE);
  const save = Object.assign({}, base, { lvl: 6, xp: 250, maxhp: 190, hp: 190, or: 1450, sword: 'epee_fer', armor: 'armure_fer', pick: 'pioche_fer', energy: 50, etime: Date.now() / 1000, kills: 40, mined: 120,
    inv: { bois: 12, fer: 8, diamant: 3, herbe: 9, cuir: 6, cristal: 2, potion: 2, pierre: 10 }, ach: ['Premier sang', 'Bûcheron', 'Chasseur'] });
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('rpg_nathan_save', JSON.stringify(s)); localStorage.setItem('rpg_nathan_tuto', '1'); }, save);
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(800);
  const cdp = await page.createCDPSession(); const frames = [];
  cdp.on('Page.screencastFrame', async f => { frames.push(f.metadata.timestamp); fs.writeFileSync(DIR + String(frames.length).padStart(5, '0') + '.jpg', Buffer.from(f.data, 'base64')); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  await sleep(1500);
  await page.click('.spot[data-id="foret"]'); await sleep(700);
  await page.click('.cmd-btn[data-c="minefer"]'); await sleep(3600);
  if (await page.$('#lvlup:not(.hidden)')) { await page.click('#lvlup'); await sleep(800); }
  await page.click('[data-tab="combat"]'); await sleep(600);
  await page.click('.cmd-btn[data-c="boss"]');
  await page.waitForFunction(() => !document.getElementById('lvlup').classList.contains('hidden') || !document.getElementById('skip').offsetParent, { timeout: 40000 });
  await sleep(4200);
  if (await page.$('#lvlup:not(.hidden)')) { await page.click('#lvlup'); await sleep(2500); }
  await cdp.send('Page.stopScreencast'); await sleep(300);
  // fichier concat ffmpeg avec la durée réelle de chaque image
  let txt = ''; for (let i = 0; i < frames.length; i++) { const d = i < frames.length - 1 ? frames[i + 1] - frames[i] : 0.5; txt += `file '${String(i + 1).padStart(5, '0')}.jpg'\nduration ${Math.max(0.001, d).toFixed(4)}\n`; }
  txt += `file '${String(frames.length).padStart(5, '0')}.jpg'\n`;
  fs.writeFileSync(DIR + 'list.txt', txt); console.log('frames', frames.length, 'durée', (frames[frames.length - 1] - frames[0]).toFixed(1) + 's');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
