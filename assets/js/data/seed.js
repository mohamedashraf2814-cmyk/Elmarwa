/* مولّد البيانات التجريبية — كل البيانات وهمية لأغراض العرض فقط */
(function () {
  'use strict';
  const EM = window.EM;

  const MALE = ['محمد', 'أحمد', 'محمود', 'مصطفى', 'عمر', 'خالد', 'إبراهيم', 'حسن', 'علي', 'يوسف', 'كريم', 'طارق', 'سامح', 'هشام', 'وليد', 'عادل', 'سيد', 'رامي', 'شريف', 'أيمن'];
  const FEMALE = ['فاطمة', 'مريم', 'نورا', 'هبة', 'ياسمين', 'سلمى', 'دعاء', 'رحاب', 'آية', 'منة', 'شيماء', 'إيمان', 'نهى', 'سمر', 'أسماء', 'رضوى', 'هند', 'زينب', 'جيهان', 'ولاء'];
  const FAMILY = ['عبد الرحمن', 'السيد', 'حسانين', 'الشافعي', 'المصري', 'عبد الحميد', 'فرج', 'النجار', 'سلامة', 'الدسوقي', 'عطية', 'بدوي', 'شاهين', 'الصاوي', 'رزق', 'مرسي', 'عثمان', 'قنديل', 'جاد', 'زهران'];
  const GOV = ['القاهرة', 'الجيزة', 'القليوبية', 'الإسكندرية', 'الشرقية', 'المنوفية', 'الدقهلية', 'الفيوم'];
  const BLOOD = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-'];
  const ALLERGIES = ['البنسلين', 'السلفا', 'الأسبرين', 'اللاتكس', 'اليود (صبغة الأشعة)'];
  const COMPLAINTS = ['ألم شديد بالصدر', 'ضيق في التنفس', 'ارتفاع درجة الحرارة', 'ألم بالبطن', 'إصابة في حادث طريق', 'صداع مفاجئ شديد', 'جرح قطعي باليد', 'دوخة وإغماء', 'كسر محتمل بالساعد', 'قيء متكرر', 'نزيف أنفي', 'ارتفاع السكر'];

  EM.CLINICS = [
    { id: 'c1', doctor: 'u_doc', name: 'د. يوسف الشريف', specialty: 'الباطنة', room: 'عيادة 3' },
    { id: 'c2', doctor: 'u_con', name: 'د. نادية الحسيني', specialty: 'القلب', room: 'عيادة 5' },
    { id: 'c3', doctor: 'x_ort', name: 'د. مازن عبد الله', specialty: 'العظام', room: 'عيادة 7' },
    { id: 'c4', doctor: 'x_ped', name: 'د. سلمى رضا', specialty: 'الأطفال', room: 'عيادة 2' },
    { id: 'c5', doctor: 'x_der', name: 'د. حازم نور', specialty: 'الجلدية', room: 'عيادة 9' },
  ];

  EM.seed = function () {
    const r = EM.rng(20261019);
    const now = new Date();
    const today = (h, m) => { const d = new Date(now); d.setHours(h, m, 0, 0); return d.toISOString(); };
    const ago = (min) => new Date(now.getTime() - min * 60000).toISOString();
    const ahead = (min) => new Date(now.getTime() + min * 60000).toISOString();

    /* ---------- المرضى ---------- */
    const patients = [];
    for (let i = 0; i < 64; i++) {
      const gender = r.chance(0.5) ? 'ذكر' : 'أنثى';
      const first = r.pick(gender === 'ذكر' ? MALE : FEMALE);
      const father = r.pick(MALE);
      const family = r.pick(FAMILY);
      const year = r.int(1946, 2023);
      const dob = new Date(year, r.int(0, 11), r.int(1, 28)).toISOString();
      const century = year >= 2000 ? 3 : 2;
      const nid = `${century}${String(year).slice(2)}${EM.pad(r.int(1, 12))}${EM.pad(r.int(1, 28))}${EM.pad(r.int(1, 35))}${r.int(1000, 9999)}${r.int(1, 9)}`;
      const ins = r.pick(EM.REF.insurers);
      const allergies = r.chance(0.22) ? [r.pick(ALLERGIES)] : [];
      const alerts = [];
      if (r.chance(0.12)) alerts.push('خطر السقوط');
      if (r.chance(0.08)) alerts.push('عزل احتياطي');
      if (r.chance(0.06)) alerts.push('مريض سكر معتمد على الإنسولين');
      patients.push({
        id: `EM-26-${EM.pad(10240 + i * 7, 6)}`,
        name: `${first} ${father} ${family}`,
        gender, dob, nationalId: nid,
        phone: `01${r.pick(['0', '1', '2', '5'])}${r.int(10000000, 99999999)}`,
        governorate: r.pick(GOV),
        insurer: ins.id,
        policy: ins.id === 'NONE' ? '' : `POL-${r.int(100000, 999999)}`,
        blood: r.pick(BLOOD),
        allergies, alerts,
        emergency: { name: `${r.pick(MALE)} ${family}`, relation: r.pick(['الزوج/الزوجة', 'الابن', 'الأخ', 'الأب', 'الابنة']), phone: `012${r.int(10000000, 99999999)}` },
        consent: { sms: r.chance(0.8), research: r.chance(0.3) },
        createdAt: ago(r.int(60 * 24 * 3, 60 * 24 * 900)),
      });
    }
    // سجل مكرر عمداً لعرض سيناريو الدمج
    const dupSrc = patients[5];
    patients.push({ ...EM.clone(dupSrc), id: 'EM-26-019999', phone: '01000000000', createdAt: ago(60 * 30), duplicateOf: dupSrc.id });

    const P = (i) => patients[i % 64].id;

    /* ---------- المواعيد ---------- */
    const appointments = [];
    let apIdx = 0;
    EM.CLINICS.forEach((c, ci) => {
      for (let slot = 0; slot < 15; slot++) {
        const h = 9 + Math.floor((slot * 20) / 60);
        const m = (slot * 20) % 60;
        if (r.chance(0.18)) continue;
        const t = today(h, m);
        const diff = (new Date(t) - now) / 60000;
        let status;
        if (diff > 30) status = r.chance(0.08) ? 'cancelled' : 'booked';
        else if (diff > 0) status = r.chance(0.6) ? 'arrived' : 'booked';
        else if (diff > -25) status = r.pick(['in_consult', 'arrived', 'nurse']);
        else status = r.chance(0.12) ? 'no_show' : 'done';
        appointments.push({
          id: `AP-${EM.pad(5000 + apIdx, 5)}`, clinic: c.id, patientId: P(apIdx * 3 + ci), at: t,
          type: r.chance(0.3) ? 'متابعة' : r.chance(0.2) ? 'حضور مباشر' : 'حجز جديد', status,
          queueNo: slot + 1,
        });
        apIdx++;
      }
    });

    /* ---------- الطوارئ ---------- */
    const erStatuses = ['waiting_triage', 'triaged', 'in_assessment', 'awaiting_results', 'disposition'];
    const er = [];
    const LEVELS = [null, null, 1, 2, 2, 3, 3, 4, 3, 5, 4, 2, 3];
    const STS = [null, null, 'in_assessment', 'triaged', 'awaiting_results', 'triaged', 'in_assessment', 'triaged', 'awaiting_results', 'triaged', 'disposition', 'in_assessment', 'disposition'];
    for (let i = 0; i < 13; i++) {
      const st = i < 2 ? 'waiting_triage' : STS[i];
      const level = LEVELS[i];
      void erStatuses;
      er.push({
        id: `ER-${EM.pad(880 + i, 4)}`,
        patientId: i === 1 ? null : P(40 + i),
        tempName: i === 1 ? 'مجهول — ذكر حوالي 40 عاماً' : null,
        complaint: r.pick(COMPLAINTS),
        arrivedAt: ago(r.int(4, 190)),
        level, status: st,
        doctor: st === 'in_assessment' || st === 'awaiting_results' || st === 'disposition' ? r.pick(['u_doc', 'u_con']) : null,
        vitals: { hr: r.int(62, 128), bp: `${r.int(95, 170)}/${r.int(55, 100)}`, spo2: r.int(88, 100), temp: (36 + r.next() * 3).toFixed(1), rr: r.int(12, 30) },
        bay: `سرير ${r.int(1, 14)}`,
        disposition: st === 'disposition' ? r.pick(['admit', 'discharge', 'transfer']) : null,
      });
    }

    /* ---------- المعمل ---------- */
    const labStages = ['ordered', 'collected', 'received', 'in_process', 'resulted', 'verified'];
    const lab = [];
    for (let i = 0; i < 34; i++) {
      const test = r.pick(EM.REF.labTests);
      const stage = r.pick(labStages);
      const priority = r.chance(0.18) ? 'STAT' : r.chance(0.3) ? 'عاجل' : 'روتيني';
      const ordered = ago(r.int(10, 400));
      const critical = (stage === 'resulted' || stage === 'verified') && r.chance(0.15);
      lab.push({
        id: `LAB-${EM.pad(31200 + i, 6)}`, patientId: P(i * 5 + 1), test: test.code, priority, stage,
        orderedAt: ordered, orderedBy: r.pick(['u_doc', 'u_con', 'u_sur', 'u_icu']),
        source: r.pick(['er', 'opd', 'wards', 'icu']),
        rejected: stage === 'collected' && r.chance(0.2) ? 'عينة متحللة (Hemolyzed) — مطلوب إعادة سحب' : null,
        result: stage === 'resulted' || stage === 'verified' ? sampleResult(test.code, critical) : null,
        critical, ackBy: critical && stage === 'verified' && r.chance(0.5) ? 'u_doc' : null,
        dueAt: new Date(new Date(ordered).getTime() + (priority === 'STAT' ? 30 : test.tat) * 60000).toISOString(),
      });
    }
    function sampleResult(code, critical) {
      const map = {
        CBC: critical ? ['الهيموجلوبين 5.9', 'g/dL', '12–16'] : ['الهيموجلوبين 13.1', 'g/dL', '12–16'],
        BMP: critical ? ['البوتاسيوم 6.8', 'mmol/L', '3.5–5.1'] : ['الكرياتينين 0.9', 'mg/dL', '0.6–1.2'],
        LFT: ['ALT 34', 'U/L', '7–56'],
        TROP: critical ? ['تروبونين 1.84', 'ng/mL', '< 0.04'] : ['تروبونين 0.01', 'ng/mL', '< 0.04'],
        CRP: ['CRP 18', 'mg/L', '< 5'],
        HBA1C: ['HbA1c 7.9', '%', '< 5.7'],
        COAG: critical ? ['INR 5.6', '', '0.8–1.2'] : ['INR 1.1', '', '0.8–1.2'],
        UA: ['صديد 3–5', '/HPF', '0–5'],
        CULT: ['لا يوجد نمو بعد 48 ساعة', '', ''],
        ABG: critical ? ['pH 7.12', '', '7.35–7.45'] : ['pH 7.39', '', '7.35–7.45'],
      };
      const [value, unit, ref] = map[code] || ['—', '', ''];
      return { value, unit, ref };
    }

    /* ---------- الأشعة ---------- */
    const radStages = ['ordered', 'scheduled', 'acquired', 'reported', 'verified'];
    const rad = [];
    for (let i = 0; i < 15; i++) {
      const study = r.pick(EM.REF.imaging);
      const stage = r.pick(radStages);
      rad.push({
        id: `RAD-${EM.pad(7700 + i, 5)}`, patientId: P(i * 7 + 2), study: study.code, stage,
        indication: r.pick(['اشتباه التهاب رئوي', 'استبعاد نزيف بالمخ', 'ألم بالبطن الأيمن السفلي', 'متابعة بعد جراحة', 'ألم أسفل الظهر مزمن', 'تقييم وظيفة القلب']),
        priority: r.chance(0.2) ? 'STAT' : 'روتيني',
        orderedAt: ago(r.int(20, 600)), scheduledAt: ahead(r.int(-120, 240)),
        contrast: study.code === 'CT-AB', screening: study.modality === 'MRI' ? 'مطلوب فحص المعادن والأجهزة المزروعة' : null,
        critical: stage === 'verified' && r.chance(0.2),
        report: stage === 'reported' || stage === 'verified' ? 'لا توجد علامات حادة. يُنصح بالمتابعة السريرية.' : null,
      });
    }

    /* ---------- الصيدلية ---------- */
    const rx = [];
    for (let i = 0; i < 18; i++) {
      const d = r.pick(EM.REF.drugs);
      const pat = patients[(i * 9 + 3) % 64];
      let alert = null;
      if (pat.allergies.includes('البنسلين') && d.code === 'D007') alert = { kind: 'حساسية', text: 'المريض لديه حساسية مسجلة من البنسلين' };
      else if (r.chance(0.15)) alert = { kind: 'تداخل دوائي', text: 'تداخل محتمل مع هيبارين — مراجعة الصيدلي مطلوبة' };
      const status = alert ? 'on_hold' : r.pick(['new', 'new', 'verified', 'dispensed', 'dispensed']);
      rx.push({
        id: `RX-${EM.pad(4400 + i, 5)}`, patientId: pat.id, drug: d.code,
        dose: r.pick(['1 جم', '40 مجم', '10 وحدات', '500 مل', '20 مجم']),
        route: r.pick(['وريد', 'فم', 'عضل', 'تحت الجلد']),
        freq: r.pick(['كل 8 ساعات', 'مرة يومياً', 'كل 12 ساعة', 'عند اللزوم']),
        prescriber: r.pick(['u_doc', 'u_con', 'u_icu', 'u_sur']), at: ago(r.int(5, 300)),
        status, alert, location: r.pick(['الطوارئ', 'الباطنة', 'الجراحة', 'العناية المركزة', 'العيادات']),
      });
    }

    /* ---------- الأسرّة ---------- */
    const beds = [];
    let occIdx = 0;
    EM.REF.wards.forEach((w) => {
      for (let b = 1; b <= w.beds; b++) {
        const roll = r.next();
        let status = 'occupied';
        if (roll > 0.82) status = 'available';
        else if (roll > 0.74) status = 'cleaning';
        else if (roll > 0.7) status = 'reserved';
        else if (roll > 0.67) status = 'maintenance';
        const bed = { id: `${w.id}-${EM.pad(b)}`, ward: w.id, label: `${b}`, status, patientId: null, since: null, isolation: false };
        if (status === 'occupied') {
          bed.patientId = P(10 + occIdx++ * 3);
          bed.since = ago(r.int(120, 60 * 24 * 9));
          bed.isolation = (w.id === 'W-ICU' || b <= 2) && r.chance(0.35);
          bed.dischargeReady = r.chance(0.12);
        }
        if (status === 'cleaning') bed.since = ago(r.int(5, 70));
        beds.push(bed);
      }
    });
    const bedRequests = [
      { id: 'ADM-1201', patientId: er[3]?.patientId || P(3), from: 'الطوارئ', ward: 'W-MED', reason: 'التهاب رئوي يحتاج مضاد حيوي وريدي', requestedAt: ago(48), priority: 'عاجل', isolation: false },
      { id: 'ADM-1202', patientId: P(22), from: 'العيادات', ward: 'W-SUR', reason: 'تجهيز لعملية مرارة منظار', requestedAt: ago(120), priority: 'مجدول', isolation: false },
      { id: 'ADM-1203', patientId: P(31), from: 'الطوارئ', ward: 'W-ICU', reason: 'هبوط حاد بالدورة الدموية', requestedAt: ago(18), priority: 'حرج', isolation: true },
    ];

    /* ---------- العمليات ---------- */
    const ORS = ['غرفة 1', 'غرفة 2', 'غرفة 3', 'غرفة 4'];
    const PROCS = ['استئصال المرارة بالمنظار', 'تثبيت كسر عظمة الفخذ', 'استئصال الزائدة الدودية', 'ولادة قيصرية', 'إصلاح فتق إربي', 'تغيير مفصل ركبة', 'منظار ركبة', 'استئصال ورم حميد بالثدي'];
    const surgeries = [];
    let sIdx = 0;
    // الجدول يتمحور حول الوقت الحالي ليبدو حياً في أي ساعة يُعرض فيها النظام
    const base = new Date(now); base.setMinutes(Math.floor(base.getMinutes() / 15) * 15, 0, 0);
    const baseMs = base.getTime() - 200 * 60000;
    ORS.forEach((room) => {
      let start = r.int(0, 3) * 15;
      for (let k = 0; k < 3; k++) {
        const dur = r.pick([60, 75, 90, 120, 150]);
        const s = new Date(baseMs + start * 60000).toISOString();
        const e = new Date(new Date(s).getTime() + dur * 60000).toISOString();
        const nowMin = (now.getTime() - baseMs) / 60000;
        let status = 'scheduled';
        if (nowMin > start + dur + 40) status = 'done';
        else if (nowMin > start + dur) status = 'recovery';
        else if (nowMin > start) status = 'in_progress';
        else if (start - nowMin < 60) status = 'pre_op';
        surgeries.push({
          id: `OR-${EM.pad(300 + sIdx, 4)}`, room, patientId: P(sIdx * 4 + 7), procedure: PROCS[sIdx % PROCS.length],
          surgeon: r.pick(['u_sur', 'x_sur2']), anesth: 'u_ane', start: s, end: e, status,
          checklist: { identity: status !== 'scheduled', site: status !== 'scheduled', consent: true, anesthesia: status === 'in_progress' || status === 'recovery' || status === 'done', allergies: status !== 'scheduled', bloodAvail: r.chance(0.7), timeout: status === 'in_progress' || status === 'recovery' || status === 'done', signout: status === 'recovery' || status === 'done' },
        });
        start += dur + 30;
        sIdx++;
      }
    });

    /* ---------- الفواتير والمدفوعات ---------- */
    const invoices = [];
    for (let i = 0; i < 26; i++) {
      const pat = patients[(i * 11 + 4) % 64];
      const ins = EM.REF.insurers.find((x) => x.id === pat.insurer);
      const items = [];
      const nItems = r.int(1, 4);
      for (let k = 0; k < nItems; k++) {
        const src = r.chance(0.5) ? r.pick(EM.REF.services) : r.chance(0.5) ? r.pick(EM.REF.labTests) : r.pick(EM.REF.imaging);
        items.push({ code: src.code, name: src.name, qty: src.code === 'S-BED' ? r.int(1, 5) : 1, price: src.price });
      }
      const total = items.reduce((s, it) => s + it.qty * it.price, 0);
      const insShare = Math.round(total * (ins?.coverage || 0));
      const patientShare = total - insShare;
      const st = r.pick(['posted', 'paid', 'paid', 'partial', 'draft']);
      const paid = st === 'paid' ? patientShare : st === 'partial' ? Math.round(patientShare * 0.4) : 0;
      invoices.push({ id: `INV-26-${EM.pad(8100 + i, 5)}`, patientId: pat.id, at: ago(r.int(30, 60 * 24 * 12)), items, total, insShare, patientShare, paid, status: st, insurer: pat.insurer, adjustments: [] });
    }
    const payments = invoices.filter((x) => x.paid > 0).map((x, i) => ({ id: `PAY-${EM.pad(2200 + i, 5)}`, invoiceId: x.id, amount: x.paid, method: r.pick(['نقدي', 'بطاقة', 'محفظة إلكترونية']), at: x.at, by: 'u_acc' }));
    const refunds = [
      { id: 'RF-0091', invoiceId: invoices[1].id, amount: 350, reason: 'إلغاء كشف بعد السداد', requestedBy: 'u_acc', at: ago(160), status: 'pending' },
      { id: 'RF-0092', invoiceId: invoices[4].id, amount: 180, reason: 'تحليل مكرر بالخطأ', requestedBy: 'u_acc2', at: ago(75), status: 'pending' },
      { id: 'RF-0088', invoiceId: invoices[7].id, amount: 450, reason: 'عدم إجراء الأشعة', requestedBy: 'u_acc2', at: ago(60 * 26), status: 'approved', decidedBy: 'u_acc' },
    ];
    const claims = invoices.filter((x) => x.insShare > 0).slice(0, 12).map((x, i) => ({
      id: `CLM-${EM.pad(660 + i, 4)}`, invoiceId: x.id, insurer: x.insurer, amount: x.insShare,
      status: r.pick(['submitted', 'accepted', 'accepted', 'rejected', 'preauth']),
      reason: null, at: x.at,
    }));
    claims.forEach((c) => { if (c.status === 'rejected') c.reason = r.pick(['نقص تقرير طبي مرفق', 'الخدمة خارج نطاق التغطية', 'رقم الوثيقة غير مطابق']); });

    /* ---------- المهام التمريضية ---------- */
    const NT = ['قياس العلامات الحيوية', 'إعطاء دواء مجدول', 'تغيير ضماد الجرح', 'تقييم خطر السقوط', 'قياس السكر', 'تسليم واستلام المناوبة', 'تقييم الألم', 'متابعة المحاليل', 'تجهيز للخروج'];
    const occupied = beds.filter((b) => b.status === 'occupied');
    const nursing = [];
    for (let i = 0; i < 22; i++) {
      const bed = occupied[i % occupied.length];
      const due = r.int(-50, 180);
      nursing.push({ id: `NT-${EM.pad(900 + i, 4)}`, patientId: bed.patientId, bed: bed.id, task: r.pick(NT), due: ahead(due), status: due < -20 && r.chance(0.5) ? 'done' : 'pending', priority: r.chance(0.2) ? 'عالية' : 'عادية', assignee: r.chance(0.6) ? 'u_nur' : null });
    }

    /* ---------- المخزون ---------- */
    const supplies = [
      { code: 'M101', name: 'قفازات معقمة مقاس 7', unit: 'زوج', stock: 1800, min: 800 },
      { code: 'M102', name: 'كانيولا وريدية 20G', unit: 'قطعة', stock: 260, min: 400 },
      { code: 'M103', name: 'سرنجات 5 مل', unit: 'قطعة', stock: 3200, min: 1000 },
      { code: 'M104', name: 'أنابيب سحب عينات بنفسجي', unit: 'قطعة', stock: 540, min: 300 },
      { code: 'M105', name: 'خيط جراحي 3/0', unit: 'علبة', stock: 42, min: 60 },
      { code: 'M106', name: 'كمامات N95', unit: 'قطعة', stock: 700, min: 500 },
      { code: 'M107', name: 'قسطرة بولية فولي 16', unit: 'قطعة', stock: 95, min: 80 },
    ];
    const stockMoves = [
      { id: 'SM-1', item: 'D002', type: 'صرف', qty: -18, by: 'u_pha', at: ago(90), ref: 'الطوارئ' },
      { id: 'SM-2', item: 'M102', type: 'صرف', qty: -60, by: 'u_inv', at: ago(200), ref: 'الباطنة' },
      { id: 'SM-3', item: 'D010', type: 'استلام', qty: 400, by: 'u_inv', at: ago(60 * 20), ref: 'أمر شراء PO-771' },
      { id: 'SM-4', item: 'D004', type: 'صرف (مخدر — توقيع مزدوج)', qty: -2, by: 'u_pha', at: ago(45), ref: 'العمليات' },
    ];
    const purchaseRequests = [
      { id: 'PR-310', item: 'D006', qty: 200, status: 'بانتظار الاعتماد', by: 'u_inv', at: ago(300) },
      { id: 'PR-309', item: 'M105', qty: 100, status: 'معتمد — لدى المورد', by: 'u_inv', at: ago(60 * 30) },
    ];

    /* ---------- الإشعارات ---------- */
    const notifications = [
      { id: 'n1', kind: 'bad', title: 'نتيجة حرجة', body: 'تروبونين مرتفع لمريض بالطوارئ — بانتظار إقرار الطبيب', at: ago(6), read: false, link: '#/lab' },
      { id: 'n2', kind: 'warn', title: 'مهمة متأخرة', body: 'تجهيز سرير الباطنة 7 تجاوز زمن الخدمة بـ 25 دقيقة', at: ago(14), read: false, link: '#/beds' },
      { id: 'n3', kind: 'info', title: 'طلب اعتماد', body: 'طلب استرداد RF-0092 بانتظار اعتماد محاسب آخر', at: ago(75), read: false, link: '#/billing' },
      { id: 'n4', kind: 'warn', title: 'نقص مخزون', body: 'هيبارين 5000 وحدة أقل من الحد الأدنى', at: ago(130), read: true, link: '#/inventory' },
      { id: 'n5', kind: 'bad', title: 'فشل تنفيذ', body: 'تعذر إرسال مطالبة لشركة التأمين — إعادة المحاولة 2 من 5', at: ago(40), read: false, link: '#/workflows/monitor' },
    ];

    return {
      patients, appointments, er, lab, rad, rx, beds, bedRequests, surgeries,
      invoices, payments, refunds, claims, nursing, supplies, stockMoves, purchaseRequests, notifications,
      notes: [], audit: [], seededAt: now.toISOString(),
    };
  };
})();
