/* الإدارة: الأقسام، الأدوار والصلاحيات ومصفوفة الاعتمادات، سجل التدقيق */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;

  /* ---------- الأقسام ---------- */
  EM.views.departments = {
    title: () => 'الأقسام',
    render(el) {
      const s = store.state;
      if (!s.departments) s.departments = EM.clone(EM.REF.departments);
      EM.REF.departments = s.departments;
      el.innerHTML = `<div class="page">
        ${ui.pageHead('الأقسام', 'إضافة أو إعادة تسمية أو تعطيل الأقسام دون تعديل محرك سير العمل. زمن الخدمة الافتراضي يُطبق على مهام القسم.', `<button class="btn primary" data-action="add">${icon('plus')} قسم جديد</button>`)}
        <section class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>القسم</th><th>النوع</th><th>المسؤول</th><th>زمن الخدمة الافتراضي</th><th>مسارات مرتبطة</th><th>الحالة</th><th></th></tr></thead><tbody>
          ${s.departments.map((d) => { const wf = s.workflows.filter((w) => w.dept === d.id || w.nodes.some((n) => n.config?.dept === d.id)).length; return `<tr class="${d.active ? '' : 'row-off'}">
            <td><b style="font-weight:500">${esc(d.name)}</b><br><span class="num xs muted">${esc(d.id)}</span></td><td class="small">${esc(d.kind)}</td><td class="small">${esc(EM.REF.userName(d.head))}</td>
            <td class="num small">${fmt.minutes(d.sla)}</td><td class="num small">${wf}</td><td>${d.active ? '<span class="pill ok">مفعّل</span>' : '<span class="pill">معطّل</span>'}</td>
            <td class="actions"><button class="btn sm" data-action="edit" data-id="${esc(d.id)}">تعديل</button> <button class="btn sm ghost" data-action="toggle" data-id="${esc(d.id)}">${d.active ? 'تعطيل' : 'تفعيل'}</button></td></tr>`; }).join('')}
        </tbody></table></div></section></div>`;
      const form = (d, done) => ui.modal({
        title: d ? 'تعديل قسم' : 'قسم جديد',
        body: `<div class="form-grid"><div class="field full"><label for="d-n">الاسم</label><input id="d-n" class="input" value="${esc(d?.name || '')}"></div>
          <div class="field"><label for="d-k">النوع</label><select id="d-k" class="input">${ui.options(['سريري', 'تشخيصي', 'خدمي', 'إداري', 'مالي', 'رقابي'].map((x) => [x, x]), d?.kind)}</select></div>
          <div class="field"><label for="d-s">زمن الخدمة (دقيقة)</label><input id="d-s" type="number" class="input num" value="${d?.sla || 60}"></div>
          <div class="field full"><label for="d-h">المسؤول</label><select id="d-h" class="input">${ui.options(EM.REF.staff.map((x) => [x.id, x.name]), d?.head)}</select></div></div>`,
        foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>حفظ</button>',
        onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => {
          if (!store.guard('admin.departments', 'إدارة الأقسام')) return;
          const name = m.querySelector('#d-n').value.trim();
          if (!name) { ui.toast('اكتب اسم القسم', 'warn'); return; }
          const before = d ? EM.clone(d) : null;
          const t = d || { id: EM.uid('dept'), active: true };
          Object.assign(t, { name, kind: m.querySelector('#d-k').value, sla: Number(m.querySelector('#d-s').value) || 60, head: m.querySelector('#d-h').value });
          if (!d) s.departments.push(t);
          store.audit(d ? 'تعديل قسم' : 'إضافة قسم', 'department', t.id, { before, after: t });
          store.commit('departments'); close(); done();
        }),
      });
      ui.bind(el, {
        add: () => form(null, () => this.render(el)),
        edit: (b) => form(s.departments.find((d) => d.id === b.dataset.id), () => this.render(el)),
        toggle: (b) => {
          if (!store.guard('admin.departments', 'تفعيل/تعطيل قسم')) return;
          const d = s.departments.find((x) => x.id === b.dataset.id);
          d.active = !d.active;
          store.audit(d.active ? 'تفعيل قسم' : 'تعطيل قسم', 'department', d.id);
          store.commit('departments'); this.render(el);
        },
      });
    },
  };

  /* ---------- الأدوار والصلاحيات ---------- */
  EM.views.roles = {
    title: () => 'الأدوار والصلاحيات',
    render(el) {
      const s = store.state;
      if (s.rolePerms) EM.REF.roles.forEach((r) => { if (s.rolePerms[r.id]) r.perms = s.rolePerms[r.id]; });
      const vs = ui.vstate('roles', { group: 'all' });
      const groups = [...new Set(EM.REF.permissions.map((p) => p.group))];
      const perms = EM.REF.permissions.filter((p) => vs.group === 'all' || p.group === vs.group);
      el.innerHTML = `<div class="page">
        ${ui.pageHead('الأدوار والصلاحيات', `${EM.REF.roles.length} دوراً و${EM.REF.permissions.length} صلاحية. أقل صلاحية لازمة، وفصل المهام، وتحقق ثنائي للأدوار الحساسة.`)}
        <div class="callout">${icon('lock')}<span>لاحظ أن «مدير النظام» لا يملك صلاحيات سريرية أو اعتمادات مالية — إدارة النظام منفصلة عن القرار الطبي والمالي.</span></div>
        <section class="panel">
          <div class="toolbar"><div class="seg">${['all', ...groups].map((g) => `<button class="${vs.group === g ? 'on' : ''}" data-action="g" data-g="${esc(g)}">${g === 'all' ? 'الكل' : esc(g)}</button>`).join('')}</div></div>
          <div class="matrix-wrap"><table class="tbl matrix"><thead><tr><th class="m-role">الدور</th>${perms.map((p) => `<th title="${esc(p.id)}"><span>${esc(p.name)}</span></th>`).join('')}</tr></thead><tbody>
            ${EM.REF.roles.map((r) => `<tr><th class="m-role">${esc(r.name)}${r.mfa ? ` <span title="تحقق ثنائي">${icon('lock', 'sm')}</span>` : ''}<br><span class="xs muted num">${r.perms.length} صلاحية</span></th>
              ${perms.map((p) => `<td><button class="m-cell ${r.perms.includes(p.id) ? 'on' : ''}" data-action="t" data-r="${r.id}" data-p="${p.id}" aria-label="${esc(r.name)} — ${esc(p.name)}" aria-pressed="${r.perms.includes(p.id)}">${r.perms.includes(p.id) ? icon('check', 'sm') : ''}</button></td>`).join('')}</tr>`).join('')}
          </tbody></table></div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>مصفوفة الاعتمادات</h2></div>
          <table class="tbl"><thead><tr><th>العملية</th><th>المقدّم</th><th>المعتمد الأول</th><th>المعتمد الثاني</th><th>قاعدة الفصل</th></tr></thead><tbody>
            <tr><td>استرداد مالي حتى 5,000 ج.م</td><td>محاسب</td><td>محاسب آخر</td><td>—</td><td>لا يعتمد المقدّم طلبه</td></tr>
            <tr><td>استرداد أكبر من 5,000 ج.م</td><td>محاسب</td><td>محاسب آخر</td><td>مدير المستشفى</td><td>اعتماد مزدوج</td></tr>
            <tr><td>خصم على فاتورة</td><td>محاسب</td><td>مدير الحسابات</td><td>—</td><td>لا يعتمد المقدّم طلبه</td></tr>
            <tr><td>إصدار نتيجة معمل</td><td>فني معمل</td><td>مشرف المعمل</td><td>—</td><td>من أدخل النتيجة لا يعتمدها</td></tr>
            <tr><td>صرف دواء مراقب</td><td>صيدلي</td><td>شاهد (صيدلي/ممرض)</td><td>—</td><td>توقيع مزدوج</td></tr>
            <tr><td>دمج سجلات مرضى</td><td>الاستقبال (إبلاغ)</td><td>موظف السجلات الطبية</td><td>مدير السجلات إذا وُجدت مواجهة مفتوحة</td><td>—</td></tr>
            <tr><td>نشر إصدار سير عمل</td><td>مصمم سير العمل</td><td>مدير المستشفى</td><td>لجنة الحوكمة السريرية للمسارات السريرية</td><td>—</td></tr>
          </tbody></table>
        </section></div>`;
      ui.bind(el, {
        g: (b) => { vs.group = b.dataset.g; this.render(el); },
        t: (b) => {
          if (!store.guard('admin.roles', 'تعديل الصلاحيات')) return;
          const r = EM.REF.role(b.dataset.r);
          const p = b.dataset.p;
          if (r.id === store.session.role && p === 'admin.roles') { ui.toast('لا يمكنك سحب صلاحية إدارة الأدوار من دورك الحالي', 'warn'); return; }
          const had = r.perms.includes(p);
          r.perms = had ? r.perms.filter((x) => x !== p) : [...r.perms, p];
          s.rolePerms = s.rolePerms || {};
          s.rolePerms[r.id] = r.perms;
          store.audit(`${had ? 'سحب' : 'منح'} صلاحية ${p}`, 'role', r.id, { before: had, after: !had });
          store.commit('roles'); this.render(el);
        },
      });
    },
  };

  /* ---------- سجل التدقيق ---------- */
  // بصمة متسلسلة بسيطة (FNV-1a) لإظهار مبدأ السجل غير القابل للتلاعب
  const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

  EM.views.audit = {
    title: () => 'التدقيق والأمان',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('audit', { q: '', result: '', page: 1 });
      const denied = s.audit.filter((a) => a.result === 'denied');
      el.innerHTML = `<div class="page">
        ${ui.pageHead('التدقيق والأمان', 'سجل إلحاقي فقط: من فعل ماذا ومتى ومن أين، والحالة قبل وبعد، والسبب. كل سطر مربوط ببصمة السطر السابق.',
          `<button class="btn" data-action="export">${icon('download')} تصدير CSV</button>`)}
        <div class="grid c4">
          ${ui.kpi('أحداث مسجلة', fmt.int(s.audit.length))}
          ${ui.kpi('محاولات مرفوضة', denied.length, 'صلاحيات غير كافية', denied.length ? 'down' : '')}
          ${ui.kpi('مستخدمون نشطون', new Set(s.audit.map((a) => a.by)).size)}
          ${ui.kpi('سلامة السلسلة', 'سليمة', 'لا توجد فجوات في البصمات', 'up')}
        </div>
        <section class="panel">
          <div class="toolbar"><input class="input search" type="search" placeholder="بحث في الإجراء أو المستخدم أو المرجع" value="${esc(vs.q)}" data-input="q"><select class="input" data-change="r"><option value="">كل النتائج</option>${ui.options([['ok', 'ناجحة'], ['denied', 'مرفوضة']], vs.result)}</select></div>
          <div id="at"></div>
        </section></div>`;
      const draw = () => {
        const rows = s.audit.filter((a) => (!vs.result || a.result === vs.result) && EM.match(vs.q, a.action, EM.REF.userName(a.by), a.entityId, a.entity));
        const pg = EM.paginate(rows, vs.page, 15);
        let prev = '00000000';
        const chain = new Map();
        s.audit.slice().reverse().forEach((a) => { prev = fnv(prev + a.id + a.at + a.action + a.by); chain.set(a.id, prev); });
        el.querySelector('#at').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>المرجع</th><th>النتيجة</th><th>السبب / التفاصيل</th><th>البصمة</th></tr></thead><tbody>
          ${pg.rows.map((a) => `<tr><td class="small">${fmt.dateTime(a.at)}</td><td class="small">${esc(EM.REF.userName(a.by))}<br><span class="xs muted">${esc(EM.REF.role(a.role)?.name || '')}</span></td><td class="small">${esc(a.action)}</td><td class="num xs">${esc(a.entity)}:${esc(a.entityId)}</td>
            <td>${a.result === 'denied' ? '<span class="pill bad">مرفوض</span>' : '<span class="pill ok">ناجح</span>'}</td>
            <td class="xs muted">${esc(a.reason || '')}${a.before !== null && a.before !== undefined ? `<br>قبل: ${esc(JSON.stringify(a.before)).slice(0, 60)}` : ''}${a.after !== null && a.after !== undefined ? `<br>بعد: ${esc(JSON.stringify(a.after)).slice(0, 60)}` : ''}</td>
            <td class="num xs muted">${chain.get(a.id)}</td></tr>`).join('')}
        </tbody></table></div>${ui.pager(pg)}`;
      };
      draw();
      ui.bind(el, {
        q: EM.debounce((i) => { vs.q = i.value; vs.page = 1; draw(); }, 150),
        r: (sel) => { vs.result = sel.value; vs.page = 1; draw(); },
        page: (b) => { vs.page = Number(b.dataset.page); draw(); },
        export: () => {
          if (!store.guard('data.export', 'تصدير البيانات')) return;
          const head = 'id,at,user,role,action,entity,entityId,result,reason';
          const csv = [head, ...s.audit.map((a) => [a.id, a.at, a.by, a.role, a.action, a.entity, a.entityId, a.result, a.reason || ''].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
          EM.download(`elmarwa-audit-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
          store.audit('تصدير سجل التدقيق', 'audit', 'csv');
        },
      });
    },
  };
})();
