// EDU-BOSS Service Worker
// Bu dosya, EDU-BOSS-v29.html ile TAM OLARAK AYNI KLASÖRDE bulunmalıdır.
// (blob:/data: URL'lerden servis çalışanı kaydı çoğu tarayıcıda desteklenmez,
//  bu yüzden gerçek bir statik dosya olarak sunulur.)

const CACHE_VERSION = 'eduboss-v29';
const STATIC = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=Black+Ops+One&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(STATIC.map((u) => new Request(u, { mode: 'no-cors' }))))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Firebase / API isteklerini asla cache'leme — her zaman canlı veri lazım
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('api.anthropic.com') ||
    url.includes('identitytoolkit') ||
    url.includes('firebase') ||
    e.request.method !== 'GET'
  ) {
    return;
  }

  // Ana HTML dosyası için: önce ağ, olmazsa cache (network-first)
  // Böylece kullanıcı her açtığında güncel sürümü görür, sadece offline'da cache'e düşer.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, clone));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Statik varlıklar (fontlar, pdf.js, chart.js) için: önce cache, olmazsa ağ (cache-first)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((resp) => {
          if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, clone));
          return resp;
        })
        .catch(() => caches.match(e.request));
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
