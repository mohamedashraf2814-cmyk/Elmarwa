/* لوحة التمريض: المهام المجدولة، العلامات الحيوية، التسليم بين المناوبات */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;

  EM.views.nursing = {
    title: () => 'التمريض',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('nursing', { ward: '' });
      if (!s.handovers) s.handovers = [{ id: 'HO-1', ward: 'W-MED', at: new Date(Date.now() - 6 * 36e5).toISOString(), by: 'u_nur', text: 'سرير 4: ارتفاع حرارة ليلاً، تمت المتابعة مع الطبيب المناوب. سرير 9: جاهز للخروج صباحاً بانتظار ملخص الخروج.' }];
      const tasks = s.nursing.filter((t) => !vs.ward || t.bed.startsWith(vs.ward)).sort((a, b) => (a.status === b.status ? a.due.localeCompare(b.due) : a.status === 'pending' ? -1 : 1));
      const pending = tasks.filter((t) => t.status === 'pending');
      const late = pending.filter((t) => new Date(t.due) < new Date());

      el.innerHTML = `<div class="page">
        ${ui.pageHead('التمريض', 'المهام المجدولة لكل سرير مع التنبيه عند التأخير، وتسليم واستلام المناوبة.')}
        <div class="grid c4">
          ${ui.kpi('مهام مفتوحة', pending.length)}
          ${ui.kpi('متأخرة', late.length, 'تُصعّد لمدير القسم بعد 30 دقيقة', late.length ? 'down' : 'up')}
          ${ui.kpi('منجزة في المناوبة', tasks.filter((t) => t.status === 'done').length)}
          ${ui.kpi('مرضى بخطر السقوط', s.patients.filter((p) => p.alerts.includes('خطر السقوط') && s.beds.some((b) => b.patientId === p.id)).length)}
        </div>
        <div class="grid c-2-1">
          <section class="panel">
            <div class="toolbar"><select class="input" data-change="ward" aria-label="الجناح"><option value="">كل الأجنحة</option>${ui.options(EM.REF.wards.map((w) => [w.id, w.name]), vs.ward)}</select></div>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الموعد</th><th>المريض / السرير</th><th>المهمة</th><th>الأولوية</th><th></th></tr></thead><tbody>
              ${tasks.map((t) => { const over = t.status === 'pending' && new Date(t.due) < new Date(); return `<tr>
                <td><span class="num small ${over ? 'v-bad' : ''}">${fmt.time(t.due)}</span>${over ? `<br><span class="pill bad">متأخرة ${fmt.minutes(EM.minsSince(t.due))}</span>` : ''}</td>
                <td>${ui.patientCell(t.patientId)}<span class="xs muted num">${esc(t.bed)}</span></td>
                <td class="small">${esc(t.task)}</td>
                <td>${t.priority === 'عالية' ? '<span class="pill bad">عالية</span>' : '<span class="pill plain">عادية</span>'}</td>
                <td class="actions">${t.status === 'pending' ? `${t.task.includes('العلامات') ? `<button class="btn sm" data-action="vitals" data-id="${t.id}">تسجيل القراءات</button>` : ''} <button class="btn sm primary" data-action="done" data-id="${t.id}">${icon('check', 'sm')} تم</button>` : ui.pill('task', 'done')}</td></tr>`; }).join('')}
            </tbody></table></div>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>تسليم المناوبة</h2></div>
            <div class="panel-body stack">
              <div class="field"><label for="ho">ملاحظات التسليم (الحالة، الخلفية، التقييم، التوصية)</label><textarea id="ho" class="input" rows="4"></textarea></div>
              <button class="btn primary" data-action="handover">${icon('send')} حفظ التسليم</button>
            </div>
            <ul class="list">${s.handovers.map((h) => `<li><div class="grow"><div class="xs muted">${esc(EM.REF.userName(h.by))} · ${fmt.dateTime(h.at)}</div><div class="small">${esc(h.text)}</div></div></li>`).join('')}</ul>
          </section>
        </div></div>`;

      ui.bind(el, {
        ward: (sel) => { vs.ward = sel.value; this.render(el); },
        done: (b) => {
          if (!store.guard('nursing.tasks', 'إنجاز مهمة تمريضية')) return;
          const t = s.nursing.find((x) => x.id === b.dataset.id);
          t.status = 'done'; t.doneBy = store.user().id; t.doneAt = new Date().toISOString();
          store.audit('إنجاز مهمة تمريضية', 'nursing', t.id);
          store.commit('nursing'); this.render(el);
        },
        vitals: (b) => {
          if (!store.guard('nursing.tasks', 'تسجيل العلامات الحيوية')) return;
          const t = s.nursing.find((x) => x.id === b.dataset.id);
          ui.modal({
            title: `العلامات الحيوية — ${store.patientName(t.patientId)}`,
            body: `<div class="form-grid">${[['hr', 'النبض'], ['bp', 'الضغط'], ['temp', 'الحرارة'], ['spo2', 'الأكسجين %'], ['pain', 'الألم (0–10)']].map(([k, l]) => `<div class="field"><label for="v-${k}">${l}</label><input id="v-${k}" class="input num"></div>`).join('')}</div>`,
            foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>حفظ</button>',
            onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => {
              const temp = Number(m.querySelector('#v-temp').value);
              const spo2 = Number(m.querySelector('#v-spo2').value);
              t.status = 'done'; t.doneBy = store.user().id;
              store.audit('تسجيل علامات حيوية', 'nursing', t.id);
              if (temp >= 38.5 || (spo2 && spo2 < 92)) store.notify('bad', 'قراءة خارج المعدل', `${store.patientName(t.patientId)} — إبلاغ الطبيب المعالج`, '#/nursing');
              store.commit('nursing'); close(); ui.toast('تم الحفظ', 'ok'); this.render(el);
            }),
          });
        },
        handover: () => {
          const text = el.querySelector('#ho').value.trim();
          if (!text) { ui.toast('اكتب ملاحظات التسليم', 'warn'); return; }
          s.handovers.unshift({ id: EM.uid('HO'), ward: vs.ward || 'all', at: new Date().toISOString(), by: store.user().id, text });
          store.audit('تسليم مناوبة', 'handover', vs.ward || 'all');
          store.commit('nursing'); ui.toast('تم حفظ التسليم', 'ok'); this.render(el);
        },
      });
    },
  };
})();
