// シルベ：電波がなくても画面を開けるようにする（データ側の同期はFirebaseが受け持つ）
const V = 'shirube-v7-0';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'store.js', 'firebase-config.js', 'github-config.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'vendor/Sortable.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const cacheable = u.origin === location.origin || /gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com/.test(u.href);
  if (!cacheable || u.pathname.includes('/private/')) return;
  // まず新しいものを取りに行き、だめなら最後に保存したもの
  // ネットが弱い時は3秒で保存済みの画面に切り替える
  // 自分のサイトのファイルは、ブラウザの一時保存（10分）を使わず必ず確かめる（古い画面と新しいプログラムが混ざって開けなくなるのを防ぐ）
  const net = fetch(e.request, u.origin === location.origin ? { cache: 'no-cache' } : undefined).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; });
  const fallback = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined));
  e.respondWith(new Promise(resolve => {
    let done = false;
    const t = setTimeout(() => fallback().then(r => { if (r && !done) { done = true; resolve(r); } }), 3000);
    net.then(r => { if (!done) { done = true; clearTimeout(t); resolve(r); } })
       .catch(() => fallback().then(r => { if (!done) { done = true; clearTimeout(t); resolve(r || Response.error()); } }));
  }));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs[0] ? cs[0].focus() : self.clients.openWindow('./'))); });
