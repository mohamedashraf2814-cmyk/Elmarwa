/* أقسام التشغيل: الخروج، النظافة، العناية المركزة، صيانة الأجهزة، الجودة، الموارد البشرية، السجلات الطبية */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;
  const H = () => EM.H;
  const wardOf = (bedId) => { const b = store.state.beds.find((x) => x.id === bedId); return b ? `${H().wardName(b.ward)} — سرير ${b.label}` : '—'; };

  /* ======================= الخروج والمتابعة ======================= */
  const DTYPE = { normal: 'خروج عادي', ama: 'ضد النصيحة الطبية', transfer: 'تحويل لمنشأة أخرى', death: 'وفاة' };
  EM.views.discharge = {
    title: () => 'الخروج والمتابعة',
    render(el) {
      const s = store.state;
      const active = s.discharges.filter((d) => d.status === 'in_progress');
      const done = s.discharges.filter((d) => d.status === 'done');
      const candidates = s.beds.filter((b) => b.patientId && !active.some((d) => d.patientId === b.patientId) && (b.dischargeReady || EM.minsSince(b.since) > 60 * 24 * 6)).slice(0, 8);
      const items = H().DISCHARGE_ITEMS;
      el.innerHTML = `<div class="page">
        ${ui.pageHead('الخروج والمتابعة', 'كل خروج قائمة مهام موزعة على الطبيب والصيدلية والاستقبال والتمريض والحسابات. عند الإتمام يتحرر السرير ويذهب للنظافة تلقائياً.')}
        <div class="grid c4">
          ${ui.kpi('إجراءات خروج جارية', active.length)}
          ${ui.kpi('جاهزة للإتمام', active.filter((d) => items.every(([k, , , req]) => !req || d.items[k])).length, 'كل البنود الإلزامية مكتملة', 'up')}
          ${ui.kpi('مرشحون للخروج', candidates.length, 'إقامة طويلة أو جاهزون طبياً')}
          ${ui.kpi('تم خروجهم اليوم', done.length)}
        </div>
        <section class="stack">${active.map((d) => {
          const doneN = items.filter(([k]) => d.items[k]).length;
          const ready = items.every(([k, , , req]) => !req || d.items[k]) || d.type !== 'normal';
          return `<article class="panel dis-card">
            <header class="dis-head">${ui.patientCell(d.patientId)}<div class="xs muted">${esc(wardOf(d.bedId))} · بدأ ${fmt.ago(d.startedAt)}</div><span class="pill ${d.type === 'normal' ? 'info' : d.type === 'death' ? '' : 'warn'}">${DTYPE[d.type]}</span>
              <div class="dis-progress"><div class="meter"><span style="width:${(doneN / items.length) * 100}%"></span></div><span class="xs num">${doneN}/${items.length}</span></div></header>
            <ol class="dis-items">${items.map(([k, t, who, req]) => `<li class="${d.items[k] ? 'ok' : ''}">
              <span class="di-check">${d.items[k] ? icon('check', 'sm') : ''}</span>
              <div class="grow"><b class="small">${esc(t)}</b>${req ? '' : ' <span class="xs muted">(لا يؤخر الخروج)</span>'}<div class="xs muted">${esc(who)}${d.items[k] ? ` · ${esc(EM.REF.userName(d.items[k].by))} ${fmt.ago(d.items[k].at)}` : ''}</div></div>
              ${d.items[k] ? '' : `<button class="btn sm" data-action="item" data-id="${d.id}" data-k="${k}">تم</button>`}</li>`).join('')}</ol>
            <footer class="row between wrap"><span class="small ${H().balance(d.patientId) > 0 ? 'v-bad' : 'muted'}">المستحق على المريض: <b class="num">${fmt.money(H().balance(d.patientId))}</b></span>
              <button class="btn ${ready ? 'primary' : ''}" data-action="finish" data-id="${d.id}">${icon('logout', 'sm')} إتمام الخروج وتحرير السرير</button></footer>
          </article>`; }).join('') || `<div class="panel">${ui.empty('لا توجد إجراءات خروج جارية', 'ابدأ خروج مريض من القائمة أدناه أو من لوحة الأسرّة.', '', 'logout')}</div>`}</section>
        <section class="panel"><div class="panel-head"><h2>مرشحون للخروج</h2><span class="small muted">جاهزون طبياً أو تجاوزت إقامتهم 6 أيام</span></div>
          <ul class="list">${candidates.map((b) => `<li>${ui.patientCell(b.patientId)}<span class="grow xs muted">${esc(wardOf(b.id))} · ${Math.round(EM.minsSince(b.since) / 1440)} يوم${b.dischargeReady ? ' · <b class="pill ok plain">جاهز طبياً</b>' : ''}</span><button class="btn sm primary" data-action="start" data-p="${esc(b.patientId)}">بدء الخروج</button></li>`).join('') || `<li>${ui.empty('لا يوجد مرشحون')}</li>`}</ul></section>
      </div>`;
      ui.bind(el, {
        item: (b) => { const d = s.discharges.find((x) => x.id === b.dataset.id); H().dischargeItem(d, b.dataset.k); store.commit('discharge'); this.render(el); },
        finish: (b) => {
          const d = s.discharges.find((x) => x.id === b.dataset.id);
          const r = H().finishDischarge(d);
          if (!r.ok) { ui.toast(`أكمل أولاً: ${r.missing.join('، ')}`, 'warn', 5000); return; }
          store.commit('discharge'); ui.toast('تم الخروج: أُغلقت الزيارة، رُحّلت الفاتورة، وأُرسل السرير للنظافة', 'ok', 5000); this.render(el);
        },
        start: (b) => ui.modal({
          title: 'بدء إجراءات الخروج',
          body: `<p class="small">${esc(store.patientName(b.dataset.p))}</p><div class="seg">${Object.entries(DTYPE).map(([k, t]) => `<button data-t="${k}">${t}</button>`).join('')}</div><p class="xs muted">الخروج ضد النصيحة يتطلب إقراراً موقعاً، والوفاة تلغي المواعيد والتذكيرات المستقبلية تلقائياً.</p>`,
          onMount: (m, close) => m.querySelectorAll('[data-t]').forEach((x) => x.addEventListener('click', () => {
            H().startDischarge(b.dataset.p, x.dataset.t); store.commit('discharge'); close(); this.render(el);
          })),
        }),
      });
    },
  };

  /* ======================= النظافة وتجهيز الأسرّة ======================= */
  EM.views.housekeeping = {
    title: () => 'النظافة وتجهيز الأسرّة',
    render(el) {
      const s = store.state;
      const jobs = s.housekeeping;
      const col = (st, title) => {
        const list = jobs.filter((j) => j.status === st).slice(0, st === 'done' ? 8 : 50);
        return `<section class="er-col hk-col"><header><b>${title}</b><span class="num muted">${list.length}</span></header><div class="er-cards">${list.map((j) => {
          const mins = EM.minsSince(j.createdAt);
          const over = st !== 'done' && mins > j.target;
          return `<article class="er-card ${over ? 'over' : ''}" style="--c:${st === 'done' ? 'var(--faience-500)' : over ? 'var(--rose-500)' : 'var(--saffron-500)'}">
            <div class="row between"><b class="small">${esc(wardOf(j.bedId))}</b><span class="xs num ${over ? 'v-bad' : 'muted'}">${st === 'done' ? fmt.time(j.doneAt) : fmt.minutes(mins)}</span></div>
            <div class="xs muted">${esc(j.type)} · المستهدف ${j.target} د</div>
            ${j.assignee ? `<div class="xs">${icon('user', 'sm')} ${esc(j.assignee)}</div>` : ''}
            <div class="btn-group">${st === 'pending' ? `<select class="input" data-change="who" data-id="${j.id}" aria-label="العامل"><option value="">إسناد إلى…</option>${s.housekeepingStaff.map((n) => `<option>${esc(n)}</option>`).join('')}</select>` : ''}
              ${st === 'in_progress' ? `<button class="btn sm primary" data-action="done" data-id="${j.id}">${icon('check', 'sm')} السرير جاهز</button>` : ''}</div>
          </article>`; }).join('') || '<div class="er-empty">لا توجد مهام</div>'}</div></section>`;
      };
      const doneToday = jobs.filter((j) => j.status === 'done' && j.doneAt);
      const avg = doneToday.length ? doneToday.reduce((a, j) => a + (new Date(j.doneAt) - new Date(j.createdAt)) / 60000, 0) / doneToday.length : 0;
      el.innerHTML = `<div class="page">
        ${ui.pageHead('النظافة وتجهيز الأسرّة', 'كل سرير يتحرر بالخروج أو النقل يصل هنا تلقائياً. عند انتهاء التجهيز يقترح النظام أول مريض ينتظر سريراً مناسباً.')}
        <div class="grid c4">
          ${ui.kpi('بانتظار البدء', jobs.filter((j) => j.status === 'pending').length)}
          ${ui.kpi('جارٍ التنفيذ', jobs.filter((j) => j.status === 'in_progress').length)}
          ${ui.kpi('متأخرة عن المستهدف', jobs.filter((j) => j.status !== 'done' && EM.minsSince(j.createdAt) > j.target).length, '', 'down')}
          ${ui.kpi('متوسط زمن التجهيز', doneToday.length ? fmt.minutes(avg) : '—', `${s.bedRequests.length} مريض ينتظر سريراً`)}
        </div>
        <div class="er-board hk-board">${col('pending', 'بانتظار البدء')}${col('in_progress', 'جارٍ التنظيف')}${col('done', 'جاهزة')}</div>
      </div>`;
      ui.bind(el, {
        who: (sel) => { const j = s.housekeeping.find((x) => x.id === sel.dataset.id); if (!sel.value) return; j.assignee = sel.value; j.status = 'in_progress'; j.startedAt = new Date().toISOString(); store.audit('بدء تنظيف سرير', 'housekeeping', j.id, { after: j.assignee }); store.commit('hk'); this.render(el); },
        done: (b) => {
          const j = s.housekeeping.find((x) => x.id === b.dataset.id);
          const req = H().cleanDone(j);
          store.commit('hk');
          if (req) ui.toast(`السرير جاهز ومناسب لـ ${store.patientName(req.patientId)} — افتح لوحة الأسرّة للتخصيص`, 'ok', 6000); else ui.toast('السرير متاح الآن', 'ok');
          this.render(el);
        },
      });
    },
  };

  /* ======================= العناية المركزة ======================= */
  const spark = (vals, lo, hi, warnLo) => {
    const w = 120, h = 34;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - lo) / (hi - lo)) * h}`).join(' ');
    const last = vals[vals.length - 1];
    return `<svg viewBox="0 0 ${w} ${h}" class="spark ${warnLo && last < warnLo ? 'bad' : ''}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
  };
  EM.views.icu = {
    title: () => 'العناية المركزة',
    render(el) {
      const s = store.state;
      const beds = s.beds.filter((b) => b.ward === 'W-ICU' || b.ward === 'W-NIC');
      el.innerHTML = `<div class="page">
        ${ui.pageHead('العناية المركزة والحضانات', 'لوحة مراقبة لكل سرير: الاتجاهات، الأجهزة، التنبيهات، والمهام المفتوحة. القراءات هنا توضيحية؛ في التشغيل الفعلي تأتي من أجهزة المراقبة.')}
        <div class="icu-grid">${beds.map((b) => {
          const p = b.patientId ? store.patient(b.patientId) : null;
          const m = s.icu[b.id];
          if (!p) return `<article class="panel icu-card empty-bed"><b class="bed-no num">${esc(b.label)}</b><span class="small muted">${H().wardName(b.ward).split(' — ')[0]}</span>${ui.pill('bed', b.status)}</article>`;
          const last = m?.series?.at(-1) || {};
          const alarms = [];
          if (last.spo2 < 92) alarms.push('انخفاض الأكسجين');
          if (last.map < 65) alarms.push('انخفاض الضغط المتوسط');
          if (last.hr > 120) alarms.push('تسارع النبض');
          const tasks = s.nursing.filter((t) => t.patientId === p.id && t.status === 'pending');
          const crit = s.lab.filter((l) => l.patientId === p.id && l.critical && !l.ackBy).length;
          return `<article class="panel icu-card ${alarms.length ? 'alarm' : ''}">
            <header class="row between"><div class="row" style="gap:10px"><b class="bed-no num">${esc(b.label)}</b><div><a href="#/patients/${esc(p.id)}" class="small" style="color:inherit;font-weight:500">${esc(p.name)}</a><div class="xs muted">${fmt.age(p.dob)} سنة · منذ ${fmt.minutes(EM.minsSince(b.since))}</div></div></div>
              ${p.id === s.featuredPatient ? '<span class="pill par">مريض العرض</span>' : ''}</header>
            ${m ? `<div class="icu-vitals">
              <div><small>النبض</small><b class="num ${last.hr > 120 ? 'v-bad' : ''}">${last.hr}</b>${spark(m.series.map((x) => x.hr), 50, 150)}</div>
              <div><small>الضغط المتوسط</small><b class="num ${last.map < 65 ? 'v-bad' : ''}">${last.map}</b>${spark(m.series.map((x) => x.map), 40, 110, 65)}</div>
              <div><small>الأكسجين %</small><b class="num ${last.spo2 < 92 ? 'v-bad' : ''}">${last.spo2}</b>${spark(m.series.map((x) => x.spo2), 80, 100, 92)}</div>
            </div>
            <div class="row wrap" style="gap:6px">${m.vent ? '<span class="pill info">تنفس صناعي</span>' : ''}${m.pressors ? '<span class="pill warn">أدوية رافعة للضغط</span>' : ''}<span class="pill plain">${esc(m.sedation)}</span>${m.lines.map((l) => `<span class="pill plain">${esc(l)}</span>`).join('')}</div>` : ''}
            ${alarms.length ? `<div class="callout bad">${icon('alert', 'sm')}<span class="small">${alarms.join(' · ')}</span></div>` : ''}
            <div class="xs muted">${tasks.length} مهمة تمريضية مفتوحة${crit ? ` · <b class="v-bad">${crit} نتيجة حرجة بلا إقرار</b>` : ''}</div>
          </article>`; }).join('')}</div>
      </div>`;
    },
  };

  /* ======================= صيانة الأجهزة الطبية ======================= */
  EM.views.biomed = {
    title: () => 'صيانة الأجهزة الطبية',
    render(el) {
      const s = store.state;
      const due = s.equipment.filter((e) => new Date(e.nextPm) < new Date(Date.now() + 3 * 864e5));
      const down = s.equipment.filter((e) => e.status !== 'يعمل');
      el.innerHTML = `<div class="page">
        ${ui.pageHead('صيانة الأجهزة الطبية', 'حالة كل جهاز حرج، الصيانة الوقائية القادمة، وأوامر الإصلاح. تعطل جهاز حرج يُبلغ القسم المتأثر فوراً.')}
        <div class="grid c4">
          ${ui.kpi('أجهزة مسجلة', s.equipment.length)}
          ${ui.kpi('خارج الخدمة', down.length, down.map((e) => e.name).join('، '), down.length ? 'down' : 'up')}
          ${ui.kpi('صيانة وقائية خلال 3 أيام', due.length)}
          ${ui.kpi('أوامر إصلاح مفتوحة', s.workOrders.filter((w) => w.status !== 'مغلق').length)}
        </div>
        <div class="grid c-2-1">
          <section class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الجهاز</th><th>المكان</th><th>الحالة</th><th>الصيانة الوقائية</th><th></th></tr></thead><tbody>
            ${s.equipment.map((e) => { const pmLate = new Date(e.nextPm) < new Date(); return `<tr><td><b class="small" style="font-weight:500">${esc(e.name)}</b>${e.critical ? ' <span class="pill bad plain">حرج</span>' : ''}<br><span class="num xs muted">${esc(e.id)} · ${esc(e.type)}</span></td><td class="small">${esc(e.location)}</td>
              <td><span class="pill ${e.status === 'يعمل' ? 'ok' : e.status === 'عطل' ? 'bad' : 'warn'}">${esc(e.status)}</span>${e.since && e.status !== 'يعمل' ? `<br><span class="xs muted">منذ ${fmt.minutes(EM.minsSince(e.since))}</span>` : ''}</td>
              <td class="small ${pmLate ? 'v-bad' : ''}">${pmLate ? 'متأخرة' : fmt.dateShort(e.nextPm)}</td>
              <td class="actions">${e.status === 'يعمل' ? `<button class="btn sm danger" data-action="fault" data-id="${e.id}">إبلاغ عطل</button>` : `<button class="btn sm primary" data-action="fix" data-id="${e.id}">عاد للعمل</button>`}</td></tr>`; }).join('')}
          </tbody></table></div></section>
          <section class="panel"><div class="panel-head"><h2>أوامر الإصلاح</h2></div><ul class="list">${s.workOrders.map((w) => { const e = s.equipment.find((x) => x.id === w.equipment); return `<li><div class="grow"><div class="row between"><b class="small" style="font-weight:500">${esc(e?.name)}</b><span class="pill ${w.status === 'مغلق' ? 'ok' : 'warn'}">${esc(w.status)}</span></div><div class="xs">${esc(w.text)}</div><div class="xs muted num">${esc(w.id)} · ${fmt.ago(w.at)}${w.tech ? ` · ${esc(w.tech)}` : ''}</div></div></li>`; }).join('') || `<li>${ui.empty('لا توجد أوامر')}</li>`}</ul></section>
        </div></div>`;
      ui.bind(el, {
        fault: (b) => {
          const e = s.equipment.find((x) => x.id === b.dataset.id);
          ui.modal({ title: `إبلاغ عطل — ${e.name}`, body: '<div class="field"><label for="ft">وصف العطل</label><textarea id="ft" class="input"></textarea></div>', foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn danger solid" data-ok>إرسال البلاغ</button>',
            onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => { const t = m.querySelector('#ft').value.trim(); if (!t) { ui.toast('اكتب وصف العطل', 'warn'); return; } H().equipmentFault(e, t); store.commit('biomed'); close(); this.render(el); }) });
        },
        fix: (b) => {
          const e = s.equipment.find((x) => x.id === b.dataset.id);
          e.status = 'يعمل'; e.since = null; e.nextPm = new Date(Date.now() + 90 * 864e5).toISOString();
          s.workOrders.filter((w) => w.equipment === e.id && w.status !== 'مغلق').forEach((w) => { w.status = 'مغلق'; w.closedAt = new Date().toISOString(); });
          store.audit('إعادة جهاز للخدمة', 'equipment', e.id); store.notify('ok', 'جهاز عاد للخدمة', `${e.name} — ${e.location}`, '#/biomed');
          store.commit('biomed'); this.render(el);
        },
      });
    },
  };

  /* ======================= الجودة والحوادث ======================= */
  EM.views.quality = {
    title: () => 'الجودة وسلامة المرضى',
    render(el) {
      const s = store.state;
      const erDoorTriage = s.er.filter((e) => e.level).length ? 6 + (s.er.filter((e) => !e.level).length * 2) : 0;
      const labLate = s.lab.filter((l) => l.stage !== 'verified' && new Date(l.dueAt) < new Date()).length;
      const labTotal = s.lab.filter((l) => l.stage !== 'verified').length || 1;
      const hkDone = s.housekeeping.filter((j) => j.doneAt);
      const turn = hkDone.length ? hkDone.reduce((a, j) => a + (new Date(j.doneAt) - new Date(j.createdAt)) / 60000, 0) / hkDone.length : 52;
      const ind = [
        ['زمن الوصول حتى الفرز', `${erDoorTriage} د`, 'المستهدف أقل من 10 دقائق', erDoorTriage <= 10],
        ['التزام المعمل بالزمن المستهدف', `${Math.round((1 - labLate / labTotal) * 100)}%`, 'المستهدف 90% أو أكثر', labLate / labTotal < 0.1],
        ['زمن تجهيز السرير بعد الخروج', fmt.minutes(turn), 'المستهدف 45 دقيقة', turn <= 45],
        ['إقرار النتائج الحرجة خلال 15 دقيقة', `${Math.round((s.lab.filter((l) => l.critical && l.ackBy).length / Math.max(1, s.lab.filter((l) => l.critical).length)) * 100)}%`, 'المستهدف 100%', s.lab.every((l) => !l.critical || l.ackBy)],
      ];
      el.innerHTML = `<div class="page">
        ${ui.pageHead('الجودة وسلامة المرضى', 'مؤشرات تُحسب لحظياً من التشغيل الفعلي، ونظام إبلاغ غير عقابي عن الحوادث مربوط بمسار التحقيق.', `<button class="btn primary" data-action="report">${icon('plus')} بلاغ جديد</button>`)}
        <div class="grid c4">${ind.map(([t, v, f, ok]) => ui.kpi(t, v, f, ok ? 'up' : 'down')).join('')}</div>
        <section class="panel"><div class="panel-head"><h2>بلاغات السلامة</h2><span class="small muted">الإبلاغ لا يُستخدم للعقاب — الهدف منع التكرار</span></div>
          <table class="tbl"><thead><tr><th>البلاغ</th><th>النوع</th><th>الدرجة</th><th>المكان</th><th>الوصف</th><th>الحالة</th></tr></thead><tbody>
            ${s.incidents.map((i) => `<tr><td class="num small">${esc(i.id)}<br><span class="xs muted">${fmt.ago(i.at)}</span></td><td class="small">${esc(i.kind)}</td><td><span class="pill ${i.severity === 'جسيم' ? 'bad' : i.severity === 'متوسط' ? 'warn' : 'plain'}">${esc(i.severity)}</span></td><td class="small">${esc(i.location)}</td><td class="small">${esc(i.text)}</td><td class="small">${esc(i.status)}</td></tr>`).join('')}
          </tbody></table></section>
      </div>`;
      ui.bind(el, {
        report: () => ui.modal({
          title: 'بلاغ سلامة جديد',
          body: `<div class="form-grid">
            <div class="field"><label for="i-k">النوع</label><select id="i-k" class="input">${['سقوط مريض', 'خطأ دوائي', 'عرض جانبي لدواء', 'عدوى مكتسبة', 'خطأ في التعريف بالمريض', 'عطل جهاز أثر على الرعاية', 'أخرى'].map((x) => `<option>${x}</option>`).join('')}</select></div>
            <div class="field"><label for="i-s">درجة الضرر</label><select id="i-s" class="input">${['لم يصل للمريض', 'بسيط', 'متوسط', 'جسيم'].map((x) => `<option>${x}</option>`).join('')}</select></div>
            <div class="field full"><label for="i-l">المكان</label><input id="i-l" class="input"></div>
            <div class="field full"><label for="i-t">ماذا حدث؟</label><textarea id="i-t" class="input"></textarea></div></div>`,
          foot: '<button class="btn" data-close="1">إلغاء</button><button class="btn primary" data-ok>إرسال البلاغ</button>',
          onMount: (m, close) => m.querySelector('[data-ok]').addEventListener('click', () => {
            const text = m.querySelector('#i-t').value.trim(); const loc = m.querySelector('#i-l').value.trim();
            if (!text || !loc) { ui.toast('اكتب المكان ووصف ما حدث', 'warn'); return; }
            H().reportIncident({ kind: m.querySelector('#i-k').value, severity: m.querySelector('#i-s').value, location: loc, text });
            store.commit('quality'); close(); ui.toast('تم الإرسال وبدأ مسار التحقيق', 'ok'); this.render(el);
          }),
        }),
      });
    },
  };

  /* ======================= الموارد البشرية والمناوبات ======================= */
  const SHIFT_CLS = { 'صباحي': 'sh-m', 'مسائي': 'sh-e', 'ليلي': 'sh-n', 'راحة': 'sh-off' };
  const currentShift = () => { const h = new Date().getHours(); return h >= 8 && h < 16 ? 'صباحي' : h >= 16 ? 'مسائي' : 'ليلي'; };
  EM.views.hr = {
    title: () => 'الموارد البشرية والمناوبات',
    render(el) {
      const s = store.state;
      const vs = ui.vstate('hr', { dept: '' });
      const today = (new Date().getDay() + 1) % 7; // السبت بداية الأسبوع
      const shift = currentShift();
      const onDuty = s.staffDir.filter((x) => s.roster[x.id][today] === shift);
      const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
      const erPts = s.er.filter((e) => !e.closed).length;
      const erNurses = onDuty.filter((x) => x.title === 'تمريض' && x.dept === 'er').length;
      const icuPts = s.beds.filter((b) => b.ward === 'W-ICU' && b.patientId).length;
      const icuNurses = onDuty.filter((x) => x.title === 'تمريض' && x.dept === 'icu').length;
      const list = s.staffDir.filter((x) => !vs.dept || x.dept === vs.dept);
      el.innerHTML = `<div class="page">
        ${ui.pageHead('الموارد البشرية والمناوبات', `المناوبة الحالية: <b>${shift}</b>. النظام يقارن عدد الطاقم المناوب بعدد المرضى في كل قسم.`)}
        <div class="grid c4">
          ${ui.kpi('على رأس العمل الآن', onDuty.length, `من ${s.staffDir.length} موظفاً`)}
          ${ui.kpi('الطوارئ: مريض لكل ممرض', erNurses ? (erPts / erNurses).toFixed(1) : '—', `${erPts} حالة · ${erNurses} ممرض`, erNurses && erPts / erNurses > 4 ? 'down' : 'up')}
          ${ui.kpi('العناية: مريض لكل ممرض', icuNurses ? (icuPts / icuNurses).toFixed(1) : '—', 'المستهدف 2 أو أقل', icuNurses && icuPts / icuNurses > 2 ? 'down' : 'up')}
          ${ui.kpi('طلبات إجازة', s.leaveRequests.filter((l) => l.status === 'بانتظار الاعتماد').length, 'بانتظار الاعتماد')}
        </div>
        <section class="panel">
          <div class="toolbar"><select class="input" data-change="dept"><option value="">كل الأقسام</option>${ui.options([...new Set(s.staffDir.map((x) => x.dept))].map((d) => [d, EM.REF.deptName(d)]), vs.dept)}</select><span class="xs muted">اضغط على أي خانة لتغيير المناوبة</span></div>
          <div class="tbl-wrap"><table class="tbl roster"><thead><tr><th>الموظف</th>${DAYS.map((d, i) => `<th class="${i === today ? 'today' : ''}">${d}</th>`).join('')}</tr></thead><tbody>
            ${list.map((x) => `<tr><td><b class="small" style="font-weight:500">${esc(x.name)}</b><br><span class="xs muted">${esc(x.title)} · ${esc(EM.REF.deptName(x.dept))}</span></td>${s.roster[x.id].map((sh, i) => `<td class="${i === today ? 'today' : ''}"><button class="shift ${SHIFT_CLS[sh]}" data-action="cycle" data-id="${x.id}" data-d="${i}">${sh}</button></td>`).join('')}</tr>`).join('')}
          </tbody></table></div>
        </section>
        <section class="panel"><div class="panel-head"><h2>طلبات الإجازات</h2></div><ul class="list">${s.leaveRequests.map((l) => { const st = s.staffDir.find((x) => x.id === l.staffId); return `<li><div class="grow"><b class="small" style="font-weight:500">${esc(st?.name)}</b> <span class="xs muted">— ${esc(l.type)} · ${l.days} يوم من ${fmt.dateShort(l.from)}</span><div class="xs">${esc(l.reason)}</div></div>${l.status === 'بانتظار الاعتماد' ? `<button class="btn sm primary" data-action="leave" data-id="${l.id}" data-ok="1">اعتماد</button><button class="btn sm" data-action="leave" data-id="${l.id}" data-ok="0">رفض</button>` : `<span class="pill ${l.status === 'معتمد' ? 'ok' : 'bad'}">${esc(l.status)}</span>`}</li>`; }).join('')}</ul></section>
      </div>`;
      ui.bind(el, {
        dept: (sel) => { vs.dept = sel.value; this.render(el); },
        cycle: (b) => { const order = ['صباحي', 'مسائي', 'ليلي', 'راحة']; const arr = s.roster[b.dataset.id]; const d = Number(b.dataset.d); arr[d] = order[(order.indexOf(arr[d]) + 1) % 4]; store.audit('تعديل جدول المناوبات', 'roster', b.dataset.id, { after: arr[d] }); store.commit('hr'); this.render(el); },
        leave: (b) => {
          const l = s.leaveRequests.find((x) => x.id === b.dataset.id);
          const ok = b.dataset.ok === '1';
          if (ok) {
            const st = s.staffDir.find((x) => x.id === l.staffId);
            const same = s.staffDir.filter((x) => x.dept === st.dept && x.title === st.title && x.id !== st.id).length;
            if (same < 2) ui.toast(`تنبيه: اعتماد الإجازة يترك ${EM.REF.deptName(st.dept)} بعدد قليل من ${st.title}`, 'warn', 5000);
          }
          l.status = ok ? 'معتمد' : 'مرفوض';
          store.audit(ok ? 'اعتماد إجازة' : 'رفض إجازة', 'leave', l.id); store.commit('hr'); this.render(el);
        },
      });
    },
  };

  /* ======================= السجلات الطبية ======================= */
  EM.views.records = {
    title: () => 'السجلات الطبية',
    render(el) {
      const s = store.state;
      const incomplete = s.patients.filter((p) => p.incomplete);
      const dups = s.patients.filter((p) => p.duplicateOf);
      const FLOW = ['جديد', 'بانتظار موافقة المريض', 'قيد الإعداد', 'جاهز للتسليم', 'تم التسليم'];
      el.innerHTML = `<div class="page">
        ${ui.pageHead('السجلات الطبية', 'جودة بيانات الملفات: الملفات المؤقتة الناقصة، السجلات المكررة، وطلبات صرف التقارير بعد التحقق من موافقة المريض.')}
        <div class="grid c3">
          ${ui.kpi('ملفات ناقصة البيانات', incomplete.length, 'تحتاج استكمالاً', incomplete.length ? 'down' : 'up')}
          ${ui.kpi('سجلات مكررة محتملة', dups.length, 'تحتاج مراجعة ودمجاً', dups.length ? 'down' : 'up')}
          ${ui.kpi('طلبات تقارير مفتوحة', s.recordRequests.filter((r) => r.status !== 'تم التسليم').length)}
        </div>
        <div class="grid c2">
          <section class="panel"><div class="panel-head"><h2>ملفات تحتاج استكمالاً أو دمجاً</h2></div><ul class="list">
            ${[...incomplete.map((p) => ({ p, t: 'بيانات ناقصة', c: 'warn' })), ...dups.map((p) => ({ p, t: `مكرر محتمل لـ ${p.duplicateOf}`, c: 'par' }))].map(({ p, t, c }) => `<li>${ui.patientCell(p.id)}<span class="grow"><span class="pill ${c}">${esc(t)}</span></span><a class="btn sm" href="#/patients/${esc(p.id)}">معالجة</a></li>`).join('') || `<li>${ui.empty('كل الملفات مكتملة', '', '', 'check')}</li>`}
          </ul></section>
          <section class="panel"><div class="panel-head"><h2>طلبات التقارير والنسخ</h2></div><ul class="list">
            ${s.recordRequests.map((r) => { const i = FLOW.indexOf(r.status); const next = FLOW[i + 1]; return `<li><div class="grow"><b class="small" style="font-weight:500">${esc(r.type)}</b><div class="xs muted">${esc(store.patientName(r.patientId))} · الطالب: ${esc(r.requester)} · ${fmt.ago(r.at)}</div><span class="pill ${r.status === 'تم التسليم' ? 'ok' : r.status.includes('موافقة') ? 'warn' : 'info'}">${esc(r.status)}</span></div>${next ? `<button class="btn sm" data-action="adv" data-id="${r.id}">${r.status.includes('موافقة') ? 'تأكيد موافقة المريض' : next}</button>` : ''}</li>`; }).join('')}
          </ul></section>
        </div></div>`;
      ui.bind(el, {
        adv: (b) => {
          const r = s.recordRequests.find((x) => x.id === b.dataset.id);
          const i = FLOW.indexOf(r.status);
          const go = (why) => { r.status = FLOW[i + 1]; store.audit(`طلب سجل طبي: ${r.status}`, 'record', r.id, { reason: why }); store.commit('records'); this.render(el); };
          if (r.status.includes('موافقة') || (r.requester !== 'المريض' && FLOW[i + 1] === 'تم التسليم')) ui.confirm({ title: 'موافقة المريض', message: 'لا تُصرف بيانات المريض لطرف ثالث إلا بموافقة موثقة. اكتب مرجع الموافقة.', reason: true, confirm: 'تأكيد', onOk: go });
          else go();
        },
      });
    },
  };
})();
