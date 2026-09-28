'use strict';
/* ==========================================================================
   ENGINES — project factory, QTO, BOQ, cost, sensitivity, tender
   reconciliation & scope gap, risk engine, registers aggregation
   ========================================================================== */

function newProject(type, sample){
  const p = blankProject(type, sample);
  p.info = sampleInfo(type);
  if (!sample){ Object.keys(p.info).forEach(k => { if (!['projType','stage'].includes(k)) p.info[k] = ''; }); p.info.projType = type; p.info.name = 'New Project'; p.info.mwp = 0; p.info.mwac = 0; p.info.bessMW = 0; p.info.bessMWh = 0; p.info.landArea = 0; }
  p.coords = sample ? sampleCoords(type) : [];
  p.tables = {
    bh: sample ? sampleBoreholes() : [],
    sc: sample ? sampleSubcatchments() : [],
    platforms: samplePlatforms(type),
    lots: sample ? [{lot:'PT 0000', title:'HSD (demo)', area:48.2, status:'Verified'},{lot:'PT 0001', title:'HSD (demo)', area:51.6, status:'Verified'},{lot:'PT 0002', title:'HSD (demo)', area:44.9, status:'Pending'},{lot:'PT 0003', title:'HSD (demo)', area:40.3, status:'Pending'}] : [],
    dem: null,
  };
  p.tender = [];
  p.docs = sample ? sampleDocs(type) : [];
  p.standards = clone(STANDARDS_DEFAULT);
  p.costCfg = {prelimPct: 8, designPct: 3, contPct: 10};
  p.site = {};
  SITE_ITEMS.forEach(s => p.site[s[0]] = {rating: sample ? s[3] : '', note: sample ? s[4] : ''});
  p.criteria = clone(CRITERIA_DEFAULT);
  p.reg.drawings = DRAWING_ROWS.filter(r => !r[3] || r[3] === type).map(r => ({no:r[0], title:r[1], disc:r[2], rev:'-', status:'Required', resp:'C&S consultant'}));
  p.reg.deliverables = DELIV_ROWS.map(r => ({title:r[0], stage:r[1], status:'Not started', due:'', resp:'C&S consultant'}));
  p.reg.reports = [{no:'RPT-CS-001', title:'C&S Tender Engineering Report', rev:'P0', date: today(), status:'Draft', by:'Engineer'}];
  p.reg.techeval = sample ? [
    {bidder:'Bidder A', tech:0, comp:0, score:{method:4, programme:3, experience:4, compliance:3, qa:4}},
    {bidder:'Bidder B', tech:0, comp:0, score:{method:3, programme:4, experience:3, compliance:4, qa:3}},
    {bidder:'Bidder C', tech:0, comp:0, score:{method:2, programme:3, experience:4, compliance:2, qa:3}},
  ] : [];
  p.reg.queries = sample ? [{id:'EQ-001', to:'Client', subject:'Official flood level and IDF station coefficients', raised:today(), status:'Open', response:''},{id:'EQ-002', to:'Tracker vendor', subject:'Pile loads, section, slope tolerances and wind-tunnel coefficients', raised:today(), status:'Open', response:''}] : [];
  p.reg.assumptions = [];
  p.reg.risks = [];
  p.reg.clarifications = [];
  p.authority = {};
  AUTH_ROWS.forEach((r, i) => p.authority['A' + i] = {status: sample ? (i < 3 ? 'In preparation' : 'Not started') : 'Not started', resp: 'C&S consultant'});
  p.options = {weights: {capacity:0, soil:0, length:0, construct:0, rate:0, refusal:0, testing:0, corrosion:0, cost:0, equip:0}, scores: clone(PILE_OPT_DEFAULT)};
  p.ve = clone(VE_DEFAULT);
  p.constructability = {};
  p.review = {};
  return p;
}

