// Test complet v2 (Chrome headless, écran de téléphone) : migration de sauvegarde, tutoriel, carte, combat animé,
// récolte, passage de niveau + toasts, réglages, fiche, calendrier, résumé d'absence, tous les boutons, mode animations réduites.
// Usage : site servi sur http://127.0.0.1:8765 puis `node v2.js` (puppeteer-core requis).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const OUT = '/workspace/rpg-web/test/shots/';
const URL = process.env.URL || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'OK ' : 'FAIL', name, info]); };
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
  await page.emulateTimezone('Europe/Brussels');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const base = JSON.parse(fs.readFileSync(__dirname + '/../../js/default-save.js', 'utf8').match(/RPG_DEFAULT_SAVE=(\{.*\});/)[1]);
  // écrit le localStorage AVANT le chargement de la page (le snapshot fait à la fermeture de la page précédente ne l'écrase pas)
  const setLSfresh = async kv => { await page.evaluateOnNewDocument(kv => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } }, kv); await page.evaluate(() => sessionStorage.removeItem('__seeded')); await page.reload({ waitUntil: 'networkidle0' }); await sleep(500); };
  const setLS = async (kv, clear = true) => { await page.evaluate((kv, clear) => { if (clear) localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, kv, clear); await page.reload({ waitUntil: 'networkidle0' }); await sleep(500); };
  const ev = f => page.evaluate(f);

  // 1) migration depuis la v1 : mêmes clés, ancien bouton muet
  await page.goto(URL, { waitUntil: 'networkidle0' });
  const oldSave = Object.assign({}, base, { or: 999, lvl: 4, xp: 10, maxhp: 145, hp: 140 });
  await setLS({ rpg_nathan_save: JSON.stringify(oldSave), rpg_nathan_muted: '1', rpg_nathan_tab: 'marche',
    rpg_nathan_log: JSON.stringify([{ label: '⚔️ Ancienne entrée', text: '🏆 Victoire ! (v1)', col: '#c8463c', time: '09:00' }]) });
  const mig = await ev(() => ({ gold: document.getElementById('h-gold').textContent, lvl: document.getElementById('h-lvl').textContent, sound: window.__rpg.settings.sound,
    tab: document.querySelector('.tab.on').dataset.tab, log: document.getElementById('log').innerText.includes('Ancienne entrée'), saved: JSON.parse(localStorage.getItem('rpg_nathan_save')),
    tuto: !document.getElementById('tuto').classList.contains('hidden') }));
  ok('migration: or et niveau repris', mig.gold === '999' && mig.lvl === '4', `or=${mig.gold} niv=${mig.lvl}`);
  ok('migration: son coupé repris depuis rpg_nathan_muted', mig.sound === false);
  ok('migration: onglet + journal repris', mig.tab === 'marche' && mig.log);
  ok('migration: sauvegarde non modifiée au chargement', JSON.stringify(mig.saved) === JSON.stringify(oldSave));
  ok('tutoriel affiché à la première visite v2', mig.tuto);
  await sleep(400); await page.screenshot({ path: OUT + '01-tutoriel.png' });
  await page.click('.tnext'); await sleep(450); await page.click('.tnext'); await sleep(450); await page.screenshot({ path: OUT + '02-tutoriel-etape3.png' });
  await page.click('.tskip'); await sleep(300);
  ok('tutoriel mémorisé', await ev(() => localStorage.getItem('rpg_nathan_tuto') === '1'));

  // 2) écran principal (carte) avec la sauvegarde d'origine de Nathan
  await setLS({ rpg_nathan_tuto: '1', rpg_nathan_settings: JSON.stringify({ sound: true, music: false, vibrate: true, video: 'auto', speed: 1, fx: 'full', vol: 0.8 }) });
  await sleep(900); await page.screenshot({ path: OUT + '03-carte-village.png' });
  ok('carte visible au démarrage', await ev(() => !document.getElementById('map').classList.contains('hidden') && document.querySelectorAll('.spot').length === 9));
  await page.click('.spot[data-id="forge"]'); await sleep(400);
  ok('lieu de la carte -> onglet + bouton mis en avant', await ev(() => document.querySelector('.tab.on').dataset.tab === 'recolter' && !!document.querySelector('.cmd-btn.glowhi')));

  // 3) récolte animée
  await page.click('.cmd-btn[data-c="mine"]'); await sleep(700);
  ok('récolte: scène animée affichée', await ev(() => !document.getElementById('harvest').classList.contains('hidden') && !!document.querySelector('.hv-tool')));
  await page.screenshot({ path: OUT + '04-recolte.png' });
  await sleep(2600);

  // 4) combat animé (sauvegarde d'origine : niv 2 contre un gobelin)
  await page.click('[data-tab="combat"]'); await sleep(300);
  await page.click('.cmd-btn[data-c="combat"]'); await sleep(1900);
  const mid = await ev(() => ({ arena: !document.getElementById('arena').classList.contains('hidden'), mobW: document.querySelector('.hpb-mob .fl') && document.querySelector('.hpb-mob .fl').style.width,
    sprites: [...document.querySelectorAll('#arena .spr')].map(i => i.complete && i.naturalWidth > 0) }));
  await page.screenshot({ path: OUT + '05-combat-en-cours.png' });
  ok('combat: arène affichée, sprites chargés', mid.arena && mid.sprites.length === 2 && mid.sprites.every(Boolean), JSON.stringify(mid));
  await sleep(500); await page.screenshot({ path: OUT + '05b-combat-en-cours.png' });
  await page.waitForFunction(() => !document.getElementById('skip').offsetParent, { timeout: 20000 });
  const after = await ev(() => ({ mobW: document.querySelector('.hpb-mob .fl').style.width, log: document.querySelector('.entry').innerText }));
  ok('combat: PV du monstre descendus + récit ajouté après l\'animation', (after.mobW === '0%' || after.log.includes('mort')) && /Victoire|mort/.test(after.log), after.mobW);
  await sleep(300); await page.screenshot({ path: OUT + '06-combat-fin.png' });

  // 5) passage de niveau + toast de succès (XP juste sous le seuil, 99 récoltes -> succès Bûcheron)
  await setLS({ rpg_nathan_tuto: '1', rpg_nathan_save: JSON.stringify(Object.assign({}, base, { xp: 119, mined: 99, energy: 50, etime: Date.now() / 1000 })) }, false);
  await page.click('[data-tab="recolter"]'); await sleep(200);
  await page.click('.cmd-btn[data-c="mine"]');
  await page.waitForFunction(() => !document.getElementById('lvlup').classList.contains('hidden'), { timeout: 15000 });
  await sleep(700); await page.screenshot({ path: OUT + '07-niveau-superieur.png' });
  ok('passage de niveau affiché', await ev(() => document.querySelector('.lv-n').textContent === '3'));
  await page.click('#lvlup'); await sleep(250);
  const toasts = await ev(() => [...document.querySelectorAll('.gtoast b')].map(b => b.textContent));
  await page.screenshot({ path: OUT + '08-toast-succes.png' });
  ok('toast de succès affiché', toasts.some(t => t.includes('Bûcheron')), JSON.stringify(toasts));
  await sleep(3500);

  // 6) fenêtres : réglages, fiche héros, calendrier, inventaire
  await page.click('#btn-set'); await sleep(450); await page.screenshot({ path: OUT + '09-reglages.png' });
  ok('réglages ouverts', await ev(() => document.getElementById('sheet-title').textContent.includes('Réglages')));
  await page.click('.sheet-card .x'); await sleep(200);
  await page.click('#badge'); await sleep(500); await page.screenshot({ path: OUT + '10-fiche-heros.png' });
  ok('fiche héros ouverte', await ev(() => !!document.querySelector('.hero-card img.hc-hero')));
  await page.click('.sheet-card .x'); await sleep(200);
  await page.click('[data-tab="quetes"]'); await sleep(250); await page.screenshot({ path: OUT + '11-quetes.png' });
  await page.click('.cmd-btn[data-c="calendar"]'); await sleep(500); await page.screenshot({ path: OUT + '12-calendrier.png' });
  ok('calendrier : jour du jour mis en avant', await ev(() => !!document.querySelector('.cday.today')));
  await page.click('.go.big'); await sleep(3500);
  ok('récompense du jour récupérée', await ev(() => JSON.parse(localStorage.getItem('rpg_nathan_save')).last_daily === new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })));
  await page.click('#btn-bag'); await sleep(450); await page.screenshot({ path: OUT + '13-inventaire.png' });
  await page.click('.sheet-card .x'); await sleep(200);

  // 7) résumé d'absence (dernière visite il y a 3 h)
  const seen = JSON.stringify({ t: Date.now() - 3 * 3600e3, energy: 10, bank: 0, atelier: 0, expEnd: 0, daily: false, today: '2000-01-01' });
  await setLSfresh({ rpg_nathan_tuto: '1', rpg_nathan_seen: seen, rpg_nathan_save: JSON.stringify(Object.assign({}, base, { energy: 10, etime: Date.now() / 1000 - 3 * 3600, atelier: 1, atime: Date.now() / 1000 - 3 * 3600, bank: 200, bday: '2026-10-03' })) });
  await sleep(500); await page.screenshot({ path: OUT + '14-resume-absence.png' });
  const away = await ev(() => (document.querySelector('.away') || { innerText: 'absent' }).innerText);
  ok('résumé d\'absence (énergie, atelier, intérêts)', /Énergie rechargée/.test(away) && /atelier/.test(away) && /Intérêts/.test(away), away && away.replace(/\n/g, ' / '));
  await page.click('.sheet-card .x'); await sleep(200);

  // 8) tous les boutons en vitesse instantanée (aucune erreur JS)
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rpg_nathan_settings') || '{}'); s.speed = 'instant'; localStorage.setItem('rpg_nathan_settings', JSON.stringify(s)); });
  await setLS({ rpg_nathan_tuto: '1', rpg_nathan_settings: JSON.stringify({ sound: true, music: true, vibrate: true, video: 'auto', speed: 'instant', fx: 'full', vol: 0.8 }), rpg_nathan_save: JSON.stringify(Object.assign({}, base, { or: 5000, lvl: 6, maxhp: 190, hp: 190, sword: 'epee_fer', armor: 'armure_fer', pick: 'pioche_fer', inv: { bois: 20, fer: 20, diamant: 6, herbe: 20, cuir: 10, cristal: 4, potion: 2, poisson: 3 } })) });
  let clicks = 0;
  for (const tabId of ['recolter', 'combat', 'aventure', 'marche', 'quetes', 'perso']) {
    await page.click(`[data-tab="${tabId}"]`); await sleep(150);
    const n = (await page.$$('.cmd-btn')).length;
    for (let i = 0; i < n; i++) {
      const c = await page.$eval(`.cmd-btn[data-i="${i}"]`, b => b.dataset.c);
      if (['reset', 'import'].includes(c)) continue;
      await page.click(`.cmd-btn[data-i="${i}"]`); clicks++; await sleep(250);
      for (let k = 0; k < 3 && await page.$('#sheet:not(.hidden)'); k++) {
        const o = await page.$('#sheet .opt.ok'), go = await page.$('#sheet .go:not(.alt):not(.danger)');
        if (o && c !== 'animal') await o.click(); else if (go && !['export', 'settings'].includes(c)) await go.click(); else await page.click('#sheet-x');
        await sleep(250);
      }
      if (await page.$('#lvlup:not(.hidden)')) { await page.click('#lvlup'); await sleep(350); }
      await page.waitForFunction(() => !document.getElementById('skip').offsetParent, { timeout: 20000 });
    }
  }
  ok(`tous les boutons cliqués (${clicks}) sans blocage`, clicks > 40);

  // 9) préférence système « animations réduites »
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errors.push('pageerror(reduced): ' + e.message));
  await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p2.goto(URL, { waitUntil: 'networkidle0' });
  await p2.evaluate(() => { localStorage.removeItem('rpg_nathan_settings'); }); await p2.reload({ waitUntil: 'networkidle0' });
  const red = await p2.evaluate(() => ({ fx: window.__rpg.settings.fx, cls: document.documentElement.classList.contains('reduced') }));
  ok('prefers-reduced-motion -> effets réduits par défaut', red.fx === 'reduced' && red.cls, JSON.stringify(red));
  await p2.close();

  ok('aucune erreur JS / requête en échec', errors.length === 0, errors.join(' || '));
  for (const r of results) console.log(r.join(' | '));
  console.log(results.every(r => r[0] === 'OK ') ? 'TOUS LES TESTS OK' : 'DES TESTS ONT ÉCHOUÉ');
  await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
