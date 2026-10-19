/* لوحة الطوارئ والفرز */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;

  const DISP = { admit: 'دخول', discharge: 'خروج', transfer: 'تحويل' };

  EM.views.emergency = {
    title: () => 'الطوارئ',
    render(el) {
      const s = store.state;
      const active = s.er.filter((e) => !e.closed);
      const col = (title, items, color, target) => `
        <section class="er-col" style="--c:${color}">
          <header><span class="er-dot"></span><b>${esc(title)}</b><span class="num muted">${items.length}</span>${target !== undefined ? `<span class="xs muted">الهدف ${target === 0 ? 'فوري' : `${target} د`}</span>` : ''}</header>
          <div class="er-cards">${items.sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt)).map((e) => card(e, target)).join('') || '<div class="er-empty">لا توجد حالات</div>'}</div>
        </section>`;
      el.innerHTML = `<div class="page">
        ${ui.pageHead('الطوارئ والفرز', 'الحالات مرتبة حسب مستوى الخطورة. الإجراءات الإدارية والسداد لا تؤخر العلاج الطارئ.',
          `<button class="btn danger solid" data-action="quick">${icon('plus')} تسجيل سريع لحالة واردة</button>`)}
        <div class="callout">${icon('shield')}<span>تحديد مستوى الخطورة والقرارات السريرية يتم بواسطة طاقم مخول فقط. النظام يرتب ويذكّر ويصعّد، ولا يتخذ قراراً طبياً.</span></div>
        <div class="er-board">
          ${col('بانتظار الفرز', active.filter((e) => e.status === 'waiting_triage'), 'var(--ink-400)')}
          ${EM.REF.esi.map((l) => col(`${l.level} — ${l.name}`, active.filter((e) => e.level === l.level && e.status !== 'waiting_triage'), l.color, l.target)).join('')}
        </div>
      </div>`;

      ui.bind(el, {
        quick: () => quickReg(() => this.render(el)),
        triage: (b) => triageModal(s.er.find((x) => x.id === b.dataset.id), () => this.render(el)),
        assign: (b) => {
          if (!store.guard('clinic.consult', 'استلام حالة طوارئ')) return;
          const e = s.er.find((x) => x.id === b.dataset.id);
          e.doctor = store.user().id; e.status = 'in_assessment';
          store.audit('استلام حالة طوارئ', 'er', e.id);
          store.commit('er'); ui.toast('تم استلام الحالة', 'ok'); this.render(el);
        },
        orders: (b) => {
          if (!store.guard('orders.create', 'طلب تحاليل')) return;
          const e = s.er.find((x) => x.id === b.dataset.id);
          if (!e.patientId) { ui.toast('اربط الحالة بملف مريض أولاً (حتى لو مؤقت)', 'warn'); return; }
          ordersModal(e, () => this.render(el));
        },
        dispo: (b) => {
          if (!store.guard('clinic.consult', 'القرار النهائي')) return;
          const e = s.er.find((x) => x.id === b.dataset.id);
          ui.modal({
            title: 'القرار النهائي للحالة',
            body: `<div class="field"><label for="d-ward">الجناح عند الدخول</label><select id="d-ward" class="input">${ui.options(EM.REF.wards.map((w) => [w.id, w.name]), e.level && e.level <= 2 ? 'W-ICU' : 'W-MED')}</select></div>
              <div class="seg" role="radiogroup">${Object.entries(DISP).map(([k, t]) => `<button data-d="${k}">${t}</button>`).join('')}</div>
              <p class="small muted">الدخول يُنشئ طلب سرير في لوحة الأسرّة ويقترح أنسب سرير متاح. الخروج يغلق الزيارة ويرحّل الفاتورة ويحجز متابعة.</p>`,
            onMount: (m, close) => m.querySelectorAll('[data-d]').forEach((x) => x.addEventListener('click', () => {
              if (!e.patientId) { ui.toast('اربط الحالة بملف مريض أولاً', 'warn'); return; }
              EM.H.erDisposition(e, x.dataset.d, m.querySelector('#d-ward').value);
              store.commit('er'); close(); ui.toast(`تم: ${DISP[x.dataset.d]}`, 'ok'); this.render(el);
            })),
          });
        },
        link: (b) => {
          const e = s.er.find((x) => x.id === b.dataset.id);
          ui.modal({
            title: 'ربط الحالة بملف مريض',
            body: `<p class="small muted">ابحث عن ملف موجود، أو سجّل الحالة كمريض جديد بهوية مؤقتة.</p><div class="field"><label for="lk-p">الملف</label><select id="lk-p" class="input">${store.state.patients.slice(0, 70).map((p) => `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.id)}</option>`).join('')}</select></div>`,
            foot: '<button class="btn" data-new>ملف جديد مؤقت</button><button class="btn primary" data-ok>ربط</button>',
            onMount: (m, close) => {
              m.querySelector('[data-ok]').addEventListener('click', () => { EM.H.erLink(e, m.querySelector('#lk-p').value); store.commit('er'); close(); this.render(el); });
              m.querySelector('[data-new]').addEventListener('click', () => {
                const p = { id: `EM-26-${EM.pad(store.state.patients.length + 31000, 6)}`, name: `مجهول الهوية ${e.id}`, gender: '—', dob: new Date(1985, 0, 1).toISOString(), nationalId: '', phone: '', governorate: '—', insurer: 'NONE', policy: '', blood: '—', allergies: [], alerts: ['هوية غير مؤكدة'], emergency: { name: '—', relation: '—', phone: '' }, consent: { sms: false, research: false }, createdAt: new Date().toISOString(), incomplete: true };
                store.state.patients.unshift(p);
                EM.H.erLink(e, p.id);
                store.commit('er'); close(); ui.toast(`أُنشئ ملف مؤقت ${p.id} — يُستكمل لاحقاً من السجلات الطبية`, 'warn', 5000); this.render(el);
              });
            },
          });
        },
      });
    },
  };

  function card(e, target) {
    const mins = EM.minsSince(e.arrivedAt);
    const over = target !== undefined && mins > target;
    const v = e.vitals || {};
    const vit = (k, label, bad) => `<span class="${bad ? 'v-bad' : ''}"><small>${label}</small><b class="num">${esc(v[k] ?? '—')}</b></span>`;
    return `<article class="er-card ${over ? 'over' : ''}">
      <div class="row between"><b class="small">${e.patientId ? `<a href="#/patients/${esc(e.patientId)}" style="color:inherit">${esc(store.patientName(e.patientId))}</a>` : `<span class="pill warn plain">${esc(e.tempName || 'حالة غير معرّفة')}</span>`}</b><span class="num xs ${over ? 'v-bad' : 'muted'}">${fmt.minutes(mins)}</span></div>
      <div class="small">${esc(e.complaint)}</div>
      <div class="vitals">${vit('hr', 'نبض', v.hr > 120 || v.hr < 50)}${vit('bp', 'ضغط')}${vit('spo2', 'أكسجين', v.spo2 < 92)}${vit('temp', 'حرارة', Number(v.temp) >= 38.5)}</div>
      <div class="row between"><span class="xs muted">${esc(e.bay || '')}${e.doctor ? ` · ${esc(EM.REF.userName(e.doctor))}` : ''}</span>${ui.pill('er', e.status)}</div>
      <div class="btn-group">
        ${e.status === 'waiting_triage' ? `<button class="btn sm primary" data-action="triage" data-id="${e.id}">فرز</button>` : ''}
        ${e.status === 'triaged' ? `<button class="btn sm primary" data-action="assign" data-id="${e.id}">استلام الحالة</button><button class="btn sm ghost" data-action="triage" data-id="${e.id}">إعادة فرز</button>` : ''}
        ${e.status === 'in_assessment' ? `<button class="btn sm" data-action="orders" data-id="${e.id}">الطلبات</button><button class="btn sm primary" data-action="dispo" data-id="${e.id}">القرار</button>` : ''}
        ${e.status === 'awaiting_results' ? `<button class="btn sm primary" data-action="dispo" data-id="${e.id}">القرار</button>` : ''}
        ${e.status === 'disposition' ? `<span class="pill ok plain">${DISP[e.disposition]}</span>${e.disposition === 'admit' ? '<a class="btn sm" href="#/beds">بانتظار سرير ←</a>' : ''}` : ''}
        ${!e.patientId ? `<button class="btn sm ghost" data-action="link" data-id="${e.id}">ربط بملف</button>` : ''}
      </div>
    </article>`;
  }

  function triageModal(e, done) {
    if (!store.guard('er.triage', 'الفرز')) return;
    ui.modal({
      title: 'الفرز وتحديد مستوى الخطورة',
      body: `<div class="form-grid">
        ${[['hr', 'النبض'], ['bp', 'الضغط'], ['spo2', 'تشبع الأكسجين %'], ['temp', 'الحرارة'], ['rr', 'معدل التنفس']].map(([k, t]) => `<div class="field"><label for="t-${k}">${t}</label><input id="t-${k}" class="input num" value="${esc(e.vitals?.[k] ?? '')}"></div>`).join('')}
        <div class="field full"><label>مستوى الخطورة (يحدده ممرض الفرز)</label><div class="esi-pick">${EM.REF.esi.map((l) => `<button type="button" data-l="${l.level}" style="--c:${l.color}" class="${e.level === l.level ? 'on' : ''}"><b class="num">${l.level}</b><span>${esc(l.name)}</span></button>`).join('')}</div></div>
      </div>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>حفظ الفرز</button>',
      onMount(m, close) {
        let level = e.level;
        m.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => { level = Number(b.dataset.l); m.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('on', x === b)); }));
        m.querySelector('[data-ok]').addEventListener('click', () => {
          if (!level) { ui.toast('اختر مستوى الخطورة', 'warn'); return; }
          ['hr', 'bp', 'spo2', 'temp', 'rr'].forEach((k) => { e.vitals[k] = m.querySelector(`#t-${k}`).value; });
          const before = e.level;
          e.level = level; e.status = 'triaged';
          store.audit('فرز حالة طوارئ', 'er', e.id, { before, after: level });
          if (level <= 2) {
            store.notify('bad', `حالة مستوى ${level}`, `${e.patientId ? store.patientName(e.patientId) : e.tempName} — ${e.complaint}`, '#/emergency');
            if (e.patientId) store.startInstance('wf_emergency', { esi: level, disposition: 'admit' }, e.patientId);
          }
          store.commit('er'); close();
          ui.toast(level <= 2 ? 'تم التصعيد فوراً واستدعاء الطبيب المناوب' : 'تم الفرز', level <= 2 ? 'bad' : 'ok');
          done();
        });
      },
    });
  }

  function ordersModal(e, done) {
    ui.modal({
      title: `طلبات الطوارئ — ${store.patientName(e.patientId)}`,
      body: `<fieldset class="orders"><legend>تحاليل STAT</legend>${EM.REF.labTests.map((t) => `<label class="check"><input type="checkbox" name="el" value="${t.code}" ${['TROP', 'CBC'].includes(t.code) && /صدر/.test(e.complaint) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')}</fieldset>
        <fieldset class="orders"><legend>أشعة</legend>${EM.REF.imaging.map((t) => `<label class="check"><input type="checkbox" name="er" value="${t.code}"> ${esc(t.name)}</label>`).join('')}</fieldset>
        <fieldset class="orders"><legend>علاج فوري</legend><select id="e-drug" class="input"><option value="">— بدون —</option>${EM.REF.drugs.map((d) => `<option value="${d.code}">${esc(d.name)}</option>`).join('')}</select><input id="e-dose" class="input" placeholder="الجرعة"></fieldset>
        <p class="xs muted">الطلبات تذهب للمعمل والأشعة والصيدلية فوراً، وتُضاف مهمة سحب العينات للتمريض، وتُحسب الخدمات على الفاتورة عند إصدار النتائج.</p>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>إرسال الطلبات</button>',
      onMount(m, close) {
        m.querySelector('[data-ok]').addEventListener('click', () => {
          const labs = [...m.querySelectorAll('[name=el]:checked')].map((i) => i.value);
          const rads = [...m.querySelectorAll('[name=er]:checked')].map((i) => i.value);
          const drug = m.querySelector('#e-drug').value;
          if (!labs.length && !rads.length && !drug) { ui.toast('اختر طلباً واحداً على الأقل', 'warn'); return; }
          EM.H.orderLab(e.patientId, labs, { priority: 'STAT', source: 'er' });
          EM.H.orderRad(e.patientId, rads, { indication: e.complaint, priority: 'STAT' });
          if (drug) EM.H.prescribe(e.patientId, drug, { dose: m.querySelector('#e-dose').value || '—', route: 'وريد', location: 'الطوارئ' });
          e.status = 'awaiting_results';
          store.audit('طلبات من الطوارئ', 'er', e.id, { after: { labs, rads, drug } });
          store.commit('er'); close();
          ui.toast(`أُرسل: ${labs.length} تحليل، ${rads.length} أشعة${drug ? '، دواء' : ''}`, 'ok'); done();
        });
      },
    });
  }

  function quickReg(done) {
    ui.modal({
      title: 'تسجيل سريع — طوارئ',
      body: `<p class="small muted">تسجيل مختصر بدون انتظار المستندات أو السداد. يمكن الربط بملف موجود أو إنشاء هوية مؤقتة.</p>
        <div class="form-grid">
          <div class="field full"><label for="q-p">ملف موجود (اختياري)</label><select id="q-p" class="input"><option value="">— حالة غير معرّفة —</option>${store.state.patients.slice(0, 64).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="q-tmp">وصف مؤقت</label><input id="q-tmp" class="input" placeholder="مثال: أنثى حوالي 30 عاماً"></div>
          <div class="field"><label for="q-c">الشكوى الرئيسية</label><input id="q-c" class="input" required></div>
        </div>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn danger solid" data-ok>تسجيل وإرسال للفرز</button>',
      onMount(m, close) {
        m.querySelector('[data-ok]').addEventListener('click', () => {
          const c = m.querySelector('#q-c').value.trim();
          if (!c) { ui.toast('اكتب الشكوى الرئيسية', 'warn'); return; }
          const pid = m.querySelector('#q-p').value || null;
          EM.H.erArrive({ pid, tempName: pid ? null : (m.querySelector('#q-tmp').value.trim() || 'حالة غير معرّفة'), complaint: c });
          store.commit('er'); close(); ui.toast('أُضيفت الحالة لعمود «بانتظار الفرز»', 'ok'); done();
        });
      },
    });
  }
})();