/* ---------- site assessment items [id, category, constraint, default rating, note] ---------- */
const SITE_ITEMS = [
 ['S1','Access','Public road access & junction','Low','Access from state road via 650 m new access road (demo).'],
 ['S2','Topography','Terrain & slopes','Moderate','Two localised knolls; majority < 5°.'],
 ['S3','Hydrology','Flood exposure','Moderate','Low-lying NE corner near tributary; flood level unconfirmed.'],
 ['S4','Hydrology','Watercourses & reserves','Moderate','Tributary on NE boundary — JPS reserve.'],
 ['S5','Geotechnical','Soft soils','Moderate','Soft clay in upper 2.5 m at BH-02, BH-04.'],
 ['S6','Geotechnical','Shallow rock / hard layer','High','Weathered granite from 4.5 m at BH-05; 6.5 m at BH-03.'],
 ['S7','Geotechnical','Aggressive ground','Moderate','Low pH / resistivity at BH-02, BH-04.'],
 ['S8','Utilities','Overhead lines / existing services','Moderate','TNB 33 kV line crossing west boundary (demo).'],
 ['S9','Environment','Sensitive receptors','Low','Kampung ~ 1.2 km south (demo).'],
 ['S10','Land','Title / encumbrances','Moderate','Two lots pending title verification.'],
];
const RATING_W = {Low:1, Moderate:2, High:3, '':0};

/* ---------- design criteria conflict (MSMA / JKR / PBT / Client) ---------- */
const CRITERIA_DEFAULT = [
 {id:'DC1', item:'Minor drainage ARI', msma:'Per MSMA table by land use — VERIFY', jkr:'Road drainage per JKR guideline — VERIFY', pbt:'PBT to confirm', client:'10-yr', gov:'', eng:''},
 {id:'DC2', item:'Major system / flood ARI', msma:'100-yr (typical) — VERIFY', jkr:'—', pbt:'PBT to confirm', client:'100-yr', gov:'', eng:''},
 {id:'DC3', item:'Detention criterion', msma:'Post ≤ pre-development peak', jkr:'—', pbt:'May require OSD', client:'No net increase in peak', gov:'', eng:''},
 {id:'DC4', item:'Freeboard to substation platform', msma:'—', jkr:'—', pbt:'—', client:'0.5 m above DFL', gov:'', eng:''},
 {id:'DC5', item:'Culvert design ARI', msma:'VERIFY', jkr:'VERIFY (road class)', pbt:'—', client:'50-yr', gov:'', eng:''},
 {id:'DC6', item:'Permanent slope FS', msma:'—', jkr:'JKR slope guideline — VERIFY', pbt:'PBT earthworks by-law', client:'1.4', gov:'', eng:''},
 {id:'DC7', item:'Internal road width', msma:'—', jkr:'ATJ 8/86 — VERIFY', pbt:'Fire access width (BOMBA)', client:'4.0 m', gov:'', eng:''},
];

/* ---------- pile option comparison defaults (1–5, user-editable) ---------- */
const PILE_OPTS = ['Driven steel','Screw pile','Helical pile','Spun pile','Micropile','Bored pile'];
const PILE_CRIT = [['capacity','Capacity'],['soil','Soil compatibility'],['length','Pile length'],['construct','Constructability'],['rate','Installation rate'],['refusal','Refusal risk (5 = low risk)'],['testing','Testing'],['corrosion','Corrosion'],['cost','Cost (5 = lowest)'],['equip','Equipment availability']];
const PILE_OPT_DEFAULT = {
 'Driven steel': {capacity:4, soil:3, length:4, construct:5, rate:5, refusal:2, testing:4, corrosion:3, cost:5, equip:5},
 'Screw pile':   {capacity:3, soil:4, length:4, construct:4, rate:4, refusal:3, testing:4, corrosion:3, cost:4, equip:4},
 'Helical pile': {capacity:3, soil:4, length:3, construct:4, rate:3, refusal:3, testing:4, corrosion:3, cost:3, equip:3},
 'Spun pile':    {capacity:5, soil:3, length:3, construct:3, rate:2, refusal:2, testing:3, corrosion:5, cost:2, equip:4},
 'Micropile':    {capacity:4, soil:5, length:3, construct:2, rate:1, refusal:5, testing:3, corrosion:4, cost:1, equip:2},
 'Bored pile':   {capacity:5, soil:5, length:2, construct:2, rate:1, refusal:5, testing:3, corrosion:5, cost:1, equip:3},
};

