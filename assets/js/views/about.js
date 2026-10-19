/* عن النظام — الهوية، طريقة التشغيل، خارطة الطريق */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store } = EM;

  EM.views.about = {
    title: () => 'عن النظام',
    render(el) {
      el.innerHTML = `<div class="page">
        <section class="panel about-hero">
          <img src="assets/img/logo.svg" alt="" width="72" height="72">
          <div>
            <h1>${esc(EM.HOSPITAL.name)}</h1>
            <p>نظام متكامل لإدارة المستشفى مع محرك ومصمم سير عمل مرئي. تقديم شركة <b>${esc(EM.HOSPITAL.vendor)}</b>.</p>
            <p class="xs">الإصدار <span class="num">${esc(EM.HOSPITAL.version)}</span> — نسخة واجهة أمامية للعرض التقديمي.</p>
          </div>
        </section>
        <div class="grid c2">
          <section class="panel"><div class="panel-head"><h2>ما الذي تعرضه هذه النسخة</h2></div>
            <ul class="list">
              ${[
                ['flow', 'مصمم سير عمل مرئي حقيقي: عقد، قرارات، تفرعات متوازية، مؤقتات، تحقق قبل النشر، إصدارات، استيراد وتصدير، ومحاكاة.'],
                ['monitor', 'محرك تنفيذ: مثيلات بحالة محفوظة، مهام بشرية، اعتمادات بفصل المهام، إيقاف واستئناف وإلغاء مع تعويض.'],
                ['users', 'رحلة المريض كاملة: تسجيل مع كشف التكرار، مواعيد، طوارئ وفرز، عيادات، معمل، أشعة، صيدلية، أسرّة، عمليات، خروج.'],
                ['wallet', 'المالية: فواتير وتأمين ومدفوعات بمفتاح عدم تكرار، واسترداد بقيد عكسي واعتماد مزدوج.'],
                ['shield', '23 دوراً و39 صلاحية، تحقق ثنائي للأدوار الحساسة، وسجل تدقيق إلحاقي ببصمات متسلسلة.'],
                ['alert', 'كتالوج 28 سيناريو استثناء بعشرة عناصر لكل سيناريو، قابل للإضافة.'],
              ].map(([i, t]) => `<li>${icon(i)}<span class="small">${t}</span></li>`).join('')}
            </ul></section>
          <section class="panel"><div class="panel-head"><h2>حدود نسخة العرض</h2></div>
            <div class="panel-body stack small">
              <p>كل البيانات <b>وهمية</b> ومولّدة تلقائياً، وتُحفظ في متصفحك فقط (localStorage). لا يوجد خادم ولا قاعدة بيانات ولا إرسال لأي بيانات.</p>
              <p>الصلاحيات تُطبق في الواجهة لأغراض العرض. في النسخة الإنتاجية يجب فرضها على الخادم (Laravel Policies) مع قاعدة بيانات وطوابير.</p>
              <p>النظام لا يقترح تشخيصاً ولا يصف علاجاً. التنبيهات الدوائية أمثلة توضيحية وليست قاعدة بيانات دوائية معتمدة.</p>
              <p>متطلبات الامتثال المصرية (السجلات الطبية، حماية البيانات الشخصية، الأمن السيبراني) تحتاج مراجعة قانونية محلية مختصة قبل التشغيل الفعلي.</p>
            </div></section>
        </div>
        <section class="panel"><div class="panel-head"><h2>خارطة الطريق للنسخة الإنتاجية</h2></div>
          <ol class="roadmap">
            <li><b>الخادم</b><span>Laravel + PostgreSQL، نقل منطق محرك سير العمل إلى خدمات PHP مع جداول التعريفات والإصدارات والمثيلات والمهام.</span></li>
            <li><b>الطوابير والمؤقتات</b><span>Redis + Laravel Queues لتنفيذ الإجراءات الآلية والمؤقتات وتصعيد SLA مع إعادة المحاولة.</span></li>
            <li><b>الواجهة</b><span>ترحيل هذه الشاشات إلى Vue 3 + TypeScript واستخدام Vue Flow لمصمم سير العمل مع الحفاظ على نفس التصميم.</span></li>
            <li><b>الأمان</b><span>مصادقة مع MFA، سياسات صلاحيات على مستوى المورد، تشفير، نسخ احتياطي، واختبارات اختراق.</span></li>
            <li><b>التكاملات</b><span>أجهزة المعمل، PACS/RIS، شركات التأمين، الرسائل النصية، بمعايير HL7/FHIR عند الحاجة.</span></li>
          </ol></section>
        <section class="panel"><div class="panel-body row between wrap">
          <div><b>إعادة بيانات العرض</b><p class="small muted">يعيد كل البيانات والمسارات للحالة الأصلية. مفيد قبل بدء عرض تقديمي جديد.</p></div>
          <button class="btn danger" data-action="reset">${icon('refresh')} إعادة البيانات التجريبية</button>
        </div></section>
      </div>`;
      ui.bind(el, {
        reset: () => ui.confirm({ title: 'إعادة البيانات التجريبية', message: 'سيتم حذف كل التعديلات التي تمت في هذا المتصفح.', danger: true, confirm: 'إعادة', onOk: () => store.reset() }),
      });
    },
  };
})();
