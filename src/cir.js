'use strict';
/* ==========================================================================
   CLIENT INFORMATION REQUEST (CIR) — standard checklist of information the
   client should provide for a sound C&S proposal; purpose, implication if
   not provided, priority, proposed responsibility, action. Export PDF / XLSX.
   ========================================================================== */
/* [id, category, item, purpose (why needed), implication if not provided, priority, proposed responsibility, proposed action, doc category link, types] */
const CIR_ROWS = [
 // A — Project definition
 ['A01','A. Project Definition & Commercial','RFP / Employer\'s Requirements (C&S sections), scope of work and scope split / interface matrix','Defines deliverables, battery limits and what the C&S proposal must price.','Scope gaps or duplication between parties; proposal qualified with broad exclusions; variation claims later.','Critical','Client / Developer','Issue full RFP incl. C&S scope, interface matrix and deliverables list.','Tender Document'],
 ['A02','A. Project Definition & Commercial','Plant capacity: MWp, MWac, DC/AC ratio, number of blocks','Sizes PV array area, number of piles, inverter skids, cable trenches and roads.','Quantities (piles, foundations, trenches) cannot be derived; lump-sum risk priced into proposal.','Critical','Client / Developer','Confirm capacities and block configuration.',''],
 ['A03','A. Project Definition & Commercial','BESS capacity (MW / MWh), duration, enclosure type and number','Determines BESS platform footprint, foundations, containment and fire-water civil works.','BESS civil works priced on assumption; platform and containment may be undersized.','Critical','Client / Developer','Confirm BESS rating, technology and indicative layout.','','B'],
 ['A04','A. Project Definition & Commercial','Grid connection offer: POI, voltage, substation type, TNB / utility requirements','Defines substation civil works, cable routes and TNB interface.','Substation civil scope unclear; potential re-design after award.','Critical','Client / Developer','Provide grid connection offer / ST / TNB letters.',''],
 ['A05','A. Project Definition & Commercial','Target programme: NTP, construction window, COD','Sets sequencing, number of piling rigs, ESCP staging and temporary works.','Programme-driven cost (acceleration, weather risk) cannot be assessed.','High','Client / Developer','Provide milestone programme.',''],
 ['A06','A. Project Definition & Commercial','Procurement / contract form, measurement basis and BOQ format','Governs how quantities are measured, re-measurable vs lump-sum items and risk allocation.','Inconsistent pricing; tender reconciliation difficult.','High','Client / Developer','Confirm contract form and BOQ template.',''],
 ['A07','A. Project Definition & Commercial','Design life and performance requirements (e.g. 25–30 years)','Drives corrosion allowance for steel piles, concrete durability and drainage O&M.','Under-specified durability or unnecessary over-design.','Medium','Client / Developer','State design life and durability requirements.',''],
 // B — Land & site
 ['B01','B. Land & Site','Land title, lot plans and certified boundary (with coordinates)','Confirms developable area, setbacks and site boundary for layout and fencing.','Layout may encroach boundary / reserves; area shortfall discovered late.','Critical','Client / Developer','Provide title search and certified lot plans.','Land'],
 ['B02','B. Land & Site','Land use / zoning status and planning permission (KM) status','Identifies planning conditions affecting layout, buffer and setbacks.','Authority conditions not priced; approval delay risk.','High','Client / Developer','Provide planning status and conditions.','Land'],
 ['B03','B. Land & Site','Site access rights and existing access roads / junction location','Determines main access design, junction works and heavy transport route.','Access and junction works not priced; delivery constraints.','High','Client / Developer','Confirm access route and rights of way.',''],
 ['B04','B. Land & Site','Existing utilities, wayleaves and encumbrances (TNB lines, pipelines, graves, structures)','Defines exclusion zones and diversions.','Clashes found during construction; loss of developable area.','High','Client / Developer','Provide utility search / wayleave plans.',''],
 ['B05','B. Land & Site','Site photographs / drone orthophoto and site visit access','Confirms vegetation, drainage paths, watercourses and ground conditions.','Clearing, drainage and access assumptions uncertain.','Medium','Client / Developer','Arrange site visit and share imagery.',''],
 // C — Survey
 ['C01','C. Survey','Topographical survey / DTM (GDM2000) with spot levels, breaklines, watercourses','Basis for grading, cut & fill, drainage, platform levels and slope assessment.','Earthworks and drainage quantities cannot be computed; high contingency required.','Critical','Client / Licensed Surveyor','Commission / provide DTM at ≤ 25 m grid incl. boundary and drains.','Topographical Survey'],
 ['C02','C. Survey','Outfall and downstream drain / river survey (inverts, sections)','Required for outfall capacity, tailwater and JPS approval.','Drainage design incomplete; JPS may reject submission.','High','Client / Licensed Surveyor','Survey receiving drain 200 m downstream of outfall.',''],
 ['C03','C. Survey','Heavy transport route survey (bridges, culverts, bends, overhead lines)','Confirms delivery of transformers / BESS and strengthening needs.','Route strengthening or delivery delay not allowed for.','Medium','EPC / Transporter','Carry out route survey for heaviest loads.','Transport'],
 // D — Geotechnical
 ['D01','D. Geotechnical','Site investigation factual report: boreholes with SPT, logs, groundwater','Soil parameters for piles, foundations, slopes, roads.','Pile length and foundation design based on assumptions; large pile risk allowance.','Critical','Client / SI Contractor','Provide SI report (target ≥ 1 BH / 25 ha plus platforms).','Site Investigation'],
 ['D02','D. Geotechnical','Laboratory results: classification, strength, consolidation, CBR','Bearing capacity, settlement and pavement design.','Conservative design (thicker pavements, larger footings) or settlement risk.','High','Client / SI Contractor','Provide lab test results.','Site Investigation'],
 ['D03','D. Geotechnical','Soil chemistry: pH, sulfate, chloride, resistivity','Corrosion assessment of steel piles and concrete durability class.','Coating / sacrificial thickness unknown; premature corrosion risk.','High','Client / SI Contractor','Include chemical tests in SI.','Site Investigation'],
 ['D04','D. Geotechnical','Pile driving trials / pull-out, compression and lateral load tests','Confirms PV pile embedment and refusal risk.','PV pile length may be under / over-estimated — major cost item.','Critical','Client / EPC','Carry out pre-construction pile tests per geological zone.','Pile Test'],
 ['D05','D. Geotechnical','Groundwater monitoring and previous geotechnical reports','Excavation, dewatering and buoyancy assessment.','Dewatering and temporary works not priced.','Medium','Client / Developer','Provide monitoring data / earlier reports.',''],
 // E — Hydrology & flood
 ['E01','E. Hydrology & Flood (MSMA / JPS)','Official IDF coefficients for nearest JPS rainfall station','Design rainfall intensity for drainage, culverts and detention.','Drain, culvert and pond sizes unreliable; JPS approval risk.','Critical','Client / Consultant (JPS request)','Obtain station IDF data from JPS (MSMA / HP 1).','Hydrology'],
 ['E02','E. Hydrology & Flood (MSMA / JPS)','Design flood level / flood map and history of flooding','Sets platform RL for substation, BESS and inverters.','Platforms may be flooded or over-filled; large earthworks variance.','Critical','Client / JPS','Provide JPS flood level confirmation.','Hydrology'],
 ['E03','E. Hydrology & Flood (MSMA / JPS)','JPS / PBT drainage requirements and any prior correspondence','Confirms detention criteria, ARI and outfall conditions.','Detention pond size and drainage standard may change after award.','High','Client / Developer','Share authority correspondence.',''],
 ['E04','E. Hydrology & Flood (MSMA / JPS)','River reserve / watercourse details within or adjacent to site','Setback and crossing approvals.','Loss of area or redesign near watercourses.','Medium','Client / JPS','Confirm river reserve width.',''],
 // F — Authority & environmental
 ['F01','F. Authority & Environmental','PBT earthworks, building and road submission requirements','Defines submission scope, standard drawings and fees.','Authority scope under-priced; approval delays.','High','Client / Consultant','Confirm PBT requirements.',''],
 ['F02','F. Authority & Environmental','EIA screening / environmental studies and DOE (LD-P2M2) conditions','ESCP measures and monitoring obligations.','ESCP under-designed; stop-work risk.','High','Client / Developer','Provide EIA / DOE status.',''],
 ['F03','F. Authority & Environmental','JKR access / junction approval requirements','Main access junction design standard.','Junction redesign after JKR comments.','Medium','Client / Consultant','Confirm road authority and standard.',''],
 ['F04','F. Authority & Environmental','BOMBA requirements for BESS (separation, fire access, fire-water)','BESS layout, access roads and fire-water civil works.','BESS layout rework and containment undersizing.','Critical','Client / Fire Consultant','Obtain BOMBA consultation outcome.','Fire','B'],
 // G — Equipment & vendor
 ['G01','G. Equipment & Vendor Data','PV layout (tracker / fixed-tilt), row spacing, road network','Pile quantities, grading, drainage and cable routing.','Quantities based on benchmarks; layout clashes.','Critical','Client / EPC','Provide preliminary PV layout (CAD).','Layout'],
 ['G02','G. Equipment & Vendor Data','Tracker / mounting vendor: pile loads, section, slope tolerances, wind-tunnel report','Pile design, grading limits and wind loading.','Pile design unverified; grading volume uncertain.','Critical','EPC / Vendor','Provide vendor load table and tolerance letter.','Vendor Data'],
 ['G03','G. Equipment & Vendor Data','Inverter / MV skid data: weight, footprint, anchor loads, cable entry','Skid foundation design.','Foundation redesign after vendor selection.','High','EPC / Vendor','Provide GA and load data.','Vendor Data'],
 ['G04','G. Equipment & Vendor Data','Main transformer data: weight, dimensions, oil volume','Transformer foundation, bund and oil separator; heavy transport.','Bund / foundation undersized; transport constraints missed.','High','Client / Vendor','Provide transformer GA and oil volume.','Vendor Data'],
 ['G05','G. Equipment & Vendor Data','BESS enclosure / PCS data: weight, COG, anchorage, coolant volume, spacing','BESS foundations and containment.','Foundation and containment redesign.','Critical','EPC / BESS Vendor','Provide certified vendor data sheet.','Vendor Data','B'],
 ['G06','G. Equipment & Vendor Data','Fire-water demand (rate, duration) and tank size','Fire-water tank foundation, containment volume.','Containment volume and tank foundation unverified.','High','Fire Consultant','Provide fire-water design basis.','Fire','B'],
 ['G07','G. Equipment & Vendor Data','Substation layout and single-line diagram (equipment list)','Substation equipment foundations, trenches and yard.','Substation civil quantities estimated only.','High','Client / TNB / Substation Contractor','Provide substation GA and SLD.',''],
 ['G08','G. Equipment & Vendor Data','Cable schedule / routing (MV, LV/DC)','Cable trench sections and quantities.','Trench quantities based on benchmarks.','Medium','EPC','Provide preliminary cable schedule.',''],
 // H — Client standards
 ['H01','H. Client Standards & Specifications','Owner\'s technical specification (C&S), preferred codes and design criteria','Governing design criteria where codes differ (MSMA / JKR / PBT / client).','Design basis disputes; re-work.','High','Client / Developer','Provide owner specification.',''],
 ['H02','H. Client Standards & Specifications','Material and workmanship specifications; testing frequencies (piles, compaction, concrete)','Pricing of testing and QA/QC.','Testing under-priced; disputes on acceptance criteria.','Medium','Client / Developer','Provide QA/QC and testing requirements.',''],
 ['H03','H. Client Standards & Specifications','Drawing / document standards, templates and deliverables list','Scopes design deliverables and effort.','Deliverable scope unclear.','Medium','Client / Developer','Provide deliverables list and templates.',''],
 ['H04','H. Client Standards & Specifications','HSE, security and site rules (fencing, CCTV, lighting)','Security infrastructure and temporary works scope.','Security civil works omitted.','Medium','Client / Developer','Provide security specification.',''],
 // I — Tender information
 ['I01','I. Tender & Cost Information','Contractor quotations / previous tender prices (if available)','Tender reconciliation and cost benchmarking.','No independent cost check; pricing risk.','Medium','Client / Developer','Share received quotations for review.','Tender Quotation'],
 ['I02','I. Tender & Cost Information','Insurance, bond and warranty requirements affecting C&S works','Commercial risk pricing.','Commercial exposure not reflected in proposal.','Low','Client / Developer','State contract requirements.',''],
];
const CIR_RESP = ['Client / Developer','Client / Licensed Surveyor','Client / SI Contractor','Client / EPC','Client / JPS','Client / Consultant','Client / Consultant (JPS request)','Client / Vendor','Client / Fire Consultant','Client / TNB / Substation Contractor','EPC','EPC / Vendor','EPC / BESS Vendor','EPC / Transporter','Fire Consultant','C&S Consultant'];
const CIR_STATUS = ['Not provided','Provided','Partial','N/A'];

