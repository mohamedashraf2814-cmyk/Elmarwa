/* مساعد التشغيل الذكي — قواعد تقرأ حالة المستشفى كلها وتقترح الإجراء التالي.
   يختص بالتشغيل فقط (أسرّة، طوابير، مخزون، طاقم، فواتير)، ولا يقترح تشخيصاً أو علاجاً أبداً. */
(function () {
  'use strict';
  const EM = window.EM;
  const RANK = { bad: 0, warn: 1, info: 2, ok: 3 };

  EM.insights = function () {
    const s = EM.store.state;
    const H = EM.H;
    const out = [];
    const add = (o) => out.push(o);
    const name = (pid) => EM.store.patientName(pid);

    /* ---------- الطوارئ ---------- */
    const waitTri = s.er.filter((e) => !e.closed && e.status === 'waiting_triage');
    const longTri = waitTri.filter((e) => EM.minsSince(e.arrivedAt) > 10);
    if (longTri.length) add({ id: 'er-triage', level: 'bad', dept: 'er', title: `${longTri.length} حالة تنتظر الفرز أكثر من 10 دقائق`, body: `أقدمها منذ ${EM.fmt.minutes(Math.max(...longTri.map((e) => EM.minsSince(e.arrivedAt))))}. الهدف أقل من 10 دقائق من الوصول.`, action: { label: 'فتح لوحة الطوارئ', link: '#/emergency' } });
    const hiWait = s.er.filter((e) => !e.closed && e.level && e.level <= 2 && e.status === 'triaged');
    if (hiWait.length) add({ id: 'er-hi', level: 'bad', dept: 'er', title: `${hiWait.length} حالة مستوى 1–2 لم يستلمها طبيب`, body: 'الحالات الحرجة تحتاج استلاماً فورياً من طبيب الطوارئ أو الاستشاري المناوب.', action: { label: 'استدعاء الاستشاري المناوب', run: () => { EM.store.notify('bad', 'استدعاء عاجل', `${hiWait.length} حالة حرجة بالطوارئ بانتظار طبيب`, '#/emergency'); EM.store.audit('استدعاء الاستشاري المناوب من المساعد', 'er', 'page'); return 'تم إرسال الاستدعاء'; } } });

    /* ---------- المعمل ---------- */
    const crit = s.lab.filter((l) => l.critical && l.stage === 'verified' && !l.ackBy);
    if (crit.length) add({ id: 'lab-crit', level: 'bad', dept: 'lab', title: `${crit.length} نتيجة حرجة لم يُقرّ بها الطبيب`, body: crit.slice(0, 2).map((l) => `${EM.REF.labTests.find((t) => t.code === l.test).name} — ${name(l.patientId)}`).join(' · '), action: { label: 'تصعيد للاستشاري', run: () => { crit.forEach((l) => { l.escalated = true; }); EM.store.notify('bad', 'تصعيد نتائج حرجة', `${crit.length} نتيجة بلا إقرار — مطلوب تدخل الاستشاري`, '#/lab'); EM.store.audit('تصعيد نتائج حرجة من المساعد', 'lab', 'critical'); return 'تم التصعيد للاستشاري'; } } });
    const statLate = s.lab.filter((l) => l.priority === 'STAT' && l.stage !== 'verified' && new Date(l.dueAt) < new Date());
    if (statLate.length) add({ id: 'lab-stat', level: 'warn', dept: 'lab', title: `${statLate.length} تحليل STAT متأخر`, body: 'رتّب قائمة عمل المعمل لتبدأ بها، أو تحقق من الأجهزة.', action: { label: 'فتح المعمل', link: '#/lab' } });
    const downLab = s.equipment.filter((e) => e.location === 'المعمل' && e.status !== 'يعمل');
    if (downLab.length) add({ id: 'lab-eq', level: 'warn', dept: 'lab', title: `${downLab[0].name} خارج الخدمة`, body: `متوقع تأخر نتائج ${s.lab.filter((l) => ['BMP', 'LFT', 'CRP'].includes(l.test) && l.stage !== 'verified').length} تحليل كيمياء. فكّر في التحويل لمعمل خارجي متعاقد.`, action: { label: 'متابعة أمر الإصلاح', link: '#/biomed' } });

    /* ---------- الأسرّة: مطابقة ذكية ---------- */
    const reqs = s.bedRequests.slice().sort((a, b) => H.prioRank(a.priority) - H.prioRank(b.priority) || a.requestedAt.localeCompare(b.requestedAt));
    reqs.forEach((r) => {
      const best = H.compatibleBeds(r)[0];
      if (best) add({ id: `bed-${r.id}`, level: r.priority === 'حرج' ? 'bad' : 'warn', dept: 'beds', title: `سرير متاح لـ ${name(r.patientId)}`, body: `ينتظر منذ ${EM.fmt.minutes(EM.minsSince(r.requestedAt))} (${r.priority}). الأنسب: ${H.wardName(best.ward)} — سرير ${best.label}${best.ward !== r.ward ? ' (جناح بديل)' : ''}.`, action: { label: `تخصيص سرير ${best.label}`, run: () => { const res = H.assignBed(r, best); return res.ok ? `تم: ${H.wardName(best.ward)} سرير ${best.label}` : res.msg; } } });
    });
    const blocked = reqs.filter((r) => !H.compatibleBeds(r).length);
    const cleaning = s.housekeeping.filter((j) => j.status !== 'done');
    if (blocked.length) add({ id: 'bed-none', level: 'bad', dept: 'beds', title: `${blocked.length} مريض ينتظر سريراً ولا يوجد سرير مناسب`, body: `${cleaning.length} سرير قيد التنظيف، و${s.beds.filter((b) => b.dischargeReady).length} مريض جاهز طبياً للخروج. تسريعهما يحرر أسرّة.`, action: { label: 'فتح النظافة', link: '#/housekeeping' } });
    const readyNoDis = s.beds.filter((b) => b.dischargeReady && b.patientId && !s.discharges.some((d) => d.patientId === b.patientId && d.status === 'in_progress'));
    if (readyNoDis.length) add({ id: 'dis-start', level: 'warn', dept: 'discharge', title: `${readyNoDis.length} مريض جاهز للخروج ولم تبدأ إجراءاته`, body: 'بدء الإجراءات الآن يوزع المهام على الصيدلية والحسابات والتمريض ويحرر الأسرّة أسرع.', action: { label: 'بدء الخروج للجميع', run: () => { readyNoDis.forEach((b) => H.startDischarge(b.patientId, 'normal')); return `بدأت إجراءات ${readyNoDis.length} خروج`; } } });
    const disReady = s.discharges.filter((d) => d.status === 'in_progress' && H.DISCHARGE_ITEMS.every(([k, , , req]) => !req || d.items[k]));
    if (disReady.length) add({ id: 'dis-fin', level: 'info', dept: 'discharge', title: `${disReady.length} خروج مكتمل البنود بانتظار الإتمام`, body: 'إتمامها يحرر الأسرّة ويرسلها للنظافة فوراً.', action: { label: 'فتح الخروج', link: '#/discharge' } });
    const hkLate = cleaning.filter((j) => EM.minsSince(j.createdAt) > j.target);
    if (hkLate.length) add({ id: 'hk-late', level: 'warn', dept: 'housekeeping', title: `${hkLate.length} سرير تأخر تجهيزه عن المستهدف`, body: `${hkLate.filter((j) => !j.assignee).length} منها غير مسند لأي عامل.`, action: { label: 'فتح النظافة', link: '#/housekeeping' } });
    const usable = s.beds.filter((b) => b.status !== 'maintenance').length;
    const occ = s.beds.filter((b) => b.status === 'occupied').length;
    if (occ / usable > 0.8) add({ id: 'occ', level: 'info', dept: 'beds', title: `الإشغال ${Math.round((occ / usable) * 100)}%`, body: `مع ${s.bedRequests.length} طلب دخول ينتظر و${s.beds.filter((b) => b.status === 'available').length} سرير متاح فقط. راجع الخروج المتوقع اليوم.`, action: { label: 'لوحة الأسرّة', link: '#/beds' } });

    /* ---------- الصيدلية والمخزون ---------- */
    const hold = s.rx.filter((r) => r.status === 'on_hold');
    if (hold.length) add({ id: 'rx-hold', level: 'warn', dept: 'pharmacy', title: `${hold.length} وصفة معلقة لتنبيه دوائي`, body: 'تحتاج مراجعة صيدلي وتواصلاً مع الطبيب الواصف — القرار سريري وليس آلياً.', action: { label: 'فتح الصيدلية', link: '#/pharmacy' } });
    const low = EM.REF.drugs.filter((d) => d.stock < d.min && !s.purchaseRequests.some((p) => p.item === d.code && !p.received));
    if (low.length) add({ id: 'stock', level: 'warn', dept: 'inventory', title: `${low.length} صنف تحت الحد الأدنى بلا طلب شراء`, body: low.map((d) => `${d.name} (${d.stock})`).join('، '), action: { label: 'إنشاء طلبات الشراء', run: () => { low.forEach((d) => s.purchaseRequests.unshift({ id: `PR-${340 + s.purchaseRequests.length}`, item: d.code, qty: d.min * 2, status: 'بانتظار الاعتماد', by: 'system', at: new Date().toISOString() })); EM.store.audit('إنشاء طلبات شراء من المساعد', 'purchase', low.map((d) => d.code).join(',')); return `أُنشئ ${low.length} طلب شراء`; } } });

    /* ---------- الطاقم ---------- */
    const h = new Date().getHours();
    const shift = h >= 8 && h < 16 ? 'صباحي' : h >= 16 ? 'مسائي' : 'ليلي';
    const today = (new Date().getDay() + 1) % 7;
    const duty = (dept) => s.staffDir.filter((x) => x.title === 'تمريض' && x.dept === dept && s.roster[x.id][today] === shift).length;
    const icuPts = s.beds.filter((b) => b.ward === 'W-ICU' && b.patientId).length;
    if (icuPts && icuPts / Math.max(1, duty('icu')) > 2) add({ id: 'staff-icu', level: 'warn', dept: 'hr', title: 'نقص تمريض في العناية المركزة', body: `${icuPts} مريض مقابل ${duty('icu')} ممرض في المناوبة ${shift}. المستهدف مريضان لكل ممرض.`, action: { label: 'جدول المناوبات', link: '#/hr' } });
    const erPts = s.er.filter((e) => !e.closed).length;
    if (erPts / Math.max(1, duty('er')) > 4) add({ id: 'staff-er', level: 'warn', dept: 'hr', title: 'ضغط على تمريض الطوارئ', body: `${erPts} حالة مقابل ${duty('er')} ممرض في المناوبة ${shift}.`, action: { label: 'جدول المناوبات', link: '#/hr' } });

    /* ---------- المالية ---------- */
    const rej = s.claims.filter((c) => c.status === 'rejected');
    if (rej.length) add({ id: 'claims', level: 'info', dept: 'billing', title: `${rej.length} مطالبة تأمين مرفوضة`, body: `بقيمة ${EM.fmt.money(rej.reduce((a, c) => a + c.amount, 0))}. أغلب الأسباب مستندات ناقصة ويمكن إعادة إرسالها.`, action: { label: 'فتح المطالبات', link: '#/billing' } });

    /* ---------- الأجهزة ---------- */
    const pm = s.equipment.filter((e) => e.critical && e.status === 'يعمل' && new Date(e.nextPm) < new Date(Date.now() + 2 * 864e5));
    if (pm.length) add({ id: 'pm', level: 'info', dept: 'biomed', title: `${pm.length} جهاز حرج يستحق الصيانة الوقائية خلال يومين`, body: pm.map((e) => e.name).join('، '), action: { label: 'صيانة الأجهزة', link: '#/biomed' } });

    /* ---------- سير العمل ---------- */
    const late = EM.store.openTasks().filter((t) => t.overdue);
    if (late.length) add({ id: 'wf-late', level: 'warn', dept: 'workflows', title: `${late.length} مهمة تجاوزت زمن الخدمة`, body: 'تم تصعيدها تلقائياً للمشرفين وفق قواعد كل مسار.', action: { label: 'المهام المتأخرة', link: '#/workflows/monitor' } });

    if (!out.length) add({ id: 'calm', level: 'ok', dept: 'all', title: 'التشغيل مستقر', body: 'لا توجد اختناقات أو تأخيرات تحتاج تدخلاً الآن.' });
    return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
  };

  /** تنفيذ اقتراح بنقرة */
  EM.runInsight = function (id) {
    const i = EM.insights().find((x) => x.id === id);
    if (!i?.action) return;
    if (i.action.link) { location.hash = i.action.link; return; }
    const msg = i.action.run();
    EM.store.commit('insight');
    EM.ui.toast(msg, 'ok', 4500);
    EM.rerender();
  };

  EM.insightList = function (list, limit = 99) {
    return `<ul class="insights">${list.slice(0, limit).map((i) => `
      <li class="ins-${i.level}"><span class="ins-dot"></span><div class="grow"><b>${EM.esc(i.title)}</b><p>${EM.esc(i.body)}</p></div>
        ${i.action ? `<button class="btn sm ${i.action.run ? 'primary' : ''}" data-insight="${EM.esc(i.id)}">${EM.esc(i.action.label)}</button>` : ''}</li>`).join('')}</ul>`;
  };
})();
