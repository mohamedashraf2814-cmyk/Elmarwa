/* التطبيق: الموجّه (Hash Router)، الهيكل، الشريط العلوي، البحث، الإشعارات */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store } = EM;

  const ROUTES = [
    { path: 'dashboard', view: 'dashboard', label: 'لوحة القيادة', icon: 'home', perm: 'dashboard.view', group: 'عام' },
    { path: 'tasks', view: 'tasks', label: 'مهامي', icon: 'check', perm: 'dashboard.view', group: 'عام', badge: 'tasks' },
    { path: 'patients', view: 'patients', label: 'المرضى', icon: 'users', perm: 'patients.view', group: 'رحلة المريض' },
    { path: 'patients/:id', view: 'patient', perm: 'patients.view', hidden: true, parent: 'patients' },
    { path: 'appointments', view: 'appointments', label: 'المواعيد والطوابير', icon: 'calendar', perm: 'appointments.manage', group: 'رحلة المريض' },
    { path: 'emergency', view: 'emergency', label: 'الطوارئ', icon: 'siren', perm: 'er.view', group: 'رحلة المريض', badge: 'er' },
    { path: 'clinic', view: 'clinic', label: 'مساحة الطبيب', icon: 'stethoscope', perm: 'clinic.consult', group: 'رحلة المريض' },
    { path: 'nursing', view: 'nursing', label: 'التمريض', icon: 'heart', perm: 'nursing.tasks', group: 'رحلة المريض' },
    { path: 'discharge', view: 'discharge', label: 'الخروج والمتابعة', icon: 'logout', perm: 'discharge.manage', group: 'رحلة المريض', badge: 'dis' },
    { path: 'lab', view: 'lab', label: 'المعمل', icon: 'flask', perm: 'lab.view', group: 'التشخيص والعلاج', badge: 'critical' },
    { path: 'radiology', view: 'radiology', label: 'الأشعة', icon: 'scan', perm: 'rad.view', group: 'التشخيص والعلاج' },
    { path: 'pharmacy', view: 'pharmacy', label: 'الصيدلية', icon: 'pill', perm: 'pharmacy.view', group: 'التشخيص والعلاج', badge: 'rx' },
    { path: 'beds', view: 'beds', label: 'إدارة الأسرّة', icon: 'bed', perm: 'beds.view', group: 'الإقامة والعمليات' },
    { path: 'icu', view: 'icu', label: 'العناية المركزة', icon: 'pulse', perm: 'beds.view', group: 'الإقامة والعمليات' },
    { path: 'surgery', view: 'surgery', label: 'العمليات', icon: 'scalpel', perm: 'surgery.view', group: 'الإقامة والعمليات' },
    { path: 'housekeeping', view: 'housekeeping', label: 'النظافة وتجهيز الأسرّة', icon: 'sparkle', perm: 'housekeeping.manage', group: 'الإقامة والعمليات', badge: 'hk' },
    { path: 'billing', view: 'billing', label: 'الحسابات والتأمين', icon: 'wallet', perm: 'billing.view', group: 'المالية والمخازن' },
    { path: 'inventory', view: 'inventory', label: 'المخزون', icon: 'box', perm: 'inventory.view', group: 'المالية والمخازن' },
    { path: 'hr', view: 'hr', label: 'الموارد البشرية والمناوبات', icon: 'users', perm: 'hr.manage', group: 'الخدمات المساندة' },
    { path: 'biomed', view: 'biomed', label: 'صيانة الأجهزة الطبية', icon: 'settings', perm: 'biomed.manage', group: 'الخدمات المساندة' },
    { path: 'records', view: 'records', label: 'السجلات الطبية', icon: 'file', perm: 'records.manage', group: 'الخدمات المساندة' },
    { path: 'quality', view: 'quality', label: 'الجودة وسلامة المرضى', icon: 'shield', perm: 'quality.manage', group: 'الخدمات المساندة' },
    { path: 'admin/workflows', view: 'workflows', label: 'مصمم سير العمل', icon: 'flow', perm: 'workflows.view', group: 'سير العمل' },
    { path: 'admin/workflows/:id', view: 'designer', perm: 'workflows.view', hidden: true, parent: 'admin/workflows' },
    { path: 'workflows/monitor', view: 'monitor', label: 'مراقبة التنفيذ', icon: 'monitor', perm: 'workflows.monitor', group: 'سير العمل', badge: 'overdue' },
    { path: 'workflows/instance/:id', view: 'instance', perm: 'workflows.view', hidden: true, parent: 'workflows/monitor' },
    { path: 'scenarios', view: 'scenarios', label: 'كتالوج الاستثناءات', icon: 'alert', perm: 'scenarios.view', group: 'سير العمل' },
    { path: 'admin/departments', view: 'departments', label: 'الأقسام', icon: 'building', perm: 'admin.departments', group: 'الإدارة' },
    { path: 'admin/roles', view: 'roles', label: 'الأدوار والصلاحيات', icon: 'lock', perm: 'admin.roles', group: 'الإدارة' },
    { path: 'admin/audit', view: 'audit', label: 'التدقيق والأمان', icon: 'shield', perm: 'audit.view', group: 'الإدارة' },
    { path: 'about', view: 'about', label: 'عن النظام', icon: 'info', perm: null, group: 'الإدارة' },
  ];
  EM.ROUTES = ROUTES;

  function match(hash) {
    const path = hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
    const segs = path.split('/');
    for (const r of ROUTES) {
      const rs = r.path.split('/');
      if (rs.length !== segs.length) continue;
      const params = {};
      let ok = true;
      rs.forEach((s, i) => { if (s.startsWith(':')) params[s.slice(1)] = decodeURIComponent(segs[i]); else if (s !== segs[i]) ok = false; });
      if (ok) return { route: r, params };
    }
    return null;
  }

  function badgeCount(kind) {
    const s = store.state;
    switch (kind) {
      case 'er': return s.er.filter((x) => x.status === 'waiting_triage' || x.level === 1).length;
      case 'critical': return s.lab.filter((x) => x.critical && !x.ackBy).length;
      case 'rx': return s.rx.filter((x) => x.status === 'on_hold').length;
      case 'overdue': return store.openTasks().filter((t) => t.overdue).length;
      case 'tasks': return store.openTasks().filter((t) => store.isOwner() ? t.overdue : t.node.config.role === store.session?.role).length;
      case 'dis': return s.discharges.filter((d) => d.status === 'in_progress').length;
      case 'hk': return s.housekeeping.filter((j) => j.status !== 'done').length;
      default: return 0;
    }
  }

  function renderNav(active) {
    const groups = {};
    ROUTES.filter((r) => !r.hidden && (!r.perm || store.can(r.perm))).forEach((r) => { (groups[r.group] = groups[r.group] || []).push(r); });
    return Object.entries(groups).map(([g, items]) => `
      <nav class="nav-group" aria-label="${esc(g)}"><div class="nav-group-title">${esc(g)}</div>
        ${items.map((r) => {
          const n = r.badge ? badgeCount(r.badge) : 0;
          const on = active === r.path || active === r.parent ? ' active' : '';
          return `<a class="nav-link${on}" href="#/${r.path}" ${on ? 'aria-current="page"' : ''}>${icon(r.icon)}<span>${esc(r.label)}</span>${n ? `<span class="badge-count ${r.badge === 'tasks' ? 'soft' : ''}">${n}</span>` : ''}</a>`;
        }).join('')}
      </nav>`).join('');
  }

  function shell() {
    const u = store.user();
    const role = store.role();
    const unread = store.state.notifications.filter((n) => !n.read).length;
    return `
    <div class="shell" id="shell">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="#/dashboard" style="text-decoration:none"><img src="assets/img/logo.svg" alt=""><span><span class="brand-name">المروة</span><br><span class="brand-sub">نظام إدارة المستشفى</span></span></a>
        <div id="nav"></div>
        <div class="sidebar-foot">تقديم <strong>${esc(EM.HOSPITAL.vendor)}</strong><br>الإصدار <span class="num">${esc(EM.HOSPITAL.version)}</span></div>
      </aside>
      <div class="main">
        <div class="demo-banner">نسخة عرض تقديمي — كل البيانات تجريبية ووهمية وتُحفظ في متصفحك فقط</div>
        <header class="topbar">
          <button class="icon-btn menu-toggle" id="menuToggle" aria-label="القائمة">${icon('menu')}</button>
          <div class="global-search">
            <label class="sr-only" for="gsearch">بحث عن مريض</label>
            <input id="gsearch" type="search" autocomplete="off" placeholder="ابحث باسم المريض أو رقم الملف أو الرقم القومي">
            ${icon('search')}
            <div id="gresults"></div>
          </div>
          <div class="topbar-actions">
            <span class="clock num" id="clock"></span>
            <button class="btn ghost cmd-btn" id="cmdBtn" aria-label="لوحة الأوامر">${icon('search', 'sm')}<span>بحث وأوامر</span><kbd>Ctrl K</kbd></button>
            <button class="icon-btn" id="nightBtn" aria-label="وضع المناوبة الليلية" title="وضع المناوبة الليلية">${icon('moon')}</button>
            <button class="assist-btn" id="assistBtn" aria-label="مساعد التشغيل">${icon('sparkle', 'sm')}<span>مساعد التشغيل</span><b class="num" id="assistN"></b></button>
            <button class="icon-btn" id="bell" aria-label="الإشعارات">${icon('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button>
            <button class="user-chip" id="userChip" aria-label="تبديل المستخدم">
              <span class="avatar">${esc(EM.initials(u.name.replace(/^(د\.|م\.|أ\.|ممرض\/|ممرضة\/)\s*/, '')))}</span>
              <span class="who"><b>${esc(u.name)}</b><span>${esc(role.name)}</span></span>
            </button>
          </div>
        </header>
        <main id="view" tabindex="-1"></main>
      </div>
    </div>`;
  }

  let current = null;

  function render() {
    const root = document.getElementById('app');
    if (!store.session || !store.user()) {
      current = null;
      document.title = 'تسجيل الدخول — مستشفى المروة';
      EM.views.login.render(root);
      return;
    }
    const m = match(location.hash);
    if (!m) { location.hash = '#/dashboard'; return; }
    if (!document.getElementById('shell')) { root.innerHTML = shell(); wireShell(); }
    document.getElementById('nav').innerHTML = renderNav(m.route.path);
    document.getElementById('shell').classList.remove('nav-open');
    const view = document.getElementById('view');
    if (m.route.perm && !store.can(m.route.perm)) {
      store.audit('محاولة دخول صفحة غير مصرح بها', 'route', m.route.path, { result: 'denied' });
      view.innerHTML = `<div class="page">${ui.empty('لا تملك صلاحية عرض هذه الصفحة', `دورك الحالي «${esc(store.role().name)}» لا يتضمن صلاحية ${esc(m.route.perm)}. بدّل المستخدم من أعلى الصفحة لتجربة دور آخر.`, '<a class="btn" href="#/dashboard">العودة للوحة القيادة</a>', 'lock')}</div>`;
      return;
    }
    const v = EM.views[m.route.view];
    current = { route: m.route, params: m.params, view: v };
    document.title = `${v.title?.(m.params) || m.route.label || 'المروة'} — مستشفى المروة`;
    try {
      view.innerHTML = '';
      view._handlers = {};
      v.render(view, m.params);
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div class="page">${ui.empty('حدث خطأ أثناء عرض الصفحة', esc(err.message), '<button class="btn" onclick="location.reload()">إعادة التحميل</button>', 'alert')}</div>`;
    }
    if (EM._lastPath !== m.route.path) { window.scrollTo(0, 0); EM._lastPath = m.route.path; }
  }
  EM.render = render;
  EM.rerender = () => { if (current) render(); };

  function wireShell() {
    document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('shell').classList.toggle('nav-open'));
    const input = document.getElementById('gsearch');
    const out = document.getElementById('gresults');
    input.addEventListener('input', EM.debounce(() => {
      const q = input.value.trim();
      if (q.length < 2) { out.innerHTML = ''; return; }
      if (!store.can('patients.view')) { out.innerHTML = '<div class="search-results"><span class="small muted" style="padding:8px">لا تملك صلاحية البحث في ملفات المرضى</span></div>'; return; }
      const hits = store.state.patients.filter((p) => EM.match(q, p.name, p.id, p.nationalId, p.phone)).slice(0, 7);
      out.innerHTML = `<div class="search-results" role="listbox">${hits.length ? hits.map((p) => `<a href="#/patients/${esc(p.id)}" role="option"><span>${esc(p.name)}</span><span class="num xs muted">${esc(p.id)}</span></a>`).join('') : '<span class="small muted" style="display:block;padding:8px">لا توجد نتائج مطابقة</span>'}</div>`;
    }, 150));
    out.addEventListener('click', () => { out.innerHTML = ''; input.value = ''; });
    document.addEventListener('click', (e) => { if (!e.target.closest('.global-search')) out.innerHTML = ''; });
    document.getElementById('bell').addEventListener('click', openNotifications);
    document.getElementById('userChip').addEventListener('click', switchUser);
    document.getElementById('assistBtn').addEventListener('click', openAssistant);
    document.getElementById('cmdBtn').addEventListener('click', openPalette);
    document.getElementById('nightBtn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'night' ? 'day' : 'night'));
    refreshAssist();
  }

  function openNotifications() {
    const list = store.state.notifications;
    const html = list.length ? `<ul class="list">${list.map((n) => `
      <li><span class="pill ${n.kind === 'bad' ? 'bad' : n.kind === 'warn' ? 'warn' : 'info'}" style="margin-top:3px">${esc(n.title)}</span>
        <div class="grow"><div class="small">${esc(n.body)}</div><div class="xs muted">${EM.fmt.ago(n.at)}</div></div>
        ${n.link ? `<a class="btn sm" href="${esc(n.link)}" data-nl="${esc(n.id)}">فتح</a>` : ''}</li>`).join('')}</ul>` : ui.empty('لا توجد إشعارات');
    ui.drawer('الإشعارات', html, (d, close) => {
      d.querySelectorAll('[data-nl]').forEach((a) => a.addEventListener('click', close));
    });
    list.forEach((n) => { n.read = true; });
    store.save();
    const dot = document.querySelector('#bell .dot');
    if (dot) dot.remove();
  }

  function switchUser() {
    ui.modal({
      title: 'تبديل المستخدم والدور',
      wide: true,
      body: `<p class="muted small">في نسخة العرض يمكنك تجربة النظام بأي دور لترى كيف تتغير القوائم والصلاحيات والمهام. يُسجل كل تبديل في سجل التدقيق.</p>
        <div class="role-grid">${EM.REF.staff.filter((s, i, a) => a.findIndex((x) => x.role === s.role) === i).map((s) => `
          <button class="role-card ${s.id === store.session.userId ? 'on' : ''}" data-u="${esc(s.id)}"><b>${esc(EM.REF.role(s.role).name)}</b><span>${esc(s.name)}</span></button>`).join('')}</div>`,
      foot: `<button class="btn danger" data-logout>${icon('logout')} تسجيل الخروج</button><button class="btn" data-close="1">إغلاق</button>`,
      onMount(m, close) {
        m.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => {
          store.login(b.dataset.u);
          close();
          document.getElementById('app').innerHTML = '';
          render();
          ui.toast(`أنت الآن: ${store.role().name}`, 'ok');
        }));
        m.querySelector('[data-logout]').addEventListener('click', () => { close(); store.logout(); render(); });
      },
    });
  }

  function refreshAssist() {
    const n = document.getElementById('assistN');
    if (!n) return;
    const list = EM.insights();
    const urgent = list.filter((i) => i.level === 'bad' || i.level === 'warn').length;
    n.textContent = urgent || '';
    n.className = `num ${list.some((i) => i.level === 'bad') ? 'hot' : ''}`;
  }
  EM.refreshAssist = refreshAssist;

  /* ---------- مساعد التشغيل ---------- */
  function openAssistant() {
    const deptByRoute = { emergency: 'er', lab: 'lab', beds: 'beds', discharge: 'discharge', housekeeping: 'housekeeping', pharmacy: 'pharmacy', inventory: 'inventory', billing: 'billing', hr: 'hr', biomed: 'biomed' };
    const here = deptByRoute[current?.route.path];
    const list = EM.insights();
    const sorted = here ? [...list.filter((i) => i.dept === here), ...list.filter((i) => i.dept !== here)] : list;
    ui.drawer('مساعد التشغيل', `<div class="assist-intro">${icon('sparkle')}<p>أقرأ حالة كل الأقسام الآن وأقترح الخطوة التالية. أتعامل مع التشغيل فقط — الأسرّة والطوابير والمخزون والطاقم والفواتير — ولا أقترح تشخيصاً أو علاجاً.</p></div>${EM.insightList(sorted)}`, (d, close) => {
      d.addEventListener('click', (e) => { const b = e.target.closest('[data-insight]'); if (b) { const i = list.find((x) => x.id === b.dataset.insight); if (i?.action?.link) close(); EM.runInsight(b.dataset.insight); if (!i?.action?.link) { close(); openAssistant(); } } });
    });
  }

  /* ---------- لوحة الأوامر ---------- */
  const ACTIONS = [
    ['تسجيل مريض جديد', '#/patients', 'plus', () => setTimeout(() => EM.registerPatient?.(() => EM.rerender()), 200)],
    ['تسجيل وصول للطوارئ', '#/emergency', 'siren'],
    ['حجز موعد', '#/appointments', 'calendar'],
    ['تخصيص سرير لطلب دخول', '#/beds', 'bed'],
    ['بدء إجراءات خروج', '#/discharge', 'logout'],
    ['بلاغ سلامة جديد', '#/quality', 'alert'],
    ['تصميم مسار عمل جديد', '#/admin/workflows', 'flow'],
    ['المهام المتأخرة', '#/workflows/monitor', 'clock'],
  ];
  function openPalette() {
    ui.modal({
      title: 'بحث وأوامر',
      body: `<input id="cmdq" class="input cmd-input" placeholder="اكتب اسم مريض، قسم، أو إجراء…" autocomplete="off"><ul class="cmd-list" id="cmdl" role="listbox"></ul><p class="xs muted">↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق</p>`,
      onMount(m, close) {
        const q = m.querySelector('#cmdq');
        const l = m.querySelector('#cmdl');
        let items = [];
        let sel = 0;
        const draw = () => {
          const t = q.value.trim();
          const pages = ROUTES.filter((r) => !r.hidden && (!r.perm || store.can(r.perm)) && EM.match(t, r.label)).map((r) => ({ kind: 'صفحة', label: r.label, icon: r.icon, go: `#/${r.path}` }));
          const acts = ACTIONS.filter(([n]) => EM.match(t, n)).map(([n, h, i, fn]) => ({ kind: 'إجراء', label: n, icon: i, go: h, fn }));
          const pts = t.length >= 2 && store.can('patients.view') ? store.state.patients.filter((p) => EM.match(t, p.name, p.id, p.phone)).slice(0, 6).map((p) => ({ kind: EM.H.locate(p.id).label, label: p.name, icon: 'user', go: `#/patients/${p.id}` })) : [];
          items = [...pts, ...acts, ...pages].slice(0, 12);
          sel = Math.min(sel, Math.max(0, items.length - 1));
          l.innerHTML = items.map((it, i) => `<li role="option" aria-selected="${i === sel}" class="${i === sel ? 'on' : ''}" data-i="${i}">${icon(it.icon, 'sm')}<span class="grow">${esc(it.label)}</span><span class="xs muted">${esc(it.kind)}</span></li>`).join('') || '<li class="muted small">لا توجد نتائج</li>';
        };
        const go = (i) => { const it = items[i]; if (!it) return; close(); location.hash = it.go; it.fn?.(); };
        q.addEventListener('input', () => { sel = 0; draw(); });
        q.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); }
          if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
          if (e.key === 'Enter') { go(sel); e.preventDefault(); }
        });
        l.addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) go(Number(li.dataset.i)); });
        draw();
        setTimeout(() => q.focus(), 40);
      },
    });
  }

  /* ---------- وضع المناوبة الليلية ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('elmarwa.theme', t); } catch { /* */ }
    const b = document.getElementById('nightBtn');
    if (b) b.innerHTML = icon(t === 'night' ? 'sun' : 'moon');
  }

  function tickClock() {
    const c = document.getElementById('clock');
    if (c) c.textContent = `${EM.fmt.day(new Date())} ${EM.fmt.time(new Date())}`;
  }

  /* أحداث حية بسيطة لإظهار الطابع التشغيلي أثناء العرض */
  function liveEvents() {
    if (!store.session) return;
    const r = Math.random();
    if (r < 0.35) {
      const p = store.state.patients[Math.floor(Math.random() * 64)];
      store.state.er.push({ id: `ER-${Math.floor(1000 + Math.random() * 8999)}`, patientId: p.id, complaint: 'وصول جديد للطوارئ', arrivedAt: new Date().toISOString(), level: null, status: 'waiting_triage', doctor: null, vitals: { hr: 96, bp: '128/82', spo2: 97, temp: '37.4', rr: 18 }, bay: 'الانتظار' });
      store.notify('warn', 'وصول جديد للطوارئ', `${p.name} بانتظار الفرز`, '#/emergency');
    }
    const nav = document.getElementById('nav');
    if (nav && current) nav.innerHTML = renderNav(current.route.path);
    refreshAssist();
  }

  function boot() {
    try { const t = localStorage.getItem('elmarwa.theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* */ }
    store.init();
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && store.session) { e.preventDefault(); openPalette(); }
    });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('#view [data-insight]');
      if (b) EM.runInsight(b.dataset.insight);
    });
    window.addEventListener('hashchange', render);
    store.on((what) => {
      if (what === 'reset') { document.getElementById('app').innerHTML = ''; render(); }
      refreshAssist();
      const nav = document.getElementById('nav');
      if (nav && current) nav.innerHTML = renderNav(current.route.path);
      if (what === 'notifications') {
        const bell = document.getElementById('bell');
        const unread = store.state.notifications.filter((n) => !n.read).length;
        if (bell) bell.innerHTML = `${icon('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}`;
      }
    });
    render();
    tickClock();
    setInterval(tickClock, 15000);
    setInterval(liveEvents, 90000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
