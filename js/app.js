/* app.js — interface web du RPG (HUD, scène vidéo, récit, commandes). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY_SAVE = 'rpg_nathan_save', KEY_LOG = 'rpg_nathan_log', KEY_MUTE = 'rpg_nathan_muted', KEY_TAB = 'rpg_nathan_tab';

  /* ---------- stockage (localStorage, repli mémoire si indisponible) ---------- */
  const mem = {};
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } },
  };
  const engine = RPG.createEngine({
    storage: { get: () => ls.get(KEY_SAVE), set: v => ls.set(KEY_SAVE, v) },
    defaultSave: window.RPG_DEFAULT_SAVE,
  });

  /* ---------- données d'affichage ---------- */
  const RANK_COL = { 'Novice': '#a06e3c', 'Aventurier': '#9696a0', 'Guerrier': '#c8463c', 'Champion': '#f0c83c', 'Légende': '#5ac8ff' };
  const ITEM = { bois: ['🪵', 'Bois'], pierre: ['🪨', 'Pierre'], fer: ['🔩', 'Fer'], diamant: ['💎', 'Diamant'], herbe: ['🌿', 'Herbe'], cuir: ['🟫', 'Cuir'],
    cristal: ['🔮', 'Cristal'], potion: ['🧪', 'Potion'], super_potion: ['⚗️', 'Super potion'], poisson: ['🐟', 'Poisson'], perle: ['⚪', 'Perle'] };
  const EQUIP_IC = k => k.startsWith('pioche') ? '⛏️' : k.startsWith('epee') ? '🗡️' : k.startsWith('armure') ? '🛡️' : (ITEM[k] || ['📦'])[0];
  const DESC = { pioche_bois: 'Permet de miner la pierre', pioche_pierre: 'Permet de miner le fer', pioche_fer: 'Mine le diamant · 30% double récolte',
    pioche_diamant: 'Pioche ultime · 30% double récolte', epee_bois: '+3 attaque', epee_fer: '+7 attaque', epee_diamant: '+14 attaque',
    armure_cuir: '-20% de dégâts subis', armure_fer: '-45% de dégâts subis', armure_diamant: '-70% de dégâts subis', potion: '+50 PV', super_potion: '+150 PV' };
  const SCENE = { mine: '🪓 Forêt', herbe: '🌿 Prairie', minepierre: '⛏️ Carrière', minefer: '⛏️ Mine de fer', minediamant: '💎 Mine profonde', pecher: '🎣 Lac',
    craft: '🔨 Forge', recettes: '📖 Grimoire', combat: '⚔️ Combat', victoire: '🏆 Victoire !', mort: '💀 Défaite…', niveau: '🎉 Niveau supérieur !',
    boss: '🐉 Antre du dragon', tour: '🗼 Tour infinie', soin: '🧪 Soin', manger: '🍣 Repas', dormir: '😴 Auberge', enchanter: '✨ Enchanteur',
    ennemis: '👹 Bestiaire', expedition: '🧭 Expédition', animal: '🐾 Compagnon', pari: '🎰 Taverne', boutique: '🏪 Marché', vendre: '💰 Vente',
    acheter: '🛒 Boutique', banque: '🏦 Banque', deposer: '🏦 Dépôt', retirer: '🏦 Retrait', atelier: '🏭 Atelier', collecter: '🏭 Collecte',
    daily: '🎁 Récompense du jour', quetes: '📜 Quêtes', succes: '🏅 Succès', stats: '📊 Statistiques', inventaire: '🎒 Inventaire', rangs: '🎖️ Rangs' };

  const MAXEN = RPG.MAXEN;
  const en = n => v => v.s.energy < n ? `⚡${v.s.energy}/${n}` : null;
  const all = (...fs) => v => { for (const f of fs) { const r = f(v); if (r) return r; } return null; };
  const lvl = n => v => v.s.lvl < n ? `🔒 niv ${n}` : null;
  const hpPct = p => v => v.s.hp < v.s.maxhp * p ? `🩸 ${Math.round(p * 100)}% PV` : null;
  const pick = n => v => RPG.PICK[v.s.pick] < n ? `🔒 ${['', 'pioche bois', 'pioche pierre', 'pioche fer'][n]}` : null;
  const gold = n => v => v.s.or < n ? `💰 ${n} or` : null;
  const cnt = k => v => v.s.inv[k] || 0;

  const CATS = [
    { id: 'recolter', ic: '🌲', lb: 'Récolter', col: '#50aa50', cmds: [
      { c: 'mine', ic: '🪓', lb: 'Bois', sb: () => '1⚡', lock: en(1) },
      { c: 'herbe', ic: '🌿', lb: 'Herbe', sb: () => '1⚡', lock: en(1) },
      { c: 'minepierre', ic: '🪨', lb: 'Pierre', sb: () => '1⚡', lock: all(pick(1), en(1)) },
      { c: 'minefer', ic: '⛏️', lb: 'Fer', sb: () => '1⚡', lock: all(pick(2), en(1)) },
      { c: 'minediamant', ic: '💎', lb: 'Diamant', sb: () => '1⚡ · 50%', lock: all(pick(3), en(1)) },
      { c: 'pecher', ic: '🎣', lb: 'Pêcher', sb: () => '1⚡', lock: en(1) },
      { c: 'craft', ic: '🔨', lb: 'Fabriquer', sb: v => `${craftable(v)} possible(s)`, picker: pickCraft, dot: v => craftable(v) || 0 },
      { c: 'recettes', ic: '📖', lb: 'Recettes', sb: () => 'liste' },
      { c: 'inventaire', ic: '🎒', lb: 'Sac', sb: v => `${Object.values(v.s.inv).reduce((a, b) => a + b, 0)} objets` },
    ] },
    { id: 'combat', ic: '⚔️', lb: 'Combat', col: '#c8463c', cmds: [
      { c: 'combat', ic: '⚔️', lb: 'Combattre', sb: () => '3⚡', lock: v => v.s.hp < 20 ? '🩸 20 PV' : en(3)(v) },
      { c: 'donjon', ic: '🏰', lb: 'Donjon', sb: () => '15⚡ · 3 étages', lock: all(lvl(3), hpPct(0.7), en(15)) },
      { c: 'boss', ic: '🐉', lb: 'Dragon', sb: () => '10⚡', lock: all(lvl(5), hpPct(0.6), en(10)) },
      { c: 'tour', ic: '🗼', lb: 'Tour', sb: v => `5⚡ · étage ${v.s.floor + 1}`, lock: all(hpPct(0.5), en(5)) },
      { c: 'soin', ic: '🧪', lb: 'Soin', sb: v => `${cnt('potion')(v)} pot. · ${cnt('super_potion')(v)} super`, lock: v => (cnt('potion')(v) + cnt('super_potion')(v)) ? null : '0 potion', picker: pickSoin },
      { c: 'manger', ic: '🍣', lb: 'Manger', sb: v => `🐟 x${cnt('poisson')(v)} · +25❤️`, lock: v => cnt('poisson')(v) ? null : '0 poisson' },
      { c: 'dormir', ic: '😴', lb: 'Dormir', sb: () => '5 or · +20⚡', lock: gold(5) },
      { c: 'enchanter', ic: '✨', lb: 'Enchanter', sb: v => v.s.ench >= 5 ? 'max 5/5' : `${v.s.ench + 1}🔮 + ${100 * (v.s.ench + 1)} or`,
        lock: v => v.s.ench >= 5 ? 'max' : ((v.s.inv.cristal || 0) < v.s.ench + 1 ? `🔮 ${v.s.inv.cristal || 0}/${v.s.ench + 1}` : gold(100 * (v.s.ench + 1))(v)) },
      { c: 'ennemis', ic: '👹', lb: 'Bestiaire', sb: v => `attaque ${v.attack}` },
    ] },
    { id: 'aventure', ic: '🧭', lb: 'Aventure', col: '#965ac8', cmds: [
      { c: 'expedition', ic: '🧭', lb: 'Expédition', sb: v => v.s.exp ? (v.expLeft > 0 ? `⏳ ${engine.fmt(v.expLeft)}` : '✅ terminée') : '5 ou 12⚡',
        lock: v => v.s.exp ? null : lvl(2)(v), picker: pickExpedition },
      { c: 'retour', ic: '🏕️', lb: 'Retour', sb: v => !v.s.exp ? 'aucune' : (v.expLeft > 0 ? `⏳ ${engine.fmt(v.expLeft)}` : '🎁 butin prêt'),
        lock: v => !v.s.exp ? 'aucune' : (v.expLeft > 0 ? `⏳ ${engine.fmt(v.expLeft)}` : null), dot: v => v.s.exp && v.expLeft <= 0 ? '!' : 0 },
      { c: 'tour', ic: '🗼', lb: 'Tour', sb: v => `5⚡ · record ${v.s.floor}`, lock: all(hpPct(0.5), en(5)) },
      { c: 'animal', ic: '🐾', lb: 'Compagnon', sb: v => v.s.pet ? `${petIc(v.s.pet)} ${v.s.pet}` : '300 or', lock: v => v.s.pet ? null : gold(300)(v), picker: pickAnimal },
      { c: 'pari', ic: '🎰', lb: 'Parier', sb: () => '45% x2', lock: gold(5), picker: v => pickAmount('pari', '🎰 Parier', v, Math.min(v.s.or, 500), 5,
        "45% de chance de doubler ta mise (min 5, max 500). La maison gagne souvent…", [10, 50, 100, 500]) },
    ] },
    { id: 'marche', ic: '🏪', lb: 'Marché', col: '#e6aa32', cmds: [
      { c: 'marche', ic: '📈', lb: 'Prix du jour', sb: v => v.event[0].split(' ')[0] + ' événement' },
      { c: 'vendre', ic: '💰', lb: 'Vendre', sb: v => `${sellable(v).length} type(s)`, lock: v => sellable(v).length ? null : 'rien', picker: pickSell },
      { c: 'boutique', ic: '🏪', lb: 'Boutique', sb: () => 'prix fixes' },
      { c: 'acheter', ic: '🛒', lb: 'Acheter', sb: v => `${v.s.or} or`, picker: pickBuy },
      { c: 'banque', ic: '🏦', lb: 'Banque', sb: v => `${v.s.bank} · +2%/j` },
      { c: 'deposer', ic: '📥', lb: 'Déposer', sb: () => 'protégé', lock: v => v.s.or > 0 ? null : '0 or',
        picker: v => pickAmount('deposer', '📥 Déposer à la banque', v, v.s.or, 1, "L'or en banque rapporte 2% par jour et ne se perd pas en mourant.", [10, 50, 100]) },
      { c: 'retirer', ic: '📤', lb: 'Retirer', sb: v => `${v.s.bank} dispo`, lock: v => v.s.bank > 0 ? null : 'vide',
        picker: v => pickAmount('retirer', '📤 Retirer de la banque', v, v.s.bank, 1, 'Récupère de l\'or de ton coffre.', [10, 50, 100]) },
      { c: 'atelier', ic: '🏭', lb: 'Atelier', sb: v => `niv ${v.s.atelier} · ${v.s.atelier * 3}/h` },
      { c: 'atelier', a: ['upgrade'], ic: '⬆️', lb: 'Améliorer', sb: v => `${v.atelierCost} or`, lock: v => gold(v.atelierCost)(v), picker: pickAtelier },
      { c: 'collecter', ic: '🪙', lb: 'Collecter', sb: v => v.s.atelier < 1 ? 'pas d\'atelier' : `+${v.atelierReady} or`,
        lock: v => v.s.atelier < 1 ? 'pas d\'atelier' : (v.atelierReady < 1 ? 'rien' : null), dot: v => v.atelierReady > 0 ? '!' : 0 },
    ] },
    { id: 'quetes', ic: '📜', lb: 'Quêtes', col: '#4696e6', cmds: [
      { c: 'daily', ic: '🎁', lb: 'Récompense', sb: v => v.dailyReady ? 'disponible !' : `🔥 ${v.s.streak} j`, lock: v => v.dailyReady ? null : 'demain', dot: v => v.dailyReady ? '!' : 0 },
      { c: 'quetes', ic: '📜', lb: 'Quêtes', sb: v => `${v.quests.filter(q => q.done).length}/3 finies` },
      { c: 'succes', ic: '🏅', lb: 'Succès', sb: v => `${v.s.ach.length}/${RPG.ACH.length}` },
      { c: 'rappel', ic: '📅', lb: 'Résumé', sb: () => 'du jour' },
    ] },
    { id: 'perso', ic: '👤', lb: 'Perso', col: '#78788c', cmds: [
      { c: 'stats', ic: '📊', lb: 'Stats', sb: v => `${v.rank}` },
      { c: 'inventaire', ic: '🎒', lb: 'Inventaire', sb: v => `${v.s.or} or` },
      { c: 'rangs', ic: '🎖️', lb: 'Rangs', sb: v => v.rank },
      { c: 'aide', ic: '❔', lb: 'Aide', sb: () => 'commandes' },
      { ui: 'mute', ic: '🔊', lb: 'Son', sb: () => muted ? 'coupé' : 'activé' },
      { ui: 'export', ic: '💾', lb: 'Exporter', sb: () => 'sauvegarde' },
      { ui: 'import', ic: '📂', lb: 'Importer', sb: () => 'sauvegarde' },
      { ui: 'reset', ic: '🔄', lb: 'Réinitialiser', sb: () => 'attention', warn: true },
    ] },
  ];

  function craftable(v) { return Object.entries(RPG.RECIPES).filter(([, [need]]) => Object.entries(need).every(([k, n]) => (v.s.inv[k] || 0) >= n)).length; }
  function sellable(v) { return Object.keys(RPG.BASE).filter(k => (v.s.inv[k] || 0) > 0); }
  const petIc = p => ({ loup: '🐺', faucon: '🦅', renard: '🦊' })[p] || '🐾';
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* ---------- état UI ---------- */
  let muted = ls.get(KEY_MUTE) === '1';
  let tab = ls.get(KEY_TAB) || 'recolter';
  if (!CATS.find(c => c.id === tab)) tab = 'recolter';
  let lastCmdsHtml = '', lastTabsHtml = '', lastInfoHtml = '';
  let logItems = [];
  try { logItems = JSON.parse(ls.get(KEY_LOG) || '[]'); } catch (e) { logItems = []; }

  /* ---------- HUD ---------- */
  function renderHUD(v) {
    const s = v.s, col = RANK_COL[v.rank] || '#a06e3c';
    document.documentElement.style.setProperty('--rk', col);
    $('h-lvl').textContent = s.lvl;
    $('h-rank').textContent = v.rank.toUpperCase();
    $('h-gold').textContent = s.or;
    $('h-bank').textContent = s.bank;
    const pct = (a, b) => Math.max(0, Math.min(100, 100 * a / Math.max(1, b))) + '%';
    $('b-hp').style.width = pct(s.hp, s.maxhp); $('t-hp').textContent = `PV ${s.hp}/${s.maxhp}`;
    $('b-en').style.width = pct(s.energy, MAXEN); $('t-en').textContent = `ÉNERGIE ${s.energy}/${MAXEN}`;
    $('b-xp').style.width = pct(s.xp, s.lvl * 60); $('t-xp').textContent = `XP niv ${s.lvl} › ${s.lvl + 1} · ${s.xp}/${s.lvl * 60}`;
    $('h-sub').textContent = `🔥 Série ${s.streak} j · ⚔️ Kills ${s.kills} · 🗼 Tour ${s.floor}${s.pet ? ' · ' + petIc(s.pet) : ''}`;
    $('h-regen').textContent = s.energy < MAXEN ? `+1⚡ dans ${Math.floor(v.nextreg / 60)}:${String(v.nextreg % 60).padStart(2, '0')}` : '⚡ plein';
    const chips = [];
    if (v.dailyReady) chips.push(['', '! Récompense du jour dispo', 'daily']);
    if (s.exp && v.expLeft <= 0) chips.push(['purple', '🧭 Expédition terminée !', 'retour']);
    else if (s.exp) chips.push(['purple', `🧭 Retour dans ${engine.fmt(v.expLeft)}`, 'retour']);
    if (v.atelierReady > 0) chips.push(['green', `🏭 +${v.atelierReady} or à collecter`, 'collecter']);
    const html = chips.map(([c, t, cmd]) => `<button class="chip ${c}" data-cmd="${cmd}">${esc(t)}</button>`).join('');
    if ($('chips').innerHTML !== html) $('chips').innerHTML = html;
  }

  /* ---------- Onglets + boutons ---------- */
  function renderPanel(v) {
    const cat = CATS.find(c => c.id === tab);
    document.documentElement.style.setProperty('--cat', cat.col);
    const tabDot = { quetes: v.dailyReady || v.quests.some(q => !q.done && q.prog >= q.n), marche: v.atelierReady > 0, aventure: !!(v.s.exp && v.expLeft <= 0) };
    const th = CATS.map(c => `<button class="tab ${c.id === tab ? 'on' : ''}" role="tab" data-tab="${c.id}" style="--tc:${c.col}"><span class="ti">${c.ic}</span><span class="tl">${c.lb}</span>${tabDot[c.id] ? '<i class="dot"></i>' : ''}</button>`).join('');
    if (th !== lastTabsHtml) { $('tabs').innerHTML = th; lastTabsHtml = th; }
    const ch = cat.cmds.map((d, i) => {
      const lock = d.lock ? d.lock(v) : null, dot = d.dot ? d.dot(v) : 0;
      const ic = d.ui === 'mute' ? (muted ? '🔇' : '🔊') : d.ic;
      return `<button class="cmd-btn ${lock ? 'locked' : ''} ${d.warn ? 'warn' : ''}" data-i="${i}"><span class="ic">${ic}</span><span class="lb">${esc(d.lb)}</span><span class="sb">${esc(lock || (d.sb ? d.sb(v) : ''))}</span>${dot ? `<span class="dot">${dot}</span>` : ''}</button>`;
    }).join('');
    if (ch !== lastCmdsHtml) { $('cmds').innerHTML = ch; lastCmdsHtml = ch; }
    let info = '';
    if (tab === 'quetes') info = v.quests.map(q => `<div class="qcard ${q.done ? 'done' : ''}"><span>${q.done ? '✅' : '▫️'}</span><span class="qt">${esc(q.txt)} <small>(${q.g} or, ${q.x} XP)</small></span><span class="qbar"><i style="width:${100 * q.prog / q.n}%"></i></span><small>${q.prog}/${q.n}</small></div>`).join('');
    if (tab === 'marche') info = `<div>${esc(v.event[0])} aujourd'hui · 🏦 ${v.s.bank} or en banque</div>`;
    if (tab === 'combat') info = `<div>⚔️ Attaque ${v.attack} · 🗡️ ${esc(v.s.sword)} · 🛡️ ${esc(v.s.armor)}${v.s.pet ? ' · ' + petIc(v.s.pet) + ' ' + esc(v.s.pet) : ''}</div>`;
    if (tab === 'recolter') info = `<div>⛏️ ${esc(v.s.pick)} · 🎒 ${Object.entries(v.s.inv).filter(([, n]) => n).map(([k, n]) => (ITEM[k] || ['📦'])[0] + n).join(' ') || 'sac vide'}</div>`;
    if (info !== lastInfoHtml) { $('cat-info').innerHTML = info; lastInfoHtml = info; }
  }

  function refresh() { const v = engine.view(); renderHUD(v); renderPanel(v); return v; }

  /* ---------- Récit ---------- */
  function fmtText(t) {
    return t.split('\n').map(line => {
      let h = esc(line).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      if (/^(🎉|🏅|📜 Quête|🎊|✨ TROUVAILLE|🎁 Coffre|🎁 Palier|🏦 Intérêts)/.test(line)) h = `<span class="hl">${h}</span>`;
      else if (/^(💀|❌|🩸|⚡ Pas assez|❓|🎰 Perdu)/.test(line) || line.includes('te terrasse')) h = `<span class="bad">${h}</span>`;
      else if (/^(🏆|🎰 GAGNÉ)/.test(line)) h = `<span class="good">${h}</span>`;
      return h;
    }).join('<br>');
  }
  function renderLog() {
    $('log').innerHTML = logItems.map(e => `<div class="entry" style="--c:${e.col || '#888'}"><div class="cmd"><span>${esc(e.label)}</span><span>${esc(e.time || '')}</span></div>${fmtText(e.text)}</div>`).join('');
    $('log').scrollTop = 0;
  }
  function pushLog(label, text, col, persist = true) {
    const d = new Date();
    logItems.unshift({ label, text, col, time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` });
    logItems = logItems.slice(0, 40);
    if (persist) ls.set(KEY_LOG, JSON.stringify(logItems.slice(0, 25)));
    renderLog();
  }

  /* ---------- Scène vidéo ---------- */
  const video = $('scene');
  let seq = [], seqI = 0;
  function setMuteBtn() { const b = $('mute'); b.textContent = muted ? '🔇' : '🔊'; b.classList.toggle('off', muted); }
  function playSeq(list) {
    if (!list || !list.length) return;
    seq = list; seqI = 0; playCurrent();
  }
  function playCurrent() {
    const n = seq[seqI];
    $('tap').classList.add('hidden');
    video.poster = `img/scenes/${n}.webp`;
    video.src = `vid/${n}.mp4`;
    video.muted = muted;
    $('caption').textContent = SCENE[n] || n;
    const p = video.play();
    if (p && p.catch) p.catch(() => {
      if (!video.muted) { // son bloqué par le navigateur : on rejoue en muet
        video.muted = true;
        video.play().then(() => $('mute').classList.add('hint')).catch(() => $('tap').classList.remove('hidden'));
      } else $('tap').classList.remove('hidden');
    });
  }
  video.addEventListener('ended', () => { if (seqI < seq.length - 1) { seqI++; playCurrent(); } });
  video.addEventListener('error', () => { if (seqI < seq.length - 1) { seqI++; playCurrent(); } });
  $('tap').addEventListener('click', () => {
    $('tap').classList.add('hidden');
    if (!video.src) { playSeq(['stats']); return; }
    video.muted = muted; video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
  });
  $('mute').addEventListener('click', toggleMute);
  function toggleMute() {
    muted = !muted; ls.set(KEY_MUTE, muted ? '1' : '0'); video.muted = muted; setMuteBtn();
    $('mute').classList.remove('hint');
    if (!muted && video.src && video.paused && !video.ended) video.play().catch(() => {});
    lastCmdsHtml = ''; refresh(); toast(muted ? '🔇 Son coupé' : '🔊 Son activé');
  }

  /* ---------- Effets ---------- */
  function floatAt(el, text, color) {
    if (!el) return; const r = el.getBoundingClientRect();
    const f = document.createElement('div'); f.className = 'float'; f.textContent = text; f.style.color = color;
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height / 2) + 'px';
    $('fx').appendChild(f); setTimeout(() => f.remove(), 1700);
  }
  function toast(t) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1600);
  }
  function showDeltas(a, b) {
    const dg = b.s.or - a.s.or, dhp = b.s.hp - a.s.hp, den = b.s.energy - a.s.energy;
    const dxp = (b.s.lvl === a.s.lvl) ? b.s.xp - a.s.xp : 0;
    if (dg) { floatAt($('h-goldbox'), `${dg > 0 ? '+' : ''}${dg} 💰`, dg > 0 ? '#ffe678' : '#ff8a8a'); $('h-goldbox').classList.remove('flash'); void $('h-goldbox').offsetWidth; $('h-goldbox').classList.add('flash'); }
    if (dhp) floatAt($('b-hp'), `${dhp > 0 ? '+' : ''}${dhp} ❤️`, dhp > 0 ? '#9dff9d' : '#ff6a74');
    if (den) setTimeout(() => floatAt($('t-en'), `${den > 0 ? '+' : ''}${den} ⚡`, '#ffe27a'), 150);
    if (dxp > 0) setTimeout(() => floatAt($('t-xp'), `+${dxp} XP`, '#8ec4ff'), 300);
    if (b.s.lvl > a.s.lvl) { const bd = $('badge'); bd.classList.remove('pop'); void bd.offsetWidth; bd.classList.add('pop'); floatAt(bd, `NIVEAU ${b.s.lvl} !`, '#ffe678'); }
  }

  /* ---------- Exécution d'une commande ---------- */
  function exec(cmd, args, label) {
    const before = engine.view();
    let r;
    try { r = engine.run(cmd, args || []); } catch (e) { console.error(e); r = { text: '⚠️ Erreur : ' + e.message, media: [] }; }
    const cat = CATS.find(c => c.id === tab);
    pushLog(label || ('/' + [cmd].concat(args || []).join(' ')), r.text, cat ? cat.col : '#888');
    playSeq(r.media);
    const after = refresh();
    showDeltas(before, after);
    return r;
  }

  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab; ls.set(KEY_TAB, tab); lastCmdsHtml = ''; refresh(); $('cmds').scrollTop = 0;
  });
  $('cmds').addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const d = CATS.find(c => c.id === tab).cmds[+b.dataset.i]; const v = engine.view();
    if (d.ui) return uiAction(d.ui, v);
    const lock = d.lock ? d.lock(v) : null;
    if (d.picker && !lock) return d.picker(v);
    if (d.picker && d.c === 'animal') return d.picker(v);
    // verrouillé ou sans argument : on lance la commande (le moteur renvoie le message du jeu)
    exec(d.c, d.a || [], `${d.ic} ${d.lb}`);
  });
  $('chips').addEventListener('click', e => { const b = e.target.closest('[data-cmd]'); if (b) exec(b.dataset.cmd, [], b.textContent); });

  /* ---------- Feuilles de choix ---------- */
  function openSheet(title, nodes) {
    $('sheet-title').textContent = title;
    const body = $('sheet-body'); body.innerHTML = '';
    nodes.forEach(n => body.appendChild(n));
    $('sheet').classList.remove('hidden');
  }
  function closeSheet() { $('sheet').classList.add('hidden'); }
  $('sheet-x').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function opt({ ic, title, sub, price, ok = true, onClick }) {
    const b = el('button', 'opt ' + (ok ? 'ok' : 'no'), `<span class="oi">${ic}</span><span class="ot"><b>${esc(title)}</b>${sub ? `<small>${sub}</small>` : ''}</span>${price != null ? `<span class="op">${esc(price)}</span>` : ''}`);
    b.addEventListener('click', onClick); return b;
  }
  const note = t => el('div', 'note', t);
  const run = (cmd, args, label) => () => { closeSheet(); exec(cmd, args, label); };

  function pickCraft(v) {
    const nodes = [note('Choisis un objet à fabriquer (+10 XP). Les outils fabriqués s\'équipent automatiquement.')];
    for (const [k, [need, label]] of Object.entries(RPG.RECIPES)) {
      const ok = Object.entries(need).every(([r, n]) => (v.s.inv[r] || 0) >= n);
      const sub = Object.entries(need).map(([r, n]) => { const h = v.s.inv[r] || 0; return `<span style="color:${h >= n ? '#9dff9d' : '#ff9a9a'}">${n} ${r} (${h})</span>`; }).join(' · ')
        + ([v.s.pick, v.s.sword, v.s.armor].includes(k) ? ' · <b>équipé</b>' : '') + (DESC[k] ? `<br>${DESC[k]}` : '');
      nodes.push(opt({ ic: EQUIP_IC(k), title: label, sub, ok, onClick: run('craft', [k], `🔨 ${label}`) }));
    }
    openSheet('🔨 Fabriquer', nodes);
  }
  function pickBuy(v) {
    const nodes = [note(`Prix fixes. Tu as <b>${v.s.or} or</b>.`)];
    for (const [k, p] of Object.entries(RPG.SHOP)) {
      const owned = [v.s.pick, v.s.sword, v.s.armor].includes(k);
      const sub = (DESC[k] || '') + (owned ? ' · <b>déjà équipé</b>' : '') + (ITEM[k] ? ` · en stock : ${v.s.inv[k] || 0}` : '');
      nodes.push(opt({ ic: EQUIP_IC(k), title: k, sub, price: `${p} or`, ok: v.s.or >= p, onClick: run('acheter', [k], `🛒 ${k}`) }));
    }
    openSheet('🛒 Acheter', nodes);
  }
  function estimate(v, k, n) {
    const p = v.prices[k], sold = v.s.sold[k] || 0; let g = 0;
    for (let i = 0; i < n; i++) g += Math.max(1, Math.trunc(p * Math.max(0.5, 1 - 0.02 * (sold + i) / 5)));
    return g;
  }
  function pickSell(v) {
    const items = sellable(v);
    const nodes = [note(`${esc(v.event[0])} aujourd'hui. Le prix baisse si tu vends beaucoup du même objet.`)];
    const bulk = items.filter(k => k !== 'cristal' && k !== 'potion');
    if (bulk.length) nodes.push(opt({ ic: '💰', title: 'Tout vendre', sub: 'Toutes les ressources (sauf cristaux et potions)',
      price: `≈ ${bulk.reduce((a, k) => a + estimate(v, k, v.s.inv[k]), 0)} or`, onClick: run('vendre', ['tout'], '💰 Tout vendre') }));
    for (const k of items) {
      const [ic, name] = ITEM[k] || ['📦', k]; const n = v.s.inv[k];
      nodes.push(opt({ ic, title: `${name} x${n}`, sub: `${v.prices[k]} or/u aujourd'hui (base ${RPG.BASE[k]})`, price: `≈ ${estimate(v, k, n)} or`, onClick: () => pickSellQty(v, k) }));
    }
    openSheet('💰 Vendre', nodes);
  }
  function pickSellQty(v, k) {
    const max = v.s.inv[k], [ic, name] = ITEM[k] || ['📦', k];
    const inp = el('input'); inp.type = 'number'; inp.min = 1; inp.max = max; inp.value = max; inp.inputMode = 'numeric';
    const est = el('div', 'est');
    const upd = () => { const n = Math.max(0, Math.min(max, parseInt(inp.value, 10) || 0)); est.textContent = n ? `${n} ${name} → ≈ ${estimate(v, k, n)} or` : 'Quantité invalide'; };
    inp.addEventListener('input', upd); upd();
    const chips = el('div', 'chipsel');
    [1, 5, 10].filter(n => n < max).concat([max]).forEach(n => { const b = el('button', '', n === max ? `Tout (${max})` : String(n)); b.onclick = () => { inp.value = n; upd(); }; chips.appendChild(b); });
    const go = el('button', 'go', `${ic} Vendre`);
    go.onclick = () => { const n = parseInt(inp.value, 10) || 0; if (n < 1 || n > max) return toast('Quantité invalide'); closeSheet(); exec('vendre', n === max ? [k] : [k, String(n)], `💰 Vendre ${n} ${name}`); };
    const row = el('div', 'numrow'); row.appendChild(inp);
    openSheet(`💰 Vendre ${name}`, [note(`Tu as ${max} ${name}. Prix du jour : ${v.prices[k]} or/u.`), row, chips, est, go]);
  }
  function pickAmount(cmd, title, v, max, min, text, quick) {
    const inp = el('input'); inp.type = 'number'; inp.min = min; inp.max = max; inp.inputMode = 'numeric'; inp.placeholder = `${min} – ${max}`;
    inp.value = Math.min(max, quick[0]) >= min ? Math.min(max, quick[0]) : '';
    const chips = el('div', 'chipsel');
    quick.filter(n => n <= max && n >= min).forEach(n => { const b = el('button', '', String(n)); b.onclick = () => { inp.value = n; }; chips.appendChild(b); });
    const all = el('button', '', 'Tout'); all.onclick = () => { inp.value = 'tout'; inp.type = 'text'; }; chips.appendChild(all);
    const go = el('button', 'go', 'Valider');
    go.onclick = () => { const val = String(inp.value).trim().toLowerCase(); closeSheet(); exec(cmd, [val === 'tout' ? 'tout' : String(parseInt(val, 10) || 0)], `${title} ${val}`); };
    const row = el('div', 'numrow'); row.appendChild(inp);
    openSheet(title, [note(`${text}<br>Sur toi : <b>${v.s.or} or</b> · Banque : <b>${v.s.bank} or</b>`), row, chips, go]);
    setTimeout(() => inp.focus(), 50);
  }
  function pickAnimal(v) {
    if (v.s.pet) return exec('animal', [], '🐾 Compagnon');
    const nodes = [note('Un compagnon donne +4 attaque et +10% d\'or sur les victoires. Choix définitif.')];
    for (const [k, d] of [['loup', 'Fidèle et féroce'], ['faucon', 'Œil perçant'], ['renard', 'Rusé et vif']])
      nodes.push(opt({ ic: petIc(k), title: k[0].toUpperCase() + k.slice(1), sub: d, price: '300 or', ok: v.s.or >= 300, onClick: run('animal', [k], `🐾 ${k}`) }));
    openSheet('🐾 Adopter un compagnon', nodes);
  }
  function pickExpedition(v) {
    if (v.s.exp) return exec('expedition', [], '🧭 Expédition');
    openSheet('🧭 Expédition', [note('Ton héros part explorer en temps réel, même page fermée. Reviens avec « Retour ».'),
      opt({ ic: '🥾', title: 'Courte — 30 min', sub: 'Or + fer, cuir… (5⚡)', price: '5⚡', ok: v.s.energy >= 5, onClick: run('expedition', ['courte'], '🧭 Expédition courte') }),
      opt({ ic: '🗺️', title: 'Longue — 4 h', sub: 'Gros butin x4, diamants, perles (12⚡)', price: '12⚡', ok: v.s.energy >= 12, onClick: run('expedition', ['longue'], '🧭 Expédition longue') })]);
  }
  function pickSoin(v) {
    const p = v.s.inv.potion || 0, sp = v.s.inv.super_potion || 0;
    openSheet('🧪 Se soigner', [note(`❤️ ${v.s.hp}/${v.s.maxhp}`),
      opt({ ic: '✨', title: 'Automatique', sub: 'Utilise la meilleure potion disponible', ok: p + sp > 0, onClick: run('soin', [], '🧪 Soin') }),
      opt({ ic: '⚗️', title: 'Super potion', sub: '+150 PV', price: `x${sp}`, ok: sp > 0, onClick: run('soin', ['super_potion'], '🧪 Super potion') }),
      opt({ ic: '🧪', title: 'Potion', sub: '+50 PV', price: `x${p}`, ok: p > 0, onClick: run('soin', ['potion'], '🧪 Potion') })]);
  }
  function pickAtelier(v) {
    const n = v.s.atelier + 1;
    openSheet('🏭 Améliorer l\'atelier', [note(`Niveau ${n} : ${n * 3} or/heure (stock max 12 h).`),
      opt({ ic: '⬆️', title: `Passer au niveau ${n}`, sub: `Tu as ${v.s.or} or`, price: `${v.atelierCost} or`, ok: v.s.or >= v.atelierCost, onClick: run('atelier', ['upgrade'], '🏭 Améliorer l\'atelier') })]);
  }

  /* ---------- Actions perso : son, export/import, reset ---------- */
  function uiAction(a) {
    if (a === 'mute') return toggleMute();
    if (a === 'export') {
      const ta = el('textarea'); ta.readOnly = true; ta.value = engine.exportSave();
      const copy = el('button', 'go', '📋 Copier');
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(ta.value); toast('📋 Copié !'); }
        catch (e) { ta.focus(); ta.select(); try { document.execCommand('copy'); toast('📋 Copié !'); } catch (_) { toast('Sélectionne et copie le texte'); } }
      };
      const dl = el('button', 'go alt', '⬇️ Télécharger .json');
      dl.onclick = () => { const u = URL.createObjectURL(new Blob([ta.value], { type: 'application/json' })); const l = document.createElement('a'); l.href = u; l.download = `rpg-nathan-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
      return openSheet('💾 Exporter la sauvegarde', [note('Garde ce texte pour récupérer ta partie sur un autre appareil (Perso → Importer).'), ta, copy, dl]);
    }
    if (a === 'import') {
      const ta = el('textarea'); ta.placeholder = 'Colle ici le texte de ta sauvegarde…';
      const file = el('input'); file.type = 'file'; file.accept = '.json,application/json,text/plain'; file.style.display = 'none';
      file.onchange = () => { const f = file.files[0]; if (f) f.text().then(t => { ta.value = t; }); };
      const pickF = el('button', 'go alt', '📁 Ouvrir un fichier'); pickF.onclick = () => file.click();
      const go = el('button', 'go', '📂 Charger cette sauvegarde');
      go.onclick = () => {
        try { engine.importSave(ta.value.trim()); closeSheet(); toast('✅ Sauvegarde chargée'); pushLog('📂 Import', '📂 Sauvegarde importée avec succès.', '#78788c'); refresh(); }
        catch (e) { toast('❌ Texte invalide'); }
      };
      return openSheet('📂 Importer une sauvegarde', [note('⚠️ Remplace ta partie actuelle.'), ta, file, pickF, go]);
    }
    if (a === 'reset') {
      const armed = {};
      const twoStep = (btn, label, fn) => { btn.onclick = () => { if (!armed[label]) { armed[label] = 1; btn.textContent = '⚠️ Sûr ? Touche encore pour confirmer'; return; } fn(); }; };
      const b1 = el('button', 'go danger', '🔄 Nouvelle partie (niveau 1)');
      twoStep(b1, 'new', () => { closeSheet(); exec('reset', [], '🔄 Réinitialiser'); });
      const b2 = el('button', 'go alt', '↩️ Revenir à la sauvegarde d\'origine (niv 2)');
      twoStep(b2, 'orig', () => { ls.del(KEY_SAVE); closeSheet(); toast('↩️ Sauvegarde d\'origine restaurée'); pushLog('↩️ Restauration', '↩️ Retour à la sauvegarde importée du chat (niveau 2).', '#78788c'); refresh(); });
      return openSheet('🔄 Réinitialiser', [note('⚠️ Ta progression actuelle sera <b>définitivement effacée</b>. Pense à l\'exporter avant !'), b1, b2]);
    }
  }

  /* ---------- Démarrage ---------- */
  setMuteBtn();
  renderLog();
  const v0 = refresh();
  const intro = engine.run('rappel', []).text; // lecture seule (n'écrit rien, comme en Python)
  pushLog('🏰 Bienvenue, ' + v0.rank + ' niveau ' + v0.s.lvl, intro, '#c9a24a', false);
  $('caption').textContent = `🏰 Lobby — ${v0.rank} niv ${v0.s.lvl}`;
  setInterval(refresh, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  window.__rpg = { engine, exec, refresh }; // pour le débogage / tests
})();
