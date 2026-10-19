/* لوحة القيادة التنفيذية — «نبض المستشفى» */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;

  function stages(s) {
    const uniq = (arr) => new Set(arr).size;
    const notDone = (x) => x.stage !== 'verified';
    return [
      { key: 'reg', label: 'الاستقبال', sub: 'وصول وتسجيل', link: '#/appointments',
        n: s.appointments.filter((a) => a.status === 'arrived').length + s.er.filter((e) => e.status === 'waiting_triage').length,
        hot: s.er.filter((e) => e.status === 'waiting_triage').length },
      { key: 'triage', label: 'الفرز والتمريض', sub: 'علامات حيوية وأولوية', link: '#/emergency',
        n: s.er.filter((e) => e.status === 'triaged').length + s.appointments.filter((a) => a.status === 'nurse').length,
        hot: s.er.filter((e) => e.level && e.level <= 2 && e.status === 'triaged').length },
      { key: 'consult', label: 'الكشف', sub: 'طوارئ وعيادات', link: '#/clinic',
        n: s.er.filter((e) => e.status === 'in_assessment').length + s.appointments.filter((a) => a.status === 'in_consult').length, hot: 0 },
      { key: 'dx', label: 'التشخيص', sub: 'معمل وأشعة', link: '#/lab',
        n: uniq([...s.lab.filter(notDone), ...s.rad.filter(notDone)].map((x) => x.patientId)),
        hot: s.lab.filter((x) => x.critical && !x.ackBy).length },
      { key: 'rx', label: 'العلاج', sub: 'مراجعة وصرف', link: '#/pharmacy',
        n: uniq(s.rx.filter((x) => ['new', 'verified', 'on_hold'].includes(x.status)).map((x) => x.patientId)),
        hot: s.rx.filter((x) => x.status === 'on_hold').length },
      { key: 'ipd', label: 'الإقامة', sub: 'أقسام وعناية', link: '#/beds',
        n: s.beds.filter((b) => b.status === 'occupied').length, hot: s.bedRequests.length },
      { key: 'out', label: 'الخروج', sub: 'جاهز للخروج اليوم', link: '#/beds',
        n: s.beds.filter((b) => b.dischargeReady).length + s.er.filter((e) => e.disposition === 'discharge').length, hot: 0 },
    ];
  }

  /* شريط «نهر المرضى»: عرض الشريط يتناسب مع عدد المرضى في كل مرحلة */
  function river(st) {
    const W = 1100, H = 230, mid = 118, pad = 50;
    const step = (W - pad * 2) / (st.length - 1);
    const max = Math.max(...st.map((x) => x.n), 1);
    const half = (n) => 10 + Math.sqrt(n / max) * 58;
    // في الواجهة العربية يتدفق النهر من اليمين إلى اليسار
    const pts = st.map((x, i) => ({ x: W - pad - i * step, h: half(x.n), ...x }));
    const curve = (sign) => pts.map((p, i) => {
      if (i === 0) return `M ${p.x} ${mid + sign * p.h}`;
      const q = pts[i - 1];
      const cx = (q.x + p.x) / 2;
      return `C ${cx} ${mid + sign * q.h}, ${cx} ${mid + sign * p.h}, ${p.x} ${mid + sign * p.h}`;
    }).join(' ');
    const top = curve(-1);
    const bottom = curve(1).replace(/^M/, 'L');
    // نعكس المسار السفلي لإغلاق الشكل
    const bPts = pts.slice().reverse();
    const bottomRev = bPts.map((p, i) => {
      if (i === 0) return `L ${p.x} ${mid + p.h}`;
      const q = bPts[i - 1];
      const cx = (q.x + p.x) / 2;
      return `C ${cx} ${mid + q.h}, ${cx} ${mid + p.h}, ${p.x} ${mid + p.h}`;
    }).join(' ');
    void bottom;
    const r = EM.rng(st.reduce((a, x) => a + x.n * 7, 3));
    let dots = '';
    pts.forEach((p, i) => {
      const count = Math.min(p.n, 18);
      for (let k = 0; k < count; k++) {
        const dx = Math.max(pad - p.x + 6, Math.min(W - pad - p.x - 6, (r.next() - 0.5) * step * 0.55));
        const dy = (r.next() - 0.5) * p.h * 1.5;
        const hot = k < p.hot;
        dots += `<circle cx="${(p.x + dx).toFixed(1)}" cy="${(mid + dy).toFixed(1)}" r="${hot ? 5 : 3.4}" class="${hot ? 'rv-hot' : 'rv-dot'}" style="--d:${(i * 0.08 + k * 0.02).toFixed(2)}s"/>`;
      }
    });
    return `
      <svg class="river-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="توزيع المرضى على مراحل الرحلة العلاجية الآن">
        <defs><linearGradient id="rvg" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#3FD1C4" stop-opacity=".55"/><stop offset=".55" stop-color="#3A55A8" stop-opacity=".65"/><stop offset="1" stop-color="#3FD1C4" stop-opacity=".45"/></linearGradient></defs>
        <path d="${top} ${bottomRev} Z" fill="url(#rvg)"/>
        ${pts.map((p) => `<line x1="${p.x}" x2="${p.x}" y1="${mid - p.h - 8}" y2="${mid + p.h + 8}" class="rv-tick"/>`).join('')}
        ${dots}
      </svg>
      <div class="river-labels">${pts.map((p) => `
        <a class="rv-stage" href="${p.link}" style="right:${((W - p.x) / W) * 100}%">
          <b class="num">${p.n}</b><span>${esc(p.label)}</span><small>${esc(p.sub)}</small>
          ${p.hot ? `<em>${p.hot} يحتاج انتباه</em>` : ''}
        </a>`).join('')}</div>`;
  }

  /* رحلة «مريض العرض» عبر الأقسام — توضح ترابط النظام في لمحة */
  function featured() {
    const s = store.state;
    const p = store.patient(s.featuredPatient);
    if (!p) return '';
    const loc = EM.H.locate(p.id);
    const steps = EM.H.journey(p.id);
    return `<section class="panel feat">
      <div class="feat-head"><div><span class="xs muted">تتبّع رحلة مريض عبر الأقسام</span><h2><a href="#/patients/${esc(p.id)}" style="color:inherit">${esc(p.name)}</a></h2>
        <span class="small muted">${fmt.age(p.dob)} سنة · الآن في <b>${esc(loc.label)}</b> · المستحق ${fmt.money(EM.H.balance(p.id))}</span></div>
        <a class="btn" href="#/patients/${esc(p.id)}">${icon('user', 'sm')} فتح جواز المريض</a></div>
      <ol class="journey">${steps.map((j) => `<li class="j-${j.state}"><span class="j-dot"></span><b>${esc(j.dept)}</b><span>${esc(j.label)}</span><time>${fmt.time(j.at)}</time></li>`).join('')}</ol>
    </section>`;
  }

  EM.views.dashboard = {
    title: () => 'لوحة القيادة',
    render(el) {
      const s = store.state;
      const st = stages(s);
      const occ = s.beds.filter((b) => b.status === 'occupied').length;
      const usable = s.beds.filter((b) => b.status !== 'maintenance').length;
      const erWaits = s.er.filter((e) => e.status !== 'disposition').map((e) => EM.minsSince(e.arrivedAt));
      const avgWait = erWaits.length ? erWaits.reduce((a, b) => a + b, 0) / erWaits.length : 0;
      const labDone = s.lab.filter((l) => l.stage === 'verified');
      const labOnTime = s.lab.filter((l) => l.stage !== 'verified' && new Date(l.dueAt) < new Date()).length;
      const todayRev = s.invoices.reduce((a, i) => a + i.paid, 0);
      const tasks = store.openTasks();
      const overdue = tasks.filter((t) => t.overdue);
      const instCount = s.instances.reduce((a, i) => (a[i.status] = (a[i.status] || 0) + 1, a), {});
      const u = store.user();

      const alerts = [
        ...s.lab.filter((l) => l.critical && !l.ackBy).map((l) => ({ k: 'bad', t: 'نتيجة حرجة بانتظار الإقرار', b: `${EM.REF.labTests.find((x) => x.code === l.test)?.name} — ${store.patientName(l.patientId)}`, at: l.orderedAt, link: '#/lab' })),
        ...s.er.filter((e) => e.status === 'waiting_triage').map((e) => ({ k: 'bad', t: 'بانتظار الفرز', b: `${e.patientId ? store.patientName(e.patientId) : e.tempName} — ${e.complaint}`, at: e.arrivedAt, link: '#/emergency' })),
        ...overdue.slice(0, 4).map((t) => ({ k: 'warn', t: 'مهمة متأخرة', b: `${t.node.label} — ${t.def.name}`, at: t.due, link: `#/workflows/instance/${t.inst.id}` })),
        ...EM.REF.drugs.filter((d) => d.stock < d.min).map((d) => ({ k: 'warn', t: 'مخزون أقل من الحد الأدنى', b: `${d.name}: ${d.stock} متبقٍ`, at: null, link: '#/inventory' })),
      ];

      const deptLoad = [
        ['الطوارئ', s.er.filter((e) => e.status !== 'disposition').length, 14],
        ['العيادات', s.appointments.filter((a) => ['arrived', 'nurse', 'in_consult'].includes(a.status)).length, 15],
        ['المعمل', s.lab.filter((l) => l.stage !== 'verified').length, 30],
        ['الأشعة', s.rad.filter((r) => r.stage !== 'verified').length, 14],
        ['الصيدلية', s.rx.filter((r) => r.status !== 'dispensed' && r.status !== 'cancelled').length, 15],
        ['العمليات', s.surgeries.filter((x) => x.status !== 'done').length, 12],
      ];

      el.innerHTML = `
      <div class="page">
        ${ui.pageHead(`${new Date().getHours() >= 5 && new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'}، ${esc(u.name)}`, `${fmt.day(new Date())} ${fmt.date(new Date())} — صورة لحظية لما يحدث في كل أقسام المستشفى.`,
          `<a class="btn" href="#/workflows/monitor">${icon('monitor')} مراقبة التنفيذ</a>${store.can('workflows.view') ? `<a class="btn dark" href="#/admin/workflows">${icon('flow')} مصمم سير العمل</a>` : ''}`)}

        <section class="panel river" aria-labelledby="riverT">
          <div class="river-head">
            <div><h2 id="riverT">نبض المستشفى الآن</h2><p>كل نقطة مريض في مرحلة من رحلته. سُمك النهر يعكس الضغط على المرحلة، والنقاط الزعفرانية تحتاج انتباهاً.</p></div>
            <div class="river-legend"><span><i class="rv-dot-l"></i> مريض</span><span><i class="rv-hot-l"></i> يحتاج انتباه</span></div>
          </div>
          <div class="river-body">${river(st)}</div>
        </section>

        ${featured()}

        <div class="grid c4">
          ${ui.kpi('إشغال الأسرّة', `${Math.round((occ / usable) * 100)}%`, `${occ} من ${usable} سريراً صالحاً`, occ / usable > 0.85 ? 'down' : '')}
          ${ui.kpi('متوسط الانتظار بالطوارئ', fmt.minutes(avgWait), `${erWaits.length} حالة نشطة`, avgWait > 60 ? 'down' : 'up')}
          ${ui.kpi('تحاليل متأخرة عن الزمن المستهدف', labOnTime, `${labDone.length} نتيجة صادرة اليوم`, labOnTime ? 'down' : 'up')}
          ${ui.kpi('المحصّل من المرضى', fmt.money(todayRev), `${s.invoices.filter((i) => i.status === 'posted' || i.status === 'partial').length} فاتورة مستحقة`)}
        </div>

        <div class="grid c-2-1">
          <section class="panel">
            <div class="panel-head"><h2>الضغط على الأقسام</h2><span class="small muted">حالات مفتوحة مقابل السعة المعتادة</span></div>
            <div class="panel-body stack" style="gap:14px">
              ${deptLoad.map(([n, v, cap]) => { const p = Math.min(100, Math.round((v / cap) * 100)); return `
                <div class="load-row"><span>${esc(n)}</span><div class="meter ${p > 85 ? 'bad' : p > 65 ? 'warn' : ''}"><span style="width:${p}%"></span></div><b class="num">${v}<small class="muted"> / ${cap}</small></b></div>`; }).join('')}
            </div>
          </section>
          <section class="panel assist-panel">
            <div class="panel-head"><h2>${icon('sparkle', 'sm')} مساعد التشغيل</h2><span class="small muted">اقتراحات من حالة كل الأقسام الآن</span></div>
            ${EM.insightList(EM.insights(), 6)}
          </section>
        </div>

        <div class="grid c3">
          <section class="panel">
            <div class="panel-head"><h2>تنفيذ سير العمل</h2><a class="small" href="#/workflows/monitor">التفاصيل</a></div>
            <div class="panel-body">
              <div class="stackbar">${['running', 'completed', 'paused', 'failed', 'cancelled'].map((k) => instCount[k] ? `<span class="sb-${k}" style="flex:${instCount[k]}" title="${ui.statusText('inst', k)}"></span>` : '').join('')}</div>
              <div class="sb-legend">${['running', 'completed', 'paused', 'failed'].map((k) => `<span><i class="sb-${k}"></i>${ui.statusText('inst', k)} <b class="num">${instCount[k] || 0}</b></span>`).join('')}</div>
              <div class="callout ${overdue.length ? 'warn' : 'ok'}" style="margin-top:16px">${icon('clock')}<span><b class="num">${overdue.length}</b> مهمة تجاوزت زمن الخدمة من أصل <b class="num">${tasks.length}</b> مهمة مفتوحة.</span></div>
            </div>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>غرف العمليات اليوم</h2><a class="small" href="#/surgery">الجدول</a></div>
            <ul class="list">${['غرفة 1', 'غرفة 2', 'غرفة 3', 'غرفة 4'].map((room) => {
              const cur = s.surgeries.find((x) => x.room === room && ['in_progress', 'pre_op', 'recovery'].includes(x.status)) || s.surgeries.find((x) => x.room === room && x.status === 'scheduled');
              return `<li><b class="small" style="min-width:56px;font-weight:500">${room}</b><span class="grow small">${cur ? esc(cur.procedure) : '<span class="muted">لا توجد عمليات متبقية</span>'}</span>${cur ? ui.pill('or', cur.status) : ''}</li>`; }).join('')}</ul>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>آخر الأحداث</h2>${store.can('audit.view') ? '<a class="small" href="#/admin/audit">سجل التدقيق</a>' : ''}</div>
            <ul class="list">${s.audit.slice(0, 5).map((a) => `<li><span class="avatar" style="width:28px;height:28px;font-size:11px">${esc(EM.initials(EM.REF.userName(a.by).replace(/^(د\.|م\.|أ\.)\s*/, '')))}</span><div class="grow"><div class="small">${esc(a.action)}</div><div class="xs muted">${esc(EM.REF.userName(a.by))} · ${fmt.ago(a.at)}</div></div>${a.result === 'denied' ? '<span class="pill bad">مرفوض</span>' : ''}</li>`).join('')}</ul>
          </section>
        </div>
      </div>`;
    },
  };

  /* ---------- مهامي ---------- */
  EM.views.tasks = {
    title: () => 'مهامي',
    render(el) {
      const role = store.session.role;
      const all = store.openTasks();
      const mine = store.isOwner() ? all : all.filter((t) => t.node.config.role === role);
      const vs = ui.vstate('tasks', { scope: 'mine' });
      const list = vs.scope === 'mine' ? mine : all;
      el.innerHTML = `<div class="page">
        ${ui.pageHead('مهامي', `المهام المفتوحة في مسارات العمل والمسندة لدور «${esc(store.role().name)}». كل مهمة تنقل المسار للخطوة التالية عند إنجازها.`)}
        <section class="panel">
          <div class="toolbar"><div class="seg"><button data-action="scope" data-v="mine" class="${vs.scope === 'mine' ? 'on' : ''}">مسندة لدوري (${mine.length})</button><button data-action="scope" data-v="all" class="${vs.scope === 'all' ? 'on' : ''}">كل المهام المفتوحة (${all.length})</button></div></div>
          ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المهمة</th><th>سير العمل</th><th>المريض / المرجع</th><th>الدور</th><th>الاستحقاق</th><th></th></tr></thead><tbody>
          ${list.map((t) => `<tr>
            <td><b style="font-weight:500">${esc(t.node.label)}</b><br><span class="xs muted">${esc(EM.WF.TYPES[t.node.type].name)}</span></td>
            <td><a href="#/workflows/instance/${esc(t.inst.id)}">${esc(t.def.name)}</a><br><span class="xs muted num">${esc(t.inst.id)}</span></td>
            <td>${t.inst.patientId ? ui.patientCell(t.inst.patientId) : `<span class="num small">${esc(t.inst.ref || '—')}</span>`}</td>
            <td class="small">${esc(EM.REF.role(t.node.config.role)?.name || 'آلي')}</td>
            <td>${t.overdue ? `<span class="pill bad">متأخرة ${fmt.minutes(t.late)}</span>` : `<span class="pill warn">خلال ${fmt.minutes(-t.late)}</span>`}</td>
            <td class="actions">${t.inst.status === 'running' ? (t.node.type === 'approval'
              ? `<button class="btn sm primary" data-action="done" data-i="${esc(t.inst.id)}" data-t="${esc(t.token.id)}" data-o="approved">اعتماد</button> <button class="btn sm danger" data-action="done" data-i="${esc(t.inst.id)}" data-t="${esc(t.token.id)}" data-o="rejected">رفض</button>`
              : `<button class="btn sm primary" data-action="done" data-i="${esc(t.inst.id)}" data-t="${esc(t.token.id)}">إنجاز</button>`) : ui.pill('inst', t.inst.status)}</td>
          </tr>`).join('')}</tbody></table></div>` : ui.empty('لا توجد مهام مسندة لدورك الآن', 'جرّب «كل المهام المفتوحة» أو بدّل الدور من أعلى الصفحة.', '', 'check')}
        </section></div>`;
      ui.bind(el, {
        scope: (b) => { vs.scope = b.dataset.v; this.render(el); },
        done: (b) => {
          if (store.completeTask(b.dataset.i, b.dataset.t, b.dataset.o)) { ui.toast(b.dataset.o === 'rejected' ? 'تم الرفض وانتقل المسار' : 'تم الإنجاز وانتقل المسار للخطوة التالية', 'ok'); this.render(el); }
        },
      });
    },
  };
})();
