/* مساحة عمل الطبيب: الطابور، التوثيق السريري، الطلبات والوصفات */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;

  EM.views.clinic = {
    title: () => 'مساحة الطبيب',
    render(el) {
      const s = store.state;
      const qp = new URLSearchParams(location.hash.split('?')[1] || '');
      const vs = ui.vstate('clinic', { pid: null });
      if (qp.get('p')) vs.pid = qp.get('p');
      const myClinic = EM.CLINICS.find((c) => c.doctor === store.user().id);
      const queue = s.appointments.filter((a) => ['nurse', 'in_consult', 'arrived'].includes(a.status) && (!myClinic || a.clinic === myClinic.id)).sort((a, b) => a.at.localeCompare(b.at));
      if (!vs.pid && queue[0]) vs.pid = queue[0].patientId;
      const p = vs.pid ? store.patient(vs.pid) : null;

      el.innerHTML = `<div class="page">
        ${ui.pageHead('مساحة الطبيب', myClinic ? `${esc(myClinic.specialty)} · ${esc(myClinic.room)}` : 'كل العيادات')}
        <div class="grid c-1-2">
          <section class="panel">
            <div class="panel-head"><h2>طابور الكشف</h2><span class="num muted">${queue.length}</span></div>
            <ul class="list q-list">${queue.map((a) => `
              <li class="${a.patientId === vs.pid ? 'on' : ''}"><button class="q-item" data-action="pick" data-p="${esc(a.patientId)}">
                <span class="num q-no">${a.queueNo}</span><span class="grow"><b class="small" style="font-weight:500">${esc(store.patientName(a.patientId))}</b><br><span class="xs muted">${fmt.time(a.at)} · ${esc(a.type)}</span></span>${ui.pill('appt', a.status)}</button></li>`).join('') || `<li>${ui.empty('الطابور فارغ', 'لا يوجد مرضى بانتظار الكشف الآن.', '', 'check')}</li>`}</ul>
          </section>
          <section class="panel">
            ${p ? encounter(p) : ui.empty('اختر مريضاً من الطابور', '', '', 'user')}
          </section>
        </div></div>`;

      ui.bind(el, {
        pick: (b) => { vs.pid = b.dataset.p; history.replaceState(null, '', '#/clinic'); this.render(el); },
        save: () => saveEncounter(el, p, () => { vs.pid = null; this.render(el); }),
      });
    },
  };

  function encounter(p) {
    const last = EM.patientTimeline(p.id).slice(0, 4);
    return `
      <div class="panel-head"><div><h2>${esc(p.name)}</h2><span class="xs muted"><span class="num">${esc(p.id)}</span> · ${fmt.age(p.dob)} سنة · ${esc(p.gender)}</span></div><a class="btn sm" href="#/patients/${esc(p.id)}">الملف الكامل</a></div>
      <div class="panel-body stack">
        <div class="row wrap" style="gap:6px">${p.allergies.map((a) => `<span class="pill bad">حساسية: ${esc(a)}</span>`).join('') || '<span class="pill ok">لا حساسية مسجلة</span>'}${p.alerts.map((a) => `<span class="pill warn">${esc(a)}</span>`).join('')}</div>
        ${last.length ? `<div class="small muted">آخر الأحداث: ${last.map((e) => esc(e.title)).join(' · ')}</div>` : ''}
        <div class="form-grid">
          <div class="field full"><label for="n-s">الشكوى والتاريخ المرضي</label><textarea id="n-s" class="input" placeholder="يكتبه الطبيب"></textarea></div>
          <div class="field full"><label for="n-o">الفحص الإكلينيكي</label><textarea id="n-o" class="input"></textarea></div>
          <div class="field full"><label for="n-a">التشخيص (يوثّقه الطبيب المعالج فقط)</label><input id="n-a" class="input" placeholder="النظام لا يقترح أو يولّد تشخيصات"></div>
        </div>
        <fieldset class="orders"><legend>طلبات التحاليل</legend>${EM.REF.labTests.map((t) => `<label class="check"><input type="checkbox" name="lab" value="${t.code}"> ${esc(t.name)}</label>`).join('')}</fieldset>
        <fieldset class="orders"><legend>طلبات الأشعة</legend>${EM.REF.imaging.map((t) => `<label class="check"><input type="checkbox" name="rad" value="${t.code}"> ${esc(t.name)}</label>`).join('')}</fieldset>
        <fieldset class="orders"><legend>الوصفة</legend>
          <div class="form-grid" style="width:100%">
            <div class="field"><label for="rx-d">الدواء</label><select id="rx-d" class="input"><option value="">— بدون —</option>${EM.REF.drugs.map((d) => `<option value="${d.code}">${esc(d.name)}${d.controlled ? ' (مراقب)' : ''}</option>`).join('')}</select></div>
            <div class="field"><label for="rx-dose">الجرعة والتكرار</label><input id="rx-dose" class="input" placeholder="مثال: 1 جم كل 8 ساعات"></div>
          </div>
        </fieldset>
        <div class="row between wrap"><label class="check"><input type="checkbox" id="n-fu" checked> حجز متابعة بعد أسبوعين</label><button class="btn primary" data-action="save">${icon('save')} حفظ وإنهاء الكشف</button></div>
      </div>`;
  }

  function saveEncounter(el, p, done) {
    if (!store.guard('clinic.consult', 'التوثيق السريري')) return;
    const s = store.state;
    const $ = (q) => el.querySelector(q);
    const text = [$('#n-s').value, $('#n-o').value].join(' ').trim();
    if (!text) { ui.toast('اكتب ملاحظات الكشف أولاً', 'warn'); return; }
    const labs = [...el.querySelectorAll('input[name=lab]:checked')].map((i) => i.value);
    const rads = [...el.querySelectorAll('input[name=rad]:checked')].map((i) => i.value);
    const drug = $('#rx-d').value;
    const finish = (justification) => {
      const now = new Date().toISOString();
      const by = store.user().id;
      s.notes.unshift({ id: EM.uid('NOTE'), patientId: p.id, at: now, by, text: `${text}${$('#n-a').value ? ` — التشخيص: ${$('#n-a').value}` : ''}` });
      labs.forEach((code) => { const t = EM.REF.labTests.find((x) => x.code === code); s.lab.unshift({ id: EM.uid('LAB'), patientId: p.id, test: code, priority: 'روتيني', stage: 'ordered', orderedAt: now, orderedBy: by, source: 'opd', result: null, critical: false, dueAt: EM.minsFromNow(t.tat) }); });
      rads.forEach((code) => s.rad.unshift({ id: EM.uid('RAD'), patientId: p.id, study: code, stage: 'ordered', indication: $('#n-a').value || 'تقييم', priority: 'روتيني', orderedAt: now, scheduledAt: EM.minsFromNow(90) }));
      if (drug) {
        const d = EM.REF.drugs.find((x) => x.code === drug);
        s.rx.unshift({ id: EM.uid('RX'), patientId: p.id, drug, dose: $('#rx-dose').value || '—', route: 'فم', freq: '', prescriber: by, at: now, status: justification ? 'on_hold' : 'new', alert: justification ? { kind: 'حساسية', text: `تجاوز تنبيه حساسية بتبرير الطبيب: ${justification}` } : null, location: 'العيادات' });
        if (justification) store.audit('تجاوز تنبيه حساسية دوائية', 'rx', d.code, { reason: justification });
      }
      const ap = s.appointments.find((a) => a.patientId === p.id && ['in_consult', 'nurse', 'arrived'].includes(a.status));
      if (ap) ap.status = 'done';
      if ($('#n-fu').checked) {
        const c = ap ? ap.clinic : 'c1';
        s.appointments.push({ id: EM.uid('AP'), clinic: c, patientId: p.id, at: new Date(Date.now() + 14 * 864e5).toISOString(), type: 'متابعة', status: 'booked', queueNo: 0 });
      }
      store.audit('حفظ مواجهة عيادة', 'encounter', p.id, { after: { labs, rads, drug } });
      store.commit('clinic');
      ui.toast(`تم الحفظ: ${labs.length} تحليل، ${rads.length} أشعة${drug ? '، وصفة واحدة' : ''}`, 'ok', 4500);
      done();
    };
    // فحص الحساسية: تنبيه وليس قراراً — التجاوز يتطلب تبريراً موثقاً
    const d = drug && EM.REF.drugs.find((x) => x.code === drug);
    const allergyHit = d && p.allergies.some((a) => (a.includes('البنسلين') && /أموكسي|بنسلين/.test(d.name)));
    if (allergyHit) {
      ui.confirm({ title: 'تنبيه حساسية', message: `المريض لديه حساسية مسجلة (${esc(p.allergies.join('، '))}) وقد يتعارض معها «${esc(d.name)}». التنبيه آلي ولا يمثل قراراً سريرياً. للمتابعة اكتب تبريراً، وستُحال الوصفة لمراجعة الصيدلي.`, reason: true, danger: true, confirm: 'متابعة بتبرير', onOk: finish });
    } else finish(null);
  }
})();
