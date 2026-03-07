// ════════════════════════════════════════
//  보닥데코 Service Worker
//  - 앱 파일 캐싱 (오프라인 실행)
//  - 구글 시트 요청은 캐시 안 함 (항상 네트워크)
// ════════════════════════════════════════

const CACHE_NAME = 'bodak-v1';

// 캐싱할 앱 파일들
const APP_ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js',
];

// ── 설치: 앱 파일 캐싱 ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        APP_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// ── 활성화: 구버전 캐시 삭제 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── fetch 전략 ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 구글 시트 / Apps Script → Service Worker 완전 우회 (브라우저가 직접 처리)
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com') || url.includes('sheets.googleapis.com')) {
    return; // respondWith 호출 안 함 → 브라우저가 직접 처리
  }

  // GET 요청만 캐싱
  if (event.request.method !== 'GET') return;

  // Network First (온라인이면 최신, 실패하면 캐시)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 정상 응답이면 캐시에도 저장
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // 오프라인 → 캐시에서 서빙
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // 캐시도 없으면 index.html fallback (SPA)
          return caches.match('./index.html');
        });
      })
  );
});
