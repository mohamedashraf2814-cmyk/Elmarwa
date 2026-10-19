/* لوحة إدارة الأسرّة: الإشغال، طلبات الدخول، التنظيف، الخروج، العزل */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;
  const isoCapable = (b) => b.ward === 'W-ICU' || Number(b.label) <= 2;
  const wardName = (id) => EM.REF.wards.find((w) => w.id === id)?.name || id;

  EM.views.beds = {
    title: () => 'إدارة الأسرّة',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('beds', { pick: null });
      const counts = ['occupied', 'available', 'cleaning', 'reserved', 'maintenance'].map((k) => [k, s.beds.filter((b) => b.status === k).length]);
      el.innerHTML = `<div class="page">
        ${ui.pageHead('إدارة الأسرّة', 'كل الأجنحة في لوحة واحدة. اختر طلب دخول ثم سريراً متاحاً لتخصيصه. الأسرّة المؤهلة للعزل معلّمة بإطار.')}
        <div class="bed-legend panel">${counts.map(([k, n]) => `<span class="bl bl-${k}"><i></i>${ui.statusText('bed', k)} <b class="num">${n}</b></span>`).join('')}<span class="bl"><i class="iso-i"></i>مؤهل للعزل</span></div>
        <div class="grid c-2-1" style="align-items:start">
          <div class="stack" style="gap:var(--sp-5)">
            ${EM.REF.wards.map((w) => { const beds = s.beds.filter((b) => b.ward === w.id); const occ = beds.filter((b) => b.status === 'occupied').length; return `
              <section class="panel ward">
                <header class="panel-head"><div><h3>${esc(w.name)}</h3><span class="xs muted">${esc(w.gender)}</span></div><span class="small"><b class="num">${occ}</b>/<span class="num">${beds.length}</span> مشغول</span></header>
                <div class="bed-grid">${beds.map((b) => bedTile(b, vs.pick)).join('')}</div>
              </section>`; }).join('')}
          </div>
          <aside class="stack sticky-col">
            <section class="panel">
              <div class="panel-head"><h2>طلبات الدخول</h2><span class="badge-count">${s.bedRequests.length}</span></div>
              <ul class="list">${s.bedRequests.map((r) => `
                <li class="${vs.pick === r.id ? 'req-on' : ''}"><div class="grow">
                  <div class="row between"><b class="small" style="font-weight:500">${esc(store.patientName(r.patientId))}</b>${r.priority === 'حرج' ? '<span class="pill bad">حرج</span>' : r.priority === 'عاجل' ? '<span class="pill warn">عاجل</span>' : '<span class="pill plain">مجدول</span>'}</div>
                  <div class="xs muted">${esc(r.from)} ← ${esc(wardName(r.ward))} · ${fmt.ago(r.requestedAt)}</div>
                  <div class="xs">${esc(r.reason)}</div>
                  ${r.isolation ? '<span class="pill par">يحتاج عزل</span>' : ''}
                  ${EM.minsSince(r.requestedAt) > 240 ? '<span class="pill bad">انتظار أكثر من 4 ساعات — مُصعّد</span>' : ''}
                  <div class="btn-group" style="margin-top:8px">${vs.pick === r.id ? '<button class="btn sm" data-action="pick" data-id="">إلغاء الاختيار</button><span class="xs muted" style="align-self:center">اختر سريراً متاحاً من اللوحة</span>' : `<button class="btn sm primary" data-action="pick" data-id="${r.id}">تخصيص سرير</button>`}</div>
                </div></li>`).join('') || `<li>${ui.empty('لا توجد طلبات دخول', '', '', 'bed')}</li>`}</ul>
            </section>
          </aside>
        </div></div>`;

      ui.bind(el, {
        pick: (b) => { vs.pick = b.dataset.id || null; this.render(el); },
        bed: (b) => {
          const bed = s.beds.find((x) => x.id === b.dataset.id);
          if (vs.pick) return assign(bed, s.bedRequests.find((r) => r.id === vs.pick), () => { vs.pick = null; this.render(el); });
          bedMenu(bed, () => this.render(el));
        },
      });
    },
  };

  function bedTile(b, picking) {
    const p = b.patientId ? store.patient(b.patientId) : null;
    const can = picking && b.status === 'available';
    return `<button class="bed st-${b.status} ${isoCapable(b) ? 'iso' : ''} ${can ? 'pickable' : ''} ${b.dischargeReady ? 'dready' : ''}" data-action="bed" data-id="${b.id}" aria-label="سرير ${b.label} ${ui.statusText('bed', b.status)}">
      <span class="bed-no num">${esc(b.label)}</span>
      ${p ? `<span class="bed-pt">${esc(p.name.split(' ')[0])} ${esc(p.name.split(' ').slice(-1)[0])}</span><span class="bed-los num">${Math.max(1, Math.round(EM.minsSince(b.since) / 1440))} يوم</span>` : `<span class="bed-pt">${ui.statusText('bed', b.status)}</span>${b.status === 'cleaning' ? `<span class="bed-los num">${fmt.minutes(EM.minsSince(b.since))}</span>` : ''}`}
      ${b.isolation ? '<span class="bed-flag">عزل</span>' : b.dischargeReady ? '<span class="bed-flag ok">خروج</span>' : ''}
    </button>`;
  }

  function assign(bed, req, done) {
    if (!store.guard('beds.assign', 'تخصيص سرير')) return;
    const s = store.state;
    if (bed.status !== 'available') { ui.toast('هذا السرير غير متاح. اختر سريراً أخضر', 'warn'); return; }
    if (req.isolation && !isoCapable(bed)) { ui.toast('المريض يحتاج عزلاً — اختر سريراً مؤهلاً للعزل (بإطار)', 'bad'); return; }
    // قفل تفاؤلي: يحاكي رفض التخصيص المتزامن لنفس السرير
    const version = bed.v || 0;
    setTimeout(() => {
      if ((bed.v || 0) !== version || bed.status !== 'available') { ui.toast('تعارض: تم تخصيص السرير لمستخدم آخر للتو', 'bad'); return; }
      bed.v = version + 1;
      bed.status = 'occupied'; bed.patientId = req.patientId; bed.since = new Date().toISOString(); bed.isolation = req.isolation;
      s.bedRequests = s.bedRequests.filter((r) => r.id !== req.id);
      if (req.fromBed) {
        const old = s.beds.find((x) => x.id === req.fromBed);
        if (old) { old.status = 'cleaning'; old.patientId = null; old.since = new Date().toISOString(); old.isolation = false; }
        store.audit('تأكيد استلام نقل داخلي', 'bed', req.fromBed, { after: bed.id });
      }
      store.audit('تخصيص سرير', 'bed', bed.id, { after: req.patientId });
      store.startInstance('wf_admission', { bedAvailable: true }, req.patientId);
      store.notify('info', 'تم تخصيص سرير', `${store.patientName(req.patientId)} — ${wardName(bed.ward)} سرير ${bed.label}`, '#/beds');
      store.commit('beds'); ui.toast(`تم التخصيص: ${wardName(bed.ward)} — سرير ${bed.label}`, 'ok'); done();
    }, 120);
  }

  function bedMenu(bed, done) {
    const p = bed.patientId ? store.patient(bed.patientId) : null;
    const actions = [];
    if (bed.status === 'occupied') actions.push(['discharge', 'بدء إجراءات الخروج', 'primary'], ['transfer', 'نقل لسرير آخر', '']);
    if (bed.status === 'cleaning') actions.push(['clean', 'تم التنظيف والتجهيز', 'primary']);
    if (bed.status === 'available') actions.push(['maint', 'تحويل للصيانة', 'danger']);
    if (bed.status === 'maintenance') actions.push(['avail', 'انتهت الصيانة', 'primary']);
    if (bed.status === 'reserved') actions.push(['avail', 'إلغاء الحجز', '']);
    ui.modal({
      title: `${wardName(bed.ward)} — سرير ${bed.label}`,
      body: `<div class="row">${ui.pill('bed', bed.status)}${isoCapable(bed) ? '<span class="pill plain">مؤهل للعزل</span>' : ''}</div>
        ${p ? `<div>${ui.patientCell(p.id)}</div><p class="small muted">منذ ${fmt.dateTime(bed.since)}</p>` : ''}
        ${bed.status === 'cleaning' ? `<p class="small">قيد التنظيف منذ ${fmt.minutes(EM.minsSince(bed.since))} (المستهدف 45 دقيقة)</p>` : ''}`,
      foot: actions.map(([a, t, c]) => `<button class="btn ${c}" data-a="${a}">${t}</button>`).join('') || '<button class="btn" data-close="1">إغلاق</button>',
      onMount(m, close) {
        m.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
          if (!store.guard('beds.assign', 'تعديل حالة سرير')) return;
          const a = b.dataset.a;
          const before = bed.status;
          if (a === 'discharge') {
            store.startInstance('wf_discharge', { type: 'normal' }, bed.patientId);
            bed.status = 'cleaning'; bed.patientId = null; bed.since = new Date().toISOString(); bed.dischargeReady = false; bed.isolation = false;
            store.notify('info', 'سرير بانتظار التنظيف', `${wardName(bed.ward)} سرير ${bed.label}`, '#/beds');
          } else if (a === 'clean' || a === 'avail') { bed.status = 'available'; bed.since = null; }
          else if (a === 'maint') bed.status = 'maintenance';
          else if (a === 'transfer') {
            store.state.bedRequests.unshift({ id: EM.uid('TRF'), patientId: bed.patientId, from: `نقل من ${wardName(bed.ward)}`, ward: bed.ward, reason: 'نقل داخلي — السرير الأصلي محجوز حتى الاستلام', requestedAt: new Date().toISOString(), priority: 'عاجل', isolation: bed.isolation, fromBed: bed.id });
            bed.status = 'reserved';
            ui.toast('أُنشئ طلب نقل. السرير الحالي محجوز حتى تأكيد الاستلام', 'info');
          }
          store.audit(`تغيير حالة سرير: ${ui.statusText('bed', bed.status)}`, 'bed', bed.id, { before, after: bed.status });
          store.commit('beds'); close(); done();
        }));
      },
    });
  }
})();
