/*
 * engine.js — moteur du RPG, port fidèle de rpg/game.py en JavaScript pur.
 * Utilisable dans le navigateur (window.RPG) et dans node (module.exports).
 * Les tirages "seedés" (événement du marché, prix du jour, quêtes) reproduisent
 * exactement random.Random(seed_str) de Python (Mersenne Twister + SHA-512),
 * donc les prix/quêtes du jour sont identiques à la version Python.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RPG = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------- SHA-512 (synchrone, BigInt) ---------------- */
  const K512 = [
    '428a2f98d728ae22','7137449123ef65cd','b5c0fbcfec4d3b2f','e9b5dba58189dbbc','3956c25bf348b538','59f111f1b605d019','923f82a4af194f9b','ab1c5ed5da6d8118',
    'd807aa98a3030242','12835b0145706fbe','243185be4ee4b28c','550c7dc3d5ffb4e2','72be5d74f27b896f','80deb1fe3b1696b1','9bdc06a725c71235','c19bf174cf692694',
    'e49b69c19ef14ad2','efbe4786384f25e3','0fc19dc68b8cd5b5','240ca1cc77ac9c65','2de92c6f592b0275','4a7484aa6ea6e483','5cb0a9dcbd41fbd4','76f988da831153b5',
    '983e5152ee66dfab','a831c66d2db43210','b00327c898fb213f','bf597fc7beef0ee4','c6e00bf33da88fc2','d5a79147930aa725','06ca6351e003826f','142929670a0e6e70',
    '27b70a8546d22ffc','2e1b21385c26c926','4d2c6dfc5ac42aed','53380d139d95b3df','650a73548baf63de','766a0abb3c77b2a8','81c2c92e47edaee6','92722c851482353b',
    'a2bfe8a14cf10364','a81a664bbc423001','c24b8b70d0f89791','c76c51a30654be30','d192e819d6ef5218','d69906245565a910','f40e35855771202a','106aa07032bbd1b8',
    '19a4c116b8d2d0c8','1e376c085141ab53','2748774cdf8eeb99','34b0bcb5e19b48a8','391c0cb3c5c95a63','4ed8aa4ae3418acb','5b9cca4f7763e373','682e6ff3d6b2b8a3',
    '748f82ee5defb2fc','78a5636f43172f60','84c87814a1f0ab72','8cc702081a6439ec','90befffa23631e28','a4506cebde82bde9','bef9a3f7b2c67915','c67178f2e372532b',
    'ca273eceea26619c','d186b8c721c0c207','eada7dd6cde0eb1e','f57d4f7fee6ed178','06f067aa72176fba','0a637dc5a2c898a6','113f9804bef90dae','1b710b35131c471b',
    '28db77f523047d84','32caab7b40c72493','3c9ebe0a15c9bebc','431d67c49c100d4c','4cc5d4becb3e42b6','597f299cfc657e2a','5fcb6fab3ad6faec','6c44198c4a475817'
  ].map(h => BigInt('0x' + h));
  const M64 = (1n << 64n) - 1n;
  const rotr = (x, n) => ((x >> BigInt(n)) | (x << BigInt(64 - n))) & M64;
  function sha512(bytes) {
    const H = ['6a09e667f3bcc908','bb67ae8584caa73b','3c6ef372fe94f82b','a54ff53a5f1d36f1','510e527fade682d1','9b05688c2b3e6c1f','1f83d9abfb41bd6b','5be0cd19137e2179'].map(h => BigInt('0x' + h));
    const len = bytes.length, padLen = ((len + 17 + 127) >> 7) << 7;
    const m = new Uint8Array(padLen); m.set(bytes); m[len] = 0x80;
    const bitLen = BigInt(len) * 8n;
    for (let i = 0; i < 16; i++) m[padLen - 1 - i] = Number((bitLen >> BigInt(8 * i)) & 0xffn);
    const W = new Array(80);
    for (let off = 0; off < padLen; off += 128) {
      for (let t = 0; t < 16; t++) { let w = 0n; for (let b = 0; b < 8; b++) w = (w << 8n) | BigInt(m[off + t * 8 + b]); W[t] = w; }
      for (let t = 16; t < 80; t++) {
        const s0 = rotr(W[t - 15], 1) ^ rotr(W[t - 15], 8) ^ (W[t - 15] >> 7n);
        const s1 = rotr(W[t - 2], 19) ^ rotr(W[t - 2], 61) ^ (W[t - 2] >> 6n);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) & M64;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 80; t++) {
        const S1 = rotr(e, 14) ^ rotr(e, 18) ^ rotr(e, 41);
        const ch = (e & f) ^ (~e & M64 & g);
        const t1 = (h + S1 + ch + K512[t] + W[t]) & M64;
        const S0 = rotr(a, 28) ^ rotr(a, 34) ^ rotr(a, 39);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) & M64;
        h = g; g = f; f = e; e = (d + t1) & M64; d = c; c = b; b = a; a = (t1 + t2) & M64;
      }
      H[0] = (H[0] + a) & M64; H[1] = (H[1] + b) & M64; H[2] = (H[2] + c) & M64; H[3] = (H[3] + d) & M64;
      H[4] = (H[4] + e) & M64; H[5] = (H[5] + f) & M64; H[6] = (H[6] + g) & M64; H[7] = (H[7] + h) & M64;
    }
    const out = new Uint8Array(64);
    for (let i = 0; i < 8; i++) for (let b = 0; b < 8; b++) out[i * 8 + b] = Number((H[i] >> BigInt(56 - 8 * b)) & 0xffn);
    return out;
  }
  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    return Uint8Array.from(Buffer.from(str, 'utf8'));
  }

  /* -------- Python random.Random(str) : MT19937 identique à CPython -------- */
  class PyRandom {
    constructor(seedStr) {
      const enc = utf8(seedStr), dig = sha512(enc);
      const bytes = new Uint8Array(enc.length + 64); bytes.set(enc); bytes.set(dig, enc.length);
      let st = 0; while (st < bytes.length && bytes[st] === 0) st++;
      const key = [];
      for (let end = bytes.length; end > st; end -= 4) {
        let w = 0; for (let i = Math.max(st, end - 4); i < end; i++) w = (w * 256 + bytes[i]) >>> 0;
        key.push(w >>> 0);
      }
      if (!key.length) key.push(0);
      this.mt = new Uint32Array(624); this.mti = 625;
      this.initByArray(key);
    }
    initGenrand(s) {
      const mt = this.mt; mt[0] = s >>> 0;
      for (let i = 1; i < 624; i++) { const p = mt[i - 1] ^ (mt[i - 1] >>> 30); mt[i] = (Math.imul(1812433253, p) + i) >>> 0; }
      this.mti = 624;
    }
    initByArray(key) {
      this.initGenrand(19650218);
      const mt = this.mt, N = 624; let i = 1, j = 0;
      for (let k = Math.max(N, key.length); k; k--) {
        const p = mt[i - 1] ^ (mt[i - 1] >>> 30);
        mt[i] = ((mt[i] ^ Math.imul(p, 1664525)) + key[j] + j) >>> 0;
        i++; j++;
        if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
        if (j >= key.length) j = 0;
      }
      for (let k = N - 1; k; k--) {
        const p = mt[i - 1] ^ (mt[i - 1] >>> 30);
        mt[i] = ((mt[i] ^ Math.imul(p, 1566083941)) - i) >>> 0;
        i++;
        if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
      }
      mt[0] = 0x80000000;
    }
    uint32() {
      const mt = this.mt, N = 624, M = 397; let y;
      if (this.mti >= N) {
        let kk = 0;
        for (; kk < N - M; kk++) { y = (mt[kk] & 0x80000000) | (mt[kk + 1] & 0x7fffffff); mt[kk] = mt[kk + M] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0); }
        for (; kk < N - 1; kk++) { y = (mt[kk] & 0x80000000) | (mt[kk + 1] & 0x7fffffff); mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0); }
        y = (mt[N - 1] & 0x80000000) | (mt[0] & 0x7fffffff); mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0);
        this.mti = 0;
      }
      y = mt[this.mti++];
      y ^= (y >>> 11); y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= (y >>> 18);
      return y >>> 0;
    }
    random() { const a = this.uint32() >>> 5, b = this.uint32() >>> 6; return (a * 67108864 + b) / 9007199254740992; }
    getrandbits(k) { return this.uint32() >>> (32 - k); } // k <= 32
    randbelow(n) { const k = n.toString(2).length; let r = this.getrandbits(k); while (r >= n) r = this.getrandbits(k); return r; }
    randrange(n) { return this.randbelow(n); }
    uniform(a, b) { return a + (b - a) * this.random(); }
    sample(pop, k) { // CPython : branche "pool" (n <= setsize)
      const n = pop.length, pool = pop.slice(), res = new Array(k);
      for (let i = 0; i < k; i++) { const j = this.randbelow(n - i); res[i] = pool[j]; pool[j] = pool[n - i - 1]; }
      return res;
    }
  }

  /* ---------------- données du jeu (identiques à game.py) ---------------- */
  const MAXEN = 50, REGEN = 240; // 1 énergie / 4 min
  const RECIPES = {
    pioche_bois: [{ bois: 3 }, 'Pioche en bois'], pioche_pierre: [{ bois: 2, pierre: 3 }, 'Pioche en pierre'],
    pioche_fer: [{ bois: 2, fer: 3 }, 'Pioche en fer'], pioche_diamant: [{ bois: 2, diamant: 3 }, 'Pioche en diamant'],
    epee_bois: [{ bois: 3 }, 'Épée en bois'], epee_fer: [{ bois: 1, fer: 3 }, 'Épée en fer'], epee_diamant: [{ bois: 1, diamant: 2 }, 'Épée en diamant'],
    armure_cuir: [{ cuir: 4 }, 'Armure en cuir'], armure_fer: [{ fer: 5, cuir: 2 }, 'Armure en fer'], armure_diamant: [{ diamant: 4, fer: 3 }, 'Armure en diamant'],
    potion: [{ herbe: 3 }, 'Potion de soin'], super_potion: [{ herbe: 5, cristal: 1 }, 'Super potion (+150 PV)'],
  };
  const PICK = { aucune: 0, pioche_bois: 1, pioche_pierre: 2, pioche_fer: 3, pioche_diamant: 4 };
  const SWORD = { aucune: 0, epee_bois: 3, epee_fer: 7, epee_diamant: 14 };
  const ARMOR = { aucune: 1.0, armure_cuir: 0.8, armure_fer: 0.55, armure_diamant: 0.3 };
  const BASE = { poisson: 6, perle: 120, bois: 2, pierre: 4, fer: 12, diamant: 80, herbe: 4, cuir: 8, cristal: 150, potion: 15 };
  const SHOP = { pioche_pierre: 20, epee_bois: 10, epee_fer: 90, armure_cuir: 40, armure_fer: 180, potion: 25, super_potion: 120 };
  const MOBS = [['Slime', 20, 3, 10, 5], ['Gobelin', 35, 6, 20, 10], ['Squelette', 50, 9, 35, 18], ['Orc', 80, 13, 60, 30], ['Troll', 120, 18, 110, 55], ['Dragon', 220, 26, 300, 150]];
  const RANKS = [[1, 'Novice'], [3, 'Aventurier'], [5, 'Guerrier'], [8, 'Champion'], [12, 'Légende']];
  const EVENTS = [['⛏️ Ruée vers le fer', 'fer', 1.8], ['💎 Les nobles veulent des diamants', 'diamant', 1.7], ['🌲 Pénurie de bois', 'bois', 2.0],
    ['🌿 Épidémie : les herbes se vendent cher', 'herbe', 2.2], ['🐺 Chasse aux peaux', 'cuir', 1.9], ['📉 Krach des pierres', 'pierre', 0.5], ['🎉 Fête du village : tout +15%', null, 1.15]];
  const ACH = [['Premier sang', 'kills', 1, 50], ['Chasseur', 'kills', 25, 300], ['Exterminateur', 'kills', 100, 1500], ['Bûcheron', 'mined', 100, 200], ['Mineur', 'mined', 400, 800],
    ['Artisan', 'crafted', 10, 300], ['Riche', 'gold', 1000, 0], ['Millionnaire (bientôt)', 'gold', 10000, 2000], ['Fidèle', 'streak', 7, 500], ['Très fidèle', 'streak', 30, 5000],
    ['Niveau 5', 'lvl', 5, 300], ['Niveau 10', 'lvl', 10, 1500], ['Tueur de dragon', 'boss', 1, 1000], ['Explorateur de donjon', 'donjons', 3, 600]];
  const ALIAS = { marche: 'boutique', donjon: 'boss', rappel: 'stats', aide: 'stats', help: 'stats', start: 'stats', retour: 'victoire' };
  const QPOOL = [['mine', 'Récolter {n} ressources', [15, 25, 40], 1.0], ['kills', 'Gagner {n} combats', [2, 4, 6], 1.0],
    ['crafted', 'Fabriquer {n} objet(s)', [1, 2, 3], 1.0], ['fer', 'Miner {n} fer', [2, 4, 6], 1.0], ['earned', 'Gagner {n} or en vendant', [40, 100, 200], 1.0]];

  /* ---------------- helpers façon Python ---------------- */
  const pad2 = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const fdiv = (a, b) => Math.floor(a / b);
  const pmod = (a, b) => ((a % b) + b) % b;
  const pyint = x => Math.trunc(x);
  function pyround(x) { // arrondi bancaire comme round() de Python
    const f = Math.floor(x), diff = x - f;
    if (diff > 0.5) return f + 1; if (diff < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const isDigit = a => /^[0-9]+$/.test(a);
  const daysBetween = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
  const rank = l => RANKS.filter(([m]) => l >= m).map(([, n]) => n).pop();
  const fmt = sec => `${fdiv(sec, 3600)}h${pad2(fdiv(pmod(sec, 3600), 60))}`;

  const seededCache = new Map();
  function seeded(seedStr) { return new PyRandom(seedStr); }
  function event(today) {
    const key = today + 'ev';
    if (!seededCache.has(key)) { const r = seeded(key); seededCache.set(key, EVENTS[r.randrange(EVENTS.length)]); }
    return seededCache.get(key);
  }
  function dayMult(today, k) {
    const key = today + k;
    if (!seededCache.has(key)) { const r = seeded(key); seededCache.set(key, r.uniform(0.7, 1.35)); }
    return seededCache.get(key);
  }
  function dayQuestsRaw(today) {
    const key = today + 'q';
    if (!seededCache.has(key)) { const r = seeded(key); seededCache.set(key, r.sample(QPOOL, 3)); }
    return seededCache.get(key);
  }

  /* ---------------- moteur ---------------- */
  function createEngine(opts) {
    opts = opts || {};
    const storage = opts.storage; // {get():string|null, set(string)}
    const rnd = opts.random || Math.random;
    const clock = opts.now || (() => Date.now()); // ms
    const defaultSave = opts.defaultSave || null;
    let NOW = 0, TODAY = '', YESTERDAY = '';

    function setClock() {
      const ms = clock(); NOW = ms / 1000;
      const d = new Date(ms); TODAY = isoDate(d);
      const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); YESTERDAY = isoDate(y);
    }
    const random = () => rnd();
    const randint = (a, b) => a + Math.floor(random() * (b - a + 1));
    const uniform = (a, b) => a + (b - a) * random();

    function newSave() {
      return { hp: 100, maxhp: 100, lvl: 1, xp: 0, or: 30, inv: {}, pick: 'aucune', sword: 'aucune', armor: 'aucune', kills: 0, mined: 0, crafted: 0, boss: 0, donjons: 0,
        energy: MAXEN, etime: NOW, bank: 0, bday: TODAY, last_daily: '', streak: 0, atelier: 0, atime: NOW, daily: { date: TODAY }, claimed: [], ach: [], sold: {} };
    }
    function load() {
      const s = newSave(); Object.assign(s, { pet: '', ench: 0, floor: 0, exp: null, fishcd: 0 });
      let raw = storage.get();
      if (raw == null && defaultSave) raw = JSON.stringify(defaultSave);
      if (raw != null) Object.assign(s, JSON.parse(raw));
      if (typeof s.armor !== 'string') s.armor = s.armor ? 'armure_fer' : 'aucune';
      return s;
    }
    function save(s) { storage.set(JSON.stringify(s)); }
    const add = (s, k, n = 1) => { s.inv[k] = (s.inv[k] || 0) + n; };
    function regen(s) {
      const n = pyint(fdiv(NOW - s.etime, REGEN));
      if (n > 0) { s.energy = Math.min(MAXEN, s.energy + n); s.etime = s.energy >= MAXEN ? NOW : s.etime + n * REGEN; }
      if (s.energy >= MAXEN) s.etime = NOW;
    }
    const nextreg = s => s.energy < MAXEN ? Math.max(0, pyint(REGEN - pmod(NOW - s.etime, REGEN))) : 0;
    function day(s) {
      if (s.daily.date !== TODAY) { s.daily = { date: TODAY }; s.claimed = []; s.sold = {}; }
      return s.daily;
    }
    const dc = (s, k, n = 1) => { const d = day(s); d[k] = (d[k] || 0) + n; };
    function price(s, k) {
      let m = dayMult(TODAY, k); const e = event(TODAY);
      if (e[1] === null || e[1] === k) m *= e[2];
      m *= Math.max(0.5, 1 - 0.02 * (s.sold[k] || 0) / 5); // saturation du marché
      return Math.max(1, pyround(BASE[k] * m));
    }
    function quests(s) {
      return dayQuestsRaw(TODAY).map(([t, txt, lv]) => {
        const n = lv[Math.min(2, fdiv(s.lvl, 4))];
        return [t, txt.replace('{n}', n), n, 20 + (t !== 'earned' ? n * 3 : fdiv(n, 3)), 15 + (t !== 'earned' ? n * 2 : fdiv(n, 4))];
      });
    }
    function checkq(s) {
      let msg = ''; const d = day(s);
      quests(s).forEach(([t, txt, n, g, x], i) => {
        if (!s.claimed.includes(i) && (d[t] || 0) >= n) {
          s.claimed.push(i); s.or += g; msg += `\n📜 Quête accomplie : ${txt} → +${g} or, +${x} XP` + gain(s, x, true);
        }
      });
      return msg;
    }
    function checkach(s) {
      let msg = ''; const vals = { kills: s.kills, mined: s.mined, crafted: s.crafted, gold: s.or + s.bank, streak: s.streak, lvl: s.lvl, boss: s.boss, donjons: s.donjons };
      for (const [name, k, n, g] of ACH) {
        if (!s.ach.includes(name) && vals[k] >= n) { s.ach.push(name); s.or += g; msg += `\n🏅 SUCCÈS « ${name} » ! +${g} or`; }
      }
      return msg;
    }
    function gain(s, xp) {
      s.xp += xp; let out = '';
      while (s.xp >= s.lvl * 60) {
        s.xp -= s.lvl * 60; s.lvl += 1; s.maxhp += 15; s.hp = s.maxhp;
        out += `\n🎉 NIVEAU ${s.lvl} ! Rang : ${rank(s.lvl)}. PV max ${s.maxhp}, soins complets.`;
      }
      return out;
    }
    function spend(s, n) {
      if (s.energy < n) return false;
      if (s.energy >= MAXEN) s.etime = NOW;
      s.energy -= n; return true;
    }
    const noen = (s, n) => `⚡ Pas assez d'énergie (${s.energy}/${MAXEN}, il en faut ${n}). +1 toutes les 4 min — prochaine dans ${fdiv(nextreg(s), 60)}min ${nextreg(s) % 60}s. Tu peux aussi /daily ou /dormir.`;
    function mine(s, kind) {
      const p = PICK[s.pick];
      const need = { pierre: 1, fer: 2, diamant: 3 }[kind] || 0;
      if (p < need) return '⛏️ Il te faut une meilleure pioche (/recettes).';
      if (!spend(s, 1)) return noen(s, 1);
      const bonus = 1 + (p >= 3 && random() < 0.3 ? 1 : 0);
      if (kind === 'diamant' && random() < 0.5) { dc(s, 'mine'); return '💎 Tu creuses... rien cette fois. (-1 ⚡)'; }
      const base = { bois: () => randint(1, 3), pierre: () => randint(1, 3), fer: () => randint(1, 2), diamant: () => 1, herbe: () => randint(1, 3) };
      // Python évalue les 5 tirages du dict ; on les consomme aussi pour garder le même nombre d'appels
      const rolls = {}; for (const k of ['bois', 'pierre', 'fer', 'diamant', 'herbe']) rolls[k] = base[k]();
      const n = rolls[kind] * (kind !== 'diamant' ? bonus : 1);
      const xp = { bois: 3, pierre: 4, fer: 8, diamant: 25, herbe: 2 }[kind]; add(s, kind, n); s.mined += n; dc(s, 'mine', n);
      if (kind === 'fer') dc(s, 'fer', n);
      const ic = { bois: '🪓', pierre: '⛏️', fer: '⛏️', diamant: '💎', herbe: '🌿' }[kind];
      let extra = '';
      if (random() < 0.04) { add(s, 'cristal'); extra = '\n✨ TROUVAILLE RARE : un cristal magique !'; }
      return `${ic} +${n} ${kind}${bonus > 1 ? ' (pioche chanceuse x2 !)' : ''}${extra}\n⚡ ${s.energy}/${MAXEN}` + gain(s, xp);
    }
    const attack = s => 5 + SWORD[s.sword] + s.lvl * 2 + s.ench * 3 + (s.pet ? 4 : 0);
    function fight(s, idx, boss = false) {
      let [name, hp, dmg, xp, gold] = MOBS[Math.min(idx, MOBS.length - 1)];
      const atk = attack(s), red = ARMOR[s.armor];
      const log = [`⚔️ Un ${name} apparaît ! (${hp} PV)`];
      while (hp > 0 && s.hp > 0) {
        hp -= randint(atk - 3, atk + 3);
        if (hp <= 0) break;
        s.hp -= Math.max(1, pyint(randint(dmg - 2, dmg + 2) * red));
      }
      if (s.hp <= 0) {
        s.hp = fdiv(s.maxhp, 2); const lost = fdiv(s.or, 2); s.or -= lost;
        return [log.join('\n') + `\n💀 Tu es mort ! Tu perds ${lost} or (l'or en banque est protégé 🏦) et reviens avec ${s.hp} PV.`, false];
      }
      if (s.pet) gold = pyint(gold * 1.1) + 1;
      s.or += gold; s.kills += 1; dc(s, 'kills');
      let loot = '';
      for (const [it, pr, q] of [['cuir', 0.5, [1, 2]], ['herbe', 0.4, [1, 2]], ['fer', 0.2, [1, 1]], ['cristal', !boss ? 0.05 : 1, [1, 1]]]) {
        if (random() < pr) { const n = randint(q[0], q[1]); add(s, it, n); loot += ` +${n} ${it}`; }
      }
      if (boss) { s.boss += 1; add(s, 'diamant', 3); loot += ' +3 diamant'; }
      return [log.join('\n') + `\n🏆 Victoire ! +${gold} or, +${xp} XP.${loot ? ' Butin :' + loot : ''}\n❤️ ${s.hp}/${s.maxhp}` + gain(s, xp), true];
    }
    function status(s) {
      const out = [];
      if (s.last_daily !== TODAY) out.push("🎁 Ta récompense quotidienne t'attend (/daily)");
      const n = quests(s).length - s.claimed.length;
      if (n) out.push(`📜 ${n} quête(s) du jour à faire (/quetes)`);
      if (s.atelier > 0) {
        const g = pyint(Math.min(12, (NOW - s.atime) / 3600) * s.atelier * 3);
        if (g > 0) out.push(`🏭 Ton atelier a produit ${g} or (/collecter)`);
      }
      if (s.exp && NOW >= s.exp.end) out.push('🧭 Ton expédition est terminée ! (/retour)');
      out.push(`⚡ Énergie ${s.energy}/${MAXEN}`);
      if (s.bank > 0) out.push(`🏦 ${s.bank} or en banque (+2%/jour)`);
      out.push(`${event(TODAY)[0]} aujourd'hui (/marche)`);
      return out;
    }

    function runText(cmd, args) {
      let s = load(); regen(s); day(s);
      let pre = '';
      if (s.bday !== TODAY) { // intérêts bancaires
        const dd = daysBetween(s.bday, TODAY);
        if (s.bank > 0 && dd > 0) {
          const nb = pyint(s.bank * Math.pow(1.02, Math.min(dd, 30))); const gb = nb - s.bank; s.bank = nb;
          pre = `🏦 Intérêts bancaires : +${gb} or\n`;
        }
        s.bday = TODAY;
      }
      const a = args && args.length ? String(args[0]) : '';
      const done = (r, mut = true) => { r = pre + r; if (mut) r += checkq(s) + checkach(s); save(s); return r; };

      if (cmd === 'reset') { s = newSave(); save(s); return '🔄 Nouvelle partie.'; }
      if (['start', 'aide', 'help'].includes(cmd))
        return '🗡️ RPG v2 — commandes\n⛏️ Récolte (1⚡) : /mine /minepierre /minefer /minediamant /herbe\n🔨 /craft <objet> · /recettes\n⚔️ /combat (3⚡) · /donjon (15⚡) · /boss (10⚡, niv 5+)\n🧪 /soin · /dormir (5 or, +20⚡)\n💰 /marche (prix du jour) · /vendre <ressource|tout> · /boutique · /acheter <objet>\n🏦 /banque · /deposer <n|tout> · /retirer <n|tout>\n🏭 /atelier (revenus passifs) · /collecter\n📅 /daily · /quetes · /succes\n🎣 /pecher · /manger · 🧭 /expedition · /retour · 🗼 /tour · 🐾 /animal · ✨ /enchanter · 🎰 /pari <n>\n🏰 /lobby\n📊 /stats · /inventaire · /rappel · /reset';
      if (cmd === 'lobby' || cmd === 'menu') return '🏰 LOBBY — ' + `${rank(s.lvl)} niv ${s.lvl} · XP ${s.xp}/${s.lvl * 60}`;
      if (cmd === 'rappel') return ['📅 Résumé du jour :'].concat(status(s)).join('\n');
      if (cmd === 'stats')
        return `📊 ${rank(s.lvl)} · Niv ${s.lvl} · XP ${s.xp}/${s.lvl * 60} · ❤️ ${s.hp}/${s.maxhp} · ⚡ ${s.energy}/${MAXEN}\n💰 ${s.or} or · 🏦 ${s.bank} · Kills ${s.kills} · Série 🔥 ${s.streak}j\nPioche: ${s.pick} · Épée: ${s.sword} · Armure: ${s.armor} · Atelier niv ${s.atelier}\n🐾 ${s.pet || 'aucun'} · ✨ Ench. ${s.ench}/5 · 🗼 Tour étage ${s.floor}`;
      if (cmd === 'inventaire') return '🎒 ' + (Object.entries(s.inv).filter(([, v]) => v).map(([k, v]) => `${k} x${v}`).join(', ') || 'vide') + ` · 💰 ${s.or}`;
      if (cmd === 'recettes') return '🔨 Recettes :\n' + Object.entries(RECIPES).map(([k, v]) => `${k}: ` + Object.entries(v[0]).map(([r, n]) => `${n} ${r}`).join(', ')).join('\n') + '\n(cuir et cristal tombent des monstres ; le cristal peut aussi se trouver en minant)';
      if (cmd === 'marche') {
        const e = event(TODAY);
        return `🏪 Marché du ${TODAY}\nÉvénement : ${e[0]}\n` + Object.keys(BASE).map(k => `${k}: ${price(s, k)} or (base ${BASE[k]})`).join('\n') + "\n💡 Vends quand c'est cher, et évite de saturer le marché (le prix baisse si tu vends beaucoup).";
      }
      if (['mine', 'minepierre', 'minefer', 'minediamant', 'herbe'].includes(cmd))
        return done(mine(s, { mine: 'bois', minepierre: 'pierre', minefer: 'fer', minediamant: 'diamant', herbe: 'herbe' }[cmd]));
      if (cmd === 'craft') {
        if (!(a in RECIPES)) return '❓ Objet inconnu, tape /recettes.';
        const [need, label] = RECIPES[a];
        if (Object.entries(need).some(([k, n]) => (s.inv[k] || 0) < n)) return '❌ Ressources insuffisantes : ' + Object.entries(need).map(([k, n]) => `${n} ${k}`).join(', ');
        for (const [k, n] of Object.entries(need)) s.inv[k] -= n;
        if (a.startsWith('pioche')) s.pick = a; else if (a.startsWith('epee')) s.sword = a; else if (a.startsWith('armure')) s.armor = a; else add(s, a);
        s.crafted += 1; dc(s, 'crafted');
        return done(`🔨 Tu as fabriqué : ${label} !` + gain(s, 10));
      }
      if (cmd === 'combat') {
        if (s.hp < 20) return '🩸 Trop faible, soigne-toi (/soin ou /dormir).';
        if (!spend(s, 3)) return noen(s, 3);
        const [r] = fight(s, Math.min(fdiv(s.lvl, 2), 4)); return done(r + `\n⚡ ${s.energy}/${MAXEN}`);
      }
      if (cmd === 'boss') {
        if (s.lvl < 5) return '🐉 Reviens au niveau 5 minimum.';
        if (s.hp < s.maxhp * 0.6) return "🩸 Soigne-toi avant d'affronter le dragon (60% PV mini).";
        if (!spend(s, 10)) return noen(s, 10);
        const [r] = fight(s, 5, true); return done(r);
      }
      if (cmd === 'donjon') {
        if (s.lvl < 3) return '🏰 Donjon dès le niveau 3.';
        if (s.hp < s.maxhp * 0.7) return '🩸 Il faut 70% de tes PV.';
        if (!spend(s, 15)) return noen(s, 15);
        const out = ['🏰 Tu entres dans le donjon (3 étages)...']; let ok = true;
        for (let fl = 0; fl < 3; fl++) {
          let r; [r, ok] = fight(s, Math.min(fdiv(s.lvl, 2) + fl, 4)); out.push(`— Étage ${fl + 1} —\n` + r);
          if (!ok) break;
        }
        if (ok) { s.donjons += 1; const g = 100 + 30 * s.lvl; s.or += g; add(s, 'cristal'); out.push(`🎁 Coffre du donjon : +${g} or et 1 cristal !`); }
        return done(out.join('\n'));
      }
      if (cmd === 'soin') {
        for (const [k, h] of [['super_potion', 150], ['potion', 50]]) {
          if ((s.inv[k] || 0) > 0 && (a === '' || a === k || (a === 'super' && k === 'super_potion'))) {
            s.inv[k] -= 1; s.hp = Math.min(s.maxhp, s.hp + h); return done(`🧪 ${k} utilisée. ❤️ ${s.hp}/${s.maxhp}`, false);
          }
        }
        return '❌ Pas de potion (/craft potion ou /acheter potion).';
      }
      if (cmd === 'dormir') {
        if (s.or < 5) return '❌ Il te faut 5 or.';
        s.or -= 5; s.hp = s.maxhp; s.energy = Math.min(MAXEN, s.energy + 20); return done("😴 Nuit à l'auberge : ❤️ au max et +20 ⚡.", false);
      }
      if (cmd === 'vendre') {
        // Extension web : 2e argument optionnel = quantité (sans quantité : tout le stock, comme en Python)
        const qArg = args && args.length > 1 ? String(args[1]) : '';
        const items = (a === 'tout' || a === '') ? Object.keys(BASE) : [a];
        let tot = 0; const lines = [];
        for (const k of items) {
          let n = s.inv[k] || 0;
          if (!(k in BASE) || n < 1 || ((a === 'tout' || a === '') && (k === 'cristal' || k === 'potion'))) continue;
          if (qArg && isDigit(qArg) && +qArg > 0) n = Math.min(n, +qArg);
          const p = price(s, k); let g = 0;
          for (let i = 0; i < n; i++) g += Math.max(1, pyint(p * Math.max(0.5, 1 - 0.02 * ((s.sold[k] || 0) + i) / 5)));
          s.sold[k] = (s.sold[k] || 0) + n; s.inv[k] -= n; tot += g; lines.push(`${n} ${k} → ${g} or`);
        }
        if (!lines.length) return '❌ Rien à vendre (les cristaux/potions ne sont vendus que sur demande : /vendre cristal).';
        s.or += tot; dc(s, 'earned', tot); return done('💰 Vente :\n' + lines.join('\n') + `\nTotal : +${tot} or`);
      }
      if (cmd === 'boutique') return '🏪 Boutique (prix fixes) :\n' + Object.entries(SHOP).map(([k, v]) => `${k}: ${v} or`).join('\n') + '\n/acheter <objet>';
      if (cmd === 'acheter') {
        if (!(a in SHOP)) return '❓ Pas en vente.';
        if (s.or < SHOP[a]) return "❌ Pas assez d'or.";
        s.or -= SHOP[a];
        if (a.startsWith('pioche')) s.pick = a; else if (a.startsWith('epee')) s.sword = a; else if (a.startsWith('armure')) s.armor = a; else add(s, a);
        return done(`🛒 Acheté : ${a}.`, false);
      }
      if (cmd === 'banque') return `🏦 Banque : ${s.bank} or (+2%/jour, protégé contre la mort). Sur toi : ${s.or} or.\n/deposer <n|tout> · /retirer <n|tout>`;
      if (cmd === 'deposer' || cmd === 'retirer') {
        const [src, dst] = cmd === 'deposer' ? ['or', 'bank'] : ['bank', 'or'];
        const n = a === 'tout' ? s[src] : (isDigit(a) ? parseInt(a, 10) : 0);
        if (n <= 0 || n > s[src]) return '❌ Montant invalide.';
        s[src] -= n; s[dst] += n; return done(`🏦 ${n} or ${cmd === 'deposer' ? 'déposés' : 'retirés'}. Banque : ${s.bank} · Sur toi : ${s.or}`);
      }
      if (cmd === 'daily') {
        if (s.last_daily === TODAY) return "🎁 Déjà récupéré aujourd'hui. Reviens demain pour garder ta série ! 🔥 " + s.streak;
        s.streak = s.last_daily === YESTERDAY ? s.streak + 1 : 1; s.last_daily = TODAY;
        const g = 50 + Math.min(s.streak, 30) * 10; s.energy = Math.min(MAXEN, s.energy + 20);
        let r = `🎁 Récompense du jour : +${g} or, +20 ⚡\n🔥 Série : ${s.streak} jour(s)`; s.or += g;
        if (s.streak % 7 === 0) { add(s, 'cristal', 1); add(s, 'diamant', 2); r += '\n🎊 BONUS 7 jours : coffre → +1 cristal, +2 diamants !'; }
        else r += `\n(Coffre bonus dans ${7 - s.streak % 7} jour(s))`;
        return done(r);
      }
      if (cmd === 'quetes') {
        const d = day(s); const out = ['📜 Quêtes du jour :'];
        quests(s).forEach(([t, txt, n, g, x], i) => out.push(`${s.claimed.includes(i) ? '✅' : '▫️'} ${txt} — ${Math.min(d[t] || 0, n)}/${n} (→ ${g} or, ${x} XP)`));
        return done(out.join('\n') + '\nElles se renouvellent chaque jour.');
      }
      if (cmd === 'atelier') {
        const cost = 100 * (s.atelier + 1) ** 2;
        if (['upgrade', 'ameliorer', 'améliorer'].includes(a)) {
          if (s.or < cost) return `❌ Il faut ${cost} or.`;
          s.or -= cost;
          if (s.atelier <= 0) s.atime = NOW;
          s.atelier += 1; return done(`🏭 Atelier niveau ${s.atelier} ! Il produit ${s.atelier * 3} or/heure (max 12h stockées).`, false);
        }
        return `🏭 Atelier niveau ${s.atelier} : ${s.atelier * 3} or/heure, stock max 12h. Amélioration → niveau ${s.atelier + 1} : ${cost} or (/atelier upgrade). Collecte avec /collecter.`;
      }
      if (cmd === 'collecter') {
        if (s.atelier < 1) return "🏭 Tu n'as pas d'atelier : /atelier upgrade (100 or).";
        const g = pyint(Math.min(12, (NOW - s.atime) / 3600) * s.atelier * 3); s.atime = NOW;
        if (g < 1) return "🏭 Rien à collecter pour l'instant.";
        s.or += g; return done(`🏭 Tu collectes ${g} or produits pendant ton absence.`, false);
      }
      if (cmd === 'succes') return '🏅 Succès :\n' + ACH.map(([n]) => `${s.ach.includes(n) ? '✅' : '▫️'} ${n}`).join('\n');
      if (cmd === 'pecher') {
        if (!spend(s, 1)) return noen(s, 1);
        const r = random();
        if (r < 0.2) return done(`🎣 Rien ne mord... ⚡ ${s.energy}/${MAXEN}`, false);
        if (r < 0.25) { add(s, 'perle'); return done('🎣 Tu remontes une **perle** brillante ! (vaut ~120 or)' + gain(s, 20)); }
        const n = randint(1, 3); add(s, 'poisson', n); dc(s, 'mine', n); s.mined += n; return done(`🎣 +${n} poisson(s) ! (/manger pour +25 ❤️) ⚡ ${s.energy}/${MAXEN}` + gain(s, 3));
      }
      if (cmd === 'manger') {
        if ((s.inv.poisson || 0) < 1) return '❌ Pas de poisson (/pecher).';
        s.inv.poisson -= 1; s.hp = Math.min(s.maxhp, s.hp + 25); return done(`🍣 Miam ! ❤️ ${s.hp}/${s.maxhp}`, false);
      }
      if (cmd === 'expedition') {
        if (s.exp) {
          const left = pyint(s.exp.end - NOW);
          return left > 0 ? `🧭 Expédition en cours, retour dans ${fmt(Math.max(0, left))} (/retour).` : '🧭 Ton expédition est terminée ! Tape /retour.';
        }
        if (s.lvl < 2) return '🧭 Expéditions dès le niveau 2.';
        const kind = (a === 'courte' || a === 'longue') ? a : '';
        if (!kind) return "🧭 Envoie ton héros explorer pendant que tu n'es pas là :\n/expedition courte (30 min, 5⚡)\n/expedition longue (4 h, 12⚡, gros butin)\nReviens avec /retour.";
        const [cost, dur] = kind === 'courte' ? [5, 1800] : [12, 14400];
        if (!spend(s, cost)) return noen(s, cost);
        s.exp = { end: NOW + dur, kind }; return done(`🧭 Expédition ${kind} lancée ! Retour dans ${fmt(dur)}. Je te préviendrai si tu me le demandes (/retour pour récupérer).`, false);
      }
      if (cmd === 'retour') {
        if (!s.exp) return '🧭 Aucune expédition en cours (/expedition).';
        if (NOW < s.exp.end) return `🧭 Pas encore revenu : encore ${fmt(pyint(s.exp.end - NOW))}.`;
        const k = s.exp.kind, m = k === 'courte' ? 1 : 4; s.exp = null;
        const g = pyint((30 + s.lvl * 8) * m * uniform(0.8, 1.3)); s.or += g; const loot = [];
        for (const [it, pr, q] of [['fer', 0.7, [2, 4]], ['diamant', 0.35 * Math.sqrt(m), [1, 2]], ['cuir', 0.6, [1, 3]], ['cristal', 0.1 * m, [1, 1]], ['perle', 0.1 * m, [1, 1]]]) {
          if (random() < pr) { const n = randint(q[0], q[1]); add(s, it, n); loot.push(`${n} ${it}`); }
        }
        return done(`🧭 Ton héros revient de l'expédition ${k} : +${g} or` + (loot.length ? ', ' + loot.join(', ') : '') + gain(s, 40 * m));
      }
      if (cmd === 'pari') {
        let n = a === 'tout' ? s.or : (isDigit(a) ? parseInt(a, 10) : 0);
        if (n < 5 || n > s.or) return "🎰 Usage : /pari <montant> (min 5, tu dois avoir l'or). 45% de chance de doubler !";
        n = Math.min(n, 500);
        if (random() < 0.45) { s.or += n; return done(`🎰 GAGNÉ ! +${n} or 🤑`, false); }
        s.or -= n; return done(`🎰 Perdu... -${n} or 😭 (la maison gagne souvent)`, false);
      }
      if (cmd === 'animal') {
        if (s.pet) return `🐺 Ton compagnon : ${s.pet} (+4 attaque, +10% d'or sur les victoires).`;
        if (!['loup', 'faucon', 'renard'].includes(a)) return "🐾 Adopte un compagnon pour 300 or : /animal loup | faucon | renard (+4 attaque, +10% d'or).";
        if (s.or < 300) return '❌ Il faut 300 or.';
        s.or -= 300; s.pet = a; return done(`🐾 Tu adoptes un ${a} ! Il t'accompagne dans tous tes combats.`, false);
      }
      if (cmd === 'enchanter') {
        if (s.ench >= 5) return "✨ Épée déjà au niveau d'enchantement maximum (5).";
        const cost = s.ench + 1;
        if ((s.inv.cristal || 0) < cost || s.or < 100 * cost) return `✨ Enchantement niv ${s.ench + 1} : ${cost} cristal(aux) + ${100 * cost} or (+3 attaque).`;
        s.inv.cristal -= cost; s.or -= 100 * cost; s.ench += 1; return done(`✨ Épée enchantée niveau ${s.ench} ! (+${s.ench * 3} attaque)`, false);
      }
      if (cmd === 'tour') {
        if (s.hp < s.maxhp * 0.5) return "🩸 Soigne-toi d'abord (50% PV mini).";
        if (!spend(s, 5)) return noen(s, 5);
        const f = s.floor + 1, idx = Math.min(fdiv(f, 4), 5);
        let [name, hp, dmg, xp, gold] = MOBS[idx]; const k = 1 + f * 0.12;
        const atk = attack(s); hp = pyint(hp * k); dmg = pyint(dmg * k);
        while (hp > 0 && s.hp > 0) {
          hp -= randint(atk - 3, atk + 3);
          if (hp <= 0) break;
          s.hp -= Math.max(1, pyint(randint(Math.max(1, dmg - 2), dmg + 2) * ARMOR[s.armor]));
        }
        if (s.hp <= 0) { s.hp = fdiv(s.maxhp, 2); return done(`🗼 Étage ${f} : un ${name} te terrasse ! Tu restes à l'étage ${s.floor} (record). ❤️ ${s.hp}/${s.maxhp}`, false); }
        s.floor = f; const g = pyint(gold * k) + 10 * f; s.or += g; let r = `🗼 Tour infinie — **étage ${f}** vaincu (${name}) : +${g} or, ❤️ ${s.hp}/${s.maxhp}`;
        if (f % 5 === 0) { add(s, 'cristal'); r += '\n🎁 Palier de 5 étages : +1 cristal !'; }
        return done(r + gain(s, xp));
      }
      // --- commandes d'info ajoutées pour le web (les vidéos existaient déjà) ---
      if (cmd === 'rangs') return '🎖️ Rangs :\n' + RANKS.map(([m, n]) => `${s.lvl >= m ? '✅' : '▫️'} ${n} — niveau ${m}+`).join('\n') + `\nTu es ${rank(s.lvl)} (niv ${s.lvl}).`;
      if (cmd === 'ennemis') return '👹 Bestiaire :\n' + MOBS.map(([n, hp, dmg, xp, g]) => `${n} — ${hp} PV, ${dmg} dégâts · +${xp} XP, +${g} or`).join('\n') + `\n⚔️ Ton attaque : ${attack(s)} · 🛡️ dégâts subis x${ARMOR[s.armor]}`;
      return '❓ Commande inconnue, tape /aide.';
    }

    /* Choix des scènes vidéo (même logique que le bas de game.py, enrichie
       d'une séquence : la scène de la commande puis victoire/mort/niveau). */
    function mediaFor(cmd, out) {
      let img = ALIAS[cmd] || cmd;
      if (['combat', 'boss', 'donjon', 'tour'].includes(cmd))
        img = out.includes('Tu es mort') ? 'mort' : (out.includes('Victoire') ? 'victoire' : img);
      if (['combat', 'boss', 'donjon'].includes(cmd) && out.includes('NIVEAU') && !img.includes('mort')) img = 'niveau';
      else if (out.includes('NIVEAU') && !['combat', 'boss', 'donjon'].includes(cmd)) img = 'niveau';
      // Extension web : la tour n'écrit ni « Victoire » ni « Tu es mort » -> on détecte ses propres messages
      if (cmd === 'tour' && img === 'tour') img = out.includes('te terrasse') ? 'mort' : (out.includes('vaincu') ? 'victoire' : 'tour');
      const first = ALIAS[cmd] || cmd;
      const seq = [first];
      if (img !== first) seq.push(img);
      return seq.filter(v => VIDEOS.includes(v));
    }

    function run(cmd, args) {
      setClock();
      cmd = String(cmd || '').replace(/^\/+/, '').toLowerCase();
      const text = runText(cmd, args || []);
      return { text, media: mediaFor(cmd, text) };
    }

    /* Vue lecture seule pour le HUD / l'UI (ne sauvegarde rien, comme le chargement Python) */
    function view() {
      setClock();
      const s = load(); regen(s); day(s);
      if (s.bday !== TODAY && s.bank > 0) { const dd = daysBetween(s.bday, TODAY); if (dd > 0) s.bank = pyint(s.bank * Math.pow(1.02, Math.min(dd, 30))); }
      const q = quests(s), d = s.daily;
      return {
        s, rank: rank(s.lvl), today: TODAY, now: NOW, nextreg: nextreg(s), maxen: MAXEN,
        prices: Object.fromEntries(Object.keys(BASE).map(k => [k, price(s, k)])), event: event(TODAY),
        quests: q.map(([t, txt, n, g, x], i) => ({ t, txt, n, g, x, prog: Math.min(d[t] || 0, n), done: s.claimed.includes(i) })),
        atelierReady: s.atelier > 0 ? pyint(Math.min(12, (NOW - s.atime) / 3600) * s.atelier * 3) : 0,
        atelierCost: 100 * (s.atelier + 1) ** 2, dailyReady: s.last_daily !== TODAY, attack: attack(s),
        expLeft: s.exp ? Math.max(0, pyint(s.exp.end - NOW)) : null,
      };
    }
    function exportSave() { setClock(); return JSON.stringify(load()); }
    function importSave(txt) {
      const o = JSON.parse(txt);
      if (!o || typeof o !== 'object' || typeof o.lvl !== 'number' || typeof o.inv !== 'object') throw new Error('Sauvegarde invalide');
      save(o);
    }
    return { run, view, exportSave, importSave, fmt };
  }

  const VIDEOS = ['acheter', 'animal', 'atelier', 'banque', 'boss', 'boutique', 'collecter', 'combat', 'craft', 'daily', 'deposer', 'dormir', 'enchanter', 'ennemis',
    'expedition', 'herbe', 'inventaire', 'manger', 'mine', 'minediamant', 'minefer', 'minepierre', 'mort', 'niveau', 'pari', 'pecher', 'quetes', 'rangs',
    'recettes', 'retirer', 'soin', 'stats', 'succes', 'tour', 'vendre', 'victoire'];

  return { createEngine, PyRandom, sha512, MAXEN, REGEN, RECIPES, PICK, SWORD, ARMOR, BASE, SHOP, MOBS, RANKS, EVENTS, ACH, ALIAS, VIDEOS, rank, pyround };
});
