/* sfx.js — bruitages synthétisés en direct (WebAudio, 0 fichier) + musique d'ambiance procédurale. */
(function (root) {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const state = { sound: true, music: false, vol: 0.8 };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = state.sound ? state.vol : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  const now = () => ctx.currentTime;

  function tone(f, dur, { type = 'square', vol = 0.15, to = null, at = 0, attack = 0.005, bus = null } = {}) {
    if (!ensure() || !state.sound && !bus) return;
    const t = now() + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, { vol = 0.2, type = 'bandpass', f = 1000, to = null, q = 1, at = 0 } = {}) {
    if (!ensure() || !state.sound) return;
    const t = now() + at, src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(sfxBus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  const N = n => 440 * Math.pow(2, (n - 69) / 12); // note MIDI -> Hz

  const S = {
    click() { tone(720, 0.05, { vol: 0.06, to: 980 }); },
    tab() { tone(520, 0.06, { vol: 0.05, type: 'triangle', to: 700 }); },
    swoosh() { noise(0.12, { vol: 0.12, type: 'highpass', f: 1500, to: 5000 }); },
    hit() { noise(0.09, { vol: 0.3, f: 1400, q: 0.8 }); tone(160, 0.12, { type: 'sine', vol: 0.3, to: 55 }); },
    crit() { S.hit(); tone(1200, 0.16, { vol: 0.1, to: 2200, at: 0.02 }); noise(0.2, { vol: 0.15, type: 'highpass', f: 3000, at: 0.03 }); },
    hurt() { tone(260, 0.16, { type: 'sawtooth', vol: 0.12, to: 110 }); noise(0.1, { vol: 0.2, type: 'lowpass', f: 900 }); },
    fire() { noise(0.6, { vol: 0.3, type: 'lowpass', f: 1800, to: 300 }); tone(90, 0.5, { type: 'sawtooth', vol: 0.08, to: 50 }); },
    coin() { tone(988, 0.07, { vol: 0.08 }); tone(1319, 0.16, { vol: 0.08, at: 0.06 }); },
    coins(n = 5) { for (let i = 0; i < Math.min(n, 8); i++) { tone(1319 + (i % 3) * 120, 0.07, { vol: 0.05, at: i * 0.06 }); } },
    mine() { noise(0.08, { vol: 0.35, type: 'lowpass', f: 1200 }); tone(190, 0.1, { type: 'triangle', vol: 0.25, to: 80 }); tone(2400, 0.08, { type: 'sine', vol: 0.05, at: 0.01 }); },
    chop() { noise(0.07, { vol: 0.3, f: 700, q: 2 }); tone(140, 0.08, { vol: 0.12, to: 90 }); },
    leaf() { noise(0.15, { vol: 0.1, type: 'highpass', f: 2500, to: 6000 }); },
    splash() { noise(0.35, { vol: 0.25, type: 'lowpass', f: 2500, to: 300 }); },
    plop() { tone(400, 0.12, { type: 'sine', vol: 0.12, to: 900 }); },
    sparkle() { [0, 4, 7, 12, 16].forEach((n, i) => tone(N(84 + n), 0.1, { type: 'sine', vol: 0.05, at: i * 0.05 })); },
    heal() { [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.18, { type: 'sine', vol: 0.08, at: i * 0.07 })); },
    victory() { [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36]].forEach(([n, a]) => tone(N(n), a === 0.36 ? 0.5 : 0.14, { vol: 0.09, at: a })); tone(N(55), 0.6, { type: 'triangle', vol: 0.12, at: 0.36 }); },
    levelup() {
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.12, { vol: 0.07, at: i * 0.07 }));
      [72, 76, 79].forEach(n => tone(N(n), 0.9, { type: 'triangle', vol: 0.09, at: 0.5, attack: 0.03 }));
      noise(0.8, { vol: 0.06, type: 'highpass', f: 4000, at: 0.5 });
    },
    defeat() { [67, 63, 60, 55].forEach((n, i) => tone(N(n), 0.3, { type: 'sawtooth', vol: 0.07, at: i * 0.22 })); },
    error() { tone(150, 0.08, { vol: 0.1 }); tone(120, 0.12, { vol: 0.1, at: 0.1 }); },
    toast() { tone(880, 0.1, { type: 'sine', vol: 0.08 }); tone(1320, 0.2, { type: 'sine', vol: 0.08, at: 0.08 }); },
    regen() { tone(1500, 0.05, { type: 'sine', vol: 0.025, to: 1900 }); },
    chest() { noise(0.15, { vol: 0.15, type: 'lowpass', f: 600 }); S.sparkle(); },
    zzz() { [60, 57, 53].forEach((n, i) => tone(N(n), 0.35, { type: 'sine', vol: 0.06, at: i * 0.25 })); },
    spin() { for (let i = 0; i < 10; i++) tone(600 + i * 60, 0.04, { vol: 0.04, at: i * 0.05 }); },
  };

  /* ---------- musique d'ambiance procédurale (la mineur, sombre et calme) ---------- */
  let musicTimer = null, nextBar = 0, bar = 0;
  const PROG = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]; // Am F G Em
  function scheduleBar(t) {
    const ch = PROG[bar % PROG.length], len = 3.2;
    ch.forEach(n => { // nappe
      [0, 7].forEach(det => {
        const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = N(n - 12); o.detune.value = det - 3; fl.type = 'lowpass'; fl.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 1.0); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
        o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + len + 0.7);
      });
    });
    const bass = ctx.createOscillator(), bg = ctx.createGain(); bass.type = 'triangle'; bass.frequency.value = N(ch[0] - 24);
    bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(0.12, t + 0.3); bg.gain.linearRampToValueAtTime(0.0001, t + len);
    bass.connect(bg); bg.connect(musicBus); bass.start(t); bass.stop(t + len + 0.1);
    const arp = [ch[0], ch[1], ch[2], ch[1] + 12, ch[2], ch[1], ch[0] + 12, ch[2]];
    arp.forEach((n, i) => { if (Math.random() < 0.18) return; // un peu de variation
      const tt = t + i * (len / 8), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = N(n + 12);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.6);
      o.connect(g); g.connect(musicBus); o.start(tt); o.stop(tt + 0.7);
    });
    bar++;
    return len;
  }
  function musicLoop() {
    if (!ctx || !state.music) return;
    while (nextBar < now() + 1.5) nextBar += scheduleBar(Math.max(nextBar, now() + 0.05));
    musicTimer = setTimeout(musicLoop, 400);
  }
  function startMusic() {
    if (!ensure()) return;
    musicBus.gain.cancelScheduledValues(now()); musicBus.gain.setTargetAtTime(0.55 * state.vol, now(), 0.8);
    if (!musicTimer) { nextBar = now() + 0.1; musicLoop(); }
  }
  function stopMusic() {
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
    if (ctx) musicBus.gain.setTargetAtTime(0, now(), 0.3);
  }

  const SFX = {
    play(name, ...a) { if (!state.sound) return; try { ensure(); if (ctx && S[name]) S[name](...a); } catch (e) { /* audio indisponible */ } },
    unlock() { ensure(); if (state.music) startMusic(); },
    set(opts) {
      Object.assign(state, opts);
      if (ctx) { sfxBus.gain.value = state.sound ? state.vol : 0; }
      if (state.music && ctx) startMusic(); else if (!state.music) stopMusic();
    },
    pause() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    get ready() { return !!ctx; },
    names: Object.keys(S),
  };
  root.SFX = SFX;
})(typeof window !== 'undefined' ? window : globalThis);
