/* صفحات سير العمل: القائمة، المصمم، مراقبة التنفيذ، تفاصيل المثيل */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;

  /* ---------- /admin/workflows ---------- */
  EM.views.workflows = {
    title: () => 'مصمم سير العمل',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('wfl', { q: '', status: '' });
      const canDesign = store.can('workflows.design');
      el.innerHTML = `<div class="page">
        ${ui.pageHead('سير العمل', 'كل مسار هنا قابل للتنفيذ فعلياً: يُصمم بصرياً، يُتحقق منه، يُنشر بإصدار، ويعمل عليه المرضى والمهام في كل الأقسام.',
          canDesign ? `<button class="btn" data-action="import">${icon('upload')} استيراد</button><button class="btn primary" data-action="new">${icon('plus')} سير عمل جديد</button>` : '')}
        <div class="toolbar panel" style="border-radius:var(--r-panel)">
          <input class="input search" type="search" placeholder="بحث باسم المسار" value="${esc(vs.q)}" data-input="q">
          <div class="seg">${[['', 'الكل'], ['published', 'منشور'], ['draft', 'مسودة'], ['paused', 'موقوف'], ['archived', 'مؤرشف']].map(([k, t]) => `<button class="${vs.status === k ? 'on' : ''}" data-action="st" data-s="${k}">${t}</button>`).join('')}</div>
        </div>
        <div class="wf-cards" id="wfc"></div>
      </div>`;
      const draw = () => {
        const list = s.workflows.filter((w) => (!vs.status || w.status === vs.status) && (vs.status === 'archived' || w.status !== 'archived' || vs.status === '') && EM.match(vs.q, w.name, w.category));
        el.querySelector('#wfc').innerHTML = list.map((w) => {
          const inst = s.instances.filter((i) => i.workflowId === w.id);
          const run = inst.filter((i) => i.status === 'running').length;
          const fail = inst.filter((i) => i.status === 'failed').length;
          return `<article class="panel wf-card">
            <a class="wf-thumb" href="#/admin/workflows/${esc(w.id)}" aria-label="فتح ${esc(w.name)}">${EM.drawThumb(w)}</a>
            <div class="wf-body">
              <div class="row between"><span class="xs muted">${esc(w.category || '')} · ${esc(EM.REF.deptName(w.dept))}</span>${ui.pill('wf', w.status)}</div>
              <h3><a href="#/admin/workflows/${esc(w.id)}" style="color:inherit">${esc(w.name)}</a></h3>
              <p class="small muted">${esc(w.description || '')}</p>
              <div class="wf-stats small"><span><b class="num">${w.nodes.length}</b> عقدة</span><span>الإصدار <b class="num">${w.versions?.at(-1)?.version || '—'}</b></span><span><b class="num">${run}</b> نشط</span>${fail ? `<span class="v-bad"><b class="num">${fail}</b> فشل</span>` : ''}</div>
              <div class="btn-group">
                <a class="btn sm primary" href="#/admin/workflows/${esc(w.id)}">${icon('settings', 'sm')} ${canDesign ? 'تصميم' : 'عرض'}</a>
                <a class="btn sm" href="#/admin/workflows/${esc(w.id)}?mode=sim">${icon('play', 'sm')} محاكاة</a>
                <a class="btn sm" href="#/admin/workflows/${esc(w.id)}?mode=monitor">${icon('monitor', 'sm')} التنفيذ</a>
                ${canDesign ? `<button class="btn sm ghost" data-action="dup" data-id="${esc(w.id)}" aria-label="نسخ">${icon('copy', 'sm')}</button>` : ''}
              </div>
            </div></article>`;
        }).join('') || ui.empty('لا توجد مسارات مطابقة');
      };
      draw();
      ui.bind(el, {
        q: EM.debounce((i) => { vs.q = i.value; draw(); }, 150),
        st: (b) => { vs.status = b.dataset.s; this.render(el); },
        dup: (b) => { const c = store.duplicateWorkflow(b.dataset.id); ui.toast('تم إنشاء نسخة كمسودة', 'ok'); location.hash = `#/admin/workflows/${c.id}`; },
        new: () => ui.modal({
          title: 'سير عمل جديد',
          body: `<div class="field"><label for="nw-n">الاسم</label><input id="nw-n" class="input" placeholder="مثال: طلب صيانة جهاز طبي"></div>
            <div class="field"><label for="nw-d">القسم المالك</label><select id="nw-d" class="input">${ui.options(EM.REF.departments.map((d) => [d.id, d.name]), 'biomed')}</select></div>
            <div class="field"><label for="nw-t">البداية</label><select id="nw-t" class="input"><option value="blank">فارغ (بداية ونهاية فقط)</option>${s.workflows.map((w) => `<option value="${esc(w.id)}">نسخة من: ${esc(w.name)}</option>`).join('')}</select></div>`,
          foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>إنشاء وفتح المصمم</button>',
          onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => {
            if (!store.guard('workflows.design', 'إنشاء سير عمل')) return;
            const name = m.querySelector('#nw-n').value.trim();
            if (!name) { ui.toast('اكتب اسم سير العمل', 'warn'); return; }
            const tpl = m.querySelector('#nw-t').value;
            let def;
            if (tpl === 'blank') {
              def = { id: EM.uid('wf'), name, dept: m.querySelector('#nw-d').value, category: 'مخصص', description: '', status: 'draft', version: 0, versions: [], variables: [],
                nodes: [{ id: 's', type: 'start', label: 'بداية', x: 525, y: 40, config: {} }, { id: 'e', type: 'end', label: 'نهاية', x: 525, y: 300, config: {} }], edges: [] };
            } else { def = EM.clone(store.workflow(tpl)); def.id = EM.uid('wf'); def.name = name; def.status = 'draft'; def.version = 0; def.versions = []; def.dept = m.querySelector('#nw-d').value; }
            store.state.workflows.push(def);
            store.audit('إنشاء سير عمل', 'workflow', def.id);
            store.commit('workflows'); close(); location.hash = `#/admin/workflows/${def.id}`;
          }),
        }),
        import: () => {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = '.json,application/json';
          inp.onchange = () => inp.files[0]?.text().then((t) => {
            try {
              const w = EM.WF.fromImport(t);
              w.id = EM.uid('wf'); w.status = 'draft'; w.version = 0; w.versions = [];
              EM.WF.layout(w);
              s.workflows.push(w);
              store.audit('استيراد سير عمل', 'workflow', w.id);
              store.commit('workflows'); ui.toast('تم الاستيراد كمسودة', 'ok'); location.hash = `#/admin/workflows/${w.id}`;
            } catch (err) { ui.toast(err.message, 'bad', 5000); }
          });
          inp.click();
        },
      });
    },
  };

  /* ---------- /admin/workflows/:id ---------- */
  EM.views.designer = {
    title: (p) => store.workflow(p.id)?.name || 'مصمم سير العمل',
    render(el, params) {
      const w = store.workflow(params.id);
      if (!w) { el.innerHTML = `<div class="page">${ui.empty('سير العمل غير موجود', '', '<a class="btn" href="#/admin/workflows">كل المسارات</a>')}</div>`; return; }
      const mode = new URLSearchParams(location.hash.split('?')[1] || '').get('mode') || 'design';
      const safeMode = mode === 'monitor' && !store.can('workflows.monitor') && !store.can('workflows.view') ? 'design' : mode;
      el.innerHTML = '<div class="designer-page"></div>';
      const firstInst = safeMode === 'monitor' ? store.state.instances.find((i) => i.workflowId === w.id && i.status === 'running') : null;
      const d = new EM.Designer(el.firstElementChild, { def: w, mode: safeMode });
      if (firstInst) { d.monInst = firstInst; d.drawGraph(); d.drawSide(); }
    },
  };

  /* ---------- /workflows/monitor ---------- */
  EM.views.monitor = {
    title: () => 'مراقبة التنفيذ',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('mon', { wf: '', status: '', dept: '', q: '', from: '', page: 1, tab: 'instances' });
      const tasks = store.openTasks();
      const overdue = tasks.filter((t) => t.overdue);
      const counts = s.instances.reduce((a, i) => (a[i.status] = (a[i.status] || 0) + 1, a), {});
      el.innerHTML = `<div class="page">
        ${ui.pageHead('مراقبة التنفيذ', 'كل مثيلات سير العمل الجارية في المستشفى، والمهام المتأخرة عن زمن الخدمة، والتصعيدات.')}
        <div class="grid c4">
          ${ui.kpi('قيد التنفيذ', counts.running || 0)}
          ${ui.kpi('مهام متأخرة', overdue.length, 'تجاوزت SLA', overdue.length ? 'down' : 'up')}
          ${ui.kpi('فشل يحتاج تدخلاً', counts.failed || 0, '', counts.failed ? 'down' : '')}
          ${ui.kpi('مكتملة', counts.completed || 0)}
        </div>
        <section class="panel">
          <div class="tabs">${[['instances', 'المثيلات'], ['overdue', `المهام المتأخرة (${overdue.length})`]].map(([k, t]) => `<button class="${vs.tab === k ? 'on' : ''}" data-action="tab" data-t="${k}">${t}</button>`).join('')}</div>
          ${vs.tab === 'instances' ? `<div class="toolbar">
            <input class="input search" type="search" placeholder="مريض، رقم المثيل، أو مرجع" value="${esc(vs.q)}" data-input="q">
            <select class="input" data-change="wf"><option value="">كل المسارات</option>${ui.options(s.workflows.map((w) => [w.id, w.name]), vs.wf)}</select>
            <select class="input" data-change="status"><option value="">كل الحالات</option>${ui.options(['running', 'paused', 'failed', 'completed', 'cancelled'].map((k) => [k, ui.statusText('inst', k)]), vs.status)}</select>
            <select class="input" data-change="dept"><option value="">كل الأقسام</option>${ui.options(EM.REF.departments.map((d) => [d.id, d.name]), vs.dept)}</select>
            <label class="small row" style="gap:6px">من <input class="input" type="date" data-change="from" value="${esc(vs.from)}"></label>
          </div><div id="mt"></div>` : `<div id="mt"></div>`}
        </section></div>`;
      const draw = () => {
        const box = el.querySelector('#mt');
        if (vs.tab === 'overdue') {
          box.innerHTML = overdue.length ? `<table class="tbl"><thead><tr><th>المهمة</th><th>المسار</th><th>المريض / المرجع</th><th>الدور</th><th>التأخير</th><th>التصعيد</th><th></th></tr></thead><tbody>${overdue.map((t) => `<tr>
            <td class="small"><b style="font-weight:500">${esc(t.node.label)}</b></td><td class="small">${esc(t.def.name)}</td>
            <td>${t.inst.patientId ? ui.patientCell(t.inst.patientId) : `<span class="num small">${esc(t.inst.ref || '—')}</span>`}</td>
            <td class="small">${esc(EM.REF.role(t.node.config.role)?.name || '—')}</td>
            <td><span class="pill bad">${fmt.minutes(t.late)}</span></td>
            <td class="small">${t.late > 60 ? 'المستوى 2: مدير القسم' : 'المستوى 1: المشرف'}</td>
            <td class="actions"><a class="btn sm" href="#/workflows/instance/${esc(t.inst.id)}">فتح</a></td></tr>`).join('')}</tbody></table>` : ui.empty('لا توجد مهام متأخرة', '', '', 'check');
          return;
        }
        const rows = s.instances.filter((i) => (!vs.wf || i.workflowId === vs.wf) && (!vs.status || i.status === vs.status) && (!vs.dept || i.dept === vs.dept) && (!vs.from || i.startedAt.slice(0, 10) >= vs.from) && EM.match(vs.q, i.id, store.patientName(i.patientId), i.ref))
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        const pg = EM.paginate(rows, vs.page, 14);
        box.innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المثيل</th><th>المسار</th><th>المريض / المرجع</th><th>الخطوة الحالية</th><th>القسم</th><th>البدء</th><th>الحالة</th><th></th></tr></thead><tbody>
          ${pg.rows.map((i) => { const d = store.versionDef(i.workflowId, i.version); const lastFail = i.history.slice().reverse().find((h) => h.event === 'failed'); return `<tr>
            <td class="num small">${esc(i.id)}<br><span class="xs muted">v${i.version}</span></td><td class="small">${esc(i.name)}</td>
            <td>${i.patientId ? ui.patientCell(i.patientId) : `<span class="num small">${esc(i.ref || '—')}</span>`}</td>
            <td class="small">${i.tokens.map((t) => esc(EM.WF.node(d, t.node)?.label)).join('، ') || '—'}${i.status === 'failed' && lastFail ? `<br><span class="xs v-bad">${esc(lastFail.note)}</span>` : ''}</td>
            <td class="small">${esc(EM.REF.deptName(i.dept))}</td><td class="small">${fmt.dateTime(i.startedAt)}</td><td>${ui.pill('inst', i.status)}</td>
            <td class="actions"><a class="btn sm" href="#/workflows/instance/${esc(i.id)}">عرض المسار</a></td></tr>`; }).join('')}
          </tbody></table></div>${ui.pager(pg)}` : ui.empty('لا توجد مثيلات مطابقة للفلاتر');
      };
      draw();
      ui.bind(el, {
        tab: (b) => { vs.tab = b.dataset.t; this.render(el); },
        q: EM.debounce((i) => { vs.q = i.value; vs.page = 1; draw(); }, 150),
        wf: (x) => { vs.wf = x.value; vs.page = 1; draw(); },
        status: (x) => { vs.status = x.value; vs.page = 1; draw(); },
        dept: (x) => { vs.dept = x.value; vs.page = 1; draw(); },
        from: (x) => { vs.from = x.value; vs.page = 1; draw(); },
        page: (b) => { vs.page = Number(b.dataset.page); draw(); },
      });
    },
  };

  /* ---------- /workflows/instance/:id ---------- */
  EM.views.instance = {
    title: (p) => `مثيل ${p.id}`,
    render(el, params) {
      const inst = store.state.instances.find((i) => i.id === params.id);
      if (!inst) { el.innerHTML = `<div class="page">${ui.empty('المثيل غير موجود', '', '<a class="btn" href="#/workflows/monitor">مراقبة التنفيذ</a>')}</div>`; return; }
      const def = store.versionDef(inst.workflowId, inst.version);
      el.innerHTML = `<div class="page" style="padding-bottom:0"><div class="crumbs"><a href="#/workflows/monitor">مراقبة التنفيذ</a> / <span class="num">${esc(inst.id)}</span> · <a href="#/admin/workflows/${esc(inst.workflowId)}">فتح سير العمل في المصمم</a></div></div><div class="designer-page"></div>`;
      new EM.Designer(el.querySelector('.designer-page'), { def: { ...def, versions: store.workflow(inst.workflowId).versions, status: store.workflow(inst.workflowId).status }, mode: 'monitor', instance: inst, instanceLocked: true, readonly: true });
    },
  };
})();
