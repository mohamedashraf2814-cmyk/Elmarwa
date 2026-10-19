/* المخزن المركزي: الحالة، الجلسة، الصلاحيات، التدقيق، الإشعارات، سير العمل.
   في نسخة العرض تُحفظ الحالة في localStorage بالمتصفح. في الإنتاج يحل محلها API الخادم. */
(function () {
  'use strict';
  const EM = window.EM;
  const KEY = 'elmarwa.hms.v1';
  const SESSION_KEY = 'elmarwa.session.v1';

  const listeners = new Set();
  const store = {
    state: null,
    session: null,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(what) { listeners.forEach((fn) => { try { fn(what); } catch (e) { console.error(e); } }); },
  };

  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* التخزين غير متاح — العمل في الذاكرة */ } }

  store.save = EM.debounce(() => safeSet(KEY, JSON.stringify(store.state)), 250);

  store.init = function () {
    const raw = safeGet(KEY);
    if (raw) {
      try { store.state = JSON.parse(raw); } catch { store.state = null; }
    }
    if (!store.state || store.state.schema !== 3) seedAll();
    // المخزون جزء من الحالة المحفوظة؛ المراجع تشير لنفس المصفوفة
    EM.REF.drugs = store.state.drugs;
    if (store.state.departments) EM.REF.departments = store.state.departments;
    if (store.state.rolePerms) EM.REF.roles.forEach((r) => { if (store.state.rolePerms[r.id]) r.perms = store.state.rolePerms[r.id]; });
    const s = safeGet(SESSION_KEY);
    if (s) { try { store.session = JSON.parse(s); } catch { store.session = null; } }
  };

  /** إعادة بيانات العرض للحالة الأصلية ثم إعادة التحميل لتطبيق المراجع الافتراضية */
  store.reset = function () {
    try { localStorage.removeItem(KEY); } catch { /* */ }
    location.reload();
  };

  function seedAll() {
    const st = EM.seed();
    st.schema = 3;
    st.drugs = EM.clone(EM.DRUGS_SEED);
    EM.REF.drugs = st.drugs;
    st.workflows = EM.WF_TEMPLATES.map((t) => {
      const def = EM.WF.layout(EM.clone(t), true);
      def.versions = [{ version: 1, publishedAt: st.seededAt, publishedBy: 'u_hadm', snapshot: { nodes: EM.clone(def.nodes), edges: EM.clone(def.edges), variables: EM.clone(def.variables || []) } }];
      return def;
    });
    st.instances = [];
    seedInstances(st);
    st.audit = seedAudit(st);
    store.state = st;
  }

  /* ---------- مثيلات تنفيذ تجريبية حقيقية (تمر عبر المحرك نفسه) ---------- */
  function seedInstances(st) {
    const r = EM.rng(77);
    const plan = [
      ['wf_emergency', 9], ['wf_lab', 10], ['wf_outpatient', 8], ['wf_admission', 6], ['wf_pharmacy', 7],
      ['wf_discharge', 5], ['wf_refund', 3], ['wf_claims', 5], ['wf_registration', 4], ['wf_surgery', 3], ['wf_radiology', 4], ['wf_patient_journey', 4],
    ];
    const staffByRole = (role) => EM.REF.staff.find((s) => s.role === role)?.id || 'u_sys';
    let n = 0;
    plan.forEach(([wfId, count]) => {
      const def = st.workflows.find((w) => w.id === wfId);
      for (let i = 0; i < count; i++) {
        const vars = {};
        (def.variables || []).forEach((v) => {
          if (v.type === 'bool') vars[v.name] = r.chance(v.default ? 0.75 : 0.3);
          else if (v.type === 'enum') vars[v.name] = r.chance(0.6) ? v.default : r.pick(v.options);
          else if (v.type === 'number') vars[v.name] = v.name === 'esi' ? r.int(1, 5) : r.pick([350, 900, 6200]);
        });
        const elapsed = r.int(15, 420);
        const startAt = Date.now() - elapsed * 60000;
        const p = st.patients[(n * 7 + 3) % 64];
        const inst = EM.WF.createInstance(def, vars, { id: `WFI-${EM.pad(1000 + n, 5)}`, at: new Date(startAt).toISOString(), patientId: wfId === 'wf_refund' || wfId === 'wf_claims' ? null : p.id });
        if (wfId === 'wf_refund' || wfId === 'wf_claims') inst.ref = st.invoices[n % st.invoices.length].id;
        const steps = r.int(1, 14);
        for (let k = 0; k < steps && inst.status === 'running'; k++) {
          const at = new Date(startAt + ((k + 1) / (steps + 1)) * elapsed * 60000).toISOString();
          inst.tokens.slice().forEach((t) => {
            const nd = EM.WF.node(def, t.node);
            if (nd?.type === 'approval' && r.chance(0.12)) inst.outcomes[nd.id] = 'rejected';
            if (EM.WF.outs(def, nd?.id).some((e) => e.kind === 'timeout') && r.chance(0.12)) inst.forced[nd.id] = 'timeout';
            EM.WF.stepToken(def, inst, t.id, { at, by: EM.WF.TYPES[nd?.type]?.human ? staffByRole(nd.config.role) : null });
          });
        }
        advanceAutomatic(def, inst);
        // بعض المثيلات تعرض حالات الفشل والإيقاف
        if (inst.status === 'running' && r.chance(0.08)) { inst.status = 'failed'; inst.history.push({ at: new Date().toISOString(), node: inst.tokens[0]?.node, event: 'failed', note: 'فشل الاتصال بنظام خارجي — بانتظار إعادة المحاولة' }); }
        else if (inst.status === 'running' && r.chance(0.06)) { inst.status = 'paused'; inst.history.push({ at: new Date().toISOString(), event: 'paused', by: 'u_hadm', note: 'إيقاف مؤقت بقرار إداري' }); }
        st.instances.push(inst);
        n++;
      }
    });
  }

  function seedAudit(st) {
    const r = EM.rng(5);
    const acts = [
      ['تسجيل دخول', 'session', 'u_rec'], ['تسجيل مريض جديد', 'patient', 'u_rec'], ['فرز حالة طوارئ', 'er', 'u_tri'],
      ['اعتماد نتيجة تحليل', 'lab', 'u_labs'], ['صرف دواء', 'rx', 'u_pha'], ['تخصيص سرير', 'bed', 'u_ward'],
      ['تسجيل دفعة', 'invoice', 'u_acc'], ['نشر إصدار سير عمل', 'workflow', 'u_hadm'], ['محاولة غير مصرّح بها: اعتماد استرداد', 'refund', 'u_rec'],
      ['تصدير تقرير', 'report', 'u_hadm'], ['تعديل بيانات ديموغرافية', 'patient', 'u_mro'], ['إقرار نتيجة حرجة', 'lab', 'u_doc'],
    ];
    const out = [];
    for (let i = 0; i < 46; i++) {
      const [action, entity, by] = r.pick(acts);
      out.push({
        id: `AUD-${EM.pad(90000 + i, 6)}`, at: new Date(Date.now() - r.int(1, 60 * 30) * 60000).toISOString(),
        by, role: EM.REF.user(by)?.role, action, entity, entityId: entity === 'patient' ? r.pick(st.patients).id : `${entity.toUpperCase()}-${r.int(100, 999)}`,
        result: action.startsWith('محاولة') ? 'denied' : 'ok', ip: `10.20.${r.int(1, 9)}.${r.int(10, 240)}`,
        corr: `c-${Math.floor(r.next() * 1e8).toString(36)}`,
      });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }

  /* ---------- الجلسة والصلاحيات ---------- */
  store.login = function (staffId) {
    const u = EM.REF.user(staffId);
    if (!u) return;
    store.session = { userId: u.id, role: u.role, at: new Date().toISOString() };
    safeSet(SESSION_KEY, JSON.stringify(store.session));
    store.audit('تسجيل دخول', 'session', u.id);
  };
  store.logout = function () {
    if (store.session) store.audit('تسجيل خروج', 'session', store.session.userId);
    store.session = null;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* */ }
  };
  store.user = () => (store.session ? EM.REF.user(store.session.userId) : null);
  store.role = () => (store.session ? EM.REF.role(store.session.role) : null);
  store.can = (perm) => !!store.role()?.perms.includes(perm);

  /** حارس الصلاحيات: يسجل المحاولة المرفوضة في التدقيق ويعرض رسالة */
  store.guard = function (perm, actionLabel) {
    if (store.can(perm)) return true;
    store.audit(`محاولة غير مصرّح بها: ${actionLabel}`, 'security', perm, { result: 'denied' });
    EM.ui.toast(`لا تملك صلاحية «${actionLabel}». الدور الحالي: ${store.role()?.name || '—'}`, 'bad');
    return false;
  };

  store.audit = function (action, entity, entityId, extra = {}) {
    if (!store.state) return;
    const u = store.user();
    store.state.audit.unshift({
      id: EM.uid('AUD'), at: new Date().toISOString(), by: u?.id || 'system', role: u?.role || null,
      action, entity, entityId, result: extra.result || 'ok', reason: extra.reason || null,
      before: extra.before ?? null, after: extra.after ?? null, ip: '10.20.1.15', corr: EM.uid('c'),
    });
    if (store.state.audit.length > 800) store.state.audit.length = 800;
    store.save();
  };

  store.notify = function (kind, title, body, link) {
    store.state.notifications.unshift({ id: EM.uid('n'), kind, title, body, link, at: new Date().toISOString(), read: false });
    store.save();
    store.emit('notifications');
  };

  store.commit = function (what = 'data') { store.save(); store.emit(what); };

  /* ---------- مساعدات البحث ---------- */
  store.patient = (id) => store.state.patients.find((p) => p.id === id);
  store.patientName = (id) => store.patient(id)?.name || '—';

  /* ---------- سير العمل ---------- */
  store.workflow = (id) => store.state.workflows.find((w) => w.id === id);

  store.saveWorkflow = function (def) {
    const i = store.state.workflows.findIndex((w) => w.id === def.id);
    def.updatedAt = new Date().toISOString();
    def.updatedBy = store.user()?.id;
    if (def.status === 'published') def.status = 'draft';
    if (i >= 0) store.state.workflows[i] = def; else store.state.workflows.push(def);
    store.audit('حفظ مسودة سير عمل', 'workflow', def.id);
    store.commit('workflows');
  };

  store.publishWorkflow = function (def) {
    const v = EM.WF.validate(def);
    if (!v.ok) return v;
    const next = (def.versions?.at(-1)?.version || 0) + 1;
    def.version = next;
    def.status = 'published';
    def.versions = def.versions || [];
    def.versions.push({ version: next, publishedAt: new Date().toISOString(), publishedBy: store.user()?.id, snapshot: { nodes: EM.clone(def.nodes), edges: EM.clone(def.edges), variables: EM.clone(def.variables || []) } });
    const i = store.state.workflows.findIndex((w) => w.id === def.id);
    if (i >= 0) store.state.workflows[i] = def; else store.state.workflows.push(def);
    store.audit(`نشر الإصدار ${next}`, 'workflow', def.id);
    store.commit('workflows');
    return v;
  };

  store.setWorkflowStatus = function (id, status) {
    const w = store.workflow(id);
    if (!w) return;
    const before = w.status;
    w.status = status;
    store.audit(`تغيير حالة سير العمل إلى ${status}`, 'workflow', id, { before, after: status });
    store.commit('workflows');
  };

  store.duplicateWorkflow = function (id) {
    const src = store.workflow(id);
    const copy = EM.clone(src);
    copy.id = EM.uid('wf');
    copy.name = `${src.name} (نسخة)`;
    copy.status = 'draft';
    copy.version = 0;
    copy.versions = [];
    store.state.workflows.push(copy);
    store.audit('نسخ سير عمل', 'workflow', copy.id, { before: id });
    store.commit('workflows');
    return copy;
  };

  /** النسخة المنشورة التي يعمل بها المثيل — المثيلات النشطة تبقى على إصدارها الأصلي */
  store.versionDef = function (wfId, version) {
    const w = store.workflow(wfId);
    if (!w) return null;
    const v = w.versions?.find((x) => x.version === version);
    if (!v) return w;
    return { ...w, nodes: v.snapshot.nodes, edges: v.snapshot.edges, variables: v.snapshot.variables, version };
  };

  store.startInstance = function (wfId, vars, patientId) {
    const w = store.workflow(wfId);
    if (!w || w.status !== 'published') return null;
    const def = store.versionDef(wfId, w.version);
    const inst = EM.WF.createInstance(def, vars, { patientId });
    advanceAutomatic(def, inst);
    store.state.instances.unshift(inst);
    store.audit('بدء مثيل سير عمل', 'workflow_instance', inst.id, { after: wfId });
    store.commit('instances');
    return inst;
  };

  /** تقدم العقد الآلية تلقائياً حتى الوصول لمهمة بشرية أو مؤقت */
  function advanceAutomatic(def, inst) {
    let guard = 0;
    let progressed = true;
    while (progressed && inst.status === 'running' && guard++ < 60) {
      progressed = false;
      inst.tokens.slice().forEach((t) => {
        const n = EM.WF.node(def, t.node);
        if (n && !EM.WF.TYPES[n.type].human && n.type !== 'timer') {
          EM.WF.stepToken(def, inst, t.id);
          progressed = true;
        }
      });
    }
  }

  store.completeTask = function (instId, tokenId, outcome, note) {
    const inst = store.state.instances.find((i) => i.id === instId);
    if (!inst || inst.status !== 'running') return false;
    const def = store.versionDef(inst.workflowId, inst.version);
    const tok = inst.tokens.find((t) => t.id === tokenId);
    const n = EM.WF.node(def, tok?.node);
    if (!n) return false;
    if (n.config?.role && store.session?.role !== n.config.role && !store.can('workflows.intervene')) {
      store.audit(`محاولة إكمال مهمة بدون صلاحية: ${n.label}`, 'workflow_task', instId, { result: 'denied' });
      EM.ui.toast(`هذه المهمة مسندة لدور «${EM.REF.role(n.config.role)?.name}»`, 'bad');
      return false;
    }
    if (n.type === 'approval') {
      if (n.config?.sod && inst.requestedBy && inst.requestedBy === store.user()?.id) {
        EM.ui.toast('فصل المهام: لا يمكنك اعتماد طلب قدمته بنفسك', 'bad');
        store.audit('رفض: اعتماد ذاتي ممنوع', 'workflow_task', instId, { result: 'denied' });
        return false;
      }
      inst.outcomes[n.id] = outcome || 'approved';
    }
    if (outcome === 'timeout' || outcome === 'error') inst.forced[n.id] = outcome;
    EM.WF.stepToken(def, inst, tokenId, { by: store.user()?.id });
    if (note) inst.history.push({ at: new Date().toISOString(), node: n.id, event: 'note', by: store.user()?.id, note });
    advanceAutomatic(def, inst);
    store.audit(`إكمال مهمة: ${n.label}`, 'workflow_task', instId, { after: outcome || 'done' });
    store.commit('instances');
    return true;
  };

  store.instanceAction = function (instId, action, reason) {
    const inst = store.state.instances.find((i) => i.id === instId);
    if (!inst) return;
    const def = store.versionDef(inst.workflowId, inst.version);
    const by = store.user()?.id;
    const at = new Date().toISOString();
    if (action === 'pause' && inst.status === 'running') { inst.status = 'paused'; inst.history.push({ at, event: 'paused', by, note: reason || 'إيقاف مؤقت' }); }
    else if (action === 'resume' && inst.status === 'paused') { inst.status = 'running'; inst.history.push({ at, event: 'resumed', by, note: 'استئناف' }); advanceAutomatic(def, inst); }
    else if (action === 'retry' && inst.status === 'failed') { inst.status = 'running'; inst.history.push({ at, event: 'retried', by, note: 'إعادة المحاولة بعد الخطأ' }); advanceAutomatic(def, inst); }
    else if (action === 'cancel' && ['running', 'paused', 'failed'].includes(inst.status)) EM.WF.cancel(def, inst, reason, by);
    store.audit(`إجراء على مثيل: ${action}`, 'workflow_instance', instId, { reason });
    store.commit('instances');
  };

  /** المهام البشرية المفتوحة المشتقة من الرموز النشطة */
  store.openTasks = function () {
    const tasks = [];
    store.state.instances.forEach((inst) => {
      if (!['running', 'paused', 'failed'].includes(inst.status)) return;
      const def = store.versionDef(inst.workflowId, inst.version);
      inst.tokens.forEach((t) => {
        const n = EM.WF.node(def, t.node);
        if (!n) return;
        const human = EM.WF.TYPES[n.type]?.human || n.type === 'timer';
        if (!human) return;
        const sla = n.config?.slaMin || n.config?.duration || 60;
        const due = new Date(new Date(t.enteredAt).getTime() + sla * 60000).toISOString();
        tasks.push({ inst, def, token: t, node: n, due, overdue: Date.now() > new Date(due).getTime(), late: EM.minsSince(due) });
      });
    });
    return tasks.sort((a, b) => a.due.localeCompare(b.due));
  };

  EM.store = store;
})();
