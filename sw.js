/* COC Strategy — service worker.
   Satu berkas ini dipakai di dua tempat: di akar repo (deploy GitHub Pages,
   cakupan penuh) dan di assets/ (cadangan untuk hosting artifact). Semua
   jalur dihitung dari posisi berkas ini sendiri, jadi isinya identik. */
var CACHE = 'coc-strategy-v1';

var swDir = self.location.pathname.replace(/[^/]*$/, '');
var inAssets = swDir.slice(-8) === '/assets/';
var rootDir = inAssets ? swDir.slice(0, -7) : swDir;
var assetDir = inAssets ? swDir : swDir + 'assets/';

var CORE = [
  rootDir + 'index.html',
  assetDir + 'manifest.webmanifest',
  assetDir + 'icon-192.png',
  assetDir + 'icon-512.png',
  assetDir + 'icon-maskable-512.png',
  assetDir + 'apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Satu aset gagal tidak boleh menggagalkan pemasangan seluruhnya.
      return Promise.all(CORE.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navigasi halaman: utamakan jaringan, jatuh ke salinan cache saat offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(rootDir + 'index.html', copy);
        });
        return res;
      }).catch(function () {
        return caches.match(rootDir + 'index.html', { ignoreSearch: true })
          .then(function (hit) { return hit || caches.match(req, { ignoreSearch: true }); });
      })
    );
    return;
  }

  // Aset lain (ikon, manifest, font): sajikan dari cache, segarkan di latar.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
