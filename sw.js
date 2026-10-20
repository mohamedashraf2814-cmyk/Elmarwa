/* عامل الخدمة لتطبيق المروة: يحفظ ملفات التطبيق ليعمل بدون إنترنت.
   مُولّد تلقائياً — يتغير الإصدار مع أي تعديل في الملفات فيتحدث التطبيق عند المستخدمين. */
const VERSION = 'elmarwa-637da45082';
const SHELL = [
  './',
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/app.css",
  "./assets/css/tokens.css",
  "./assets/css/views.css",
  "./assets/css/workflow.css",
  "./assets/img/icons/apple-touch-icon.png",
  "./assets/img/icons/favicon-32.png",
  "./assets/img/icons/icon-192.png",
  "./assets/img/icons/icon-512.png",
  "./assets/img/icons/maskable-512.png",
  "./assets/img/logo.svg",
  "./assets/js/app.js",
  "./assets/js/core/hospital.js",
  "./assets/js/core/icons.js",
  "./assets/js/core/insights.js",
  "./assets/js/core/pwa.js",
  "./assets/js/core/store.js",
  "./assets/js/core/ui.js",
  "./assets/js/core/util.js",
  "./assets/js/data/reference.js",
  "./assets/js/data/scenarios.js",
  "./assets/js/data/seed-extra.js",
  "./assets/js/data/seed.js",
  "./assets/js/data/workflow-templates.js",
  "./assets/js/views/about.js",
  "./assets/js/views/admin.js",
  "./assets/js/views/appointments.js",
  "./assets/js/views/beds.js",
  "./assets/js/views/billing.js",
  "./assets/js/views/clinic.js",
  "./assets/js/views/dashboard.js",
  "./assets/js/views/emergency.js",
  "./assets/js/views/inventory.js",
  "./assets/js/views/login.js",
  "./assets/js/views/nursing.js",
  "./assets/js/views/operations.js",
  "./assets/js/views/patients.js",
  "./assets/js/views/pharmacy.js",
  "./assets/js/views/scenarios.js",
  "./assets/js/views/surgery.js",
  "./assets/js/views/workflows.js",
  "./assets/js/views/worklists.js",
  "./assets/js/workflow/designer.js",
  "./assets/js/workflow/engine.js",
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // الخطوط من Google: من الشبكة أولاً ثم النسخة المحفوظة
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    event.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req)));
    return;
  }
  if (url.origin !== location.origin) return;
  // صفحات التنقل: التطبيق دائماً من الذاكرة ليفتح فوراً حتى بدون إنترنت
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
