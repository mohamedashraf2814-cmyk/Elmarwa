/* المواعيد والطوابير — جدول اليوم لكل عيادة */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;
  const CAP = 15;

  EM.views.appointments = {
    title: () => 'المواعيد والطوابير',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('appts', { clinic: 'all' });
      const list = s.appointments.slice().sort((a, b) => a.at.localeCompare(b.at));
      const count = (st) => list.filter((a) => a.status === st).length;
      const clinics = vs.clinic === 'all' ? EM.CLINICS : EM.CLINICS.filter((c) => c.id === vs.clinic);
      if (!s.waitlist) s.waitlist = [{ id: 'WL-1', patientId: s.patients[50].id, clinic: 'c2', at: new Date(Date.now() - 864e5).toISOString() }, { id: 'WL-2', patientId: s.patients[51].id, clinic: 'c1', at: new Date(Date.now() - 3e6).toISOString() }];

      el.innerHTML = `<div class="page">
        ${ui.pageHead('المواعيد والطوابير', `جدول ${fmt.day(new Date())} لكل العيادات. تسجيل الوصول يرسل المريض لطابور التمريض ثم الطبيب.`,
          `<button class="btn primary" data-action="book">${icon('plus')} حجز أو حضور مباشر</button>`)}
        <div class="grid c4">
          ${ui.kpi('مواعيد اليوم', list.filter((a) => a.status !== 'cancelled').length)}
          ${ui.kpi('في الانتظار الآن', count('arrived') + count('nurse'), 'وصلوا ولم يدخلوا الكشف')}
          ${ui.kpi('في الكشف', count('in_consult'))}
          ${ui.kpi('لم يحضر', count('no_show'), 'يتحول آلياً بعد 20 دقيقة', 'down')}
        </div>
        <div class="toolbar panel" style="border-radius:var(--r-panel)">
          <div class="seg">${[['all', 'كل العيادات'], ...EM.CLINICS.map((c) => [c.id, c.specialty])].map(([k, t]) => `<button class="${vs.clinic === k ? 'on' : ''}" data-action="clinic" data-c="${k}">${esc(t)}</button>`).join('')}</div>
        </div>
        <div class="clinic-board">
          ${clinics.map((c) => { const items = list.filter((a) => a.clinic === c.id); const active = items.filter((a) => a.status !== 'cancelled').length; return `
            <section class="panel clinic-col">
              <header><div><b>${esc(c.name)}</b><span class="xs muted">${esc(c.specialty)} · ${esc(c.room)}</span></div><span class="pill ${active >= CAP ? 'bad' : 'plain'} num">${active}/${CAP}</span></header>
              <ol class="slots">${items.map((a) => `
                <li class="slot st-${a.status}">
                  <span class="num slot-time">${fmt.time(a.at)}</span>
                  <div class="grow"><a href="#/patients/${esc(a.patientId)}" class="small" style="color:inherit;font-weight:500">${esc(store.patientName(a.patientId))}</a><div class="xs muted">${esc(a.type)} · رقم ${a.queueNo}</div></div>
                  ${ui.pill('appt', a.status)}
                  ${actionsFor(a)}
                </li>`).join('')}</ol>
            </section>`; }).join('')}
        </div>
        <section class="panel">
          <div class="panel-head"><h2>قائمة الانتظار</h2><span class="small muted">تُبلّغ تلقائياً عند إلغاء موعد في نفس العيادة</span></div>
          <ul class="list">${s.waitlist.map((w) => `<li><span class="grow small">${esc(store.patientName(w.patientId))} — ${esc(EM.CLINICS.find((c) => c.id === w.clinic).specialty)}</span><span class="xs muted">${fmt.ago(w.at)}</span></li>`).join('') || `<li>${ui.empty('قائمة الانتظار فارغة')}</li>`}</ul>
        </section>
      </div>`;

      ui.bind(el, {
        clinic: (b) => { vs.clinic = b.dataset.c; this.render(el); },
        st: (b) => {
          const a = s.appointments.find((x) => x.id === b.dataset.id);
          const to = b.dataset.to;
          const apply = (reason) => {
            const before = a.status;
            a.status = to;
            store.audit(`تغيير حالة موعد إلى ${ui.statusText('appt', to)}`, 'appointment', a.id, { before, after: to, reason });
            if (to === 'cancelled') {
              const w = s.waitlist.find((x) => x.clinic === a.clinic);
              if (w) store.notify('info', 'خانة متاحة', `تم إبلاغ ${store.patientName(w.patientId)} من قائمة الانتظار`, '#/appointments');
            }
            if (to === 'arrived') store.startInstance('wf_outpatient', { insured: store.patient(a.patientId)?.insurer !== 'NONE', hasOrders: true }, a.patientId);
            store.commit('appointments');
            ui.toast(`${store.patientName(a.patientId)}: ${ui.statusText('appt', to)}`, 'ok');
            this.render(el);
          };
          if (to === 'cancelled' || to === 'no_show') ui.confirm({ title: to === 'cancelled' ? 'إلغاء الموعد' : 'تسجيل عدم الحضور', message: 'اكتب السبب ليُحفظ في السجل.', reason: true, danger: true, confirm: 'تأكيد', onOk: apply });
          else apply();
        },
        book: () => bookModal(() => this.render(el)),
      });
    },
  };

  function actionsFor(a) {
    const b = (to, t, cls = '') => `<button class="btn sm ${cls}" data-action="st" data-id="${esc(a.id)}" data-to="${to}">${t}</button>`;
    switch (a.status) {
      case 'booked': return `<span class="slot-actions">${b('arrived', 'وصل', 'primary')}${b('no_show', 'لم يحضر', 'ghost')}${b('cancelled', 'إلغاء', 'ghost')}</span>`;
      case 'arrived': return `<span class="slot-actions">${b('nurse', 'للتمريض', 'primary')}</span>`;
      case 'nurse': return `<span class="slot-actions">${b('in_consult', 'للطبيب', 'primary')}</span>`;
      case 'in_consult': return `<span class="slot-actions">${b('done', 'انتهى')}</span>`;
      default: return '';
    }
  }

  function bookModal(done) {
    const s = store.state;
    ui.modal({
      title: 'حجز موعد أو حضور مباشر',
      body: `<div class="form-grid">
        <div class="field full"><label for="b-p">المريض</label><select id="b-p" class="input">${s.patients.slice(0, 64).map((p) => `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.id)}</option>`).join('')}</select><span class="hint">مريض غير مسجل؟ سجّله أولاً من صفحة المرضى.</span></div>
        <div class="field"><label for="b-c">العيادة</label><select id="b-c" class="input">${EM.CLINICS.map((c) => `<option value="${c.id}">${esc(c.specialty)} — ${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="b-t">النوع</label><select id="b-t" class="input"><option>حضور مباشر</option><option>حجز جديد</option><option>متابعة</option></select></div>
        <div class="field full" id="b-over"></div></div>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>حجز</button>',
      onMount(m, close) {
        const check = () => {
          const c = m.querySelector('#b-c').value;
          const n = s.appointments.filter((a) => a.clinic === c && a.status !== 'cancelled').length;
          m.querySelector('#b-over').innerHTML = n >= CAP ? `<div class="callout warn">${icon('alert')}<div>العيادة وصلت للسعة القصوى (${CAP}). الحجز الإضافي استثناء يحتاج سبباً.<input id="b-why" class="input" style="margin-top:8px" placeholder="سبب الحجز الإضافي"></div></div>` : `<span class="small muted">المتاح: ${CAP - n} خانة</span>`;
        };
        m.querySelector('#b-c').addEventListener('change', check);
        check();
        m.querySelector('[data-ok]').addEventListener('click', () => {
          if (!store.guard('appointments.manage', 'حجز موعد')) return;
          const c = m.querySelector('#b-c').value;
          const why = m.querySelector('#b-why')?.value.trim();
          if (m.querySelector('#b-why') && !why) { ui.toast('الحجز الإضافي يحتاج سبباً', 'warn'); return; }
          const type = m.querySelector('#b-t').value;
          const last = s.appointments.filter((a) => a.clinic === c).sort((a, b) => b.at.localeCompare(a.at))[0];
          const at = type === 'حضور مباشر' ? new Date().toISOString() : new Date(new Date(last?.at || Date.now()).getTime() + 20 * 60000).toISOString();
          const ap = { id: EM.uid('AP'), clinic: c, patientId: m.querySelector('#b-p').value, at, type, status: type === 'حضور مباشر' ? 'arrived' : 'booked', queueNo: s.appointments.filter((a) => a.clinic === c).length + 1 };
          s.appointments.push(ap);
          store.audit(why ? 'حجز إضافي فوق السعة' : 'حجز موعد', 'appointment', ap.id, { reason: why });
          store.commit('appointments'); close(); ui.toast('تم الحجز وإضافة المريض للطابور', 'ok'); done();
        });
      },
    });
  }
})();
