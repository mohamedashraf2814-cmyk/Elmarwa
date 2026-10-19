/* أدوات عامة — مساحة الأسماء EM */
(function () {
  'use strict';
  const EM = (window.EM = window.EM || {});
  EM.views = EM.views || {};

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /** تهريب النص لمنع حقن HTML (XSS) */
  EM.esc = (v) => (v === null || v === undefined ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]));

  /** مولد أرقام عشوائية ثابت البذرة لبيانات تجريبية متكررة */
  EM.rng = function (seed) {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      int: (a, b) => a + Math.floor(next() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
    };
  };

  let counter = 0;
  EM.uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  EM.pad = (n, w = 2) => String(n).padStart(w, '0');

  const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  EM.fmt = {
    time(d) {
      d = new Date(d);
      let h = d.getHours();
      const m = EM.pad(d.getMinutes());
      const suffix = h >= 12 ? 'م' : 'ص';
      h = h % 12 || 12;
      return `${h}:${m} ${suffix}`;
    },
    date(d) {
      d = new Date(d);
      return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    },
    dateShort(d) {
      d = new Date(d);
      return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`;
    },
    day(d) { return AR_DAYS[new Date(d).getDay()]; },
    dateTime(d) { return `${EM.fmt.dateShort(d)}، ${EM.fmt.time(d)}`; },
    money(v) { return `${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ج.م`; },
    int(v) { return Number(v || 0).toLocaleString('en-US'); },
    /** مدة منذ تاريخ بصيغة عربية مختصرة */
    ago(d) {
      const diff = Math.round((Date.now() - new Date(d).getTime()) / 60000);
      if (diff < 1) return 'الآن';
      if (diff < 60) return `منذ ${diff} د`;
      const h = Math.floor(diff / 60);
      if (h < 24) return `منذ ${h} س`;
      return `منذ ${Math.floor(h / 24)} يوم`;
    },
    minutes(min) {
      min = Math.round(min);
      if (Math.abs(min) < 60) return `${min} د`;
      if (Math.abs(min) >= 1440) { const d = Math.floor(Math.abs(min) / 1440); const hh = Math.floor((Math.abs(min) % 1440) / 60); return `${min < 0 ? '-' : ''}${d} يوم${hh ? ` ${hh} س` : ''}`; }
      const h = Math.floor(Math.abs(min) / 60);
      const m = Math.abs(min) % 60;
      return `${min < 0 ? '-' : ''}${h} س${m ? ` ${m} د` : ''}`;
    },
    age(dob) {
      const d = new Date(dob);
      const now = new Date();
      let a = now.getFullYear() - d.getFullYear();
      if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
      return a;
    },
  };

  EM.minsFromNow = (mins) => new Date(Date.now() + mins * 60000).toISOString();
  EM.minsSince = (iso) => (Date.now() - new Date(iso).getTime()) / 60000;

  EM.debounce = (fn, ms = 200) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /** بحث نصي عربي متسامح (يتجاهل الهمزات والتاء المربوطة) */
  EM.norm = (s) => String(s || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[ً-ْ]/g, '');
  EM.match = (q, ...fields) => {
    const nq = EM.norm(q).trim();
    if (!nq) return true;
    return fields.some((f) => EM.norm(f).includes(nq));
  };

  EM.initials = (name) => {
    const parts = String(name || '').trim().split(/\s+/).map((w) => w.replace(/^ال(?=..)/, ''));
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  };

  EM.paginate = (items, page, size = 12) => {
    const pages = Math.max(1, Math.ceil(items.length / size));
    const p = Math.min(Math.max(1, page), pages);
    return { rows: items.slice((p - 1) * size, p * size), page: p, pages, total: items.length };
  };

  EM.download = (filename, text, type = 'application/json') => {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  };

  EM.clone = (o) => JSON.parse(JSON.stringify(o));
})();
