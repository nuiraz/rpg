/* scene.js — l'écran de scène : carte animée du village, combats animés, récolte animée, vidéos. */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id);
  const screen = $('screen'), arena = $('arena'), harvest = $('harvest'), video = $('scene'), mapEl = $('map');
  const st = { skipping: false, waiters: [], busy: false, idleT: 0, seq: [], seqI: 0, muted: false, mode: 'map' };

  /* ---------- temps (vitesse réglable + passer) ---------- */
  function wait(ms) {
    if (st.skipping || FX.cfg.instant) return Promise.resolve();
    return new Promise(r => { const t = setTimeout(r, ms / FX.cfg.speed); st.waiters.push(() => { clearTimeout(t); r(); }); });
  }
  function anim(el, kf, opt) {
    if (!el) return Promise.resolve();
    const o = Object.assign({ fill: 'none' }, typeof opt === 'number' ? { duration: opt } : opt);
    o.duration = (st.skipping || FX.cfg.instant) ? 1 : o.duration / FX.cfg.speed;
    if (o.delay) o.delay = (st.skipping || FX.cfg.instant) ? 0 : o.delay / FX.cfg.speed;
    try { return el.animate(kf, o).finished.catch(() => {}); } catch (e) { return Promise.resolve(); }
  }
  function skip() { st.skipping = true; st.waiters.splice(0).forEach(f => f()); screen.getAnimations({ subtree: true }).forEach(a => { try { if (a.effect && a.effect.getTiming().iterations !== Infinity) a.finish(); } catch (e) {} }); }

  /* ---------- modes ---------- */
  const caption = t => { $('caption').textContent = t; };
  function mode(m) {
    clearTimeout(st.idleT); st.mode = m;
    mapEl.classList.toggle('hidden', m !== 'map');
    arena.classList.toggle('hidden', m !== 'arena');
    harvest.classList.toggle('hidden', m !== 'harvest');
    video.classList.toggle('hidden', m !== 'video');
    if (m !== 'video') { try { video.pause(); } catch (e) {} }
    $('tap').classList.add('hidden');
    const layer = { map: mapEl, arena, harvest, video }[m];
    if (layer && !FX.cfg.instant) layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    $('btn-map').classList.toggle('hidden', m === 'map');
  }
  function backToMapLater(ms = 3500) { clearTimeout(st.idleT); st.idleT = setTimeout(() => { if (!st.busy) showMap(); }, ms); }
  function showMap() { if (st.mode !== 'map') { mode('map'); caption(st.mapCaption || '🗺️ Le village'); } }

  /* ---------- carte du village ---------- */
  const SPOTS = [
    { id: 'auberge', x: 17, y: 38, ic: '🍺', lb: 'Auberge', tab: 'combat', hi: 'dormir' },
    { id: 'foret', x: 12, y: 62, ic: '🌲', lb: 'Forêt', tab: 'recolter', hi: 'mine' },
    { id: 'mine', x: 43, y: 31, ic: '⛏️', lb: 'Mine', tab: 'recolter', hi: 'minepierre' },
    { id: 'portes', x: 58, y: 48, ic: '🧭', lb: 'Aventure', tab: 'aventure', hi: 'expedition' },
    { id: 'forge', x: 70, y: 56, ic: '🔨', lb: 'Forge', tab: 'recolter', hi: 'craft' },
    { id: 'chateau', x: 83, y: 25, ic: '🏰', lb: 'Donjon', tab: 'combat', hi: 'donjon' },
    { id: 'marche', x: 85, y: 68, ic: '🏪', lb: 'Marché', tab: 'marche', hi: 'vendre' },
    { id: 'arene', x: 46, y: 78, ic: '⚔️', lb: 'Combat', tab: 'combat', hi: 'combat' },
    { id: 'quetes', x: 25, y: 80, ic: '📜', lb: 'Quêtes', tab: 'quetes', hi: 'quetes' },
  ];
  function initMap(onSpot) {
    $('spots').innerHTML = SPOTS.map(s => `<button class="spot" data-id="${s.id}" style="left:${s.x}%;top:${s.y}%"><span class="ring"></span><span class="si">${s.ic}</span><span class="sl">${s.lb}</span><span class="sbadge hidden">!</span></button>`).join('');
    $('spots').addEventListener('click', e => { const b = e.target.closest('.spot'); if (!b) return; const s = SPOTS.find(x => x.id === b.dataset.id); onSpot(s, b); });
  }
  function setSpotBadges(map) { for (const b of $('spots').children) b.querySelector('.sbadge').classList.toggle('hidden', !map[b.dataset.id]); }

  /* ---------- vidéos ---------- */
  function playVideo(list, opts = {}) {
    if (!list || !list.length) return;
    st.seq = list; st.seqI = 0; st.muted = !!opts.muted; mode('video'); playCurrent(opts.labels || {});
  }
  function playCurrent(labels) {
    const n = st.seq[st.seqI];
    video.poster = `img/scenes/${n}.webp`; video.src = `vid/${n}.mp4`; video.muted = st.muted;
    caption(labels[n] || n);
    const p = video.play();
    if (p && p.catch) p.catch(() => {
      if (!video.muted) { video.muted = true; video.play().then(() => $('mute').classList.add('hint')).catch(() => $('tap').classList.remove('hidden')); }
      else $('tap').classList.remove('hidden');
    });
    st.labels = labels;
  }
  video.addEventListener('ended', () => { if (st.seqI < st.seq.length - 1) { st.seqI++; playCurrent(st.labels || {}); } else backToMapLater(2500); });
  video.addEventListener('error', () => { if (st.seqI < st.seq.length - 1) { st.seqI++; playCurrent(st.labels || {}); } });
  $('tap').addEventListener('click', () => { $('tap').classList.add('hidden'); video.muted = st.muted; video.play().catch(() => { video.muted = true; video.play().catch(() => {}); }); });
  function setMuted(m) { st.muted = m; video.muted = m; if (!m && video.src && video.paused && !video.ended && st.mode === 'video') video.play().catch(() => {}); }

  /* ---------- combat animé ---------- */
  const MOB = [
    { src: 'slime', h: 32, col: ['#4cc9f0', '#90e0ef', '#1f6fd1'] },
    { src: 'gobelin', h: 47, col: ['#7bbf3a', '#a3d977', '#4a7a1e'] },
    { src: 'squelette', h: 52, col: ['#f1ece0', '#cfc6b4', '#8f8a80'] },
    { src: 'orc', h: 54, col: ['#6a9c3a', '#3f6b22', '#9bbd6b'] },
    { src: 'orc', h: 62, col: ['#8a9a8a', '#5c6b5c', '#b5c2a0'], filter: 'hue-rotate(75deg) saturate(.55) brightness(.85) contrast(1.1)', troll: true },
    { src: 'dragon', h: 70, col: ['#ff4d2e', '#ff9f1c', '#ffd166', '#8b1e1e'], dragon: true },
  ];
  const themeFor = cmd => ({ boss: 'antre', donjon: 'donjon', tour: 'tour' })[cmd] || 'foret';
  function buildArena(theme) {
    arena.className = 'layer arena th-' + theme;
    arena.innerHTML = `<div class="al sky"></div><div class="al far"></div><div class="al mid"></div><div class="al ground"></div><div class="al deco"></div>
      <div class="ftr hero"><div class="shadow"></div><img class="spr" src="img/sprites/hero.webp" alt="Héros"></div>
      <div class="ftr mob"><div class="shadow"></div><img class="spr" alt=""></div>
      <div class="hpb hpb-hero"><span class="nm">NATHAN</span><div class="hb"><i class="gh"></i><i class="fl"></i></div><span class="nb"></span></div>
      <div class="hpb hpb-mob"><span class="nm"></span><div class="hb"><i class="gh"></i><i class="fl"></i></div><span class="nb"></span></div>
      <div class="ar-fx"></div><div class="ar-banner"></div><div class="ar-vig"></div>`;
  }
  const q = s => arena.querySelector(s);
  function setBar(which, v, max) {
    const box = q('.hpb-' + which), pct = Math.max(0, Math.min(100, 100 * v / Math.max(1, max)));
    box.querySelector('.fl').style.width = pct + '%'; box.querySelector('.gh').style.width = pct + '%';
    box.querySelector('.nb').textContent = `${Math.max(0, v)}/${max}`;
    box.classList.toggle('low', pct < 30);
  }
  function banner(html, cls = '') {
    const b = q('.ar-banner'); b.getAnimations().forEach(a => a.cancel()); b.className = 'ar-banner show ' + cls; b.innerHTML = html;
    anim(b, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 380, easing: 'ease-out', fill: 'both' });
  }
  function clearBanner() { const b = q('.ar-banner'); if (b) { b.getAnimations().forEach(a => a.cancel()); b.className = 'ar-banner'; } }
  function dmgNum(target, d, crit, color) {
    const fx = q('.ar-fx'), ar = arena.getBoundingClientRect(), r = target.getBoundingClientRect();
    const el = document.createElement('div'); el.className = 'dmg' + (crit ? ' crit' : '');
    el.innerHTML = crit ? `<small>CRITIQUE !</small>${d}` : String(d); el.style.color = color;
    el.style.left = (r.left - ar.left + r.width / 2 + (Math.random() - 0.5) * 20) + 'px'; el.style.top = (r.top - ar.top + r.height * 0.25) + 'px';
    fx.appendChild(el); setTimeout(() => el.remove(), 1100 / FX.cfg.speed + 50);
  }
  function slash(target, kind) {
    const fx = q('.ar-fx'), ar = arena.getBoundingClientRect(), r = target.getBoundingClientRect();
    const el = document.createElement('div'); el.className = 'slash ' + kind;
    el.style.left = (r.left - ar.left + r.width / 2) + 'px'; el.style.top = (r.top - ar.top + r.height * 0.45) + 'px';
    fx.appendChild(el);
    anim(el, [{ transform: 'translate(-50%,-50%) rotate(-70deg) scale(.5)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) rotate(50deg) scale(1.2)', opacity: 0 }], { duration: 260, easing: 'ease-out' }).then(() => el.remove());
  }
  function flash(img, kind) {
    const f = kind === 'hurt' ? 'brightness(1.8) sepia(1) hue-rotate(-40deg) saturate(6)' : 'brightness(3) saturate(0)';
    const base = img.dataset.filter || 'none';
    return anim(img, [{ filter: base }, { filter: f }, { filter: base }], 170);
  }
  function knock(el, dir) { return anim(el, [{ transform: 'translateX(0)' }, { transform: `translateX(${dir * 10}px)` }, { transform: 'translateX(0)' }], 200); }

  async function playCombat(events, ctx = {}) {
    st.busy = true; st.skipping = false; $('skip').classList.remove('hidden');
    mode('arena'); buildArena(themeFor(ctx.cmd));
    const heroF = q('.ftr.hero'), mobF = q('.ftr.mob'), heroI = heroF.querySelector('img'), mobI = mobF.querySelector('img');
    let heroMax = 1, mobMax = 1, mob = MOB[0], mobName = '', first = true, lastMobRect = null;
    const hits = events.filter(e => e.e === 'hit').length;
    const pace = hits > 10 ? Math.max(0.42, 10 / hits) : 1;
    caption({ boss: '🐉 Antre du dragon', donjon: '🏰 Donjon', tour: '🗼 Tour infinie' }[ctx.cmd] || '⚔️ Combat');
    const fp = events.find(e => e.e === 'fight');
    if (fp) { heroMax = fp.pmax; setBar('hero', fp.php, heroMax); }
    for (const ev of events) {
      if (ev.e === 'floor') { banner(`Étage ${ev.n}/3`, 'floor'); SFX.play('tab'); await wait(650); clearBanner(); }
      else if (ev.e === 'fight') {
        mob = MOB[ev.idx] || MOB[0]; mobName = ev.mob; mobMax = ev.max;
        mobI.getAnimations().forEach(x => x.cancel()); mobF.getAnimations().forEach(x => x.cancel());
        mobI.src = `img/sprites/${mob.src}.webp`; mobI.alt = ev.mob;
        const scale = ev.scale ? Math.min(1.25, 1 + (ev.scale - 1) * 0.25) : 1;
        mobF.style.height = (mob.h * scale) + '%'; mobF.classList.toggle('dragon', !!mob.dragon);
        mobI.style.filter = mob.filter || ''; mobI.dataset.filter = mob.filter || 'none';
        mobF.style.opacity = 1; mobI.style.opacity = 1; mobI.style.transform = '';
        q('.hpb-mob .nm').textContent = ev.tour ? `${ev.mob} · étage ${ev.tour}` : (mob.troll ? 'Troll' : ev.mob);
        setBar('mob', ev.hp, mobMax); setBar('hero', ev.php, heroMax);
        if (first) anim(heroF, [{ transform: 'translateX(-140%)' }, { transform: 'translateX(0)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1.2)' });
        await anim(mobF, [{ transform: 'translateX(140%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1.2)' });
        if (mob.dragon) { SFX.play('fire'); FX.shake(screen, 8, 500); }
        banner(`${mob.troll ? 'Troll' : ev.mob}${ev.tour ? `<small>Étage ${ev.tour}</small>` : ''}`, 'vs'); await wait(first ? 650 : 450); clearBanner(); first = false;
      }
      else if (ev.e === 'hit' && ev.by === 'hero') {
        const dx = mobF.getBoundingClientRect().left - heroF.getBoundingClientRect().right;
        SFX.play('swoosh');
        const lunge = anim(heroF, [{ transform: 'translateX(0)' }, { transform: `translateX(${Math.max(20, dx * 0.7)}px)`, offset: 0.45 }, { transform: 'translateX(0)' }], { duration: 330 * Math.max(0.7, pace), easing: 'ease-in-out' });
        await wait(140 * Math.max(0.7, pace));
        slash(mobI, ev.crit ? 'crit' : 'hero'); flash(mobI, 'hit'); knock(mobF, 1);
        dmgNum(mobI, ev.d, ev.crit, ev.crit ? '#ffd54a' : '#ffffff');
        setBar('mob', ev.hp, mobMax);
        if (ev.crit) { SFX.play('crit'); FX.shake(screen, 7); FX.vibe(35); const c = FX.center(mobI); FX.burst(c.x, c.y, { count: 18, colors: ['#ffd54a', '#fff'], speed: 260, gravity: 300, size: 4, life: 600 }); }
        else SFX.play('hit');
        await lunge; await wait(260 * pace);
      }
      else if (ev.e === 'hit' && ev.by === 'mob') {
        const dx = heroF.getBoundingClientRect().right - mobF.getBoundingClientRect().left;
        if (mob.dragon) {
          await anim(mobF, [{ transform: 'translateX(0) scale(1)' }, { transform: 'translateX(8px) scale(1.04)' }, { transform: 'translateX(0) scale(1)' }], 240 * Math.max(0.7, pace));
          SFX.play('fire');
          const m = mobI.getBoundingClientRect(), h = FX.center(heroI);
          const sx = m.left + m.width * 0.1, sy = m.top + m.height * 0.45;
          FX.burst(sx, sy, { count: 46, colors: ['#ff4d2e', '#ff9f1c', '#ffd166', '#fff3a0'], angle: Math.atan2(h.y - sy, h.x - sx), spread: 0.45, speed: 520, gravity: -40, size: 9, life: 650, drag: 0.97 });
          await wait(260 * Math.max(0.7, pace));
        } else {
          SFX.play('swoosh');
          anim(mobF, [{ transform: 'translateX(0)' }, { transform: `translateX(${Math.min(-20, dx * 0.7)}px)`, offset: 0.45 }, { transform: 'translateX(0)' }], { duration: 330 * Math.max(0.7, pace), easing: 'ease-in-out' });
          await wait(140 * Math.max(0.7, pace));
          slash(heroI, 'mob');
        }
        flash(heroI, 'hurt'); knock(heroF, -1);
        dmgNum(heroI, ev.d, ev.crit, '#ff6a74');
        setBar('hero', ev.php, heroMax); if (ctx.onHeroHp) ctx.onHeroHp(ev.php, heroMax);
        SFX.play('hurt'); FX.vibe(ev.crit ? [30, 30, 30] : 22);
        if (ev.crit || mob.dragon) FX.shake(screen, ev.crit ? 9 : 5);
        await wait(380 * pace);
      }
      else if (ev.e === 'end' && ev.win) {
        lastMobRect = mobI.getBoundingClientRect();
        const c = FX.center(mobI);
        anim(mobI, [{ opacity: 1, transform: 'scale(1)', filter: mobI.dataset.filter }, { filter: 'brightness(4) saturate(0)', offset: 0.2 }, { opacity: 0, transform: 'scale(.5) translateY(25%)', filter: 'brightness(2) blur(5px)' }], { duration: 650, fill: 'forwards' });
        FX.burst(c.x, c.y, { count: 40, colors: mob.col, speed: 300, gravity: 380, size: 6, life: 900 });
        SFX.play('victory'); FX.vibe([20, 40, 20]);
        anim(heroF, [{ transform: 'translateY(0)' }, { transform: 'translateY(-18%)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-8%)' }, { transform: 'translateY(0)' }], { duration: 700, easing: 'ease-out' });
        banner(`VICTOIRE !<small>+${ev.gold} or · +${ev.xp} XP</small>`, 'win');
        await wait(1000); clearBanner();
      }
      else if (ev.e === 'end' && !ev.win) {
        anim(heroI, [{ transform: 'rotate(0)', filter: 'none' }, { transform: 'translateY(30%) rotate(-80deg)', filter: 'grayscale(1) brightness(.6)' }], { duration: 650, fill: 'forwards', easing: 'ease-in' });
        q('.ar-vig').classList.add('on');
        SFX.play('defeat'); FX.vibe([80, 60, 160]); FX.shake(screen, 10, 500);
        banner(`K.O.${ev.lost ? `<small>-${ev.lost} or</small>` : ''}`, 'lose');
        await wait(1200);
      }
      else if (ev.e === 'chest') {
        banner(`🎁 Coffre du donjon<small>+${ev.g} or · +1 🔮</small>`, 'win'); SFX.play('chest');
        const c = FX.center(q('.ar-banner')); FX.burst(c.x, c.y, { count: 30, colors: ['#ffd54a', '#c77dff', '#fff'], speed: 260, gravity: 200, size: 5 });
        await wait(1000);
      }
    }
    $('skip').classList.add('hidden'); st.busy = false; st.skipping = false;
    backToMapLater(4000);
    return { mobRect: lastMobRect, heroRect: heroI.getBoundingClientRect() };
  }

  /* ---------- récolte animée ---------- */
  const HV = {
    bois: { tool: '🪓', sfx: 'chop', col: ['#8b5a2b', '#c68642', '#5c3a1e', '#6aa84f'], scene: 'mine', cap: '🪓 Forêt' },
    pierre: { tool: '⛏️', sfx: 'mine', col: ['#9e9e9e', '#757575', '#cfcfcf'], scene: 'minepierre', cap: '⛏️ Carrière' },
    fer: { tool: '⛏️', sfx: 'mine', col: ['#b0b0b0', '#ff9f1c', '#ffd166', '#7a7a7a'], scene: 'minefer', cap: '⛏️ Mine de fer' },
    diamant: { tool: '⛏️', sfx: 'mine', col: ['#7df9ff', '#b5fffc', '#ffffff', '#4cc9f0'], scene: 'minediamant', cap: '💎 Mine profonde' },
    herbe: { tool: '🌿', sfx: 'leaf', col: ['#6ab04c', '#badc58', '#2d8a34'], scene: 'herbe', cap: '🌿 Prairie' },
  };
  async function playHarvest(events, ctx = {}) {
    const ev = events.find(e => e.e === 'harvest' || e.e === 'fish'); if (!ev) return null;
    st.busy = true; st.skipping = false; $('skip').classList.remove('hidden');
    const fish = ev.e === 'fish', h = fish ? { scene: 'pecher', cap: '🎣 Lac' } : HV[ev.kind];
    mode('harvest'); caption(h.cap);
    harvest.innerHTML = `<div class="hv-bg" style="background-image:url(img/scenes/${h.scene}.webp)"></div><div class="hv-vig"></div>
      ${fish ? '<div class="hv-water"><i></i><i></i><i></i></div><div class="hv-bob"></div>' : `<div class="hv-tool">${h.tool}</div>`}<div class="hv-txt"></div>`;
    const ptEl = harvest.querySelector(fish ? '.hv-bob' : '.hv-tool');
    const hr = harvest.getBoundingClientRect();
    const pt = { x: hr.left + hr.width * 0.6, y: hr.top + hr.height * 0.6 };
    const txt = harvest.querySelector('.hv-txt');
    const say = (t, cls = '') => { txt.className = 'hv-txt show ' + cls; txt.innerHTML = t; anim(txt, [{ transform: 'translate(-50%,0) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1.1)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }], { duration: 360, fill: 'both' }); };
    if (!fish) {
      anim(harvest.querySelector('.hv-bg'), [{ transform: 'scale(1.05)' }, { transform: 'scale(1.13)' }], { duration: 2400, fill: 'forwards' });
      const swings = FX.cfg.speed > 1.5 ? 2 : 3;
      for (let i = 0; i < swings; i++) {
        await anim(ptEl, [{ transform: 'rotate(-35deg)' }, { transform: 'rotate(-75deg)', offset: 0.45 }, { transform: 'rotate(25deg)' }], { duration: 300, easing: 'cubic-bezier(.5,0,.9,.5)' });
        SFX.play(h.sfx); FX.shake(screen, 3, 160);
        FX.burst(pt.x - 10, pt.y + 10, { count: 12, colors: h.col, angle: -Math.PI / 2 - 0.6, spread: 1.6, speed: 260, gravity: 700, size: 5, life: 700 });
        if (ev.kind === 'fer' || ev.kind === 'diamant') FX.burst(pt.x - 10, pt.y + 10, { count: 6, colors: ['#fff3a0', '#ffffff'], speed: 320, gravity: 200, size: 2, life: 350 });
        await wait(90);
      }
      if (ev.miss) { FX.burst(pt.x, pt.y, { count: 14, colors: ['rgba(170,170,170,.6)', 'rgba(120,120,120,.5)'], shape: 'glow', speed: 60, gravity: -30, size: 14, life: 900 }); say('Rien cette fois…', 'miss'); SFX.play('error'); }
      else {
        FX.burst(pt.x, pt.y, { count: 26, colors: h.col, speed: 330, gravity: 500, size: 6, life: 900 });
        say(`+${ev.n} ${ev.kind}${ev.lucky ? '<small>pioche chanceuse x2 !</small>' : ''}`, ev.lucky ? 'lucky' : '');
        if (ev.crystal) { await wait(250); FX.burst(pt.x, pt.y - 20, { count: 30, colors: ['#c77dff', '#e0aaff', '#ffffff'], speed: 220, gravity: 60, size: 5, life: 1200 }); SFX.play('sparkle'); }
      }
    } else {
      anim(ptEl, [{ transform: 'translateY(0)' }, { transform: 'translateY(4px)' }, { transform: 'translateY(0)' }], { duration: 700, iterations: 2 });
      await wait(900);
      if (ev.res === 'rien') { say('Rien ne mord…', 'miss'); await wait(300); }
      else {
        await anim(ptEl, [{ transform: 'translateY(0)' }, { transform: 'translateY(14px)' }, { transform: 'translateY(-6px)' }], 260);
        SFX.play('splash'); FX.vibe(15);
        FX.burst(pt.x, pt.y, { count: 30, colors: ['#9bd8ff', '#e0f4ff', '#4ea8de'], angle: -Math.PI / 2, spread: 1.3, speed: 300, gravity: 700, size: 5, life: 800 });
        if (ev.res === 'perle') { FX.burst(pt.x, pt.y - 10, { count: 24, colors: ['#ffffff', '#ffe9f3', '#d7f3ff'], speed: 200, gravity: 80, size: 5, life: 1200 }); SFX.play('sparkle'); say('Une perle ! ✨', 'lucky'); }
        else say('Ça mord ! 🐟');
      }
    }
    await wait(500);
    $('skip').classList.add('hidden'); st.busy = false; st.skipping = false;
    backToMapLater(3000);
    return { point: pt };
  }

  /* ---------- petite scène générique sur la carte (pas de vidéo) ---------- */
  function mapFx(icon, text) {
    showMap();
    const r = screen.getBoundingClientRect();
    FX.floatText(r.left + r.width / 2, r.top + r.height / 2, `${icon} ${text}`, '#fff', { cls: 'big' });
  }

  $('skip').addEventListener('click', e => { e.stopPropagation(); skip(); });
  screen.addEventListener('click', e => { if (st.busy && !e.target.closest('.sbtn')) skip(); });
  $('btn-map').addEventListener('click', e => { e.stopPropagation(); showMap(); });

  root.Scene = { initMap, setSpotBadges, playVideo, setMuted, playCombat, playHarvest, showMap, mapFx, skip, mode, backToMapLater,
    get busy() { return st.busy; }, set mapCaption(t) { st.mapCaption = t; }, get mode() { return st.mode; }, SPOTS };
})(window);
