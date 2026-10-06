const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.emulateTimezone('Europe/Brussels');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle0' });
  let clicks = 0, sheets = 0; const outputs = {};
  for (let round = 0; round < 2; round++) {
    for (const tab of ['recolter', 'combat', 'aventure', 'marche', 'quetes', 'perso']) {
      await page.click(`[data-tab="${tab}"]`);
      const n = (await page.$$('.cmd-btn')).length;
      for (let i = 0; i < n; i++) {
        const lb = await page.$eval(`.cmd-btn[data-i="${i}"] .lb`, e => e.textContent);
        if (lb === 'Réinitialiser' || lb === 'Importer') continue;
        await page.click(`.cmd-btn[data-i="${i}"]`); clicks++;
        await new Promise(r => setTimeout(r, 120));
        if (await page.$('#sheet:not(.hidden)')) {
          sheets++;
          const ok = await page.$('#sheet .opt.ok');
          const go = await page.$('#sheet .go:not(.alt):not(.danger)');
          if (lb === 'Exporter' || lb === 'Son') { await page.click('#sheet-x'); }
          else if (ok) await ok.click(); else if (go) await go.click(); else await page.click('#sheet-x');
          await new Promise(r => setTimeout(r, 120));
          if (await page.$('#sheet:not(.hidden)')) { const go2 = await page.$('#sheet .go'); if (go2) await go2.click(); else await page.click('#sheet-x'); }
          if (await page.$('#sheet:not(.hidden)')) await page.click('#sheet-x');
        }
        outputs[lb] = (await page.$eval('.entry', e => e.innerText)).split('\n').slice(2, 3).join(' ');
      }
    }
  }
  // reset flow (double confirm) then restore original
  await page.click('[data-tab="perso"]');
  const resetIdx = await page.$$eval('.cmd-btn', bs => bs.findIndex(b => b.innerText.includes('Réinitialiser')));
  await page.click(`.cmd-btn[data-i="${resetIdx}"]`); await page.waitForSelector('#sheet:not(.hidden)');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: '/workspace/rpg-web/test/screenshot-reset.png' });
  await page.click('#sheet .go.danger'); const armedTxt = await page.$eval('#sheet .go.danger', b => b.textContent);
  await page.click('#sheet .go.danger');
  const afterReset = await page.evaluate(() => JSON.parse(localStorage.getItem('rpg_nathan_save')).lvl);
  // export -> import roundtrip
  const exported = await page.evaluate(() => window.__rpg.engine.exportSave());
  await page.evaluate(() => { const r = window.__rpg.engine; r.importSave(JSON.stringify(Object.assign(JSON.parse(r.exportSave()), { or: 4242 }))); window.__rpg.refresh(); });
  const goldAfterImport = await page.$eval('#h-gold', e => e.textContent);
  let badImport = 'accepted'; try { await page.evaluate(() => window.__rpg.engine.importSave('{"foo":1}')); } catch (e) { badImport = 'rejected'; }
  console.log({ clicks, sheets, armedTxt, afterReset, goldAfterImport, badImport, exportedLen: exported.length });
  console.log(JSON.stringify(outputs, null, 1));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