/* ---------- value engineering options (cost via BOQ rates) ---------- */
const VE_DEFAULT = [
 {id:'VE1', title:'Internal roads: granular in lieu of bituminous main access', base:[['RD_AC',()=>QTO.q('RD_AC')]], alt:[['RD_BASE',()=>QTO.q('RD_AC')*0.05]], note:'Reduces capex; higher maintenance. Client acceptance required.', accept:''},
 {id:'VE2', title:'Earth drains in lieu of concrete-lined collector drains', base:[['DR_CONC',()=>QTO.q('DR_CONC')]], alt:[['DR_EARTH',()=>QTO.q('DR_CONC')],['EW_TURF',()=>QTO.q('DR_CONC')*4]], note:'Only where velocity ≤ 1.0 m/s (check CS-HYD-005).', accept:''},
 {id:'VE3', title:'Reduce PV pile embedment by 0.3 m (subject to pull-out tests)', base:[['PL_PV',()=>QTO.q('PL_PV')]], alt:[['PL_PV',()=>QTO.q('PL_PV')*0.93]], note:'Rate reduction ~7% assumed proportional to steel length; test-verified.', accept:''},
 {id:'VE4', title:'Lower platform raise by reducing freeboard 0.2 m (authority dependent)', base:[['EW_IMPORT',()=>QTO.q('EW_IMPORT')]], alt:[['EW_IMPORT',()=>QTO.q('EW_IMPORT')*0.7]], note:'Requires JPS / client acceptance.', accept:''},
];
function veCost(v, which){ return sum(v[which].map(([k, f]) => { const q = typeof f === 'function' ? f() : f; return q * rateOf(k); })); }

/* ======================================================================
   QTO & BOQ
   ====================================================================== */
