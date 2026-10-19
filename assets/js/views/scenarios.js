/* كتالوج سيناريوهات الاستثناء — قابل للتوسعة */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store } = EM;

  const FIELDS = [
    ['trigger', 'المُحفّز'], ['pre', 'الشروط المسبقة'], ['role', 'الدور المسؤول'], ['transition', 'الانتقال المتوقع'], ['alt', 'المسار البديل'],
    ['notify', 'الإشعارات'], ['escalate', 'قواعد التصعيد'], ['audit', 'البيانات والتدقيق'], ['recovery', 'الاسترداد / التعويض'], ['test', 'اختبار القبول'],
  ];
  const SEV = { 'حرج': 'bad', 'عالٍ': 'warn', 'متوسط': 'info', 'منخفض': '' };

  EM.views.scenarios = {
    title: () => 'كتالوج الاستثناءات',
    render(el) {
      const s = store.state;
      s.customScenarios = s.customScenarios || [];
      const all = [...EM.SCENARIOS, ...s.customScenarios];
      const vs = ui.vstate('scen', { q: '', cat: '', sev: '', open: null });
      const cats = [...new Set(all.map((x) => x.category))];
      el.innerHTML = `<div class="page">
        ${ui.pageHead('كتالوج الاستثناءات والفشل', `${all.length} سيناريو موثق بعشرة عناصر لكل منها، ومربوط بمسار العمل الذي يعالجه. الكتالوج قابل للتوسعة — لا يمكن توقع كل الحالات مسبقاً.`,
          store.can('workflows.design') ? `<button class="btn primary" data-action="add">${icon('plus')} سيناريو جديد</button>` : '')}
        <section class="panel">
          <div class="toolbar">
            <input class="input search" type="search" placeholder="بحث في السيناريوهات" value="${esc(vs.q)}" data-input="q">
            <select class="input" data-change="cat"><option value="">كل الفئات</option>${ui.options(cats.map((c) => [c, c]), vs.cat)}</select>
            <select class="input" data-change="sev"><option value="">كل الدرجات</option>${ui.options(Object.keys(SEV).map((c) => [c, c]), vs.sev)}</select>
          </div>
          <div id="sl"></div>
        </section></div>`;
      const draw = () => {
        const rows = all.filter((x) => (!vs.cat || x.category === vs.cat) && (!vs.sev || x.severity === vs.sev) && EM.match(vs.q, x.title, x.trigger, x.id));
        el.querySelector('#sl').innerHTML = rows.length ? `<ul class="scen-list">${rows.map((x) => { const wf = store.workflow(x.workflow); return `
          <li class="${vs.open === x.id ? 'open' : ''}">
            <button class="scen-head" data-action="open" data-id="${esc(x.id)}" aria-expanded="${vs.open === x.id}">
              <span class="num xs muted">${esc(x.id)}</span><b class="grow">${esc(x.title)}</b>
              <span class="pill plain">${esc(x.category)}</span><span class="pill ${SEV[x.severity] ?? ''}">${esc(x.severity)}</span>${icon('chevron', 'sm')}
            </button>
            ${vs.open === x.id ? `<div class="scen-body">
              <dl class="scen-grid">${FIELDS.map(([k, t], i) => `<div><dt><span class="num">${i + 1}</span> ${t}</dt><dd>${esc(x[k] || '—')}</dd></div>`).join('')}</dl>
              ${wf ? `<div class="row wrap"><span class="small muted">المسار المعالج:</span><a class="btn sm" href="#/admin/workflows/${esc(wf.id)}">${icon('flow', 'sm')} ${esc(wf.name)}</a><a class="btn sm primary" href="#/admin/workflows/${esc(wf.id)}?mode=sim">${icon('play', 'sm')} تشغيل المحاكاة</a></div>` : ''}
            </div>` : ''}
          </li>`; }).join('')}</ul>` : ui.empty('لا توجد سيناريوهات مطابقة');
      };
      draw();
      ui.bind(el, {
        q: EM.debounce((i) => { vs.q = i.value; draw(); }, 150),
        cat: (sel) => { vs.cat = sel.value; draw(); },
        sev: (sel) => { vs.sev = sel.value; draw(); },
        open: (b) => { vs.open = vs.open === b.dataset.id ? null : b.dataset.id; draw(); },
        add: () => ui.modal({
          title: 'سيناريو استثناء جديد', wide: true,
          body: `<div class="form-grid"><div class="field full"><label for="sc-t">العنوان</label><input id="sc-t" class="input"></div>
            <div class="field"><label for="sc-c">الفئة</label><input id="sc-c" class="input" list="cats"><datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
            <div class="field"><label for="sc-s">الدرجة</label><select id="sc-s" class="input">${ui.options(Object.keys(SEV).map((c) => [c, c]), 'متوسط')}</select></div>
            <div class="field full"><label for="sc-w">المسار المعالج</label><select id="sc-w" class="input">${ui.options(s.workflows.map((w) => [w.id, w.name]))}</select></div>
            ${FIELDS.map(([k, t]) => `<div class="field full"><label for="sc-${k}">${t}</label><input id="sc-${k}" class="input"></div>`).join('')}</div>`,
          foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>إضافة للكتالوج</button>',
          onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => {
            const title = m.querySelector('#sc-t').value.trim();
            if (!title) { ui.toast('اكتب عنوان السيناريو', 'warn'); return; }
            const missing = FIELDS.filter(([k]) => !m.querySelector(`#sc-${k}`).value.trim());
            if (missing.length) { ui.toast(`أكمل: ${missing.map((f) => f[1]).join('، ')}`, 'warn', 5000); return; }
            const x = { id: `EX-${EM.pad(29 + s.customScenarios.length)}`, title, category: m.querySelector('#sc-c').value.trim() || 'أخرى', severity: m.querySelector('#sc-s').value, workflow: m.querySelector('#sc-w').value };
            FIELDS.forEach(([k]) => { x[k] = m.querySelector(`#sc-${k}`).value.trim(); });
            s.customScenarios.push(x);
            store.audit('إضافة سيناريو استثناء', 'scenario', x.id);
            store.commit('scenarios'); close(); vs.open = x.id; this.render(el);
          }),
        }),
      });
    },
  };
})();
