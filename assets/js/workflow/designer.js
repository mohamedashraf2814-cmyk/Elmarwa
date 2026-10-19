/* مصمم سير العمل المرئي — SVG تفاعلي بالكامل بدون مكتبات خارجية
   الأوضاع: تصميم (design) · محاكاة (sim) · مراقبة التنفيذ (monitor) */
(function () {
  'use strict';
  const EM = window.EM;
  const { esc, icon, ui, store, fmt } = EM;
  const WF = () => EM.WF;
  const SNAP = 8;

  const PALETTE = [
    ['start', 'بداية', 'play'], ['task', 'مهمة بشرية', 'user'], ['approval', 'اعتماد', 'check'], ['auto', 'إجراء آلي', 'zap'],
    ['decision', 'قرار', 'branch'], ['fork', 'تفرع متوازٍ', 'flow'], ['join', 'دمج', 'layout'], ['timer', 'مؤقت', 'timer'],
    ['notify', 'إشعار', 'bell'], ['error', 'استثناء / تصعيد', 'alert'], ['end', 'نهاية', 'stop'],
  ];

  function wrap(text, max) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let cur = '';
    words.forEach((w) => {
      if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    });
    if (cur) lines.push(cur);
    if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].slice(0, max - 1) + '…'; }
    return lines;
  }

  function Designer(root, opts) {
    this.root = root;
    this.opts = opts;
    this.def = EM.clone(opts.def);
    WF().layout(this.def);
    this.mode = opts.mode || 'design';
    this.readonly = !!opts.readonly || !store.can('workflows.design');
    this.sel = null;
    this.view = { x: 40, y: 20, k: 1 };
    this.undo = [];
    this.redo = [];
    this.issues = [];
    this.search = '';
    this.dirty = false;
    this.sim = null;
    this.simTraversed = new Set();
    this.timer = null;
    this.monInst = opts.instance || null;
    this.monFilter = { status: '', q: '' };
    this.simVars = {};
    if (this.mode === 'sim') this.simInit();
    this.mount();
  }

  Designer.prototype.mount = function () {
    const d = this.def;
    this.root.innerHTML = `
    <div class="wfd mode-${this.mode}">
      <div class="wfd-bar">
        <div class="wfd-title">
          ${this.opts.instanceLocked ? '' : '<a class="icon-btn" href="#/admin/workflows" aria-label="رجوع">' + icon('chevronL') + '</a>'}
          <div><input class="wfd-name" value="${esc(d.name)}" aria-label="اسم سير العمل" ${this.readonly || this.mode !== 'design' ? 'readonly' : ''}>
          <div class="wfd-meta" id="wfdMeta"></div></div>
        </div>
        ${this.opts.instanceLocked ? '' : `<div class="seg wfd-modes" role="tablist">
          <button data-m="design" class="${this.mode === 'design' ? 'on' : ''}">${icon('settings', 'sm')} تصميم</button>
          <button data-m="sim" class="${this.mode === 'sim' ? 'on' : ''}">${icon('play', 'sm')} محاكاة</button>
          <button data-m="monitor" class="${this.mode === 'monitor' ? 'on' : ''}">${icon('monitor', 'sm')} مراقبة التنفيذ</button>
        </div>`}
        <div class="btn-group wfd-actions" id="wfdActions"></div>
      </div>
      <div class="wfd-main">
        <aside class="wfd-palette" aria-label="عناصر سير العمل">
          <div class="wfd-pal-title">اسحب عنصراً إلى اللوحة</div>
          ${PALETTE.map(([t, l, i]) => `<button class="pal-item pal-${t}" draggable="true" data-type="${t}" title="اضغط للإضافة في منتصف اللوحة">${icon(i, 'sm')}<span>${l}</span></button>`).join('')}
          <div class="wfd-pal-help xs">اسحب من النقطة السفلية لأي عقدة إلى عقدة أخرى لإنشاء رابط. Delete للحذف، Ctrl+Z للتراجع.</div>
        </aside>
        <div class="wfd-canvas-wrap" id="cwrap">
          <svg class="wfd-canvas" id="canvas" tabindex="0" aria-label="لوحة سير العمل">
            <defs>
              <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#C7D3D5"/></pattern>
              ${['n', 'ok', 'err', 'tmo', 'act', 'sel'].map((k) => `<marker id="arr-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="mk-${k}"/></marker>`).join('')}
            </defs>
            <rect class="bg" width="100%" height="100%" fill="url(#dots)"/>
            <g id="vp"><g id="edges"></g><g id="nodes"></g><path id="ghost" class="ghost-edge" d=""/></g>
          </svg>
          <div class="wfd-search"><input type="search" id="wsearch" placeholder="بحث عن عقدة" aria-label="بحث عن عقدة">${icon('search', 'sm')}</div>
          <div class="wfd-zoom">
            <button class="icon-btn" data-z="in" aria-label="تكبير">${icon('zoomIn')}</button>
            <button class="icon-btn" data-z="out" aria-label="تصغير">${icon('zoomOut')}</button>
            <button class="icon-btn" data-z="fit" aria-label="ملاءمة الشاشة">${icon('fit')}</button>
            <span class="num xs" id="zl">100%</span>
          </div>
          <div class="wfd-minimap" id="mini" aria-hidden="true"><svg id="miniSvg"></svg></div>
          <div class="wfd-legend xs">
            <span><i class="lg-done"></i>مكتملة</span><span><i class="lg-act"></i>نشطة الآن</span><span><i class="lg-fail"></i>خطأ</span><span><i class="lg-err"></i>مسار استثناء</span>
          </div>
        </div>
        <aside class="wfd-side" id="side"></aside>
      </div>
    </div>`;
    this.svg = this.root.querySelector('#canvas');
    this.vp = this.root.querySelector('#vp');
    this.bindEvents();
    this.drawAll();
    requestAnimationFrame(() => { this.fit(false); if (this.mode === 'monitor') this.followActive(); });
  };

  /* ================= الرسم ================= */
  Designer.prototype.drawAll = function () {
    this.drawMeta();
    this.drawGraph();
    this.drawSide();
    this.drawActions();
  };

  Designer.prototype.drawMeta = function () {
    const d = this.def;
    const insts = store.state.instances.filter((i) => i.workflowId === d.id && i.status === 'running').length;
    this.root.querySelector('#wfdMeta').innerHTML = `${ui.pill('wf', d.status)} <span class="xs muted">الإصدار المنشور <b class="num">${d.versions?.at(-1)?.version || '—'}</b> · ${d.nodes.length} عقدة · ${d.edges.length} رابط · ${insts} مثيل نشط</span>${this.dirty ? ' <span class="pill warn">تعديلات غير محفوظة</span>' : ''}`;
  };

  Designer.prototype.drawActions = function () {
    const el = this.root.querySelector('#wfdActions');
    if (this.opts.instanceLocked) { el.innerHTML = ''; return; }
    if (this.mode !== 'design') { el.innerHTML = `<button class="btn" data-a="export">${icon('download', 'sm')} تصدير</button>`; return; }
    const ro = this.readonly;
    el.innerHTML = `
      <button class="btn ghost" data-a="undo" ${ro || !this.undo.length ? 'disabled' : ''} aria-label="تراجع">${icon('refresh', 'sm')} تراجع</button>
      <button class="btn" data-a="layout" ${ro ? 'disabled' : ''}>${icon('layout', 'sm')} ترتيب تلقائي</button>
      <button class="btn" data-a="validate">${icon('shield', 'sm')} تحقق</button>
      <button class="btn" data-a="export">${icon('download', 'sm')} تصدير</button>
      <button class="btn" data-a="import" ${ro ? 'disabled' : ''}>${icon('upload', 'sm')} استيراد</button>
      <button class="btn" data-a="save" ${ro ? 'disabled' : ''}>${icon('save', 'sm')} حفظ مسودة</button>
      <button class="btn primary" data-a="publish" ${!store.can('workflows.publish') ? 'disabled title="يتطلب صلاحية النشر"' : ''}>${icon('send', 'sm')} نشر إصدار</button>`;
  };

  Designer.prototype.overlayState = function () {
    if (this.mode === 'sim' && this.sim) { const o = WF().overlay(this.sim); return o; }
    if (this.mode === 'monitor' && this.monInst) return WF().overlay(this.monInst);
    return null;
  };

  Designer.prototype.anchor = function (n, side) {
    const s = WF().size(n);
    const cx = n.x + s.w / 2, cy = n.y + s.h / 2;
    switch (side) {
      case 'top': return [cx, n.y];
      case 'bottom': return [cx, n.y + s.h];
      case 'left': return [n.x, cy];
      case 'right': return [n.x + s.w, cy];
      default: return [cx, cy];
    }
  };

  Designer.prototype.edgeGeom = function (e) {
    const a = WF().node(this.def, e.from);
    const b = WF().node(this.def, e.to);
    if (!a || !b) return null;
    const sa = WF().size(a), sb = WF().size(b);
    const acx = a.x + sa.w / 2, bcx = b.x + sb.w / 2;
    const below = b.y > a.y + sa.h - 4;
    let p1, p2, c1, c2;
    if (below) {
      let side = 'bottom';
      if ((a.type === 'decision' || a.type === 'approval' || ['error', 'timeout'].includes(e.kind)) && Math.abs(bcx - acx) > 60) side = bcx < acx ? 'left' : 'right';
      p1 = this.anchor(a, side);
      p2 = this.anchor(b, 'top');
      const dy = Math.max(40, (p2[1] - p1[1]) / 2);
      c1 = side === 'bottom' ? [p1[0], p1[1] + dy] : [p1[0] + (side === 'left' ? -60 : 60), p1[1]];
      c2 = [p2[0], p2[1] - dy];
    } else {
      // رابط راجع (حلقة) أو في نفس المستوى: يلتف من الجانب
      const leftSide = bcx <= acx;
      p1 = this.anchor(a, leftSide ? 'left' : 'right');
      p2 = this.anchor(b, leftSide ? 'left' : 'right');
      const off = leftSide ? -90 : 90;
      if (Math.abs(a.y - b.y) < 20) { p1 = this.anchor(a, bcx < acx ? 'left' : 'right'); p2 = this.anchor(b, bcx < acx ? 'right' : 'left'); c1 = [(p1[0] + p2[0]) / 2, p1[1]]; c2 = [(p1[0] + p2[0]) / 2, p2[1]]; }
      else { c1 = [p1[0] + off, p1[1]]; c2 = [p2[0] + off, p2[1]]; }
    }
    const t = 0.5;
    const mt = 1 - t;
    const mx = mt ** 3 * p1[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t ** 3 * p2[0];
    const my = mt ** 3 * p1[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t ** 3 * p2[1];
    return { d: `M ${p1[0]} ${p1[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`, mx, my };
  };

  Designer.prototype.drawGraph = function () {
    const d = this.def;
    const ov = this.overlayState();
    const traversed = this.mode === 'sim' ? this.simTraversed : ov?.edges;
    const errNodes = new Set(this.issues.filter((i) => i.level === 'error' && i.nodeId).map((i) => i.nodeId));
    const errEdges = new Set(this.issues.filter((i) => i.level === 'error' && i.edgeId).map((i) => i.edgeId));
    const q = EM.norm(this.search.trim());

    this.root.querySelector('#edges').innerHTML = d.edges.map((e) => {
      const g = this.edgeGeom(e);
      if (!g) return '';
      const isSel = this.sel?.type === 'edge' && this.sel.id === e.id;
      const kindCls = e.kind === 'error' ? 'e-err' : e.kind === 'timeout' ? 'e-tmo' : e.kind === 'rejected' ? 'e-rej' : e.kind === 'approved' ? 'e-ok' : '';
      const trav = traversed?.has(e.id);
      const mk = isSel ? 'sel' : trav ? 'act' : e.kind === 'error' || e.kind === 'rejected' ? 'err' : e.kind === 'timeout' ? 'tmo' : e.kind === 'approved' ? 'ok' : 'n';
      const label = e.label || (e.cond ? WF().condText(e.cond, d) : '');
      const lw = Math.min(170, label.length * 6.6 + 18);
      return `<g class="edge ${kindCls} ${isSel ? 'sel' : ''} ${trav ? 'trav' : ''} ${errEdges.has(e.id) ? 'invalid' : ''}" data-edge="${esc(e.id)}">
        <path class="e-hit" d="${g.d}"/>
        <path class="e-line" d="${g.d}" marker-end="url(#arr-${mk})"/>
        ${label ? `<g class="e-label" transform="translate(${g.mx} ${g.my})"><rect x="${-lw / 2}" y="-11" width="${lw}" height="22" rx="11"/><text y="4" text-anchor="middle">${esc(label.length > 26 ? label.slice(0, 25) + '…' : label)}</text></g>` : ''}
      </g>`;
    }).join('');

    this.root.querySelector('#nodes').innerHTML = d.nodes.map((n) => {
      const T = WF().TYPES[n.type];
      const { w, h } = T;
      const st = ov ? (ov.failed.has(n.id) ? 'n-fail' : ov.active.has(n.id) ? 'n-act' : ov.done.has(n.id) ? 'n-done' : 'n-idle') : '';
      const isSel = this.sel?.type === 'node' && this.sel.id === n.id;
      const match = q && EM.norm(n.label).includes(q);
      const role = n.config?.role ? EM.REF.role(n.config.role)?.name : '';
      const cls = `node t-${n.type} ${st} ${isSel ? 'sel' : ''} ${errNodes.has(n.id) ? 'invalid' : ''} ${match ? 'match' : ''}`;
      let shape = '';
      let text = '';
      const lines = wrap(n.label, T.shape === 'diamond' ? 16 : T.shape === 'bar' ? 26 : 22);
      if (T.shape === 'diamond') {
        shape = `<polygon class="n-shape" points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}"/>`;
        text = lines.map((l, i) => `<text class="n-label" x="${w / 2}" y="${h / 2 + 5 + (i - (lines.length - 1) / 2) * 15}" text-anchor="middle">${esc(l)}</text>`).join('');
      } else if (T.shape === 'pill') {
        shape = `<rect class="n-shape" width="${w}" height="${h}" rx="${h / 2}"/>`;
        text = `<text class="n-label" x="${w / 2}" y="${h / 2 + 5}" text-anchor="middle">${esc(lines.join(' ').slice(0, 24))}</text>`;
      } else if (T.shape === 'bar') {
        shape = `<rect class="n-shape" width="${w}" height="${h}" rx="6"/>`;
        text = `<text class="n-label" x="${w / 2}" y="${h / 2 + 4}" text-anchor="middle">${esc(lines[0])}</text>`;
      } else {
        const sub = n.type === 'timer' ? `مدة: ${fmt.minutes(n.config?.duration || 0)}` : n.type === 'auto' ? (WF().ACTIONS[n.config?.action] || 'إجراء') : n.type === 'notify' ? `إشعار ${n.config?.channel === 'sms' ? 'رسالة نصية' : 'داخلي'}` : role ? `${role}${n.config?.slaMin ? ` · ${fmt.minutes(n.config.slaMin)}` : ''}` : '';
        shape = `<rect class="n-shape" width="${w}" height="${h}" rx="${n.type === 'timer' ? h / 2 : 12}"/>${n.type === 'timer' ? '' : `<rect class="n-stripe" x="${w - 6}" y="0" width="6" height="${h}" rx="3"/>`}`;
        text = `<text class="n-kind" x="${w - 16}" y="17" text-anchor="start">${esc(T.name)}${n.config?.subflow ? ' ↳' : ''}</text>
          ${lines.map((l, i) => `<text class="n-label" x="${w - 16}" y="${(sub ? 35 : 39) + i * 15 - (lines.length > 1 && sub ? 6 : 0)}" text-anchor="start">${esc(l)}</text>`).join('')}
          ${sub ? `<text class="n-sub" x="${w - 16}" y="${h - 9}" text-anchor="start">${esc(sub)}</text>` : ''}`;
      }
      const badge = st === 'n-act' ? `<circle class="n-badge act" cx="10" cy="10" r="6"/>` : st === 'n-done' ? `<g class="n-badge done" transform="translate(2 2)"><circle cx="8" cy="8" r="8"/><path d="m4.5 8.3 2.3 2.3 4.6-4.8"/></g>` : st === 'n-fail' ? `<g class="n-badge fail" transform="translate(2 2)"><circle cx="8" cy="8" r="8"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/></g>` : '';
      const port = this.mode === 'design' && !this.readonly && n.type !== 'end' ? `<circle class="port" data-port="${esc(n.id)}" cx="${w / 2}" cy="${h}" r="7"/>` : '';
      return `<g class="${cls}" data-node="${esc(n.id)}" transform="translate(${n.x} ${n.y})" tabindex="0" role="button" aria-label="${esc(T.name)}: ${esc(n.label)}">${shape}${text}${badge}${port}</g>`;
    }).join('');

    this.applyView();
    this.drawMini();
  };

  Designer.prototype.bounds = function () {
    const ns = this.def.nodes;
    if (!ns.length) return { x: 0, y: 0, w: 800, h: 600 };
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    ns.forEach((n) => { const s = WF().size(n); x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + s.w); y2 = Math.max(y2, n.y + s.h); });
    return { x: x1 - 100, y: y1 - 40, w: x2 - x1 + 200, h: y2 - y1 + 80 };
  };

  Designer.prototype.applyView = function () {
    const v = this.view;
    this.vp.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.k})`);
    const zl = this.root.querySelector('#zl');
    if (zl) zl.textContent = `${Math.round(v.k * 100)}%`;
    this.drawMiniViewport();
  };

  /** ملاءمة: full=true يعرض المسار كاملاً، وإلا يفتح بتكبير مقروء من الأعلى */
  Designer.prototype.fit = function (full = true) {
    const r = this.svg.getBoundingClientRect();
    if (!r.width) return;
    const b = this.bounds();
    const exact = Math.min(r.width / b.w, r.height / b.h);
    const k = full ? Math.max(0.2, Math.min(1.25, exact)) : Math.max(Math.min(0.85, r.width / b.w), Math.min(1.1, exact));
    const y = full ? (r.height - b.h * k) / 2 - b.y * k : 16 - b.y * k;
    this.view = { k, x: (r.width - b.w * k) / 2 - b.x * k, y };
    this.applyView();
  };

  Designer.prototype.zoomAt = function (factor, cx, cy) {
    const v = this.view;
    const k = Math.max(0.2, Math.min(2.5, v.k * factor));
    v.x = cx - ((cx - v.x) * k) / v.k;
    v.y = cy - ((cy - v.y) * k) / v.k;
    v.k = k;
    this.applyView();
  };

  Designer.prototype.drawMini = function () {
    const b = this.bounds();
    const svg = this.root.querySelector('#miniSvg');
    svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
    const ov = this.overlayState();
    svg.innerHTML = this.def.nodes.map((n) => { const s = WF().size(n); const c = ov?.active.has(n.id) ? 'm-act' : ov?.done.has(n.id) ? 'm-done' : `m-${n.type}`; return `<rect class="${c}" x="${n.x}" y="${n.y}" width="${s.w}" height="${s.h}" rx="8"/>`; }).join('') + '<rect id="miniVp" class="m-vp"/>';
    this.miniB = b;
    this.drawMiniViewport();
  };

  Designer.prototype.drawMiniViewport = function () {
    const vpRect = this.root.querySelector('#miniVp');
    if (!vpRect) return;
    const r = this.svg.getBoundingClientRect();
    const v = this.view;
    vpRect.setAttribute('x', -v.x / v.k);
    vpRect.setAttribute('y', -v.y / v.k);
    vpRect.setAttribute('width', r.width / v.k);
    vpRect.setAttribute('height', r.height / v.k);
  };

  /* ================= اللوحة الجانبية ================= */
  Designer.prototype.drawSide = function () {
    const side = this.root.querySelector('#side');
    if (this.mode === 'sim') side.innerHTML = this.simPanel();
    else if (this.mode === 'monitor') side.innerHTML = this.monitorPanel();
    else side.innerHTML = this.sel?.type === 'node' ? this.nodePanel() : this.sel?.type === 'edge' ? this.edgePanel() : this.wfPanel();
  };

  Designer.prototype.issuesBlock = function () {
    if (!this.issues.length) return '';
    const errs = this.issues.filter((i) => i.level === 'error');
    return `<div class="side-sec"><h4>${errs.length ? `${errs.length} خطأ يمنع النشر` : 'لا توجد أخطاء'}${this.issues.length - errs.length ? ` · ${this.issues.length - errs.length} ملاحظة` : ''}</h4>
      <ul class="issues">${this.issues.map((i, k) => `<li class="iss-${i.level}"><button data-iss="${k}">${icon(i.level === 'error' ? 'alert' : 'info', 'sm')}<span>${esc(i.msg)}</span></button></li>`).join('')}</ul></div>`;
  };

  Designer.prototype.wfPanel = function () {
    const d = this.def;
    const ro = this.readonly ? 'disabled' : '';
    return `
      ${this.issuesBlock()}
      <div class="side-sec"><h4>إعدادات سير العمل</h4>
        <div class="field"><label>القسم المالك</label><select class="input" data-wf="dept" ${ro}>${ui.options(EM.REF.departments.map((x) => [x.id, x.name]), d.dept)}</select></div>
        <div class="field"><label>الفئة</label><input class="input" data-wf="category" value="${esc(d.category || '')}" ${ro}></div>
        <div class="field"><label>الوصف</label><textarea class="input" data-wf="description" ${ro}>${esc(d.description || '')}</textarea></div>
      </div>
      <div class="side-sec"><h4>متغيرات سير العمل</h4><p class="xs muted">تُستخدم في شروط القرارات وتُتحقق قيمها عند بدء كل مثيل.</p>
        ${(d.variables || []).map((v, i) => `<div class="var-row">
          <input class="input" data-var="${i}" data-k="name" value="${esc(v.name)}" aria-label="الاسم البرمجي" ${ro}>
          <input class="input" data-var="${i}" data-k="label" value="${esc(v.label)}" aria-label="الاسم الظاهر" ${ro}>
          <select class="input" data-var="${i}" data-k="type" ${ro}>${ui.options([['bool', 'نعم/لا'], ['number', 'رقم'], ['enum', 'قائمة'], ['text', 'نص']], v.type)}</select>
          ${ro ? '' : `<button class="icon-btn" data-delvar="${i}" aria-label="حذف">${icon('trash', 'sm')}</button>`}
          ${v.type === 'enum' ? `<input class="input var-opts" data-var="${i}" data-k="options" value="${esc((v.options || []).join(','))}" placeholder="الخيارات مفصولة بفاصلة" ${ro}>` : ''}
        </div>`).join('')}
        ${ro ? '' : `<button class="btn sm" data-addvar>${icon('plus', 'sm')} متغير</button>`}
      </div>
      <div class="side-sec"><h4>الإصدارات</h4>
        <ul class="versions">${(d.versions || []).slice().reverse().map((v) => `<li><b class="num">v${v.version}</b><span class="xs muted">${fmt.dateTime(v.publishedAt)} · ${esc(EM.REF.userName(v.publishedBy))}</span>${store.state.instances.filter((i) => i.workflowId === d.id && i.version === v.version && i.status === 'running').length ? `<span class="pill info">${store.state.instances.filter((i) => i.workflowId === d.id && i.version === v.version && i.status === 'running').length} نشط</span>` : ''}</li>`).join('') || '<li class="xs muted">لم يُنشر بعد</li>'}</ul>
        <p class="xs muted">المثيلات النشطة تكمل على إصدارها الأصلي. النشر الجديد يُطبق على المثيلات الجديدة فقط.</p>
        ${!this.readonly && store.can('workflows.publish') ? `<div class="btn-group"><button class="btn sm" data-status="paused" ${d.status === 'paused' ? 'disabled' : ''}>إيقاف</button><button class="btn sm" data-status="archived">أرشفة</button>${d.status !== 'published' && d.versions?.length ? '<button class="btn sm" data-status="published">إعادة تفعيل</button>' : ''}</div>` : ''}
      </div>
      <div class="side-sec xs muted">اضغط على أي عقدة أو رابط لتعديل إعداداته.</div>`;
  };

  Designer.prototype.nodePanel = function () {
    const n = WF().node(this.def, this.sel.id);
    if (!n) return this.wfPanel();
    const T = WF().TYPES[n.type];
    const c = n.config || (n.config = {});
    const ro = this.readonly ? 'disabled' : '';
    const f = (k, label, input) => `<div class="field"><label>${label}</label>${input}</div>`;
    const inp = (k, v, type = 'text', extra = '') => `<input class="input" data-cfg="${k}" type="${type}" value="${esc(v ?? '')}" ${ro} ${extra}>`;
    const outs = WF().outs(this.def, n.id);
    return `
      <div class="side-sec"><div class="row between"><h4>${esc(T.name)}</h4><span class="num xs muted">${esc(n.id)}</span></div>
        ${f('label', 'الاسم', `<input class="input" data-nf="label" value="${esc(n.label)}" ${ro}>`)}
        ${T.human || n.type === 'error' ? `
          ${f('dept', 'القسم', `<select class="input" data-cfg="dept" ${ro}><option value="">—</option>${ui.options(EM.REF.departments.map((x) => [x.id, x.name]), c.dept)}</select>`)}
          ${f('role', 'الدور المسؤول (الصلاحية)', `<select class="input" data-cfg="role" ${ro}><option value="">—</option>${ui.options(EM.REF.roles.map((x) => [x.id, x.name]), c.role)}</select>`)}
          ${f('slaMin', 'زمن الخدمة SLA (دقيقة)', inp('slaMin', c.slaMin, 'number', 'min="1"'))}` : ''}
        ${n.type === 'approval' ? `<label class="check"><input type="checkbox" data-cfgb="sod" ${c.sod ? 'checked' : ''} ${ro}> فصل المهام: لا يعتمد مقدم الطلب طلبه</label>` : ''}
        ${n.type === 'auto' ? `${f('action', 'الإجراء الآلي (من قائمة معتمدة)', `<select class="input" data-cfg="action" ${ro}><option value="">—</option>${ui.options(Object.entries(WF().ACTIONS), c.action)}</select>`)}
          ${f('compensate', 'إجراء التعويض عند الإلغاء', `<select class="input" data-cfg="compensate" ${ro}><option value="">لا يوجد</option>${ui.options(Object.entries(WF().ACTIONS), c.compensate)}</select>`)}` : ''}
        ${n.type === 'timer' ? f('duration', 'المدة (دقيقة)', inp('duration', c.duration, 'number', 'min="1"')) : ''}
        ${n.type === 'notify' ? `${f('channel', 'القناة', `<select class="input" data-cfg="channel" ${ro}>${ui.options([['in_app', 'داخل النظام'], ['sms', 'رسالة نصية (بدون بيانات طبية)'], ['email', 'بريد إلكتروني']], c.channel)}</select>`)}${f('role', 'المستلم', `<select class="input" data-cfg="role" ${ro}><option value="">—</option>${ui.options(EM.REF.roles.map((x) => [x.id, x.name]), c.role)}</select>`)}` : ''}
        ${!['start', 'end', 'fork', 'join'].includes(n.type) ? `
          ${f('onError', 'عند حدوث خطأ', `<select class="input" data-cfg="onError" ${ro}>${ui.options(Object.entries(WF().ON_ERROR), c.onError || 'escalate')}</select>`)}
          ${f('retries', 'عدد مرات إعادة المحاولة', inp('retries', c.retries || 0, 'number', 'min="0" max="10"'))}
          ${f('entry', 'شروط الدخول', inp('entry', c.entry))}
          ${f('exit', 'شروط الخروج', inp('exit', c.exit))}` : ''}
        ${c.subflow ? `<a class="btn sm" href="#/admin/workflows/${esc(c.subflow)}">${icon('flow', 'sm')} فتح المسار الفرعي</a>` : ''}
      </div>
      <div class="side-sec"><h4>المخارج (${outs.length})</h4>
        <ul class="outs">${outs.map((e) => `<li><button data-seledge="${esc(e.id)}"><span class="pill ${e.kind === 'error' || e.kind === 'rejected' ? 'bad' : e.kind === 'timeout' ? 'warn' : e.kind === 'default' ? 'plain' : 'info'}">${esc(WF().EDGE_KINDS[e.kind || 'normal'] || 'شرط')}</span> ${esc(e.label || WF().condText(e.cond, this.def) || '—')} ← ${esc(WF().node(this.def, e.to)?.label)}</button></li>`).join('') || '<li class="xs muted">لا توجد مخارج — اسحب من النقطة السفلية للعقدة.</li>'}</ul>
      </div>
      ${this.readonly ? '' : `<div class="side-sec"><div class="btn-group"><button class="btn sm" data-dupnode>${icon('copy', 'sm')} تكرار</button><button class="btn sm danger" data-delsel>${icon('trash', 'sm')} حذف العقدة</button></div></div>`}`;
  };

  Designer.prototype.edgePanel = function () {
    const e = this.def.edges.find((x) => x.id === this.sel.id);
    if (!e) return this.wfPanel();
    const from = WF().node(this.def, e.from);
    const ro = this.readonly ? 'disabled' : '';
    const kinds = from.type === 'decision' ? [['cond', 'شرط'], ['default', 'افتراضي (خلاف ذلك)']] : from.type === 'approval' ? [['approved', 'معتمد'], ['rejected', 'مرفوض'], ['timeout', 'انتهاء المهلة']] : [['normal', 'عادي'], ['error', 'مسار خطأ'], ['timeout', 'انتهاء المهلة']];
    const cur = e.cond ? 'cond' : e.kind || 'normal';
    const rules = e.cond?.rules || [];
    const vars = this.def.variables || [];
    return `<div class="side-sec"><h4>رابط</h4>
      <p class="small">${esc(from.label)} ← ${esc(WF().node(this.def, e.to)?.label)}</p>
      <div class="field"><label>نص الفرع</label><input class="input" data-ef="label" value="${esc(e.label || '')}" placeholder="مثال: نعم، مرفوض، عاجل" ${ro}></div>
      <div class="field"><label>نوع الفرع</label><select class="input" data-ef="kind" ${ro}>${ui.options(kinds, cur)}</select></div>
      ${cur === 'cond' ? `<div class="field"><label>الشرط</label>
        <div class="seg"><button data-logic="and" class="${(e.cond?.logic || 'and') === 'and' ? 'on' : ''}" ${ro}>كل الشروط (و)</button><button data-logic="or" class="${e.cond?.logic === 'or' ? 'on' : ''}" ${ro}>أي شرط (أو)</button></div>
        ${rules.map((r, i) => `<div class="rule-row">
          <select class="input" data-rule="${i}" data-k="var" ${ro}>${vars.length ? ui.options(vars.map((v) => [v.name, v.label]), r.var) : `<option>${esc(r.var)}</option>`}</select>
          <select class="input" data-rule="${i}" data-k="op" ${ro}>${ui.options(Object.entries(WF().OPS), r.op)}</select>
          <input class="input" data-rule="${i}" data-k="value" value="${esc(r.value)}" ${ro}>
          ${ro ? '' : `<button class="icon-btn" data-delrule="${i}" aria-label="حذف الشرط">${icon('x', 'sm')}</button>`}</div>`).join('')}
        ${ro ? '' : `<button class="btn sm" data-addrule>${icon('plus', 'sm')} شرط</button>`}</div>` : ''}
      ${ro ? '' : `<button class="btn sm danger" data-delsel>${icon('trash', 'sm')} حذف الرابط</button>`}
    </div>`;
  };

  /* ================= التعديل ================= */
  Designer.prototype.snapshot = function () {
    this.undo.push(JSON.stringify({ nodes: this.def.nodes, edges: this.def.edges, variables: this.def.variables }));
    if (this.undo.length > 60) this.undo.shift();
    this.redo = [];
  };
  Designer.prototype.changed = function (redrawSide = true) {
    this.dirty = true;
    // إذا كانت قائمة الأخطاء معروضة يُعاد التحقق مباشرة بعد كل تعديل
    if (this.issues.length) {
      const v = WF().validate(this.def);
      this.issues = v.issues.length ? v.issues : [{ level: 'ok', msg: 'سير العمل سليم وجاهز للنشر' }];
    }
    this.drawGraph();
    this.drawMeta();
    this.drawActions();
    if (redrawSide) this.drawSide();
  };
  Designer.prototype.undoOnce = function () {
    if (!this.undo.length) return;
    this.redo.push(JSON.stringify({ nodes: this.def.nodes, edges: this.def.edges, variables: this.def.variables }));
    Object.assign(this.def, JSON.parse(this.undo.pop()));
    this.sel = null;
    this.changed();
  };
  Designer.prototype.redoOnce = function () {
    if (!this.redo.length) return;
    this.undo.push(JSON.stringify({ nodes: this.def.nodes, edges: this.def.edges, variables: this.def.variables }));
    Object.assign(this.def, JSON.parse(this.redo.pop()));
    this.changed();
  };

  Designer.prototype.addNode = function (type, x, y) {
    if (this.readonly) return;
    if (type === 'start' && this.def.nodes.some((n) => n.type === 'start')) { ui.toast('يوجد عقدة بداية بالفعل', 'warn'); return; }
    this.snapshot();
    const T = WF().TYPES[type];
    const n = { id: EM.uid(type).slice(0, 16), type, label: T.name, x: Math.round((x - T.w / 2) / SNAP) * SNAP, y: Math.round((y - T.h / 2) / SNAP) * SNAP, config: { onError: 'escalate', retries: 0 } };
    if (T.human) { n.config.role = 'nurse'; n.config.slaMin = 30; n.label = type === 'approval' ? 'اعتماد جديد' : 'مهمة جديدة'; }
    if (type === 'timer') n.config.duration = 30;
    if (type === 'auto') n.config.action = 'validate_order';
    this.def.nodes.push(n);
    this.sel = { type: 'node', id: n.id };
    this.changed();
  };

  Designer.prototype.connect = function (from, to) {
    if (from === to) return;
    if (this.def.edges.some((e) => e.from === from && e.to === to)) { ui.toast('يوجد رابط بين العقدتين بالفعل', 'warn'); return; }
    const a = WF().node(this.def, from);
    const b = WF().node(this.def, to);
    if (b.type === 'start') { ui.toast('لا يمكن الربط إلى عقدة البداية', 'warn'); return; }
    this.snapshot();
    const outs = WF().outs(this.def, from);
    const e = { id: EM.uid('e'), from, to, label: '' };
    if (a.type === 'decision') {
      if (!outs.some((x) => x.kind === 'default') && outs.length) { e.kind = 'default'; e.label = 'خلاف ذلك'; }
      else { const v = this.def.variables?.[0]; e.cond = { logic: 'and', rules: [{ var: v?.name || 'x', op: '=', value: v?.type === 'bool' ? true : '' }] }; e.label = 'نعم'; }
    } else if (a.type === 'approval') { e.kind = outs.some((x) => x.kind === 'approved') ? 'rejected' : 'approved'; e.label = e.kind === 'approved' ? 'معتمد' : 'مرفوض'; }
    else if (a.type !== 'fork' && outs.some((x) => !['error', 'timeout'].includes(x.kind))) { e.kind = 'error'; e.label = 'خطأ'; }
    this.def.edges.push(e);
    this.sel = { type: 'edge', id: e.id };
    this.changed();
  };

  Designer.prototype.deleteSel = function () {
    if (this.readonly || !this.sel) return;
    this.snapshot();
    if (this.sel.type === 'node') {
      this.def.nodes = this.def.nodes.filter((n) => n.id !== this.sel.id);
      this.def.edges = this.def.edges.filter((e) => e.from !== this.sel.id && e.to !== this.sel.id);
    } else this.def.edges = this.def.edges.filter((e) => e.id !== this.sel.id);
    this.sel = null;
    this.changed();
  };

  /** يحرك اللوحة لإظهار الخطوة النشطة إذا كانت خارج الإطار */
  Designer.prototype.followActive = function () {
    const inst = this.mode === 'sim' ? this.sim : this.monInst;
    const t = inst?.tokens?.[0];
    if (!t) return;
    const n = WF().node(this.def, t.node);
    if (!n) return;
    const r = this.svg.getBoundingClientRect();
    const s = WF().size(n);
    const sx = n.x * this.view.k + this.view.x, sy = n.y * this.view.k + this.view.y;
    if (sx < 40 || sy < 60 || sx + s.w * this.view.k > r.width - 40 || sy + s.h * this.view.k > r.height - 140) this.focusNode(n.id);
  };

  Designer.prototype.focusNode = function (id) {
    const n = WF().node(this.def, id);
    if (!n) return;
    const r = this.svg.getBoundingClientRect();
    const s = WF().size(n);
    this.view.x = r.width / 2 - (n.x + s.w / 2) * this.view.k;
    this.view.y = r.height / 2 - (n.y + s.h / 2) * this.view.k;
    this.applyView();
  };

  /* ================= الأحداث ================= */
  Designer.prototype.bindEvents = function () {
    const svg = this.svg;
    const wrapEl = this.root.querySelector('#cwrap');
    const toWorld = (ev) => { const r = svg.getBoundingClientRect(); return [(ev.clientX - r.left - this.view.x) / this.view.k, (ev.clientY - r.top - this.view.y) / this.view.k]; };
    let drag = null;

    svg.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const port = ev.target.closest('[data-port]');
      const nodeEl = ev.target.closest('[data-node]');
      const edgeEl = ev.target.closest('[data-edge]');
      if (port && this.mode === 'design' && !this.readonly) {
        drag = { kind: 'connect', from: port.dataset.port };
      } else if (nodeEl) {
        const id = nodeEl.dataset.node;
        this.sel = { type: 'node', id };
        if (this.mode === 'monitor' || this.mode === 'sim') { this.drawGraph(); return; }
        const n = WF().node(this.def, id);
        const [wx, wy] = toWorld(ev);
        drag = { kind: 'node', id, dx: wx - n.x, dy: wy - n.y, moved: false };
        this.drawGraph(); this.drawSide();
      } else if (edgeEl) {
        if (this.mode !== 'design') return;
        this.sel = { type: 'edge', id: edgeEl.dataset.edge };
        this.drawGraph(); this.drawSide();
        return;
      } else {
        drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, vx: this.view.x, vy: this.view.y, moved: false };
      }
      svg.setPointerCapture(ev.pointerId);
    });

    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      if (drag.kind === 'pan') {
        const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        this.view.x = drag.vx + dx; this.view.y = drag.vy + dy; this.applyView();
      } else if (drag.kind === 'node' && !this.readonly) {
        const [wx, wy] = toWorld(ev);
        const n = WF().node(this.def, drag.id);
        const nx = Math.round((wx - drag.dx) / SNAP) * SNAP, ny = Math.round((wy - drag.dy) / SNAP) * SNAP;
        if (nx === n.x && ny === n.y) return;
        if (!drag.moved) { this.snapshot(); drag.moved = true; }
        n.x = nx; n.y = ny;
        this.drawGraph();
      } else if (drag.kind === 'connect') {
        const a = WF().node(this.def, drag.from);
        const [sx, sy] = this.anchor(a, 'bottom');
        const [wx, wy] = toWorld(ev);
        this.root.querySelector('#ghost').setAttribute('d', `M ${sx} ${sy} C ${sx} ${sy + 60}, ${wx} ${wy - 60}, ${wx} ${wy}`);
      }
    });

    svg.addEventListener('pointerup', (ev) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.kind === 'connect') {
        this.root.querySelector('#ghost').setAttribute('d', '');
        const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-node]');
        if (target) this.connect(d.from, target.dataset.node);
      } else if (d.kind === 'node' && d.moved) { this.dirty = true; this.drawMeta(); this.drawMini(); }
      else if (d.kind === 'pan' && !d.moved && this.sel) { this.sel = null; this.drawGraph(); this.drawSide(); }
    });

    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const r = svg.getBoundingClientRect();
      this.zoomAt(ev.deltaY < 0 ? 1.1 : 1 / 1.1, ev.clientX - r.left, ev.clientY - r.top);
    }, { passive: false });

    // لوحة المفاتيح
    this.onKey = (ev) => {
      if (!document.body.contains(this.root.querySelector('.wfd'))) { document.removeEventListener('keydown', this.onKey); return; }
      if (ev.target.closest('input,textarea,select')) return;
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.mode === 'design') { ev.preventDefault(); this.deleteSel(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? this.redoOnce() : this.undoOnce(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); this.redoOnce(); }
      if (ev.key === 'Enter' && ev.target.closest('[data-node]')) { this.sel = { type: 'node', id: ev.target.closest('[data-node]').dataset.node }; this.drawGraph(); this.drawSide(); }
    };
    document.addEventListener('keydown', this.onKey);

    // سحب من لوحة العناصر
    this.root.querySelectorAll('.pal-item').forEach((b) => {
      b.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/x-node', b.dataset.type); ev.dataTransfer.effectAllowed = 'copy'; });
      b.addEventListener('click', () => {
        const r = svg.getBoundingClientRect();
        this.addNode(b.dataset.type, (r.width / 2 - this.view.x) / this.view.k, (r.height / 2 - this.view.y) / this.view.k);
      });
    });
    wrapEl.addEventListener('dragover', (ev) => { if (ev.dataTransfer.types.includes('text/x-node')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
    wrapEl.addEventListener('drop', (ev) => {
      const t = ev.dataTransfer.getData('text/x-node');
      if (!t) return;
      ev.preventDefault();
      const [wx, wy] = toWorld(ev);
      this.addNode(t, wx, wy);
    });

    // التكبير والبحث والخريطة المصغرة
    this.root.querySelector('.wfd-zoom').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-z]');
      if (!b) return;
      const r = svg.getBoundingClientRect();
      if (b.dataset.z === 'fit') this.fit(true); else this.zoomAt(b.dataset.z === 'in' ? 1.2 : 1 / 1.2, r.width / 2, r.height / 2);
    });
    this.root.querySelector('#wsearch').addEventListener('input', EM.debounce((ev) => {
      this.search = ev.target.value;
      this.drawGraph();
      const q = EM.norm(this.search.trim());
      const hit = q && this.def.nodes.find((n) => EM.norm(n.label).includes(q));
      if (hit) this.focusNode(hit.id);
    }, 150));
    this.root.querySelector('#mini').addEventListener('click', (ev) => {
      const r = ev.currentTarget.getBoundingClientRect();
      const b = this.miniB;
      const scale = Math.max(b.w / r.width, b.h / r.height);
      const wx = b.x + (ev.clientX - r.left) * scale - (r.width * scale - b.w) / 2;
      const wy = b.y + (ev.clientY - r.top) * scale - (r.height * scale - b.h) / 2;
      const sr = svg.getBoundingClientRect();
      this.view.x = sr.width / 2 - wx * this.view.k;
      this.view.y = sr.height / 2 - wy * this.view.k;
      this.applyView();
    });

    // تبديل الوضع
    this.root.querySelectorAll('.wfd-modes [data-m]').forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.m)));

    // اسم سير العمل
    this.root.querySelector('.wfd-name').addEventListener('change', (ev) => { this.def.name = ev.target.value.trim() || this.def.name; this.dirty = true; this.drawMeta(); });

    // أزرار الشريط
    this.root.querySelector('#wfdActions').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]');
      if (!b || b.disabled) return;
      this.action(b.dataset.a);
    });

    // اللوحة الجانبية (تفويض)
    const side = this.root.querySelector('#side');
    side.addEventListener('input', (ev) => this.sideInput(ev));
    side.addEventListener('change', (ev) => this.sideInput(ev, true));
    side.addEventListener('click', (ev) => this.sideClick(ev));
    window.addEventListener('resize', this.onResize = EM.debounce(() => { if (document.body.contains(svg)) this.drawMiniViewport(); }, 150));
  };

  Designer.prototype.sideInput = function (ev, committed) {
    const t = ev.target;
    if (this.readonly && this.mode === 'design') return;
    if (t.dataset.simvar !== undefined) {
      const v = this.def.variables.find((x) => x.name === t.dataset.simvar);
      this.simVars[v.name] = v.type === 'bool' ? t.checked : v.type === 'number' ? Number(t.value) : t.value;
      if (this.sim) this.sim.vars[v.name] = this.simVars[v.name];
      return;
    }
    if (t.dataset.monf !== undefined) { this.monFilter[t.dataset.monf] = t.value; if (committed || t.type === 'search') this.drawSide(); return; }
    const isText = t.tagName === 'INPUT' && (t.type === 'text' || t.type === 'search') || t.tagName === 'TEXTAREA';
    if (isText && !committed) {
      // تحديث مباشر للنصوص بدون إعادة رسم اللوحة الجانبية
      if (t.dataset.nf === 'label') { WF().node(this.def, this.sel.id).label = t.value; this.dirty = true; this.drawGraph(); }
      else if (t.dataset.ef === 'label') { this.def.edges.find((e) => e.id === this.sel.id).label = t.value; this.dirty = true; this.drawGraph(); }
      return;
    }
    if (!committed && !isText) return;
    this.snapshot();
    if (t.dataset.wf) this.def[t.dataset.wf] = t.value;
    else if (t.dataset.nf) WF().node(this.def, this.sel.id)[t.dataset.nf] = t.value;
    else if (t.dataset.cfg) {
      const n = WF().node(this.def, this.sel.id);
      n.config[t.dataset.cfg] = t.type === 'number' ? Number(t.value) : t.value || null;
    } else if (t.dataset.cfgb) WF().node(this.def, this.sel.id).config[t.dataset.cfgb] = t.checked;
    else if (t.dataset.ef) {
      const e = this.def.edges.find((x) => x.id === this.sel.id);
      if (t.dataset.ef === 'label') e.label = t.value;
      else if (t.value === 'cond') { delete e.kind; e.cond = e.cond || { logic: 'and', rules: [{ var: this.def.variables?.[0]?.name || 'x', op: '=', value: '' }] }; }
      else { delete e.cond; e.kind = t.value === 'normal' ? undefined : t.value; if (!e.kind) delete e.kind; }
    } else if (t.dataset.rule !== undefined) {
      const e = this.def.edges.find((x) => x.id === this.sel.id);
      const r = e.cond.rules[Number(t.dataset.rule)];
      r[t.dataset.k] = t.dataset.k === 'value' && (t.value === 'true' || t.value === 'false') ? t.value === 'true' : t.value;
    } else if (t.dataset.var !== undefined) {
      const v = this.def.variables[Number(t.dataset.var)];
      v[t.dataset.k] = t.dataset.k === 'options' ? t.value.split(',').map((x) => x.trim()).filter(Boolean) : t.value;
    }
    this.changed(t.tagName === 'SELECT' || t.type === 'checkbox');
  };

  Designer.prototype.sideClick = function (ev) {
    const b = ev.target.closest('button, a');
    if (!b) return;
    const ds = b.dataset;
    if (ds.iss !== undefined) { const i = this.issues[Number(ds.iss)]; if (i.nodeId) { this.sel = { type: 'node', id: i.nodeId }; this.focusNode(i.nodeId); } else if (i.edgeId) this.sel = { type: 'edge', id: i.edgeId }; this.drawGraph(); this.drawSide(); return; }
    if (ds.seledge) { this.sel = { type: 'edge', id: ds.seledge }; this.drawGraph(); this.drawSide(); return; }
    if (this.mode === 'sim') return this.simClick(b);
    if (this.mode === 'monitor') return this.monClick(b);
    if (this.readonly) return;
    if ('delsel' in ds) return this.deleteSel();
    if ('dupnode' in ds) { const n = WF().node(this.def, this.sel.id); const s = WF().size(n); this.addNode(n.type, n.x + s.w / 2 + 40, n.y + s.h / 2 + 40); const c = WF().node(this.def, this.sel.id); c.label = `${n.label} (نسخة)`; c.config = EM.clone(n.config); this.changed(); return; }
    if ('addvar' in ds) { this.snapshot(); (this.def.variables = this.def.variables || []).push({ name: `var${this.def.variables.length + 1}`, label: 'متغير جديد', type: 'bool', default: false }); this.changed(); return; }
    if (ds.delvar !== undefined) { this.snapshot(); this.def.variables.splice(Number(ds.delvar), 1); this.changed(); return; }
    if ('addrule' in ds) { this.snapshot(); const e = this.def.edges.find((x) => x.id === this.sel.id); e.cond.rules.push({ var: this.def.variables?.[0]?.name || 'x', op: '=', value: '' }); this.changed(); return; }
    if (ds.delrule !== undefined) { this.snapshot(); const e = this.def.edges.find((x) => x.id === this.sel.id); e.cond.rules.splice(Number(ds.delrule), 1); this.changed(); return; }
    if (ds.logic) { this.snapshot(); this.def.edges.find((x) => x.id === this.sel.id).cond.logic = ds.logic; this.changed(); return; }
    if (ds.status) {
      if (!store.guard('workflows.publish', 'تغيير حالة سير العمل')) return;
      store.setWorkflowStatus(this.def.id, ds.status);
      this.def.status = ds.status;
      ui.toast(`الحالة الآن: ${ui.statusText('wf', ds.status)}`, 'ok');
      this.drawAll();
    }
  };

  Designer.prototype.action = function (a) {
    if (a === 'undo') return this.undoOnce();
    if (a === 'layout') { this.snapshot(); WF().layout(this.def, true); this.changed(); this.fit(); return; }
    if (a === 'validate') {
      const v = WF().validate(this.def);
      this.issues = v.issues.length ? v.issues : [{ level: 'ok', msg: 'سير العمل سليم وجاهز للنشر' }];
      this.sel = null;
      this.drawGraph(); this.drawSide();
      ui.toast(v.ok ? 'لا توجد أخطاء — جاهز للنشر' : `${v.issues.filter((i) => i.level === 'error').length} خطأ يمنع النشر`, v.ok ? 'ok' : 'bad');
      return;
    }
    if (a === 'export') {
      EM.download(`${this.def.id}-v${this.def.version || 0}.elmarwa.json`, WF().toExport(this.def));
      store.audit('تصدير تعريف سير عمل', 'workflow', this.def.id);
      return;
    }
    if (a === 'import') {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = () => {
        const f = inp.files[0];
        if (!f) return;
        if (f.size > 1024 * 1024) { ui.toast('حجم الملف أكبر من 1 ميجابايت', 'bad'); return; }
        f.text().then((txt) => {
          try {
            const w = WF().fromImport(txt);
            this.snapshot();
            this.def.nodes = w.nodes; this.def.edges = w.edges; this.def.variables = w.variables || [];
            WF().layout(this.def);
            this.issues = WF().validate(this.def).issues;
            this.changed(); this.fit();
            ui.toast(`تم استيراد «${w.name}» كمسودة. راجع الأخطاء قبل النشر.`, 'ok', 5000);
          } catch (err) { ui.toast(err.message, 'bad', 5000); }
        });
      };
      inp.click();
      return;
    }
    if (a === 'save') {
      if (!store.guard('workflows.design', 'حفظ سير العمل')) return;
      store.saveWorkflow(EM.clone(this.def));
      this.def.status = store.workflow(this.def.id).status;
      this.dirty = false; this.drawMeta(); ui.toast('تم حفظ المسودة', 'ok');
      return;
    }
    if (a === 'publish') {
      if (!store.guard('workflows.publish', 'نشر سير العمل')) return;
      const copy = EM.clone(this.def);
      const v = store.publishWorkflow(copy);
      this.issues = v.issues;
      if (!v.ok) { this.sel = null; this.drawGraph(); this.drawSide(); ui.toast('لا يمكن النشر — أصلح الأخطاء الموضحة أولاً', 'bad'); return; }
      Object.assign(this.def, store.workflow(this.def.id));
      this.dirty = false;
      this.drawAll();
      ui.toast(`تم نشر الإصدار ${this.def.version}`, 'ok');
    }
  };

  Designer.prototype.setMode = function (m) {
    if (this.dirty && m !== 'design' && this.mode === 'design') ui.toast('تذكير: لديك تعديلات غير محفوظة. المحاكاة تستخدم النسخة المعروضة الآن.', 'warn');
    this.stopAuto();
    this.mode = m;
    this.sel = null;
    this.root.querySelector('.wfd').className = `wfd mode-${m}`;
    this.root.querySelectorAll('.wfd-modes [data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    this.root.querySelector('.wfd-name').readOnly = this.readonly || m !== 'design';
    if (m === 'sim') this.simReset();
    this.drawAll();
    history.replaceState(null, '', `#/admin/workflows/${this.def.id}${m === 'design' ? '' : `?mode=${m}`}`);
  };

  /* ================= المحاكاة ================= */
  Designer.prototype.simInit = function () {
    (this.def.variables || []).forEach((v) => { if (this.simVars[v.name] === undefined) this.simVars[v.name] = v.default; });
    this.sim = WF().createInstance(this.def, EM.clone(this.simVars), { simulation: true });
    this.simTraversed = new Set();
  };

  Designer.prototype.simReset = function () {
    this.stopAuto();
    this.simInit();
    this.drawGraph();
    this.drawSide();
  };

  Designer.prototype.simStep = function (tokenId, outcome) {
    if (!this.sim || this.sim.status !== 'running') return;
    if (tokenId) {
      const tok = this.sim.tokens.find((t) => t.id === tokenId);
      const n = WF().node(this.def, tok.node);
      if (outcome === 'approved' || outcome === 'rejected') this.sim.outcomes[n.id] = outcome;
      if (outcome === 'error' || outcome === 'timeout') this.sim.forced[n.id] = outcome;
      const r = WF().stepToken(this.def, this.sim, tokenId);
      (r?.moved || []).forEach((e) => this.simTraversed.add(e));
    } else WF().stepAll(this.def, this.sim).forEach((e) => this.simTraversed.add(e));
    this.drawGraph();
    this.drawSide();
    this.followActive();
    if (this.sim.status !== 'running') { this.stopAuto(); ui.toast(this.sim.status === 'completed' ? 'اكتملت المحاكاة — وصل المسار إلى نهاية' : 'توقفت المحاكاة بسبب خطأ في المسار', this.sim.status === 'completed' ? 'ok' : 'bad'); }
  };

  Designer.prototype.stopAuto = function () { if (this.timer) { clearInterval(this.timer); this.timer = null; } };

  Designer.prototype.simPanel = function () {
    const s = this.sim;
    const vars = this.def.variables || [];
    return `
      <div class="side-sec"><h4>وضع المحاكاة</h4><p class="xs muted">اختبر المسارات بدون إنشاء أو تعديل أي سجل مريض حقيقي. غيّر المتغيرات لاختبار فروع القرارات.</p>
        ${vars.map((v) => `<div class="field"><label>${esc(v.label)}</label>${v.type === 'bool' ? `<label class="check"><input type="checkbox" data-simvar="${esc(v.name)}" ${this.simVars[v.name] ? 'checked' : ''}> نعم</label>` : v.type === 'enum' ? `<select class="input" data-simvar="${esc(v.name)}">${ui.options(v.options.map((o) => [o, o]), this.simVars[v.name])}</select>` : `<input class="input" type="${v.type === 'number' ? 'number' : 'text'}" data-simvar="${esc(v.name)}" value="${esc(this.simVars[v.name])}">`}</div>`).join('') || '<p class="xs muted">لا توجد متغيرات لهذا المسار.</p>'}
        <div class="btn-group">
          <button class="btn" data-sim="reset">${icon('refresh', 'sm')} من البداية</button>
          <button class="btn primary" data-sim="step" ${s?.status !== 'running' ? 'disabled' : ''}>${icon('step', 'sm')} خطوة</button>
          <button class="btn" data-sim="auto" ${s?.status !== 'running' ? 'disabled' : ''}>${this.timer ? `${icon('pause', 'sm')} إيقاف` : `${icon('play', 'sm')} تشغيل تلقائي`}</button>
        </div>
      </div>
      <div class="side-sec"><h4>الحالة: ${ui.pill('inst', s?.status || 'running')}</h4>
        ${s?.tokens.length ? `<ul class="tokens">${s.tokens.map((t) => { const n = WF().node(this.def, t.node); const outs = WF().outs(this.def, n.id); return `<li><b class="small">${esc(n.label)}</b><span class="xs muted">${esc(WF().TYPES[n.type].name)}${n.config?.role ? ` · ${esc(EM.REF.role(n.config.role)?.name)}` : ''}</span>
          <div class="btn-group">${n.type === 'approval' ? `<button class="btn sm primary" data-tok="${t.id}" data-o="approved">اعتماد</button><button class="btn sm danger" data-tok="${t.id}" data-o="rejected">رفض</button>` : `<button class="btn sm" data-tok="${t.id}">تقدم</button>`}
          ${outs.some((e) => e.kind === 'timeout') ? `<button class="btn sm ghost" data-tok="${t.id}" data-o="timeout">انتهاء المهلة</button>` : ''}${outs.some((e) => e.kind === 'error') ? `<button class="btn sm ghost" data-tok="${t.id}" data-o="error">فرض خطأ</button>` : ''}</div></li>`; }).join('')}</ul>` : '<p class="xs muted">لا توجد خطوات نشطة.</p>'}
      </div>
      <div class="side-sec"><h4>سجل التنفيذ</h4><ol class="hist">${(s?.history || []).slice().reverse().map((h) => `<li class="h-${h.event}"><span class="xs">${esc(h.note || h.event)}</span>${h.node ? `<span class="xs muted">${esc(WF().node(this.def, h.node)?.label || '')}</span>` : ''}</li>`).join('')}</ol></div>`;
  };

  Designer.prototype.simClick = function (b) {
    const ds = b.dataset;
    if (ds.sim === 'reset') this.simReset();
    else if (ds.sim === 'step') this.simStep();
    else if (ds.sim === 'auto') {
      if (this.timer) { this.stopAuto(); this.drawSide(); }
      else { this.timer = setInterval(() => { if (!document.body.contains(this.svg)) return this.stopAuto(); this.simStep(); }, 900); this.drawSide(); }
    } else if (ds.tok) this.simStep(ds.tok, ds.o);
  };

  /* ================= مراقبة التنفيذ ================= */
  Designer.prototype.monitorPanel = function () {
    const all = store.state.instances.filter((i) => i.workflowId === this.def.id);
    const f = this.monFilter;
    const list = all.filter((i) => (!f.status || i.status === f.status) && EM.match(f.q, i.id, store.patientName(i.patientId), i.ref));
    const inst = this.monInst;
    const listHtml = this.opts.instanceLocked ? '' : `
      <div class="side-sec"><h4>المثيلات (${all.length})</h4>
        <div class="row" style="gap:6px"><select class="input" data-monf="status"><option value="">كل الحالات</option>${ui.options(['running', 'paused', 'failed', 'completed', 'cancelled'].map((k) => [k, ui.statusText('inst', k)]), f.status)}</select>
        <input class="input" type="search" data-monf="q" value="${esc(f.q)}" placeholder="مريض أو رقم"></div>
        <ul class="inst-list">${list.slice(0, 40).map((i) => `<li><button class="${inst?.id === i.id ? 'on' : ''}" data-inst="${esc(i.id)}"><span class="num xs">${esc(i.id)}</span><span class="grow small">${esc(i.patientId ? store.patientName(i.patientId) : i.ref || '—')}</span>${ui.pill('inst', i.status)}</button></li>`).join('') || '<li class="xs muted">لا توجد مثيلات مطابقة</li>'}</ul>
      </div>`;
    if (!inst) return `${listHtml}<div class="side-sec xs muted">اختر مثيلاً لعرض مساره الحي على اللوحة.</div>`;
    const def = this.def;
    const tasks = inst.tokens.map((t) => {
      const n = WF().node(def, t.node);
      const sla = n?.config?.slaMin || n?.config?.duration;
      const due = sla ? new Date(new Date(t.enteredAt).getTime() + sla * 60000) : null;
      return { t, n, due, late: due && due < new Date() };
    });
    const canAct = store.can('workflows.intervene');
    return `${listHtml}
      <div class="side-sec"><div class="row between"><h4 class="num">${esc(inst.id)}</h4>${ui.pill('inst', inst.status)}</div>
        <p class="xs muted">الإصدار <b class="num">v${inst.version}</b> · بدأ ${fmt.dateTime(inst.startedAt)}${inst.patientId ? ` · <a href="#/patients/${esc(inst.patientId)}">${esc(store.patientName(inst.patientId))}</a>` : ''}</p>
        ${inst.version !== this.def.versions?.at(-1)?.version ? '<p class="xs"><span class="pill info">يعمل على إصدار أقدم من المنشور حالياً</span></p>' : ''}
      </div>
      <div class="side-sec"><h4>الخطوة الحالية</h4>
        ${tasks.length ? `<ul class="tokens">${tasks.map(({ t, n, due, late }) => `<li><b class="small">${esc(n?.label)}</b>
          <span class="xs muted">${esc(WF().TYPES[n.type].name)}${n.config?.role ? ` · ${esc(EM.REF.role(n.config.role)?.name)}` : ''}</span>
          ${due ? `<span class="pill ${late ? 'bad' : 'warn'}">${late ? `متأخرة ${fmt.minutes(EM.minsSince(due))}` : `مستحقة ${fmt.time(due)}`}</span>` : ''}
          <div class="xs muted">الانتقالات الممكنة: ${WF().outs(def, n.id).map((e) => esc(e.label || WF().EDGE_KINDS[e.kind || 'normal'] || 'التالي') + ' ← ' + esc(WF().node(def, e.to)?.label)).join(' | ')}</div>
          ${inst.status === 'running' ? `<div class="btn-group">${n.type === 'approval' ? `<button class="btn sm primary" data-done="${t.id}" data-o="approved">اعتماد</button><button class="btn sm danger" data-done="${t.id}" data-o="rejected">رفض</button>` : `<button class="btn sm primary" data-done="${t.id}">إنجاز الخطوة</button>`}</div>` : ''}
        </li>`).join('')}</ul>` : '<p class="xs muted">لا توجد خطوات نشطة.</p>'}
        <div class="btn-group" style="margin-top:8px">
          ${inst.status === 'running' && canAct ? '<button class="btn sm" data-ia="pause">إيقاف مؤقت</button>' : ''}
          ${inst.status === 'paused' && canAct ? '<button class="btn sm primary" data-ia="resume">استئناف</button>' : ''}
          ${inst.status === 'failed' && canAct ? '<button class="btn sm primary" data-ia="retry">إعادة المحاولة</button>' : ''}
          ${['running', 'paused', 'failed'].includes(inst.status) && canAct ? '<button class="btn sm danger" data-ia="cancel">إلغاء مع التعويض</button>' : ''}
        </div>
        ${!canAct ? '<p class="xs muted">التدخل اليدوي (إيقاف/إلغاء/إعادة) يحتاج صلاحية مخصصة.</p>' : ''}
      </div>
      <div class="side-sec"><h4>سجل التنفيذ الكامل</h4><ol class="hist">${inst.history.slice().reverse().map((h) => `<li class="h-${h.event}"><span class="xs">${esc(h.note || h.event)}${h.node ? ` — ${esc(WF().node(def, h.node)?.label || '')}` : ''}</span><span class="xs muted">${fmt.dateTime(h.at)}${h.by ? ` · ${esc(EM.REF.userName(h.by))}` : ''}</span></li>`).join('')}</ol></div>`;
  };

  Designer.prototype.monClick = function (b) {
    const ds = b.dataset;
    if (ds.inst) {
      this.monInst = store.state.instances.find((i) => i.id === ds.inst);
      if (this.monInst.version !== this.def.version) {
        // اعرض الإصدار الذي يعمل عليه المثيل فعلاً
        const vd = store.versionDef(this.def.id, this.monInst.version);
        this.def = { ...EM.clone(vd), versions: this.def.versions, status: this.def.status };
      }
      this.drawGraph(); this.drawSide(); this.followActive();
      return;
    }
    if (ds.done) {
      if (store.completeTask(this.monInst.id, ds.done, ds.o)) ui.toast('تم وانتقل المسار للخطوة التالية', 'ok');
      this.monInst = store.state.instances.find((i) => i.id === this.monInst.id);
      this.drawGraph(); this.drawSide();
      return;
    }
    if (ds.ia) {
      const go = (reason) => { store.instanceAction(this.monInst.id, ds.ia, reason); this.drawGraph(); this.drawSide(); ui.toast('تم تنفيذ الإجراء وتسجيله', 'ok'); };
      if (ds.ia === 'cancel' || ds.ia === 'pause') ui.confirm({ title: ds.ia === 'cancel' ? 'إلغاء المثيل' : 'إيقاف مؤقت', message: ds.ia === 'cancel' ? 'ستُنفذ إجراءات التعويض للخطوات القابلة للعكس (مثل تحرير السرير أو المخزون المحجوز) بترتيب عكسي.' : 'لن تتقدم المهام حتى الاستئناف.', reason: true, danger: ds.ia === 'cancel', confirm: 'تأكيد', onOk: go });
      else go();
    }
  };

  EM.Designer = Designer;
  EM.drawThumb = function (def) {
    // صورة مصغرة للبطاقات
    const d = EM.WF.layout(EM.clone(def));
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    d.nodes.forEach((n) => { const s = EM.WF.size(n); x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + s.w); y2 = Math.max(y2, n.y + s.h); });
    const c = (n) => { const s = EM.WF.size(n); return [n.x + s.w / 2, n.y + s.h / 2]; };
    return `<svg viewBox="${x1 - 20} ${y1 - 20} ${x2 - x1 + 40} ${y2 - y1 + 40}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${d.edges.map((e) => { const a = EM.WF.node(d, e.from), b = EM.WF.node(d, e.to); if (!a || !b) return ''; const [ax, ay] = c(a), [bx, by] = c(b); return `<path d="M${ax} ${ay} C ${ax} ${(ay + by) / 2}, ${bx} ${(ay + by) / 2}, ${bx} ${by}" class="th-e ${e.kind === 'error' || e.kind === 'timeout' ? 'th-x' : ''}"/>`; }).join('')}
      ${d.nodes.map((n) => { const s = EM.WF.size(n); return n.type === 'decision' ? `<polygon class="th-n th-${n.type}" points="${n.x + s.w / 2},${n.y} ${n.x + s.w},${n.y + s.h / 2} ${n.x + s.w / 2},${n.y + s.h} ${n.x},${n.y + s.h / 2}"/>` : `<rect class="th-n th-${n.type}" x="${n.x}" y="${n.y}" width="${s.w}" height="${s.h}" rx="${n.type === 'start' || n.type === 'end' ? s.h / 2 : 10}"/>`; }).join('')}
    </svg>`;
  };
})();
