/* بيانات تجريبية إضافية: الزيارات، الخروج، النظافة، الموارد البشرية، الأجهزة، الجودة، السجلات، العناية المركزة،
   و«مريض العرض» الذي تمر رحلته اليوم بكل أقسام المستشفى. كلها بيانات وهمية. */
(function () {
  'use strict';
  const EM = window.EM;

  const DOCS = ['د. يوسف الشريف', 'د. نادية الحسيني', 'د. مازن عبد الله', 'د. سلمى رضا', 'د. حازم نور', 'د. طارق سليمان', 'د. عمرو الجمال', 'د. دينا رشاد', 'د. شريف البنا', 'د. حسين المنياوي', 'د. رنا فهمي', 'د. أيمن صبري'];
  const NURSES = ['سارة إبراهيم', 'أحمد فتحي', 'منار عادل', 'هاني سمير', 'دعاء حسن', 'مريم عاطف', 'محمود سعد', 'إسراء نبيل', 'كريم رضا', 'نهلة فؤاد', 'ياسر جمال', 'شروق محمد', 'عبير مصطفى', 'وفاء عثمان'];

  EM.seedExtra = function (st) {
    const r = EM.rng(4242);
    const nowMs = Date.now();
    const ago = (m) => new Date(nowMs - m * 60000).toISOString();
    const P = st.patients;

    /* ---------- مريض العرض: رحلة كاملة اليوم ---------- */
    const fp = P[0];
    fp.dob = new Date(1968, 4, 12).toISOString();
    fp.alerts = ['مريض سكر معتمد على الإنسولين'];
    fp.allergies = ['البنسلين'];
    st.featuredPatient = fp.id;
    st.er.forEach((e) => { if (e.patientId === fp.id) e.patientId = P[60].id; });
    st.appointments.forEach((a) => { if (a.patientId === fp.id) a.patientId = P[62].id; });
    st.surgeries.forEach((x) => { if (x.patientId === fp.id) x.patientId = P[63].id; });
    st.er.unshift({ id: 'ER-0870', patientId: fp.id, complaint: 'ألم شديد بالصدر يمتد للذراع الأيسر', arrivedAt: ago(290), level: 2, status: 'disposition', disposition: 'admit', doctor: 'u_con', vitals: { hr: 112, bp: '158/96', spo2: 93, temp: '37.1', rr: 22 }, bay: 'سرير 2', closed: true });
    st.lab = st.lab.filter((l) => l.patientId !== fp.id);
    st.lab.unshift(
      { id: 'LAB-031190', patientId: fp.id, test: 'TROP', priority: 'STAT', stage: 'verified', orderedAt: ago(275), orderedBy: 'u_con', source: 'er', result: { value: 'تروبونين 1.84', unit: 'ng/mL', ref: '< 0.04' }, critical: true, ackBy: 'u_con', ackAt: ago(228), dueAt: ago(245) },
      { id: 'LAB-031191', patientId: fp.id, test: 'CBC', priority: 'STAT', stage: 'verified', orderedAt: ago(275), orderedBy: 'u_con', source: 'er', result: { value: 'الهيموجلوبين 13.4', unit: 'g/dL', ref: '12–16' }, critical: false, dueAt: ago(245) },
      { id: 'LAB-031192', patientId: fp.id, test: 'COAG', priority: 'عاجل', stage: 'in_process', orderedAt: ago(40), orderedBy: 'u_icu', source: 'icu', result: null, critical: false, dueAt: ago(-5) },
    );
    st.rad.unshift({ id: 'RAD-07690', patientId: fp.id, study: 'XR-CH', stage: 'verified', indication: 'ألم بالصدر — استبعاد أسباب رئوية', priority: 'STAT', orderedAt: ago(270), scheduledAt: ago(255), report: 'لا توجد علامات احتقان رئوي. حجم القلب طبيعي.' },
      { id: 'RAD-07691', patientId: fp.id, study: 'ECHO', stage: 'scheduled', indication: 'تقييم وظيفة عضلة القلب', priority: 'عاجل', orderedAt: ago(60), scheduledAt: ago(-45) });
    st.rx.unshift({ id: 'RX-04390', patientId: fp.id, drug: 'D006', dose: '5000 وحدة', route: 'تحت الجلد', freq: 'كل 12 ساعة', prescriber: 'u_con', at: ago(220), status: 'dispensed', alert: null, location: 'العناية المركزة' },
      { id: 'RX-04391', patientId: fp.id, drug: 'D005', dose: 'حسب قياس السكر', route: 'تحت الجلد', freq: 'قبل الوجبات', prescriber: 'u_icu', at: ago(90), status: 'new', alert: null, location: 'العناية المركزة' },
      { id: 'RX-04392', patientId: fp.id, drug: 'D007', dose: '1 جم', route: 'فم', freq: 'كل 12 ساعة', prescriber: 'u_doc', at: ago(30), status: 'on_hold', alert: { kind: 'حساسية', text: 'المريض لديه حساسية مسجلة من البنسلين' }, location: 'العناية المركزة' });
    st.beds.forEach((b) => { if (b.patientId === fp.id) b.patientId = P[61].id; });
    const icuBed = st.beds.find((b) => b.id === 'W-ICU-03');
    Object.assign(icuBed, { status: 'occupied', patientId: fp.id, since: ago(210), isolation: false, dischargeReady: false });
    st.bedRequests = st.bedRequests.filter((x) => x.patientId !== fp.id);
    st.invoices.unshift({ id: 'INV-26-08199', patientId: fp.id, at: ago(290), status: 'draft', insurer: fp.insurer, paid: 0, adjustments: [], items: [
      { code: 'S-ER', name: 'كشف طوارئ', qty: 1, price: 400, source: 'الطوارئ' },
      { code: 'TROP', name: 'تحليل: تروبونين القلب', qty: 1, price: 450, source: 'المعمل' },
      { code: 'CBC', name: 'تحليل: صورة دم كاملة', qty: 1, price: 180, source: 'المعمل' },
      { code: 'XR-CH', name: 'أشعة: أشعة عادية على الصدر', qty: 1, price: 250, source: 'الأشعة' },
      { code: 'D006', name: 'دواء: هيبارين 5000 وحدة', qty: 1, price: 25, source: 'الصيدلية' },
      { code: 'S-ICU', name: 'إقامة يوم — عناية مركزة', qty: 1, price: 5500, source: 'الإقامة' },
    ] });
    const inv = st.invoices[0];
    const cov = EM.REF.insurers.find((x) => x.id === inv.insurer)?.coverage || 0;
    inv.total = inv.items.reduce((a, it) => a + it.qty * it.price, 0); inv.insShare = Math.round(inv.total * cov); inv.patientShare = inv.total - inv.insShare;
    st.notes.unshift({ id: 'NOTE-1', patientId: fp.id, at: ago(250), by: 'u_con', text: 'ألم صدري نموذجي منذ ساعتين، تغيرات بتخطيط القلب، تروبونين مرتفع. تم التحويل للعناية المركزة للمتابعة — التشخيص يوثقه الطبيب المعالج.' });

    /* ---------- الزيارات المفتوحة حسب مكان كل مريض ---------- */
    const enc = [];
    const seen = new Set();
    const open = (pid, type, dept, location, at) => { if (!pid || seen.has(pid)) return; seen.add(pid); enc.push({ id: `ENC-${EM.pad(5000 + enc.length, 5)}`, patientId: pid, type, dept, location, startedAt: at, endedAt: null, status: 'open', attending: type === 'opd' ? 'u_doc' : 'u_con' }); };
    st.beds.filter((b) => b.patientId).forEach((b) => open(b.patientId, 'ipd', b.ward === 'W-ICU' ? 'icu' : 'wards', `${b.ward} — ${b.label}`, b.since));
    st.er.filter((e) => e.patientId && !e.closed).forEach((e) => open(e.patientId, 'er', 'er', e.bay, e.arrivedAt));
    st.appointments.filter((a) => ['arrived', 'nurse', 'in_consult'].includes(a.status)).forEach((a) => open(a.patientId, 'opd', 'opd', a.clinic, a.at));
    st.encounters = enc;

    /* ---------- الخروج ---------- */
    st.discharges = [];
    st.beds.filter((b) => b.dischargeReady && b.patientId).slice(0, 4).forEach((b, i) => {
      const items = { summary: null, medrec: null, followup: null, education: null, billing: null };
      if (i % 2 === 0) items.summary = { by: 'u_doc', at: ago(40) };
      if (i === 0) items.medrec = { by: 'u_pha', at: ago(25) };
      st.discharges.push({ id: `DIS-${EM.pad(180 + i, 4)}`, patientId: b.patientId, bedId: b.id, type: 'normal', startedAt: ago(90 - i * 15), status: 'in_progress', by: 'u_doc', items });
    });

    /* ---------- النظافة وتجهيز الأسرّة ---------- */
    st.housekeeping = st.beds.filter((b) => b.status === 'cleaning').map((b, i) => ({
      id: `HK-${EM.pad(480 + i, 4)}`, bedId: b.id, type: 'تنظيف وتجهيز بعد خروج', createdAt: b.since, status: i % 3 === 0 ? 'in_progress' : 'pending',
      assignee: i % 3 === 0 ? 'عم سيد عبد الفتاح' : null, startedAt: i % 3 === 0 ? b.since : null, target: 45,
    }));
    st.housekeepingStaff = ['عم سيد عبد الفتاح', 'أم هاني', 'رضا شعبان', 'سعاد محمود', 'جمال توفيق'];

    /* ---------- الموارد البشرية والمناوبات ---------- */
    const staff = [];
    DOCS.forEach((n, i) => staff.push({ id: `S-D${i}`, name: n, title: 'طبيب', dept: ['opd', 'opd', 'opd', 'opd', 'opd', 'icu', 'or', 'or', 'rad', 'or', 'er', 'er'][i], phone: `0100${r.int(1000000, 9999999)}` }));
    NURSES.forEach((n, i) => staff.push({ id: `S-N${i}`, name: n, title: 'تمريض', dept: ['nursing', 'er', 'er', 'icu', 'icu', 'wards', 'wards', 'wards', 'er', 'nicu', 'or', 'wards', 'wards', 'icu'][i], phone: `0111${r.int(1000000, 9999999)}` }));
    [['محمود رجب', 'فني معمل', 'lab'], ['إسلام حمدي', 'فني أشعة', 'rad'], ['د. ياسمين فوزي', 'صيدلي', 'pharmacy'], ['د. علا رمضان', 'صيدلي', 'pharmacy'], ['منى سعيد', 'استقبال', 'reception'], ['هشام عبده', 'استقبال', 'reception'], ['أ. حسام زكي', 'محاسب', 'billing']].forEach(([n, t, d], i) => staff.push({ id: `S-O${i}`, name: n, title: t, dept: d, phone: `0122${r.int(1000000, 9999999)}` }));
    st.staffDir = staff;
    const SHIFTS = ['صباحي', 'مسائي', 'ليلي', 'راحة'];
    st.roster = {};
    staff.forEach((s, i) => { st.roster[s.id] = Array.from({ length: 7 }, (_, d) => SHIFTS[(i + d * (i % 3 === 0 ? 1 : 2)) % 4]); });
    st.leaveRequests = [
      { id: 'LV-31', staffId: 'S-N4', type: 'إجازة اعتيادية', from: ago(-60 * 24 * 3), days: 2, status: 'بانتظار الاعتماد', reason: 'ظروف عائلية' },
      { id: 'LV-30', staffId: 'S-D2', type: 'مؤتمر علمي', from: ago(-60 * 24 * 10), days: 3, status: 'بانتظار الاعتماد', reason: 'مؤتمر جراحة العظام' },
      { id: 'LV-28', staffId: 'S-N9', type: 'إجازة مرضية', from: ago(60 * 24), days: 1, status: 'معتمد', reason: '—' },
    ];

    /* ---------- الأجهزة الطبية ---------- */
    st.equipment = [
      { id: 'EQ-101', name: 'جهاز تنفس صناعي 1', type: 'تنفس صناعي', location: 'العناية المركزة', status: 'يعمل', critical: true, nextPm: ago(-60 * 24 * 12) },
      { id: 'EQ-102', name: 'جهاز تنفس صناعي 2', type: 'تنفس صناعي', location: 'العناية المركزة', status: 'يعمل', critical: true, nextPm: ago(-60 * 24 * 3) },
      { id: 'EQ-103', name: 'جهاز تنفس صناعي 3', type: 'تنفس صناعي', location: 'العناية المركزة', status: 'صيانة وقائية', critical: true, nextPm: ago(60 * 24) },
      { id: 'EQ-201', name: 'جهاز الأشعة المقطعية', type: 'CT', location: 'الأشعة', status: 'يعمل', critical: true, nextPm: ago(-60 * 24 * 20) },
      { id: 'EQ-202', name: 'جهاز الرنين المغناطيسي', type: 'MRI', location: 'الأشعة', status: 'يعمل', critical: true, nextPm: ago(-60 * 24 * 45) },
      { id: 'EQ-301', name: 'محلل كيمياء الدم', type: 'معمل', location: 'المعمل', status: 'عطل', critical: true, nextPm: ago(-60 * 24 * 6), since: ago(130) },
      { id: 'EQ-302', name: 'جهاز صورة الدم', type: 'معمل', location: 'المعمل', status: 'يعمل', critical: false, nextPm: ago(-60 * 24 * 9) },
      { id: 'EQ-401', name: 'جهاز صدمات كهربائية', type: 'إنعاش', location: 'الطوارئ', status: 'يعمل', critical: true, nextPm: ago(60 * 24 * 2) },
      { id: 'EQ-402', name: 'جهاز مونيتور مركزي', type: 'مراقبة', location: 'الطوارئ', status: 'يعمل', critical: false, nextPm: ago(-60 * 24 * 30) },
      { id: 'EQ-501', name: 'جهاز تخدير — غرفة 1', type: 'تخدير', location: 'العمليات', status: 'يعمل', critical: true, nextPm: ago(-60 * 24 * 15) },
      { id: 'EQ-502', name: 'جهاز تخدير — غرفة 3', type: 'تخدير', location: 'العمليات', status: 'يعمل', critical: true, nextPm: ago(-60 * 24 * 1) },
      { id: 'EQ-601', name: 'حضانة أطفال 4', type: 'حضانة', location: 'الحضانات', status: 'يعمل', critical: true, nextPm: ago(-60 * 24 * 18) },
    ];
    st.workOrders = [{ id: 'WO-0399', equipment: 'EQ-301', text: 'رسالة خطأ في وحدة السحب — نتائج غير مستقرة', at: ago(130), by: 'u_lab', status: 'جارٍ الإصلاح', priority: 'عالية', tech: 'م. باسم فاروق' }];

    /* ---------- الجودة ---------- */
    st.incidents = [
      { id: 'INC-0088', kind: 'سقوط مريض', severity: 'بسيط', location: 'الباطنة — سرير 6', text: 'انزلاق أثناء التوجه للحمام دون إصابة. تم تقييم خطر السقوط وتفعيل جرس النداء.', at: ago(60 * 20), by: 'u_nur', status: 'إجراءات تصحيحية' },
      { id: 'INC-0089', kind: 'خطأ دوائي (تم اكتشافه قبل الإعطاء)', severity: 'لم يصل للمريض', location: 'الصيدلية', text: 'تشابه أسماء دوائين في الرف. تم فصل الأصناف وإضافة ملصق تنبيه.', at: ago(60 * 7), by: 'u_pha', status: 'قيد التقييم' },
    ];

    /* ---------- السجلات الطبية ---------- */
    st.recordRequests = [
      { id: 'MR-210', patientId: P[12].id, type: 'تقرير طبي لجهة عمل', requester: 'المريض', at: ago(60 * 5), status: 'قيد الإعداد' },
      { id: 'MR-211', patientId: P[19].id, type: 'نسخة من نتائج التحاليل', requester: 'المريض', at: ago(60 * 2), status: 'جديد' },
      { id: 'MR-212', patientId: P[27].id, type: 'ملف كامل لشركة التأمين', requester: 'مصر للتأمين الصحي', at: ago(60 * 26), status: 'بانتظار موافقة المريض' },
    ];

    /* ---------- العناية المركزة: قراءات المراقبة ---------- */
    st.icu = {};
    st.beds.filter((b) => b.ward === 'W-ICU' && b.patientId).forEach((b, i) => {
      const base = { hr: r.int(78, 118), map: r.int(62, 88), spo2: r.int(90, 99) };
      st.icu[b.id] = {
        vent: i % 3 === 0, pressors: i % 4 === 1, sedation: i % 3 === 0 ? 'RASS -2' : 'يقظ',
        series: Array.from({ length: 12 }, (_, k) => ({ hr: base.hr + r.int(-8, 8) + (b.patientId === fp.id ? 12 - k : 0), map: base.map + r.int(-6, 6), spo2: Math.min(100, base.spo2 + r.int(-3, 2)) })),
        lines: ['قسطرة وريدية مركزية', 'قسطرة بولية'].slice(0, 1 + (i % 2)),
      };
    });
  };
})();
