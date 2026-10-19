/* المخزون والمستلزمات وطلبات الشراء */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;
  const itemName = (code) => EM.REF.drugs.find((d) => d.code === code)?.name || store.state.supplies.find((x) => x.code === code)?.name || code;

  EM.views.inventory = {
    title: () => 'المخزون',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('inv', { tab: 'stock' });
      const items = [...EM.REF.drugs.map((d) => ({ ...d, cat: 'دواء', unit: d.form, ref: d })), ...s.supplies.map((x) => ({ ...x, cat: 'مستلزم', ref: x }))];
      const low = items.filter((i) => i.stock < i.min);
      el.innerHTML = `<div class="page">
        ${ui.pageHead('المخزون والمستلزمات', 'كل صرف أو استلام حركة مخزون موثقة. الأصناف تحت الحد الأدنى تولّد طلب شراء.')}
        ${low.length ? `<div class="callout warn">${icon('alert')}<span><b class="num">${low.length}</b> صنف تحت الحد الأدنى: ${low.map((i) => esc(i.name)).join('، ')}</span></div>` : ''}
        <section class="panel">
          <div class="tabs">${[['stock', 'الأرصدة'], ['moves', 'حركات المخزون'], ['pr', `طلبات الشراء (${s.purchaseRequests.length})`]].map(([k, t]) => `<button class="${vs.tab === k ? 'on' : ''}" data-action="tab" data-t="${k}">${t}</button>`).join('')}</div>
          ${vs.tab === 'stock' ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الكود</th><th>الصنف</th><th>الفئة</th><th>الرصيد</th><th>الحد الأدنى</th><th>المستوى</th><th></th></tr></thead><tbody>
            ${items.map((i) => { const p = Math.min(100, Math.round((i.stock / (i.min * 3)) * 100)); return `<tr><td class="num small">${esc(i.code)}</td><td class="small">${esc(i.name)}${i.controlled ? ' <span class="pill par">مراقب</span>' : ''}</td><td class="small">${esc(i.cat)}</td><td class="num ${i.stock < i.min ? 'v-bad' : ''}">${fmt.int(i.stock)} <span class="xs muted">${esc(i.unit)}</span></td><td class="num small">${fmt.int(i.min)}</td><td style="min-width:120px"><div class="meter ${i.stock < i.min ? 'bad' : p < 50 ? 'warn' : ''}"><span style="width:${p}%"></span></div></td>
              <td class="actions">${i.stock < i.min && !s.purchaseRequests.some((r) => r.item === i.code && !r.received) ? `<button class="btn sm primary" data-action="pr" data-c="${esc(i.code)}">طلب شراء</button>` : ''}</td></tr>`; }).join('')}
          </tbody></table></div>`
          : vs.tab === 'moves' ? `<table class="tbl"><thead><tr><th>الوقت</th><th>الصنف</th><th>النوع</th><th>الكمية</th><th>المرجع</th><th>بواسطة</th></tr></thead><tbody>${s.stockMoves.map((m) => `<tr><td class="small">${fmt.dateTime(m.at)}</td><td class="small">${esc(itemName(m.item))}</td><td class="small">${esc(m.type)}</td><td class="num ${m.qty < 0 ? 'v-bad' : ''}">${m.qty > 0 ? '+' : ''}${m.qty}</td><td class="small">${esc(m.ref)}${m.witness ? `<br><span class="xs muted">شاهد: ${esc(m.witness)}</span>` : ''}</td><td class="small">${esc(EM.REF.userName(m.by))}</td></tr>`).join('')}</tbody></table>`
          : `<table class="tbl"><thead><tr><th>الطلب</th><th>الصنف</th><th>الكمية</th><th>الحالة</th><th>بواسطة</th><th></th></tr></thead><tbody>${s.purchaseRequests.map((r) => `<tr><td class="num small">${esc(r.id)}</td><td class="small">${esc(itemName(r.item))}</td><td class="num">${r.qty}</td><td class="small">${esc(r.status)}</td><td class="small">${esc(r.by === 'system' ? 'آلي (نقص مخزون)' : EM.REF.userName(r.by))}<br><span class="xs muted">${fmt.ago(r.at)}</span></td>
            <td class="actions">${r.status === 'بانتظار الاعتماد' ? `<button class="btn sm primary" data-action="approve" data-id="${esc(r.id)}">اعتماد</button>` : !r.received ? `<button class="btn sm" data-action="receive" data-id="${esc(r.id)}">استلام</button>` : '<span class="pill ok">مستلم</span>'}</td></tr>`).join('')}</tbody></table>`}
        </section></div>`;

      const find = (code) => EM.REF.drugs.find((d) => d.code === code) || s.supplies.find((x) => x.code === code);
      ui.bind(el, {
        tab: (b) => { vs.tab = b.dataset.t; this.render(el); },
        pr: (b) => {
          if (!store.guard('inventory.manage', 'طلب شراء')) return;
          const it = find(b.dataset.c);
          s.purchaseRequests.unshift({ id: EM.uid('PR'), item: it.code, qty: it.min * 2, status: 'بانتظار الاعتماد', by: store.user().id, at: new Date().toISOString() });
          store.audit('إنشاء طلب شراء', 'purchase', it.code); store.commit('inventory'); ui.toast('أُنشئ طلب الشراء', 'ok'); this.render(el);
        },
        approve: (b) => {
          const r = s.purchaseRequests.find((x) => x.id === b.dataset.id);
          if (!store.can('inventory.manage') && !store.can('workflows.publish')) { store.guard('inventory.manage', 'اعتماد طلب شراء'); return; }
          if (r.by === store.user().id) { ui.toast('فصل المهام: لا يعتمد مقدم الطلب طلبه', 'bad'); store.audit('رفض: اعتماد ذاتي لطلب شراء', 'purchase', r.id, { result: 'denied' }); return; }
          r.status = 'معتمد — لدى المورد'; store.audit('اعتماد طلب شراء', 'purchase', r.id); store.commit('inventory'); this.render(el);
        },
        receive: (b) => {
          if (!store.guard('inventory.manage', 'استلام مخزون')) return;
          const r = s.purchaseRequests.find((x) => x.id === b.dataset.id);
          const it = find(r.item);
          it.stock += r.qty; r.received = true; r.status = 'مستلم';
          s.stockMoves.unshift({ id: EM.uid('SM'), item: r.item, type: 'استلام', qty: r.qty, by: store.user().id, at: new Date().toISOString(), ref: r.id });
          s.rx.filter((x) => x.drug === r.item && x.status === 'waiting_stock').forEach((x) => { x.status = 'verified'; });
          store.audit('استلام مخزون', 'purchase', r.id, { after: { stock: it.stock } }); store.commit('inventory'); ui.toast('تم الاستلام وتحديث الرصيد', 'ok'); this.render(el);
        },
      });
    },
  };
})();
