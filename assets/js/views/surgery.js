/* العمليات: جدول الغرف الزمني وقائمة السلامة الجراحية */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;

  const CHECK = [
    ['identity', 'تأكيد هوية المريض', 'pre_op'], ['site', 'تحديد وتعليم موضع الجراحة', 'pre_op'], ['consent', 'الإقرار والموافقة موقعة', 'pre_op'],
    ['allergies', 'مراجعة الحساسية', 'pre_op'], ['bloodAvail', 'توفر الدم عند الحاجة', 'pre_op'], ['anesthesia', 'فحص أجهزة وأدوية التخدير', 'in_progress'],
    ['timeout', 'التوقف قبل الشق (Time-out)', 'in_progress'], ['signout', 'عدّ الأدوات والشاش قبل الخروج', 'recovery'],
  ];
  const NEXT = { scheduled: 'pre_op', pre_op: 'in_progress', in_progress: 'recovery', recovery: 'done' };

  EM.views.surgery = {
    title: () => 'العمليات',
    render(el) {
      const s = store.state;
      const rooms = [...new Set(s.surgeries.map((x) => x.room))];
      // نافذة زمنية من أول عملية لمدة 13 ساعة
      const t0 = new Date(Math.min(...s.surgeries.map((x) => new Date(x.start).getTime())));
      t0.setMinutes(0, 0, 0);
      const HOURS = 13;
      const span = HOURS * 60;
      const pos = (iso) => ((new Date(iso).getTime() - t0.getTime()) / 60000 / span) * 100;
      const nowPos = pos(new Date().toISOString());
      el.innerHTML = `<div class="page">
        ${ui.pageHead('العمليات', 'جدول غرف العمليات اليوم. اضغط على أي عملية لفتح قائمة السلامة الجراحية — لا تنتقل العملية لمرحلتها التالية قبل اكتمال بنود المرحلة.')}
        <section class="panel">
          <div class="gantt">
            <div class="g-hours"><span></span>${Array.from({ length: HOURS }, (_, i) => `<span class="num">${fmt.time(new Date(t0.getTime() + i * 3600000))}</span>`).join('')}</div>
            ${rooms.map((r) => `<div class="g-row"><b>${esc(r)}</b><div class="g-track">
              ${s.surgeries.filter((x) => x.room === r).map((x) => { const a = pos(x.start); const w = pos(x.end) - a; return `<button class="g-block st-${x.status}" style="right:${a}%;width:${w}%" data-action="open" data-id="${x.id}" title="${esc(x.procedure)}"><b>${esc(x.procedure)}</b><span>${esc(store.patientName(x.patientId))} · ${fmt.time(x.start)}</span></button>`; }).join('')}
              ${nowPos > 0 && nowPos < 100 ? `<span class="g-now" style="right:${nowPos}%"></span>` : ''}
            </div></div>`).join('')}
          </div>
        </section>
        <div class="grid c4">${['scheduled', 'pre_op', 'in_progress', 'recovery'].map((k) => ui.kpi(ui.statusText('or', k), s.surgeries.filter((x) => x.status === k).length)).join('')}</div>
      </div>`;
      ui.bind(el, { open: (b) => checklist(s.surgeries.find((x) => x.id === b.dataset.id), () => this.render(el)) });
    },
  };

  function checklist(x, done) {
    const p = store.patient(x.patientId);
    const next = NEXT[x.status];
    ui.modal({
      title: x.procedure, wide: true,
      body: `<div class="row between wrap">${ui.patientCell(x.patientId)}<div class="row">${ui.pill('or', x.status)}<span class="small muted">${esc(x.room)} · ${fmt.time(x.start)} – ${fmt.time(x.end)}</span></div></div>
        ${p?.allergies.length ? `<div class="callout bad">${icon('alert')}<span>حساسية مسجلة: ${esc(p.allergies.join('، '))}</span></div>` : ''}
        <div class="small muted">الجراح: ${esc(EM.REF.userName(x.surgeon) === x.surgeon ? 'د. حسين المنياوي' : EM.REF.userName(x.surgeon))} · التخدير: ${esc(EM.REF.userName(x.anesth))}</div>
        <div class="checklist">${CHECK.map(([k, t, phase]) => `<label class="check ck-${phase}"><input type="checkbox" data-k="${k}" ${x.checklist[k] ? 'checked' : ''} ${x.status === 'done' ? 'disabled' : ''}> ${esc(t)} <span class="xs muted">قبل: ${ui.statusText('or', phase)}</span></label>`).join('')}</div>`,
      foot: `<button class="btn" data-close="1">إغلاق</button>${next ? `<button class="btn primary" data-next>نقل إلى: ${ui.statusText('or', next)}</button>` : ''}`,
      onMount(m, close) {
        m.querySelectorAll('[data-k]').forEach((c) => c.addEventListener('change', () => {
          if (!store.guard('surgery.manage', 'قائمة السلامة الجراحية')) { c.checked = !c.checked; return; }
          x.checklist[c.dataset.k] = c.checked;
          store.audit(`قائمة السلامة: ${c.checked ? 'تأكيد' : 'إلغاء'} ${c.dataset.k}`, 'surgery', x.id);
          store.save();
        }));
        m.querySelector('[data-next]')?.addEventListener('click', () => {
          if (!store.guard('surgery.manage', 'تحديث حالة العملية')) return;
          const missing = CHECK.filter(([k, , phase]) => phase === next && !x.checklist[k]).map(([, t]) => t);
          if (missing.length) { ui.toast(`أكمل أولاً: ${missing.join('، ')}`, 'bad', 5000); return; }
          const before = x.status;
          x.status = next;
          if (next === 'done') store.notify('info', 'انتهت عملية', `${x.procedure} — قرار النقل للقسم أو العناية`, '#/surgery');
          store.audit(`تحديث حالة العملية إلى ${ui.statusText('or', next)}`, 'surgery', x.id, { before, after: next });
          store.commit('surgery'); close(); done();
        });
      },
    });
  }
})();
