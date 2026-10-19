/* الصيدلية: مراجعة الوصفات، التنبيهات، الصرف وخصم المخزون، الأدوية المراقبة */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;
  const drug = (c) => EM.REF.drugs.find((d) => d.code === c);

  EM.views.pharmacy = {
    title: () => 'الصيدلية',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('rx', { tab: 'queue' });
      const queue = s.rx.filter((r) => ['on_hold', 'new', 'verified', 'waiting_stock'].includes(r.status)).sort((a, b) => (a.status === 'on_hold' ? -1 : 0) - (b.status === 'on_hold' ? -1 : 0) || a.at.localeCompare(b.at));
      const doneList = s.rx.filter((r) => ['dispensed', 'cancelled'].includes(r.status));
      const low = EM.REF.drugs.filter((d) => d.stock < d.min);
      const list = vs.tab === 'queue' ? queue : doneList;
      el.innerHTML = `<div class="page">
        ${ui.pageHead('الصيدلية', 'التنبيهات الدوائية آلية ولا تُعد قراراً سريرياً. أي تجاوز يحتاج مراجعة صيدلي وتبريراً موثقاً.')}
        <div class="grid c4">
          ${ui.kpi('وصفات بالانتظار', queue.length)}
          ${ui.kpi('معلقة لتنبيه', s.rx.filter((r) => r.status === 'on_hold').length, 'حساسية أو تداخل', 'down')}
          ${ui.kpi('صُرفت اليوم', s.rx.filter((r) => r.status === 'dispensed').length)}
          ${ui.kpi('أصناف تحت الحد الأدنى', low.length, low.map((d) => d.name.split(' ')[0]).join('، '), low.length ? 'down' : '')}
        </div>
        <div class="grid c-2-1">
          <section class="panel">
            <div class="tabs">${[['queue', `قائمة المراجعة والصرف (${queue.length})`], ['done', 'المنتهية']].map(([k, t]) => `<button class="${vs.tab === k ? 'on' : ''}" data-action="tab" data-t="${k}">${t}</button>`).join('')}</div>
            ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوصفة</th><th>المريض</th><th>الدواء</th><th>المكان</th><th>الحالة</th><th></th></tr></thead><tbody>
            ${list.map((r) => { const d = drug(r.drug); return `<tr>
              <td class="num small">${esc(r.id)}<br><span class="xs muted">${fmt.ago(r.at)}</span></td>
              <td>${ui.patientCell(r.patientId)}</td>
              <td class="small"><b style="font-weight:500">${esc(d.name)}</b>${d.controlled ? ' <span class="pill par">مراقب</span>' : ''}<br><span class="xs muted">${esc(r.dose)} · ${esc(r.route)} · ${esc(r.freq)}</span>${r.alert ? `<div class="callout bad" style="margin-top:6px;padding:6px 10px">${icon('alert', 'sm')}<span class="xs">${esc(r.alert.kind)}: ${esc(r.alert.text)}</span></div>` : ''}</td>
              <td class="small">${esc(r.location)}</td>
              <td>${ui.pill('rx', r.status)}</td>
              <td class="actions">${rxActions(r)}</td></tr>`; }).join('')}
            </tbody></table></div>` : ui.empty('لا توجد وصفات', '', '', 'pill')}
          </section>
          <section class="panel">
            <div class="panel-head"><h2>مخزون الصيدلية</h2>${store.can('inventory.view') ? '<a class="small" href="#/inventory">المخزون الكامل</a>' : ''}</div>
            <ul class="list">${EM.REF.drugs.map((d) => { const p = Math.min(100, Math.round((d.stock / (d.min * 3)) * 100)); return `<li><div class="grow"><div class="row between small"><span>${esc(d.name)}</span><b class="num ${d.stock < d.min ? 'v-bad' : ''}">${d.stock}</b></div><div class="meter ${d.stock < d.min ? 'bad' : p < 50 ? 'warn' : ''}" style="margin-top:6px"><span style="width:${p}%"></span></div></div></li>`; }).join('')}</ul>
          </section>
        </div></div>`;

      ui.bind(el, {
        tab: (b) => { vs.tab = b.dataset.t; this.render(el); },
        review: (b) => {
          if (!store.guard('pharmacy.dispense', 'مراجعة تنبيه دوائي')) return;
          const r = s.rx.find((x) => x.id === b.dataset.id);
          ui.modal({
            title: 'مراجعة الصيدلي',
            body: `<div class="callout bad">${icon('alert')}<span>${esc(r.alert.text)}</span></div><p class="small">تم التواصل مع الطبيب الواصف؟ القرار بالمتابعة أو الاستبدال سريري ويُوثق باسمك.</p><div class="field"><label for="jr">التبرير أو التوصية</label><textarea id="jr" class="input"></textarea></div>`,
            foot: '<button class="btn danger" data-no>إلغاء الوصفة وطلب بديل</button><button class="btn primary" data-yes>متابعة الصرف بتبرير</button>',
            onMount: (m, close) => {
              const j = () => m.querySelector('#jr').value.trim();
              m.querySelector('[data-yes]').addEventListener('click', () => { if (!j()) { ui.toast('التبرير إلزامي', 'warn'); return; } r.status = 'verified'; r.override = j(); store.audit('تجاوز تنبيه دوائي بتبرير', 'rx', r.id, { reason: j() }); store.commit('rx'); close(); this.render(el); });
              m.querySelector('[data-no]').addEventListener('click', () => { if (!j()) { ui.toast('اكتب السبب', 'warn'); return; } r.status = 'cancelled'; store.audit('إلغاء وصفة بعد مراجعة', 'rx', r.id, { reason: j() }); store.notify('info', 'وصفة بحاجة لبديل', `${drug(r.drug).name} — ${store.patientName(r.patientId)}`, '#/pharmacy'); store.commit('rx'); close(); this.render(el); });
            },
          });
        },
        verify: (b) => {
          if (!store.guard('pharmacy.dispense', 'مراجعة وصفة')) return;
          const r = s.rx.find((x) => x.id === b.dataset.id);
          r.status = 'verified'; store.audit('مراجعة وصفة', 'rx', r.id); store.commit('rx'); this.render(el);
        },
        dispense: (b) => {
          if (!store.guard('pharmacy.dispense', 'صرف دواء')) return;
          const r = s.rx.find((x) => x.id === b.dataset.id);
          const d = drug(r.drug);
          const qty = 1;
          if (d.stock < qty) {
            r.status = 'waiting_stock';
            s.purchaseRequests.unshift({ id: EM.uid('PR'), item: d.code, qty: d.min * 2, status: 'بانتظار الاعتماد', by: 'system', at: new Date().toISOString() });
            store.notify('warn', 'نقص مخزون', `${d.name} غير متوفر — أُنشئ طلب شراء`, '#/inventory');
            store.audit('تعليق صرف لنقص المخزون', 'rx', r.id);
            store.commit('rx'); this.render(el); return;
          }
          const finish = (witness) => {
            d.stock -= qty;
            s.stockMoves.unshift({ id: EM.uid('SM'), item: d.code, type: d.controlled ? 'صرف (مخدر — توقيع مزدوج)' : 'صرف', qty: -qty, by: store.user().id, at: new Date().toISOString(), ref: r.id, witness });
            r.status = 'dispensed';
            store.audit('صرف دواء', 'rx', r.id, { after: { stock: d.stock }, reason: witness ? `شاهد: ${witness}` : null });
            store.commit('rx'); ui.toast('تم الصرف وخصم المخزون', 'ok'); this.render(el);
          };
          if (d.controlled) {
            ui.modal({
              title: 'صرف دواء مراقب — توقيع مزدوج',
              body: `<p class="small">«${esc(d.name)}» دواء مراقب. يلزم تأكيد صيدلي أو ممرض ثانٍ.</p><div class="field"><label for="wit">الشاهد</label><select id="wit" class="input">${EM.REF.staff.filter((x) => ['pharmacist', 'nurse', 'wardmgr'].includes(x.role) && x.id !== store.user().id).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>`,
              foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>تأكيد الصرف</button>',
              onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => { close(); finish(EM.REF.userName(m.querySelector('#wit').value)); }),
            });
          } else finish(null);
        },
      });
    },
  };

  function rxActions(r) {
    switch (r.status) {
      case 'on_hold': return `<button class="btn sm danger solid" data-action="review" data-id="${r.id}">مراجعة التنبيه</button>`;
      case 'new': return `<button class="btn sm primary" data-action="verify" data-id="${r.id}">مراجعة</button>`;
      case 'verified': return `<button class="btn sm primary" data-action="dispense" data-id="${r.id}">صرف</button>`;
      case 'waiting_stock': return `<button class="btn sm" data-action="dispense" data-id="${r.id}">إعادة المحاولة</button>`;
      default: return r.override ? '<span class="xs muted">صُرفت بتبرير</span>' : '';
    }
  }
})();