const QTO = {items: {}, q(k){ return this.items[k] ? this.items[k].qty : 0; }};
const BOQ_FIXED = [['AU_SUB', 1, 'Lump sum'], ['TEST_MAT', 1, 'Lump sum']];
function rateOf(k){ const lib = BOQ_LIB[k]; const base = P.rates[k] != null ? +P.rates[k] : lib.rate; return base * (1 + ((P.rateMult || {})[lib.grp] || 0) / 100); }
function baseRate(k){ return P.rates[k] != null ? +P.rates[k] : BOQ_LIB[k].rate; }
function calcConfidence(calcId){
  const r = R[calcId]; if (!r || !r.meta) return 'Low';
  const c = CALCS[calcId]; const sc = c.inputs.filter(d => d.k).map(d => CONF_SCORE[inputConf(calcId, d, r.meta[d.k] && r.meta[d.k].linked)] || 0);
  const a = sc.length ? sum(sc) / sc.length : 0; return a >= 3.5 ? 'High' : a >= 2.2 ? 'Medium' : 'Low';
}
function buildQTO(){
  QTO.items = {};
  Object.keys(R).forEach(id => { const r = R[id]; if (!r || !r.qty) return;
    r.qty.forEach(q => { const it = QTO.items[q.key] = QTO.items[q.key] || {key:q.key, qty:0, src:[]}; it.qty += q.qty; it.src.push({calc:id, qty:q.qty, basis:q.basis}); }); });
  BOQ_FIXED.forEach(([k, q, b]) => { if (!QTO.items[k]) QTO.items[k] = {key:k, qty:q, src:[{calc:null, qty:q, basis:b}]}; });
}
const BILL_DWG = {'1':'C-001','2':'C-101','3':'C-300/301','4':'C-201/202/203/204','5':'C-250','6':'S-400/401/402/403','7':'C-500/501','8':'C-600/601/602','9':'S-410','10':'S-700/701, C-702','11':'—','12':'—'};
function boqRows(){
  return Object.values(QTO.items).map(it => { const lib = BOQ_LIB[it.key]; const rate = rateOf(it.key);
    const calcs = [...new Set(it.src.filter(s => s.calc).map(s => CALCS[s.calc].no))];
    const confs = it.src.filter(s => s.calc).map(s => calcConfidence(s.calc));
    const conf = !confs.length ? 'Medium' : confs.includes('Low') ? 'Low' : confs.includes('Medium') ? 'Medium' : 'High';
    return {key: it.key, bill: lib.bill, desc: lib.desc, unit: lib.unit, qty: it.qty, rate, amount: it.qty * rate, calcs: calcs.join(', ') || '—', dwg: BILL_DWG[lib.bill.split(' ')[0]] || '—', basis: it.src.map(s => s.basis).filter(Boolean).join('; '), conf, grp: lib.grp, remarks: (P.boqRemarks || {})[it.key] || ''};
  }).sort((a, b) => { const ba = parseInt(a.bill), bb = parseInt(b.bill); return ba - bb || BOQ_ROWS.findIndex(r => r[0] === a.key) - BOQ_ROWS.findIndex(r => r[0] === b.key); });
}
function costSummary(rows){
  rows = rows || boqRows(); const bills = {};
  rows.forEach(r => bills[r.bill] = (bills[r.bill] || 0) + r.amount);
  const direct = sum(Object.values(bills)), cc = P.costCfg || {prelimPct:8, designPct:3, contPct:10};
  const prelim = direct * cc.prelimPct / 100, design = direct * cc.designPct / 100, cont = (direct + prelim + design) * cc.contPct / 100;
  return {bills, direct, prelim, design, cont, total: direct + prelim + design + cont};
}
function sensitivityTornado(pct){
  const save = clone(P.rateMult || {}); const base = costSummary(boqRows()).total; const out = [];
  Object.keys(SENS_GROUPS).forEach(g => { P.rateMult = Object.assign({}, save, {[g]: (save[g] || 0) + pct}); const hi = costSummary(boqRows()).total; P.rateMult = Object.assign({}, save, {[g]: (save[g] || 0) - pct}); const lo = costSummary(boqRows()).total; out.push({g, label: SENS_GROUPS[g], lo: lo - base, hi: hi - base}); });
  P.rateMult = save; return {base, out};
}

/* ======================================================================
   TENDER RECONCILIATION & SCOPE GAP
   ====================================================================== */
const TENDER = {rows: [], gaps: [], issues: []};
function buildTender(){
  const req = {}; boqRows().forEach(r => req[r.key] = r);
  const tk = {}; (P.tender || []).forEach(t => { const x = tk[t.key] = tk[t.key] || {lines:[], qty:0, amt:0, flags:new Set(), scope:[]}; x.lines.push(t); x.qty += +t.qty || 0; x.amt += (+t.qty || 0) * (+t.rate || 0); if (t.flag) x.flags.add(t.flag); if (t.scope) x.scope.push(t.scope); });
  const keys = [...new Set([...Object.keys(req), ...Object.keys(tk)])];
  TENDER.rows = keys.map(k => { const r = req[k], t = tk[k], lib = BOQ_LIB[k] || {desc:k, unit:''};
    const rq = r ? r.qty : 0, tq = t ? t.qty : 0, diff = tq - rq, trate = t && t.qty ? t.amt / t.qty : 0, erate = rateOf(k);
    const issues = [];
    if (rq > 0 && (!t || tq === 0)) issues.push(t && t.flags.has('Excluded') ? 'Scope exclusion' : 'Omitted item');
    if (t && t.flags.has('Excluded') && !issues.includes('Scope exclusion')) issues.push('Scope exclusion');
    if (rq > 0 && tq > 0 && diff / rq < -0.10) issues.push('Under-quantity');
    if (rq > 0 && tq > 0 && diff / rq > 0.10) issues.push('Over-quantity');
    if (!r && t && tq > 0) issues.push('Not required by engineering');
    if (t && (t.flags.has('TBC') || t.scope.some(s => /TBC|TBA|to be confirmed/i.test(s)))) issues.push('Unclear specification');
    if (t && t.flags.has('Provisional')) issues.push('Provisional item');
    if (t && t.lines.length > 1) issues.push('Duplication');
    const reqAmt = rq * erate, tAmt = t ? t.amt : 0;
    return {key:k, desc: lib.desc, unit: lib.unit, rq, tq, diff, rscope: r ? (r.calcs !== '—' ? 'Req. by ' + r.calcs : 'Required') : '—', tscope: t ? t.scope.join('; ') : '—', erate, trate, reqAmt, tAmt, variance: tAmt - reqAmt, issues};
  }).sort((a, b) => (BOQ_ROWS.findIndex(r => r[0] === a.key)) - (BOQ_ROWS.findIndex(r => r[0] === b.key)));
  TENDER.gaps = SCOPE_AREAS.filter(s => !s[3] || s[3] === P.type).map(([id, name, keys]) => { const reqd = keys.some(k => req[k]); const inT = keys.some(k => tk[k] && tk[k].qty > 0 && !tk[k].flags.has('Excluded')); return {id, name, keys, required: reqd, priced: inT, gap: reqd && !inT, partial: reqd && inT && keys.some(k => req[k] && !(tk[k] && tk[k].qty > 0))}; }).filter(g => g.gap || g.partial);
  TENDER.issues = TENDER.rows.filter(r => r.issues.length);
  TENDER.totReq = sum(TENDER.rows.map(r => r.reqAmt)); TENDER.totT = sum(TENDER.rows.map(r => r.tAmt));
}

