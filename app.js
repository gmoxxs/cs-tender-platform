'use strict';
/* ==========================================================================
   APP — routing, rendering, events, actions, initialisation
   ========================================================================== */
function render(keepScroll){
  const y = window.scrollY;
  const m = MOD[ROUTE] && modApplies(MOD[ROUTE]) ? MOD[ROUTE] : MOD.m1; ROUTE = m.id;
  renderTop(); renderNav();
  let h;
  try { h = m.tech ? renderTech(m) : (PAGES[m.kind] ? PAGES[m.kind](m) : '<p>Not implemented</p>'); }
  catch(e){ console.error(e); h = `<div class="wbox"><b>Render error</b> — ${esc(e.message)}</div>`; }
  $('#main').innerHTML = h;
  document.title = `${m.no}. ${m.name} — C&S Tender Engineering Platform`;
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}
function commit(msg){ runAll(); saveLocal(); render(true); if (msg) toast(msg); }


/* ---------- in-page dialogs (browser confirm/prompt are blocked in embedded / sandboxed frames) ---------- */
const FRAMED = (() => { try { return window.self !== window.top; } catch(e){ return true; } })();
let _dlg = null;
function askConfirm(msg, onYes, onNo){ _dlg = {yes: onYes, no: onNo}; modal('Please confirm', `<p>${esc(msg)}</p><div class="row"><button class="pri" data-act="dlgyes">Yes, proceed</button><button data-act="dlgno">Cancel</button></div>`); }
function askText(title, fields, onOk){ _dlg = {ok: onOk, fields}; modal(title, fields.map((f, i) => `<div style="margin-bottom:8px"><label class="small muted">${esc(f.l)}</label><input id="dlgf${i}" value="${esc(f.v || '')}"></div>`).join('') + `<div class="row"><button class="pri" data-act="dlgok">OK</button><button data-act="dlgno">Cancel</button></div>`); }
function doPrint(){
  if (!FRAMED){ window.print(); return; }
  const css = document.getElementById('appcss').textContent;
  const w = window.open('', '_blank');
  if (!w){ modal('Print', '<p>This page is embedded (e.g. Google Sites) and the browser blocked the print window. Use <b>Download HTML</b> and print that file, or open the platform in its own tab.</p>'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(P.info.name)} — Report</title><style>${css}</style></head><body style="background:#fff">${reportHTML(P.repOpt)}</body></html>`); w.document.close(); setTimeout(() => { try { w.print(); } catch(e){} }, 600);
}
window.addEventListener('error', e => { const m = document.getElementById('main'); if (m && !m.querySelector('.fatal')) m.insertAdjacentHTML('afterbegin', `<div class="wbox fatal"><b>Script error</b> — ${esc(e.message)} (line ${e.lineno}). Please send this message to the developer.</div>`); });

/* ---------- events ---------- */
function parseVal(el){ if (el.dataset.bool) return el.checked; const v = el.value; if (el.dataset.num || el.classList.contains('num')){ const n = parseFloat(v); return isFinite(n) ? n : v === '' ? '' : v; } if (v === 'true') return true; if (v === 'false') return false; return v; }
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.cin){ const [cid, k] = el.dataset.cin.split('|'); const d = CALCS[cid].inputs.find(x => x.k === k); let v = el.value; if (!d.t || d.t === 'n'){ v = parseFloat(v); if (!isFinite(v)){ toast('Invalid number'); render(true); return; } } setInput(cid, k, v); commit(); return; }
  if (el.dataset.cconf){ const [cid, k] = el.dataset.cconf.split('|'); (P.conf[cid] = P.conf[cid] || {})[k] = el.value; audit('Confidence changed', `${CALCS[cid].no} · ${k} → ${el.value}`); commit(); return; }
  if (el.dataset.csrc){ const [cid, k] = el.dataset.csrc.split('|'); (P.src[cid] = P.src[cid] || {})[k] = el.value; audit('Source changed', `${CALCS[cid].no} · ${k}`); commit(); return; }
  if (el.dataset.rate){ if (!can('rates')) return; const v = parseFloat(el.value); P.rates[el.dataset.rate] = isFinite(v) ? v : BOQ_LIB[el.dataset.rate].rate; audit('Rate changed', `${el.dataset.rate} → ${P.rates[el.dataset.rate]}`); commit(); return; }
  if (el.dataset.bind){ const path = el.dataset.bind, old = getPath(P, path); const v = parseVal(el); setPath(P, path, v); if (path.startsWith('tables.dem')) _demCache = null; audit('Edited', `${path}: ${old === undefined ? '' : old} → ${v}`); commit(); return; }
  if (el.dataset.act === 'role'){ P.role = el.value; audit('Role changed', el.value); saveLocal(); render(true); toast('Role: ' + el.value); return; }
  if (el.dataset.act === 'settype'){ const nt = el.value; askConfirm('Switch project type? BESS modules, calculations, BOQ items, risks and report chapters will be ' + (nt === 'B' ? 'added.' : 'excluded.'), () => setType(nt), () => render(true)); return; }
});
function setType(v){ const el = {value: v};
    P.type = el.value; P.info.projType = el.value; if (el.value === 'A'){ P.info.bessMW = 0; P.info.bessMWh = 0; } else { P.info.bessMW = P.info.bessMW || 50; P.info.bessMWh = P.info.bessMWh || 200; if (!platforms().find(p => p.id === 'PF-BESS')) P.tables.platforms.push({id:'PF-BESS', name:'BESS compound', x0:37, y0:47, w:8, h:6, rl:0, gx:0.5, gy:0, auto:true}); }
    P.reg.drawings = DRAWING_ROWS.filter(r => !r[3] || r[3] === P.type).map(r => Object.assign({no:r[0], title:r[1], disc:r[2], rev:'-', status:'Required', resp:'C&S consultant'}, (P.reg.drawings.find(d => d.no === r[0]) || {})));
    audit('Project type changed', el.value); closeModal(); commit('Project type ' + el.value); }
document.addEventListener('click', e => {
  const lnk = e.target.closest('a[href^="#"]');
  if (lnk && !e.target.closest('[data-act]')){ e.preventDefault(); const tgt = lnk.getAttribute('href').slice(1); $('#nav').classList.remove('open');
    const scId = lnk.dataset.scroll; if (MOD[tgt] && tgt !== ROUTE) goRoute(tgt, !scId);
    if (scId) setTimeout(() => { const t = document.getElementById(scId); if (t) t.scrollIntoView({behavior:'smooth', block:'start'}); }, 30);
    return; }
  const a = e.target.closest('[data-act]'); if (!a || a.tagName === 'SELECT') return;
  const act = a.dataset.act, id = a.dataset.id;
  switch (act){
    case 'closemodal': closeModal(); break;
    case 'togglenav': $('#nav').classList.toggle('open'); break;
    case 'goto': goRoute(id, true); break;
    case 'save': toast(saveLocal() ? 'Saved in this browser' : 'Browser storage unavailable — use Export JSON'); break;
    case 'export': download(`${(P.info.number || 'project').replace(/[^\w-]+/g, '_')}_CS_${today()}.json`, JSON.stringify(P, null, 1), 'application/json'); audit('Exported JSON', ''); break;
    case 'import': { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then(t => { try { const o = JSON.parse(t); if (o.app !== 'CS-Solar-Tender-Platform') throw new Error('Not a platform project file'); P = upgrade(o); _demCache = null; audit('Imported JSON', f.name); runAll(); saveLocal(); render(); toast('Project imported'); } catch(err){ toast('Import failed: ' + err.message); } }); }; inp.click(); break; }
    case 'newproj': modal('New project', `<p>Select project type. The two workflows are fully separated (tabs, calculations, BOQ, risks, report, standards, authority requirements).</p><div class="grid2"><div class="card"><h3>Type A — Solar Farm</h3><button data-act="create" data-t="A" data-s="1">Demonstration sample</button> <button data-act="create" data-t="A" data-s="0">Blank project</button></div><div class="card"><h3>Type B — Solar Farm + BESS</h3><button data-act="create" data-t="B" data-s="1">Demonstration sample (100 MWac + 50 MW / 200 MWh)</button> <button data-act="create" data-t="B" data-s="0">Blank project</button></div></div><p class="small wbox">The current project is replaced. Export JSON first if needed.</p>`); break;
    case 'create': { P = newProject(a.dataset.t, a.dataset.s === '1'); _demCache = null; runAll(); if (P.sample) P.tender = genSampleTender(); audit('Project created', `Type ${P.type}${P.sample ? ' (sample)' : ''}`); runAll(); saveLocal(); closeModal(); goRoute('m1', true); toast('Project created'); break; }
    case 'togglelink': { if (!can('edit')) return; const u = P.unlink[a.dataset.cid] = P.unlink[a.dataset.cid] || {}; const k = a.dataset.k; u[k] = !u[k];
      if (u[k]){ const d = CALCS[a.dataset.cid].inputs.find(x => x.k === k); const cur = R[a.dataset.cid].I[k]; (P.inp[a.dataset.cid] = P.inp[a.dataset.cid] || {})[k] = cur; (P.conf[a.dataset.cid] = P.conf[a.dataset.cid] || {})[k] = 'Consultant Assumption'; }
      audit(u[k] ? 'Link overridden' : 'Link restored', `${CALCS[a.dataset.cid].no} · ${k}`); commit(); break; }
    case 'issue': { if (!can('edit')) return; askText(`Issue ${CALCS[id].no}`, [{l:'Revision code', v: nextRev(calcRev(id))}, {l:'Revision description', v:'Issued for tender review'}], ([next, desc]) => { if (!next) return; issueCalc(id, next, desc); closeModal(); commit('Issued ' + CALCS[id].no + ' Rev ' + next); }); break; }
    case 'checkcalc': { if (!can('check')) return; const m = P.calcMeta[id] = P.calcMeta[id] || {revs: []}; m.checkedBy = m.checkedBy ? '' : `${P.user} (${today()})`; audit(m.checkedBy ? 'Calculation checked' : 'Check removed', CALCS[id].no); commit(); break; }
    case 'resetcalc': { if (!can('edit')) return; askConfirm(`Reset all inputs of ${CALCS[id].no} to defaults? (logged in audit trail)`, () => { closeModal(); delete P.inp[id]; delete P.conf[id]; delete P.src[id]; delete P.unlink[id]; audit('Calculation reset', CALCS[id].no); commit('Reset'); }); break; }
    case 'sheet': modal(`${CALCS[id].no} — Calculation sheet`, `<div class="row noprint" style="margin-bottom:8px"><button class="sm" data-act="printsheet" data-id="${id}">Print sheet (A4)</button></div><div class="report-body" id="sheetbody" style="border:1px solid var(--bd);padding:14px">${calcSheetHTML(id)}</div>`); break;
    case 'printsheet': printHTML(`<div class="report-body"><div class="rpage"><h2>${esc(CALCS[id].no)} — ${esc(CALCS[id].title)}</h2>${calcSheetHTML(id)}</div></div>`); break;
    case 'revhist': { const m = P.calcMeta[id] || {}; modal(`${CALCS[id].no} — Revision history`, (m.revs || []).length ? `<table class="t"><thead><tr><th>Rev</th><th>Date</th><th>Description</th><th>By</th><th>Status at issue</th><th>Input fingerprint</th></tr></thead><tbody>${m.revs.map(r => `<tr><td>${esc(r.rev)}</td><td>${esc(r.date)}</td><td>${esc(r.desc)}</td><td>${esc(r.by)}</td><td>${esc(r.status)}</td><td class="small muted">${crc32(new TextEncoder().encode(r.hash)).toString(16)}</td></tr>`).join('')}</tbody></table>${calcModified(id) ? '<p class="wbox">Inputs have changed since the last issue — re-issue required.</p>' : ''}` : '<p>Not yet issued (P0 working calculation).</p>'); break; }
    case 'trace': { const r = R[id], k = a.dataset.k, rl = r.resList.find(x => x.key === k); const c = CALCS[id], mod = modOfCalc(id);
      const upto = r.steps.slice(0, rl.step + 1).filter(s => s.t === 'e').slice(-6);
      modal('Traceability — ' + rl.label, `<p class="small">Source → Input → Formula → Result → Report</p><h4>1. Sources & inputs</h4><table class="t"><thead><tr><th>Symbol</th><th>Parameter</th><th class="n">Value</th><th>Unit</th><th>Source</th><th>Confidence</th></tr></thead><tbody>${c.inputs.filter(d => d.k).map(d => { const m = r.meta[d.k] || {}; return `<tr><td><i>${esc(d.sym || '')}</i></td><td>${esc(d.l)}</td><td class="n">${isNum(r.I[d.k]) ? fmt(r.I[d.k]) : esc(r.I[d.k])}</td><td>${esc(d.u || '')}</td><td class="small">${esc(inputSrc(id, d, m) || '—')}</td><td>${esc(inputConf(id, d, m.linked))}</td></tr>`; }).join('')}</tbody></table>
        <h4>2. Formula & calculation</h4><div class="steps">${upto.map(stepHTML).join('')}</div><h4>3. Result</h4><p><b>${esc(rl.label)} = ${fmt(rl.val, rl.dp)} ${esc(rl.unit || '')}</b> (${esc(c.no)}, Rev ${esc(calcRev(id))})</p>
        <h4>4. Reported in</h4><ul class="tight"><li>Module ${mod ? mod.no + '. ' + esc(mod.name) : '—'} — sections C, J</li><li>Report — technical chapter for ${mod ? esc(mod.name) : '—'} (Results, Compliance) and Full Calculation Sheets (${esc(c.no)})</li>${Object.keys(R).filter(o => CALCS[o].inputs.some(d => d.link === id + '.' + k)).map(o => `<li>Used by ${esc(CALCS[o].no)} ${esc(CALCS[o].title)}</li>`).join('')}</ul>`); break; }
    case 'addrow': { const arr = getPath(P, a.dataset.path) || []; if (!getPath(P, a.dataset.path)) setPath(P, a.dataset.path, arr); const t = JSON.parse(a.dataset.tpl); if (t && typeof t === 'object' && !Array.isArray(t) && 'id' in t && !t.id) t.id = uid(); arr.push(t); audit('Row added', a.dataset.path); commit(); break; }
    case 'delrow': { const dp = a.dataset.path, di = +a.dataset.i; askConfirm('Delete this row? (logged in audit trail)', () => { closeModal(); const arr = getPath(P, dp); const rm = arr.splice(di, 1); audit('Row deleted', `${dp}[${di}] ${JSON.stringify(rm[0]).slice(0, 80)}`); commit(); }); break; }
    case 'demimport': { const txt = ($('#demtxt') || {}).value || ''; const dx = parseFloat(($('#demdx') || {}).value) || 25; const rows = txt.trim().split(/\r?\n/).map(l => l.trim().split(/[\s,;]+/).map(Number)).filter(r => r.length > 1 && r.every(isFinite));
      if (rows.length < 3 || rows.some(r => r.length !== rows[0].length)){ toast('Grid must be rectangular with ≥ 3 rows'); return; } P.tables.dem = {nx: rows[0].length, ny: rows.length, dx, z: rows, src: 'user'}; _demCache = null; audit('DTM imported', `${rows[0].length}×${rows.length} @ ${dx} m`); commit('DTM imported'); break; }
    case 'demreset': P.tables.dem = null; _demCache = null; audit('DTM reset to demonstration', ''); commit('Demonstration grid restored'); break;
    case 'csvboq': { const rows = boqRows(); download('BOQ.csv', toCSV(['Item','Bill','Description','Unit','Quantity','Rate','Amount','Calculation Reference','Drawing Reference','Assumption','Confidence','Remarks'], rows.map(r => [r.key, r.bill, r.desc, r.unit, r.qty.toFixed(3), r.rate.toFixed(2), r.amount.toFixed(2), r.calcs, r.dwg, r.basis, r.conf, r.remarks])), 'text/csv'); break; }
    case 'csvrecon': download('Tender_Reconciliation.csv', toCSV(['Item','Description','Required Qty','Tender Qty','Difference','Required Scope','Tender Scope','Tender Rate','Engineering Rate','Variance (RM)','Issues'], TENDER.rows.map(r => [r.key, r.desc, r.rq.toFixed(2), r.tq.toFixed(2), r.diff.toFixed(2), r.rscope, r.tscope, r.trate.toFixed(2), r.erate.toFixed(2), r.variance.toFixed(2), r.issues.join('; ')])), 'text/csv'); break;
    case 'gentender': if (!can('tender')) return; askConfirm('Replace the quotation with a regenerated demonstration quotation?', () => { closeModal(); P.tender = genSampleTender(); audit('Tender regenerated', 'demonstration'); commit(); }); break;
    case 'print': doPrint(); break;
    case 'dlgyes': { const d = _dlg; _dlg = null; closeModal(); if (d && d.yes) d.yes(); break; }
    case 'dlgno': { const d = _dlg; _dlg = null; closeModal(); if (d && d.no) d.no(); break; }
    case 'dlgok': { const d = _dlg; if (!d) break; const vals = d.fields.map((f, i) => (document.getElementById('dlgf' + i) || {}).value || ''); _dlg = null; d.ok(vals); break; }
    case 'docx': { toast('Building Word document…'); exportDocx(P.repOpt).then(b => { download(`${(P.info.number || 'Report').replace(/[^\w-]+/g, '_')}_CS_Tender_Report.docx`, b); audit('Report exported', '.docx'); toast('Word document downloaded'); }).catch(err => { console.error(err); toast('DOCX export failed: ' + err.message); }); break; }
    case 'htmlrep': { const css = document.getElementById('appcss').textContent; download(`${(P.info.number || 'Report').replace(/[^\w-]+/g, '_')}_CS_Tender_Report.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(P.info.name)} — C&S Tender Engineering Report</title><style>${css}</style></head><body style="background:#E9E6E2">${reportHTML(P.repOpt)}</body></html>`, 'text/html'); break; }
    case 'projrev': { const d = ($('#revdesc') || {}).value || 'Project revision'; const n = nextRev((P.revisions.slice(-1)[0] || {}).rev || 'P0'); P.revisions.push({rev: n, date: today(), desc: d, by: `${P.user} (${P.role})`, snapshot: JSON.stringify({inp: P.inp, rates: P.rates, tender: P.tender}).length}); P.reg.reports.forEach(r => r.rev = n); audit('Project revision issued', n + ' — ' + d); commit('Project revision ' + n); break; }
    case 'addconstruct': { const v = ($('#cnew') || {}).value; if (!v) return; P.constructability[v] = {flag: true, note: 'User-added item — review'}; commit(); break; }
  }
});
function goRoute(id, top){ ROUTE = id; try { if (!FRAMED) history.replaceState(null, '', '#' + id); } catch(e){} render(!top); if (top) try { window.scrollTo(0, 0); } catch(e){} }
window.addEventListener('hashchange', () => { let h = ''; try { h = location.hash.slice(1); } catch(e){} if (MOD[h] && h !== ROUTE){ ROUTE = h; render(); } });
function nextRev(r){ const m = /^([A-Z]+)(\d+)$/.exec(r || 'P0'); if (m) return m[1] + (+m[2] + 1); if (/^[A-Z]$/.test(r)) return String.fromCharCode(r.charCodeAt(0) + 1); return 'P1'; }
function printHTML(inner){ const w = window.open('', '_blank'); if (!w){ toast('Pop-up blocked — use the Report Generator print instead'); return; } w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Calculation sheet</title><style>${document.getElementById('appcss').textContent}</style></head><body style="background:#fff">${inner}</body></html>`); w.document.close(); setTimeout(() => w.print(), 400); }
function upgrade(o){ const b = newProject(o.type || 'B', !!o.sample); ['reg','tables'].forEach(k => o[k] = Object.assign({}, b[k], o[k] || {})); return Object.assign(b, o); }

/* ---------- init ---------- */
function init(){
  const saved = loadLocal();
  if (saved && saved.app === 'CS-Solar-Tender-Platform'){ P = upgrade(saved); }
  else { P = newProject('B', true); runAll(); P.tender = genSampleTender(); }
  runAll();
  let h = ''; try { h = location.hash.slice(1); } catch(e){} if (MOD[h]) ROUTE = h;
  render();
}
document.addEventListener('DOMContentLoaded', init);
