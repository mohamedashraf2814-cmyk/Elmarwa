/* الحسابات والتأمين: الفواتير، المدفوعات، الاسترداد بفصل المهام، المطالبات */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;
  const insName = (id) => EM.REF.insurers.find((i) => i.id === id)?.name || '—';
  const due = (inv) => inv.patientShare - inv.paid - inv.adjustments.reduce((a, x) => a + x.amount, 0);

  EM.views.billing = {
    title: () => 'الحسابات والتأمين',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('billing', { tab: 'invoices', st: '', page: 1 });
      const outstanding = s.invoices.reduce((a, i) => a + Math.max(0, due(i)), 0);
      const pendingRefunds = s.refunds.filter((r) => r.status === 'pending');
      const rejected = s.claims.filter((c) => c.status === 'rejected');
      el.innerHTML = `<div class="page">
        ${ui.pageHead('الحسابات والتأمين', 'الطلبات السريرية منفصلة عن الحركات المالية. لا يُحذف قيد مُرحّل — التصحيح بقيد عكسي أو تسوية موثقة.')}
        <div class="grid c4">
          ${ui.kpi('إجمالي الفواتير', fmt.money(s.invoices.reduce((a, i) => a + i.total, 0)), `${s.invoices.length} فاتورة`)}
          ${ui.kpi('المستحق على المرضى', fmt.money(outstanding), '', outstanding ? 'down' : '')}
          ${ui.kpi('طلبات استرداد بانتظار الاعتماد', pendingRefunds.length)}
          ${ui.kpi('مطالبات مرفوضة', rejected.length, 'تحتاج تصحيحاً وإعادة إرسال', rejected.length ? 'down' : '')}
        </div>
        <section class="panel">
          <div class="tabs">${[['invoices', 'الفواتير'], ['refunds', `الاسترداد (${pendingRefunds.length})`], ['claims', 'مطالبات التأمين'], ['payments', 'المدفوعات']].map(([k, t]) => `<button class="${vs.tab === k ? 'on' : ''}" data-action="tab" data-t="${k}">${t}</button>`).join('')}</div>
          ${vs.tab === 'invoices' ? invoices(s, vs) : vs.tab === 'refunds' ? refunds(s) : vs.tab === 'claims' ? claims(s) : payments(s)}
        </section></div>`;

      ui.bind(el, {
        tab: (b) => { vs.tab = b.dataset.t; vs.page = 1; this.render(el); },
        st: (sel) => { vs.st = sel.value; vs.page = 1; this.render(el); },
        page: (b) => { vs.page = Number(b.dataset.page); this.render(el); },
        inv: (b) => invoiceModal(s.invoices.find((i) => i.id === b.dataset.id), () => this.render(el)),
        refund: (b) => {
          const r = s.refunds.find((x) => x.id === b.dataset.id);
          const ok = b.dataset.ok === '1';
          if (!store.guard('billing.refund.approve', 'اعتماد الاسترداد')) return;
          if (r.requestedBy === store.user().id && !b.dataset.bg) { store.breakGlass('لا يعتمد مقدم طلب الاسترداد طلبه', () => { b.dataset.bg = '1'; b.click(); delete b.dataset.bg; }); return; }
          if (ok && r.amount > 5000 && !['hadmin', 'owner'].includes(store.session.role)) { ui.toast('المبالغ أكبر من 5,000 ج.م تحتاج اعتماد مدير المستشفى', 'warn'); return; }
          ui.confirm({ title: ok ? 'اعتماد الاسترداد' : 'رفض الاسترداد', message: ok ? `سيتم ترحيل قيد عكسي بمبلغ ${fmt.money(r.amount)}.` : 'سبب الرفض إلزامي.', reason: !ok, danger: !ok, confirm: ok ? 'اعتماد' : 'رفض', onOk: (why) => {
            r.status = ok ? 'approved' : 'rejected'; r.decidedBy = store.user().id; r.reason2 = why;
            if (ok) { const inv = s.invoices.find((i) => i.id === r.invoiceId); inv.adjustments.push({ id: EM.uid('ADJ'), amount: -r.amount, kind: 'استرداد', at: new Date().toISOString(), by: store.user().id, ref: r.id }); }
            store.audit(ok ? 'اعتماد استرداد' : 'رفض استرداد', 'refund', r.id, { reason: why });
            store.commit('billing'); this.render(el);
          } });
        },
        claim: (b) => {
          if (!store.guard('insurance.claims', 'إعادة إرسال مطالبة')) return;
          const c = s.claims.find((x) => x.id === b.dataset.id);
          ui.confirm({ title: 'إعادة إرسال المطالبة', message: `سبب الرفض: ${esc(c.reason)}. اكتب ما تم تصحيحه أو إرفاقه.`, reason: true, confirm: 'إعادة الإرسال', onOk: (why) => {
            c.status = 'resubmitted'; c.fix = why; c.at = new Date().toISOString();
            store.audit('إعادة إرسال مطالبة تأمين', 'claim', c.id, { reason: why });
            store.commit('billing'); this.render(el);
          } });
        },
      });
    },
  };

  function invoices(s, vs) {
    const rows = s.invoices.filter((i) => !vs.st || i.status === vs.st).sort((a, b) => b.at.localeCompare(a.at));
    const pg = EM.paginate(rows, vs.page, 10);
    return `<div class="toolbar"><select class="input" data-change="st" aria-label="الحالة"><option value="">كل الحالات</option>${ui.options(Object.keys({ draft: 1, posted: 1, partial: 1, paid: 1 }).map((k) => [k, ui.statusText('inv', k)]), vs.st)}</select></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الفاتورة</th><th>المريض</th><th>التأمين</th><th>الإجمالي</th><th>حصة التأمين</th><th>المتبقي على المريض</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${pg.rows.map((i) => `<tr><td class="num small">${esc(i.id)}<br><span class="xs muted">${fmt.dateShort(i.at)}</span></td><td>${ui.patientCell(i.patientId)}</td><td class="small">${esc(insName(i.insurer))}</td>
        <td class="num">${fmt.money(i.total)}</td><td class="num small">${fmt.money(i.insShare)}</td><td class="num ${due(i) > 0 ? 'v-bad' : ''}">${fmt.money(Math.max(0, due(i)))}</td>
        <td>${ui.pill('inv', i.status)}</td><td class="actions"><button class="btn sm" data-action="inv" data-id="${esc(i.id)}">فتح</button></td></tr>`).join('')}
      </tbody></table></div>${ui.pager(pg)}`;
  }

  function refunds(s) {
    return `<div class="panel-body"><div class="callout">${icon('lock')}<span>فصل المهام: مقدم طلب الاسترداد لا يستطيع اعتماده. المبالغ الأكبر من 5,000 ج.م تحتاج اعتماداً ثانياً من مدير المستشفى.</span></div></div>
      <table class="tbl"><thead><tr><th>الطلب</th><th>الفاتورة</th><th>المبلغ</th><th>السبب</th><th>مقدم الطلب</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${s.refunds.map((r) => `<tr><td class="num small">${esc(r.id)}</td><td class="num small">${esc(r.invoiceId)}</td><td class="num">${fmt.money(r.amount)}</td><td class="small">${esc(r.reason)}</td><td class="small">${esc(EM.REF.userName(r.requestedBy))}<br><span class="xs muted">${fmt.ago(r.at)}</span></td><td>${ui.pill('refund', r.status)}${r.decidedBy ? `<br><span class="xs muted">${esc(EM.REF.userName(r.decidedBy))}</span>` : ''}</td>
        <td class="actions">${r.status === 'pending' ? `<button class="btn sm primary" data-action="refund" data-id="${r.id}" data-ok="1">اعتماد</button> <button class="btn sm danger" data-action="refund" data-id="${r.id}" data-ok="0">رفض</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
  }

  function claims(s) {
    return `<table class="tbl"><thead><tr><th>المطالبة</th><th>الجهة</th><th>الفاتورة</th><th>المبلغ</th><th>الحالة</th><th>ملاحظات</th><th></th></tr></thead><tbody>
      ${s.claims.map((c) => `<tr><td class="num small">${esc(c.id)}</td><td class="small">${esc(insName(c.insurer))}</td><td class="num small">${esc(c.invoiceId)}</td><td class="num">${fmt.money(c.amount)}</td><td>${ui.pill('claim', c.status)}</td><td class="small">${esc(c.reason || c.fix || '—')}</td>
        <td class="actions">${c.status === 'rejected' ? `<button class="btn sm primary" data-action="claim" data-id="${c.id}">تصحيح وإعادة إرسال</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
  }

  function payments(s) {
    return `<table class="tbl"><thead><tr><th>الدفعة</th><th>الفاتورة</th><th>المبلغ</th><th>الطريقة</th><th>بواسطة</th><th>الوقت</th></tr></thead><tbody>
      ${s.payments.slice().sort((a, b) => b.at.localeCompare(a.at)).map((p) => `<tr><td class="num small">${esc(p.id)}</td><td class="num small">${esc(p.invoiceId)}</td><td class="num">${fmt.money(p.amount)}</td><td class="small">${esc(p.method)}</td><td class="small">${esc(EM.REF.userName(p.by))}</td><td class="small">${fmt.dateTime(p.at)}</td></tr>`).join('')}</tbody></table>`;
  }

  function invoiceModal(inv, done) {
    const s = store.state;
    const remaining = Math.max(0, due(inv));
    const idem = EM.uid('idem');
    ui.modal({
      title: `فاتورة ${inv.id}`, wide: true,
      body: `<div class="row between wrap">${ui.patientCell(inv.patientId)}${ui.pill('inv', inv.status)}</div>
        <table class="tbl"><thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
          ${inv.items.map((it) => `<tr><td class="small">${esc(it.name)}</td><td class="num">${it.qty}</td><td class="num">${fmt.money(it.price)}</td><td class="num">${fmt.money(it.qty * it.price)}</td></tr>`).join('')}
          ${inv.adjustments.map((a) => `<tr><td class="small">${esc(a.kind)} <span class="xs muted">(${esc(EM.REF.userName(a.by))})</span></td><td></td><td></td><td class="num v-bad">${fmt.money(a.amount)}</td></tr>`).join('')}
        </tbody></table>
        <dl class="dl inline"><dt>الإجمالي</dt><dd class="num">${fmt.money(inv.total)}</dd><dt>حصة ${esc(insName(inv.insurer))}</dt><dd class="num">${fmt.money(inv.insShare)}</dd><dt>حصة المريض</dt><dd class="num">${fmt.money(inv.patientShare)}</dd><dt>المدفوع</dt><dd class="num">${fmt.money(inv.paid)}</dd><dt>المتبقي</dt><dd class="num"><b>${fmt.money(remaining)}</b></dd></dl>
        ${remaining > 0 ? `<div class="form-grid"><div class="field"><label for="pay-a">مبلغ الدفعة</label><input id="pay-a" class="input num" type="number" min="1" max="${remaining}" value="${remaining}"></div><div class="field"><label for="pay-m">الطريقة</label><select id="pay-m" class="input"><option>نقدي</option><option>بطاقة</option><option>محفظة إلكترونية</option></select></div></div>
          <p class="xs muted">مفتاح عدم التكرار <span class="num">${esc(idem)}</span> يمنع تسجيل نفس الدفعة مرتين عند الضغط المزدوج أو إعادة المحاولة.</p>` : ''}`,
      foot: `<button class="btn" data-close="1">إغلاق</button>
        ${store.can('billing.refund.request') && inv.paid > 0 ? '<button class="btn" data-refund>طلب استرداد</button>' : ''}
        ${remaining > 0 ? '<button class="btn primary" data-pay>تسجيل الدفعة</button>' : ''}`,
      onMount(m, close) {
        const seen = new Set(s.payments.map((p) => p.idem).filter(Boolean));
        m.querySelector('[data-pay]')?.addEventListener('click', () => {
          if (!store.guard('billing.post', 'تسجيل دفعة')) return;
          if (seen.has(idem)) { ui.toast('تم تسجيل هذه الدفعة بالفعل — تجاهل التكرار', 'warn'); return; }
          const amt = Number(m.querySelector('#pay-a').value);
          if (!(amt > 0) || amt > remaining) { ui.toast('المبلغ غير صحيح', 'warn'); return; }
          seen.add(idem);
          s.payments.push({ id: EM.uid('PAY'), invoiceId: inv.id, amount: amt, method: m.querySelector('#pay-m').value, at: new Date().toISOString(), by: store.user().id, idem });
          inv.paid += amt;
          inv.status = due(inv) <= 0 ? 'paid' : 'partial';
          store.audit('تسجيل دفعة', 'invoice', inv.id, { after: { amount: amt } });
          store.commit('billing'); close(); ui.toast(`تم تسجيل ${fmt.money(amt)}`, 'ok'); done();
        });
        m.querySelector('[data-refund]')?.addEventListener('click', () => {
          close();
          ui.modal({
            title: 'طلب استرداد', body: `<div class="field"><label for="rf-a">المبلغ</label><input id="rf-a" type="number" class="input num" max="${inv.paid}" value="${Math.min(inv.paid, 350)}"></div><div class="field"><label for="rf-r">السبب</label><input id="rf-r" class="input"></div>`,
            foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>إرسال للاعتماد</button>',
            onMount: (m2, close2) => m2.querySelector('[data-ok]').addEventListener('click', () => {
              const a = Number(m2.querySelector('#rf-a').value); const r = m2.querySelector('#rf-r').value.trim();
              if (!(a > 0) || a > inv.paid || !r) { ui.toast('أدخل مبلغاً صحيحاً وسبباً', 'warn'); return; }
              const req = { id: EM.uid('RF'), invoiceId: inv.id, amount: a, reason: r, requestedBy: store.user().id, at: new Date().toISOString(), status: 'pending' };
              s.refunds.unshift(req);
              const inst = store.startInstance('wf_refund', { amount: a });
              if (inst) { inst.requestedBy = store.user().id; inst.ref = inv.id; }
              store.audit('طلب استرداد', 'refund', req.id, { reason: r });
              store.notify('info', 'طلب اعتماد', `استرداد ${fmt.money(a)} بانتظار محاسب آخر`, '#/billing');
              store.commit('billing'); close2(); ui.toast('أُرسل الطلب لمحاسب آخر للاعتماد', 'ok'); done();
            }),
          });
        });
      },
    });
  }
})();
