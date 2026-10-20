#!/usr/bin/env bash
# يولّد sw.js بقائمة كل ملفات التطبيق وإصدار مبني على محتواها. شغّله بعد أي تعديل: bash scripts/gen-sw.sh
set -e
cd "$(dirname "$0")/.."
FILES=$( (echo index.html; echo manifest.webmanifest; find assets -type f | sort) | sed 's/.*/  ".\/&",/' )
VERSION=$(cat index.html manifest.webmanifest $(find assets -type f | sort) | sha1sum | cut -c1-10)
cat > sw.js <<SW
/* عامل الخدمة لتطبيق المروة: يحفظ ملفات التطبيق ليعمل بدون إنترنت.
   مُولّد تلقائياً — يتغير الإصدار مع أي تعديل في الملفات فيتحدث التطبيق عند المستخدمين. */
const VERSION = 'elmarwa-${VERSION}';
const SHELL = [
  './',
${FILES}
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
SW
echo "sw version $VERSION, $(echo "$FILES" | wc -l) files"
