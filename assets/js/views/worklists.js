/* قوائم عمل المعمل والأشعة — كل طلب يمر بمراحل صريحة ولا يقفز بينها */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;

  const LAB_FLOW = [
    ['ordered', 'مطلوب'], ['collected', 'تم السحب'], ['received', 'تم الاستلام'], ['in_process', 'قيد التشغيل'], ['resulted', 'بانتظار الاعتماد'], ['verified', 'صادر'],
  ];
  const RAD_FLOW = [['ordered', 'مطلوب'], ['scheduled', 'مجدول'], ['acquired', 'تم التصوير'], ['reported', 'بانتظار الاعتماد'], ['verified', 'معتمد']];

  function stepper(flow, items, active, kindRoot) {
    return `<div class="stepper" role="tablist">
      <button class="${!active ? 'on' : ''}" data-action="stage" data-s="">الكل <b class="num">${items.length}</b></button>
      ${flow.map(([k, t]) => { const n = items.filter((x) => x.stage === k).length; return `<button class="${active === k ? 'on' : ''}" data-action="stage" data-s="${k}" role="tab">${esc(t)} <b class="num">${n}</b></button>`; }).join('')}
      ${kindRoot === 'lab' ? `<button class="${active === 'critical' ? 'on' : ''} crit" data-action="stage" data-s="critical">حرجة بلا إقرار <b class="num">${items.filter((x) => x.critical && !x.ackBy).length}</b></button>` : ''}
    </div>`;
  }

  const prioPill = (p) => (p === 'STAT' ? '<span class="pill bad">STAT</span>' : p === 'عاجل' ? '<span class="pill warn">عاجل</span>' : '<span class="pill plain">روتيني</span>');

  /* ================= المعمل ================= */
  EM.views.lab = {
    title: () => 'المعمل',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('lab', { stage: '', q: '' });
      const all = s.lab;
      const rows = all.filter((x) => (vs.stage === 'critical' ? x.critical && !x.ackBy : !vs.stage || x.stage === vs.stage) && EM.match(vs.q, store.patientName(x.patientId), x.id))
        .sort((a, b) => (b.critical && !b.ackBy) - (a.critical && !a.ackBy) || (a.priority === 'STAT' ? -1 : 0) - (b.priority === 'STAT' ? -1 : 0) || a.dueAt.localeCompare(b.dueAt));
      el.innerHTML = `<div class="page">
        ${ui.pageHead('قائمة عمل المعمل', 'من الطلب إلى إصدار النتيجة. النتائج الحرجة تبقى معلقة حتى يقر الطبيب باستلامها.')}
        <section class="panel">
          ${stepper(LAB_FLOW, all, vs.stage, 'lab')}
          <div class="toolbar"><input class="input search" type="search" placeholder="بحث باسم المريض أو رقم الطلب" value="${esc(vs.q)}" data-input="q"></div>
          <div id="lt">${table(rows)}</div>
        </section></div>`;
      function table(list) {
        if (!list.length) return ui.empty('لا توجد طلبات في هذه المرحلة', '', '', 'flask');
        return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الطلب</th><th>المريض</th><th>التحليل</th><th>الأولوية</th><th>المرحلة</th><th>الاستحقاق</th><th>النتيجة</th><th></th></tr></thead><tbody>
          ${list.slice(0, 40).map((x) => { const t = EM.REF.labTests.find((y) => y.code === x.test); const late = x.stage !== 'verified' && new Date(x.dueAt) < new Date(); return `<tr class="${x.critical && !x.ackBy ? 'row-crit' : ''}">
            <td class="num small">${esc(x.id)}</td><td>${ui.patientCell(x.patientId)}</td>
            <td class="small">${esc(t.name)}<br><span class="xs muted">${esc(t.specimen)}</span></td>
            <td>${prioPill(x.priority)}</td><td>${ui.pill('lab', x.stage)}${x.rejected ? `<br><span class="xs v-bad">${esc(x.rejected)}</span>` : ''}</td>
            <td class="small ${late ? 'v-bad' : ''}">${late ? `متأخر ${fmt.minutes(EM.minsSince(x.dueAt))}` : fmt.time(x.dueAt)}</td>
            <td class="small">${x.result ? `<b class="num ${x.critical ? 'v-bad' : ''}">${esc(x.result.value)}</b> <span class="xs muted">${esc(x.result.unit)} (${esc(x.result.ref)})</span>${x.amended ? '<br><span class="pill par">معدّلة</span>' : ''}` : '—'}${x.critical ? `<br>${x.ackBy ? `<span class="pill ok">أقر: ${esc(EM.REF.userName(x.ackBy))}</span>` : '<span class="pill bad">حرجة — بلا إقرار</span>'}` : ''}</td>
            <td class="actions">${labActions(x)}</td></tr>`; }).join('')}
        </tbody></table></div>`;
      }
      ui.bind(el, {
        stage: (b) => { vs.stage = b.dataset.s; this.render(el); },
        q: EM.debounce((i) => { vs.q = i.value; el.querySelector('#lt').innerHTML = table(s.lab.filter((x) => (!vs.stage || x.stage === vs.stage) && EM.match(vs.q, store.patientName(x.patientId), x.id))); }, 150),
        adv: (b) => {
          const x = s.lab.find((y) => y.id === b.dataset.id);
          const to = b.dataset.to;
          const perm = to === 'verified' ? 'lab.verify' : 'lab.process';
          if (!store.guard(perm, to === 'verified' ? 'اعتماد نتيجة' : 'تشغيل العينات')) return;
          if (to === 'resulted') return resultModal(x, () => this.render(el));
          const apply = () => {
            const before = x.stage;
            x.stage = to; x.rejected = null;
            if (to === 'verified') EM.H.labReleased(x);
            store.audit(`نقل طلب معمل إلى ${ui.statusText('lab', to)}`, 'lab', x.id, { before, after: to });
            store.commit('lab'); this.render(el);
          };
          if (to === 'verified' && x.resultedBy === store.user().id) return store.breakGlass('النتيجة تُعتمد من شخص غير الذي أدخلها', apply);
          apply();
        },
        reject: (b) => {
          if (!store.guard('lab.process', 'رفض عينة')) return;
          const x = s.lab.find((y) => y.id === b.dataset.id);
          ui.confirm({ title: 'رفض العينة', message: 'ستعود الحالة إلى «مطلوب» وتُنشأ مهمة إعادة سحب للتمريض دون رسوم إضافية.', reason: true, danger: true, confirm: 'رفض العينة', onOk: (r) => {
            x.stage = 'ordered'; x.rejected = `مرفوضة: ${r}`; x.recollects = (x.recollects || 0) + 1;
            if (x.recollects >= 2) store.notify('warn', 'رفض متكرر للعينة', `${x.id} — إبلاغ الطبيب ومدير الجودة`, '#/lab');
            store.audit('رفض عينة', 'lab', x.id, { reason: r });
            store.commit('lab'); this.render(el);
          } });
        },
        ack: (b) => {
          if (!store.guard('clinic.consult', 'إقرار نتيجة حرجة')) return;
          const x = s.lab.find((y) => y.id === b.dataset.id);
          x.ackBy = store.user().id; x.ackAt = new Date().toISOString();
          store.audit('إقرار نتيجة حرجة', 'lab', x.id);
          store.commit('lab'); ui.toast('تم تسجيل الإقرار', 'ok'); this.render(el);
        },
        amend: (b) => {
          if (!store.guard('lab.verify', 'تعديل نتيجة معتمدة')) return;
          const x = s.lab.find((y) => y.id === b.dataset.id);
          ui.modal({
            title: 'تعديل نتيجة معتمدة', body: `<p class="small muted">لا تُستبدل النتيجة الأصلية — يُنشأ تعديل مرتبط بها ويُبلغ من اطلع عليها.</p><div class="field"><label for="am-v">القيمة المعدلة</label><input id="am-v" class="input" value="${esc(x.result?.value || '')}"></div><div class="field"><label for="am-r">السبب</label><input id="am-r" class="input"></div>`,
            foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>حفظ التعديل</button>',
            onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => {
              const r = m.querySelector('#am-r').value.trim();
              if (!r) { ui.toast('اكتب سبب التعديل', 'warn'); return; }
              const before = EM.clone(x.result);
              x.history = [...(x.history || []), before];
              x.result.value = m.querySelector('#am-v').value; x.amended = true;
              store.audit('تعديل نتيجة معتمدة', 'lab', x.id, { before, after: x.result, reason: r });
              store.commit('lab'); close(); this.render(el);
            }),
          });
        },
      });
    },
  };

  function labActions(x) {
    const b = (to, t, cls = 'primary') => `<button class="btn sm ${cls}" data-action="adv" data-id="${x.id}" data-to="${to}">${t}</button>`;
    let h = '';
    switch (x.stage) {
      case 'ordered': h = b('collected', 'تم السحب'); break;
      case 'collected': h = `${b('received', 'استلام')} <button class="btn sm danger" data-action="reject" data-id="${x.id}">رفض</button>`; break;
      case 'received': h = b('in_process', 'بدء التشغيل'); break;
      case 'in_process': h = b('resulted', 'إدخال النتيجة'); break;
      case 'resulted': h = b('verified', 'اعتماد وإصدار'); break;
      case 'verified': h = `<button class="btn sm ghost" data-action="amend" data-id="${x.id}">تعديل</button>`; break;
    }
    if (x.critical && x.stage === 'verified' && !x.ackBy) h = `<button class="btn sm danger solid" data-action="ack" data-id="${x.id}">إقرار الطبيب</button> ${h}`;
    return h;
  }

  function resultModal(x, done) {
    const t = EM.REF.labTests.find((y) => y.code === x.test);
    ui.modal({
      title: `إدخال نتيجة — ${t.name}`,
      body: `<div class="form-grid"><div class="field"><label for="r-v">النتيجة</label><input id="r-v" class="input"></div><div class="field"><label for="r-u">الوحدة</label><input id="r-u" class="input"></div><div class="field"><label for="r-ref">المعدل الطبيعي</label><input id="r-ref" class="input"></div>
        <div class="field" style="justify-content:flex-end"><label class="check"><input type="checkbox" id="r-c"> القيمة ضمن الحدود الحرجة المعتمدة</label></div>
        <div class="field full"><label class="check"><input type="checkbox" id="r-qc" checked> اجتاز ضبط الجودة للجهاز</label></div></div>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>حفظ النتيجة</button>',
      onMount(m, close) {
        m.querySelector('[data-ok]').addEventListener('click', () => {
          const v = m.querySelector('#r-v').value.trim();
          if (!v) { ui.toast('أدخل قيمة النتيجة', 'warn'); return; }
          if (!m.querySelector('#r-qc').checked) { ui.toast('لا يمكن الإصدار قبل اجتياز ضبط الجودة — الطلب يبقى قيد التشغيل', 'bad'); return; }
          x.result = { value: v, unit: m.querySelector('#r-u').value, ref: m.querySelector('#r-ref').value };
          x.critical = m.querySelector('#r-c').checked;
          x.stage = 'resulted'; x.resultedBy = store.user().id;
          store.audit('إدخال نتيجة تحليل', 'lab', x.id, { after: x.result });
          store.commit('lab'); close(); ui.toast('أُرسلت النتيجة للاعتماد', 'ok'); done();
        });
      },
    });
  }

  /* ================= الأشعة ================= */
  EM.views.radiology = {
    title: () => 'الأشعة',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('rad', { stage: '' });
      const rows = s.rad.filter((x) => !vs.stage || x.stage === vs.stage);
      el.innerHTML = `<div class="page">
        ${ui.pageHead('قائمة عمل الأشعة', 'الجدولة، فحص السلامة، التصوير، كتابة التقرير واعتماده. يمكن الربط مستقبلاً مع أنظمة PACS/RIS.')}
        <section class="panel">${stepper(RAD_FLOW, s.rad, vs.stage, 'rad')}
          ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الطلب</th><th>المريض</th><th>الفحص</th><th>الدواعي</th><th>الموعد</th><th>المرحلة</th><th></th></tr></thead><tbody>
          ${rows.map((x) => { const st = EM.REF.imaging.find((y) => y.code === x.study); return `<tr>
            <td class="num small">${esc(x.id)}<br>${prioPill(x.priority)}</td><td>${ui.patientCell(x.patientId)}</td>
            <td class="small">${esc(st.name)}<br><span class="xs muted">${esc(st.modality)}${x.contrast ? ' · بالصبغة' : ''}</span>${x.screening ? `<br><span class="pill warn">${esc(x.screening)}</span>` : ''}</td>
            <td class="small">${esc(x.indication)}</td><td class="small num">${fmt.time(x.scheduledAt)}</td>
            <td>${ui.pill('rad', x.stage)}${x.critical ? '<br><span class="pill bad">نتيجة حرجة</span>' : ''}</td>
            <td class="actions">${radActions(x)}</td></tr>`; }).join('')}
          </tbody></table></div>` : ui.empty('لا توجد طلبات في هذه المرحلة', '', '', 'scan')}
        </section></div>`;
      ui.bind(el, {
        stage: (b) => { vs.stage = b.dataset.s; this.render(el); },
        adv: (b) => {
          const x = s.rad.find((y) => y.id === b.dataset.id);
          const to = b.dataset.to;
          if (['reported', 'verified'].includes(to) && !store.guard('rad.report', 'تقرير الأشعة')) return;
          if (!['reported', 'verified'].includes(to) && !store.guard('rad.view', 'تشغيل الأشعة')) return;
          const go = (extra) => {
            const before = x.stage; x.stage = to; Object.assign(x, extra || {});
            if (to === 'verified') EM.H.radReleased(x);
            store.audit(`نقل طلب أشعة إلى ${ui.statusText('rad', to)}`, 'rad', x.id, { before, after: to });
            store.commit('rad'); this.render(el);
          };
          if (to === 'acquired' && x.screening) return ui.confirm({ title: 'فحص السلامة', message: `${esc(x.screening)}. هل تم الفحص والحصول على الموافقة؟`, confirm: 'نعم، تم الفحص', onOk: () => go() });
          if (to === 'reported') return ui.modal({
            title: 'تقرير الأشعة', body: `<div class="field"><label for="rr">النتائج والانطباع</label><textarea id="rr" class="input" rows="5">${esc(x.report || '')}</textarea></div><label class="check"><input type="checkbox" id="rc"> نتيجة حرجة تستوجب إبلاغاً فورياً</label>`,
            foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>حفظ التقرير</button>',
            onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => { const r = m.querySelector('#rr').value.trim(); if (!r) { ui.toast('اكتب التقرير', 'warn'); return; } close(); go({ report: r, critical: m.querySelector('#rc').checked }); }),
          });
          go();
        },
      });
    },
  };

  function radActions(x) {
    const b = (to, t) => `<button class="btn sm primary" data-action="adv" data-id="${x.id}" data-to="${to}">${t}</button>`;
    return { ordered: b('scheduled', 'جدولة'), scheduled: b('acquired', 'تم التصوير'), acquired: b('reported', 'كتابة التقرير'), reported: b('verified', 'اعتماد'), verified: '<span class="xs muted">متاح في الملف</span>' }[x.stage] || '';
  }
})();
