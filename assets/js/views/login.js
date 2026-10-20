/* شاشة الدخول — اختيار دور تجريبي مع خطوة تحقق ثنائي للأدوار الحساسة */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store } = EM;

  const FEATURED = ['u_hadm', 'u_rec', 'u_tri', 'u_doc', 'u_nur', 'u_labs', 'u_pha', 'u_acc', 'u_sys'];

  EM.views.login = {
    render(root) {
      root.innerHTML = `
      <div class="login">
        <section class="login-hero" aria-hidden="true">
          <div class="login-pattern"></div>
          <div class="login-brand">
            <img src="assets/img/logo.svg" alt="" width="64" height="64">
            <div class="login-word">المروة</div>
            <p class="login-tag">مستشفى واحد، ملف واحد لكل مريض، ومسار واضح لكل خطوة — من باب الطوارئ حتى المتابعة بعد الخروج.</p>
          </div>
          <svg class="login-pulse" viewBox="0 0 1200 160" preserveAspectRatio="none">
            <path d="M0 100 H340 L370 70 L395 130 L430 20 L462 112 L486 100 H700 L720 84 L736 112 L760 100 H1200" />
          </svg>
          <div class="login-stats">
            <div><b class="num">${EM.REF.departments.length}</b><span>قسماً مترابطاً</span></div>
            <div><b class="num">${EM.WF_TEMPLATES.length}</b><span>مسار عمل قابل للتنفيذ</span></div>
            <div><b class="num">${EM.SCENARIOS.length}</b><span>سيناريو استثناء موثق</span></div>
          </div>
        </section>
        <section class="login-panel">
          <div class="login-card" id="loginCard">
            <h1>تسجيل الدخول</h1>
            <p class="muted">حساب واحد يدير المستشفى بكل أقسامه.</p>
            <form id="ownerForm" class="stack" autocomplete="off">
              <div class="field"><label for="lg-user">اسم المستخدم</label><input id="lg-user" class="input" value="admin" autocomplete="username"></div>
              <div class="field"><label for="lg-pass">كلمة المرور</label><input id="lg-pass" class="input" type="password" value="elmarwa" autocomplete="current-password"><span class="hint">بيانات العرض: admin / elmarwa</span></div>
              <button class="btn primary login-go" type="submit">${icon('lock', 'sm')} دخول المدير العام</button>
            </form>
            <details class="small login-roles"><summary class="muted">تجربة النظام بدور موظف في قسم معين</summary>
              <div class="login-users">
              ${FEATURED.map((id) => { const u = EM.REF.user(id); const r = EM.REF.role(u.role); return `
                <button class="login-user" data-u="${esc(id)}">
                  <span class="avatar">${esc(EM.initials(u.name.replace(/^(د\.|م\.|أ\.|ممرض\/|ممرضة\/)\s*/, '')))}</span>
                  <span class="grow"><b>${esc(r.name)}</b><span>${esc(u.name)}</span></span>
                  ${r.mfa ? `<span class="pill info plain">${icon('lock', 'sm')} تحقق ثنائي</span>` : ''}
                </button>`; }).join('')}
              </div>
              <select class="input" id="anyRole" style="margin-top:8px" aria-label="كل الأدوار">${EM.REF.staff.map((s) => `<option value="${esc(s.id)}">${esc(EM.REF.role(s.role).name)} — ${esc(s.name)}</option>`).join('')}</select>
              <button class="btn" id="anyGo" type="button" style="margin-top:8px;width:100%">الدخول بهذا الدور</button>
            </details>
            <div id="installSlot"></div>
            <p class="xs muted login-foot">تقديم شركة <b>${esc(EM.HOSPITAL.vendor)}</b> · نسخة عرض ببيانات وهمية</p>
          </div>
        </section>
      </div>`;

      const go = (id) => {
        const u = EM.REF.user(id);
        const r = EM.REF.role(u.role);
        if (!r.mfa) { store.login(id); EM.render(); return; }
        const card = root.querySelector('#loginCard');
        card.innerHTML = `
          <h1>التحقق الثنائي</h1>
          <p class="muted">دور «${esc(r.name)}» يتطلب رمز تحقق إضافياً. في نسخة العرض الرمز هو <b class="num">246810</b>.</p>
          <form id="mfa" class="stack">
            <div class="field"><label for="otp">رمز التحقق المكوّن من 6 أرقام</label>
              <input id="otp" class="input num" inputmode="numeric" maxlength="6" autocomplete="one-time-code" style="font-size:1.5rem;letter-spacing:.4em;text-align:center" required></div>
            <button class="btn primary" type="submit">تحقق وادخل</button>
            <button class="btn ghost" type="button" id="back">رجوع</button>
          </form>`;
        card.querySelector('#otp').focus();
        card.querySelector('#back').addEventListener('click', () => EM.views.login.render(root));
        card.querySelector('#mfa').addEventListener('submit', (e) => {
          e.preventDefault();
          if (card.querySelector('#otp').value.trim() !== '246810') { ui.toast('رمز التحقق غير صحيح', 'bad'); return; }
          store.login(id);
          EM.render();
        });
      };
      // زر تنزيل التطبيق — يتغير حسب حالة الجهاز
      const slot = root.querySelector('#installSlot');
      const drawInstall = (st) => {
        if (!slot.isConnected) return;
        const dev = EM.pwa.isIOS ? 'iPhone و iPad' : EM.pwa.isAndroid ? 'أندرويد' : 'الكمبيوتر';
        slot.innerHTML = st === 'installed'
          ? `<div class="install-card done">${icon('check')}<div><b>تعمل من تطبيق المروة المثبت</b><span>يفتح بدون إنترنت بعد أول تشغيل</span></div></div>`
          : `<button class="install-card" id="installBtn" type="button"><img src="assets/img/icons/icon-192.png" alt="" width="44" height="44">
              <div class="grow"><b>تنزيل تطبيق المروة</b><span>ثبّته على ${dev} — يفتح كتطبيق مستقل ويعمل بدون إنترنت</span></div>
              <span class="install-go">${icon('download', 'sm')} تنزيل</span></button>`;
        slot.querySelector('#installBtn')?.addEventListener('click', () => EM.pwa.install());
      };
      drawInstall(EM.pwa.state());
      const off = EM.pwa.onChange((st) => { if (!slot.isConnected) off(); else drawInstall(st); });

      root.querySelector('#ownerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const u = root.querySelector('#lg-user').value.trim().toLowerCase();
        const pw = root.querySelector('#lg-pass').value;
        if (u !== 'admin' || pw !== 'elmarwa') { ui.toast('اسم المستخدم أو كلمة المرور غير صحيحة', 'bad'); return; }
        go('u_owner');
      });
      root.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => go(b.dataset.u)));
      root.querySelector('#anyGo').addEventListener('click', () => go(root.querySelector('#anyRole').value));
    },
  };
})();
