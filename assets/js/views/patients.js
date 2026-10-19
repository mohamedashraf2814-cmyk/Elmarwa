/* المرضى: البحث، التسجيل مع كشف التكرار، الملف الطبي، الخط الزمني */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;

  const insName = (id) => EM.REF.insurers.find((i) => i.id === id)?.name || '—';

  EM.views.patients = {
    title: () => 'المرضى',
    render(el) {
      const vs = ui.vstate('patients', { q: '', ins: '', page: 1 });
      el.innerHTML = `<div class="page">
        ${ui.pageHead('المرضى', 'السجل الموحد للمرضى: ملف واحد ورقم طبي واحد يربط كل المواجهات والطلبات والفواتير.',
          store.can('patients.create') ? `<button class="btn primary" data-action="new">${icon('plus')} تسجيل مريض</button>` : '')}
        <section class="panel">
          <div class="toolbar">
            <input class="input search" type="search" placeholder="بحث بالاسم أو رقم الملف أو الهاتف" value="${esc(vs.q)}" data-input="q" aria-label="بحث">
            <select class="input" data-change="ins" aria-label="جهة التأمين"><option value="">كل جهات التأمين</option>${ui.options(EM.REF.insurers.map((i) => [i.id, i.name]), vs.ins)}</select>
            <span class="grow"></span><span class="small muted" id="pcount"></span>
          </div>
          <div id="ptable"></div>
        </section></div>`;
      const body = el.querySelector('#ptable');
      const draw = () => {
        const rows = store.state.patients.filter((p) => EM.match(vs.q, p.name, p.id, p.phone, p.nationalId) && (!vs.ins || p.insurer === vs.ins));
        const pg = EM.paginate(rows, vs.page, 12);
        el.querySelector('#pcount').textContent = `${rows.length} مريضاً`;
        body.innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المريض</th><th>العمر / النوع</th><th>الرقم القومي</th><th>التأمين</th><th>تنبيهات</th><th></th></tr></thead><tbody>
          ${pg.rows.map((p) => `<tr>
            <td>${ui.patientCell(p.id)}</td>
            <td class="small">${fmt.age(p.dob)} سنة · ${esc(p.gender)}</td>
            <td class="num small">${ui.maskNid(p.nationalId)}</td>
            <td class="small">${esc(insName(p.insurer))}</td>
            <td>${[...p.allergies.map((a) => `<span class="pill bad">حساسية: ${esc(a)}</span>`), ...p.alerts.map((a) => `<span class="pill warn">${esc(a)}</span>`), p.duplicateOf ? '<span class="pill par">مكرر محتمل</span>' : '', p.incomplete ? '<span class="pill warn">بيانات ناقصة</span>' : ''].join(' ') || '<span class="muted xs">—</span>'}</td>
            <td class="actions"><a class="btn sm" href="#/patients/${esc(p.id)}">فتح الملف</a></td></tr>`).join('')}
          </tbody></table></div>${ui.pager(pg)}` : ui.empty('لا يوجد مريض مطابق', 'تأكد من الاسم أو رقم الملف، أو سجّل المريض كحالة جديدة.', store.can('patients.create') ? '<button class="btn primary" data-action="new">تسجيل مريض جديد</button>' : '');
      };
      draw();
      ui.bind(el, {
        q: EM.debounce((i) => { vs.q = i.value; vs.page = 1; draw(); }, 150),
        ins: (s) => { vs.ins = s.value; vs.page = 1; draw(); },
        page: (b) => { vs.page = Number(b.dataset.page); draw(); },
        new: () => registerModal(() => draw()),
      });
    },
  };

  /* ---------- تسجيل مريض مع كشف التكرار والبيانات الناقصة ---------- */
  function registerModal(done) {
    ui.modal({
      title: 'تسجيل مريض جديد', wide: true,
      body: `
        <div class="callout">${icon('info')}<span>يبحث النظام تلقائياً عن سجلات مطابقة بالرقم القومي أو الاسم وتاريخ الميلاد قبل إنشاء ملف جديد. في الطوارئ يمكن التسجيل المختصر واستكمال البيانات لاحقاً.</span></div>
        <form id="reg" class="form-grid" novalidate>
          <div class="field full"><label for="r-name">الاسم الرباعي</label><input id="r-name" class="input" required></div>
          <div class="field"><label for="r-nid">الرقم القومي (14 رقماً)</label><input id="r-nid" class="input num" inputmode="numeric" maxlength="14"><span class="hint">يمكن تركه فارغاً مؤقتاً</span></div>
          <div class="field"><label for="r-dob">تاريخ الميلاد</label><input id="r-dob" type="date" class="input"></div>
          <div class="field"><label for="r-gender">النوع</label><select id="r-gender" class="input"><option>ذكر</option><option>أنثى</option></select></div>
          <div class="field"><label for="r-phone">الهاتف</label><input id="r-phone" class="input num" inputmode="tel"></div>
          <div class="field"><label for="r-ins">جهة التأمين</label><select id="r-ins" class="input">${ui.options(EM.REF.insurers.map((i) => [i.id, i.name]), 'NONE')}</select></div>
          <div class="field"><label for="r-allergy">حساسية معروفة</label><input id="r-allergy" class="input" placeholder="مثال: البنسلين"></div>
          <div class="field"><label for="r-ec">جهة اتصال للطوارئ</label><input id="r-ec" class="input" placeholder="الاسم والهاتف"></div>
          <div class="field full row wrap" style="gap:18px"><label class="check"><input type="checkbox" id="r-sms" checked> يوافق على رسائل التذكير</label><label class="check"><input type="checkbox" id="r-research"> يوافق على استخدام بياناته مجهّلة في الأبحاث</label></div>
        </form>
        <div id="dupbox"></div>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-save>تسجيل وإنشاء رقم الملف</button>',
      onMount(m, close) {
        const $ = (id) => m.querySelector(id);
        const check = () => {
          const nid = $('#r-nid').value.trim();
          const name = $('#r-name').value.trim();
          const dob = $('#r-dob').value;
          const hits = store.state.patients.filter((p) => (nid.length === 14 && p.nationalId === nid) || (name && dob && EM.norm(p.name) === EM.norm(name) && p.dob.slice(0, 10) === dob));
          $('#dupbox').innerHTML = hits.length ? `<div class="callout bad">${icon('alert')}<div><b>يوجد ${hits.length} سجل مطابق.</b> افتح السجل الموجود بدلاً من إنشاء ملف مكرر.<div class="row wrap" style="margin-top:8px">${hits.map((p) => `<a class="btn sm" href="#/patients/${esc(p.id)}" data-close="1">${esc(p.name)} · <span class="num">${esc(p.id)}</span></a>`).join('')}</div></div></div>` : '';
          return hits;
        };
        ['#r-nid', '#r-name', '#r-dob'].forEach((s) => $(s).addEventListener('input', EM.debounce(check, 200)));
        $('#dupbox').addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
        $('[data-save]').addEventListener('click', () => {
          if (!store.guard('patients.create', 'تسجيل مريض')) return;
          const name = $('#r-name').value.trim();
          const nid = $('#r-nid').value.trim();
          if (name.split(/\s+/).length < 2) { ui.toast('اكتب الاسم ثنائياً على الأقل', 'warn'); $('#r-name').focus(); return; }
          if (nid && !/^[23]\d{13}$/.test(nid)) { ui.toast('الرقم القومي يجب أن يكون 14 رقماً ويبدأ بـ 2 أو 3', 'warn'); $('#r-nid').focus(); return; }
          if (check().length) { ui.toast('يوجد سجل مطابق — لم يتم إنشاء ملف مكرر', 'bad'); return; }
          const incomplete = !nid || !$('#r-phone').value.trim() || !$('#r-dob').value || !$('#r-ec').value.trim();
          const seq = store.state.patients.length + 30000;
          const p = {
            id: `EM-26-${EM.pad(seq, 6)}`, name, gender: $('#r-gender').value,
            dob: $('#r-dob').value ? new Date($('#r-dob').value).toISOString() : new Date(1990, 0, 1).toISOString(),
            nationalId: nid, phone: $('#r-phone').value.trim(), governorate: '—', insurer: $('#r-ins').value, policy: '',
            blood: '—', allergies: $('#r-allergy').value.trim() ? [$('#r-allergy').value.trim()] : [], alerts: [],
            emergency: { name: $('#r-ec').value.trim() || '—', relation: '—', phone: '' },
            consent: { sms: $('#r-sms').checked, research: $('#r-research').checked },
            createdAt: new Date().toISOString(), incomplete,
          };
          store.state.patients.unshift(p);
          store.audit('تسجيل مريض جديد', 'patient', p.id, { after: { incomplete } });
          const inst = store.startInstance('wf_registration', { found: false, duplicate: false, complete: !incomplete }, p.id);
          store.commit('patients');
          close();
          ui.toast(incomplete ? `تم إنشاء ملف مؤقت ${p.id} ومهمة لاستكمال البيانات` : `تم التسجيل برقم ملف ${p.id}`, incomplete ? 'warn' : 'ok', 5000);
          if (inst) location.hash = `#/patients/${p.id}`; else done();
        });
      },
    });
  }
  EM.registerPatient = registerModal;

  /* ---------- الخط الزمني للمريض ---------- */
  function timeline(pid) {
    const s = store.state;
    const ev = [];
    const push = (at, kind, title, body, ic, link) => at && ev.push({ at, kind, title, body, ic, link });
    const p = store.patient(pid);
    push(p.createdAt, 'info', 'إنشاء الملف الطبي', `رقم الملف ${p.id}`, 'user');
    s.appointments.filter((a) => a.patientId === pid).forEach((a) => { const c = EM.CLINICS.find((x) => x.id === a.clinic); push(a.at, a.status === 'no_show' ? 'bad' : 'info', `موعد ${c.specialty}`, `${c.name} — ${ui.statusText('appt', a.status)}`, 'calendar', '#/appointments'); });
    s.er.filter((e) => e.patientId === pid).forEach((e) => push(e.arrivedAt, e.level && e.level <= 2 ? 'bad' : 'warn', 'زيارة طوارئ', `${e.complaint}${e.level ? ` — مستوى ${e.level}` : ''}`, 'siren', '#/emergency'));
    s.lab.filter((l) => l.patientId === pid).forEach((l) => { const t = EM.REF.labTests.find((x) => x.code === l.test); push(l.orderedAt, l.critical ? 'bad' : 'info', `تحليل: ${t.name}`, `${ui.statusText('lab', l.stage)}${l.result ? ` — ${l.result.value} ${l.result.unit}` : ''}${l.critical ? ' (حرجة)' : ''}`, 'flask', '#/lab'); });
    s.rad.filter((r) => r.patientId === pid).forEach((r) => { const t = EM.REF.imaging.find((x) => x.code === r.study); push(r.orderedAt, 'info', `أشعة: ${t.name}`, `${ui.statusText('rad', r.stage)} — ${r.indication}`, 'scan', '#/radiology'); });
    s.rx.filter((r) => r.patientId === pid).forEach((r) => { const d = EM.REF.drugs.find((x) => x.code === r.drug); push(r.at, r.alert ? 'warn' : 'info', `وصفة: ${d.name}`, `${r.dose} ${r.route} ${r.freq} — ${ui.statusText('rx', r.status)}`, 'pill', '#/pharmacy'); });
    s.beds.filter((b) => b.patientId === pid).forEach((b) => push(b.since, 'ok', 'دخول وإقامة', `${EM.REF.wards.find((w) => w.id === b.ward).name} — سرير ${b.label}`, 'bed', '#/beds'));
    s.surgeries.filter((x) => x.patientId === pid).forEach((x) => push(x.start, 'warn', `عملية: ${x.procedure}`, `${x.room} — ${ui.statusText('or', x.status)}`, 'scalpel', '#/surgery'));
    s.invoices.filter((i) => i.patientId === pid).forEach((i) => push(i.at, 'info', `فاتورة ${i.id}`, `${fmt.money(i.total)} — ${ui.statusText('inv', i.status)}`, 'wallet', '#/billing'));
    s.instances.filter((i) => i.patientId === pid).forEach((i) => push(i.startedAt, 'par', `مسار: ${i.name}`, ui.statusText('inst', i.status), 'flow', `#/workflows/instance/${i.id}`));
    s.notes.filter((n) => n.patientId === pid).forEach((n) => push(n.at, 'ok', 'توثيق سريري', `${n.text.slice(0, 90)} — ${EM.REF.userName(n.by)}`, 'file'));
    return ev.sort((a, b) => b.at.localeCompare(a.at));
  }
  EM.patientTimeline = timeline;

  /* ---------- جواز المريض: أين هو الآن، وماذا ينتظره، وكل الإجراءات عبر الأقسام ---------- */
  const orderCount = (pid) => { const s = store.state; return s.lab.filter((x) => x.patientId === pid).length + s.rad.filter((x) => x.patientId === pid).length + s.rx.filter((x) => x.patientId === pid).length; };
  function passport(p) {
    const H = EM.H;
    const s = store.state;
    const loc = H.locate(p.id);
    const enc = H.encounter(p.id);
    const pendLab = s.lab.filter((x) => x.patientId === p.id && x.stage !== 'verified').length;
    const pendRad = s.rad.filter((x) => x.patientId === p.id && x.stage !== 'verified').length;
    const pendRx = s.rx.filter((x) => x.patientId === p.id && !['dispensed', 'cancelled'].includes(x.status)).length;
    const crit = s.lab.filter((x) => x.patientId === p.id && x.critical && !x.ackBy).length;
    const next = s.appointments.filter((a) => a.patientId === p.id && a.status === 'booked' && new Date(a.at) > new Date()).sort((a, b) => a.at.localeCompare(b.at))[0];
    const dis = s.discharges.find((d) => d.patientId === p.id && d.status === 'in_progress');
    const req = s.bedRequests.find((r) => r.patientId === p.id);
    const journey = H.journey(p.id);
    const can = (perm) => store.can(perm);
    return `<section class="panel passport">
      <div class="pp-grid">
        <div class="pp-cell pp-loc loc-${loc.kind}"><small>مكانه الآن</small><b>${loc.link ? `<a href="${loc.link}">${esc(loc.label)}</a>` : esc(loc.label)}</b>${enc ? `<span class="xs">زيارة <span class="num">${esc(enc.id)}</span> منذ ${EM.fmt.minutes(EM.minsSince(enc.startedAt))}</span>` : '<span class="xs">لا توجد زيارة مفتوحة</span>'}</div>
        <div class="pp-cell"><small>طلبات قيد التنفيذ</small><b class="num">${pendLab + pendRad + pendRx}</b><span class="xs">${pendLab} تحليل · ${pendRad} أشعة · ${pendRx} دواء</span></div>
        <div class="pp-cell ${crit ? 'pp-bad' : ''}"><small>نتائج حرجة بلا إقرار</small><b class="num">${crit}</b><span class="xs">${crit ? '<a href="#/lab">إقرار الآن</a>' : 'لا يوجد'}</span></div>
        <div class="pp-cell"><small>المستحق على المريض</small><b class="num">${EM.fmt.money(H.balance(p.id))}</b><span class="xs">${esc(EM.REF.insurers.find((i) => i.id === p.insurer)?.name || '')}</span></div>
        <div class="pp-cell"><small>الخطوة التالية</small><b class="small">${dis ? 'إجراءات خروج جارية' : req ? `بانتظار سرير — ${esc(EM.H.wardName(req.ward).split(' — ')[0])}` : next ? `موعد ${esc(EM.CLINICS.find((c) => c.id === next.clinic).specialty)}` : '—'}</b><span class="xs">${next && !dis && !req ? EM.fmt.dateTime(next.at) : ''}</span></div>
      </div>
      ${journey.length ? `<ol class="journey" aria-label="رحلة المريض عبر الأقسام">${journey.map((j) => `<li class="j-${j.state}"><span class="j-dot"></span><b>${esc(j.dept)}</b><span>${esc(j.label)}</span><time>${EM.fmt.time(j.at)}</time></li>`).join('')}</ol>` : ''}
      <div class="pp-actions">
        ${can('orders.create') ? `<button class="btn sm" data-action="qa" data-q="lab">${icon('flask', 'sm')} طلب تحاليل</button><button class="btn sm" data-action="qa" data-q="rad">${icon('scan', 'sm')} طلب أشعة</button><button class="btn sm" data-action="qa" data-q="rx">${icon('pill', 'sm')} وصفة</button>` : ''}
        ${can('er.view') && loc.kind === 'out' ? `<button class="btn sm" data-action="qa" data-q="er">${icon('siren', 'sm')} وصول للطوارئ</button>` : ''}
        ${can('beds.assign') && !loc.bed && !req ? `<button class="btn sm" data-action="qa" data-q="admit">${icon('bed', 'sm')} طلب دخول</button>` : ''}
        ${can('beds.assign') && loc.bed && !dis ? `<button class="btn sm" data-action="qa" data-q="discharge">${icon('logout', 'sm')} بدء الخروج</button>` : ''}
        ${can('appointments.manage') ? `<button class="btn sm" data-action="qa" data-q="appt">${icon('calendar', 'sm')} حجز موعد</button>` : ''}
        ${can('dashboard.view') ? `<button class="btn sm ghost" data-action="qa" data-q="incident">${icon('alert', 'sm')} بلاغ سلامة</button>` : ''}
      </div>
    </section>`;
  }

  function ordersTab(pid) {
    const s = store.state;
    const rows = [
      ...s.lab.filter((x) => x.patientId === pid).map((x) => ({ at: x.orderedAt, kind: 'تحليل', name: EM.REF.labTests.find((t) => t.code === x.test).name, st: ui.pill('lab', x.stage), res: x.result ? `<b class="num ${x.critical ? 'v-bad' : ''}">${esc(x.result.value)}</b> <span class="xs muted">${esc(x.result.unit)} (${esc(x.result.ref)})</span>${x.critical ? (x.ackBy ? ' <span class="pill ok">أُقرت</span>' : ' <span class="pill bad">حرجة</span>') : ''}` : '—', link: '#/lab' })),
      ...s.rad.filter((x) => x.patientId === pid).map((x) => ({ at: x.orderedAt, kind: 'أشعة', name: EM.REF.imaging.find((t) => t.code === x.study).name, st: ui.pill('rad', x.stage), res: esc(x.report || '—'), link: '#/radiology' })),
      ...s.rx.filter((x) => x.patientId === pid).map((x) => ({ at: x.at, kind: 'دواء', name: EM.REF.drugs.find((d) => d.code === x.drug).name, st: ui.pill('rx', x.status), res: `${esc(x.dose)} ${esc(x.route)} ${esc(x.freq)}${x.alert ? ` <span class="pill bad">${esc(x.alert.kind)}</span>` : ''}`, link: '#/pharmacy' })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>النوع</th><th>الطلب</th><th>الحالة</th><th>النتيجة / التفاصيل</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td class="small">${fmt.dateTime(r.at)}</td><td class="small">${r.kind}</td><td class="small">${esc(r.name)}</td><td>${r.st}</td><td class="small">${r.res}</td><td class="actions"><a class="btn sm ghost" href="${r.link}">القسم</a></td></tr>`).join('')}</tbody></table></div>` : ui.empty('لا توجد طلبات لهذا المريض');
  }

  function billingTab(pid) {
    const inv = store.state.invoices.filter((i) => i.patientId === pid);
    if (!inv.length) return ui.empty('لا توجد فواتير بعد', 'تُنشأ الفاتورة تلقائياً مع أول خدمة يحصل عليها المريض.');
    return inv.map((i) => `<div class="inv-block"><div class="row between"><b class="num">${esc(i.id)}</b>${ui.pill('inv', i.status)}</div>
      <table class="tbl"><tbody>${i.items.map((it) => `<tr><td class="small">${esc(it.name)}</td><td class="xs muted">${esc(it.source || '')}</td><td class="num">${it.qty} × ${fmt.money(it.price)}</td></tr>`).join('')}</tbody></table>
      <div class="row between small"><span>الإجمالي <b class="num">${fmt.money(i.total)}</b> · التأمين <b class="num">${fmt.money(i.insShare)}</b></span><span>على المريض <b class="num">${fmt.money(i.patientShare)}</b> · مدفوع <b class="num">${fmt.money(i.paid)}</b></span></div></div>`).join('');
  }

  function quickAction(q, p, done) {
    const H = EM.H;
    const fin = (msg) => { store.commit('patient'); ui.toast(msg, 'ok', 4500); done(); };
    const pick = (title, items, cb, extra = '') => ui.modal({
      title, body: `<div class="orders" style="border:0;padding:0">${items.map(([v, t]) => `<label class="check"><input type="checkbox" value="${esc(v)}"> ${esc(t)}</label>`).join('')}</div>${extra}`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>إرسال</button>',
      onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => { const v = [...m.querySelectorAll('input[type=checkbox]:checked')].map((i) => i.value); if (!v.length) { ui.toast('اختر عنصراً واحداً على الأقل', 'warn'); return; } close(); cb(v, m); }),
    });
    if (q === 'lab') pick('طلب تحاليل', EM.REF.labTests.map((t) => [t.code, t.name]), (v, m) => { H.orderLab(p.id, v, { priority: m.querySelector('#pr').value, source: H.locate(p.id).dept || 'opd' }); fin(`أُرسل ${v.length} تحليل للمعمل ومهمة سحب العينات للتمريض`); }, `<div class="field"><label for="pr">الأولوية</label><select id="pr" class="input"><option>روتيني</option><option>عاجل</option><option>STAT</option></select></div>`);
    if (q === 'rad') pick('طلب أشعة', EM.REF.imaging.map((t) => [t.code, t.name]), (v, m) => { H.orderRad(p.id, v, { indication: m.querySelector('#ind').value || 'تقييم' }); fin('أُرسل الطلب لقسم الأشعة'); }, `<div class="field"><label for="ind">الدواعي السريرية</label><input id="ind" class="input"></div>`);
    if (q === 'rx') ui.modal({
      title: 'وصفة جديدة', body: `<div class="form-grid"><div class="field full"><label for="qd">الدواء</label><select id="qd" class="input">${EM.REF.drugs.map((d) => `<option value="${d.code}">${esc(d.name)}${d.controlled ? ' (مراقب)' : ''}</option>`).join('')}</select></div><div class="field"><label for="qdo">الجرعة</label><input id="qdo" class="input"></div><div class="field"><label for="qf">التكرار</label><input id="qf" class="input" placeholder="كل 8 ساعات"></div><div class="field full" id="qwarn"></div></div>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>إرسال للصيدلية</button>',
      onMount: (m, close) => {
        const chk = () => { const c = H.allergyConflict(p.id, m.querySelector('#qd').value); m.querySelector('#qwarn').innerHTML = c ? `<div class="callout bad">${icon('alert', 'sm')}<div><span class="small">${esc(c)}. التنبيه آلي وليس قراراً سريرياً — للمتابعة اكتب تبريراً وستُعلّق الوصفة لمراجعة الصيدلي.</span><input id="qj" class="input" style="margin-top:6px" placeholder="التبرير"></div></div>` : ''; };
        m.querySelector('#qd').addEventListener('change', chk); chk();
        m.querySelector('[data-ok]').addEventListener('click', () => {
          const j = m.querySelector('#qj');
          if (j && !j.value.trim()) { ui.toast('التبرير إلزامي لتجاوز تنبيه الحساسية', 'warn'); return; }
          H.prescribe(p.id, m.querySelector('#qd').value, { dose: m.querySelector('#qdo').value || '—', freq: m.querySelector('#qf').value, justification: j?.value.trim() || null });
          close(); fin(j ? 'أُرسلت الوصفة معلقة لمراجعة الصيدلي' : 'أُرسلت الوصفة للصيدلية');
        });
      },
    });
    if (q === 'er') { H.erArrive({ pid: p.id, complaint: 'وصول للطوارئ' }); fin('أُضيف المريض لعمود «بانتظار الفرز» وفُتحت زيارة طوارئ'); }
    if (q === 'admit') ui.modal({
      title: 'طلب دخول', body: `<div class="form-grid"><div class="field"><label for="aw">الجناح</label><select id="aw" class="input">${ui.options(EM.REF.wards.map((w) => [w.id, w.name]), 'W-MED')}</select></div><div class="field"><label for="ap">الأولوية</label><select id="ap" class="input"><option>عاجل</option><option>حرج</option><option>مجدول</option></select></div><div class="field full"><label for="ar">السبب</label><input id="ar" class="input"></div><label class="check"><input type="checkbox" id="ai"> يحتاج عزلاً</label></div>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>إرسال الطلب</button>',
      onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => { H.requestAdmission(p.id, { ward: m.querySelector('#aw').value, priority: m.querySelector('#ap').value, reason: m.querySelector('#ar').value || 'دخول', from: H.locate(p.id).label.split(' — ')[0], isolation: m.querySelector('#ai').checked }); close(); fin('أُرسل طلب الدخول للوحة الأسرّة'); }),
    });
    if (q === 'discharge') { H.startDischarge(p.id, 'normal'); store.commit('patient'); location.hash = '#/discharge'; }
    if (q === 'appt') ui.modal({
      title: 'حجز موعد', body: `<div class="form-grid"><div class="field"><label for="ac">العيادة</label><select id="ac" class="input">${EM.CLINICS.map((c) => `<option value="${c.id}">${esc(c.specialty)} — ${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label for="ad">بعد (أيام)</label><input id="ad" type="number" class="input num" value="7" min="0"></div></div>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>حجز</button>',
      onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => { H.followUp(p.id, m.querySelector('#ac').value, Number(m.querySelector('#ad').value) || 0); close(); fin('تم حجز الموعد'); }),
    });
    if (q === 'incident') ui.modal({
      title: 'بلاغ سلامة مرتبط بالمريض', body: `<div class="field"><label for="ik">النوع</label><select id="ik" class="input">${['سقوط مريض', 'خطأ دوائي', 'عرض جانبي لدواء', 'خطأ في التعريف بالمريض', 'أخرى'].map((x) => `<option>${x}</option>`).join('')}</select></div><div class="field"><label for="it">ماذا حدث؟</label><textarea id="it" class="input"></textarea></div>`,
      foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>إرسال</button>',
      onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => { const t = m.querySelector('#it').value.trim(); if (!t) { ui.toast('اكتب ما حدث', 'warn'); return; } H.reportIncident({ kind: m.querySelector('#ik').value, severity: 'بسيط', location: H.locate(p.id).label, text: t, pid: p.id }); close(); fin('أُرسل البلاغ للجودة'); }),
    });
  }

  EM.views.patient = {
    title: (p) => store.patientName(p.id),
    render(el, params) {
      const p = store.patient(params.id);
      if (!p) { el.innerHTML = `<div class="page">${ui.empty('الملف غير موجود', 'ربما تم دمجه في سجل آخر.', '<a class="btn" href="#/patients">العودة للمرضى</a>')}</div>`; return; }
      const vs = ui.vstate(`patient:${p.id}`, { tab: 'timeline', reveal: false });
      store.audit('عرض ملف مريض', 'patient', p.id);
      const tl = timeline(p.id);
      const bed = store.state.beds.find((b) => b.patientId === p.id);
      const ins = EM.REF.insurers.find((i) => i.id === p.insurer);
      el.innerHTML = `<div class="page">
        <div class="crumbs"><a href="#/patients">المرضى</a> / ملف طبي</div>
        <section class="panel pt-head">
          <span class="avatar pt-av">${esc(EM.initials(p.name))}</span>
          <div class="grow">
            <h1>${esc(p.name)}</h1>
            <div class="pt-meta">
              <span>رقم الملف <b class="num">${esc(p.id)}</b></span>
              <span>${fmt.age(p.dob)} سنة · ${esc(p.gender)}</span>
              <span>فصيلة الدم <b class="num">${esc(p.blood)}</b></span>
              <span>${esc(ins?.name || '—')}</span>
              ${bed ? `<span>${icon('bed', 'sm')} ${esc(EM.REF.wards.find((w) => w.id === bed.ward).name)} — سرير ${esc(bed.label)}</span>` : ''}
            </div>
            <div class="row wrap" style="margin-top:10px;gap:6px">
              ${p.allergies.map((a) => `<span class="pill bad">حساسية: ${esc(a)}</span>`).join('')}
              ${p.alerts.map((a) => `<span class="pill warn">${esc(a)}</span>`).join('')}
              ${p.incomplete ? '<span class="pill warn">بيانات ناقصة — ملف مؤقت</span>' : ''}
              ${p.duplicateOf ? `<span class="pill par">مكرر محتمل لـ <span class="num">${esc(p.duplicateOf)}</span></span>` : ''}
              ${!p.allergies.length ? '<span class="pill ok">لا توجد حساسية مسجلة</span>' : ''}
            </div>
          </div>
          <div class="btn-group">
            ${p.duplicateOf && store.can('patients.merge') ? `<button class="btn" data-action="merge">${icon('copy')} دمج السجلين</button>` : ''}
            ${store.can('clinic.consult') ? `<a class="btn primary" href="#/clinic?p=${esc(p.id)}">${icon('stethoscope')} بدء كشف</a>` : ''}
          </div>
        </section>
        ${passport(p)}
        <section class="panel">
          <div class="tabs" role="tablist">${[['timeline', 'الخط الزمني'], ['orders', `الطلبات والنتائج (${orderCount(p.id)})`], ['billing', 'الحساب'], ['info', 'البيانات والموافقات'], ['flows', 'مسارات العمل']].map(([k, t]) => `<button role="tab" aria-selected="${vs.tab === k}" class="${vs.tab === k ? 'on' : ''}" data-action="tab" data-t="${k}">${t}</button>`).join('')}</div>
          <div class="panel-body">${vs.tab === 'timeline' ? (tl.length ? `<ol class="timeline">${tl.map((e) => `
              <li class="tl-${e.kind}"><span class="tl-ic">${icon(e.ic, 'sm')}</span><div class="grow"><div class="row between"><b>${esc(e.title)}</b><span class="xs muted">${fmt.dateTime(e.at)}</span></div><div class="small muted">${esc(e.body)}</div></div>${e.link ? `<a class="btn sm ghost" href="${e.link}">فتح</a>` : ''}</li>`).join('')}</ol>` : ui.empty('لا توجد أحداث بعد'))
            : vs.tab === 'orders' ? ordersTab(p.id)
            : vs.tab === 'billing' ? billingTab(p.id)
            : vs.tab === 'info' ? `
              <div class="grid c2">
                <dl class="dl">
                  <dt>الرقم القومي</dt><dd class="num">${vs.reveal ? esc(p.nationalId || '—') : ui.maskNid(p.nationalId)} ${!vs.reveal && store.can('patients.edit') ? '<button class="btn sm ghost" data-action="reveal">إظهار (يُسجل)</button>' : ''}</dd>
                  <dt>الهاتف</dt><dd class="num">${esc(p.phone || '—')}</dd>
                  <dt>المحافظة</dt><dd>${esc(p.governorate)}</dd>
                  <dt>تاريخ الميلاد</dt><dd>${fmt.date(p.dob)}</dd>
                  <dt>رقم الوثيقة</dt><dd class="num">${esc(p.policy || '—')}</dd>
                </dl>
                <dl class="dl">
                  <dt>جهة الاتصال للطوارئ</dt><dd>${esc(p.emergency.name)} (${esc(p.emergency.relation)}) <span class="num">${esc(p.emergency.phone)}</span></dd>
                  <dt>رسائل التذكير</dt><dd>${p.consent.sms ? 'موافق' : 'غير موافق'}</dd>
                  <dt>الاستخدام البحثي المجهّل</dt><dd>${p.consent.research ? 'موافق' : 'غير موافق'}</dd>
                  <dt>تاريخ إنشاء الملف</dt><dd>${fmt.date(p.createdAt)}</dd>
                </dl>
              </div>
              ${store.can('patients.edit') ? `<div style="margin-top:16px"><button class="btn" data-action="edit">${icon('file')} تصحيح البيانات الديموغرافية</button></div>` : ''}`
            : (() => { const inst = store.state.instances.filter((i) => i.patientId === p.id); return inst.length ? `<table class="tbl"><thead><tr><th>المسار</th><th>الحالة</th><th>الخطوة الحالية</th><th>البدء</th><th></th></tr></thead><tbody>${inst.map((i) => { const d = store.versionDef(i.workflowId, i.version); return `<tr><td>${esc(i.name)}</td><td>${ui.pill('inst', i.status)}</td><td class="small">${i.tokens.map((t) => esc(EM.WF.node(d, t.node)?.label)).join('، ') || '—'}</td><td class="small">${fmt.dateTime(i.startedAt)}</td><td class="actions"><a class="btn sm" href="#/workflows/instance/${esc(i.id)}">عرض التنفيذ</a></td></tr>`; }).join('')}</tbody></table>` : ui.empty('لا توجد مسارات مرتبطة بهذا المريض'); })()}
          </div>
        </section></div>`;
      ui.bind(el, {
        tab: (b) => { vs.tab = b.dataset.t; this.render(el, params); },
        qa: (b) => quickAction(b.dataset.q, p, () => this.render(el, params)),
        reveal: () => ui.confirm({ title: 'إظهار بيانات حساسة', message: 'سيتم تسجيل هذا الإجراء في سجل التدقيق مع السبب.', reason: true, confirm: 'إظهار', onOk: (r) => { store.audit('إظهار الرقم القومي', 'patient', p.id, { reason: r }); vs.reveal = true; this.render(el, params); } }),
        edit: () => ui.modal({
          title: 'تصحيح البيانات الديموغرافية',
          body: `<div class="form-grid"><div class="field"><label for="e-phone">الهاتف</label><input id="e-phone" class="input num" value="${esc(p.phone)}"></div><div class="field"><label for="e-gov">المحافظة</label><input id="e-gov" class="input" value="${esc(p.governorate)}"></div><div class="field full"><label for="e-why">سبب التصحيح (إلزامي)</label><input id="e-why" class="input"></div></div><p class="xs muted">تُحفظ القيم السابقة في سجل التدقيق ولا يتم استبدالها دون أثر.</p>`,
          foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>حفظ التصحيح</button>',
          onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => {
            const why = m.querySelector('#e-why').value.trim();
            if (!why) { ui.toast('اكتب سبب التصحيح', 'warn'); return; }
            const before = { phone: p.phone, governorate: p.governorate };
            p.phone = m.querySelector('#e-phone').value.trim();
            p.governorate = m.querySelector('#e-gov').value.trim();
            if (p.phone && p.nationalId && p.emergency.name !== '—') p.incomplete = false;
            store.audit('تصحيح بيانات ديموغرافية', 'patient', p.id, { before, after: { phone: p.phone, governorate: p.governorate }, reason: why });
            store.commit('patients'); close(); ui.toast('تم حفظ التصحيح', 'ok'); this.render(el, params);
          }),
        }),
        merge: () => ui.confirm({
          title: 'دمج السجلات المكررة', message: `سيتم نقل كل المواجهات والطلبات من <b class="num">${esc(p.id)}</b> إلى <b class="num">${esc(p.duplicateOf)}</b> مع إبقاء رابط دائم بين الرقمين في التدقيق.`, reason: true, confirm: 'دمج',
          onOk: (r) => {
            const target = p.duplicateOf;
            const s = store.state;
            ['appointments', 'er', 'lab', 'rad', 'rx', 'invoices', 'instances', 'nursing'].forEach((k) => s[k].forEach((x) => { if (x.patientId === p.id) x.patientId = target; }));
            s.beds.forEach((b) => { if (b.patientId === p.id) b.patientId = target; });
            s.patients = s.patients.filter((x) => x.id !== p.id);
            store.audit('دمج سجلين', 'patient', target, { before: p.id, reason: r });
            store.commit('patients'); ui.toast('تم الدمج', 'ok'); location.hash = `#/patients/${target}`;
          },
        }),
      });
    },
  };
})();