/* ======================================================================
   RISK ENGINE
   ====================================================================== */
let RISKS = [];
function buildRisks(){
  RISKS = [];
  RISK_LIB.forEach(t => { if (t.types && !t.types.includes(P.type)) return; let on = false; try { on = !!t.cond(R, P); } catch(e){ on = false; }
    if (on) RISKS.push({id:t.id, mod:t.mod, title:t.t, chain:t.chain, L:t.L, C:t.C, mit:t.mit, owner:t.owner, auto:true, status:(P.review['risk_' + t.id] || 'Open')}); });
  (P.reg.risks || []).forEach((r, i) => RISKS.push(Object.assign({auto:false, idx:i}, r, {L:+r.L||1, C:+r.C||1, chain:[r.issue, r.cons, r.cost, r.prog]})));
  RISKS.forEach(r => { r.score = r.L * r.C; r.level = r.score >= 15 ? 'High' : r.score >= 8 ? 'Medium' : 'Low'; });
  RISKS.sort((a, b) => b.score - a.score);
}

/* ======================================================================
   aggregations for registers / missing information
   ====================================================================== */
function allWarnings(){
  const out = []; Object.keys(R).forEach(id => (R[id].warns || []).forEach(w => out.push(Object.assign({calc:id}, w)))); return out;
}
function autoAssumptions(){
  const out = [];
  Object.keys(R).forEach(id => { const c = CALCS[id], r = R[id];
    c.assume.forEach(a => out.push({src: c.no, text: a, type: 'Method'}));
    c.inputs.forEach(d => { if (!d.k) return; const m = r.meta && r.meta[d.k]; if (m && m.linked) return; const cf = inputConf(id, d, false);
      if (['Consultant Assumption','Estimated','Unknown'].includes(cf)) out.push({src: c.no, text: `${d.l}${d.sym ? ' (' + d.sym + ')' : ''} = ${typeof r.I[d.k] === 'number' ? fmt(r.I[d.k]) : r.I[d.k]} ${d.u || ''}${inputSrc(id, d) ? ' — ' + inputSrc(id, d) : ''}`, type: cf}); }); });
  return out;
}
function autoClarifications(){
  const out = []; let n = 1;
  TENDER.gaps.forEach(g => out.push({id:'TC-' + String(n++).padStart(3, '0'), ref: g.name, q: `Tender does not ${g.gap ? 'include' : 'fully include'} ${g.name.toLowerCase()} scope (${g.keys.join(', ')}). Bidder to confirm inclusion and price.`, cat:'Scope gap'}));
  TENDER.issues.forEach(r => r.issues.forEach(i => { if (i === 'Not required by engineering') return;
    const txt = {'Omitted item':`Item "${r.desc}" required (${fmt(r.rq,0)} ${r.unit}) is not priced. Confirm inclusion.`, 'Scope exclusion':`"${r.desc}" is excluded. Confirm basis of exclusion and interface responsibility.`, 'Under-quantity':`Tender quantity for "${r.desc}" (${fmt(r.tq,0)} ${r.unit}) is ${fmt(-r.diff / r.rq * 100, 0)}% below engineering estimate (${fmt(r.rq,0)}). Confirm measurement basis.`, 'Over-quantity':`Tender quantity for "${r.desc}" exceeds engineering estimate by ${fmt(r.diff / r.rq * 100, 0)}%. Provide measurement basis.`, 'Unclear specification':`Specification for "${r.desc}" unclear (${r.tscope}). Confirm size / specification.`, 'Provisional item':`"${r.desc}" priced as provisional. Confirm re-measurement basis and rate validity.`, 'Duplication':`"${r.desc}" appears in more than one line. Confirm no double counting.`}[i];
    if (txt) out.push({id:'TC-' + String(n++).padStart(3, '0'), ref: r.key, q: txt, cat: i}); }));
  return out;
}
function missingInfo(){
  const tags = {}; allWarnings().forEach(w => { if (['SI','TOPO','JPS','VENDOR','AUTH'].includes(w.tag)){ (tags[w.tag] = tags[w.tag] || []).push(w); } });
  const docs = (P.docs || []).filter(d => d.status !== 'Received');
  return {tags, docs};
}
function moduleStatus(m){
  const cs = (m.calcs || []).filter(calcApplies); if (!cs.length) return '';
  const st = cs.map(c => R[c] && R[c].status); return st.includes('fail') ? 'fail' : st.includes('pass') ? 'pass' : 'warn';
}
function afterRun(){ buildQTO(); buildTender(); buildRisks(); }

