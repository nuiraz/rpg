/* app.js — interface du jeu : HUD, onglets, commandes, fenêtres, réglages, tutoriel, résumé d'absence. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  // Version de cette page (les ?v= sont écrits par tools/build.py) : le service worker la demande après une mise à jour.
  const BUILD = ((document.querySelector('script[src*="js/app.js"]') || {}).src || '').replace(/.*[?&]v=/, '');
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'rpg-version?' && e.ports[0]) e.ports[0].postMessage(BUILD); });
  // Garde-fou mise à jour : si une ancienne page (v1) en cache charge ce nouveau code, on recharge une fois la page.
  if (!$('arena') || !window.Scene || !window.FX || !window.SFX) {
    try { if (!sessionStorage.getItem('rpg_v2_reload')) { sessionStorage.setItem('rpg_v2_reload', '1'); location.reload(); } } catch (e) { /* rien */ }
    return;
  }
  // Clés de stockage : identiques à la version 1 (la sauvegarde existante est reprise telle quelle)
  const KEY_SAVE = 'rpg_nathan_save', KEY_LOG = 'rpg_nathan_log', KEY_MUTE = 'rpg_nathan_muted', KEY_TAB = 'rpg_nathan_tab';
  const KEY_SET = 'rpg_nathan_settings', KEY_TUTO = 'rpg_nathan_tuto', KEY_SEEN = 'rpg_nathan_seen';
  const VERSION = '2.0';

  /* ---------- stockage ---------- */
  const mem = {};
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } },
  };
  const engine = RPG.createEngine({ storage: { get: () => ls.get(KEY_SAVE), set: v => ls.set(KEY_SAVE, v) }, defaultSave: window.RPG_DEFAULT_SAVE });

  /* ---------- réglages (avec migration de l'ancien bouton muet) ---------- */
  const DEF_SET = { sound: true, music: false, vibrate: true, video: 'auto', speed: 1, fx: FX.prefersReduced() ? 'reduced' : 'full', vol: 0.8 };
  let set = Object.assign({}, DEF_SET);
  try { const raw = ls.get(KEY_SET); if (raw) Object.assign(set, JSON.parse(raw)); else if (ls.get(KEY_MUTE) === '1') set.sound = false; } catch (e) { /* réglages par défaut */ }
  function applySettings() {
    FX.setCfg({ speed: set.speed === 'instant' ? 3 : +set.speed, instant: set.speed === 'instant', reduced: set.fx === 'reduced', vibrate: set.vibrate });
    SFX.set({ sound: set.sound, music: set.music, vol: set.vol });
    Scene.setMuted(!set.sound);
    document.documentElement.classList.toggle('reduced', set.fx === 'reduced' || set.speed === 'instant');
    $('mute').textContent = set.sound ? '🔊' : '🔇'; $('mute').classList.toggle('off', !set.sound);
  }
  function saveSettings() { ls.set(KEY_SET, JSON.stringify(set)); applySettings(); }

  /* ---------- données d'affichage ---------- */
  const RANK_COL = { 'Novice': '#a06e3c', 'Aventurier': '#9696a0', 'Guerrier': '#c8463c', 'Champion': '#f0c83c', 'Légende': '#5ac8ff' };
  const RANK_IMG = r => `img/sprites/rank_${{ 'Novice': 'novice', 'Aventurier': 'aventurier', 'Guerrier': 'guerrier', 'Champion': 'champion', 'Légende': 'legende' }[r] || 'novice'}.webp`;
  const ITEM = { bois: ['🪵', 'Bois'], pierre: ['🪨', 'Pierre'], fer: ['🔩', 'Fer'], diamant: ['💎', 'Diamant'], herbe: ['🌿', 'Herbe'], cuir: ['🟫', 'Cuir'],
    cristal: ['🔮', 'Cristal'], potion: ['🧪', 'Potion'], super_potion: ['⚗️', 'Super potion'], poisson: ['🐟', 'Poisson'], perle: ['⚪', 'Perle'] };
  const EQUIP_IC = k => k.startsWith('pioche') ? '⛏️' : k.startsWith('epee') ? '🗡️' : k.startsWith('armure') ? '🛡️' : (ITEM[k] || ['📦'])[0];
  const NICE = { aucune: 'Aucune', pioche_bois: 'Pioche en bois', pioche_pierre: 'Pioche en pierre', pioche_fer: 'Pioche en fer', pioche_diamant: 'Pioche en diamant',
    epee_bois: 'Épée en bois', epee_fer: 'Épée en fer', epee_diamant: 'Épée en diamant', armure_cuir: 'Armure en cuir', armure_fer: 'Armure en fer', armure_diamant: 'Armure en diamant' };
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
  const petIc = p => ({ loup: '🐺', faucon: '🦅', renard: '🦊' })[p] || '🐾';
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const craftable = v => Object.entries(RPG.RECIPES).filter(([, [need]]) => Object.entries(need).every(([k, n]) => (v.s.inv[k] || 0) >= n)).length;
  const sellable = v => Object.keys(RPG.BASE).filter(k => (v.s.inv[k] || 0) > 0);
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  /* ---------- conditions des boutons ---------- */
  const en = n => v => v.s.energy < n ? `⚡${v.s.energy}/${n}` : null;
  const all = (...fs) => v => { for (const f of fs) { const r = f(v); if (r) return r; } return null; };
  const lvl = n => v => v.s.lvl < n ? `🔒 niv ${n}` : null;
  const hpPct = p => v => v.s.hp < v.s.maxhp * p ? `🩸 ${Math.round(p * 100)}% PV` : null;
  const pick = n => v => RPG.PICK[v.s.pick] < n ? `🔒 ${['', 'pioche bois', 'pioche pierre', 'pioche fer'][n]}` : null;
  const gold = n => v => v.s.or < n ? `💰 ${n} or` : null;
  const cnt = k => v => v.s.inv[k] || 0;

  const CATS = [
    { id: 'recolter', ic: '🌲', lb: 'Récolter', col: '#50aa50', cmds: [
      { c: 'mine', ic: '🪓', lb: 'Bois', sb: () => '1⚡', lock: en(1), d: 'Coupe du bois (1 à 3). +3 XP.' },
      { c: 'herbe', ic: '🌿', lb: 'Herbe', sb: () => '1⚡', lock: en(1), d: 'Cueille des herbes (potions). +2 XP.' },
      { c: 'minepierre', ic: '🪨', lb: 'Pierre', sb: () => '1⚡', lock: all(pick(1), en(1)), d: 'Mine de la pierre. Pioche en bois requise. +4 XP.' },
      { c: 'minefer', ic: '⛏️', lb: 'Fer', sb: () => '1⚡', lock: all(pick(2), en(1)), d: 'Mine du fer. Pioche en pierre requise. +8 XP.' },
      { c: 'minediamant', ic: '💎', lb: 'Diamant', sb: () => '1⚡ · 50%', lock: all(pick(3), en(1)), d: '1 chance sur 2 de trouver un diamant. Pioche en fer requise. +25 XP.' },
      { c: 'pecher', ic: '🎣', lb: 'Pêcher', sb: () => '1⚡', lock: en(1), d: 'Poissons (à manger : +25 PV) et parfois une perle !' },
      { c: 'craft', ic: '🔨', lb: 'Fabriquer', sb: v => `${craftable(v)} possible(s)`, picker: pickCraft, dot: v => craftable(v) || 0, d: 'Fabrique outils, armes, armures et potions. +10 XP.' },
      { c: 'recettes', ic: '📖', lb: 'Recettes', sb: () => 'liste', d: 'Toutes les recettes de fabrication.' },
      { ui: 'bag', ic: '🎒', lb: 'Sac', sb: v => `${Object.values(v.s.inv).reduce((a, b) => a + b, 0)} objets`, d: 'Ton inventaire illustré.' },
    ] },
    { id: 'combat', ic: '⚔️', lb: 'Combat', col: '#c8463c', cmds: [
      { c: 'combat', ic: '⚔️', lb: 'Combattre', sb: () => '3⚡', lock: v => v.s.hp < 20 ? '🩸 20 PV' : en(3)(v), d: 'Affronte un monstre de ton niveau. Il faut 20 PV.' },
      { c: 'donjon', ic: '🏰', lb: 'Donjon', sb: () => '15⚡ · 3 étages', lock: all(lvl(3), hpPct(0.7), en(15)), d: '3 combats d\'affilée puis un coffre (or + cristal). Niveau 3, 70% PV.' },
      { c: 'boss', ic: '🐉', lb: 'Dragon', sb: () => '10⚡', lock: all(lvl(5), hpPct(0.6), en(10)), d: 'Le dragon ! 3 diamants + 1 cristal. Niveau 5, 60% PV.' },
      { c: 'tour', ic: '🗼', lb: 'Tour', sb: v => `5⚡ · étage ${v.s.floor + 1}`, lock: all(hpPct(0.5), en(5)), d: 'Tour infinie : chaque étage est plus dur. 50% PV.' },
      { c: 'soin', ic: '🧪', lb: 'Soin', sb: v => `${cnt('potion')(v)} pot. · ${cnt('super_potion')(v)} super`, lock: v => (cnt('potion')(v) + cnt('super_potion')(v)) ? null : '0 potion', picker: pickSoin, d: 'Boire une potion (+50) ou une super potion (+150).' },
      { c: 'manger', ic: '🍣', lb: 'Manger', sb: v => `🐟 x${cnt('poisson')(v)} · +25❤️`, lock: v => cnt('poisson')(v) ? null : '0 poisson', d: 'Mange un poisson : +25 PV.' },
      { c: 'dormir', ic: '😴', lb: 'Dormir', sb: () => '5 or · +20⚡', lock: gold(5), d: 'Nuit à l\'auberge : PV au max et +20 énergie pour 5 or.' },
      { c: 'enchanter', ic: '✨', lb: 'Enchanter', sb: v => v.s.ench >= 5 ? 'max 5/5' : `${v.s.ench + 1}🔮 + ${100 * (v.s.ench + 1)} or`,
        lock: v => v.s.ench >= 5 ? 'max' : ((v.s.inv.cristal || 0) < v.s.ench + 1 ? `🔮 ${v.s.inv.cristal || 0}/${v.s.ench + 1}` : gold(100 * (v.s.ench + 1))(v)), d: '+3 attaque par niveau d\'enchantement (max 5).' },
      { c: 'ennemis', ic: '👹', lb: 'Bestiaire', sb: v => `attaque ${v.attack}`, d: 'Les monstres et ta puissance.' },
    ] },
    { id: 'aventure', ic: '🧭', lb: 'Aventure', col: '#965ac8', cmds: [
      { c: 'expedition', ic: '🧭', lb: 'Expédition', sb: v => v.s.exp ? (v.expLeft > 0 ? `⏳ ${engine.fmt(v.expLeft)}` : '✅ terminée') : '5 ou 12⚡',
        lock: v => v.s.exp ? null : lvl(2)(v), picker: pickExpedition, d: 'Ton héros explore en temps réel (30 min ou 4 h), même page fermée.' },
      { c: 'retour', ic: '🏕️', lb: 'Retour', sb: v => !v.s.exp ? 'aucune' : (v.expLeft > 0 ? `⏳ ${engine.fmt(v.expLeft)}` : '🎁 butin prêt'),
        lock: v => !v.s.exp ? 'aucune' : (v.expLeft > 0 ? `⏳ ${engine.fmt(v.expLeft)}` : null), dot: v => v.s.exp && v.expLeft <= 0 ? '!' : 0, d: 'Récupère le butin de l\'expédition.' },
      { c: 'tour', ic: '🗼', lb: 'Tour', sb: v => `5⚡ · record ${v.s.floor}`, lock: all(hpPct(0.5), en(5)), d: 'Tour infinie : bats ton record !' },
      { c: 'animal', ic: '🐾', lb: 'Compagnon', sb: v => v.s.pet ? `${petIc(v.s.pet)} ${v.s.pet}` : '300 or', lock: v => v.s.pet ? null : gold(300)(v), picker: pickAnimal, d: '+4 attaque et +10% d\'or en combat.' },
      { c: 'pari', ic: '🎰', lb: 'Parier', sb: () => '45% x2', lock: gold(5), picker: v => pickAmount('pari', '🎰 Parier', v, Math.min(v.s.or, 500), 5,
        '45% de chance de doubler ta mise (min 5, max 500). La maison gagne souvent…', [10, 50, 100, 500]), d: 'Tente ta chance à la taverne.' },
      { ui: 'map', ic: '🗺️', lb: 'Carte', sb: () => 'le village', d: 'Retour à la carte animée du village.' },
    ] },
    { id: 'marche', ic: '🏪', lb: 'Marché', col: '#e6aa32', cmds: [
      { c: 'marche', ic: '📈', lb: 'Prix du jour', sb: v => v.event[0].split(' ')[0] + ' événement', d: 'Les prix changent chaque jour avec un événement.' },
      { c: 'vendre', ic: '💰', lb: 'Vendre', sb: v => `${sellable(v).length} type(s)`, lock: v => sellable(v).length ? null : 'rien', picker: pickSell, d: 'Vends tes ressources. Le prix baisse si tu en vends beaucoup.' },
      { c: 'boutique', ic: '🏪', lb: 'Boutique', sb: () => 'prix fixes', d: 'Les prix de la boutique.' },
      { c: 'acheter', ic: '🛒', lb: 'Acheter', sb: v => `${v.s.or} or`, picker: pickBuy, d: 'Achète équipement et potions.' },
      { c: 'banque', ic: '🏦', lb: 'Banque', sb: v => `${v.s.bank} · +2%/j`, d: 'L\'or en banque rapporte 2%/jour et ne se perd pas en mourant.' },
      { c: 'deposer', ic: '📥', lb: 'Déposer', sb: () => 'protégé', lock: v => v.s.or > 0 ? null : '0 or',
        picker: v => pickAmount('deposer', '📥 Déposer à la banque', v, v.s.or, 1, 'L\'or en banque rapporte 2% par jour et ne se perd pas en mourant.', [10, 50, 100]), d: 'Mets ton or à l\'abri.' },
      { c: 'retirer', ic: '📤', lb: 'Retirer', sb: v => `${v.s.bank} dispo`, lock: v => v.s.bank > 0 ? null : 'vide',
        picker: v => pickAmount('retirer', '📤 Retirer de la banque', v, v.s.bank, 1, 'Récupère de l\'or de ton coffre.', [10, 50, 100]), d: 'Reprends de l\'or.' },
      { c: 'atelier', ic: '🏭', lb: 'Atelier', sb: v => `niv ${v.s.atelier} · ${v.s.atelier * 3}/h`, d: 'Revenus passifs : 3 or/heure par niveau (12 h max).' },
      { c: 'atelier', a: ['upgrade'], ic: '⬆️', lb: 'Améliorer', sb: v => `${v.atelierCost} or`, lock: v => gold(v.atelierCost)(v), picker: pickAtelier, d: 'Améliore l\'atelier.' },
      { c: 'collecter', ic: '🪙', lb: 'Collecter', sb: v => v.s.atelier < 1 ? 'pas d\'atelier' : `+${v.atelierReady} or`,
        lock: v => v.s.atelier < 1 ? 'pas d\'atelier' : (v.atelierReady < 1 ? 'rien' : null), dot: v => v.atelierReady > 0 ? '!' : 0, d: 'Ramasse l\'or produit par l\'atelier.' },
    ] },
    { id: 'quetes', ic: '📜', lb: 'Quêtes', col: '#4696e6', cmds: [
      { ui: 'calendar', ic: '🎁', lb: 'Récompense', sb: v => v.dailyReady ? 'disponible !' : `🔥 ${v.s.streak} j`, dot: v => v.dailyReady ? '!' : 0, d: 'Récompense quotidienne : garde ta série, coffre tous les 7 jours !' },
      { c: 'quetes', ic: '📜', lb: 'Quêtes', sb: v => `${v.quests.filter(q => q.done).length}/3 finies`, d: '3 quêtes par jour, récompensées automatiquement.' },
      { c: 'succes', ic: '🏅', lb: 'Succès', sb: v => `${v.s.ach.length}/${RPG.ACH.length}`, d: 'Tes succès débloqués.' },
      { c: 'rappel', ic: '📅', lb: 'Résumé', sb: () => 'du jour', d: 'Ce qui t\'attend aujourd\'hui.' },
    ] },
    { id: 'perso', ic: '👤', lb: 'Perso', col: '#78788c', cmds: [
      { ui: 'hero', ic: '🧝', lb: 'Fiche héros', sb: v => `${v.rank} niv ${v.s.lvl}`, d: 'Ton héros, son équipement et ses statistiques.' },
      { ui: 'bag', ic: '🎒', lb: 'Inventaire', sb: v => `${v.s.or} or`, d: 'Ton sac illustré.' },
      { c: 'stats', ic: '📊', lb: 'Stats', sb: v => v.rank, d: 'Statistiques en texte.' },
      { c: 'rangs', ic: '🎖️', lb: 'Rangs', sb: v => v.rank, d: 'Les rangs : Novice → Légende.' },
      { ui: 'settings', ic: '⚙️', lb: 'Réglages', sb: () => 'son, vitesse…', d: 'Son, musique, vibrations, vidéos, vitesse des animations.' },
      { c: 'aide', ic: '❔', lb: 'Aide', sb: () => 'commandes', d: 'Liste des commandes.' },
      { ui: 'export', ic: '💾', lb: 'Exporter', sb: () => 'sauvegarde', d: 'Copie ta sauvegarde pour la garder.' },
      { ui: 'import', ic: '📂', lb: 'Importer', sb: () => 'sauvegarde', d: 'Charge une sauvegarde.' },
      { ui: 'reset', ic: '🔄', lb: 'Réinitialiser', sb: () => 'attention', warn: true, d: 'Recommencer (avec confirmation).' },
    ] },
  ];

  /* ---------- état UI ---------- */
  let tab = ls.get(KEY_TAB) || 'recolter'; if (!CATS.find(c => c.id === tab)) tab = 'recolter';
  let lastCmdsHtml = '', lastTabsHtml = '', lastInfoHtml = '', frozen = null, goldAnim = false, lastEnergy = null, busy = null;
  let logItems = []; try { logItems = JSON.parse(ls.get(KEY_LOG) || '[]'); } catch (e) { logItems = []; }

  /* ---------- HUD ---------- */
  const pct = (a, b) => Math.max(0, Math.min(100, 100 * a / Math.max(1, b))) + '%';
  function renderHUD(v) {
    const s = v.s, col = RANK_COL[v.rank] || '#a06e3c';
    document.documentElement.style.setProperty('--rk', col);
    $('h-lvl').textContent = s.lvl; $('h-rank').textContent = v.rank.toUpperCase();
    const em = RANK_IMG(v.rank); if ($('h-emblem').getAttribute('src') !== em) $('h-emblem').setAttribute('src', em);
    if (!goldAnim) $('h-gold').textContent = s.or;
    $('h-bank').textContent = s.bank;
    $('b-hp').style.width = pct(s.hp, s.maxhp); $('g-hp').style.width = pct(s.hp, s.maxhp); $('t-hp').textContent = `PV ${s.hp}/${s.maxhp}`;
    $('bar-hp').classList.toggle('low', s.hp < s.maxhp * 0.3);
    $('b-en').style.width = pct(s.energy, MAXEN); $('t-en').textContent = `ÉNERGIE ${s.energy}/${MAXEN}`;
    $('b-xp').style.width = pct(s.xp, s.lvl * 60); $('t-xp').textContent = `XP niv ${s.lvl} › ${s.lvl + 1} · ${s.xp}/${s.lvl * 60}`;
    $('h-sub').textContent = `🔥 Série ${s.streak} j · ⚔️ ${s.kills} · 🗼 ${s.floor}${s.pet ? ' · ' + petIc(s.pet) : ''}`;
    $('h-regen').textContent = s.energy < MAXEN ? `+1⚡ dans ${Math.floor(v.nextreg / 60)}:${String(v.nextreg % 60).padStart(2, '0')}` : '⚡ plein';
    const chips = [];
    if (v.dailyReady) chips.push(['', '🎁 Récompense du jour dispo', 'ui:calendar']);
    if (s.exp && v.expLeft <= 0) chips.push(['purple', '🧭 Expédition terminée !', 'retour']);
    else if (s.exp) chips.push(['purple', `🧭 Retour dans ${engine.fmt(v.expLeft)}`, 'retour']);
    if (v.atelierReady > 0) chips.push(['green', `🏭 +${v.atelierReady} or à collecter`, 'collecter']);
    const html = chips.map(([c, t, cmd]) => `<button class="chip ${c}" data-cmd="${cmd}">${esc(t)}</button>`).join('');
    if ($('chips').innerHTML !== html) $('chips').innerHTML = html;
  }

  function renderPanel(v) {
    const cat = CATS.find(c => c.id === tab);
    document.documentElement.style.setProperty('--cat', cat.col);
    const tabDot = { quetes: v.dailyReady, marche: v.atelierReady > 0, aventure: !!(v.s.exp && v.expLeft <= 0), recolter: craftable(v) > 0 && false };
    const th = CATS.map(c => `<button class="tab ${c.id === tab ? 'on' : ''}" role="tab" data-tab="${c.id}" style="--tc:${c.col}"><span class="ti">${c.ic}</span><span class="tl">${c.lb}</span>${tabDot[c.id] ? '<i class="dot"></i>' : ''}</button>`).join('');
    if (th !== lastTabsHtml) { $('tabs').innerHTML = th; lastTabsHtml = th; }
    const ch = cat.cmds.map((d, i) => {
      const lock = d.lock ? d.lock(v) : null, dot = d.dot ? d.dot(v) : 0;
      return `<button class="cmd-btn ${lock ? 'locked' : ''} ${d.warn ? 'warn' : ''}" data-i="${i}" data-c="${d.c || d.ui}"><span class="ic">${d.ic}</span><span class="lb">${esc(d.lb)}</span><span class="sb">${esc(lock || (d.sb ? d.sb(v) : ''))}</span>${dot ? `<span class="dot">${dot}</span>` : ''}</button>`;
    }).join('');
    if (ch !== lastCmdsHtml) { $('cmds').innerHTML = ch; lastCmdsHtml = ch; }
    let info = '';
    if (tab === 'quetes') info = v.quests.map(q => `<div class="qcard ${q.done ? 'done' : ''}"><span class="qi">${q.done ? '✅' : '📜'}</span><span class="qt">${esc(q.txt)}<small>${q.done ? 'Accomplie !' : `${q.g} or · ${q.x} XP`}</small></span><span class="qbar"><i style="width:${100 * q.prog / q.n}%"></i><em>${q.prog}/${q.n}</em></span></div>`).join('');
    if (tab === 'marche') info = `<div>${esc(v.event[0])} aujourd'hui · 🏦 ${v.s.bank} or en banque</div>`;
    if (tab === 'combat') info = `<div>⚔️ Attaque ${v.attack} · 🛡️ dégâts x${RPG.ARMOR[v.s.armor]} · ${esc(NICE[v.s.sword])}${v.s.pet ? ' · ' + petIc(v.s.pet) : ''}</div>`;
    if (tab === 'recolter') info = `<div>⛏️ ${esc(NICE[v.s.pick])} · ${Object.entries(v.s.inv).filter(([, n]) => n).map(([k, n]) => (ITEM[k] || ['📦'])[0] + n).join(' ') || 'sac vide'}</div>`;
    if (info !== lastInfoHtml) { $('cat-info').innerHTML = info; lastInfoHtml = info; }
    Scene.setSpotBadges({ quetes: v.dailyReady, forge: craftable(v) > 0, marche: v.atelierReady > 0, portes: !!(v.s.exp && v.expLeft <= 0), auberge: v.s.energy < 5 || v.s.hp < v.s.maxhp * 0.3 });
    Scene.mapCaption = `🗺️ Village — ${v.rank} niv ${v.s.lvl}`;
  }

  function refresh() {
    const v = engine.view();
    if (lastEnergy !== null && !frozen && v.s.energy > lastEnergy && v.s.energy - lastEnergy <= 2 && !busy) { // régénération en direct
      FX.floatAt($('bar-en'), `+${v.s.energy - lastEnergy}⚡`, '#ffe27a'); $('bar-en').classList.remove('regen'); void $('bar-en').offsetWidth; $('bar-en').classList.add('regen'); SFX.play('regen');
    }
    if (!frozen) { lastEnergy = v.s.energy; renderHUD(v); }
    renderPanel(v); return v;
  }

  /* ---------- récit ---------- */
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

  /* ---------- récompenses animées après une action ---------- */
  const FAIL = /^(❌|⚡ Pas assez|🩸|❓|⛏️ Il te faut|🐉 Reviens|🏰 Donjon dès|🧭 Expéditions dès|🎰 Usage|🏭 Rien|🏭 Tu n'as pas|✨ Enchantement niv|✨ Épée déjà|🎁 Déjà|🧭 Pas encore|🧭 Aucune|🐾 Adopte)/;
  async function rewards(before, after, src, text) {
    const b = before.s, a = after.s, tasks = [];
    const dg = a.or - b.or, gb = $('h-goldbox');
    goldAnim = true; $('h-gold').textContent = b.or;
    if (dg > 0) {
      SFX.play('coins', Math.ceil(dg / 15));
      let k = 0; const n = Math.min(12, 2 + Math.ceil(dg / 12));
      tasks.push(FX.fly(src, gb, '<span class="fcoin"></span>', n, { onEach: () => { if (k++ % 2 === 0) SFX.play('coin'); } }).then(() => { FX.countUp($('h-gold'), b.or, a.or, 600); FX.floatAt(gb, `+${dg}`, '#ffe678'); gb.classList.remove('flash'); void gb.offsetWidth; gb.classList.add('flash'); }));
    } else if (dg < 0) { FX.countUp($('h-gold'), b.or, a.or, 500); FX.floatAt(gb, `${dg}`, '#ff8a8a'); }
    else $('h-gold').textContent = a.or;
    const gained = Object.entries(a.inv).map(([k, n]) => [k, n - (b.inv[k] || 0)]).filter(([, d]) => d > 0);
    gained.forEach(([k, d], i) => tasks.push(FX.sleep(i * 120).then(() => FX.fly(src, $('btn-bag'), `<span class="ficon">${(ITEM[k] || ['📦'])[0]}</span>`, Math.min(d, 6), { spread: 30, dur: 800 }))
      .then(() => FX.floatAt($('btn-bag'), `+${d} ${(ITEM[k] || ['', k])[1]}`, '#bfffbf'))));
    for (const slot of ['pick', 'sword', 'armor']) if (a[slot] !== b[slot]) FX.toast(EQUIP_IC(a[slot]), `Équipé : ${NICE[a[slot]] || a[slot]}`, DESC[a[slot]] || '', 'equip');
    if (a.pet !== b.pet && a.pet) FX.toast(petIc(a.pet), `Nouveau compagnon : ${a.pet}`, '+4 attaque, +10% d\'or', 'equip');
    if (a.ench > b.ench) { const c = FX.center($('screen')); FX.burst(c.x, c.y, { count: 40, colors: ['#c77dff', '#e0aaff', '#7df9ff', '#fff'], speed: 260, gravity: 40, size: 5, life: 1300 }); SFX.play('sparkle'); }
    const dhp = a.hp - b.hp, den = a.energy - b.energy;
    if (dhp > 0 && a.lvl === b.lvl) { const c = FX.center($('bar-hp')); FX.burst(c.x, c.y, { count: 18, colors: ['#7be07b', '#c8ffc8', '#fff'], speed: 120, gravity: -120, size: 4, life: 900 }); FX.floatAt($('bar-hp'), `+${dhp} ❤️`, '#9dff9d'); SFX.play('heal'); }
    else if (dhp < 0) FX.floatAt($('bar-hp'), `${dhp} ❤️`, '#ff6a74');
    if (den) setTimeout(() => FX.floatAt($('t-en'), `${den > 0 ? '+' : ''}${den} ⚡`, '#ffe27a'), 150);
    const dxp = a.lvl === b.lvl ? a.xp - b.xp : 0;
    if (dxp > 0) setTimeout(() => FX.floatAt($('t-xp'), `+${dxp} XP`, '#8ec4ff'), 300);
    // toasts tirés du texte du jeu
    for (const line of text.split('\n')) {
      let m;
      if ((m = /^📜 Quête accomplie : (.+) → (.+)$/.exec(line))) FX.toast('📜', 'Quête accomplie !', `${m[1]} · ${m[2]}`, 'quest');
      else if ((m = /^🏅 SUCCÈS « (.+) » ! \+(\d+) or/.exec(line))) FX.toast('🏅', `Succès : ${m[1]}`, +m[2] ? `+${m[2]} or` : 'Débloqué !', 'ach');
      else if (/^✨ TROUVAILLE RARE/.test(line)) FX.toast('🔮', 'Trouvaille rare !', 'Un cristal magique', 'ach');
      else if ((m = /^🏦 Intérêts bancaires : (.+)$/.exec(line))) FX.toast('🏦', 'Intérêts bancaires', m[1], 'quest');
      else if (/^🎊 BONUS 7 jours/.test(line)) FX.toast('🎊', 'Coffre des 7 jours !', '+1 cristal, +2 diamants', 'ach');
      else if (/^🎁 Palier de 5 étages/.test(line)) FX.toast('🗼', 'Palier de la tour', '+1 cristal', 'ach');
    }
    frozen = null;
    if (a.lvl > b.lvl) {
      $('b-xp').style.width = '100%'; await FX.sleep(FX.cfg.instant ? 0 : 450);
      const bx = $('b-xp'); bx.classList.add('notrans'); bx.style.width = '0%'; void bx.offsetWidth; bx.classList.remove('notrans');
      renderHUD(after);
      const bd = $('badge'); bd.classList.remove('pop'); void bd.offsetWidth; bd.classList.add('pop');
      const rk = RPG.rank(a.lvl), rkb = RPG.rank(b.lvl);
      await FX.levelUp({ lvl: a.lvl, rank: rk, rankChanged: rk !== rkb, maxhp: a.maxhp, emblem: RANK_IMG(rk) });
    } else renderHUD(after);
    await Promise.all(tasks);
    goldAnim = false; $('h-gold').textContent = engine.view().s.or;
    lastEnergy = a.energy;
  }

  /* ---------- exécution d'une commande ---------- */
  const COMBAT = ['combat', 'donjon', 'boss', 'tour'], HARVEST = ['mine', 'minepierre', 'minefer', 'minediamant', 'herbe', 'pecher'];
  async function exec(cmd, args, label, srcEl) {
    if (busy) { Scene.skip(); try { await busy; } catch (e) { /* ignore */ } }
    let release; busy = new Promise(r => { release = r; });
    try {
      SFX.unlock();
      const before = engine.view();
      let r;
      try { r = engine.run(cmd, args || []); } catch (e) { console.error(e); r = { text: '⚠️ Erreur : ' + e.message, media: [], events: [] }; }
      const after = engine.view();
      const cat = CATS.find(c => c.id === tab), col = cat ? cat.col : '#888';
      const lbl = label || ('/' + [cmd].concat(args || []).join(' '));
      const failed = FAIL.test(r.text);
      const hasFight = r.events.some(e => e.e === 'fight'), hasHarv = r.events.some(e => e.e === 'harvest' || e.e === 'fish');
      let src = srcEl ? FX.center(srcEl) : FX.center($('screen'));
      frozen = before;
      if (set.video !== 'always' && COMBAT.includes(cmd) && hasFight) {
        const res = await Scene.playCombat(r.events, { cmd, onHeroHp: (hp, max) => { $('b-hp').style.width = pct(hp, max); $('t-hp').textContent = `PV ${hp}/${max}`; } });
        if (res && res.mobRect && r.events.some(e => e.e === 'end' && e.win)) src = { x: res.mobRect.left + res.mobRect.width / 2, y: res.mobRect.top + res.mobRect.height / 2 };
      } else if (set.video !== 'always' && HARVEST.includes(cmd) && hasHarv) {
        const res = await Scene.playHarvest(r.events, { cmd });
        if (res && res.point) src = res.point;
      } else if (failed && set.video !== 'always') {
        SFX.play('error'); FX.vibe(40); if (srcEl) FX.shake(srcEl, 5, 260);
      } else if (set.video !== 'never') {
        Scene.playVideo(r.media, { muted: !set.sound, labels: SCENE });
        if (!srcEl) src = FX.center($('screen'));
        if (cmd === 'daily' && !failed) { SFX.play('chest'); const c = FX.center($('screen')); FX.burst(c.x, c.y, { count: 40, colors: ['#ffd54a', '#fff3a0', '#c77dff'], speed: 300, size: 6 }); }
        if (cmd === 'dormir' && !failed) SFX.play('zzz');
        if (cmd === 'pari' && !failed) SFX.play('spin');
      } else {
        Scene.showMap();
        if (cmd === 'daily' && !failed) SFX.play('chest');
      }
      pushLog(lbl, r.text, col);
      await rewards(before, after, src, r.text);
      refresh(); snapshot();
      return r;
    } finally { frozen = null; release(); busy = null; }
  }

  /* ---------- onglets / boutons / appui long ---------- */
  function switchTab(id) {
    if (id === tab) return;
    const oi = CATS.findIndex(c => c.id === tab), ni = CATS.findIndex(c => c.id === id);
    tab = id; ls.set(KEY_TAB, tab); lastCmdsHtml = ''; refresh(); $('cmds').scrollTop = 0;
    if (!FX.cfg.instant) $('cmds').animate([{ opacity: 0, transform: `translateX(${(ni > oi ? 1 : -1) * 28}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
    SFX.play('tab'); FX.vibe(6);
  }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); });
  let lpTimer = 0, lpShown = false;
  $('cmds').addEventListener('pointerdown', e => {
    const b = e.target.closest('.cmd-btn'); if (!b) return;
    const r = b.getBoundingClientRect(), rp = document.createElement('span'); rp.className = 'ripple';
    rp.style.left = (e.clientX - r.left) + 'px'; rp.style.top = (e.clientY - r.top) + 'px'; b.appendChild(rp); setTimeout(() => rp.remove(), 500);
    lpShown = false; clearTimeout(lpTimer);
    lpTimer = setTimeout(() => { const d = CATS.find(c => c.id === tab).cmds[+b.dataset.i]; if (d && d.d) { showTip(b, d.d); lpShown = true; FX.vibe(10); } }, 480);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('cmds').addEventListener(ev, () => clearTimeout(lpTimer)));
  $('cmds').addEventListener('contextmenu', e => { if (e.target.closest('.cmd-btn')) e.preventDefault(); });
  function showTip(el, text) {
    const t = $('tip'); t.textContent = text; t.classList.remove('hidden');
    const r = el.getBoundingClientRect(), tw = Math.min(260, innerWidth - 20);
    t.style.width = tw + 'px'; t.style.left = Math.max(10, Math.min(innerWidth - tw - 10, r.left + r.width / 2 - tw / 2)) + 'px';
    t.style.top = Math.max(10, r.top - t.offsetHeight - 8) + 'px';
    clearTimeout(showTip.t); showTip.t = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  $('cmds').addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    if (lpShown) { lpShown = false; return; }
    const d = CATS.find(c => c.id === tab).cmds[+b.dataset.i]; const v = engine.view();
    SFX.unlock(); SFX.play('click'); FX.vibe(8);
    if (d.ui) return uiAction(d.ui, v);
    const lock = d.lock ? d.lock(v) : null;
    if (d.picker && (!lock || d.c === 'animal' || d.c === 'expedition')) return d.picker(v);
    exec(d.c, d.a || [], `${d.ic} ${d.lb}`, b);
  });
  $('chips').addEventListener('click', e => {
    const b = e.target.closest('[data-cmd]'); if (!b) return; SFX.unlock(); SFX.play('click');
    if (b.dataset.cmd.startsWith('ui:')) uiAction(b.dataset.cmd.slice(3), engine.view()); else exec(b.dataset.cmd, [], b.textContent, b);
  });
  $('badge').addEventListener('click', () => { SFX.unlock(); SFX.play('click'); uiAction('hero'); });
  $('who').addEventListener('click', () => { SFX.unlock(); SFX.play('click'); uiAction('hero'); });
  $('btn-bag').addEventListener('click', () => { SFX.unlock(); SFX.play('click'); uiAction('bag'); });
  $('btn-set').addEventListener('click', () => { SFX.unlock(); SFX.play('click'); uiAction('settings'); });
  $('mute').addEventListener('click', e => { e.stopPropagation(); set.sound = !set.sound; saveSettings(); SFX.unlock(); SFX.play('click'); FX.msg(set.sound ? '🔊 Son activé' : '🔇 Son coupé'); });
  Scene.initMap((spot, el) => {
    SFX.unlock(); SFX.play('click'); FX.vibe(8);
    const c = FX.center(el); FX.burst(c.x, c.y, { count: 12, colors: ['#ffd54a', '#fff'], speed: 140, gravity: 100, size: 4, life: 500 });
    switchTab(spot.tab);
    setTimeout(() => { const btn = $('cmds').querySelector(`[data-c="${spot.hi}"]`); if (btn) { btn.classList.remove('glowhi'); void btn.offsetWidth; btn.classList.add('glowhi'); btn.scrollIntoView({ block: 'nearest' }); } }, 60);
  });

  /* ---------- fenêtres ---------- */
  function openSheet(title, nodes, cls = '') {
    $('sheet-title').textContent = title;
    const body = $('sheet-body'); body.innerHTML = ''; nodes.forEach(n => body.appendChild(n));
    $('sheet').className = 'sheet ' + cls; SFX.play('tab');
  }
  function closeSheet() { $('sheet').classList.add('hidden'); }
  $('sheet-x').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function opt({ ic, title, sub, price, ok = true, onClick }) {
    const b = el('button', 'opt ' + (ok ? 'ok' : 'no'), `<span class="oi">${ic}</span><span class="ot"><b>${esc(title)}</b>${sub ? `<small>${sub}</small>` : ''}</span>${price != null ? `<span class="op">${esc(price)}</span>` : ''}`);
    b.addEventListener('click', e => { SFX.play('click'); onClick(e); }); return b;
  }
  const note = t => el('div', 'note', t);
  const run = (cmd, args, label) => e => { closeSheet(); exec(cmd, args, label, e && e.currentTarget); };

  function pickCraft(v) {
    const nodes = [note('Choisis un objet à fabriquer (+10 XP). Les outils fabriqués s\'équipent automatiquement.')];
    for (const [k, [need, label]] of Object.entries(RPG.RECIPES)) {
      const ok = Object.entries(need).every(([r, n]) => (v.s.inv[r] || 0) >= n);
      const sub = Object.entries(need).map(([r, n]) => { const h = v.s.inv[r] || 0; return `<span style="color:${h >= n ? '#9dff9d' : '#ff9a9a'}">${(ITEM[r] || [''])[0]} ${n} ${r} (${h})</span>`; }).join(' · ')
        + ([v.s.pick, v.s.sword, v.s.armor].includes(k) ? ' · <b>équipé</b>' : '') + (DESC[k] ? `<br>${DESC[k]}` : '');
      nodes.push(opt({ ic: EQUIP_IC(k), title: label, sub, ok, onClick: run('craft', [k], `🔨 ${label}`) }));
    }
    openSheet('🔨 Forge', nodes);
  }
  function pickBuy(v) {
    const nodes = [note(`Prix fixes. Tu as <b>${v.s.or} or</b>.`)];
    for (const [k, p] of Object.entries(RPG.SHOP)) {
      const owned = [v.s.pick, v.s.sword, v.s.armor].includes(k);
      const sub = (DESC[k] || '') + (owned ? ' · <b>déjà équipé</b>' : '') + (ITEM[k] ? ` · en stock : ${v.s.inv[k] || 0}` : '');
      nodes.push(opt({ ic: EQUIP_IC(k), title: NICE[k] || (ITEM[k] || ['', k])[1], sub, price: `${p} or`, ok: v.s.or >= p, onClick: run('acheter', [k], `🛒 ${k}`) }));
    }
    openSheet('🛒 Boutique', nodes);
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
      const [ic, name] = ITEM[k] || ['📦', k], n = v.s.inv[k], trend = v.prices[k] > RPG.BASE[k] ? '📈' : (v.prices[k] < RPG.BASE[k] ? '📉' : '');
      nodes.push(opt({ ic, title: `${name} x${n}`, sub: `${v.prices[k]} or/u aujourd'hui ${trend} (base ${RPG.BASE[k]})`, price: `≈ ${estimate(v, k, n)} or`, onClick: () => pickSellQty(v, k) }));
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
    [1, 5, 10].filter(n => n < max).concat([max]).forEach(n => { const b = el('button', '', n === max ? `Tout (${max})` : String(n)); b.onclick = () => { inp.value = n; upd(); SFX.play('click'); }; chips.appendChild(b); });
    const go = el('button', 'go', `${ic} Vendre`);
    go.onclick = e => { const n = parseInt(inp.value, 10) || 0; if (n < 1 || n > max) return FX.msg('Quantité invalide'); closeSheet(); exec('vendre', n === max ? [k] : [k, String(n)], `💰 Vendre ${n} ${name}`, e.currentTarget); };
    const row = el('div', 'numrow'); row.appendChild(inp);
    openSheet(`💰 Vendre ${name}`, [note(`Tu as ${max} ${name}. Prix du jour : ${v.prices[k]} or/u.`), row, chips, est, go]);
  }
  function pickAmount(cmd, title, v, max, min, text, quick) {
    const inp = el('input'); inp.type = 'number'; inp.min = min; inp.max = max; inp.inputMode = 'numeric'; inp.placeholder = `${min} – ${max}`;
    inp.value = Math.min(max, quick[0]) >= min ? Math.min(max, quick[0]) : '';
    const chips = el('div', 'chipsel');
    quick.filter(n => n <= max && n >= min).forEach(n => { const b = el('button', '', String(n)); b.onclick = () => { inp.type = 'number'; inp.value = n; SFX.play('click'); }; chips.appendChild(b); });
    const tout = el('button', '', 'Tout'); tout.onclick = () => { inp.type = 'text'; inp.value = 'tout'; SFX.play('click'); }; chips.appendChild(tout);
    const go = el('button', 'go', 'Valider');
    go.onclick = e => { const val = String(inp.value).trim().toLowerCase(); closeSheet(); exec(cmd, [val === 'tout' ? 'tout' : String(parseInt(val, 10) || 0)], `${title} ${val}`, e.currentTarget); };
    const row = el('div', 'numrow'); row.appendChild(inp);
    openSheet(title, [note(`${text}<br>Sur toi : <b>${v.s.or} or</b> · Banque : <b>${v.s.bank} or</b>`), row, chips, go]);
  }
  function pickAnimal(v) {
    if (v.s.pet) return exec('animal', [], '🐾 Compagnon');
    const nodes = [note('Un compagnon donne +4 attaque et +10% d\'or sur les victoires. Choix définitif.')];
    for (const [k, d] of [['loup', 'Fidèle et féroce'], ['faucon', 'Œil perçant'], ['renard', 'Rusé et vif']])
      nodes.push(opt({ ic: petIc(k), title: k[0].toUpperCase() + k.slice(1), sub: d, price: '300 or', ok: v.s.or >= 300, onClick: run('animal', [k], `🐾 ${k}`) }));
    openSheet('🐾 Adopter un compagnon', nodes);
  }
  function pickExpedition(v) {
    if (v.s.exp || v.s.lvl < 2) return exec('expedition', [], '🧭 Expédition');
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

  /* ---------- calendrier de la récompense quotidienne ---------- */
  function calendarSheet(v) {
    const s = v.s, keeps = s.last_daily === yesterday();
    const next = v.dailyReady ? (keeps ? s.streak + 1 : 1) : s.streak;
    const claimedTo = v.dailyReady ? next - 1 : s.streak;
    const base = Math.floor((Math.max(1, next) - 1) / 7) * 7;
    const grid = el('div', 'cal');
    for (let d = base + 1; d <= base + 7; d++) {
      const g = 50 + Math.min(d, 30) * 10, chest = d % 7 === 0;
      const state = d <= claimedTo ? 'got' : (d === next && v.dailyReady ? 'today' : 'lock');
      grid.appendChild(el('div', `cday ${state} ${chest ? 'chest' : ''}`, `<span class="cd">Jour ${d}</span><span class="ci">${chest ? '🎁' : '🪙'}</span><span class="cg">${g} or${chest ? '<br>+🔮 +💎💎' : ''}</span>${state === 'got' ? '<span class="ck">✔</span>' : ''}`));
    }
    const nodes = [note(`🔥 Série actuelle : <b>${s.streak} jour(s)</b>. Reviens chaque jour : +10 or par jour de série (max 30), un coffre tous les 7 jours et +20 ⚡.`), grid];
    if (v.dailyReady && !keeps && s.streak > 0) nodes.push(note(`😢 Tu as raté un jour : ta série repart à 1.`));
    if (v.dailyReady) { const b = el('button', 'go big', `🎁 Récupérer ${50 + Math.min(next, 30) * 10} or`); b.onclick = e => { closeSheet(); exec('daily', [], '🎁 Récompense du jour', e.currentTarget); }; nodes.push(b); }
    else nodes.push(note('✅ Déjà récupérée aujourd\'hui. Reviens demain !'));
    openSheet('🎁 Récompense quotidienne', nodes);
  }

  /* ---------- fiche du héros ---------- */
  function heroSheet(v) {
    const s = v.s, rk = v.rank;
    const card = el('div', 'hero-card', `
      <div class="hc-left"><div class="hc-glow"></div><img class="hc-hero" src="img/sprites/hero.webp" alt="Héros"><img class="hc-emb" src="${RANK_IMG(rk)}" alt=""></div>
      <div class="hc-right"><div class="hc-name">NATHAN</div><div class="hc-rank" style="color:${RANK_COL[rk]}">${rk.toUpperCase()} · NIV ${s.lvl}</div>
        <div class="hc-stat"><span>❤️ PV</span><b>${s.hp}/${s.maxhp}</b></div><div class="hc-stat"><span>⚡ Énergie</span><b>${s.energy}/${MAXEN}</b></div>
        <div class="hc-stat"><span>⚔️ Attaque</span><b>${v.attack}</b></div><div class="hc-stat"><span>🛡️ Dégâts subis</span><b>${Math.round(RPG.ARMOR[s.armor] * 100)}%</b></div>
        <div class="hc-stat"><span>✨ XP</span><b>${s.xp}/${s.lvl * 60}</b></div></div>`);
    const slots = el('div', 'slots');
    const slot = (ic, t, name, sub) => `<div class="slot"><span class="si">${ic}</span><span><small>${t}</small><b>${esc(name)}</b><em>${esc(sub || '')}</em></span></div>`;
    slots.innerHTML = slot('⛏️', 'Pioche', NICE[s.pick], DESC[s.pick] || 'Fabrique une pioche !') + slot('🗡️', 'Épée', NICE[s.sword], s.sword === 'aucune' ? 'Mains nues' : DESC[s.sword])
      + slot('🛡️', 'Armure', NICE[s.armor], s.armor === 'aucune' ? 'Aucune protection' : DESC[s.armor]) + slot(s.pet ? petIc(s.pet) : '🐾', 'Compagnon', s.pet || 'Aucun', s.pet ? '+4 attaque, +10% or' : '300 or (Aventure)')
      + slot('✨', 'Enchantement', `${s.ench}/5`, `+${s.ench * 3} attaque`) + slot('🏭', 'Atelier', `Niveau ${s.atelier}`, `${s.atelier * 3} or/heure`);
    const stats = el('div', 'hstats', [['⚔️', 'Victoires', s.kills], ['⛏️', 'Récoltes', s.mined], ['🔨', 'Fabrications', s.crafted], ['🐉', 'Dragons', s.boss], ['🏰', 'Donjons', s.donjons], ['🗼', 'Record tour', s.floor], ['🔥', 'Série', s.streak + ' j'], ['🏅', 'Succès', `${s.ach.length}/${RPG.ACH.length}`]]
      .map(([i, t, n]) => `<div><span>${i}</span><b>${n}</b><small>${t}</small></div>`).join(''));
    const nextRank = RPG.RANKS.find(([m]) => m > s.lvl);
    const nodes = [card, el('h3', 'sh3', 'Équipement'), slots, el('h3', 'sh3', 'Exploits'), stats];
    if (nextRank) nodes.push(note(`Prochain rang : <b>${nextRank[1]}</b> au niveau ${nextRank[0]}.`));
    openSheet('🧝 Fiche du héros', nodes, 'wide');
  }
  function bagSheet(v) {
    const s = v.s, items = Object.entries(s.inv).filter(([, n]) => n > 0);
    const grid = el('div', 'bag');
    grid.innerHTML = items.length ? items.map(([k, n]) => `<div class="bitem"><span class="bi">${(ITEM[k] || ['📦'])[0]}</span><b>x${n}</b><small>${(ITEM[k] || ['', k])[1]}</small>${RPG.BASE[k] ? `<em>${v.prices[k]} or/u</em>` : ''}</div>`).join('') : '<div class="note">Ton sac est vide. Va récolter !</div>';
    const nodes = [note(`💰 ${s.or} or sur toi · 🏦 ${s.bank} en banque`), grid];
    const row = el('div', 'btnrow');
    const b1 = el('button', 'go alt', '💰 Vendre'); b1.onclick = () => { pickSell(engine.view()); };
    const b2 = el('button', 'go alt', '🔨 Fabriquer'); b2.onclick = () => { pickCraft(engine.view()); };
    row.append(b1, b2); nodes.push(row);
    openSheet('🎒 Inventaire', nodes);
  }

  /* ---------- réglages ---------- */
  function settingsSheet() {
    const nodes = [];
    const toggle = (ic, label, key, sub) => {
      const r = el('label', 'srow', `<span class="sic">${ic}</span><span class="stx"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" ${set[key] ? 'checked' : ''}><i class="sw"></i>`);
      r.querySelector('input').onchange = e => { set[key] = e.target.checked; saveSettings(); SFX.unlock(); SFX.play('click'); if (key === 'vibrate' && set.vibrate) FX.vibe(30); };
      return r;
    };
    const seg = (ic, label, key, opts) => {
      const r = el('div', 'srow seg', `<span class="sic">${ic}</span><span class="stx"><b>${label}</b></span>`), g = el('div', 'segs');
      opts.forEach(([val, txt]) => { const b = el('button', String(set[key]) === String(val) ? 'on' : '', txt); b.onclick = () => { set[key] = val; saveSettings(); SFX.play('click'); g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }; g.appendChild(b); });
      r.appendChild(g); return r;
    };
    nodes.push(toggle('🔊', 'Effets sonores', 'sound', 'Bruitages et son des vidéos'));
    const vol = el('div', 'srow', `<span class="sic">🎚️</span><span class="stx"><b>Volume</b></span><input type="range" min="0" max="1" step="0.05" value="${set.vol}">`);
    vol.querySelector('input').oninput = e => { set.vol = +e.target.value; saveSettings(); }; vol.querySelector('input').onchange = () => SFX.play('coin');
    nodes.push(vol);
    nodes.push(toggle('🎵', 'Musique d\'ambiance', 'music', 'Mélodie médiévale générée en direct'));
    nodes.push(toggle('📳', 'Vibrations', 'vibrate', navigator.vibrate ? 'Coups, niveaux, erreurs' : 'Non prise en charge par cet appareil'));
    nodes.push(seg('🎬', 'Scènes vidéo', 'video', [['auto', 'Auto'], ['always', 'Toujours'], ['never', 'Jamais']]));
    nodes.push(note('Auto : combats et récoltes animés, vidéos pour le reste. Toujours : vidéos partout (comme avant).'));
    nodes.push(seg('⏩', 'Vitesse des animations', 'speed', [[0.7, 'Lente'], [1, 'Normale'], [1.6, 'Rapide'], ['instant', 'Instant']]));
    nodes.push(seg('✨', 'Effets visuels', 'fx', [['full', 'Complets'], ['reduced', 'Réduits']]));
    const row = el('div', 'btnrow');
    const bt = el('button', 'go alt', '📖 Tutoriel'); bt.onclick = () => { closeSheet(); startTuto(true); };
    const be = el('button', 'go alt', '💾 Exporter'); be.onclick = () => uiAction('export');
    row.append(bt, be); nodes.push(row);
    nodes.push(note(`RPG de Nathan · version ${VERSION} · sauvegarde dans ce navigateur.`));
    openSheet('⚙️ Réglages', nodes);
  }

  /* ---------- actions d'interface ---------- */
  function uiAction(a, v) {
    v = v || engine.view();
    if (a === 'hero') return heroSheet(v);
    if (a === 'bag') return bagSheet(v);
    if (a === 'settings') return settingsSheet();
    if (a === 'calendar') return calendarSheet(v);
    if (a === 'map') { Scene.showMap(); return; }
    if (a === 'export') {
      const ta = el('textarea'); ta.readOnly = true; ta.value = engine.exportSave();
      const copy = el('button', 'go', '📋 Copier');
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(ta.value); FX.msg('📋 Copié !'); }
        catch (e) { ta.focus(); ta.select(); try { document.execCommand('copy'); FX.msg('📋 Copié !'); } catch (_) { FX.msg('Sélectionne et copie le texte'); } }
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
        try { engine.importSave(ta.value.trim()); closeSheet(); FX.msg('✅ Sauvegarde chargée'); pushLog('📂 Import', '📂 Sauvegarde importée avec succès.', '#78788c'); refresh(); snapshot(); }
        catch (e) { FX.msg('❌ Texte invalide'); SFX.play('error'); }
      };
      return openSheet('📂 Importer une sauvegarde', [note('⚠️ Remplace ta partie actuelle.'), ta, file, pickF, go]);
    }
    if (a === 'reset') {
      const armed = {};
      const twoStep = (btn, label, fn) => { btn.onclick = () => { if (!armed[label]) { armed[label] = 1; btn.textContent = '⚠️ Sûr ? Touche encore pour confirmer'; SFX.play('error'); return; } fn(); }; };
      const b1 = el('button', 'go danger', '🔄 Nouvelle partie (niveau 1)');
      twoStep(b1, 'new', () => { closeSheet(); exec('reset', [], '🔄 Réinitialiser'); });
      const b2 = el('button', 'go alt', '↩️ Revenir à la sauvegarde d\'origine (niv 2)');
      twoStep(b2, 'orig', () => { ls.del(KEY_SAVE); closeSheet(); FX.msg('↩️ Sauvegarde d\'origine restaurée'); pushLog('↩️ Restauration', '↩️ Retour à la sauvegarde importée du chat (niveau 2).', '#78788c'); refresh(); snapshot(); });
      return openSheet('🔄 Réinitialiser', [note('⚠️ Ta progression actuelle sera <b>définitivement effacée</b>. Pense à l\'exporter avant !'), b1, b2]);
    }
  }

  /* ---------- résumé « pendant ton absence » ---------- */
  function snapshot() {
    const v = engine.view();
    ls.set(KEY_SEEN, JSON.stringify({ t: Date.now(), energy: v.s.energy, bank: v.s.bank, atelier: v.atelierReady, expEnd: v.s.exp ? v.s.exp.end : 0, daily: v.dailyReady, today: v.today }));
  }
  function offlineSummary(minAwayMs = 5 * 60 * 1000) {
    let snap = null; try { snap = JSON.parse(ls.get(KEY_SEEN) || 'null'); } catch (e) { snap = null; }
    if (!snap || Date.now() - snap.t < minAwayMs) return false;
    const v = engine.view(), lines = [], acts = [];
    const away = Date.now() - snap.t, h = Math.floor(away / 3600000), m = Math.floor(away / 60000) % 60;
    if (v.s.energy > snap.energy) lines.push(['⚡', `Énergie rechargée : +${v.s.energy - snap.energy}`, `${v.s.energy}/${MAXEN}`]);
    if (v.atelierReady > snap.atelier) { lines.push(['🏭', `Ton atelier a produit +${v.atelierReady - snap.atelier} or`, `${v.atelierReady} or à collecter`]); acts.push(['🪙 Collecter', 'collecter']); }
    if (v.s.bank > snap.bank) lines.push(['🏦', `Intérêts bancaires : +${v.s.bank - snap.bank} or`, `banque : ${v.s.bank} or`]);
    if (v.s.exp && v.expLeft <= 0 && snap.expEnd && snap.expEnd * 1000 > snap.t) { lines.push(['🧭', 'Ton expédition est revenue !', 'butin à récupérer']); acts.push(['🏕️ Récupérer le butin', 'retour']); }
    if (v.dailyReady && (!snap.daily || snap.today !== v.today)) { lines.push(['🎁', 'Nouvelle récompense du jour', `série 🔥 ${v.s.streak}`]); acts.push(['🎁 Récompense', 'ui:calendar']); }
    if (snap.today !== v.today) lines.push(['📜', 'Nouvelles quêtes du jour', v.event[0]]);
    if (!lines.length) return false;
    const list = el('div', 'away', lines.map(([i, t, s]) => `<div class="aw"><span>${i}</span><span><b>${esc(t)}</b><small>${esc(s)}</small></span></div>`).join(''));
    const nodes = [note(`Tu es parti ${h ? h + ' h ' : ''}${m} min. Pendant ce temps…`), list];
    const row = el('div', 'btnrow');
    acts.forEach(([t, c]) => { const b = el('button', 'go', t); b.onclick = e => { if (c.startsWith('ui:')) uiAction(c.slice(3)); else { closeSheet(); exec(c, [], t, e.currentTarget); } }; row.appendChild(b); });
    const ok = el('button', 'go alt', 'Super !'); ok.onclick = closeSheet; row.appendChild(ok);
    nodes.push(row);
    openSheet('🌙 Pendant ton absence', nodes);
    setTimeout(() => { const c = FX.center($('sheet-title')); FX.burst(c.x, c.y, { count: 20, colors: ['#ffd54a', '#fff'], speed: 160, gravity: 120, size: 4 }); }, 250);
    return true;
  }

  /* ---------- tutoriel (première visite) ---------- */
  const TUTO = [
    ['hud', '👋 Bienvenue dans la nouvelle version !', 'Voici ton héros : niveau, PV, énergie (⚡ +1 toutes les 4 min) et ton or. Touche ton badge pour voir ta fiche.'],
    ['screen', '🗺️ La scène', 'La carte animée du village : touche un lieu pour y aller. Les combats et les récoltes s\'animent ici (touche l\'écran pour passer).'],
    ['tabs', '📂 Les catégories', 'Récolter, Combat, Aventure, Marché, Quêtes, Perso.'],
    ['cmds', '👆 Les actions', 'Touche une action pour la lancer. Appui long sur un bouton = explication. Les boutons grisés indiquent ce qu\'il manque.'],
    ['btn-set', '⚙️ Réglages', 'Son, musique, vibrations, vidéos et vitesse des animations. Bonne aventure, Nathan !'],
  ];
  let tutoI = 0;
  function startTuto(force) {
    if (!force && ls.get(KEY_TUTO)) return false;
    tutoI = 0; $('tuto').classList.remove('hidden'); showTuto(); return true;
  }
  function showTuto() {
    const [id, t, d] = TUTO[tutoI], target = $(id), r = target.getBoundingClientRect(), hole = $('tuto-hole'), box = $('tuto-box');
    Object.assign(hole.style, { left: (r.left - 6) + 'px', top: (r.top - 6) + 'px', width: (r.width + 12) + 'px', height: (r.height + 12) + 'px' });
    box.innerHTML = `<b>${t}</b><p>${d}</p><div class="tb"><button class="tskip">Passer</button><span>${tutoI + 1}/${TUTO.length}</span><button class="go tnext">${tutoI === TUTO.length - 1 ? 'Jouer !' : 'Suivant ›'}</button></div>`;
    const below = r.top + r.height / 2 < innerHeight / 2;
    box.style.top = below ? Math.min(innerHeight - 190, r.bottom + 14) + 'px' : ''; box.style.bottom = below ? '' : Math.max(10, innerHeight - r.top + 14) + 'px';
    box.querySelector('.tnext').onclick = () => { SFX.unlock(); SFX.play('click'); tutoI++; if (tutoI >= TUTO.length) endTuto(); else showTuto(); };
    box.querySelector('.tskip').onclick = endTuto;
  }
  function endTuto() { $('tuto').classList.add('hidden'); ls.set(KEY_TUTO, '1'); }

  /* ---------- décor : braises ---------- */
  const emb = $('embers'); for (let i = 0; i < 16; i++) { const s = document.createElement('i'); s.style.left = (Math.random() * 100) + '%'; s.style.animationDelay = (-Math.random() * 12) + 's'; s.style.animationDuration = (8 + Math.random() * 8) + 's'; s.style.setProperty('--dx', ((Math.random() - 0.5) * 80) + 'px'); emb.appendChild(s); }

  /* ---------- démarrage ---------- */
  applySettings();
  renderLog();
  const v0 = refresh();
  pushLog('🏰 Bienvenue, ' + v0.rank + ' niveau ' + v0.s.lvl, engine.run('rappel', []).text, '#c9a24a', false); // lecture seule
  Scene.showMap(); $('caption').textContent = `🗺️ Village — ${v0.rank} niv ${v0.s.lvl}`;
  if (!startTuto(false)) offlineSummary();
  snapshot();
  setInterval(refresh, 1000);
  setInterval(() => { if (!document.hidden && !busy) snapshot(); }, 30000);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); snapshot(); SFX.pause(); }
    else { SFX.resume(); refresh(); if (hiddenAt && Date.now() - hiddenAt > 10 * 60 * 1000 && $('sheet').classList.contains('hidden')) offlineSummary(10 * 60 * 1000); }
  });
  window.addEventListener('pagehide', snapshot);
  document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  window.__rpg = { engine, exec, refresh, settings: set, startTuto, offlineSummary, uiAction }; // débogage / tests
})();
