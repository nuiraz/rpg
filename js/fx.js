/* fx.js — effets visuels : particules (canvas), icônes volantes, nombres flottants, toasts, secousses, vibrations, passage de niveau. */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = { speed: 1, reduced: false, vibrate: true, instant: false };
  const rm = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---------- particules ---------- */
  const cv = $('fxc'), c2 = cv.getContext('2d');
  let parts = [], raf = 0, W = 0, H = 0, dpr = 1;
  function resize() { dpr = Math.min(2, root.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; c2.setTransform(dpr, 0, 0, dpr, 0, 0); }
  resize(); addEventListener('resize', resize);
  function loop() {
    c2.clearRect(0, 0, W, H);
    const t = performance.now();
    parts = parts.filter(p => t - p.t0 < p.life);
    for (const p of parts) {
      const k = (t - p.t0) / p.life, dt = 1 / 60;
      p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      c2.globalAlpha = Math.max(0, p.fade ? 1 - k * k : 1);
      c2.fillStyle = p.color;
      if (p.shape === 'conf') { c2.save(); c2.translate(p.x, p.y); c2.rotate(p.rot); c2.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * Math.abs(Math.cos(p.rot * 2)) + 1); c2.restore(); }
      else if (p.shape === 'glow') { const r = p.s * (1 + k); const gr = c2.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, p.color); gr.addColorStop(1, 'rgba(0,0,0,0)'); c2.fillStyle = gr; c2.fillRect(p.x - r, p.y - r, r * 2, r * 2); }
      else if (p.shape === 'text') { c2.font = `${p.s}px sans-serif`; c2.fillText(p.txt, p.x, p.y); }
      else { const s = p.s * (p.shrink ? 1 - k * 0.7 : 1); c2.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); }
    }
    c2.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(loop) : 0;
  }
  function burst(x, y, o = {}) {
    if (cfg.instant) return;
    const n = Math.round((o.count || 16) * (cfg.reduced ? 0.35 : 1));
    const colors = o.colors || ['#ffd54a', '#fff3a0', '#ff9f1c'];
    for (let i = 0; i < n; i++) {
      const a = (o.angle != null ? o.angle : -Math.PI / 2) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI * 2);
      const sp = (o.speed || 220) * (0.4 + Math.random() * 0.8);
      parts.push({ x: x + (Math.random() - 0.5) * (o.jitter || 6), y: y + (Math.random() - 0.5) * (o.jitter || 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: o.gravity != null ? o.gravity : 500, drag: o.drag || 0.985, s: (o.size || 5) * (0.6 + Math.random() * 0.8), color: colors[i % colors.length],
        life: (o.life || 900) * (0.6 + Math.random() * 0.6), t0: performance.now() + 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        shape: o.shape || 'sq', fade: o.fade !== false, shrink: o.shrink !== false, txt: o.txt });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function confetti() {
    if (cfg.instant || cfg.reduced) return;
    const cols = ['#ff4d6d', '#ffd54a', '#4dd2ff', '#7be07b', '#c77dff', '#ffffff'];
    burst(W * 0.15, H * 0.55, { count: 70, colors: cols, shape: 'conf', angle: -Math.PI / 3, spread: 1.0, speed: 700, gravity: 600, size: 9, life: 2600, drag: 0.975, shrink: false });
    burst(W * 0.85, H * 0.55, { count: 70, colors: cols, shape: 'conf', angle: -Math.PI * 2 / 3, spread: 1.0, speed: 700, gravity: 600, size: 9, life: 2600, drag: 0.975, shrink: false });
  }
  const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };

  /* ---------- icônes volantes (pièces, ressources) ---------- */
  function fly(from, toEl, html, n = 6, o = {}) {
    if (!toEl || cfg.instant) return Promise.resolve();
    const to = center(toEl); n = Math.max(1, Math.min(n, cfg.reduced ? 3 : 14));
    const ps = [];
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div'); d.className = 'flyer ' + (o.cls || ''); d.innerHTML = html;
      $('fx').appendChild(d);
      const sx = from.x + (Math.random() - 0.5) * (o.spread || 50), sy = from.y + (Math.random() - 0.5) * (o.spread || 30);
      const mx = (sx + to.x) / 2 + (Math.random() - 0.5) * 120, my = Math.min(sy, to.y) - 40 - Math.random() * 80;
      const pop = { x: sx + (Math.random() - 0.5) * 70, y: sy - 20 - Math.random() * 50 };
      const dur = (o.dur || 750) / cfg.speed, delay = i * (o.stagger || 55) / cfg.speed;
      const a = d.animate([
        { transform: `translate(${sx}px,${sy}px) scale(.3)`, opacity: 0 },
        { transform: `translate(${pop.x}px,${pop.y}px) scale(1.15)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${mx}px,${my}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${to.x}px,${to.y}px) scale(.55)`, opacity: 0.9 },
      ], { duration: dur, delay, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
      ps.push(a.finished.then(() => { d.remove(); if (o.onEach) o.onEach(i); }).catch(() => d.remove()));
    }
    return Promise.all(ps).then(() => { pulse(toEl); });
  }
  function pulse(el) { if (!el || cfg.instant) return; el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', filter: 'brightness(1.6)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' }); }

  /* ---------- texte flottant ---------- */
  function floatText(x, y, text, color = '#ffe678', o = {}) {
    if (cfg.instant) return;
    const f = document.createElement('div'); f.className = 'float ' + (o.cls || ''); f.textContent = text; f.style.color = color;
    f.style.left = x + 'px'; f.style.top = y + 'px';
    $('fx').appendChild(f); setTimeout(() => f.remove(), 1700);
  }
  function floatAt(el, text, color, o) { if (!el) return; const c = center(el); floatText(c.x, c.y, text, color, o); }

  /* ---------- secousse ---------- */
  function shake(el, amp = 6, dur = 320) {
    if (!el || cfg.instant || cfg.reduced) return;
    const k = []; for (let i = 0; i < 7; i++) k.push({ transform: `translate(${(Math.random() - 0.5) * amp * 2}px,${(Math.random() - 0.5) * amp}px)` });
    k.push({ transform: 'translate(0,0)' });
    el.animate(k, { duration: dur, easing: 'linear' });
  }

  /* ---------- vibrations ---------- */
  function vibe(p) { if (!cfg.vibrate || !navigator.vibrate) return; try { navigator.vibrate(p); } catch (e) { /* non supporté */ } }

  /* ---------- compteur animé ---------- */
  function countUp(el, from, to, dur = 700) {
    if (from === to || cfg.instant) { el.textContent = to; return; }
    const t0 = performance.now(); dur /= cfg.speed;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- toasts (quêtes, succès, trouvailles) ---------- */
  const queue = []; let showing = 0;
  function toast(icon, title, sub = '', kind = '') {
    queue.push({ icon, title, sub, kind }); pump();
  }
  function pump() {
    if (showing >= 2 || !queue.length) return;
    const t = queue.shift(); showing++;
    const d = document.createElement('div'); d.className = 'gtoast ' + t.kind;
    d.innerHTML = `<span class="ti">${t.icon}</span><span class="tt"><b></b><small></small></span>`;
    d.querySelector('b').textContent = t.title; d.querySelector('small').textContent = t.sub;
    $('toasts').appendChild(d);
    if (root.SFX) SFX.play('toast');
    const c = center(d.querySelector('.ti'));
    setTimeout(() => burst(c.x, c.y, { count: 14, colors: t.kind === 'ach' ? ['#ffd54a', '#fff'] : ['#7fc8ff', '#fff'], speed: 160, gravity: 200, size: 4, life: 700 }), 250);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => { d.remove(); showing--; pump(); }, 350); }, 2600 / Math.max(0.8, cfg.speed));
  }
  function msg(text) { // petit message central
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = text; document.body.appendChild(d); setTimeout(() => d.remove(), 1600);
  }

  /* ---------- passage de niveau ---------- */
  function levelUp({ lvl, rank, rankChanged, maxhp, emblem }) {
    return new Promise(res => {
      const o = $('lvlup');
      o.innerHTML = `<div class="rays"></div><div class="lv-card"><div class="lv-emb">${emblem ? `<img src="${emblem}" alt="">` : ''}</div>
        <div class="lv-t">NIVEAU</div><div class="lv-n">${lvl}</div>
        <div class="lv-s">${rankChanged ? `Nouveau rang : <b>${rank}</b> !` : `Rang : ${rank}`}</div>
        <div class="lv-s2">PV max ${maxhp} · soins complets ❤️</div><div class="lv-tap">Touchez pour continuer</div></div>`;
      o.classList.remove('hidden'); o.classList.toggle('rankup', !!rankChanged);
      if (root.SFX) SFX.play('levelup');
      vibe([60, 40, 60, 40, 160]);
      confetti();
      setTimeout(() => { const c = center(o.querySelector('.lv-n')); burst(c.x, c.y, { count: 40, colors: ['#ffd54a', '#fff3a0', '#ffffff'], speed: 380, gravity: 120, size: 6, life: 1200 }); }, 200);
      let done = false;
      const close = () => { if (done) return; done = true; o.classList.add('closing'); setTimeout(() => { o.classList.add('hidden'); o.classList.remove('closing'); res(); }, 300); };
      o.onclick = close; setTimeout(close, cfg.instant ? 1200 : 3400);
    });
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function setCfg(o) { Object.assign(cfg, o); }
  root.FX = { cfg, setCfg, burst, confetti, fly, pulse, floatText, floatAt, shake, vibe, countUp, toast, msg, levelUp, center, sleep, prefersReduced: () => rm.matches };
})(window);
