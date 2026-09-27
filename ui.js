'use strict';
/* ==========================================================================
   UI — shell, navigation, helpers, calculation workspace, A–V renderer
   ========================================================================== */
const $ = s => document.querySelector(s);
let ROUTE = 'm1';
let NAV_OPEN = false;

function toast(msg){ const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200); }
function modal(title, html){ const m = $('#modal'); m.innerHTML = `<div class="box"><div class="row" style="justify-content:space-between"><h2>${esc(title)}</h2><button data-act="closemodal">Close</button></div>${html}</div>`; m.classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
const badge = (st, txt) => `<span class="badge ${st}">${esc(txt || ({pass:'PASS', fail:'FAIL', info:'INFO', warn:'CHECK', na:'N/A'}[st] || st))}</span>`;
const dis = perm => can(perm) ? '' : ' disabled';
function stdTitle(id){ const s = (P.standards || []).find(x => x.id === id); return s ? `${s.number !== '—' ? s.number + ' — ' : ''}${s.title}` : id; }
function stdCell(id){ const s = (P.standards || []).find(x => x.id === id); if (!s) return esc(id); return `<b>${esc(s.number)}</b> ${esc(s.title)} <span class="badge ${s.status === 'CURRENT' ? 'pass' : s.status === 'SUPERSEDED' ? 'fail' : s.status === 'VERIFY' ? 'warn' : 'na'}">${s.status}</span>`; }

/* generic editable table bound to P path */
function editTable(path, cols, opt){
  opt = opt || {}; const arr = getPath(P, path) || []; const perm = opt.perm || 'registers';
  let h = `<div class="tw"><table class="t"><thead><tr>${opt.idx ? '<th>#</th>' : ''}${cols.map(c => `<th class="${c.n ? 'n' : ''}" style="${c.w ? 'min-width:' + c.w + 'px' : ''}">${esc(c.l)}</th>`).join('')}${can(perm) && !opt.noDel ? '<th></th>' : ''}</tr></thead><tbody>`;
  arr.forEach((r, i) => {
    h += `<tr>${opt.idx ? `<td class="muted">${i + 1}</td>` : ''}` + cols.map(c => {
      const v = getPath(r, c.k); const bp = `${path}.${i}.${c.k}`;
      if (c.ro) return `<td class="${c.n ? 'n' : ''}">${c.fmt ? c.fmt(v, r, i) : esc(v)}</td>`;
      if (c.t === 'sel') return `<td><select data-bind="${bp}"${dis(perm)}>${(typeof c.o === 'function' ? c.o(r) : c.o).map(o => `<option${o == v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
      if (c.t === 'area') return `<td><textarea data-bind="${bp}"${dis(perm)} rows="2">${esc(v)}</textarea></td>`;
      return `<td><input ${c.n ? 'class="num" data-num="1"' : ''} data-bind="${bp}" value="${esc(v == null ? '' : v)}"${dis(perm)}></td>`;
    }).join('') + (can(perm) && !opt.noDel ? `<td><button class="sm" data-act="delrow" data-path="${path}" data-i="${i}" title="Delete row">✕</button></td>` : '') + '</tr>';
  });
  h += '</tbody></table></div>';
  if (can(perm) && opt.tpl) h += `<div class="row" style="margin-top:6px"><button class="sm" data-act="addrow" data-path="${path}" data-tpl='${esc(JSON.stringify(opt.tpl))}'>+ Add row</button>${opt.extra || ''}</div>`;
  return h;
}
function getPath(o, path){ return path.split('.').reduce((a, k) => a == null ? undefined : a[k], o); }
function setPath(o, path, v){ const ks = path.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k] = a[k] == null ? {} : a[k], o); t[last] = v; }