function cirRows(){
  const st = P.cir = P.cir || {};
  return CIR_ROWS.filter(r => !r[9] || r[9] === P.type).map(r => {
    const s = st[r[0]] = st[r[0]] || {};
    let status = s.status;
    if (!status){ const d = r[8] && (P.docs || []).find(x => x.cat === r[8]); status = d ? (d.status === 'Received' ? 'Provided' : d.status === 'Partial' ? 'Partial' : 'Not provided') : 'Not provided'; }
    return {id:r[0], cat:r[1], item:r[2], why:r[3], impl:r[4], pri: s.pri || r[5], resp: s.resp || r[6], action: s.action || r[7], due: s.due || '', remarks: s.remarks || '', status, auto: !s.status && !!r[8]};
  });
}
function cirMeta(){
  P.cirMeta = P.cirMeta || {ref: `${(P.info.number || 'PRJ')}-CIR-01`, rev: 'A', issueDate: today(), returnBy: '', to: P.info.client || '', attn: ''};
  return P.cirMeta;
}
function cirInfoRows(){
  const i = P.info, cen = (P.coords || []).find(c => /centroid/i.test(c.label));
  return [['Project', i.name], ['Project No.', i.number], ['Client', i.client], ['Developer', i.developer], ['Location', `${i.location || ''}${i.mukim ? ', Mukim ' + i.mukim : ''}`], ['District / State', `${i.district || ''}, ${i.state || ''}`], ['Local Authority (PBT)', pbtName()],
    ['Coordinates (centroid)', cen ? `${(+cen.lat).toFixed(5)}° N, ${(+cen.lon).toFixed(5)}° E` : 'To be advised'], ['Land Area', i.landArea ? fmt(+i.landArea, 1) + ' ha' : 'To be advised'], ['Project Type', P.type === 'B' ? 'Type B — Solar Farm + BESS' : 'Type A — Solar Farm'],
    ['PV Capacity', `${i.mwp ? fmt(+i.mwp, 1) + ' MWp' : '— MWp'} / ${i.mwac ? fmt(+i.mwac, 1) + ' MWac' : '— MWac'}`], ...(P.type === 'B' ? [['BESS Capacity', `${fmt(+i.bessMW || 0, 1)} MW / ${fmt(+i.bessMWh || 0, 1)} MWh`]] : []),
    ['Grid Connection', `${i.gridV || '—'}${i.poi ? ' — ' + i.poi : ''}`], ['Project Stage', i.stage || '—'], ['Target COD', i.cod || '—']];
}
function cirSummary(rows){ const c = s => rows.filter(r => r.status === s).length; return {tot: rows.length, prov: c('Provided'), part: c('Partial'), no: c('Not provided'), na: c('N/A'), crit: rows.filter(r => r.pri === 'Critical' && r.status !== 'Provided' && r.status !== 'N/A').length}; }

