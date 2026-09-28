'use strict';
/* ==========================================================================
   CORE — utilities, state, calculation framework, storage, charts, zip
   ========================================================================== */
const APP_VERSION = '1.0.0';
const DEMO_FLAG = 'DEMONSTRATION DATA — NOT FOR DESIGN';

/* ---------- utilities ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isNum = v => typeof v === 'number' && isFinite(v);
function fmt(v, dp){
  if (v == null || v === '') return '—';
  if (typeof v !== 'number') return String(v);
  if (!isFinite(v)) return v > 0 ? '∞' : '—';
  if (dp == null){ const a = Math.abs(v); dp = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 4 : 5; }
  return v.toLocaleString('en-GB', {minimumFractionDigits: dp, maximumFractionDigits: dp});
}
const f0 = v => fmt(v, 0), f1 = v => fmt(v, 1), f2 = v => fmt(v, 2), f3 = v => fmt(v, 3);
const RM = v => 'RM ' + fmt(v, 0);
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sum = a => a.reduce((s, x) => s + (+x || 0), 0);
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const clone = o => JSON.parse(JSON.stringify(o));
const G = 9.81;
function lerpTable(tbl, x){ // tbl [[x,y],...] sorted
  if (x <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) if (x <= tbl[i][0]){ const [x0,y0] = tbl[i-1], [x1,y1] = tbl[i]; return y0 + (y1-y0)*(x-x0)/(x1-x0); }
  return tbl[tbl.length-1][1];
}
function bisect(fn, a, b, tol = 1e-6, n = 200){ // root of fn in [a,b]
  let fa = fn(a), fb = fn(b); if (fa * fb > 0) return null;
  for (let i = 0; i < n; i++){ const m = (a+b)/2, fm = fn(m); if (Math.abs(fm) < tol || (b-a)/2 < tol) return m; if (fa*fm < 0){ b = m; fb = fm; } else { a = m; fa = fm; } }
  return (a+b)/2;
}
function toDMS(dd, pos, neg){ const s = dd < 0 ? neg : pos; dd = Math.abs(dd); const d = Math.floor(dd), mf = (dd-d)*60, m = Math.floor(mf), sc = (mf-m)*60; return `${d}°${String(m).padStart(2,'0')}′${sc.toFixed(2).padStart(5,'0')}″ ${s}`; }

/* ---------- input confidence ---------- */
const CONF = ['Surveyed','Tested','Vendor Certified','Authority Data','Client Provided','Contractor Provided','Consultant Assumption','Estimated','Unknown'];
const CONF_CLS = {'Surveyed':'Surveyed','Tested':'Tested','Vendor Certified':'Vendor','Authority Data':'Authority','Client Provided':'Client','Contractor Provided':'Contractor','Consultant Assumption':'Assumption','Estimated':'Estimated','Unknown':'Unknown','Linked':'Linked'};
const CONF_ABBR = {'Surveyed':'S','Tested':'T','Vendor Certified':'V','Authority Data':'A','Client Provided':'C','Contractor Provided':'K','Consultant Assumption':'CA','Estimated':'E','Unknown':'?','Linked':'L'};
const CONF_SCORE = {'Surveyed':5,'Tested':5,'Vendor Certified':4,'Authority Data':5,'Client Provided':3,'Contractor Provided':2,'Consultant Assumption':2,'Estimated':1,'Unknown':0,'Linked':4};

/* ---------- warnings ---------- */
const WARN = {
  PRELIM:'PRELIMINARY CALCULATION', VENDOR:'VENDOR LOAD REQUIRED', SI:'SI REQUIRED',
  TOPO:'TOPOGRAPHICAL SURVEY REQUIRED', JPS:'JPS DATA REQUIRED', AUTH:'AUTHORITY CONFIRMATION REQUIRED',
  DETAIL:'DETAILED ANALYSIS REQUIRED', CLAUSE:'CLAUSE VERIFICATION REQUIRED', ENG:'ENGINEER CONFIRMATION REQUIRED'
};