/* sample contractor quotation derived from engineering quantities with deliberate deviations (DEMONSTRATION) */
function genSampleTender(){
  const rows = boqRows(); const out = []; let k = 0;
  const OMIT = ['EW_HAUL','PL_TEST_L','AS_BUILT','CT_TAPE','BS_OWS','DR_SPILL','ES_CHECK','SI_LAB','EW_TURF','RD_GEOTEX','CT_DUCT','TW_LAYDOWN'];
  const FACT = {EW_IMPORT:0.58, CN_G30:0.78, RF_Y:0.74, DR_POND_EXC:0.66, FN_FENCE:1.16, EW_STRIP:1.25, PL_TEST_T:0.5, RD_SUBBASE:0.86, DR_PIPE:0.75};
  rows.forEach(r => { k++;
    if (OMIT.includes(r.key)) return;
    const jit = 1 + (((k * 37) % 11) - 5) / 100, rj = 1 + (((k * 53) % 13) - 6) / 100;
    const q = r.qty * (FACT[r.key] || jit), rate = +(r.rate * rj).toFixed(2);
    const unitQ = ['no.','no','lot','month','t'].includes(r.unit) ? Math.max(1, Math.round(q)) : Math.round(q);
    if (r.key === 'AU_SUB'){ out.push({id:uid(), key:r.key, qty:0, rate:0, scope:'Authority submissions — EXCLUDED by contractor', flag:'Excluded'}); return; }
    if (r.key === 'EW_CUT'){ out.push({id:uid(), key:r.key, qty:Math.round(q*0.7), rate, scope:'Cut to fill (bulk)', flag:''}, {id:uid(), key:r.key, qty:Math.round(q*0.3), rate, scope:'Cut (platforms) — also included in bulk', flag:''}); return; }
    const flag = r.key === 'DR_CONC' ? 'TBC' : ['SI_BH','PL_PREDRILL'].includes(r.key) ? 'Provisional' : '';
    out.push({id:uid(), key:r.key, qty:unitQ, rate, scope: r.key === 'DR_CONC' ? 'Concrete drain — size TBC' : r.desc, flag});
  });
  return out;
}