/* ---------- navigation ---------- */
function renderNav(){
  let h = '';
  GROUPS.forEach(g => { const ms = MODULES.filter(m => m.grp === g && modApplies(m)); if (!ms.length) return;
    h += `<div class="g">${esc(g)}</div>`;
    ms.forEach(m => { const st = moduleStatus(m); h += `<a href="#${m.id}" class="${ROUTE === m.id ? 'on' : ''}" data-nav="${m.id}"><span class="n">${m.no}</span><span class="t">${esc(m.name)}</span><span class="dot ${st}"></span></a>`; }); });
  $('#nav').innerHTML = h;
}
function renderTop(){
  $('#top').innerHTML = `
    <button class="navtoggle sm" data-act="togglenav" aria-label="Menu">☰</button>
    <div class="brand">C&amp;S <span>Tender</span> Engineering Platform</div>
    <span class="badge ${P.type === 'B' ? 'b' : 'a'}">${P.type === 'B' ? 'TYPE B · Solar + BESS' : 'TYPE A · Solar Farm'}</span>
    <div class="pname" title="${esc(P.info.name)}">${esc(P.info.name)}</div>
    ${P.sample ? '<span class="demo">' + DEMO_FLAG + '</span>' : ''}
    <div class="sp"></div>
    <div class="grp"><label class="small muted">Role</label><select data-act="role">${Object.keys(ROLES).map(r => `<option${r === P.role ? ' selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="grp">
      <button class="sm" data-act="save" title="Save to this browser">Save</button>
      <button class="sm" data-act="export" title="Export project JSON">Export JSON</button>
      <button class="sm" data-act="import" title="Import project JSON">Import</button>
      <button class="sm" data-act="newproj">New</button>
      <button class="sm pri" data-act="goto" data-id="m65">Report</button>
    </div>`;
}

/* ---------- calculation block (three-column) ---------- */
function stepHTML(s){
  if (s.t === 'h') return `<div class="sh">${esc(s.title)}</div>`;
  if (s.t === 'x') return `<div class="tx">${esc(s.text)}</div>`;
  if (s.t === 'tb') return `<div class="tx"><b>${esc(s.title)}</b></div><div class="tw"><table class="t" style="font-size:11px;margin:2px 0 6px"><thead><tr>${s.head.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${s.rows.map(r => `<tr>${r.map(c => `<td${/^[−\-]?[\d.,]+( \(|$)/.test(String(c)) ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  if (s.t === 'c') return `<div class="tx" style="color:${s.chk.pass ? 'var(--ok)' : 'var(--ng)'}">${s.chk.pass ? '✓' : '✗'} Check — ${esc(s.chk.label)}: ${s.chk.pass ? 'PASS' : 'FAIL'}</div>`;
  const r = s.val == null ? '' : `<div class="r">${fmt(s.val, s.dp)} <span class="muted" style="font-weight:400">${esc(s.unit || '')}</span></div>`;
  return `<div class="st"><div class="e"><i>${esc(s.sym || '')}</i>${s.desc ? ` <span class="d">— ${esc(s.desc)}</span>` : ''}</div>${r}<div class="e">${esc(s.formula || '')}</div>${s.subst ? `<div class="s">= ${esc(s.subst)}</div>` : ''}${s.ref ? `<div class="ref">${esc(s.ref)}</div>` : ''}</div>`;
}
function inputRow(cid, d, r){
  if (d.g) return `<tr class="grp"><td colspan="5">${esc(d.g)}</td></tr>`;
  const m = r && r.meta ? r.meta[d.k] : getInput(cid, d); const v = r ? r.I[d.k] : m.v; const linked = m && m.linked;
  const cf = inputConf(cid, d, linked), src = inputSrc(cid, d, m);
  const tip = `${cf}${src ? ' — ' + src : ''}`;
  let ctl;
  const ro = !can('edit');
  if (d.t === 's'){ const opts = typeof d.o === 'function' ? d.o() : d.o; ctl = `<select data-cin="${cid}|${d.k}"${ro ? ' disabled' : ''}>${opts.map(o => `<option${o == v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`; }
  else if (d.t === 'x') ctl = `<input data-cin="${cid}|${d.k}" value="${esc(v)}"${ro ? ' disabled' : ''}>`;
  else ctl = `<input class="num${linked ? ' linked' : ''}" data-cin="${cid}|${d.k}" value="${isNum(v) ? +v.toPrecision(6) : esc(v)}"${ro || linked ? ' disabled' : ''} title="${esc(tip)}">`;
  const lk = d.link ? `<button class="sm" style="padding:0 4px;font-size:10px" data-act="togglelink" data-cid="${cid}" data-k="${d.k}" title="${linked ? 'Linked to ' + d.link + ' — click to override' : 'Overridden — click to re-link to ' + d.link}">${linked ? '🔗' : '✎'}</button>` : '';
  return `<tr><td class="sym">${esc(d.sym || '')}</td><td class="lab">${esc(d.l)}${lk}</td><td class="val">${ctl}</td><td class="u">${esc(d.u || '')}</td><td class="cf"><span class="cfdot cf-${CONF_CLS[cf]}" title="${esc(tip)}">${CONF_ABBR[cf]}</span></td></tr>`;
}
function calcBlock(cid){
  const c = CALCS[cid], r = R[cid]; if (!r) return '';
  const st = r.status, m = P.calcMeta[cid] || {}, mod = calcModified(cid);
  const reqs = (c.req || []).length ? `<span class="badge info" title="Required calculator no. (brief §94)">Req. #${c.req.join(', #')}</span>` : '';
  let h = `<div class="calc" id="calc-${cid}"><div class="ch"><span class="cno">${esc(c.no)} · Rev ${esc(calcRev(cid))}${mod ? ' <span class="badge warn">modified since issue</span>' : ''}</span><h2>${esc(c.title)}</h2>${badge(st)}${reqs}<span class="sp"></span>
    <button class="sm" data-act="sheet" data-id="${cid}">Calculation sheet</button>${can('edit') ? `<button class="sm" data-act="issue" data-id="${cid}">Issue revision</button>` : ''}${can('check') ? `<button class="sm" data-act="checkcalc" data-id="${cid}">${m.checkedBy ? 'Checked ✓' : 'Mark checked'}</button>` : ''}${can('edit') ? `<button class="sm" data-act="resetcalc" data-id="${cid}">Reset</button>` : ''}</div>
    <div class="muted small" style="padding:6px 12px 0">${esc(c.purpose)}</div>
    <div class="cols">
      <div><div class="colh"><span class="L">C</span><span class="L">D</span> Inputs &amp; source</div><table class="inp">${c.inputs.map(d => inputRow(cid, d, r)).join('')}</table>
        <div class="small muted" style="margin-top:6px">Confidence: ${Object.entries(CONF_ABBR).filter(([k]) => k !== 'Linked').map(([k, a]) => `<span class="cfdot cf-${CONF_CLS[k]}" title="${k}">${a}</span>`).join(' ')} <span class="cfdot cf-Linked" title="Linked from another calculation">L</span></div></div>
      <div><div class="colh"><span class="L">H</span><span class="L">I</span> Formula &amp; detailed calculation</div><div class="steps">${r.steps.map(stepHTML).join('')}</div></div>
      <div><div class="colh"><span class="L">J</span><span class="L">K</span><span class="L">L</span> Results, checks &amp; compliance</div>
        <table class="res">${r.resList.map(x => `<tr><td>${esc(x.label)} <span class="trace" data-act="trace" data-id="${cid}" data-k="${esc(x.key)}">trace</span></td><td class="v">${fmt(x.val, x.dp)}</td><td class="u">${esc(x.unit || '')}</td></tr>`).join('')}</table>
        ${r.checks.map(k => `<div class="chk ${k.pass ? 'pass' : 'fail'}"><div class="cl"><span>${esc(k.label)}</span>${badge(k.pass ? 'pass' : 'fail')}</div><div class="cm">${esc(k.msg)}</div></div>`).join('')}
        ${r.warns.map(w => `<div class="wbox"><b>${esc(WARN[w.tag] || w.tag)}</b> — ${esc(w.text)}</div>`).join('')}
        <div class="small muted" style="margin-top:6px">Compliance: ${r.checks.filter(k => k.pass).length}/${r.checks.length} checks satisfied · Codes: ${c.codes.map(x => esc((P.standards.find(s => s.id === x) || {number:x}).number)).join(', ')} — ${CVR}</div>
      </div>
    </div>
    <div class="below">
      <div><h4>Engineering interpretation</h4>${r.notes.length ? '<ul>' + r.notes.map(n => `<li>${esc(n)}</li>`).join('') + '</ul>' : '<span class="muted">—</span>'}</div>
      <div><h4>Proposed solution</h4>${r.prop.length ? r.prop.map(n => `<div>${esc(n)}</div>`).join('') : '<span class="muted">—</span>'}</div>
      <div><h4>Quantity</h4>${r.qty.length ? '<ul>' + r.qty.map(q => `<li>${esc(BOQ_LIB[q.key].desc)}: <b>${fmt(q.qty, q.qty < 100 ? 1 : 0)}</b> ${esc(BOQ_LIB[q.key].unit)}</li>`).join('') + '</ul>' : '<span class="muted">—</span>'}</div>
      <div><h4>Risk</h4>${calcRisks(cid)}</div>
      <div><h4>Tender impact</h4>${r.tender.length ? r.tender.map(n => `<div>${esc(n)}</div>`).join('') : tenderImpactOf(r.qty.map(q => q.key))}</div>
    </div></div>`;
  return h;
}
function calcRisks(cid){
  const mod = modOfCalc(cid); const rs = RISKS.filter(r => mod && r.mod === mod.id);
  const fails = R[cid].checks.filter(c => !c.pass);
  if (!rs.length && !fails.length) return '<span class="muted">No risk triggered by this calculation.</span>';
  return '<ul>' + rs.map(r => `<li><b>${esc(r.id)}</b> ${esc(r.title)} <span class="badge ${r.level === 'High' ? 'fail' : r.level === 'Medium' ? 'warn' : 'na'}">${r.level}</span></li>`).join('') + fails.map(f => `<li>Design non-compliance: ${esc(f.label)}</li>`).join('') + '</ul>';
}
function tenderImpactOf(keys){
  const rows = TENDER.rows.filter(r => keys.includes(r.key) && r.issues.length);
  if (!rows.length) return keys.length ? '<span class="muted">Tender quantities consistent (±10%).</span>' : '<span class="muted">—</span>';
  return '<ul>' + rows.map(r => `<li>${esc(r.desc)}: ${r.issues.map(esc).join(', ')}${r.rq ? ` (req. ${fmt(r.rq, 0)} vs tender ${fmt(r.tq, 0)} ${esc(r.unit)})` : ''}</li>`).join('') + '</ul>';
}

/* ---------- A–V technical module renderer ---------- */
const LETTERS = [['A','Overview'],['B','Available Information'],['C','Input Data & Calculation Workspace'],['D','Input Source'],['E','Design Criteria'],['F','Assumptions'],['G','Applicable Codes / Standards'],['H','Formula / Methodology'],['I','Detailed Calculation'],['J','Results'],['K','Engineering Checks'],['L','Compliance'],['M','Sensitivity Analysis'],['N','Proposed Engineering Solution'],['O','Quantity'],['P','Cost Impact'],['Q','Tender Impact'],['R','Risks'],['S','Outstanding Information'],['T','Recommendations'],['U','Calculation Sheet'],['V','Report Section']];
const sec = (L, body, extra) => `<div class="sec" id="sec-${L}"><h3><span class="L">${L}</span>${esc(LETTERS.find(x => x[0] === L)[1])}${extra || ''}</h3>${body}</div>`;
function renderTech(m){
  const cs = (m.calcs || []).filter(calcApplies);
  const rs = cs.map(c => R[c]).filter(Boolean);
  const st = moduleStatus(m);
  let h = `<div class="ph"><h1><span class="mno">${m.no}.</span>${esc(m.name)}</h1>${st ? badge(st) : ''}<span class="sub">${esc(m.grp)}</span></div>`;
  h += `<div class="letters noprint">${LETTERS.map(([L, t]) => `<a href="#${m.id}" data-scroll="sec-${L}" title="${esc(t)}">${L}</a>`).join('')}</div>`;
  // A
  h += sec('A', `<p>${esc(m.ov || '')}</p>${cs.length ? `<table class="t" style="max-width:760px"><thead><tr><th>Calc no.</th><th>Calculation</th><th>Status</th><th>Rev</th><th>Checks</th></tr></thead><tbody>${cs.map(c => `<tr><td>${esc(CALCS[c].no)}</td><td><a href="#${m.id}" data-scroll="calc-${c}">${esc(CALCS[c].title)}</a></td><td>${badge(R[c].status)}</td><td>${esc(calcRev(c))}</td><td>${R[c].checks.filter(k => k.pass).length}/${R[c].checks.length}</td></tr>`).join('')}</tbody></table>` : ''}`);
  // B
  const docs = (P.docs || []).filter(d => d.mod === m.id);
  h += sec('B', `${docs.length ? `<table class="t"><thead><tr><th>Ref</th><th>Document</th><th>From</th><th>Status</th></tr></thead><tbody>${docs.map(d => `<tr><td>${esc(d.id)}</td><td>${esc(d.title)}</td><td>${esc(d.from)}</td><td>${badge(d.status === 'Received' ? 'pass' : d.status === 'Partial' ? 'warn' : 'fail', d.status)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No documents registered against this module (see Documents).</p>'}${(m.avail || []).length ? `<p class="small muted">Information typically required: ${m.avail.map(esc).join('; ')}.</p>` : ''}`);
  // C (custom + calc workspace)
  h += sec('C', `${m.custom ? (CUSTOM[m.custom] || (() => ''))(m) : ''}${cs.map(calcBlock).join('')}${!cs.length && !m.custom ? '<p class="muted">No calculations in this module.</p>' : ''}`);
  // D input source
  h += sec('D', cs.length ? inputSourceTable(cs) : '<p class="muted">—</p>');
  // E criteria
  const crit = [...new Set([...(m.crit || []), ...cs.flatMap(c => CALCS[c].criteria)])];
  h += sec('E', `<ul class="tight">${crit.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${m.conflict ? criteriaConflict() : ''}`);
  // F assumptions
  const asm = cs.flatMap(c => CALCS[c].assume.map(a => [CALCS[c].no, a]));
  const ua = (P.reg.assumptions || []).filter(a => a.mod === m.id);
  h += sec('F', `<ul class="tight">${asm.map(([n, a]) => `<li><span class="muted">${esc(n)}</span> — ${esc(a)}</li>`).join('')}${ua.map(a => `<li><span class="muted">User</span> — ${esc(a.text)}</li>`).join('')}</ul><p class="small muted">Input-level assumptions (Consultant Assumption / Estimated / Unknown) are listed in section D and in the Assumption Register.</p>`);
  // G codes
  const codes = [...new Set(cs.flatMap(c => CALCS[c].codes))];
  h += sec('G', codes.length ? `<table class="t"><thead><tr><th>Ref</th><th>Document</th><th>Authority</th><th>Clause</th></tr></thead><tbody>${codes.map(id => { const s = P.standards.find(x => x.id === id) || {}; return `<tr><td>${esc(id)}</td><td>${stdCell(id)}</td><td>${esc(s.auth || '')}</td><td class="small" style="color:var(--wn)">${esc(s.clause || CVR)}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">—</p>');
  // H formula
  const forms = []; rs.forEach((r, i) => r.steps.forEach(s => { if (s.t === 'e' && s.formula && forms.length < 40 && !forms.find(f => f[1] === s.formula)) forms.push([CALCS[cs[i]].no, s.formula, s.ref || '']); }));
  h += sec('H', forms.length ? `<table class="t"><thead><tr><th>Calc</th><th>Equation</th><th>Reference</th></tr></thead><tbody>${forms.map(f => `<tr><td class="muted">${esc(f[0])}</td><td>${esc(f[1])}</td><td class="small">${esc(f[2])}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">—</p>');
  // I detailed
  h += sec('I', `<p class="small">The full step-by-step calculation (equation → substitution → result → reference) is shown in the centre column of each calculation in section C and in the printable calculation sheets (section U).</p>`);
  // J results
  h += sec('J', rs.length ? `<table class="t"><thead><tr><th>Calc</th><th>Result</th><th class="n">Value</th><th>Unit</th></tr></thead><tbody>${rs.flatMap((r, i) => r.resList.map(x => `<tr><td class="muted">${esc(CALCS[cs[i]].no)}</td><td>${esc(x.label)}</td><td class="n">${fmt(x.val, x.dp)}</td><td>${esc(x.unit || '')}</td></tr>`)).join('')}</tbody></table>` : '<p class="muted">—</p>');
  // K checks
  const chks = rs.flatMap((r, i) => r.checks.map(k => [CALCS[cs[i]].no, k]));
  h += sec('K', chks.length ? `<table class="t"><thead><tr><th>Calc</th><th>Check</th><th class="n">Value</th><th>Limit</th><th class="n">Util.</th><th>Result</th></tr></thead><tbody>${chks.map(([n, k]) => `<tr><td class="muted">${esc(n)}</td><td>${esc(k.label)}</td><td class="n">${fmt(k.val, k.dp == null ? 2 : k.dp)} ${esc(k.unit || '')}</td><td>${k.rel === '<=' ? '≤' : '≥'} ${fmt(k.lim, k.dp == null ? 2 : k.dp)}</td><td class="n">${fmt(k.util, 2)}</td><td>${badge(k.pass ? 'pass' : 'fail')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No numerical checks.</p>');
  // L compliance
  const np = chks.filter(([, k]) => k.pass).length;
  h += sec('L', `<p><b>${np} of ${chks.length}</b> engineering checks satisfied.${chks.length - np ? ` <span style="color:var(--ng)">${chks.length - np} non-compliance(s) — see K and T.</span>` : ''}</p><p class="small">Compliance is stated against the referenced codes subject to verification of edition, National Annex values and clause references (<b>${CVR}</b>). Authority requirements marked <b>AUTHORITY CONFIRMATION REQUIRED</b> are not yet confirmed.</p>`);
  // M sensitivity
  h += sec('M', sensHTML(m));
  // N proposed
  const prop = rs.flatMap(r => r.prop);
  h += sec('N', prop.length ? `<ul class="tight">${prop.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p class="muted">—</p>');
  // O quantity / P cost
  const qs = rs.flatMap((r, i) => r.qty.map(q => Object.assign({calc: cs[i]}, q)));
  h += sec('O', qs.length ? `<table class="t"><thead><tr><th>BOQ item</th><th>Description</th><th class="n">Qty</th><th>Unit</th><th>Basis</th><th>Calc</th></tr></thead><tbody>${qs.map(q => `<tr><td>${esc(q.key)}</td><td>${esc(BOQ_LIB[q.key].desc)}</td><td class="n">${fmt(q.qty, q.qty < 100 ? 2 : 0)}</td><td>${esc(BOQ_LIB[q.key].unit)}</td><td class="small">${esc(q.basis)}</td><td class="muted">${esc(CALCS[q.calc].no)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No BOQ quantities generated by this module.</p>');
  const ct = sum(qs.map(q => q.qty * rateOf(q.key)));
  h += sec('P', qs.length ? `<table class="t" style="max-width:760px"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Rate (RM)</th><th class="n">Amount (RM)</th></tr></thead><tbody>${qs.map(q => `<tr><td>${esc(BOQ_LIB[q.key].desc)}</td><td class="n">${fmt(q.qty, 0)}</td><td class="n">${fmt(rateOf(q.key), 2)}</td><td class="n">${fmt(q.qty * rateOf(q.key), 0)}</td></tr>`).join('')}<tr class="tot"><td>Module cost impact</td><td></td><td></td><td class="n">${fmt(ct, 0)}</td></tr></tbody></table><p class="small muted">Demonstration rates — see BOQ for rate basis. ${(ct / Math.max(costSummary().direct, 1) * 100).toFixed(1)}% of direct civil cost.</p>` : '<p class="muted">—</p>');
  // Q tender
  const ti = rs.flatMap(r => r.tender);
  h += sec('Q', `${ti.length ? `<ul class="tight">${ti.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${tenderImpactOf([...new Set(qs.map(q => q.key))])}`);
  // R risks
  const mr = RISKS.filter(r => r.mod === m.id);
  h += sec('R', `${mr.length ? riskTable(mr) : '<p class="muted">No risks registered for this module.</p>'}`);
  // S outstanding
  const ws = rs.flatMap((r, i) => r.warns.map(w => [CALCS[cs[i]].no, w]));
  const outs = [...(m.out || []), ...rs.flatMap(r => r.outstanding)];
  const pend = docs.filter(d => d.status !== 'Received');
  h += sec('S', `<ul class="tight">${outs.map(o => `<li>${esc(o)}</li>`).join('')}${pend.map(d => `<li>${esc(d.title)} — <b>${esc(d.status)}</b></li>`).join('')}${ws.map(([n, w]) => `<li><b>${esc(WARN[w.tag] || w.tag)}</b> <span class="muted">(${esc(n)})</span> ${esc(w.text)}</li>`).join('')}</ul>`);
  // T recommendations
  const fx = chks.filter(([, k]) => !k.pass).map(([n, k]) => `${n}: ${k.label} — ${k.fix || 'revise design.'}`);
  h += sec('T', `<ul class="tight">${fx.map(x => `<li style="color:var(--ng)">${esc(x)}</li>`).join('')}${(m.rec || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  // U calc sheet
  h += sec('U', cs.length ? `<table class="t"><thead><tr><th>Calc no.</th><th>Title</th><th>Rev</th><th>Issued</th><th>Checked</th><th></th></tr></thead><tbody>${cs.map(c => { const mm = P.calcMeta[c] || {}; const last = (mm.revs || []).slice(-1)[0]; return `<tr><td>${esc(CALCS[c].no)}</td><td>${esc(CALCS[c].title)}</td><td>${esc(calcRev(c))}</td><td>${last ? esc(last.date + ' — ' + last.by) : 'Not issued'}</td><td>${esc(mm.checkedBy || '—')}</td><td><button class="sm" data-act="sheet" data-id="${c}">Open sheet</button> <button class="sm" data-act="revhist" data-id="${c}">History</button></td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">—</p>');
  // V report
  h += sec('V', `<div class="report-body" style="max-height:420px;overflow:auto;border:1px solid var(--bd);padding:10px 14px;background:#fff">${chapterPreview(m)}</div>`);
  return h;
}
function inputSourceTable(cs){
  let h = `<div class="tw"><table class="t"><thead><tr><th>Calc</th><th>Symbol</th><th>Parameter</th><th class="n">Value</th><th>Unit</th><th style="min-width:220px">Source / reference</th><th>Confidence</th></tr></thead><tbody>`;
  cs.forEach(cid => { const c = CALCS[cid], r = R[cid];
    c.inputs.filter(d => d.k).forEach(d => { const m = r.meta[d.k] || {}; const cf = inputConf(cid, d, m.linked); const v = r.I[d.k];
      h += `<tr><td class="muted">${esc(c.no)}</td><td><i>${esc(d.sym || '')}</i></td><td>${esc(d.l)}</td><td class="n">${isNum(v) ? fmt(v) : esc(v)}</td><td>${esc(d.u || '')}</td>
        <td>${m.linked ? `<span class="small" style="color:var(--info)">${esc(inputSrc(cid, d, m))}</span>` : `<input data-csrc="${cid}|${d.k}" value="${esc(inputSrc(cid, d))}"${dis('edit')}>`}</td>
        <td>${m.linked ? '<span class="badge info">Linked</span>' : `<select data-cconf="${cid}|${d.k}"${dis('edit')}>${CONF.map(o => `<option${o === cf ? ' selected' : ''}>${o}</option>`).join('')}</select>`}</td></tr>`; }); });
  return h + '</tbody></table></div>';
}
function sensHTML(m){
  if (!m.sens || !m.sens.length) return '<p class="muted">Sensitivity is presented in the calculation outputs where relevant (see charts in section C).</p>';
  return m.sens.filter(s => calcApplies(s.calc) && R[s.calc]).map(s => {
    const ys = sensitivity(s.calc, s.key, s.vals, s.out.map(o => o[0]));
    const cur = R[s.calc].I[s.key];
    const chart = lineChart({xs: s.vals, series: s.out.map((o, j) => ({name: o[1], ys: ys.map(r => r[j])})), xl: s.xl, yl: s.yl, hl: s.hl ? s.hl(R) : null, vl: {x: cur, label: 'current'}, legend: true});
    return `<div class="grid2"><div>${chart}</div><div><table class="t"><thead><tr><th>${esc(s.xl)}</th>${s.out.map(o => `<th class="n">${esc(o[1])}</th>`).join('')}</tr></thead><tbody>${s.vals.map((v, i) => `<tr${Math.abs(v - cur) < 1e-9 ? ' class="hd"' : ''}><td>${fmt(v)}</td>${ys[i].map(y => `<td class="n">${fmt(y)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="small muted">Each point is a full re-run of ${esc(CALCS[s.calc].no)} with only ${esc(s.key)} varied; all other inputs as current.</p></div></div>`;
  }).join('');
}
function riskTable(rs){
  return `<div class="tw"><table class="t"><thead><tr><th>ID</th><th>Technical issue</th><th>→ Construction consequence</th><th>→ Cost consequence</th><th>→ Programme consequence</th><th class="c">L</th><th class="c">C</th><th class="c">Score</th><th>Mitigation</th><th>Owner</th></tr></thead><tbody>${rs.map(r => `<tr><td>${esc(r.id)}${r.auto ? ' <span class="badge info">auto</span>' : ''}</td><td><b>${esc(r.title)}</b><br><span class="small">${esc(r.chain[0] || '')}</span></td><td class="small">${esc(r.chain[1] || '')}</td><td class="small">${esc(r.chain[2] || '')}</td><td class="small">${esc(r.chain[3] || '')}</td><td class="c">${r.L}</td><td class="c">${r.C}</td><td class="c"><span class="badge ${r.level === 'High' ? 'fail' : r.level === 'Medium' ? 'warn' : 'na'}">${r.score}</span></td><td class="small">${esc(r.mit || '')}</td><td class="small">${esc(r.owner || '')}</td></tr>`).join('')}</tbody></table></div>`;
}
function criteriaConflict(){
  return `<h4 style="margin:10px 0 4px">Design criteria conflict — governing requirement</h4>` + editTable('criteria', [
    {k:'item', l:'Criterion', ro:true}, {k:'msma', l:'MSMA criterion', w:140}, {k:'jkr', l:'JKR criterion', w:120}, {k:'pbt', l:'PBT criterion', w:120}, {k:'client', l:'Client criterion', w:110},
    {k:'gov', l:'Governing requirement', w:150}, {k:'eng', l:'Engineer confirmation', t:'sel', o:['','Confirmed','Pending','Rejected']}], {perm:'edit', noDel:true}) + `<p class="small muted">Governing Requirement — <b>Engineer Confirmation</b> required where standards differ.</p>`;
}
