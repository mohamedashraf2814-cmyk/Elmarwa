/* محرك سير العمل: أنواع العقد، الترتيب التلقائي، التحقق، تقييم الشروط، التنفيذ والمحاكاة.
   صُمم بحيث يمكن نقل نفس المنطق لاحقاً إلى الخادم (Laravel) مع حفظ الحالة في قاعدة البيانات. */
(function () {
  'use strict';
  const EM = window.EM;

  const TYPES = {
    start:    { name: 'بداية', shape: 'pill', w: 150, h: 46, human: false, color: 'var(--faience-500)' },
    end:      { name: 'نهاية', shape: 'pill', w: 150, h: 46, human: false, color: 'var(--lapis-700)' },
    task:     { name: 'مهمة', shape: 'rect', w: 196, h: 64, human: true, color: 'var(--lapis-500)' },
    approval: { name: 'اعتماد', shape: 'rect', w: 196, h: 64, human: true, color: 'var(--saffron-500)' },
    auto:     { name: 'إجراء آلي', shape: 'rect', w: 196, h: 64, human: false, color: 'var(--faience-600)' },
    decision: { name: 'قرار', shape: 'diamond', w: 168, h: 92, human: false, color: 'var(--saffron-500)' },
    fork:     { name: 'تفرع متوازٍ', shape: 'bar', w: 180, h: 22, human: false, color: 'var(--violet-500)' },
    join:     { name: 'دمج', shape: 'bar', w: 180, h: 22, human: false, color: 'var(--violet-500)' },
    timer:    { name: 'مؤقت', shape: 'circle', w: 168, h: 64, human: false, color: '#5E7CC9' },
    notify:   { name: 'إشعار', shape: 'rect', w: 196, h: 56, human: false, color: '#2C9BC4' },
    error:    { name: 'استثناء/تصعيد', shape: 'rect', w: 196, h: 56, human: true, color: 'var(--rose-500)' },
  };

  const ACTIONS = {
    patient_lookup: 'البحث عن المريض', generate_mrn: 'إنشاء رقم ملف', validate_order: 'التحقق من الطلب',
    release_result: 'إصدار النتيجة', drug_checks: 'فحوص الأمان الدوائي', purchase_request: 'طلب شراء',
    reserve_stock: 'حجز مخزون', release_stock: 'تحرير مخزون', reserve_bed: 'حجز سرير', release_bed: 'تحرير سرير',
    allocate_or: 'تخصيص غرفة عمليات', release_or: 'تحرير غرفة عمليات', insurance_eligibility: 'أهلية التأمين',
    submit_claim: 'إرسال مطالبة', reconcile: 'تسوية مالية', post_reversal: 'قيد عكسي', finalize_invoice: 'إغلاق الفاتورة',
    price_service: 'تسعير خدمة', add_invoice_item: 'بند فاتورة', split_share: 'احتساب الحصص', replay_queue: 'إعادة تشغيل الطابور',
  };

  const ON_ERROR = { retry: 'إعادة المحاولة', escalate: 'تصعيد للمشرف', compensate: 'تعويض وعكس', manual: 'تدخل يدوي' };
  const OPS = { '=': 'يساوي', '!=': 'لا يساوي', '>': 'أكبر من', '<': 'أقل من', '>=': 'أكبر أو يساوي', '<=': 'أقل أو يساوي', contains: 'يحتوي' };
  const EDGE_KINDS = { normal: 'عادي', default: 'افتراضي (خلاف ذلك)', approved: 'معتمد', rejected: 'مرفوض', error: 'مسار خطأ', timeout: 'انتهاء المهلة' };

  const outs = (def, id) => def.edges.filter((e) => e.from === id);
  const ins = (def, id) => def.edges.filter((e) => e.to === id);
  const node = (def, id) => def.nodes.find((n) => n.id === id);
  const size = (n) => TYPES[n.type] || TYPES.task;

  /* ---------- ترتيب تلقائي بطبقات (من أعلى لأسفل) ---------- */
  function layout(def, force = false) {
    if (!force && def.nodes.every((n) => typeof n.x === 'number')) return def;
    const start = def.nodes.find((n) => n.type === 'start') || def.nodes[0];
    if (!start) return def;
    const level = {};
    const order = [];
    // DFS لتحديد الحواف الراجعة (الحلقات) واستبعادها من حساب الطبقات
    const state = {};
    const back = new Set();
    const dfs = (id) => {
      state[id] = 1;
      outs(def, id).forEach((e) => {
        if (state[e.to] === 1) back.add(e.id);
        else if (!state[e.to]) dfs(e.to);
      });
      state[id] = 2;
      order.unshift(id);
    };
    dfs(start.id);
    def.nodes.forEach((n) => { if (!state[n.id]) dfs(n.id); });
    order.forEach((id) => { if (level[id] === undefined) level[id] = 0; });
    order.forEach((id) => {
      outs(def, id).forEach((e) => {
        if (back.has(e.id)) return;
        // العقد الاستثنائية تبقى في نفس مستوى مصدرها لتقليل الطول
        const bump = node(def, e.to)?.type === 'error' ? 0 : 1;
        level[e.to] = Math.max(level[e.to] ?? 0, level[id] + Math.max(bump, 1));
      });
    });
    const rows = {};
    order.forEach((id) => { (rows[level[id]] = rows[level[id]] || []).push(id); });
    const GAP_X = 236, GAP_Y = 124;
    Object.keys(rows).forEach((lv) => {
      const ids = rows[lv];
      const width = (ids.length - 1) * GAP_X;
      ids.forEach((id, i) => {
        const n = node(def, id);
        const s = size(n);
        n.x = Math.round(600 - width / 2 + i * GAP_X - s.w / 2);
        n.y = Math.round(40 + Number(lv) * GAP_Y + (92 - s.h) / 2);
      });
    });
    return def;
  }

  /* ---------- تقييم الشروط (AND/OR) ---------- */
  function evalRule(rule, vars) {
    let a = vars[rule.var];
    let b = rule.value;
    if (typeof a === 'boolean' || b === 'true' || b === 'false' || typeof b === 'boolean') {
      a = a === true || a === 'true';
      b = b === true || b === 'true';
    } else if (!isNaN(Number(a)) && !isNaN(Number(b)) && a !== '' && b !== '') {
      a = Number(a); b = Number(b);
    }
    switch (rule.op) {
      case '=': return a === b;
      case '!=': return a !== b;
      case '>': return a > b;
      case '<': return a < b;
      case '>=': return a >= b;
      case '<=': return a <= b;
      case 'contains': return String(a ?? '').includes(String(b));
      default: return false;
    }
  }
  function evalCond(cond, vars) {
    if (!cond || !cond.rules || !cond.rules.length) return true;
    const results = cond.rules.map((r) => evalRule(r, vars));
    return cond.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
  }
  function condText(cond, def) {
    if (!cond || !cond.rules?.length) return '';
    const vname = (v) => def?.variables?.find((x) => x.name === v)?.label || v;
    return cond.rules.map((r) => `${vname(r.var)} ${OPS[r.op] || r.op} ${r.value}`).join(cond.logic === 'or' ? ' أو ' : ' و ');
  }

  /* ---------- التحقق قبل النشر ---------- */
  function validate(def) {
    const issues = [];
    const add = (level, msg, nodeId = null, edgeId = null) => issues.push({ level, msg, nodeId, edgeId });
    const ids = new Set();
    def.nodes.forEach((n) => {
      if (ids.has(n.id)) add('error', `معرّف مكرر للعقدة «${n.id}»`, n.id);
      ids.add(n.id);
      if (!TYPES[n.type]) add('error', `نوع غير معروف «${n.type}»`, n.id);
      if (!String(n.label || '').trim()) add('error', 'عقدة بدون اسم', n.id);
    });
    def.edges.forEach((e) => {
      if (!ids.has(e.from) || !ids.has(e.to)) add('error', 'رابط يشير إلى عقدة غير موجودة', null, e.id);
      if (e.from === e.to) add('error', 'رابط من العقدة إلى نفسها', e.from, e.id);
    });
    const starts = def.nodes.filter((n) => n.type === 'start');
    const ends = def.nodes.filter((n) => n.type === 'end');
    if (starts.length === 0) add('error', 'لا توجد عقدة بداية');
    if (starts.length > 1) add('error', 'يوجد أكثر من عقدة بداية', starts[1].id);
    if (ends.length === 0) add('error', 'لا توجد عقدة نهاية');

    const roleIds = new Set(EM.REF.roles.map((r) => r.id));
    def.nodes.forEach((n) => {
      const o = outs(def, n.id);
      const i = ins(def, n.id);
      const t = n.type;
      if (t !== 'start' && i.length === 0) add('error', `«${n.label}» غير متصلة بأي مدخل`, n.id);
      if (t !== 'end' && o.length === 0) add('error', `«${n.label}» ليس لها مخرج`, n.id);
      if (t === 'start' && i.length) add('warn', 'عقدة البداية لا يجب أن يكون لها مدخل', n.id);
      if (t === 'end' && o.length) add('error', 'عقدة النهاية لا يجب أن يكون لها مخرج', n.id);
      if (t === 'decision') {
        if (o.length < 2) add('error', `القرار «${n.label}» يحتاج فرعين على الأقل`, n.id);
        if (!o.some((e) => e.kind === 'default')) add('error', `القرار «${n.label}» ينقصه فرع افتراضي (خلاف ذلك)`, n.id);
        o.filter((e) => e.kind !== 'default' && !(e.cond?.rules?.length)).forEach((e) => add('error', `فرع «${e.label || 'بدون اسم'}» في القرار بدون شرط`, n.id, e.id));
        o.forEach((e) => (e.cond?.rules || []).forEach((r) => {
          if (def.variables && !def.variables.some((v) => v.name === r.var)) add('warn', `المتغير «${r.var}» غير معرّف في سير العمل`, n.id, e.id);
        }));
      }
      if (t === 'approval') {
        if (!o.some((e) => e.kind === 'approved')) add('error', `الاعتماد «${n.label}» ينقصه مسار «معتمد»`, n.id);
        if (!o.some((e) => e.kind === 'rejected')) add('error', `الاعتماد «${n.label}» ينقصه مسار «مرفوض»`, n.id);
      }
      if (t === 'fork' && o.length < 2) add('error', 'التفرع المتوازي يحتاج فرعين على الأقل', n.id);
      if (t === 'join' && i.length < 2) add('error', 'الدمج يحتاج مدخلين على الأقل', n.id);
      if (TYPES[t]?.human && !n.config?.role) add('error', `«${n.label}» مهمة بشرية بدون دور مسؤول`, n.id);
      if (n.config?.role && !roleIds.has(n.config.role)) add('error', `الدور «${n.config.role}» غير موجود`, n.id);
      if (t === 'auto' && n.config?.action && !ACTIONS[n.config.action]) add('error', `الإجراء الآلي «${n.config.action}» غير مصرّح به`, n.id);
      if (t === 'auto' && !n.config?.action) add('warn', `الإجراء الآلي «${n.label}» بدون إجراء محدد`, n.id);
      if (TYPES[t]?.human && !n.config?.slaMin) add('warn', `«${n.label}» بدون زمن خدمة SLA`, n.id);
      if (t === 'timer' && !n.config?.duration) add('error', `المؤقت «${n.label}» بدون مدة`, n.id);
      const normal = o.filter((e) => !['error', 'timeout'].includes(e.kind) && !e.cond);
      if (['task', 'auto', 'notify', 'timer', 'error', 'start'].includes(t) && normal.length > 1)
        add('warn', `«${n.label}» لها أكثر من مخرج عادي — استخدم قراراً أو تفرعاً`, n.id);
    });

    // الوصول من البداية
    if (starts[0]) {
      const seen = new Set([starts[0].id]);
      const q = [starts[0].id];
      while (q.length) { const id = q.shift(); outs(def, id).forEach((e) => { if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }); }
      def.nodes.forEach((n) => { if (!seen.has(n.id)) add('error', `«${n.label}» لا يمكن الوصول إليها من البداية`, n.id); });
    }
    // إمكانية الوصول لنهاية (كشف الحلقات المغلقة)
    const canEnd = new Set(ends.map((n) => n.id));
    let changed = true;
    while (changed) {
      changed = false;
      def.edges.forEach((e) => { if (canEnd.has(e.to) && !canEnd.has(e.from)) { canEnd.add(e.from); changed = true; } });
    }
    def.nodes.forEach((n) => { if (!canEnd.has(n.id) && n.type !== 'end') add('error', `«${n.label}» في حلقة أو مسار لا يصل إلى نهاية`, n.id); });
    // الحلقات بدون قاعدة خروج أو إعادة محاولة
    findCycles(def).forEach((cyc) => {
      const hasExit = cyc.some((id) => {
        const n = node(def, id);
        return ['decision', 'approval', 'timer'].includes(n?.type) || n?.config?.retries > 0;
      });
      if (!hasExit) add('error', `حلقة بدون قاعدة خروج: ${cyc.map((id) => node(def, id)?.label).join(' ← ')}`, cyc[0]);
    });

    return { ok: !issues.some((i) => i.level === 'error'), issues };
  }

  function findCycles(def) {
    // Tarjan: المكونات القوية الاتصال بأكثر من عقدة
    let index = 0;
    const st = [], on = new Set(), idx = {}, low = {}, res = [];
    const strong = (v) => {
      idx[v] = low[v] = index++; st.push(v); on.add(v);
      outs(def, v).forEach((e) => {
        if (idx[e.to] === undefined) { strong(e.to); low[v] = Math.min(low[v], low[e.to]); }
        else if (on.has(e.to)) low[v] = Math.min(low[v], idx[e.to]);
      });
      if (low[v] === idx[v]) {
        const comp = [];
        let w;
        do { w = st.pop(); on.delete(w); comp.push(w); } while (w !== v);
        if (comp.length > 1) res.push(comp.reverse());
      }
    };
    def.nodes.forEach((n) => { if (idx[n.id] === undefined) strong(n.id); });
    return res;
  }

  /* ---------- التنفيذ ----------
     المثيل يحفظ «الرموز» النشطة (tokens) لكل فرع، وسجل الأحداث كاملاً.
     العقد البشرية تبقى «بانتظار» حتى يكملها مستخدم مصرح له؛ في المحاكاة تُكمل تلقائياً. */
  function createInstance(def, vars = {}, meta = {}) {
    const start = def.nodes.find((n) => n.type === 'start');
    const v = {};
    (def.variables || []).forEach((x) => { v[x.name] = x.default; });
    Object.assign(v, vars);
    const at = meta.at || new Date().toISOString();
    return {
      id: meta.id || EM.uid('wfi'),
      workflowId: def.id, version: def.version, name: def.name,
      status: 'running', vars: v,
      tokens: start ? [{ id: EM.uid('t'), node: start.id, enteredAt: at }] : [],
      joins: {}, visits: {}, outcomes: {}, forced: {},
      history: [{ at, node: start?.id, event: 'started', note: 'بدء التنفيذ' }],
      startedAt: at, endedAt: null, patientId: meta.patientId || null, dept: def.dept, simulation: !!meta.simulation,
    };
  }

  function chooseEdges(def, n, inst) {
    const o = outs(def, n.id);
    const forced = inst.forced[n.id];
    if (forced) {
      delete inst.forced[n.id];
      const fe = o.find((e) => e.kind === forced);
      if (fe) return { edges: [fe], note: forced === 'error' ? 'حدث خطأ — تحويل لمسار الخطأ' : 'انتهت المهلة — تحويل لمسار التصعيد' };
    }
    switch (n.type) {
      case 'fork': return { edges: o, note: `تفرع إلى ${o.length} فروع متوازية` };
      case 'decision': {
        const hit = o.find((e) => e.kind !== 'default' && evalCond(e.cond, inst.vars));
        const e = hit || o.find((x) => x.kind === 'default');
        return { edges: e ? [e] : [], note: e ? `القرار: ${e.label || 'افتراضي'}` : 'لا يوجد فرع مطابق' };
      }
      case 'approval': {
        const outcome = inst.outcomes[n.id] || 'approved';
        const e = o.find((x) => x.kind === outcome);
        return { edges: e ? [e] : [], note: outcome === 'approved' ? 'تم الاعتماد' : 'تم الرفض' };
      }
      default: {
        const e = o.find((x) => !['error', 'timeout', 'rejected'].includes(x.kind)) || o[0];
        return { edges: e ? [e] : [], note: '' };
      }
    }
  }

  /** تقدم رمز واحد خطوة. يعيد وصف ما حدث أو null إذا لم يحدث تقدم */
  function stepToken(def, inst, tokenId, opts = {}) {
    const ti = inst.tokens.findIndex((t) => t.id === tokenId);
    if (ti < 0 || inst.status !== 'running') return null;
    const tok = inst.tokens[ti];
    const n = node(def, tok.node);
    const at = opts.at || new Date().toISOString();
    if (!n) { inst.status = 'failed'; inst.history.push({ at, event: 'failed', note: 'عقدة مفقودة' }); return null; }

    inst.visits[n.id] = (inst.visits[n.id] || 0) + 1;
    if (inst.visits[n.id] > 12) {
      inst.status = 'failed';
      inst.history.push({ at, node: n.id, event: 'failed', note: 'تجاوز حد التكرار — حلقة بدون مخرج' });
      return { failed: true };
    }

    if (n.type === 'join') {
      const need = ins(def, n.id).length;
      inst.joins[n.id] = (inst.joins[n.id] || 0) + 1;
      inst.tokens.splice(ti, 1);
      if (inst.joins[n.id] < need) {
        inst.history.push({ at, node: n.id, event: 'waiting', note: `وصل فرع ${inst.joins[n.id]} من ${need}` });
        return { waiting: true };
      }
      inst.joins[n.id] = 0;
      const e = outs(def, n.id)[0];
      inst.history.push({ at, node: n.id, event: 'joined', note: 'اكتملت كل الفروع', edges: e ? [e.id] : [] });
      if (e) inst.tokens.push({ id: EM.uid('t'), node: e.to, enteredAt: at, via: e.id });
      return { moved: [e?.id] };
    }

    if (n.type === 'end') {
      inst.tokens.splice(ti, 1);
      inst.history.push({ at, node: n.id, event: 'ended', note: n.label });
      if (!inst.tokens.length) { inst.status = 'completed'; inst.endedAt = at; inst.history.push({ at, event: 'completed', note: 'اكتمل سير العمل' }); }
      return { ended: true };
    }

    const { edges, note } = chooseEdges(def, n, inst);
    inst.history.push({ at, node: n.id, event: 'completed', by: opts.by || null, edges: edges.map((e) => e.id), note: note || (TYPES[n.type]?.human ? 'تم إنجاز المهمة' : 'تم التنفيذ') });
    inst.tokens.splice(ti, 1);
    if (!edges.length) {
      inst.status = 'failed';
      inst.history.push({ at, node: n.id, event: 'failed', note: 'لا يوجد مسار خروج صالح' });
      return { failed: true };
    }
    edges.forEach((e) => inst.tokens.push({ id: EM.uid('t'), node: e.to, enteredAt: at, via: e.id }));
    return { moved: edges.map((e) => e.id) };
  }

  /** في المحاكاة: تقدم كل الرموز النشطة خطوة واحدة */
  function stepAll(def, inst, opts = {}) {
    const ids = inst.tokens.map((t) => t.id);
    const moved = [];
    ids.forEach((id) => { const r = stepToken(def, inst, id, opts); if (r?.moved) moved.push(...r.moved); });
    return moved;
  }

  /** تشغيل حتى الاكتمال (للتحقق السريع من المسار) */
  function runToEnd(def, vars, limit = 400) {
    const inst = createInstance(def, vars, { simulation: true });
    let i = 0;
    while (inst.status === 'running' && inst.tokens.length && i++ < limit) stepAll(def, inst);
    if (inst.status === 'running' && i >= limit) inst.status = 'failed';
    return inst;
  }

  /** إلغاء مع تعويض الخطوات القابلة للعكس بترتيب عكسي */
  function cancel(def, inst, reason, by) {
    const at = new Date().toISOString();
    const done = inst.history.filter((h) => h.event === 'completed').map((h) => node(def, h.node)).filter((n) => n?.config?.compensate);
    done.reverse().forEach((n) => inst.history.push({ at, node: n.id, event: 'compensated', by, note: `تعويض: ${ACTIONS[n.config.compensate] || n.config.compensate}` }));
    inst.tokens = [];
    inst.status = 'cancelled';
    inst.endedAt = at;
    inst.history.push({ at, event: 'cancelled', by, note: reason || 'إلغاء' });
  }

  function toExport(def) {
    return JSON.stringify({ format: 'elmarwa.workflow', formatVersion: 1, exportedAt: new Date().toISOString(), workflow: def }, null, 2);
  }
  function fromImport(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('الملف ليس JSON صالحاً'); }
    if (data?.format !== 'elmarwa.workflow' || !data.workflow) throw new Error('صيغة الملف غير مدعومة (المتوقع elmarwa.workflow)');
    const w = data.workflow;
    if (!Array.isArray(w.nodes) || !Array.isArray(w.edges) || !w.name) throw new Error('الملف ينقصه العقد أو الروابط أو الاسم');
    w.nodes.forEach((n) => { if (!TYPES[n.type]) throw new Error(`نوع عقدة غير مدعوم: ${n.type}`); n.config = n.config || {}; });
    return w;
  }

  /** ملخص حالة المثيل للرسم: العقد المكتملة والنشطة والفاشلة والروابط التي مر بها */
  function overlay(inst) {
    const done = new Set(), edges = new Set(), failed = new Set();
    inst.history.forEach((h) => {
      if (['completed', 'joined', 'ended', 'compensated'].includes(h.event) && h.node) done.add(h.node);
      if (h.event === 'failed' && h.node) failed.add(h.node);
      (h.edges || []).forEach((e) => edges.add(e));
    });
    const active = new Set(inst.tokens.map((t) => t.node));
    if (inst.status === 'failed') inst.tokens.forEach((t) => failed.add(t.node));
    return { done, edges, active, failed };
  }

  EM.WF = { overlay, TYPES, ACTIONS, ON_ERROR, OPS, EDGE_KINDS, outs, ins, node, size, layout, validate, evalCond, condText, createInstance, stepToken, stepAll, runToEnd, cancel, toExport, fromImport, findCycles };
})();
