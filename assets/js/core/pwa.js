/* تطبيق ويب قابل للتثبيت (PWA): تسجيل عامل الخدمة وزر «تنزيل التطبيق» */
(function () {
  'use strict';
  const EM = window.EM;
  const pwa = { deferred: null, listeners: new Set() };

  const ua = navigator.userAgent;
  pwa.isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  pwa.isAndroid = /android/i.test(ua);
  pwa.isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  pwa.supported = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
  pwa.state = () => (pwa.isStandalone() ? 'installed' : pwa.deferred ? 'ready' : pwa.isIOS ? 'ios' : 'manual');
  pwa.onChange = (fn) => { pwa.listeners.add(fn); return () => pwa.listeners.delete(fn); };
  const changed = () => pwa.listeners.forEach((fn) => fn(pwa.state()));

  /* المتصفح يعلن أن التطبيق قابل للتثبيت — نحتفظ بالحدث لزرنا */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwa.deferred = e;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    pwa.deferred = null;
    try { EM.store?.audit?.('تثبيت التطبيق على الجهاز', 'pwa', 'install'); } catch { /* */ }
    EM.ui?.toast('تم تثبيت تطبيق المروة على جهازك', 'ok', 5000);
    changed();
  });

  /** زر التنزيل: يفتح نافذة التثبيت الأصلية، أو يعرض الخطوات اليدوية حسب الجهاز */
  pwa.install = async function () {
    if (pwa.isStandalone()) { EM.ui.toast('التطبيق مثبت بالفعل وتعمل منه الآن', 'ok'); return; }
    if (pwa.deferred) {
      const e = pwa.deferred;
      pwa.deferred = null;
      e.prompt();
      const choice = await e.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') EM.ui.toast('جارٍ تثبيت التطبيق…', 'ok');
      changed();
      return;
    }
    pwa.showGuide();
  };

  pwa.showGuide = function () {
    const { icon } = EM;
    const steps = pwa.isIOS
      ? [['افتح النظام في متصفح Safari', 'compass'], ['اضغط زر المشاركة أسفل الشاشة', 'upload'], ['اختر «إضافة إلى الشاشة الرئيسية»', 'plus'], ['اضغط «إضافة» — ستجد أيقونة المروة على شاشتك', 'check']]
      : pwa.isAndroid
        ? [['افتح النظام في متصفح Chrome', 'compass'], ['اضغط قائمة النقاط الثلاث أعلى الشاشة', 'menu'], ['اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»', 'download'], ['أكّد التثبيت — ستجد أيقونة المروة مع تطبيقاتك', 'check']]
        : [['افتح النظام في Chrome أو Edge', 'compass'], ['اضغط أيقونة التثبيت في شريط العنوان، أو القائمة ← «تثبيت المروة»', 'download'], ['أكّد التثبيت — يفتح التطبيق في نافذة مستقلة', 'check']];
    EM.ui.modal({
      title: 'تنزيل تطبيق المروة',
      body: `<div class="install-hero"><img src="assets/img/icons/icon-192.png" alt="" width="64" height="64"><div><b>المروة</b><span class="small muted">يعمل كتطبيق مستقل على ${pwa.isIOS ? 'iPhone و iPad' : pwa.isAndroid ? 'أندرويد' : 'الكمبيوتر'}، ويفتح بدون إنترنت بعد أول تشغيل.</span></div></div>
        ${!pwa.supported ? `<div class="callout warn">${icon('alert', 'sm')}<span class="small">التثبيت يحتاج فتح النظام من رابط إنترنت (https) وليس من ملف على الجهاز. استخدم الرابط المباشر للنظام.</span></div>` : ''}
        <ol class="install-steps">${steps.map(([t, i]) => `<li>${icon(i === 'compass' ? 'search' : i, 'sm')}<span>${t}</span></li>`).join('')}</ol>`,
      foot: '<button class="btn primary" data-close="1">تمام</button>',
    });
  };

  /* تسجيل عامل الخدمة للعمل بدون إنترنت والتحديث التلقائي */
  if (pwa.supported) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              w.postMessage('skipWaiting');
              EM.ui?.toast('تم تحميل تحديث جديد للتطبيق — سيُطبق عند إعادة الفتح', 'info', 6000);
            }
          });
        });
      }).catch(() => { /* التطبيق يعمل عادياً بدون وضع عدم الاتصال */ });
    });
  }

  EM.pwa = pwa;
})();