/* ---------- roles ---------- */
const ROLES = {
  'Administrator':   {edit:true, rates:true, tender:true, check:true, approve:true, registers:true, admin:true},
  'PE / PEPC':       {edit:true, rates:true, tender:true, check:true, approve:true, registers:true},
  'Checker':         {edit:false, rates:false, tender:false, check:true, approve:false, registers:true},
  'Design Engineer': {edit:true, rates:false, tender:false, check:false, approve:false, registers:true},
  'Tender Engineer': {edit:true, rates:true, tender:true, check:false, approve:false, registers:true},
  'QS':              {edit:false, rates:true, tender:true, check:false, approve:false, registers:true},
  'Viewer':          {edit:false, rates:false, tender:false, check:false, approve:false, registers:false}
};
const can = p => !!(ROLES[P.role] || {})[p];

/* ---------- state ---------- */
let P = null;          // project
let R = {};            // calculation results (derived, never stored)
const STORE_KEY = 'cs_solar_platform_v1';

function blankProject(type, sample){
  return {
    app: 'CS-Solar-Tender-Platform', version: APP_VERSION, id: uid(), created: new Date().toISOString(),
    sample: !!sample, type: type || 'B', role: 'PE / PEPC', user: 'Engineer',
    info: {}, coords: [], inp: {}, conf: {}, src: {}, unlink: {}, tables: {}, rates: {}, rateMult: {},
    tender: [], docs: [], checklist: {}, reg: {assumptions:[], queries:[], drawings:[], reports:[], clarifications:[], risks:[], deliverables:[], techeval:[]},
    calcMeta: {}, audit: [], revisions: [{rev:'P0', date: today(), desc:'Project created', by:'Engineer', snapshot:null}],
    criteria: {}, site: {}, options: {}, ve: {}, authority: {}, weights: {}, review: {}, notes: {}
  };
}
function saveLocal(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(P)); return true; } catch(e){ return false; } }
function loadLocal(){ try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch(e){ return null; } }
function download(name, data, mime){
  const blob = data instanceof Blob ? data : new Blob([data], {type: mime || 'application/octet-stream'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); try { a.click(); } catch(e){} setTimeout(() => a.remove(), 800);
  if (typeof FRAMED !== 'undefined' && FRAMED && typeof modal === 'function'){
    modal('Download', `<p>If the download did not start (embedded pages such as Google Sites may block downloads), use this link:</p><p><a class="pri" href="${url}" download="${esc(name)}" target="_blank" rel="noopener" style="display:inline-block;padding:6px 12px;border-radius:4px;background:var(--ac);color:#fff;text-decoration:none">Download ${esc(name)}</a></p><p class="small muted">If that is also blocked, open the platform directly in its own browser tab.</p>`);
  } else setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function toCSV(head, rows){
  const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
  return [head.map(q).join(','), ...rows.map(r => r.map(q).join(','))].join('\r\n');
}
function audit(action, detail){ P.audit.unshift({t: new Date().toISOString(), role: P.role, user: P.user, action, detail}); if (P.audit.length > 800) P.audit.length = 800; }

/* ---------- calculation registry ---------- */
const CALCS = {}; const CALC_ORDER = [];
function defCalc(def){
  def.types = def.types || ['A','B'];
  def.inputs = def.inputs || [];
  def.codes = def.codes || [];
  def.assume = def.assume || [];
  def.criteria = def.criteria || [];
  CALCS[def.id] = def; CALC_ORDER.push(def.id);
  return def;
}
const calcApplies = id => CALCS[id] && CALCS[id].types.includes(P.type);

function inputDefault(def){ return typeof def.d === 'function' ? def.d(P) : def.d; }
function getInput(calcId, def){
  const st = P.inp[calcId] || {};
  const unl = (P.unlink[calcId] || {})[def.k];
  if (def.link && !unl){
    const [c, k] = def.link.split('.');
    if (R[c] && R[c].res && R[c].res[k] != null) return {v: R[c].res[k], linked: true, from: c, key: k};
  }
  let v = st[def.k]; if (v === undefined) v = inputDefault(def);
  return {v, linked: false};
}
function inputConf(calcId, def, linked){
  if (linked) return 'Linked';
  return ((P.conf[calcId] || {})[def.k]) || def.c || 'Consultant Assumption';
}
function inputSrc(calcId, def, gi){
  if (gi && gi.linked){ const c = CALCS[gi.from]; return `Linked: ${c ? c.no : gi.from} → ${gi.key}`; }
  return ((P.src[calcId] || {})[def.k]) || def.s || '';
}
function setInput(calcId, k, v){
  P.inp[calcId] = P.inp[calcId] || {};
  const old = P.inp[calcId][k];
  P.inp[calcId][k] = v;
  const m = P.calcMeta[calcId];
  audit('Input changed', `${(CALCS[calcId]||{}).no || calcId} · ${k}: ${old === undefined ? '(default)' : old} → ${v}`);
  if (m && m.issued && !m.modified){ m.modified = true; }
}

/* ---------- sheet (calculation step recorder) ---------- */
class Sheet {
  constructor(id){ this.id = id; this.steps = []; this.res = {}; this.resList = []; this.checks = []; this.warns = []; this.notes = []; this.qty = []; this.risks = []; this.prop = []; this.tender = []; this.tables = []; this.outstanding = []; }
  h(t){ this.steps.push({t:'h', title:t}); }
  txt(t){ this.steps.push({t:'x', text:t}); }
  v(sym, desc, formula, subst, val, unit, ref, dp){ this.steps.push({t:'e', sym, desc, formula, subst, val, unit, ref, dp}); return val; }
  tbl(title, head, rows, align){ const o = {t:'tb', title, head, rows, align}; this.steps.push(o); this.tables.push(o); }
  r(key, label, val, unit, dp){ this.res[key] = val; this.resList.push({key, label, val, unit, dp, step: this.steps.length - 1}); return val; }
  chk(o){
    // o: {label, val, lim, rel:'<='|'>=', unit, what, dem, fix, ref, dp, kind:'cap'}
    const rel = o.rel || '<=';
    const pass = rel === '<=' ? o.val <= o.lim + 1e-9 : o.val >= o.lim - 1e-9;
    const u = rel === '<=' ? (o.lim ? o.val / o.lim : 0) : (o.val ? o.lim / o.val : 99);
    let msg;
    const dp = o.dp == null ? 2 : o.dp;
    if (o.kind === 'cap'){ // val = capacity, lim = demand, rel >=
      const pct = Math.abs(1 - o.val / o.lim) * 100;
      msg = pass
        ? `PASS — Proposed ${o.what} of ${fmt(o.val,dp)} ${o.unit||''} exceeds the calculated ${o.dem} of ${fmt(o.lim,dp)} ${o.unit||''} by approximately ${fmt(pct,0)}% (utilisation ${fmt(u,2)}).`
        : `FAIL — Proposed ${o.what} is approximately ${fmt(pct,0)}% below the calculated ${o.dem} (${fmt(o.val,dp)} vs ${fmt(o.lim,dp)} ${o.unit||''}). ${o.fix || 'Design shall be revised.'}`;
    } else {
      msg = pass
        ? `PASS — ${o.label} = ${fmt(o.val,dp)} ${o.unit||''} ${rel === '<=' ? '≤' : '≥'} ${fmt(o.lim,dp)} ${o.unit||''} (utilisation ${fmt(u,2)}).`
        : `FAIL — ${o.label} = ${fmt(o.val,dp)} ${o.unit||''} does not satisfy the ${rel === '<=' ? 'maximum' : 'minimum'} of ${fmt(o.lim,dp)} ${o.unit||''} (utilisation ${fmt(u,2)}). ${o.fix || 'Design shall be revised.'}`;
    }
    const c = Object.assign({}, o, {rel, pass, util: u, msg});
    this.checks.push(c); this.steps.push({t:'c', chk: c});
    return pass;
  }
  w(tag, text){ if (!this.warns.find(x => x.tag === tag && x.text === text)) this.warns.push({tag, text}); }
  n(t){ this.notes.push(t); }
  p(t){ this.prop.push(t); }
  q(key, qty, basis){ if (isNum(qty) && qty > 0) this.qty.push({key, qty, basis: basis || ''}); }
  rk(o){ this.risks.push(o); }
  ti(t){ this.tender.push(t); }
  out(t){ this.outstanding.push(t); }
}

function statusOf(res){
  if (!res) return 'na';
  if (res.error) return 'fail';
  if (res.checks.some(c => !c.pass)) return 'fail';
  if (res.checks.length) return 'pass';
  return 'info';
}

function buildInputs(calcId){
  const c = CALCS[calcId]; const I = {}, meta = {};
  c.inputs.forEach(def => { if (!def.k) return; const gi = getInput(calcId, def); let v = gi.v; if (def.t !== 's' && def.t !== 'x' && def.t !== 'b') v = +v; I[def.k] = v; meta[def.k] = gi; });
  return {I, meta};
}
function runCalc(calcId, overrides){
  const c = CALCS[calcId];
  const {I, meta} = buildInputs(calcId);
  if (overrides) Object.assign(I, overrides);
  const S = new Sheet(calcId);
  try { c.run(I, S, P, R); }
  catch(e){ S.error = e.message; S.w('PRELIM', 'Calculation error: ' + e.message); console.error(calcId, e); }
  S.I = I; S.meta = meta;
  return S;
}
function runAll(){
  R = {};
  for (const id of CALC_ORDER){ if (!calcApplies(id)) continue; R[id] = runCalc(id); R[id].status = statusOf(R[id]); }
  if (typeof afterRun === 'function') afterRun();
}
/* sensitivity: vary one input, capture outputs */
function sensitivity(calcId, key, values, outKeys){
  return values.map(v => { const s = runCalc(calcId, {[key]: v}); return outKeys.map(k => s.res[k]); });
}

/* ---------- revision control ---------- */
function inputsHash(calcId){ const {I} = buildInputs(calcId); return JSON.stringify(I); }
function issueCalc(calcId, rev, desc){
  const m = P.calcMeta[calcId] = P.calcMeta[calcId] || {revs: []};
  m.revs = m.revs || [];
  m.revs.push({rev, date: today(), desc, by: P.user + ' (' + P.role + ')', hash: inputsHash(calcId), checked: m.checkedBy || '', status: R[calcId] ? R[calcId].status : ''});
  m.rev = rev; m.issued = true; m.modified = false; m.checkedBy = ''; m.approvedBy = '';
  audit('Calculation issued', `${CALCS[calcId].no} Rev ${rev} — ${desc}`);
}
function calcRev(calcId){ const m = P.calcMeta[calcId]; return m && m.rev ? m.rev : 'P0'; }
function calcModified(calcId){ const m = P.calcMeta[calcId]; if (!m || !m.issued) return false; const last = m.revs[m.revs.length-1]; return last && last.hash !== inputsHash(calcId); }

/* ---------- charts (SVG) ---------- */
const PAL = ['#D99058','#4B6378','#3E7D4F','#9E6035','#8A7FB0','#B0413E','#7A8B99'];
function niceTicks(min, max, n = 5){
  if (!isFinite(min) || !isFinite(max)) return [0,1];
  if (min === max){ max = min + 1; min = min - 1; }
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag, step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const t = []; for (let v = Math.floor(min/step)*step; v <= max + step*0.5; v += step) t.push(+v.toFixed(10));
  return t;
}
function lineChart(o){
  // o: {xs:[], series:[{name, ys:[], color, dash}], xl, yl, w, h, hl:{y,label}|[], vl:{x,label}, title}
  const W = o.w || 520, H = o.h || 250, m = {l:54, r:14, t: o.title ? 24 : 12, b:40};
  const ys = o.series.flatMap(s => s.ys).filter(isNum).concat((o.hl ? [].concat(o.hl) : []).map(h => h.y));
  const xt = niceTicks(Math.min(...o.xs), Math.max(...o.xs)); const yt = niceTicks(o.y0 != null ? Math.min(o.y0, ...ys) : Math.min(...ys), Math.max(...ys));
  const x0 = xt[0], x1 = xt[xt.length-1], y0 = yt[0], y1 = yt[yt.length-1];
  const X = x => m.l + (x - x0) / (x1 - x0 || 1) * (W - m.l - m.r), Y = y => H - m.b - (y - y0) / (y1 - y0 || 1) * (H - m.t - m.b);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Aptos, Arial, sans-serif">`;
  if (o.title) s += `<text x="${m.l}" y="14" style="font-size:11px;font-weight:700;fill:#303030">${esc(o.title)}</text>`;
  yt.forEach(v => s += `<line class="gl" x1="${m.l}" x2="${W-m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eee"/><text x="${m.l-5}" y="${Y(v)+3}" text-anchor="end" font-size="10" fill="#555">${fmt(v, Math.abs(y1-y0) < 5 ? 2 : Math.abs(y1-y0) < 50 ? 1 : 0)}</text>`);
  xt.forEach(v => s += `<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H-m.b}" stroke="#f3f3f3"/><text x="${X(v)}" y="${H-m.b+13}" text-anchor="middle" font-size="10" fill="#555">${fmt(v, Math.abs(x1-x0) < 5 ? 2 : Math.abs(x1-x0) < 50 ? 1 : 0)}</text>`);
  s += `<line class="ax" x1="${m.l}" x2="${W-m.r}" y1="${H-m.b}" y2="${H-m.b}" stroke="#999"/><line class="ax" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H-m.b}" stroke="#999"/>`;
  [].concat(o.hl || []).forEach(h => { s += `<line x1="${m.l}" x2="${W-m.r}" y1="${Y(h.y)}" y2="${Y(h.y)}" stroke="#B0413E" stroke-dasharray="5 3"/><text x="${W-m.r-3}" y="${Y(h.y)-4}" text-anchor="end" font-size="10" fill="#B0413E">${esc(h.label||'')}</text>`; });
  [].concat(o.vl || []).forEach(v => { s += `<line x1="${X(v.x)}" x2="${X(v.x)}" y1="${m.t}" y2="${H-m.b}" stroke="#4B6378" stroke-dasharray="3 3"/><text x="${X(v.x)+3}" y="${m.t+10}" font-size="10" fill="#4B6378">${esc(v.label||'')}</text>`; });
  o.series.forEach((sr, i) => {
    const col = sr.color || PAL[i % PAL.length]; const pts = o.xs.map((x, j) => isNum(sr.ys[j]) ? `${X(x).toFixed(1)},${Y(sr.ys[j]).toFixed(1)}` : null).filter(Boolean);
    s += `<polyline fill="none" stroke="${col}" stroke-width="2" ${sr.dash ? 'stroke-dasharray="6 4"' : ''} points="${pts.join(' ')}"/>`;
    o.xs.forEach((x, j) => { if (isNum(sr.ys[j])) s += `<circle cx="${X(x)}" cy="${Y(sr.ys[j])}" r="2.4" fill="${col}"/>`; });
  });
  if (o.series.length > 1 || o.legend){ let lx = m.l + 6; o.series.forEach((sr, i) => { const col = sr.color || PAL[i % PAL.length]; s += `<rect x="${lx}" y="${m.t+4}" width="10" height="3" fill="${col}"/><text x="${lx+14}" y="${m.t+8}" font-size="10" fill="#444">${esc(sr.name)}</text>`; lx += 24 + sr.name.length * 5.4; }); }
  s += `<text x="${(m.l + W - m.r)/2}" y="${H-6}" text-anchor="middle" font-size="10.5" fill="#303030">${esc(o.xl||'')}</text>`;
  s += `<text transform="translate(12 ${(m.t + H - m.b)/2}) rotate(-90)" text-anchor="middle" font-size="10.5" fill="#303030">${esc(o.yl||'')}</text>`;
  return s + '</svg>';
}
function barChart(o){
  // horizontal bars o: {labels, values, unit, w, title, colors, ref}
  const W = o.w || 520, bh = 18, gap = 6, lw = o.lw || 150, H = (o.title ? 22 : 6) + o.labels.length * (bh + gap) + 24;
  const mn = Math.min(0, ...o.values), mx = Math.max(0, ...o.values, o.ref || 0) || 1; const X = v => lw + (v - mn) / (mx - mn) * (W - lw - 70);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Aptos, Arial, sans-serif">`;
  if (o.title) s += `<text x="4" y="14" style="font-size:11px;font-weight:700;fill:#303030">${esc(o.title)}</text>`;
  const t0 = o.title ? 22 : 6;
  o.labels.forEach((l, i) => { const y = t0 + i * (bh + gap), v = o.values[i], col = (o.colors && o.colors[i]) || PAL[0];
    s += `<text x="${lw-6}" y="${y+bh*0.7}" text-anchor="end" font-size="10.5" fill="#303030">${esc(l)}</text>`;
    s += `<rect x="${Math.min(X(0), X(v))}" y="${y}" width="${Math.abs(X(v)-X(0))}" height="${bh}" fill="${col}" rx="2"/>`;
    s += `<text x="${Math.max(X(0), X(v)) + 4}" y="${y+bh*0.7}" font-size="10" fill="#444">${fmt(v, o.dp == null ? 1 : o.dp)} ${esc(o.unit||'')}</text>`; });
  s += `<line x1="${X(0)}" x2="${X(0)}" y1="${t0-2}" y2="${H-20}" stroke="#999"/>`;
  if (o.ref != null) s += `<line x1="${X(o.ref)}" x2="${X(o.ref)}" y1="${t0-2}" y2="${H-20}" stroke="#B0413E" stroke-dasharray="4 3"/><text x="${X(o.ref)}" y="${H-8}" text-anchor="middle" font-size="10" fill="#B0413E">${esc(o.refLabel||'limit')}</text>`;
  return s + '</svg>';
}
function heatmap(o){
  // o: {grid:[[v]], w, cell, colors:fn(v)->color, title, legend:[[color,label]]}
  const rows = o.grid.length, cols = o.grid[0].length, W = o.w || 360; const c = (W - 10) / cols, H = rows * c + (o.title ? 22 : 4) + (o.legend ? 22 : 4);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Aptos, Arial, sans-serif">`;
  const t0 = o.title ? 20 : 2; if (o.title) s += `<text x="4" y="13" style="font-size:11px;font-weight:700;fill:#303030">${esc(o.title)}</text>`;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++){ const v = o.grid[i][j]; s += `<rect x="${5 + j*c}" y="${t0 + i*c}" width="${c+0.4}" height="${c+0.4}" fill="${o.colors(v)}"/>`; }
  s += `<rect x="5" y="${t0}" width="${cols*c}" height="${rows*c}" fill="none" stroke="#999"/>`;
  s += `<text x="${W-14}" y="${t0+14}" font-size="11" font-weight="700" fill="#303030" text-anchor="middle">N</text><path d="M${W-14} ${t0+16} l-4 10 l4 -3 l4 3z" fill="#303030"/>`;
  if (o.legend){ let lx = 5; o.legend.forEach(([col, lab]) => { s += `<rect x="${lx}" y="${H-15}" width="10" height="10" fill="${col}" stroke="#bbb"/><text x="${lx+13}" y="${H-6}" font-size="9.5" fill="#444">${esc(lab)}</text>`; lx += 20 + lab.length*5; }); }
  return s + '</svg>';
}
function rampColor(t){ // 0..1 white->orange->dark
  t = clamp(t, 0, 1); const a = [250,250,248], b = [217,144,88], c = [110,64,32];
  const m = t < 0.6 ? [a, b, t/0.6] : [b, c, (t-0.6)/0.4];
  const col = m[0].map((v, i) => Math.round(v + (m[1][i]-v)*m[2])); return `rgb(${col.join(',')})`;
}

/* ---------- CRC32 + ZIP (store) for .docx ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files){ // files: [{name, data: string|Uint8Array}]
  const enc = new TextEncoder(); const parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getFullYear()-1980) << 9) | ((d.getMonth()+1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  for (const f of files){
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, a) => s + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
