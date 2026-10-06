/* Service worker : jeu jouable hors-ligne après le premier chargement. */
const CACHE = 'rpg-nathan-9c468db2';
const ASSETS = [
"./",
"index.html",
"manifest.webmanifest",
"css/style.css",
"js/default-save.js",
"js/engine.js",
"js/app.js",
"img/lobby_bg.webp",
"img/icon-192.png",
"img/scenes/acheter.webp",
"img/scenes/animal.webp",
"img/scenes/atelier.webp",
"img/scenes/banque.webp",
"img/scenes/boss.webp",
"img/scenes/boutique.webp",
"img/scenes/collecter.webp",
"img/scenes/combat.webp",
"img/scenes/craft.webp",
"img/scenes/daily.webp",
"img/scenes/deposer.webp",
"img/scenes/dormir.webp",
"img/scenes/enchanter.webp",
"img/scenes/ennemis.webp",
"img/scenes/expedition.webp",
"img/scenes/herbe.webp",
"img/scenes/inventaire.webp",
"img/scenes/manger.webp",
"img/scenes/mine.webp",
"img/scenes/minediamant.webp",
"img/scenes/minefer.webp",
"img/scenes/minepierre.webp",
"img/scenes/mort.webp",
"img/scenes/niveau.webp",
"img/scenes/pari.webp",
"img/scenes/pecher.webp",
"img/scenes/quetes.webp",
"img/scenes/rangs.webp",
"img/scenes/recettes.webp",
"img/scenes/retirer.webp",
"img/scenes/soin.webp",
"img/scenes/stats.webp",
"img/scenes/succes.webp",
"img/scenes/tour.webp",
"img/scenes/vendre.webp",
"img/scenes/victoire.webp",
"vid/acheter.mp4",
"vid/animal.mp4",
"vid/atelier.mp4",
"vid/banque.mp4",
"vid/boss.mp4",
"vid/boutique.mp4",
"vid/collecter.mp4",
"vid/combat.mp4",
"vid/craft.mp4",
"vid/daily.mp4",
"vid/deposer.mp4",
"vid/dormir.mp4",
"vid/enchanter.mp4",
"vid/ennemis.mp4",
"vid/expedition.mp4",
"vid/herbe.mp4",
"vid/inventaire.mp4",
"vid/manger.mp4",
"vid/mine.mp4",
"vid/minediamant.mp4",
"vid/minefer.mp4",
"vid/minepierre.mp4",
"vid/mort.mp4",
"vid/niveau.mp4",
"vid/pari.mp4",
"vid/pecher.mp4",
"vid/quetes.mp4",
"vid/rangs.mp4",
"vid/recettes.mp4",
"vid/retirer.mp4",
"vid/soin.mp4",
"vid/stats.mp4",
"vid/succes.mp4",
"vid/tour.mp4",
"vid/vendre.mp4",
"vid/victoire.mp4"
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Les <video> demandent des plages d'octets (Range) : on les découpe depuis le cache (indispensable pour Safari).
async function rangeResponse(req) {
  const cached = await caches.match(req.url, { ignoreSearch: true });
  if (!cached) return fetch(req);
  const buf = await cached.arrayBuffer(), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  let start = 0, end = size - 1;
  if (m) {
    if (m[1] === '' && m[2] !== '') start = Math.max(0, size - parseInt(m[2], 10));
    else { start = parseInt(m[1] || '0', 10); if (m[2] !== '') end = Math.min(parseInt(m[2], 10), size - 1); }
  }
  if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': cached.headers.get('Content-Type') || 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.headers.get('range')) { e.respondWith(rangeResponse(req)); return; }
  const isShell = req.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(new URL(req.url).pathname);
  if (isShell) { // réseau d'abord (mises à jour), cache en secours
    e.respondWith(fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
    if (res.ok && res.status === 200) { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); }
    return res;
  })));
});