/* ---------- page ---------- */
PAGES.cir = function(m){
  const rows = cirRows(), meta = cirMeta(), s = cirSummary(rows), ro = dis('registers');
  let h = pageHead(m, 'Standard checklist of information the client should provide for a sound C&S proposal');
  h += `<div class="card noprint"><div class="row"><span class="small muted">Generated from the project type (${P.type === 'B' ? 'Solar + BESS' : 'Solar only'}). Status pre-fills from the Document register where linked.</span><span class="sp" style="flex:1"></span><button class="pri" data-act="cirpdf">Print / Save as PDF</button><button data-act="cirxlsx">Download Excel (.xlsx)</button><button data-act="cirreset">Reset to standard</button></div></div>`;
  h += `<div class="grid2"><div class="card"><h3>Project information</h3><table class="t"><tbody>${cirInfoRows().map(([k, v]) => `<tr><th style="width:38%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table><p class="small muted">Edit in 2. Project Information.</p></div>
    <div class="card"><h3>Request details</h3><div class="grid2">${[['ref','Reference no.'],['rev','Revision'],['issueDate','Date issued'],['returnBy','Information requested by (date)'],['to','To (client)'],['attn','Attention']].map(([k, l]) => `<div><label class="small muted">${l}</label><input data-bind="cirMeta.${k}" value="${esc(meta[k] || '')}"${ro}></div>`).join('')}</div>
      <div class="grid4" style="margin-top:10px">${[[s.tot,'Items'],[s.prov,'Provided'],[s.part + s.no,'Outstanding'],[s.crit,'Critical outstanding']].map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}</div></div></div>`;
  h += `<div class="card"><div class="tw"><table class="t"><thead><tr><th>Ref</th><th style="min-width:200px">Information / data required</th><th style="min-width:200px">Why it is needed</th><th style="min-width:200px">Implication if not provided</th><th>Priority</th><th class="c">Provided</th><th>Status</th><th style="min-width:150px">Responsibility (proposed)</th><th style="min-width:180px">Action (proposed)</th><th>Target date</th><th>Remarks</th></tr></thead><tbody>`;
  let last = '';
  rows.forEach(r => { if (r.cat !== last){ h += `<tr class="hd"><td colspan="11">${esc(r.cat)}</td></tr>`; last = r.cat; }
    const b = k => `cir.${r.id}.${k}`;
    h += `<tr><td>${r.id}</td><td>${esc(r.item)}</td><td class="small">${esc(r.why)}</td><td class="small" style="color:#7a3b35">${esc(r.impl)}</td>
      <td><select data-bind="${b('pri')}"${ro}>${['Critical','High','Medium','Low'].map(o => `<option${o === r.pri ? ' selected' : ''}>${o}</option>`).join('')}</select></td>
      <td class="c"><input type="checkbox" style="width:18px;height:18px" data-circhk="${r.id}" ${r.status === 'Provided' ? 'checked' : ''}${ro}></td>
      <td><select data-bind="${b('status')}"${ro}>${CIR_STATUS.map(o => `<option${o === r.status ? ' selected' : ''}>${o}</option>`).join('')}</select>${r.auto ? '<div class="small muted">from documents</div>' : ''}</td>
      <td><input list="cirresp" data-bind="${b('resp')}" value="${esc(r.resp)}"${ro}></td><td><textarea data-bind="${b('action')}" rows="2"${ro}>${esc(r.action)}</textarea></td>
      <td><input data-bind="${b('due')}" value="${esc(r.due)}" placeholder="YYYY-MM-DD" style="width:98px"${ro}></td><td><input data-bind="${b('remarks')}" value="${esc(r.remarks)}"${ro}></td></tr>`; });
  h += `</tbody></table></div><datalist id="cirresp">${CIR_RESP.map(o => `<option value="${esc(o)}">`).join('')}</datalist></div>`;
  return h;
};

/* ---------- PDF (print) ---------- */
function cirHTML(){
  const rows = cirRows(), meta = cirMeta(), s = cirSummary(rows), i = P.info;
  const box = st => st === 'Provided' ? '☑' : st === 'N/A' ? '—' : st === 'Partial' ? '◐' : '☐';
  let h = `<div class="report-body cir-doc"><div style="border-top:5pt solid #D99058;padding-top:8pt"><div style="color:#9E6035;font-weight:700;font-size:9pt;letter-spacing:.6pt">${esc(i.consultant || 'C&S CONSULTANT')}</div>
    <div style="font-size:17pt;font-weight:700;line-height:1.2;margin:4pt 0">CLIENT INFORMATION REQUEST — CIVIL &amp; STRUCTURAL</div><div style="font-size:11pt;color:#9E6035;margin-bottom:6pt">${esc(i.name)}</div></div>
    <table style="width:100%;margin-bottom:6pt"><tbody><tr><td style="width:50%;vertical-align:top;border:0;padding:0 6pt 0 0">${htmlTable(['Project information', ''], cirInfoRows())}</td>
    <td style="vertical-align:top;border:0;padding:0">${htmlTable(['Request details', ''], [['Reference', meta.ref], ['Revision', meta.rev], ['Date issued', meta.issueDate], ['Requested by (date)', meta.returnBy || 'To be agreed'], ['To', meta.to], ['Attention', meta.attn || '—'], ['Prepared by', `${i.consultant || ''}${i.prepared ? ' — ' + i.prepared : ''}`], ['Summary', `${s.tot} items · ${s.prov} provided · ${s.part} partial · ${s.no} not provided · ${s.crit} critical outstanding`]])}</td></tr></tbody></table>
    <p style="font-size:9.5pt;line-height:1.35;text-align:justify">To prepare a complete and competitive civil &amp; structural proposal with minimum qualifications and contingency, the following information is requested. For each item the reason it is needed and the implication if it is not provided are stated. Where information is not available, the proposal will adopt stated assumptions and allowances, which may increase price, qualifications or post-award variations. Legend: ☑ provided · ◐ partial · ☐ not provided · — not applicable.</p>`;
  if (P.sample) h += `<div class="demo-flag">${DEMO_FLAG}</div>`;
  h += `<table class="cirt" style="break-before:page;page-break-before:always"><thead><tr><th style="width:4%">Ref</th><th style="width:19%">Information / data required</th><th style="width:18%">Why it is needed</th><th style="width:19%">Implication if not provided</th><th style="width:6%">Priority</th><th style="width:4%">✓</th><th style="width:11%">Responsibility (proposed)</th><th style="width:13%">Action (proposed)</th><th style="width:6%">Target date</th></tr></thead><tbody>`;
  let last = '';
  rows.forEach(r => { if (r.cat !== last){ h += `<tr><td colspan="9" style="background:#F8E5D5;font-weight:700;color:#9E6035">${esc(r.cat)}</td></tr>`; last = r.cat; }
    h += `<tr><td>${r.id}</td><td>${esc(r.item)}${r.remarks ? `<div style="color:#666;font-size:7.5pt">Remarks: ${esc(r.remarks)}</div>` : ''}</td><td>${esc(r.why)}</td><td>${esc(r.impl)}</td><td class="c" style="${r.pri === 'Critical' ? 'color:#B0413E;font-weight:700' : ''}">${esc(r.pri)}</td><td class="c" style="font-size:11pt">${box(r.status)}</td><td>${esc(r.resp)}</td><td>${esc(r.action)}</td><td>${esc(r.due)}</td></tr>`; });
  h += `</tbody></table><table style="width:100%;margin-top:12pt"><tbody><tr>${['Prepared by (Consultant)','Received by (Client)','Date'].map(t => `<td style="width:33%;height:38pt;vertical-align:bottom;font-size:8.5pt;color:#666">${t}</td>`).join('')}</tr></tbody></table></div>`;
  return h;
}
function cirPrint(){
  const meta = cirMeta(), box = 'font-family:Aptos, Arial, sans-serif;font-size:7.5pt;color:#666;';
  const css = `<style class="pagecss">@page{size:A4 landscape;margin:16mm 12mm 16mm 12mm;
    @top-left{content:${cssStr(P.info.name + (P.sample ? '  |  ' + DEMO_FLAG : ''))};${box}}@top-right{content:${cssStr('Client Information Request — C&S')};${box}}
    @bottom-left{content:${cssStr(P.info.consultant || '')};${box}}@bottom-center{content:${cssStr(meta.ref + '  Rev ' + meta.rev)};${box}}@bottom-right{content:"Page " counter(page) " of " counter(pages);${box}}}
    .cir-doc table.cirt{border-collapse:collapse;width:100%;font-size:7.8pt;line-height:1.2}.cir-doc table.cirt th{background:#F8E5D5;border:0.5pt solid #B9ADA2;padding:2pt 3pt;text-align:left;vertical-align:bottom}
    .cir-doc table.cirt td{border:0.5pt solid #CFC7BF;padding:2pt 3pt;vertical-align:top;text-align:left}.cir-doc table.cirt td.c{text-align:center}.cir-doc table.cirt thead{display:table-header-group}.cir-doc table.cirt tr{page-break-inside:avoid}
    .cir-doc .demo-flag{margin:4pt 0}</style>`;
  const html = css + `<div class="rep-wrap" style="background:#fff;padding:0">${cirHTML()}</div>`;
  if (!FRAMED){ let pa = document.getElementById('printArea'); if (!pa){ pa = document.createElement('div'); pa.id = 'printArea'; document.body.appendChild(pa); }
    pa.innerHTML = html; document.body.classList.add('print-area'); const done = () => { document.body.classList.remove('print-area'); pa.innerHTML = ''; window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(() => { try { window.print(); } catch(e){} }, 50); return html; }
  const w = window.open('', '_blank'); if (!w){ modal('Print', '<p>The browser blocked the print window (embedded page). Open the platform in its own tab to print.</p>'); return html; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Client Information Request</title><style>${document.getElementById('appcss').textContent}</style></head><body style="background:#fff">${html}</body></html>`); w.document.close(); setTimeout(() => { try { w.print(); } catch(e){} }, 600);
  return html;
}

/* ---------- Excel (.xlsx, SpreadsheetML) ---------- */
function cirXlsx(){
  const rows = cirRows(), meta = cirMeta(), s = cirSummary(rows);
  const col = n => { let t = ''; n++; while (n){ const m = (n - 1) % 26; t = String.fromCharCode(65 + m) + t; n = Math.floor((n - 1) / 26); } return t; };
  const cells = []; let r = 0; const merges = [], heights = {};
  const put = (c, v, st) => cells.push({r, c, v, st});
  const HDR = ['Ref','Category','Information / data required','Why it is needed','Implication if not provided','Priority','Provided (☐/☑)','Status','Responsibility (proposed)','Action (proposed)','Target date','Remarks'];
  put(0, 'CLIENT INFORMATION REQUEST — CIVIL & STRUCTURAL', 1); merges.push(`A1:L1`); heights[0] = 26; r++;
  put(0, P.info.name || '', 2); merges.push(`A2:L2`); r++;
  if (P.sample){ put(0, DEMO_FLAG, 7); merges.push(`A3:L3`); r++; }
  r++;
  put(0, 'PROJECT INFORMATION', 3); put(6, 'REQUEST DETAILS', 3); merges.push(`A${r + 1}:E${r + 1}`, `G${r + 1}:L${r + 1}`); r++;
  const info = cirInfoRows(), req = [['Reference', meta.ref], ['Revision', meta.rev], ['Date issued', meta.issueDate], ['Requested by (date)', meta.returnBy || 'To be agreed'], ['To', meta.to], ['Attention', meta.attn || ''], ['Prepared by', P.info.consultant || ''], ['Items', String(s.tot)], ['Provided', String(s.prov)], ['Partial', String(s.part)], ['Not provided', String(s.no)], ['Critical outstanding', String(s.crit)]];
  for (let k = 0; k < Math.max(info.length, req.length); k++){
    if (info[k]){ put(0, info[k][0], 4); put(1, '', 4); put(2, info[k][1], 5); put(3, '', 5); put(4, '', 5); merges.push(`A${r + 1}:B${r + 1}`, `C${r + 1}:E${r + 1}`); }
    if (req[k]){ put(6, req[k][0], 4); put(7, '', 4); put(8, req[k][1], 5); [9, 10, 11].forEach(c => put(c, '', 5)); merges.push(`G${r + 1}:H${r + 1}`, `I${r + 1}:L${r + 1}`); }
    r++; }
  r++;
  put(0, 'Legend: ☑ provided · ◐ partial · ☐ not provided · N/A not applicable. Where information is not provided, the proposal will adopt stated assumptions / allowances.', 5); merges.push(`A${r + 1}:L${r + 1}`); r++; r++;
  const hdrRow = r; HDR.forEach((t, c) => put(c, t, 6)); heights[r] = 30; r++;
  let last = '';
  rows.forEach(x => { if (x.cat !== last){ put(0, x.cat, 3); merges.push(`A${r + 1}:L${r + 1}`); r++; last = x.cat; }
    const chk = x.status === 'Provided' ? '☑' : x.status === 'Partial' ? '◐' : x.status === 'N/A' ? 'N/A' : '☐';
    [x.id, x.cat.replace(/^[A-Z]\. /, ''), x.item, x.why, x.impl, x.pri, chk, x.status, x.resp, x.action, x.due, x.remarks].forEach((v, c) => put(c, v, c === 6 ? 8 : c === 5 && x.pri === 'Critical' ? 9 : 5)); r++; });
  const lastRow = r;
  const byRow = {}; cells.forEach(c => (byRow[c.r] = byRow[c.r] || []).push(c));
  const xe2 = v => xe(v);
  const sheetRows = Object.keys(byRow).map(Number).sort((a, b) => a - b).map(ri => `<row r="${ri + 1}"${heights[ri] ? ` ht="${heights[ri]}" customHeight="1"` : ''}>${byRow[ri].sort((a, b) => a.c - b.c).map(c => `<c r="${col(c.c)}${ri + 1}" s="${c.st}" t="inlineStr"><is><t xml:space="preserve">${xe2(c.v)}</t></is></c>`).join('')}</row>`).join('');
  const widths = [6, 16, 38, 38, 38, 10, 11, 13, 22, 32, 12, 22];
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" zoomScale="90"><pane ySplit="${hdrRow + 1}" topLeftCell="A${hdrRow + 2}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData>
<autoFilter ref="A${hdrRow + 1}:L${lastRow}"/><mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>
<dataValidations count="3"><dataValidation type="list" allowBlank="1" sqref="G${hdrRow + 2}:G${lastRow}"><formula1>"☐,☑,◐,N/A"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="H${hdrRow + 2}:H${lastRow}"><formula1>"Not provided,Provided,Partial,N/A"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="F${hdrRow + 2}:F${lastRow}"><formula1>"Critical,High,Medium,Low"</formula1></dataValidation></dataValidations>
<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddHeader>&amp;L&amp;8${xe(P.info.name || '')}&amp;R&amp;8Client Information Request — C&amp;S</oddHeader><oddFooter>&amp;L&amp;8${xe(P.info.consultant || '')}&amp;C&amp;8${xe(meta.ref)} Rev ${xe(meta.rev)}&amp;R&amp;8Page &amp;P of &amp;N</oddFooter></headerFooter></worksheet>`;
  const F = (sz, b, col) => `<font>${b ? '<b/>' : ''}<sz val="${sz}"/>${col ? `<color rgb="FF${col}"/>` : ''}<name val="Aptos"/><family val="2"/></font>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="7">${F(10)}${F(15, 1)}${F(11, 0, '9E6035')}${F(10, 1, '9E6035')}${F(10, 1)}${F(12)}${F(10, 1, 'B0413E')}</fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8E5D5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFAFAF8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCFC7BF"/></left><right style="thin"><color rgb="FFCFC7BF"/></right><top style="thin"><color rgb="FFCFC7BF"/></top><bottom style="thin"><color rgb="FFCFC7BF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Client Information Request" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Client Information Request'!$A$${hdrRow + 1}:$L$${lastRow}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'Client Information Request'!$${hdrRow + 1}:$${hdrRow + 1}</definedName></definedNames></workbook>`;
  const files = [
    {name:'[Content_Types].xml', data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`},
    {name:'_rels/.rels', data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`},
    {name:'docProps/core.xml', data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xe(P.info.name + ' — Client Information Request')}</dc:title><dc:creator>${xe(P.info.consultant || '')}</dc:creator></cp:coreProperties>`},
    {name:'xl/workbook.xml', data:wb},
    {name:'xl/_rels/workbook.xml.rels', data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml', data:styles},
    {name:'xl/worksheets/sheet1.xml', data:sheet},
  ];
  return new Blob([makeZip(files)], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
