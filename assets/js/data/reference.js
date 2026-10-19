/* البيانات المرجعية: الأقسام، الأدوار، الصلاحيات، الكتالوجات */
(function () {
  'use strict';
  const EM = window.EM;

  EM.HOSPITAL = {
    name: 'مستشفى المروة',
    nameEn: 'Elmarwa Hospital',
    vendor: 'سوفت استريم',
    vendorEn: 'Soft Stream',
    version: '1.0.0-demo',
  };

  /* ---------- الأقسام (قابلة للإضافة والتعديل والتعطيل) ---------- */
  EM.REF = {};
  EM.REF.departments = [
    { id: 'reception', name: 'الاستقبال والتسجيل', kind: 'إداري', head: 'u_rec', active: true, sla: 10 },
    { id: 'er', name: 'الطوارئ', kind: 'سريري', head: 'u_tri', active: true, sla: 5 },
    { id: 'opd', name: 'العيادات الخارجية', kind: 'سريري', head: 'u_doc', active: true, sla: 30 },
    { id: 'nursing', name: 'التمريض', kind: 'سريري', head: 'u_ward', active: true, sla: 15 },
    { id: 'wards', name: 'الأقسام الداخلية والأسرّة', kind: 'سريري', head: 'u_ward', active: true, sla: 60 },
    { id: 'icu', name: 'العناية المركزة', kind: 'سريري', head: 'u_icu', active: true, sla: 5 },
    { id: 'nicu', name: 'حضانات الأطفال', kind: 'سريري', head: 'u_icu', active: true, sla: 5 },
    { id: 'lab', name: 'المعمل', kind: 'تشخيصي', head: 'u_labs', active: true, sla: 60 },
    { id: 'rad', name: 'الأشعة', kind: 'تشخيصي', head: 'u_radg', active: true, sla: 90 },
    { id: 'pharmacy', name: 'الصيدلية', kind: 'خدمي', head: 'u_pha', active: true, sla: 20 },
    { id: 'or', name: 'العمليات', kind: 'سريري', head: 'u_sur', active: true, sla: 30 },
    { id: 'records', name: 'السجلات الطبية', kind: 'إداري', head: 'u_mro', active: true, sla: 120 },
    { id: 'billing', name: 'الحسابات والفوترة', kind: 'مالي', head: 'u_acc', active: true, sla: 30 },
    { id: 'insurance', name: 'التأمين والمطالبات', kind: 'مالي', head: 'u_ins', active: true, sla: 240 },
    { id: 'procurement', name: 'المشتريات', kind: 'إداري', head: 'u_inv', active: true, sla: 1440 },
    { id: 'inventory', name: 'المخازن والمستلزمات', kind: 'خدمي', head: 'u_inv', active: true, sla: 240 },
    { id: 'biomed', name: 'صيانة الأجهزة الطبية', kind: 'خدمي', head: 'u_it', active: true, sla: 240 },
    { id: 'housekeeping', name: 'النظافة وتجهيز الأسرّة', kind: 'خدمي', head: 'u_ward', active: true, sla: 45 },
    { id: 'scheduling', name: 'جداول المناوبات', kind: 'إداري', head: 'u_hadm', active: true, sla: 1440 },
    { id: 'hr', name: 'الموارد البشرية', kind: 'إداري', head: 'u_hadm', active: true, sla: 2880 },
    { id: 'admin', name: 'الإدارة العامة', kind: 'إداري', head: 'u_hadm', active: true, sla: 1440 },
    { id: 'quality', name: 'الجودة وتقارير الحوادث', kind: 'رقابي', head: 'u_qm', active: true, sla: 1440 },
    { id: 'it', name: 'تقنية المعلومات', kind: 'خدمي', head: 'u_it', active: true, sla: 60 },
  ];

  /* ---------- كتالوج الصلاحيات ---------- */
  EM.REF.permissions = [
    ['dashboard.view', 'عرض لوحة القيادة', 'عام'],
    ['patients.view', 'عرض ملفات المرضى', 'المرضى'],
    ['patients.create', 'تسجيل مريض جديد', 'المرضى'],
    ['patients.edit', 'تصحيح البيانات الديموغرافية', 'المرضى'],
    ['patients.merge', 'دمج السجلات المكررة', 'المرضى'],
    ['appointments.manage', 'إدارة المواعيد والطوابير', 'المواعيد'],
    ['er.view', 'عرض لوحة الطوارئ', 'الطوارئ'],
    ['er.triage', 'الفرز وتحديد الأولوية', 'الطوارئ'],
    ['clinic.consult', 'الكشف والتوثيق السريري', 'سريري'],
    ['orders.create', 'طلب تحاليل وأشعة وأدوية', 'سريري'],
    ['nursing.tasks', 'المهام التمريضية والعلامات الحيوية', 'سريري'],
    ['lab.view', 'عرض قائمة عمل المعمل', 'المعمل'],
    ['lab.process', 'سحب وتشغيل العينات', 'المعمل'],
    ['lab.verify', 'اعتماد وإصدار النتائج', 'المعمل'],
    ['rad.view', 'عرض قائمة عمل الأشعة', 'الأشعة'],
    ['rad.report', 'كتابة واعتماد تقارير الأشعة', 'الأشعة'],
    ['pharmacy.view', 'عرض الصيدلية', 'الصيدلية'],
    ['pharmacy.dispense', 'مراجعة وصرف الأدوية', 'الصيدلية'],
    ['beds.view', 'عرض لوحة الأسرّة', 'الإقامة'],
    ['beds.assign', 'تخصيص ونقل الأسرّة', 'الإقامة'],
    ['surgery.view', 'عرض جدول العمليات', 'العمليات'],
    ['surgery.manage', 'إدارة العمليات وقائمة السلامة', 'العمليات'],
    ['billing.view', 'عرض الفواتير', 'المالية'],
    ['billing.post', 'تسجيل المدفوعات', 'المالية'],
    ['billing.refund.request', 'طلب استرداد', 'المالية'],
    ['billing.refund.approve', 'اعتماد الاسترداد والخصم', 'المالية'],
    ['insurance.claims', 'إدارة مطالبات التأمين', 'المالية'],
    ['inventory.view', 'عرض المخزون', 'المخازن'],
    ['inventory.manage', 'حركات المخزون وطلبات الشراء', 'المخازن'],
    ['workflows.view', 'عرض سير العمل', 'سير العمل'],
    ['workflows.design', 'تصميم وتعديل سير العمل', 'سير العمل'],
    ['workflows.publish', 'نشر وإيقاف الإصدارات', 'سير العمل'],
    ['workflows.monitor', 'مراقبة التنفيذ والمهام المتأخرة', 'سير العمل'],
    ['workflows.intervene', 'التدخل اليدوي المصرّح به', 'سير العمل'],
    ['scenarios.view', 'كتالوج الاستثناءات', 'سير العمل'],
    ['admin.roles', 'إدارة الأدوار والصلاحيات', 'الإدارة'],
    ['admin.departments', 'إدارة الأقسام', 'الإدارة'],
    ['audit.view', 'سجل التدقيق والأمان', 'الإدارة'],
    ['data.export', 'تصدير البيانات', 'الإدارة'],
    ['discharge.manage', 'إدارة إجراءات الخروج', 'الإقامة'],
    ['housekeeping.manage', 'النظافة وتجهيز الأسرّة', 'الخدمات المساندة'],
    ['hr.manage', 'الموارد البشرية والمناوبات', 'الخدمات المساندة'],
    ['biomed.manage', 'صيانة الأجهزة الطبية', 'الخدمات المساندة'],
    ['records.manage', 'السجلات الطبية', 'الخدمات المساندة'],
    ['quality.manage', 'الجودة وبلاغات السلامة', 'الخدمات المساندة'],
  ].map(([id, name, group]) => ({ id, name, group }));

  const ALL = EM.REF.permissions.map((p) => p.id);
  const base = ['dashboard.view'];

  /* ---------- الأدوار (23 دوراً) ---------- */
  EM.REF.roles = [
    // الحساب الموحد: شخص واحد يدير كل الأقسام. فصل المهام يبقى مفعلاً لكنه يُتجاوز باعتماد استثنائي موثق.
    { id: 'owner', name: 'المدير العام', perms: ALL, mfa: true },
    // مدير النظام يدير الإعدادات والمسارات والأمان فقط — بلا وصول لملفات المرضى أو قرارات سريرية أو مالية
    { id: 'sysadmin', name: 'مدير النظام', perms: [...base, 'workflows.view', 'workflows.design', 'workflows.publish', 'workflows.monitor', 'workflows.intervene', 'scenarios.view', 'admin.roles', 'admin.departments', 'audit.view', 'data.export', 'inventory.view'], mfa: true },
    { id: 'hadmin', name: 'مدير المستشفى', perms: [...base, 'patients.view', 'er.view', 'lab.view', 'rad.view', 'pharmacy.view', 'beds.view', 'surgery.view', 'billing.view', 'inventory.view', 'workflows.view', 'workflows.design', 'workflows.publish', 'workflows.monitor', 'workflows.intervene', 'scenarios.view', 'admin.departments', 'admin.roles', 'audit.view', 'billing.refund.approve', 'data.export', 'discharge.manage', 'housekeeping.manage', 'hr.manage', 'biomed.manage', 'records.manage', 'quality.manage'], mfa: true },
    { id: 'receptionist', name: 'موظف استقبال', perms: [...base, 'patients.view', 'patients.create', 'patients.edit', 'appointments.manage', 'er.view', 'beds.view', 'billing.view'] },
    { id: 'triage', name: 'ممرض فرز', perms: [...base, 'patients.view', 'patients.create', 'er.view', 'er.triage', 'nursing.tasks', 'beds.view'] },
    { id: 'nurse', name: 'ممرض', perms: [...base, 'patients.view', 'nursing.tasks', 'beds.view', 'pharmacy.view', 'lab.view', 'workflows.view'] },
    { id: 'doctor', name: 'طبيب', perms: [...base, 'discharge.manage', 'patients.view', 'er.view', 'clinic.consult', 'orders.create', 'lab.view', 'rad.view', 'pharmacy.view', 'beds.view', 'beds.assign', 'surgery.view', 'workflows.view'] },
    { id: 'consultant', name: 'استشاري', perms: [...base, 'patients.view', 'er.view', 'clinic.consult', 'orders.create', 'lab.view', 'rad.view', 'pharmacy.view', 'beds.view', 'beds.assign', 'surgery.view', 'workflows.view', 'workflows.intervene'] },
    { id: 'labtech', name: 'فني معمل', perms: [...base, 'patients.view', 'lab.view', 'lab.process'] },
    { id: 'labsup', name: 'مشرف معمل', perms: [...base, 'patients.view', 'lab.view', 'lab.process', 'lab.verify', 'workflows.monitor'] },
    { id: 'radtech', name: 'فني أشعة', perms: [...base, 'patients.view', 'rad.view'] },
    { id: 'radiologist', name: 'طبيب أشعة', perms: [...base, 'patients.view', 'rad.view', 'rad.report'] },
    { id: 'pharmacist', name: 'صيدلي', perms: [...base, 'patients.view', 'pharmacy.view', 'pharmacy.dispense', 'inventory.view'] },
    { id: 'wardmgr', name: 'مدير قسم داخلي', perms: [...base, 'discharge.manage', 'housekeeping.manage', 'patients.view', 'nursing.tasks', 'beds.view', 'beds.assign', 'workflows.monitor'] },
    { id: 'icu', name: 'طاقم العناية المركزة', perms: [...base, 'patients.view', 'nursing.tasks', 'beds.view', 'orders.create', 'clinic.consult'] },
    { id: 'surgeon', name: 'جرّاح', perms: [...base, 'patients.view', 'clinic.consult', 'orders.create', 'surgery.view', 'surgery.manage', 'beds.view', 'lab.view', 'rad.view'] },
    { id: 'anesth', name: 'طبيب تخدير', perms: [...base, 'patients.view', 'clinic.consult', 'surgery.view', 'surgery.manage', 'pharmacy.view'] },
    { id: 'accountant', name: 'محاسب', perms: [...base, 'patients.view', 'billing.view', 'billing.post', 'billing.refund.request', 'billing.refund.approve', 'insurance.claims'] },
    { id: 'insurance', name: 'موظف تأمين', perms: [...base, 'patients.view', 'billing.view', 'insurance.claims'] },
    { id: 'inventory', name: 'أمين مخزن', perms: [...base, 'inventory.view', 'inventory.manage', 'pharmacy.view'] },
    { id: 'records', name: 'موظف سجلات طبية', perms: [...base, 'records.manage', 'patients.view', 'patients.edit', 'patients.merge'] },
    { id: 'quality', name: 'مدير الجودة', perms: [...base, 'quality.manage', 'patients.view', 'workflows.view', 'workflows.monitor', 'scenarios.view', 'audit.view'] },
    { id: 'auditor', name: 'مدقق', perms: [...base, 'audit.view', 'billing.view', 'workflows.view', 'scenarios.view'] },
    { id: 'itsupport', name: 'الدعم الفني', perms: [...base, 'biomed.manage', 'workflows.view', 'workflows.monitor', 'audit.view'] },
  ];

  /* ---------- طاقم العمل (مستخدم تجريبي لكل دور) ---------- */
  EM.REF.staff = [
    { id: 'u_owner', name: 'المدير العام', role: 'owner', dept: 'admin' },
    { id: 'u_sys', name: 'م. كريم عادل', role: 'sysadmin', dept: 'it' },
    { id: 'u_hadm', name: 'د. هالة منصور', role: 'hadmin', dept: 'admin' },
    { id: 'u_rec', name: 'منى سعيد', role: 'receptionist', dept: 'reception' },
    { id: 'u_tri', name: 'ممرض/ أحمد فتحي', role: 'triage', dept: 'er' },
    { id: 'u_nur', name: 'ممرضة/ سارة إبراهيم', role: 'nurse', dept: 'nursing' },
    { id: 'u_doc', name: 'د. يوسف الشريف', role: 'doctor', dept: 'opd' },
    { id: 'u_con', name: 'د. نادية الحسيني', role: 'consultant', dept: 'opd' },
    { id: 'u_lab', name: 'محمود رجب', role: 'labtech', dept: 'lab' },
    { id: 'u_labs', name: 'د. ريهام عبد العزيز', role: 'labsup', dept: 'lab' },
    { id: 'u_radt', name: 'إسلام حمدي', role: 'radtech', dept: 'rad' },
    { id: 'u_radg', name: 'د. شريف البنا', role: 'radiologist', dept: 'rad' },
    { id: 'u_pha', name: 'د. ياسمين فوزي', role: 'pharmacist', dept: 'pharmacy' },
    { id: 'u_ward', name: 'أ. عبير مصطفى', role: 'wardmgr', dept: 'wards' },
    { id: 'u_icu', name: 'د. طارق سليمان', role: 'icu', dept: 'icu' },
    { id: 'u_sur', name: 'د. عمرو الجمال', role: 'surgeon', dept: 'or' },
    { id: 'u_ane', name: 'د. دينا رشاد', role: 'anesth', dept: 'or' },
    { id: 'u_acc', name: 'أ. حسام زكي', role: 'accountant', dept: 'billing' },
    { id: 'u_acc2', name: 'أ. مروة نبيل', role: 'accountant', dept: 'billing' },
    { id: 'u_ins', name: 'أ. رانيا كمال', role: 'insurance', dept: 'insurance' },
    { id: 'u_inv', name: 'أ. سامح عزت', role: 'inventory', dept: 'inventory' },
    { id: 'u_mro', name: 'أ. إيمان خليل', role: 'records', dept: 'records' },
    { id: 'u_qm', name: 'د. ليلى حسن', role: 'quality', dept: 'quality' },
    { id: 'u_aud', name: 'أ. وائل شوقي', role: 'auditor', dept: 'admin' },
    { id: 'u_it', name: 'م. باسم فاروق', role: 'itsupport', dept: 'it' },
  ];

  /* ---------- الأجنحة والأسرّة ---------- */
  EM.REF.wards = [
    { id: 'W-MED', name: 'الباطنة — الدور الثالث', beds: 16, gender: 'مختلط' },
    { id: 'W-SUR', name: 'الجراحة — الدور الرابع', beds: 14, gender: 'مختلط' },
    { id: 'W-OBS', name: 'النساء والتوليد', beds: 10, gender: 'إناث' },
    { id: 'W-PED', name: 'الأطفال', beds: 10, gender: 'مختلط' },
    { id: 'W-ICU', name: 'العناية المركزة', beds: 8, gender: 'مختلط' },
    { id: 'W-NIC', name: 'الحضانات', beds: 6, gender: 'مختلط' },
  ];

  EM.REF.labTests = [
    { code: 'CBC', name: 'صورة دم كاملة', tat: 45, price: 180, specimen: 'دم — أنبوب بنفسجي' },
    { code: 'BMP', name: 'وظائف كلى وأملاح', tat: 60, price: 320, specimen: 'دم — أنبوب أصفر' },
    { code: 'LFT', name: 'وظائف كبد', tat: 60, price: 350, specimen: 'دم — أنبوب أصفر' },
    { code: 'TROP', name: 'تروبونين القلب', tat: 30, price: 450, specimen: 'دم — أنبوب أخضر' },
    { code: 'CRP', name: 'بروتين سي التفاعلي', tat: 45, price: 200, specimen: 'دم — أنبوب أصفر' },
    { code: 'HBA1C', name: 'السكر التراكمي', tat: 120, price: 280, specimen: 'دم — أنبوب بنفسجي' },
    { code: 'COAG', name: 'سيولة الدم PT/INR', tat: 45, price: 220, specimen: 'دم — أنبوب أزرق' },
    { code: 'UA', name: 'تحليل بول كامل', tat: 40, price: 90, specimen: 'بول' },
    { code: 'CULT', name: 'مزرعة دم', tat: 2880, price: 600, specimen: 'دم — زجاجة مزرعة' },
    { code: 'ABG', name: 'غازات الدم الشرياني', tat: 15, price: 380, specimen: 'دم شرياني' },
  ];

  EM.REF.imaging = [
    { code: 'XR-CH', name: 'أشعة عادية على الصدر', modality: 'X-Ray', price: 250, tat: 60 },
    { code: 'CT-BR', name: 'أشعة مقطعية على المخ', modality: 'CT', price: 1400, tat: 90 },
    { code: 'CT-AB', name: 'مقطعية على البطن بالصبغة', modality: 'CT', price: 2200, tat: 120 },
    { code: 'US-AB', name: 'سونار على البطن', modality: 'US', price: 450, tat: 60 },
    { code: 'MR-SP', name: 'رنين مغناطيسي على الفقرات', modality: 'MRI', price: 3200, tat: 240 },
    { code: 'ECHO', name: 'إيكو على القلب', modality: 'US', price: 900, tat: 120 },
  ];

  EM.REF.drugs = [
    { code: 'D001', name: 'باراسيتامول 1 جم وريد', form: 'محلول', stock: 340, min: 100, price: 45, controlled: false },
    { code: 'D002', name: 'سيفترياكسون 1 جم', form: 'فيال', stock: 62, min: 80, price: 38, controlled: false },
    { code: 'D003', name: 'أوميبرازول 40 مجم', form: 'فيال', stock: 210, min: 60, price: 52, controlled: false },
    { code: 'D004', name: 'مورفين 10 مجم', form: 'أمبول', stock: 24, min: 20, price: 30, controlled: true },
    { code: 'D005', name: 'إنسولين سريع المفعول', form: 'قلم', stock: 48, min: 30, price: 180, controlled: false },
    { code: 'D006', name: 'هيبارين 5000 وحدة', form: 'أمبول', stock: 15, min: 40, price: 25, controlled: false },
    { code: 'D007', name: 'أموكسيسيلين/كلافولانيك 1 جم', form: 'أقراص', stock: 520, min: 150, price: 12, controlled: false },
    { code: 'D008', name: 'فوروسيميد 20 مجم', form: 'أمبول', stock: 130, min: 50, price: 9, controlled: false },
    { code: 'D009', name: 'ميدازولام 5 مجم', form: 'أمبول', stock: 18, min: 15, price: 34, controlled: true },
    { code: 'D010', name: 'محلول ملح 0.9% 500 مل', form: 'محلول', stock: 900, min: 300, price: 15, controlled: false },
  ];

  EM.DRUGS_SEED = EM.clone(EM.REF.drugs);

  EM.REF.services = [
    { code: 'S-CONS', name: 'كشف عيادة', price: 350 },
    { code: 'S-CONS-C', name: 'كشف استشاري', price: 600 },
    { code: 'S-ER', name: 'كشف طوارئ', price: 400 },
    { code: 'S-BED', name: 'إقامة يوم — قسم داخلي', price: 1200 },
    { code: 'S-ICU', name: 'إقامة يوم — عناية مركزة', price: 5500 },
    { code: 'S-OR', name: 'رسوم غرفة عمليات (ساعة)', price: 4000 },
  ];

  EM.REF.insurers = [
    { id: 'INS-1', name: 'مصر للتأمين الصحي', coverage: 0.8 },
    { id: 'INS-2', name: 'الشرق للرعاية الطبية', coverage: 0.7 },
    { id: 'INS-3', name: 'تكافل النيل', coverage: 0.9 },
    { id: 'NONE', name: 'نقدي (بدون تأمين)', coverage: 0 },
  ];

  EM.REF.esi = [
    { level: 1, name: 'إنعاش فوري', color: 'var(--rose-500)', target: 0 },
    { level: 2, name: 'طارئ جداً', color: '#F07A2E', target: 10 },
    { level: 3, name: 'عاجل', color: 'var(--saffron-500)', target: 30 },
    { level: 4, name: 'أقل إلحاحاً', color: 'var(--faience-500)', target: 60 },
    { level: 5, name: 'غير عاجل', color: 'var(--lapis-500)', target: 120 },
  ];

  EM.REF.role = (id) => EM.REF.roles.find((r) => r.id === id);
  EM.REF.dept = (id) => EM.REF.departments.find((d) => d.id === id);
  EM.REF.user = (id) => EM.REF.staff.find((s) => s.id === id);
  EM.REF.deptName = (id) => EM.REF.dept(id)?.name || id || '—';
  EM.REF.userName = (id) => EM.REF.user(id)?.name || id || '—';
})();
