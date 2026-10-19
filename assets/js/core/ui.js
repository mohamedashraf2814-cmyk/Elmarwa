/* مكونات الواجهة المشتركة */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon } = EM;
  const ui = {};

  /* ---------- الحالات الموحدة ---------- */
  const STATUS = {
    appt: { booked: ['محجوز', 'info'], arrived: ['وصل', 'warn'], nurse: ['عند التمريض', 'par'], in_consult: ['في الكشف', 'ok'], done: ['انتهى', ''], no_show: ['لم يحضر', 'bad'], cancelled: ['ملغي', ''] },
    er: { waiting_triage: ['بانتظار الفرز', 'bad'], triaged: ['تم الفرز', 'warn'], in_assessment: ['قيد التقييم', 'info'], awaiting_results: ['بانتظار النتائج', 'par'], disposition: ['قرار نهائي', 'ok'] },
    lab: { ordered: ['مطلوب', 'info'], collected: ['تم السحب', 'warn'], received: ['تم الاستلام', 'warn'], in_process: ['قيد التشغيل', 'par'], resulted: ['بانتظار الاعتماد', 'warn'], verified: ['صادر', 'ok'] },
    rad: { ordered: ['مطلوب', 'info'], scheduled: ['مجدول', 'warn'], acquired: ['تم التصوير', 'par'], reported: ['بانتظار الاعتماد', 'warn'], verified: ['معتمد', 'ok'] },
    rx: { new: ['جديدة', 'info'], on_hold: ['معلقة للمراجعة', 'bad'], verified: ['تمت المراجعة', 'warn'], dispensed: ['تم الصرف', 'ok'], cancelled: ['ملغاة', ''], waiting_stock: ['بانتظار توفر', 'warn'] },
    bed: { occupied: ['مشغول', 'info'], available: ['متاح', 'ok'], cleaning: ['قيد التنظيف', 'warn'], reserved: ['محجوز', 'par'], maintenance: ['صيانة', 'bad'] },
    or: { scheduled: ['مجدولة', 'info'], pre_op: ['تجهيز', 'warn'], in_progress: ['جارية', 'bad'], recovery: ['إفاقة', 'par'], done: ['انتهت', 'ok'] },
    inv: { draft: ['مسودة', ''], posted: ['مستحقة', 'warn'], partial: ['مدفوعة جزئياً', 'par'], paid: ['مدفوعة', 'ok'], reversed: ['ملغاة بقيد عكسي', 'bad'] },
    refund: { pending: ['بانتظار الاعتماد', 'warn'], approved: ['معتمد', 'ok'], rejected: ['مرفوض', 'bad'] },
    claim: { preauth: ['موافقة مسبقة', 'info'], submitted: ['مرسلة', 'warn'], accepted: ['مقبولة', 'ok'], rejected: ['مرفوضة', 'bad'], resubmitted: ['أعيد إرسالها', 'par'] },
    wf: { draft: ['مسودة', 'warn'], published: ['منشور', 'ok'], paused: ['موقوف', 'bad'], archived: ['مؤرشف', ''] },
    inst: { running: ['قيد التنفيذ', 'info'], completed: ['مكتمل', 'ok'], failed: ['فشل', 'bad'], paused: ['موقوف مؤقتاً', 'warn'], cancelled: ['ملغي', ''] },
    task: { pending: ['قيد الانتظار', 'warn'], done: ['منجزة', 'ok'] },
  };
  ui.statusText = (kind, v) => STATUS[kind]?.[v]?.[0] || v;
  ui.pill = (kind, v) => { const s = STATUS[kind]?.[v] || [v, '']; return `<span class="pill ${s[1]}">${esc(s[0])}</span>`; };
  ui.tag = (text, cls = '') => `<span class="pill plain ${cls}">${esc(text)}</span>`;

  /* ---------- قطع جاهزة ---------- */
  ui.pageHead = (title, sub = '', actions = '', crumbs = '') => `
    <header class="page-head">
      <div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
      ${actions ? `<div class="btn-group">${actions}</div>` : ''}
    </header>`;

  ui.kpi = (label, value, foot = '', footCls = '', extra = '') => `
    <div class="panel kpi ${extra}"><span class="k-label">${esc(label)}</span><span class="k-value">${value}</span>${foot ? `<span class="k-foot ${footCls}">${foot}</span>` : ''}</div>`;

  ui.empty = (title, body = '', action = '', ic = 'search') => `
    <div class="empty">${icon(ic)}<b>${esc(title)}</b>${body ? `<span class="small">${body}</span>` : ''}${action}</div>`;

  ui.patientCell = (pid) => {
    const p = EM.store.patient(pid);
    if (!p) return '<span class="muted">—</span>';
    return `<a href="#/patients/${esc(p.id)}" class="row" style="gap:10px;color:inherit"><span class="avatar">${esc(EM.initials(p.name))}</span><span><b style="font-weight:500">${esc(p.name)}</b><br><span class="xs muted num">${esc(p.id)}</span></span></a>`;
  };

  ui.maskNid = (nid) => (nid ? `${nid.slice(0, 3)}•••••••${nid.slice(-4)}` : '—');

  ui.pager = (pg, action = 'page') => pg.pages <= 1 ? '' : `
    <div class="pager"><span>عرض ${pg.rows.length} من ${pg.total}</span>
      <div class="btn-group">
        <button class="btn sm" data-action="${action}" data-page="${pg.page - 1}" ${pg.page <= 1 ? 'disabled' : ''}>السابق</button>
        <span class="num small" style="align-self:center">${pg.page} / ${pg.pages}</span>
        <button class="btn sm" data-action="${action}" data-page="${pg.page + 1}" ${pg.page >= pg.pages ? 'disabled' : ''}>التالي</button>
      </div></div>`;

  ui.options = (items, selected) => items.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(t)}</option>`).join('');

  /* ---------- الإشعارات المنبثقة ---------- */
  ui.toast = function (msg, kind = 'info', ms = 3600) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `${icon(kind === 'ok' ? 'check' : kind === 'bad' ? 'alert' : 'info')}<span>${esc(msg)}</span>`;
    root.appendChild(el);
    setTimeout(() => el.remove(), ms);
  };

  /* ---------- النوافذ ---------- */
  ui.modal = function ({ title, body, foot = '', wide = false, onMount }) {
    const root = document.getElementById('modal-root');
    const prev = document.activeElement;
    root.innerHTML = `<div class="modal-backdrop" data-close="1"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mtitle">
      <div class="modal-head"><h2 id="mtitle">${esc(title)}</h2><button class="icon-btn" data-close="1" aria-label="إغلاق">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
    const back = root.firstElementChild;
    const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); prev?.focus?.(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', (e) => { if (e.target.dataset.close) close(); });
    back.querySelectorAll('button[data-close]').forEach((b) => b.addEventListener('click', close));
    const m = back.querySelector('.modal');
    setTimeout(() => (m.querySelector('input,select,textarea,button.primary') || m).focus?.(), 30);
    onMount?.(m, close);
    return { el: m, close };
  };

  ui.confirm = function ({ title, message, confirm = 'تأكيد', danger = false, reason = false, onOk }) {
    ui.modal({
      title,
      body: `<p>${message}</p>${reason ? `<div class="field"><label for="c-reason">السبب (إلزامي ويُسجل في التدقيق)</label><textarea id="c-reason" class="input" required></textarea></div>` : ''}`,
      foot: `<button class="btn" data-close="1">تراجع</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-ok>${esc(confirm)}</button>`,
      onMount(m, close) {
        m.querySelector('[data-ok]').addEventListener('click', () => {
          const r = m.querySelector('#c-reason')?.value.trim();
          if (reason && !r) { ui.toast('اكتب السبب أولاً', 'warn'); return; }
          close();
          onOk(r);
        });
      },
    });
  };

  ui.drawer = function (title, html, onMount) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-backdrop" data-close="1" style="background:rgba(16,28,69,.25)"></div><aside class="drawer" role="dialog" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close="1" aria-label="إغلاق">${icon('x')}</button></div><div class="drawer-body">${html}</div></aside>`;
    const close = () => { root.innerHTML = ''; };
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
    onMount?.(root.querySelector('.drawer'), close);
  };

  /** ربط الأحداث بالتفويض عبر data-action */
  ui.bind = function (root, handlers) {
    // المستمعات تُركب مرة واحدة لكل عنصر؛ إعادة الرسم تستبدل المعالجات فقط
    root._handlers = handlers;
    if (root._bound) return;
    root._bound = true;
    const H = () => root._handlers || {};
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !root.contains(el) || el.disabled) return;
      const h = H()[el.dataset.action];
      if (h) { e.preventDefault(); h(el, e); }
    });
    root.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (el && H()[el.dataset.change]) H()[el.dataset.change](el, e);
    });
    root.addEventListener('input', (e) => {
      const el = e.target.closest('[data-input]');
      if (el && H()[el.dataset.input]) H()[el.dataset.input](el, e);
    });
  };

  /** حالة صفحة بسيطة تحفظ الفلاتر بين إعادة الرسم */
  const viewState = {};
  ui.vstate = (key, init) => (viewState[key] = viewState[key] || init);

  EM.ui = ui;
})();
