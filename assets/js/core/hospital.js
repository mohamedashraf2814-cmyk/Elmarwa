/* العقل المركزي للمستشفى — كل إجراء يعبر بين الأقسام يمر من هنا.
   الطلب من الطبيب يظهر في المعمل، والنتيجة تعود للطبيب، والخدمة تُحسب على فاتورة المريض،
   والخروج يحرر السرير ويرسل مهمة تنظيف، وانتهاء التنظيف يقترح السرير لأول طلب دخول مناسب. */
(function () {
  'use strict';
  const EM = window.EM;
  const H = {};
  const S = () => EM.store.state;
  const st = () => EM.store;
  const now = () => new Date().toISOString();
  const me = () => st().user()?.id || 'system';
  const wardName = (id) => EM.REF.wards.find((w) => w.id === id)?.name || id;
  H.wardName = wardName;

  /* ================= أين المريض الآن؟ ================= */
  H.locate = function (pid) {
    const s = S();
    const bed = s.beds.find((b) => b.patientId === pid);
    if (bed) return { kind: 'ipd', label: `${wardName(bed.ward)} — سرير ${bed.label}`, dept: bed.ward === 'W-ICU' ? 'icu' : bed.ward === 'W-NIC' ? 'nicu' : 'wards', link: '#/beds', bed };
    const or = s.surgeries.find((x) => x.patientId === pid && ['pre_op', 'in_progress', 'recovery'].includes(x.status));
    if (or) return { kind: 'or', label: `العمليات — ${or.room}`, dept: 'or', link: '#/surgery' };
    const er = s.er.find((e) => e.patientId === pid && !e.closed);
    if (er) return { kind: 'er', label: `الطوارئ — ${er.bay || 'الاستقبال'}`, dept: 'er', link: '#/emergency', er };
    const ap = s.appointments.find((a) => a.patientId === pid && ['arrived', 'nurse', 'in_consult'].includes(a.status));
    if (ap) { const c = EM.CLINICS.find((x) => x.id === ap.clinic); return { kind: 'opd', label: `العيادات — ${c.specialty}`, dept: 'opd', link: '#/appointments', ap }; }
    return { kind: 'out', label: 'خارج المستشفى', dept: null, link: null };
  };

  /* ================= الزيارات (المواجهات) ================= */
  H.encounter = (pid) => S().encounters.find((e) => e.patientId === pid && e.status === 'open');
  H.openEncounter = function (pid, type, dept, location) {
    const cur = H.encounter(pid);
    if (cur) { if (type === 'ipd' && cur.type !== 'ipd') { cur.type = 'ipd'; cur.dept = dept; cur.location = location; } return cur; }
    const e = { id: EM.uid('ENC').toUpperCase().slice(0, 14), patientId: pid, type, dept, location, startedAt: now(), endedAt: null, status: 'open', attending: me() };
    S().encounters.unshift(e);
    return e;
  };
  H.closeEncounter = function (pid, outcome) {
    const e = H.encounter(pid);
    if (!e) return;
    e.status = 'closed'; e.endedAt = now(); e.outcome = outcome;
    H.postInvoice(pid);
  };

  /* ================= الفوترة التلقائية (التقاط الرسوم) ================= */
  H.openInvoice = function (pid) {
    const s = S();
    let inv = s.invoices.find((i) => i.patientId === pid && i.status === 'draft');
    if (!inv) {
      const p = st().patient(pid);
      inv = { id: `INV-26-${EM.pad(8200 + s.invoices.length, 5)}`, patientId: pid, at: now(), items: [], total: 0, insShare: 0, patientShare: 0, paid: 0, status: 'draft', insurer: p?.insurer || 'NONE', adjustments: [] };
      s.invoices.unshift(inv);
    }
    return inv;
  };
  H.recalc = function (inv) {
    const ins = EM.REF.insurers.find((x) => x.id === inv.insurer);
    inv.total = inv.items.reduce((a, it) => a + it.qty * it.price, 0);
    inv.insShare = Math.round(inv.total * (ins?.coverage || 0));
    inv.patientShare = inv.total - inv.insShare;
    if (inv.status !== 'draft') {
      const due = inv.patientShare - inv.paid - inv.adjustments.reduce((a, x) => a + x.amount, 0);
      inv.status = due <= 0 ? 'paid' : inv.paid > 0 ? 'partial' : 'posted';
    }
  };
  /** تسجيل رسوم خدمة على فاتورة المريض المفتوحة — منفصل عن الطلب السريري */
  H.charge = function (pid, code, name, price, qty = 1, source = '') {
    if (!pid || !price) return null;
    const inv = H.openInvoice(pid);
    inv.items.push({ code, name, qty, price, source, at: now() });
    H.recalc(inv);
    return inv;
  };
  H.postInvoice = function (pid) {
    const inv = S().invoices.find((i) => i.patientId === pid && i.status === 'draft');
    if (!inv || !inv.items.length) return;
    inv.status = 'posted';
    H.recalc(inv);
    if (inv.insShare > 0) S().claims.unshift({ id: `CLM-${EM.pad(700 + S().claims.length, 4)}`, invoiceId: inv.id, insurer: inv.insurer, amount: inv.insShare, status: 'submitted', reason: null, at: now() });
    st().audit('ترحيل فاتورة', 'invoice', inv.id, { after: { total: inv.total } });
  };
  H.balance = function (pid) {
    return S().invoices.filter((i) => i.patientId === pid).reduce((a, i) => a + Math.max(0, i.patientShare - i.paid - i.adjustments.reduce((x, y) => x + y.amount, 0)), 0);
  };

  /* ================= المهام التمريضية ================= */
  H.nursingTask = function (pid, task, dueMin = 0, priority = 'عادية', source = '') {
    const loc = H.locate(pid);
    const t = { id: EM.uid('NT').toUpperCase().slice(0, 12), patientId: pid, bed: loc.bed?.id || loc.er?.bay || '—', task, due: EM.minsFromNow(dueMin), status: 'pending', priority, assignee: null, source };
    S().nursing.unshift(t);
    return t;
  };

  /* ================= الطوارئ ================= */
  H.erArrive = function ({ pid = null, tempName = null, complaint, bay = 'الاستقبال' }) {
    const e = { id: `ER-${EM.pad(900 + S().er.length, 4)}`, patientId: pid, tempName, complaint, arrivedAt: now(), level: null, status: 'waiting_triage', doctor: null, vitals: {}, bay };
    S().er.push(e);
    if (pid) { H.openEncounter(pid, 'er', 'er', bay); H.charge(pid, 'S-ER', 'كشف طوارئ', 400, 1, 'الطوارئ'); }
    st().notify('warn', 'وصول للطوارئ', `${pid ? st().patientName(pid) : tempName} — ${complaint}`, '#/emergency');
    st().audit('وصول حالة للطوارئ', 'er', e.id);
    return e;
  };
  H.erLink = function (e, pid) {
    e.patientId = pid; e.tempName = null;
    H.openEncounter(pid, 'er', 'er', e.bay);
    H.charge(pid, 'S-ER', 'كشف طوارئ', 400, 1, 'الطوارئ');
    st().audit('ربط حالة طوارئ مجهولة بملف', 'er', e.id, { after: pid });
  };
  H.erDisposition = function (e, disp, ward = 'W-MED') {
    e.disposition = disp; e.status = 'disposition';
    if (disp === 'admit') H.requestAdmission(e.patientId, { ward, reason: e.complaint, priority: e.level && e.level <= 2 ? 'حرج' : 'عاجل', from: 'الطوارئ', isolation: false });
    else { e.closed = true; H.closeEncounter(e.patientId, disp === 'transfer' ? 'تحويل لمنشأة أخرى' : 'خروج من الطوارئ'); if (disp === 'discharge') H.followUp(e.patientId, 'c1', 7); }
    st().audit(`قرار طوارئ: ${{ admit: 'دخول', discharge: 'خروج', transfer: 'تحويل' }[disp]}`, 'er', e.id);
  };

  /* ================= العيادات ================= */
  H.apptArrive = function (a) {
    const c = EM.CLINICS.find((x) => x.id === a.clinic);
    H.openEncounter(a.patientId, 'opd', 'opd', c.room);
    H.charge(a.patientId, c.doctor === 'u_con' ? 'S-CONS-C' : 'S-CONS', `كشف ${c.specialty}`, c.doctor === 'u_con' ? 600 : 350, 1, 'العيادات');
    st().startInstance('wf_outpatient', { insured: st().patient(a.patientId)?.insurer !== 'NONE', hasOrders: true }, a.patientId);
  };
  H.followUp = function (pid, clinic = 'c1', days = 14) {
    const ap = { id: EM.uid('AP').toUpperCase().slice(0, 12), clinic, patientId: pid, at: new Date(Date.now() + days * 864e5).toISOString(), type: 'متابعة', status: 'booked', queueNo: 0 };
    S().appointments.push(ap);
    return ap;
  };

  /* ================= الطلبات التشخيصية ================= */
  H.orderLab = function (pid, codes, { priority = 'روتيني', source = 'opd' } = {}) {
    const out = codes.map((code) => {
      const t = EM.REF.labTests.find((x) => x.code === code);
      const o = { id: `LAB-${EM.pad(32000 + S().lab.length, 6)}`, patientId: pid, test: code, priority, stage: 'ordered', orderedAt: now(), orderedBy: me(), source, result: null, critical: false, dueAt: EM.minsFromNow(priority === 'STAT' ? 30 : t.tat) };
      S().lab.unshift(o);
      return o;
    });
    if (out.length) {
      st().notify(priority === 'STAT' ? 'bad' : 'info', `طلب تحاليل ${priority === 'STAT' ? 'STAT' : ''}`, `${out.length} تحليل — ${st().patientName(pid)}`, '#/lab');
      st().startInstance('wf_lab', { specimenOk: true, critical: false }, pid);
      if (H.locate(pid).kind !== 'out') H.nursingTask(pid, `سحب عينات: ${out.map((o) => EM.REF.labTests.find((x) => x.code === o.test).name).join('، ')}`, priority === 'STAT' ? 5 : 30, priority === 'STAT' ? 'عالية' : 'عادية', 'المعمل');
    }
    return out;
  };
  H.labReleased = function (o) {
    const t = EM.REF.labTests.find((x) => x.code === o.test);
    H.charge(o.patientId, t.code, `تحليل: ${t.name}`, t.price, 1, 'المعمل');
    if (o.critical) st().notify('bad', 'نتيجة حرجة — مطلوب إقرار الطبيب', `${t.name}: ${o.result?.value} — ${st().patientName(o.patientId)}`, '#/lab');
    else st().notify('ok', 'نتيجة صادرة', `${t.name} — ${st().patientName(o.patientId)}`, `#/patients/${o.patientId}`);
  };
  H.orderRad = function (pid, codes, { indication = 'تقييم', priority = 'روتيني' } = {}) {
    const out = codes.map((code) => {
      const o = { id: `RAD-${EM.pad(7800 + S().rad.length, 5)}`, patientId: pid, study: code, stage: 'ordered', indication, priority, orderedAt: now(), scheduledAt: EM.minsFromNow(priority === 'STAT' ? 15 : 90), contrast: code === 'CT-AB', screening: EM.REF.imaging.find((x) => x.code === code)?.modality === 'MRI' ? 'مطلوب فحص المعادن والأجهزة المزروعة' : null };
      S().rad.unshift(o);
      return o;
    });
    if (out.length) st().notify('info', 'طلب أشعة', `${out.length} فحص — ${st().patientName(pid)}`, '#/radiology');
    return out;
  };
  H.radReleased = function (o) {
    const t = EM.REF.imaging.find((x) => x.code === o.study);
    H.charge(o.patientId, t.code, `أشعة: ${t.name}`, t.price, 1, 'الأشعة');
    st().notify(o.critical ? 'bad' : 'ok', o.critical ? 'نتيجة أشعة حرجة' : 'تقرير أشعة معتمد', `${t.name} — ${st().patientName(o.patientId)}`, `#/patients/${o.patientId}`);
  };

  /* ================= الدواء ================= */
  H.allergyConflict = function (pid, drugCode) {
    const p = st().patient(pid);
    const d = EM.REF.drugs.find((x) => x.code === drugCode);
    if (!p || !d) return null;
    if (p.allergies.some((a) => a.includes('البنسلين')) && /أموكسي|بنسلين/.test(d.name)) return `حساسية مسجلة من البنسلين وقد يتعارض معها «${d.name}»`;
    if (p.allergies.some((a) => a.includes('الأسبرين')) && /أسبرين/.test(d.name)) return `حساسية مسجلة من الأسبرين`;
    return null;
  };
  H.prescribe = function (pid, drug, { dose = '—', route = 'فم', freq = '', justification = null, location } = {}) {
    const conflict = H.allergyConflict(pid, drug);
    const rx = { id: `RX-${EM.pad(4500 + S().rx.length, 5)}`, patientId: pid, drug, dose, route, freq, prescriber: me(), at: now(),
      status: conflict ? 'on_hold' : 'new', alert: conflict ? { kind: 'حساسية', text: justification ? `${conflict} — تبرير الطبيب: ${justification}` : conflict } : null,
      location: location || H.locate(pid).label.split(' — ')[0] };
    S().rx.unshift(rx);
    if (conflict) st().audit('وصفة بتنبيه حساسية', 'rx', rx.id, { reason: justification });
    st().notify(conflict ? 'warn' : 'info', conflict ? 'وصفة معلقة لمراجعة الصيدلي' : 'وصفة جديدة', `${EM.REF.drugs.find((d) => d.code === drug).name} — ${st().patientName(pid)}`, '#/pharmacy');
    return rx;
  };
  H.dispense = function (rx, witness = null) {
    const d = EM.REF.drugs.find((x) => x.code === rx.drug);
    if (d.stock < 1) {
      rx.status = 'waiting_stock';
      if (!S().purchaseRequests.some((r) => r.item === d.code && !r.received)) S().purchaseRequests.unshift({ id: `PR-${330 + S().purchaseRequests.length}`, item: d.code, qty: d.min * 2, status: 'بانتظار الاعتماد', by: 'system', at: now() });
      st().notify('warn', 'نقص مخزون', `${d.name} غير متوفر — أُنشئ طلب شراء`, '#/inventory');
      return { ok: false, reason: 'stock' };
    }
    d.stock -= 1;
    S().stockMoves.unshift({ id: EM.uid('SM'), item: d.code, type: d.controlled ? 'صرف (مخدر — توقيع مزدوج)' : 'صرف', qty: -1, by: me(), at: now(), ref: rx.id, witness });
    rx.status = 'dispensed';
    H.charge(rx.patientId, d.code, `دواء: ${d.name}`, d.price, 1, 'الصيدلية');
    if (H.locate(rx.patientId).kind !== 'out') H.nursingTask(rx.patientId, `إعطاء دواء: ${d.name} ${rx.dose} ${rx.route}`, 15, d.controlled ? 'عالية' : 'عادية', 'الصيدلية');
    if (d.stock < d.min) st().notify('warn', 'مخزون أقل من الحد الأدنى', `${d.name}: ${d.stock} متبقٍ`, '#/inventory');
    st().audit('صرف دواء', 'rx', rx.id, { after: { stock: d.stock }, reason: witness ? `شاهد: ${witness}` : null });
    return { ok: true };
  };

  /* ================= الدخول والأسرّة ================= */
  H.isoCapable = (b) => b.ward === 'W-ICU' || Number(b.label) <= 2;
  H.requestAdmission = function (pid, { ward = 'W-MED', reason = '', priority = 'عاجل', from = 'العيادات', isolation = false } = {}) {
    if (S().bedRequests.some((r) => r.patientId === pid)) return null;
    const r = { id: `ADM-${1300 + S().bedRequests.length}`, patientId: pid, from, ward, reason, requestedAt: now(), priority, isolation };
    S().bedRequests.unshift(r);
    const match = H.compatibleBeds(r)[0];
    st().notify(priority === 'حرج' ? 'bad' : 'info', 'طلب دخول', `${st().patientName(pid)} ← ${wardName(ward)}${match ? ` · يوجد سرير متاح (${match.label})` : ' · لا يوجد سرير متاح حالياً'}`, '#/beds');
    st().audit('طلب دخول', 'admission', r.id);
    return r;
  };
  H.compatibleBeds = function (req) {
    const free = S().beds.filter((b) => b.status === 'available' && (!req.isolation || H.isoCapable(b)));
    return [...free.filter((b) => b.ward === req.ward), ...free.filter((b) => b.ward !== req.ward)];
  };
  H.assignBed = function (req, bed) {
    if (bed.status !== 'available') return { ok: false, msg: 'هذا السرير غير متاح' };
    if (req.isolation && !H.isoCapable(bed)) return { ok: false, msg: 'المريض يحتاج عزلاً — اختر سريراً مؤهلاً للعزل' };
    const s = S();
    bed.v = (bed.v || 0) + 1;
    bed.status = 'occupied'; bed.patientId = req.patientId; bed.since = now(); bed.isolation = req.isolation; bed.dischargeReady = false;
    s.bedRequests = s.bedRequests.filter((r) => r.id !== req.id);
    if (req.fromBed) {
      const old = s.beds.find((x) => x.id === req.fromBed);
      if (old) H.releaseBed(old, 'نقل داخلي');
    }
    const er = s.er.find((e) => e.patientId === req.patientId && !e.closed);
    if (er) er.closed = true;
    H.openEncounter(req.patientId, 'ipd', bed.ward === 'W-ICU' ? 'icu' : 'wards', `${wardName(bed.ward)} — سرير ${bed.label}`);
    const icu = bed.ward === 'W-ICU';
    H.charge(req.patientId, icu ? 'S-ICU' : 'S-BED', icu ? 'إقامة يوم — عناية مركزة' : 'إقامة يوم — قسم داخلي', icu ? 5500 : 1200, 1, 'الإقامة');
    H.nursingTask(req.patientId, 'التقييم التمريضي عند الدخول', 0, 'عالية', 'الدخول');
    H.nursingTask(req.patientId, 'قياس العلامات الحيوية', icu ? 60 : 240, icu ? 'عالية' : 'عادية', 'الدخول');
    H.nursingTask(req.patientId, 'تقييم خطر السقوط', 60, 'عادية', 'الدخول');
    st().startInstance('wf_admission', { bedAvailable: true }, req.patientId);
    st().notify('ok', 'تم تخصيص سرير', `${st().patientName(req.patientId)} — ${wardName(bed.ward)} سرير ${bed.label}`, '#/beds');
    st().audit('تخصيص سرير', 'bed', bed.id, { after: req.patientId });
    return { ok: true };
  };
  /** تحرير السرير يرسل مهمة تنظيف لقسم النظافة تلقائياً */
  H.releaseBed = function (bed, reason = 'خروج') {
    const iso = bed.isolation;
    bed.status = 'cleaning'; bed.patientId = null; bed.since = now(); bed.isolation = false; bed.dischargeReady = false;
    S().housekeeping.unshift({ id: `HK-${EM.pad(500 + S().housekeeping.length, 4)}`, bedId: bed.id, type: iso ? 'تعقيم بعد عزل' : 'تنظيف وتجهيز بعد ' + reason, createdAt: now(), status: 'pending', assignee: null, target: iso ? 90 : 45 });
    st().notify('info', 'سرير بانتظار التنظيف', `${wardName(bed.ward)} سرير ${bed.label}`, '#/housekeeping');
  };
  H.cleanDone = function (job) {
    const bed = S().beds.find((b) => b.id === job.bedId);
    job.status = 'done'; job.doneAt = now();
    if (bed) { bed.status = 'available'; bed.since = null; }
    st().audit('انتهاء تنظيف سرير', 'housekeeping', job.id);
    // ذكاء تشغيلي: أول طلب دخول يناسب هذا السرير
    const req = S().bedRequests.slice().sort((a, b) => H.prioRank(a.priority) - H.prioRank(b.priority) || a.requestedAt.localeCompare(b.requestedAt)).find((r) => !r.isolation || H.isoCapable(bed));
    if (bed && req) st().notify('ok', 'سرير جاهز لطلب دخول', `${wardName(bed.ward)} سرير ${bed.label} مناسب لـ ${st().patientName(req.patientId)}`, '#/beds');
    return req;
  };
  H.prioRank = (p) => ({ 'حرج': 0, 'عاجل': 1, 'مجدول': 2 }[p] ?? 3);

  /* ================= الخروج ================= */
  H.DISCHARGE_ITEMS = [
    ['summary', 'ملخص الخروج', 'الطبيب المعالج', true],
    ['medrec', 'مطابقة أدوية الخروج', 'الصيدلية', true],
    ['followup', 'حجز موعد المتابعة', 'الاستقبال', true],
    ['education', 'تثقيف المريض وتعليمات المنزل', 'التمريض', true],
    ['billing', 'المخالصة المالية', 'الحسابات', false],
  ];
  H.startDischarge = function (pid, type = 'normal') {
    const s = S();
    if (s.discharges.some((d) => d.patientId === pid && d.status === 'in_progress')) return null;
    const bed = s.beds.find((b) => b.patientId === pid);
    const d = { id: `DIS-${EM.pad(200 + s.discharges.length, 4)}`, patientId: pid, bedId: bed?.id || null, type, startedAt: now(), status: 'in_progress', by: me(), items: {} };
    H.DISCHARGE_ITEMS.forEach(([k]) => { d.items[k] = null; });
    s.discharges.unshift(d);
    if (bed) bed.dischargeReady = true;
    st().startInstance('wf_discharge', { type }, pid);
    st().notify('info', 'بدء إجراءات خروج', `${st().patientName(pid)} — الصيدلية والحسابات والتمريض لديهم مهام`, '#/discharge');
    H.nursingTask(pid, 'تجهيز للخروج وتثقيف المريض', 60, 'عادية', 'الخروج');
    st().audit('بدء إجراءات الخروج', 'discharge', d.id, { after: type });
    return d;
  };
  H.dischargeItem = function (d, key) {
    d.items[key] = { by: me(), at: now() };
    if (key === 'followup') H.followUp(d.patientId, 'c1', 14);
    if (key === 'billing') H.postInvoice(d.patientId);
    st().audit(`إنجاز بند خروج: ${key}`, 'discharge', d.id);
  };
  H.finishDischarge = function (d) {
    const missing = H.DISCHARGE_ITEMS.filter(([k, , , req]) => req && !d.items[k] && d.type === 'normal');
    if (missing.length) return { ok: false, missing: missing.map((m) => m[1]) };
    const bed = S().beds.find((b) => b.id === d.bedId);
    if (bed) H.releaseBed(bed, 'خروج');
    d.status = 'done'; d.finishedAt = now();
    H.closeEncounter(d.patientId, { normal: 'خروج', ama: 'خروج ضد النصيحة الطبية', death: 'وفاة', transfer: 'تحويل' }[d.type]);
    if (d.type === 'death') S().appointments.filter((a) => a.patientId === d.patientId && a.status === 'booked').forEach((a) => { a.status = 'cancelled'; });
    st().notify('ok', 'اكتمل الخروج', `${st().patientName(d.patientId)} — السرير أُرسل للتنظيف`, '#/housekeeping');
    st().audit('إتمام الخروج', 'discharge', d.id);
    return { ok: true };
  };

  /* ================= العمليات ================= */
  H.surgeryDone = function (x) {
    const p = x.patientId;
    H.charge(p, 'S-OR', `رسوم غرفة عمليات — ${x.procedure}`, 4000, Math.max(1, Math.round((new Date(x.end) - new Date(x.start)) / 36e5)), 'العمليات');
    if (!S().beds.some((b) => b.patientId === p)) H.requestAdmission(p, { ward: 'W-SUR', reason: `بعد ${x.procedure}`, priority: 'عاجل', from: 'العمليات' });
  };

  /* ================= الجودة والصيانة ================= */
  H.reportIncident = function ({ kind, severity, location, text, pid = null }) {
    const i = { id: `INC-${EM.pad(90 + S().incidents.length, 4)}`, kind, severity, location, text, patientId: pid, at: now(), by: me(), status: 'قيد التقييم' };
    S().incidents.unshift(i);
    st().startInstance('wf_incident', { severe: severity === 'جسيم' }, pid);
    st().notify(severity === 'جسيم' ? 'bad' : 'warn', 'بلاغ سلامة جديد', `${kind} — ${location}`, '#/quality');
    st().audit('بلاغ سلامة', 'incident', i.id);
    return i;
  };
  H.equipmentFault = function (eq, text) {
    eq.status = 'عطل'; eq.since = now();
    const t = { id: `WO-${EM.pad(400 + S().workOrders.length, 4)}`, equipment: eq.id, text, at: now(), by: me(), status: 'مفتوح', priority: eq.critical ? 'عالية' : 'عادية' };
    S().workOrders.unshift(t);
    st().notify(eq.critical ? 'bad' : 'warn', 'عطل جهاز', `${eq.name} — ${eq.location}`, '#/biomed');
    st().audit('بلاغ عطل جهاز', 'equipment', eq.id, { reason: text });
    return t;
  };

  /* ================= رحلة المريض عبر الأقسام ================= */
  H.journey = function (pid) {
    const s = S();
    const steps = [];
    const add = (at, dept, label, state = 'done') => at && steps.push({ at, dept, label, state });
    s.er.filter((e) => e.patientId === pid).forEach((e) => { add(e.arrivedAt, 'الطوارئ', e.level ? `فرز مستوى ${e.level}` : 'بانتظار الفرز', e.closed ? 'done' : 'now'); });
    s.appointments.filter((a) => a.patientId === pid && ['arrived', 'nurse', 'in_consult', 'done'].includes(a.status)).forEach((a) => add(a.at, 'العيادات', EM.CLINICS.find((c) => c.id === a.clinic).specialty, a.status === 'done' ? 'done' : 'now'));
    s.lab.filter((l) => l.patientId === pid).forEach((l) => add(l.orderedAt, 'المعمل', EM.REF.labTests.find((t) => t.code === l.test).name, l.stage === 'verified' ? (l.critical && !l.ackBy ? 'alert' : 'done') : 'now'));
    s.rad.filter((r) => r.patientId === pid).forEach((r) => add(r.orderedAt, 'الأشعة', EM.REF.imaging.find((t) => t.code === r.study).name, r.stage === 'verified' ? 'done' : 'now'));
    s.rx.filter((r) => r.patientId === pid).forEach((r) => add(r.at, 'الصيدلية', EM.REF.drugs.find((d) => d.code === r.drug).name, r.status === 'dispensed' ? 'done' : r.status === 'on_hold' ? 'alert' : 'now'));
    s.surgeries.filter((x) => x.patientId === pid).forEach((x) => add(x.start, 'العمليات', x.procedure, x.status === 'done' ? 'done' : 'now'));
    const bed = s.beds.find((b) => b.patientId === pid);
    if (bed) add(bed.since, bed.ward === 'W-ICU' ? 'العناية المركزة' : 'الإقامة', `${wardName(bed.ward)} — سرير ${bed.label}`, 'now');
    s.bedRequests.filter((r) => r.patientId === pid).forEach((r) => add(r.requestedAt, 'الإقامة', 'بانتظار سرير', 'wait'));
    s.encounters.filter((e) => e.patientId === pid && e.type === 'ipd' && e.status === 'closed').forEach((e) => add(e.startedAt, e.dept === 'icu' ? 'العناية المركزة' : 'الإقامة', e.location, 'done'));
    s.discharges.filter((d) => d.patientId === pid).forEach((d) => add(d.startedAt, 'الخروج', d.status === 'done' ? 'تم الخروج' : 'إجراءات الخروج', d.status === 'done' ? 'done' : 'now'));
    s.invoices.filter((i) => i.patientId === pid).forEach((i) => add(i.at, 'الحسابات', `${EM.fmt.money(i.total)}`, i.status === 'paid' ? 'done' : 'wait'));
    return steps.sort((a, b) => a.at.localeCompare(b.at));
  };

  EM.H = H;
})();
