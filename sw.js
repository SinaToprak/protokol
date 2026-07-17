const CACHE_NAME = 'protokol-v12';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './gorevler.html',
  './sorunlar.html',
  './kontrol-listesi.html',
  './nobet-listesi.html',
  './personeller.html',
  './duyurular.html',
  './js/layout.js',
  './js/login.js',
  './js/dashboard.js',
  './js/gorevler.js',
  './js/sorunlar.js',
  './js/kontrol-listesi.js',
  './js/nobet-listesi.js',
  './js/duyurular.js',
  './db/firebase.js',
  './manifest.json',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png',
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js',
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js'
];

// Service Worker Kurulum (Install) Aşaması - Statik dosyaları önbelleğe al
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Ön Belleğe Alınıyor...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Etkinleştirme (Activate) Aşaması - Eski önbellekleri temizle
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Eski Önbellek Siliniyor:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch (Ağ İstekleri Yakalama) Aşaması - Çevrimdışı desteği
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Firebase Realtime Database websocket ve yazma/okuma isteklerini önbelleğe alma!
  if (url.includes('firebaseio.com') || url.includes('identitytoolkit.googleapis.com')) {
    return; // Doğrudan ağa gönder
  }

  // İstekleri Stale-While-Revalidate stratejisi ile yönet
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Varsa önbellekteki dosyayı hemen döndür, arka planda ağdan yenisini çek ve önbelleği güncelle
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch((err) => console.log('[Service Worker] Arka plan güncelleme başarısız (çevrimdışı):', err));
        
        return cachedResponse;
      }

      // Önbellekte yoksa ağa git
      return fetch(e.request);
    }).catch(() => {
      // Çevrimdışı durumdayken HTML sayfaları talep ediliyorsa index.html'i göster
      if (e.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
