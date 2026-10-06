/* Service worker : jeu jouable hors-ligne après la première visite. Généré par tools/build.py. */
const CACHE = '__CACHE__';
const ASSETS = __ASSETS__;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(new Request(a, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
const VER = CACHE.replace('rpg-nathan-', '');
// Après une mise à jour : chaque page ouverte doit répondre avec sa version. Une ancienne page (v1, qui ne répond pas)
// ou une page d'une autre version est rechargée une fois, pour que le joueur passe tout de suite à la nouvelle version.
function refreshOldPages() {
  return self.clients.matchAll({ type: 'window' }).then(cs => Promise.all(cs.map(c => new Promise(done => {
    let answered = false;
    const ch = new MessageChannel();
    ch.port1.onmessage = ev => { answered = true; if (ev.data !== VER) c.navigate(c.url).catch(() => {}); done(); };
    try { c.postMessage({ type: 'rpg-version?' }, [ch.port2]); } catch (err) { /* rien */ }
    setTimeout(() => { if (!answered) c.navigate(c.url).catch(() => {}); done(); }, 2000);
  }))));
}
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => {
    const old = ks.filter(k => k !== CACHE);
    return Promise.all(old.map(k => caches.delete(k))).then(() => self.clients.claim()).then(() => (old.length ? refreshOldPages() : null));
  }));
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
  const url = new URL(req.url);
  // La page : toujours le réseau d'abord (sans cache HTTP) pour recevoir les mises à jour, cache si hors-ligne.
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(k => k.put('./index.html', c)); } return res; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match(req, { ignoreSearch: true }))));
    return;
  }
  // Code versionné (?v=...) et médias : cache d'abord, réseau sinon.
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    if (res.ok && res.status === 200) { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }))));
});
