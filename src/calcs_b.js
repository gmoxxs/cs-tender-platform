'use strict';
/* ==========================================================================
   CALCULATORS B — MSMA hydrology & drainage, flood, ESCP, roads & access,
   cable trench & ancillary civil, BESS civil, temporary works, quantities
   ========================================================================== */

/* ---------- hydraulics helpers ---------- */
const trapG = (b, z, y) => ({A: (b + z * y) * y, P: b + 2 * y * Math.sqrt(1 + z * z), T: b + 2 * z * y});
function circG(D, y){ y = clamp(y, 1e-6, D); const th = 2 * Math.acos(1 - 2 * y / D); return {A: D * D / 8 * (th - Math.sin(th)), P: D * th / 2, T: D * Math.sin(th / 2)}; }
const manQ = (g, n, S) => g.A * Math.pow(g.A / g.P, 2/3) * Math.sqrt(S) / n;
const LINING = {'Concrete':{n:0.015, vmax:4.0}, 'Earth (clayey)':{n:0.025, vmax:1.0}, 'Grass-lined':{n:0.035, vmax:1.8}, 'Riprap':{n:0.035, vmax:3.0}};
function normalDepth(Q, geo, n, S, ymax){ return bisect(y => manQ(geo(y), n, S) - Q, 1e-4, ymax * 3) || null; }
function idfI(T, dmin){ const {I} = buildInputs('IDF'); const d = Math.max(dmin, 5) / 60; return I.lam * Math.pow(T, I.kap) / Math.pow(d + I.the, I.eta); }
function subcatch(){ return P.tables.sc || []; }

/* ======================================================================
   IDF — rainfall intensity (MSMA 2nd Ed. form)
   ====================================================================== */
defCalc({id:'IDF', no:'CS-HYD-001', title:'Rainfall / IDF', module:'m15', req:[24],
  purpose:'Compute design rainfall intensity from station IDF coefficients (MSMA 2nd Edition empirical IDF form).',
  codes:['MSMA2','HP1'],
  assume:['IDF form i = λT^κ/(d + θ)^η with d in hours, i in mm/hr (MSMA 2nd Ed.) — coefficients MUST be official station values.'],
  criteria:['Minor system ARI, major system ARI and detention ARI per design criteria table'],
  inputs:[
    {k:'stn', sym:'—', l:'Rainfall station (ID / name)', t:'x', d:'DEMO STATION — replace with nearest JPS station', c:'Unknown', s:'JPS DATA REQUIRED'},
    {k:'lat', sym:'—', l:'Station coordinates', t:'x', d:'—', c:'Unknown'},
    {k:'lam', sym:'λ', l:'IDF coefficient λ', u:'', d:65.0, c:'Estimated', s:'DEMONSTRATION VALUE — NOT OFFICIAL'},
    {k:'kap', sym:'κ', l:'IDF coefficient κ', u:'', d:0.18, c:'Estimated', s:'DEMONSTRATION VALUE — NOT OFFICIAL'},
    {k:'the', sym:'θ', l:'IDF coefficient θ', u:'h', d:0.25, c:'Estimated', s:'DEMONSTRATION VALUE — NOT OFFICIAL'},
    {k:'eta', sym:'η', l:'IDF coefficient η', u:'', d:0.80, c:'Estimated', s:'DEMONSTRATION VALUE — NOT OFFICIAL'},
    {k:'Tmin', sym:'T_minor', l:'Minor system ARI', u:'yr', d:10, c:'Consultant Assumption', s:'MSMA / JPS — confirm'},
    {k:'Tmaj', sym:'T_major', l:'Major system ARI', u:'yr', d:100, c:'Consultant Assumption'},
    {k:'Tdet', sym:'T_det', l:'Detention design ARI', u:'yr', d:50, c:'Consultant Assumption', s:'ENGINEER CONFIRMATION'},
    {k:'d', sym:'d', l:'Storm duration (= site Tc, post)', u:'min', d:30, link:'TC.tcPostMax'},
  ],
  run(I, S){
    const i = (T, d) => I.lam * Math.pow(T, I.kap) / Math.pow(d / 60 + I.the, I.eta);
    S.txt(`Station: ${I.stn}`);
    S.v('i', 'IDF relationship', 'i = λT^κ / (d + θ)^η  (d in hours)', `${I.lam}·T^${I.kap} / (d + ${I.the})^${I.eta}`, null, 'mm/hr', 'MSMA2 IDF form');
    const im = S.v('i_minor', `Intensity, T = ${I.Tmin} yr, d = ${f1(I.d)} min`, 'i = λT^κ/(d+θ)^η', `${I.lam}×${I.Tmin}^${I.kap}/(${f3(I.d/60)} + ${I.the})^${I.eta}`, i(I.Tmin, I.d), 'mm/hr', 'MSMA2', 1);
    const iM = S.v('i_major', `Intensity, T = ${I.Tmaj} yr`, '', `${I.lam}×${I.Tmaj}^${I.kap}/(${f3(I.d/60)} + ${I.the})^${I.eta}`, i(I.Tmaj, I.d), 'mm/hr', 'MSMA2', 1);
    const iD = S.v('i_det', `Intensity, T = ${I.Tdet} yr`, '', `${I.lam}×${I.Tdet}^${I.kap}/(${f3(I.d/60)} + ${I.the})^${I.eta}`, i(I.Tdet, I.d), 'mm/hr', 'MSMA2', 1);
    const durs = [5,10,15,30,60,120,180,360,720], aris = [2,5,10,20,50,100];
    S.tbl('IDF table (mm/hr)', ['d (min)', ...aris.map(a => a + '-yr')], durs.map(d => [d, ...aris.map(a => f1(i(a, d)))]));
    S.idf = {durs, aris, i};
    S.r('iMinor', 'Minor ARI intensity', im, 'mm/hr', 1); S.r('iMajor', 'Major ARI intensity', iM, 'mm/hr', 1); S.r('iDet', 'Detention ARI intensity', iD, 'mm/hr', 1);
    S.r('Tmin', 'Minor ARI', I.Tmin, 'yr', 0); S.r('Tmaj', 'Major ARI', I.Tmaj, 'yr', 0); S.r('Tdet', 'Detention ARI', I.Tdet, 'yr', 0);
    S.w('JPS', 'IDF coefficients are DEMONSTRATION values. Official station coefficients (MSMA / HP 1) must be obtained from JPS — never fabricate.');
    S.n(`Design intensities at d = ${f0(I.d)} min: ${f0(im)} mm/hr (${I.Tmin}-yr), ${f0(iD)} mm/hr (${I.Tdet}-yr), ${f0(iM)} mm/hr (${I.Tmaj}-yr).`);
  }});

/* ======================================================================
   CAT — catchment analysis
   ====================================================================== */
defCalc({id:'CAT', no:'CS-HYD-002', title:'Catchment Analysis', module:'m15', req:[21],
  purpose:'Summarise sub-catchments and compute area-weighted runoff coefficients (pre and post development).',
  codes:['MSMA2'],
  assume:['Runoff coefficients by land use from MSMA tables — values entered require verification against ARI-dependent MSMA table.'],
  criteria:['C_w = Σ(C_i A_i)/ΣA_i'],
  inputs:[{k:'tol', sym:'—', l:'Area reconciliation tolerance', u:'%', d:5, c:'Consultant Assumption'}],
  run(I, S, P){
    const sc = subcatch(); if (!sc.length){ S.w('TOPO', 'No sub-catchments defined.'); return; }
    S.tbl('Sub-catchments', ['ID','A (ha)','Pre-dev land use','C_pre','Post-dev land use','C_post','L_o (m)','S (%)'], sc.map(c => [c.id, f2(+c.area), c.preUse, f2(+c.cPre), c.postUse, f2(+c.cPost), f0(+c.L), f2(+c.S)]));
    const A = S.v('A', 'Total catchment area', 'A = ΣA_i', sc.map(c => c.area).join(' + '), sum(sc.map(c => +c.area)), 'ha', '', 2);
    const Cp = S.v('C_pre', 'Weighted C (pre)', 'C = Σ(C_i A_i)/ΣA_i', sc.map(c => `${c.cPre}×${c.area}`).join(' + ') + ` / ${f2(A)}`, sum(sc.map(c => c.cPre * c.area)) / A, '', 'MSMA2', 3);
    const Cq = S.v('C_post', 'Weighted C (post)', 'C = Σ(C_i A_i)/ΣA_i', sc.map(c => `${c.cPost}×${c.area}`).join(' + ') + ` / ${f2(A)}`, sum(sc.map(c => c.cPost * c.area)) / A, '', 'MSMA2', 3);
    S.r('A', 'Total catchment area', A, 'ha', 2); S.r('Cpre', 'Weighted C (pre)', Cp, '', 3); S.r('Cpost', 'Weighted C (post)', Cq, '', 3);
    const la = +P.info.landArea || A;
    S.chk({label:'Catchment area vs land area', val: Math.abs(A - la) / la * 100, lim: I.tol, rel:'<=', unit:'%', dp:1, fix:'Check for external catchment inflows / catchment boundaries.'});
    S.w('CLAUSE', 'Runoff coefficients to be verified against MSMA table for the design ARI and land use.');
    S.n(`Development increases weighted C from ${f3(Cp)} to ${f3(Cq)} (+${f0((Cq/Cp - 1) * 100)}%).`);
  }});

/* ======================================================================
   TC — time of concentration
   ====================================================================== */
defCalc({id:'TC', no:'CS-HYD-003', title:'Time of Concentration', module:'m15', req:[23],
  purpose:'Compute time of concentration for each sub-catchment (overland flow + drain/channel flow).',
  codes:['MSMA2'],
  assume:['Overland flow time t_o = 107 n* L^{1/3} / S^{1/5} (min; L in m, S in %) with Horton roughness n* (MSMA table — VERIFY).','Drain/channel time t_d = L_c/(60V), V by Manning for assumed hydraulic radius.','Minimum Tc 5 min.'],
  criteria:['t_c = t_o + t_d'],
  inputs:[
    {k:'nch0', sym:'n_ch,pre', l:'Manning n — natural channel (pre)', u:'', d:0.045, c:'Consultant Assumption'},
    {k:'nch1', sym:'n_ch,post', l:'Manning n — site drains (post)', u:'', d:0.030, c:'Consultant Assumption'},
    {k:'R0', sym:'R_pre', l:'Hydraulic radius — natural', u:'m', d:0.25, c:'Consultant Assumption'},
    {k:'R1', sym:'R_post', l:'Hydraulic radius — drains', u:'m', d:0.35, c:'Consultant Assumption'},
    {k:'meth', sym:'—', l:'Method', t:'s', o:['MSMA overland + channel','Kirpich (check)'], d:'MSMA overland + channel', c:'Consultant Assumption'},
  ],
  run(I, S){
    const sc = subcatch(); const rows = []; let maxPost = 0, maxPre = 0;
    S.v('t_o', 'Overland flow time', 't_o = 107 n* L^{1/3} / S^{1/5}', 'per sub-catchment', null, 'min', 'MSMA2 overland flow');
    S.v('t_d', 'Drain flow time', 't_d = L_c / (60 V), V = R^{2/3} S_c^{1/2}/n', 'per sub-catchment', null, 'min', 'Manning');
    S.sc = {};
    sc.forEach(c => {
      const to0 = 107 * c.nPre * Math.cbrt(c.L) / Math.pow(c.S, 0.2), to1 = 107 * c.nPost * Math.cbrt(c.L) / Math.pow(c.S, 0.2);
      const v0 = Math.pow(I.R0, 2/3) * Math.sqrt(c.Sc / 100) / I.nch0, v1 = Math.pow(I.R1, 2/3) * Math.sqrt(c.Sc / 100) / I.nch1;
      let t0 = Math.max(5, to0 + c.Lc / (60 * v0)), t1 = Math.max(5, to1 + c.Lc / (60 * v1));
      if (I.meth.startsWith('Kirpich')){ const Lt = +c.L + +c.Lc, Sa = (c.S * c.L + c.Sc * c.Lc) / Lt / 100; t0 = t1 = Math.max(5, 0.0195 * Math.pow(Lt, 0.77) * Math.pow(Sa, -0.385)); }
      S.sc[c.id] = {pre: t0, post: t1}; maxPost = Math.max(maxPost, t1); maxPre = Math.max(maxPre, t0);
      rows.push([c.id, f3(c.nPre)+' / '+f3(c.nPost), f0(c.L), f2(c.S), f1(to0)+' / '+f1(to1), f0(c.Lc), f2(v0)+' / '+f2(v1), f1(t0), f1(t1)]);
    });
    S.tbl('Time of concentration', ['SC','n* pre/post','L_o (m)','S (%)','t_o pre/post (min)','L_c (m)','V pre/post (m/s)','t_c pre (min)','t_c post (min)'], rows);
    S.r('tcPostMax', 'Site t_c (post, longest)', maxPost, 'min', 1); S.r('tcPreMax', 'Site t_c (pre, longest)', maxPre, 'min', 1);
    S.w('CLAUSE', 'Horton roughness n* values and overland-flow length limits to be verified against MSMA.');
    S.n(`Post-development t_c reduces from ${f0(maxPre)} to ${f0(maxPost)} min (${f0((1 - maxPost/maxPre) * 100)}%) due to drains and smoother surfaces.`);
  }});

/* ======================================================================
   RAT — rational method + pre/post comparison
   ====================================================================== */
defCalc({id:'RAT', no:'CS-HYD-004', title:'Rational Method & Pre/Post-Development Runoff', module:'m15', req:[22],
  purpose:'Peak discharge by Rational Method for each sub-catchment and the whole site; compare pre- and post-development peak flow and runoff volume.',
  codes:['MSMA2'],
  assume:['Q = C i A / 360 (Q m³/s, i mm/hr, A ha).','Whole-site peak uses site t_c (not the sum of sub-catchment peaks).','Runoff volume V = C P A ×10 (m³) for storm of duration D.'],
  criteria:['Post-development peak ≤ pre-development peak after detention (MSMA quantity control)'],
  inputs:[
    {k:'Tdet', sym:'T', l:'ARI for pre/post comparison', u:'yr', d:50, link:'IDF.Tdet'},
    {k:'Tmin', sym:'T_minor', l:'Minor ARI (drains)', u:'yr', d:10, link:'IDF.Tmin'},
    {k:'Tmaj', sym:'T_major', l:'Major ARI', u:'yr', d:100, link:'IDF.Tmaj'},
    {k:'Tcul', sym:'T_cul', l:'Culvert design ARI', u:'yr', d:50, c:'Consultant Assumption', s:'JKR / JPS — VERIFY'},
    {k:'Dv', sym:'D', l:'Storm duration for volume comparison', u:'min', d:180, c:'Consultant Assumption'},
    {k:'dsc', sym:'—', l:'Sub-catchment served by design drain', t:'s', o:()=>subcatch().map(c=>c.id), d:'SC-2', c:'Consultant Assumption'},
    {k:'csc', sym:'—', l:'Sub-catchment at culvert crossing CX-01', t:'s', o:()=>subcatch().map(c=>c.id), d:'SC-2', c:'Consultant Assumption'},
  ],
  run(I, S, P, R){
    const sc = subcatch(), tc = (R.TC && R.TC.sc) || {};
    S.v('Q', 'Rational formula', 'Q = C·i·A / 360', 'm³/s, i in mm/hr, A in ha', null, 'm³/s', 'MSMA2');
    const rows = []; let sPre = 0, sPost = 0;
    sc.forEach(c => { const t = tc[c.id] || {pre: 30, post: 20};
      const ipre = idfI(I.Tdet, t.pre), ipost = idfI(I.Tdet, t.post), imin = idfI(I.Tmin, t.post), imaj = idfI(I.Tmaj, t.post), icul = idfI(I.Tcul, t.post);
      const qpre = c.cPre * ipre * c.area / 360, qpost = c.cPost * ipost * c.area / 360, qmin = c.cPost * imin * c.area / 360, qmaj = c.cPost * imaj * c.area / 360, qcul = c.cPost * icul * c.area / 360;
      c._q = {qpre, qpost, qmin, qmaj, qcul}; sPre += qpre; sPost += qpost;
      rows.push([c.id, f2(c.area), f1(t.pre)+' / '+f1(t.post), f0(ipre)+' / '+f0(ipost), f3(qpre), f3(qpost), f3(qmin), f3(qmaj)]); });
    S.tbl(`Sub-catchment peaks (T = ${I.Tdet} yr pre/post; minor ${I.Tmin} yr; major ${I.Tmaj} yr)`, ['SC','A (ha)','t_c pre/post','i pre/post (mm/hr)','Q_pre','Q_post','Q_minor','Q_major'], rows.concat([['Σ (non-concurrent)','','','',f3(sPre),f3(sPost),'','']]));
    S.h('Whole-site comparison (T = ' + I.Tdet + ' yr)');
    const A = R.CAT ? R.CAT.res.A : sum(sc.map(c => c.area)), Cp = R.CAT ? R.CAT.res.Cpre : 0.4, Cq = R.CAT ? R.CAT.res.Cpost : 0.5;
    const tp = R.TC ? R.TC.res.tcPreMax : 60, tq = R.TC ? R.TC.res.tcPostMax : 40;
    const ip = S.v('i_pre', 'Intensity at t_c,pre', 'i = IDF(T, t_c,pre)', `T = ${I.Tdet}, t_c = ${f1(tp)} min`, idfI(I.Tdet, tp), 'mm/hr', 'MSMA2', 1);
    const iq = S.v('i_post', 'Intensity at t_c,post', 'i = IDF(T, t_c,post)', `T = ${I.Tdet}, t_c = ${f1(tq)} min`, idfI(I.Tdet, tq), 'mm/hr', 'MSMA2', 1);
    const Qp = S.v('Q_pre', 'Pre-development peak', 'Q = C_pre i_pre A/360', `${f3(Cp)}×${f1(ip)}×${f2(A)}/360`, Cp * ip * A / 360, 'm³/s', 'MSMA2', 3);
    const Qq = S.v('Q_post', 'Post-development peak', 'Q = C_post i_post A/360', `${f3(Cq)}×${f1(iq)}×${f2(A)}/360`, Cq * iq * A / 360, 'm³/s', 'MSMA2', 3);
    const PD = idfI(I.Tdet, I.Dv) * I.Dv / 60;
    const Pd = S.v('P_D', `Storm depth (D = ${I.Dv} min)`, 'P = i(T, D)·D/60', `${f1(idfI(I.Tdet, I.Dv))}×${I.Dv}/60`, PD, 'mm', '', 1);
    const Vp = S.v('V_pre', 'Runoff volume (pre)', 'V = C_pre P A ×10', `${f3(Cp)}×${f1(Pd)}×${f2(A)}×10`, Cp * Pd * A * 10, 'm³', '', 0);
    const Vq = S.v('V_post', 'Runoff volume (post)', 'V = C_post P A ×10', `${f3(Cq)}×${f1(Pd)}×${f2(A)}×10`, Cq * Pd * A * 10, 'm³', '', 0);
    const dQ = S.v('ΔQ', 'Increase in peak flow', 'ΔQ = (Q_post/Q_pre − 1)×100', '', (Qq / Qp - 1) * 100, '%', '', 1);
    const dV = S.v('ΔV', 'Increase in runoff volume', 'ΔV = (V_post/V_pre − 1)×100', '', (Vq / Vp - 1) * 100, '%', '', 1);
    S.r('Qpre', 'Pre-development peak', Qp, 'm³/s', 3); S.r('Qpost', 'Post-development peak', Qq, 'm³/s', 3); S.r('Vpre', 'Runoff volume (pre)', Vp, 'm³', 0); S.r('Vpost', 'Runoff volume (post)', Vq, 'm³', 0);
    S.r('dQ', 'Increase in peak flow', dQ, '%', 1); S.r('dV', 'Increase in runoff volume', dV, '%', 1);
    const ds = sc.find(c => c.id === I.dsc) || sc[0], cs = sc.find(c => c.id === I.csc) || sc[0];
    if (ds) S.r('Qdrain', `Design drain flow (${ds.id}, ${I.Tmin}-yr)`, ds._q.qmin, 'm³/s', 3);
    if (cs) S.r('Qcul', `Culvert flow (${cs.id}, ${I.Tcul}-yr)`, cs._q.qcul, 'm³/s', 3);
    S.r('QpostMaj', 'Post-dev major peak (site)', Cq * idfI(I.Tmaj, tq) * A / 360, 'm³/s', 3);
    S.r('Cpost', 'C post', Cq, '', 3); S.r('Cpre', 'C pre', Cp, '', 3); S.r('A', 'Area', A, 'ha', 2); S.r('tcPost', 't_c post', tq, 'min', 1); S.r('tcPre', 't_c pre', tp, 'min', 1);
    S.ari = [2,5,10,20,50,100].map(T => [T, Cp * idfI(T, tp) * A / 360, Cq * idfI(T, tq) * A / 360]);
    S.n(`Increase in Peak Flow: ${f1(dQ)}% (${f2(Qp)} → ${f2(Qq)} m³/s). Increase in Runoff Volume: ${f1(dV)}% (${f0(Vp)} → ${f0(Vq)} m³). Detention required to limit post-development peak to pre-development level.`);
    S.w('JPS', 'Results depend on demonstration IDF coefficients — JPS DATA REQUIRED.');
  }});

/* ======================================================================
   MAN — Manning drain check (+ velocity)
   ====================================================================== */
defCalc({id:'MAN', no:'CS-HYD-005', title:'Open Drain — Manning Capacity & Velocity Check', module:'m16', req:[25],
  purpose:'Check the proposed drain section for conveyance capacity with freeboard, and for self-cleansing and erosion velocity limits.',
  codes:['MSMA2','JKR_RDRAIN'],
  assume:['Uniform flow (Manning).','Permissible velocities by lining are consultant values — VERIFY against MSMA.'],
  criteria:['Q_cap (at D − freeboard) ≥ Q_design','V_min ≤ V ≤ V_max(lining)'],
  inputs:[
    {k:'Q', sym:'Q_d', l:'Design discharge', u:'m³/s', d:1, link:'RAT.Qdrain'},
    {k:'shape', sym:'—', l:'Section', t:'s', o:['Trapezoidal','Rectangular'], d:'Trapezoidal', c:'Consultant Assumption'},
    {k:'lin', sym:'—', l:'Lining', t:'s', o:Object.keys(LINING), d:'Earth (clayey)', c:'Consultant Assumption'},
    {k:'b', sym:'b', l:'Base width', u:'m', d:1.5, c:'Contractor Provided', s:'Tender drawing (proposed)'},
    {k:'D', sym:'D', l:'Total depth', u:'m', d:1.2, c:'Contractor Provided'},
    {k:'z', sym:'z', l:'Side slope (H:1V)', u:'', d:1.5, c:'Contractor Provided'},
    {k:'S', sym:'S', l:'Longitudinal gradient', u:'m/m', d:0.005, c:'Estimated'},
    {k:'fb', sym:'f_b', l:'Required freeboard', u:'m', d:0.3, c:'Consultant Assumption'},
    {k:'vmin', sym:'V_min', l:'Self-cleansing velocity', u:'m/s', d:0.6, c:'Consultant Assumption', s:'VERIFY'},
  ],
  run(I, S){
    const L = LINING[I.lin], z = I.shape === 'Rectangular' ? 0 : I.z, geo = y => trapG(I.b, z, y);
    S.v('n', 'Manning n (' + I.lin + ')', 'table', '', L.n, '', 'MSMA2 (VERIFY)', 3);
    const yc = I.D - I.fb, g = geo(yc);
    S.v('y_d', 'Design flow depth (D − f_b)', 'y = D − f_b', `${I.D} − ${I.fb}`, yc, 'm', '', 3);
    S.v('A', 'Flow area', 'A = (b + zy)y', `(${I.b} + ${z}×${f3(yc)})×${f3(yc)}`, g.A, 'm²', '', 3);
    S.v('P', 'Wetted perimeter', 'P = b + 2y√(1+z²)', `${I.b} + 2×${f3(yc)}×√(1+${z}²)`, g.P, 'm', '', 3);
    const Rh = S.v('R', 'Hydraulic radius', 'R = A/P', `${f3(g.A)}/${f3(g.P)}`, g.A / g.P, 'm', '', 3);
    const Qc = S.v('Q_cap', 'Capacity at design depth', 'Q = (1/n)AR^{2/3}S^{1/2}', `(1/${L.n})×${f3(g.A)}×${f3(Rh)}^{2/3}×${I.S}^{1/2}`, manQ(g, L.n, I.S), 'm³/s', 'Manning', 3);
    S.chk({label:'Drain capacity', val: Qc, lim: I.Q, rel:'>=', unit:'m³/s', dp:3, kind:'cap', what:'drain capacity', dem:'design discharge', fix:'Drain dimensions, longitudinal gradient, lining or drainage arrangement shall be revised.'});
    const yn = normalDepth(I.Q, geo, L.n, I.S, I.D) || I.D * 2;
    S.v('y_n', 'Normal depth at Q_d', 'solve (1/n)AR^{2/3}S^{1/2} = Q_d', 'bisection', yn, 'm', '', 3);
    const gn = geo(yn), V = S.v('V', 'Velocity at Q_d', 'V = Q_d/A(y_n)', `${f3(I.Q)}/${f3(gn.A)}`, I.Q / gn.A, 'm/s', '', 2);
    const Fr = S.v('Fr', 'Froude number', 'Fr = V/√(gA/T)', '', V / Math.sqrt(G * gn.A / gn.T), '', '', 2);
    S.v('f_b,act', 'Actual freeboard', 'D − y_n', `${I.D} − ${f3(yn)}`, I.D - yn, 'm', '', 3);
    S.chk({label:'Self-cleansing velocity', val: V, lim: I.vmin, rel:'>=', unit:'m/s', dp:2, fix:'Increase gradient or reduce section width.'});
    S.chk({label:'Erosion — permissible velocity (' + I.lin + ')', val: V, lim: L.vmax, rel:'<=', unit:'m/s', dp:2, fix:'Provide erosion-resistant lining, reduce gradient (drop structures) or widen section.'});
    S.r('Qcap', 'Drain capacity', Qc, 'm³/s', 3); S.r('V', 'Velocity', V, 'm/s', 2); S.r('yn', 'Normal depth', yn, 'm', 3); S.r('Fr', 'Froude', Fr, '', 2); S.r('Q', 'Design discharge', I.Q, 'm³/s', 3);
    if (Fr > 0.8 && Fr < 1.2) S.w('DETAIL', 'Flow near critical (Fr ≈ 1) — unstable water surface; revise section.');
    S.n(`Velocity ${f2(V)} m/s vs ${I.lin.toLowerCase()} limit ${L.vmax} m/s; Froude ${f2(Fr)}.`);
  }});

/* ======================================================================
   DSZ — drain sizing (auto)
   ====================================================================== */
defCalc({id:'DSZ', no:'CS-HYD-006', title:'Drain Sizing — Calculate Required Size', module:'m16', req:[26],
  purpose:'Determine required drain dimensions for the design discharge, slope and lining; list compliant candidate sizes.',
  codes:['MSMA2'],
  assume:['For each base width, depth found by bisection on Manning such that capacity at (D − f_b) = Q; depth rounded up to 50 mm.','Candidates rejected if velocity outside [V_min, V_max].'],
  criteria:['Q_cap ≥ Q_d ; V_min ≤ V ≤ V_max'],
  inputs:[
    {k:'Q', sym:'Q_d', l:'Design discharge', u:'m³/s', d:1, link:'RAT.Qdrain'},
    {k:'S', sym:'S', l:'Gradient', u:'m/m', d:0.005, link:'MAN.S'},
    {k:'lin', sym:'—', l:'Lining', t:'s', o:Object.keys(LINING), d:'Concrete', c:'Consultant Assumption'},
    {k:'z', sym:'z', l:'Side slope', u:'', d:1.0, c:'Consultant Assumption'},
    {k:'fb', sym:'f_b', l:'Freeboard', u:'m', d:0.3, c:'Consultant Assumption'},
    {k:'vmin', sym:'V_min', l:'Self-cleansing velocity', u:'m/s', d:0.6, c:'Consultant Assumption'},
  ],
  run(I, S){
    const L = LINING[I.lin]; const rows = []; let best = null;
    S.v('y', 'Iteration', 'For b = 0.3 … 3.0 m: solve Q(y) = Q_d; D = ⌈y + f_b⌉₀.₀₅', `n = ${L.n}`, null, '', 'Manning');
    for (let b = 0.3; b <= 3.001; b += 0.1){
      const geo = y => trapG(b, I.z, y); const y = normalDepth(I.Q, geo, L.n, I.S, 5); if (!y) continue;
      const Dm = Math.ceil((y + I.fb) * 20) / 20, g = geo(y), V = I.Q / g.A, ok = V <= L.vmax && V >= I.vmin, Aex = trapG(b, I.z, Dm).A;
      rows.push([f2(b), f3(y), f2(Dm), f2(V), f2(Aex), ok ? 'OK' : (V > L.vmax ? 'V > V_max' : 'V < V_min')]);
      if (ok && (!best || Aex < best.Aex)) best = {b, y, Dm, V, Aex};
    }
    S.tbl('Candidate sizes (' + I.lin + ', z = ' + I.z + ')', ['b (m)','y_n (m)','D (m)','V (m/s)','Excav. area (m²)','Status'], rows.filter((r, k) => k % 2 === 0 || r[5] === 'OK').slice(0, 16));
    if (best){ S.v('Adopt', 'Smallest compliant section', `b × D, z = ${I.z}`, `${f2(best.b)} × ${f2(best.Dm)} m`, best.Aex, 'm² section', '', 2);
      S.r('b', 'Required base width', best.b, 'm', 2); S.r('D', 'Required depth', best.Dm, 'm', 2); S.r('V', 'Velocity', best.V, 'm/s', 2);
      S.chk({label:'Velocity within limits', val: best.V, lim: L.vmax, rel:'<=', unit:'m/s', dp:2});
      S.p(`${I.lin} trapezoidal drain b = ${f2(best.b)} m, D = ${f2(best.Dm)} m, side slope 1V:${I.z}H at S = ${I.S}.`);
      S.n(`Minimum compliant ${I.lin.toLowerCase()} drain: ${f2(best.b)} m base × ${f2(best.Dm)} m deep (V = ${f2(best.V)} m/s).`);
    } else { S.chk({label:'Compliant section found', val: 0, lim: 1, rel:'>=', fix:'No compliant section — change lining or gradient (drop structures).'}); }
  }});

/* ======================================================================
   OUT — outfall analysis
   ====================================================================== */
defCalc({id:'OUT', no:'CS-HYD-007', title:'Outfall Analysis', module:'m16', req:[],
  purpose:'Verify receiving water capacity, tailwater, outlet invert and erosion at the site outfall.',
  codes:['MSMA2','JPS_RR'],
  assume:['Receiving channel uniform-flow capacity by Manning at bank-full less freeboard.'],
  criteria:['Capacity ≥ upstream flow + site discharge','Outlet invert ≥ design tailwater (free outfall)','Exit velocity ≤ receiving bed permissible'],
  inputs:[
    {k:'rw', sym:'—', l:'Receiving water', t:'x', d:'Unnamed tributary (JPS reserve) — DEMO', c:'Estimated'},
    {k:'Qs', sym:'Q_site', l:'Site discharge (post-detention)', u:'m³/s', d:10, link:'DET.Qo'},
    {k:'Qu', sym:'Q_us', l:'Upstream flow in receiving channel', u:'m³/s', d:12, c:'Estimated', s:'JPS DATA REQUIRED'},
    {k:'b', sym:'b', l:'Receiving channel base width', u:'m', d:6, c:'Estimated', s:'Outfall survey required'},
    {k:'z', sym:'z', l:'Side slope', u:'', d:2, c:'Estimated'},
    {k:'H', sym:'H', l:'Bank-full depth', u:'m', d:3.0, c:'Estimated'},
    {k:'S', sym:'S', l:'Bed slope', u:'m/m', d:0.002, c:'Estimated'},
    {k:'n', sym:'n', l:'Manning n', u:'', d:0.035, c:'Consultant Assumption'},
    {k:'inv', sym:'IL_out', l:'Outlet invert level', u:'m RL', d:10.40, c:'Estimated'},
    {k:'tw', sym:'TW', l:'Design tailwater level', u:'m RL', d:10.10, c:'Estimated', s:'JPS DATA REQUIRED'},
    {k:'vb', sym:'V_bed', l:'Permissible velocity of receiving bed', u:'m/s', d:1.5, c:'Consultant Assumption'},
  ],
  run(I, S){
    const g = trapG(I.b, I.z, I.H - 0.5);
    const Qc = S.v('Q_cap', 'Receiving channel capacity (H − 0.5 m)', 'Q = (1/n)AR^{2/3}S^{1/2}', `A = ${f2(g.A)}, R = ${f3(g.A/g.P)}`, manQ(g, I.n, I.S), 'm³/s', 'Manning', 2);
    const Qt = S.v('Q_tot', 'Combined flow', 'Q = Q_us + Q_site', `${I.Qu} + ${f2(I.Qs)}`, I.Qu + I.Qs, 'm³/s', '', 2);
    S.chk({label:'Downstream capacity', val: Qc, lim: Qt, rel:'>=', unit:'m³/s', kind:'cap', what:'receiving channel capacity', dem:'combined flow', fix:'Downstream improvement works or reduced site discharge (larger detention).'});
    S.chk({label:'Outlet invert above tailwater (free outfall)', val: I.inv, lim: I.tw, rel:'>=', unit:'m RL', dp:2, fix:'Backwater: design outlet for submerged condition / flap valve.'});
    const yn = normalDepth(Qt, y => trapG(I.b, I.z, y), I.n, I.S, I.H) || I.H;
    const V = S.v('V', 'Channel velocity at Q_tot', 'V = Q/A(y_n)', `y_n = ${f2(yn)} m`, Qt / trapG(I.b, I.z, yn).A, 'm/s', '', 2);
    S.chk({label:'Receiving bed erosion', val: V, lim: I.vb, rel:'<=', unit:'m/s', dp:2, fix:'Provide outfall apron / bank protection (see scour protection).'});
    S.r('Qcap', 'Receiving capacity', Qc, 'm³/s', 2); S.r('V', 'Receiving velocity', V, 'm/s', 2);
    S.w('AUTH', 'Outfall into JPS-reserve watercourse requires JPS approval; downstream capacity and tailwater to be confirmed by survey / JPS data.');
    S.n(`Receiving water: ${I.rw}. Capacity ${f1(Qc)} m³/s vs combined ${f1(Qt)} m³/s. No drainage design is complete without confirmation of these outfall parameters.`);
  }});

/* ======================================================================
   CUL — culvert hydraulics
   ====================================================================== */
function culvertHW(I, D, nb, Q){
  const box = I.type === 'Box';
  const A = box ? I.Bw * D : Math.PI * D * D / 4, P = box ? 2 * (I.Bw + D) : Math.PI * D, R = A / P;
  const Qb = Q / nb, V = Qb / A;
  let dc; if (box){ dc = Math.min(Math.cbrt((Qb / I.Bw)**2 / G), D); } else { dc = bisect(y => { const g = circG(D, y); return Qb * Qb * g.T / (G * g.A**3) - 1; }, 0.01 * D, 0.999 * D) || D; }
  const Hl = (1 + I.ke + 19.63 * I.n * I.n * I.L / Math.pow(R, 4/3)) * V * V / (2 * G);
  const ho = Math.max(I.TW, (dc + D) / 2), HWo = ho + Hl - I.S0 * I.L;
  const Hor = D / 2 + Math.pow(Qb / (0.6 * A), 2) / (2 * G), Hwe = Math.pow(Qb / (1.6 * (box ? I.Bw : D)), 2/3);
  const HWi = Hwe <= 1.2 * D ? Math.min(Hwe, Hor) : Hor;
  const Qfull = manQ({A, P}, I.n, I.S0) * nb;
  return {A, P, R, V, dc, Hl, ho, HWo, HWi, HW: Math.max(HWo, HWi), Qfull, ctrl: HWo >= HWi ? 'Outlet control' : 'Inlet control'};
}
defCalc({id:'CUL', no:'CS-HYD-008', title:'Culvert Hydraulics', module:'m17', req:[27],
  purpose:'Screen culvert barrel capacity, velocity and headwater under inlet and outlet control.',
  codes:['HDS5','JKR_RDRAIN','MSMA2'],
  assume:['Outlet control: HW = h_o + H − S₀L, H = [1 + k_e + 19.63n²L/R^{4/3}]V²/2g, h_o = max(TW, (d_c + D)/2) (HDS-5 approach).','Inlet control: weir (unsubmerged) / orifice C_d = 0.6 (submerged) — screening only.'],
  criteria:['HW ≤ allowable HW (road level − inlet invert − freeboard)','HW/D ≤ 1.2 (screening criterion)'],
  inputs:[
    {k:'Q', sym:'Q', l:'Design discharge', u:'m³/s', d:4, link:'RAT.Qcul'},
    {k:'type', sym:'—', l:'Culvert type', t:'s', o:['Pipe','Box'], d:'Pipe', c:'Consultant Assumption'},
    {k:'D', sym:'D', l:'Diameter / box height', u:'m', d:1.2, c:'Consultant Assumption'},
    {k:'Bw', sym:'B', l:'Box width (box only)', u:'m', d:2.0, c:'Consultant Assumption'},
    {k:'nb', sym:'n_b', l:'Number of barrels', u:'no.', d:4, c:'Consultant Assumption'},
    {k:'L', sym:'L', l:'Barrel length', u:'m', d:20, c:'Estimated'},
    {k:'S0', sym:'S₀', l:'Barrel slope', u:'m/m', d:0.005, c:'Estimated'},
    {k:'n', sym:'n', l:'Manning n', u:'', d:0.013, c:'Consultant Assumption'},
    {k:'ke', sym:'k_e', l:'Entrance loss coefficient', u:'', d:0.5, c:'Consultant Assumption', s:'Square edge with headwall'},
    {k:'TW', sym:'TW', l:'Tailwater depth above outlet invert', u:'m', d:0.8, c:'Estimated'},
    {k:'HWa', sym:'HW_all', l:'Allowable headwater', u:'m', d:1.8, c:'Estimated', s:'Road formation level − invert − freeboard'},
    {k:'nx', sym:'n_x', l:'Number of similar crossings', u:'no.', d:8, c:'Estimated'},
  ],
  run(I, S){
    const r = culvertHW(I, I.D, I.nb, I.Q);
    S.v('A', 'Barrel area', I.type === 'Box' ? 'A = B·D' : 'A = πD²/4', '', r.A, 'm²', '', 3);
    S.v('Q_full', 'Full-flow capacity (all barrels)', 'n_b(1/n)AR^{2/3}S₀^{1/2}', `R = ${f3(r.R)}`, r.Qfull, 'm³/s', 'Manning', 3);
    const V = S.v('V', 'Barrel velocity', 'V = Q/(n_b A)', `${f3(I.Q)}/(${I.nb}×${f3(r.A)})`, r.V, 'm/s', '', 2);
    S.v('d_c', 'Critical depth', 'Q²T/(gA³) = 1', 'iterative', r.dc, 'm', '', 3);
    S.v('H', 'Barrel losses', 'H = [1 + k_e + 19.63n²L/R^{4/3}]V²/2g', `[1 + ${I.ke} + 19.63×${I.n}²×${I.L}/${f3(r.R)}^{4/3}]×${f2(V)}²/19.62`, r.Hl, 'm', 'HDS5', 3);
    const HWo = S.v('HW_o', 'Outlet-control headwater', 'HW = h_o + H − S₀L', `${f3(r.ho)} + ${f3(r.Hl)} − ${I.S0}×${I.L}`, r.HWo, 'm', 'HDS5', 3);
    const HWi = S.v('HW_i', 'Inlet-control headwater (screening)', 'weir / orifice', `C_d = 0.6`, r.HWi, 'm', 'HDS5 (screening)', 3);
    const HW = S.v('HW', 'Controlling headwater', 'HW = max(HW_o, HW_i)', r.ctrl, r.HW, 'm', '', 3);
    S.chk({label:'Headwater ≤ allowable', val: HW, lim: I.HWa, rel:'<=', unit:'m', dp:2, fix:'Increase barrel size / number or lower invert.'});
    S.chk({label:'HW/D ≤ 1.2', val: HW / I.D, lim: 1.2, rel:'<=', dp:2, fix:'Upsize culvert.'});
    S.chk({label:'Outlet velocity (scour)', val: V, lim: 4.5, rel:'<=', unit:'m/s', dp:2, fix:'Energy dissipator required.'});
    const opts = [];
    [0.6,0.75,0.9,1.05,1.2,1.35,1.5,1.8].forEach(D => [1,2,3,4].forEach(nb => { const x = culvertHW(I, D, nb, I.Q); if (x.HW <= I.HWa && x.HW / D <= 1.2 && x.V <= 4.5) opts.push([D, nb, x]); }));
    opts.sort((a, b) => a[1] * a[0]**2 - b[1] * b[0]**2);
    S.tbl('Auto-sizing — compliant options (smallest total area first)', ['D (m)','Barrels','HW (m)','HW/D','V (m/s)','Control'], opts.slice(0, 6).map(([D, nb, x]) => [f2(D), nb, f2(x.HW), f2(x.HW / D), f2(x.V), x.ctrl]));
    S.r('HW', 'Headwater', HW, 'm', 2); S.r('V', 'Barrel velocity', V, 'm/s', 2); S.r('Vout', 'Outlet velocity', V, 'm/s', 2); S.r('D', 'Diameter / height', I.D, 'm', 2); S.r('Q', 'Design flow', I.Q, 'm³/s', 3); S.r('nx', 'Crossings', I.nx, 'no.', 0);
    if (HW / I.D > 1.2 || I.TW > 0.8 * I.D) S.w('DETAIL', 'Dedicated hydraulic modelling (e.g. HY-8 / HEC-RAS) is required: high headwater or tailwater influence.');
    S.q(I.type === 'Box' ? 'DR_BOX' : 'DR_PIPE', I.L * I.nb * I.nx, `${I.L} m × ${I.nb} barrels × ${I.nx} crossings`);
    S.q('DR_HEADWALL', 2 * I.nx, '2 per crossing');
    S.n(`${r.ctrl} governs; HW = ${f2(HW)} m (HW/D = ${f2(HW / I.D)}) for ${I.nb} × Ø${I.D} m ${I.type.toLowerCase()} carrying ${f2(I.Q)} m³/s.`);
  }});

/* ======================================================================
   SCR — scour protection
   ====================================================================== */
defCalc({id:'SCR', no:'CS-HYD-009', title:'Scour Protection (Riprap Apron)', module:'m17', req:[32],
  purpose:'Preliminary sizing of riprap aprons at culvert and pond outlets.',
  codes:['HEC14','JPS_ESC'],
  assume:['Isbash: d₅₀ = V²/(2gC²(S_s − 1)), C = 0.86 (high turbulence).','Apron length (low tailwater): L_a = 1.8Q/D₀^{1.5} + 7D₀ (US customary units, rock outlet protection practice) converted to SI.','Layer thickness t = max(2d₅₀, 0.3 m).'],
  criteria:['Energy dissipation structure where V > 4.5 m/s or Fr > 2.5'],
  inputs:[
    {k:'V', sym:'V', l:'Outlet velocity', u:'m/s', d:2, link:'CUL.Vout'},
    {k:'Q', sym:'Q', l:'Discharge per outlet', u:'m³/s', d:2, link:'CUL.Q'},
    {k:'D0', sym:'D₀', l:'Outlet diameter / width', u:'m', d:1.2, link:'CUL.D'},
    {k:'Ss', sym:'S_s', l:'Rock specific gravity', u:'', d:2.65, c:'Consultant Assumption'},
    {k:'C', sym:'C', l:'Isbash coefficient', u:'', d:0.86, c:'Consultant Assumption'},
    {k:'no', sym:'n_o', l:'Number of outlets', u:'no.', d:9, c:'Estimated', s:'Culvert outlets + pond outlet'},
  ],
  run(I, S, P, R){
    const nb = R.CUL ? (R.CUL.I.nb || 1) : 1, Qo = I.Q / nb;
    const d50 = S.v('d₅₀', 'Median rock size', 'd₅₀ = V²/(2gC²(S_s − 1))', `${f2(I.V)}²/(2×9.81×${I.C}²×${I.Ss - 1})`, I.V**2 / (2 * G * I.C**2 * (I.Ss - 1)), 'm', 'Isbash', 3);
    const t = S.v('t', 'Layer thickness', 't = max(2d₅₀, 0.3)', '', Math.max(2 * d50, 0.3), 'm', '', 2);
    const Qc = Qo * 35.315, Df = I.D0 * 3.281;
    const La = S.v('L_a', 'Apron length', 'L_a = [1.8Q/D₀^{1.5} + 7D₀] (ft, cfs) × 0.3048', `[1.8×${f1(Qc)}/${f2(Df)}^{1.5} + 7×${f2(Df)}]×0.3048`, (1.8 * Qc / Math.pow(Df, 1.5) + 7 * Df) * 0.3048, 'm', 'Rock outlet protection (REFERENCE ONLY)', 2);
    const W = S.v('W', 'Apron end width', 'W = 3D₀ + L_a', `3×${I.D0} + ${f2(La)}`, 3 * I.D0 + La, 'm', '', 2);
    const Vr = S.v('V_r', 'Riprap volume (all outlets)', 'V = n_o·L_a·(3D₀ + W)/2·t', `${I.no}×${f2(La)}×(${f2(3*I.D0)} + ${f2(W)})/2×${f2(t)}`, I.no * La * (3 * I.D0 + W) / 2 * t, 'm³', '', 1);
    S.chk({label:'Outlet velocity for riprap-only protection', val: I.V, lim: 4.5, rel:'<=', unit:'m/s', dp:2, fix:'Impact / stilling basin energy dissipator required.'});
    S.r('d50', 'Riprap d₅₀', d50, 'm', 3); S.r('La', 'Apron length', La, 'm', 2); S.r('Vr', 'Riprap volume', Vr, 'm³', 1);
    S.q('DR_RIPRAP', Vr, 'Outlet aprons');
    S.p(`Riprap d₅₀ ≥ ${f0(Math.max(d50, 0.15) * 1000)} mm, ${f2(t)} m thick on geotextile, apron ${f1(La)} m long.`);
  }});

/* ======================================================================
   DET — detention pond (modified rational, critical duration)
   ====================================================================== */
function pondVol(W, r, z, H){ const L = r * W, Ab = W * L, At = (W + 2 * z * H) * (L + 2 * z * H), Am = (W + z * H) * (L + z * H); return H / 6 * (Ab + 4 * Am + At); }
defCalc({id:'DET', no:'CS-HYD-010', title:'Detention Pond Sizing', module:'m18', req:[28],
  purpose:'Size detention storage to limit post-development peak discharge to the allowable outflow, with pond geometry, outlet and spillway.',
  codes:['MSMA2'],
  assume:['Modified rational method: S(d) = Q_in(d)·d − ½Q_o(d + t_c); required storage = max over storm durations (critical duration).','Pond: rectangular, L/W ratio r, side slope z; prismoidal volume.','Orifice Q = C_d A√(2gh); broad-crested weir Q = C L H^{1.5}.'],
  criteria:['Q_out ≤ k·Q_pre (allowable)','Freeboard above spillway design level'],
  inputs:[
    {k:'Qpre', sym:'Q_pre', l:'Pre-development peak', u:'m³/s', d:10, link:'RAT.Qpre'},
    {k:'k', sym:'k', l:'Allowable outflow factor (Q_o = k·Q_pre)', u:'', d:1.0, c:'Consultant Assumption', s:'MSMA / JPS — ENGINEER CONFIRMATION'},
    {k:'A', sym:'A', l:'Catchment area', u:'ha', d:185, link:'RAT.A'},
    {k:'C', sym:'C_post', l:'Post-development C', u:'', d:0.5, link:'RAT.Cpost'},
    {k:'tc', sym:'t_c', l:'Post-development t_c', u:'min', d:30, link:'RAT.tcPost'},
    {k:'T', sym:'T', l:'Detention ARI', u:'yr', d:50, link:'IDF.Tdet'},
    {k:'H', sym:'H', l:'Live storage depth', u:'m', d:2.0, c:'Consultant Assumption'},
    {k:'z', sym:'z', l:'Side slope (H:1V)', u:'', d:3, c:'Consultant Assumption'},
    {k:'r', sym:'r', l:'Length/width ratio', u:'', d:2, c:'Consultant Assumption'},
    {k:'Cd', sym:'C_d', l:'Orifice coefficient', u:'', d:0.6, c:'Consultant Assumption'},
    {k:'Qmaj', sym:'Q_maj', l:'Major (spillway) design flow', u:'m³/s', d:20, link:'RAT.QpostMaj'},
    {k:'Hs', sym:'H_s', l:'Spillway design head', u:'m', d:0.5, c:'Consultant Assumption'},
    {k:'Cw', sym:'C_w', l:'Weir coefficient', u:'', d:1.7, c:'Consultant Assumption'},
    {k:'fb', sym:'f_b', l:'Freeboard above spillway flood level', u:'m', d:0.3, c:'Consultant Assumption'},
  ],
  run(I, S){
    const Qo = S.v('Q_o', 'Allowable outflow', 'Q_o = k·Q_pre', `${I.k}×${f3(I.Qpre)}`, I.k * I.Qpre, 'm³/s', 'MSMA2', 3);
    S.h('1. Critical storm duration (iteration)');
    const durs = [10,15,20,30,45,60,90,120,180,240,360]; let best = {S: -1}; const rows = [];
    durs.filter(d => d >= Math.min(I.tc, 10)).forEach(d => { const i = idfI(I.T, d), Qin = I.C * i * I.A / 360, Vin = Qin * d * 60, Vout = 0.5 * Qo * (d + I.tc) * 60, St = Vin - Vout;
      rows.push([d, f1(i), f3(Qin), f0(Vin), f0(Vout), f0(St)]); if (St > best.S) best = {S: St, d, Qin}; });
    S.tbl('Modified rational iteration', ['d (min)','i (mm/hr)','Q_in (m³/s)','V_in (m³)','V_out (m³)','Storage (m³)'], rows);
    const Vreq = S.v('V_req', 'Required storage (critical duration ' + best.d + ' min)', 'V = max_d[Q_in(d)·d − ½Q_o(d + t_c)]·60', '', Math.max(best.S, 0), 'm³', 'Modified rational', 0);
    S.h('2. Pond geometry');
    const W = bisect(w => pondVol(w, I.r, I.z, I.H) - Vreq, 0.5, 2000) || 1;
    const Wb = S.v('W', 'Pond bottom width', 'solve V(W) = V_req, V = H/6(A_b + 4A_m + A_t)', `r = ${I.r}, z = ${I.z}, H = ${I.H}`, W, 'm', 'Prismoidal', 1);
    const Ht = I.H + I.Hs + I.fb, Wt = W + 2 * I.z * Ht, Lt = I.r * W + 2 * I.z * Ht;
    const Ap = S.v('A_p', 'Pond footprint (top of bank)', '(W + 2zH_t)(rW + 2zH_t)', `H_t = ${f2(Ht)} m`, Wt * Lt, 'm²', '', 0);
    const st = []; for (let h = 0.25; h <= Ht + 1e-6; h += 0.25) st.push([f2(h), f0(pondVol(W, I.r, I.z, h)), f0((W + 2*I.z*h) * (I.r*W + 2*I.z*h))]);
    S.tbl('Stage–storage', ['Depth (m)','Storage (m³)','Water surface area (m²)'], st);
    S.h('3. Outlet & spillway');
    const h = I.H;
    const Ao = S.v('A_o', 'Orifice area', 'A_o = Q_o/(C_d√(2gh)), h ≈ H', `${f3(Qo)}/(${I.Cd}√(2×9.81×${h}))`, Qo / (I.Cd * Math.sqrt(2 * G * h)), 'm²', '', 4);
    const Do = S.v('D_o', 'Orifice diameter (rounded down 25 mm)', 'D = ⌊√(4A_o/π)⌋₀.₀₂₅', '', Math.floor(Math.sqrt(4 * Ao / Math.PI) / 0.025) * 0.025, 'm', '', 3);
    const Qact = S.v('Q_o,act', 'Actual outflow at H', 'C_d(πD²/4)√(2g(H − D/2))', '', I.Cd * Math.PI * Do * Do / 4 * Math.sqrt(2 * G * (h - Do / 2)), 'm³/s', '', 3);
    S.chk({label:'Outflow ≤ allowable', val: Qact, lim: Qo, rel:'<=', unit:'m³/s', dp:3});
    const Ls = S.v('L_s', 'Spillway length', 'L = Q_maj/(C_w H_s^{1.5})', `${f2(I.Qmaj)}/(${I.Cw}×${I.Hs}^{1.5})`, I.Qmaj / (I.Cw * Math.pow(I.Hs, 1.5)), 'm', '', 1);
    S.r('Vreq', 'Required storage', Vreq, 'm³', 0); S.r('pondArea', 'Pond footprint', Ap, 'm²', 0); S.r('W', 'Bottom width', W, 'm', 1); S.r('Do', 'Orifice diameter', Do, 'm', 3); S.r('Ls', 'Spillway length', Ls, 'm', 1); S.r('Qo', 'Outflow', Qact, 'm³/s', 3); S.r('dcrit', 'Critical duration', best.d, 'min', 0);
    S.q('DR_POND_EXC', pondVol(W, I.r, I.z, Ht), 'Excavation to top of bank');
    S.q('DR_OUTLET', 1); S.q('DR_SPILL', 1); S.q('EW_TURF', Ap * 0.6, 'Pond slopes turfing');
    S.n(`Required detention storage ${f0(Vreq)} m³ (critical duration ${best.d} min); pond ${f0(W)} × ${f0(I.r * W)} m base, footprint ${f2(Ap / 1e4)} ha (${f1(Ap / 1e4 / ((+P.info.landArea)||1) * 100)}% of site).`);
    S.p(`Detention pond ${f0(Vreq)} m³ live storage, ${I.H} m deep, orifice Ø${f0(Do * 1000)} mm, spillway ${f1(Ls)} m.`);
    S.w('ENG', 'Allowable outflow criterion (k·Q_pre) and detention ARI require Engineer / JPS confirmation. Hydrograph routing recommended at detailed design.');
    S.ti('Pond size is sensitive to IDF coefficients and pre-development C — carry provisional quantities.');
  }});

/* ======================================================================
   OSD — on-site detention for compound
   ====================================================================== */
defCalc({id:'OSD', no:'CS-HYD-012', title:'On-Site Detention (Compound Scale)', module:'m18', req:[29],
  purpose:'Preliminary OSD storage for the substation / BESS / building compound where it discharges separately.',
  codes:['MSMA2'],
  assume:['Computed by modified rational critical-duration method; MSMA OSD PSD/SSR tables not reproduced — CLAUSE VERIFICATION REQUIRED.'],
  criteria:['Site discharge ≤ permissible site discharge (PSD)'],
  inputs:[
    {k:'A', sym:'A', l:'Compound area', u:'ha', d:()=> (subcatch().find(c=>c.id==='SC-6')||{area:10}).area, c:'Estimated'},
    {k:'Cp', sym:'C_pre', l:'C pre', u:'', d:0.35, c:'Consultant Assumption'},
    {k:'Cq', sym:'C_post', l:'C post', u:'', d:0.80, c:'Consultant Assumption'},
    {k:'tp', sym:'t_c,pre', l:'t_c pre', u:'min', d:25, c:'Estimated'},
    {k:'tq', sym:'t_c,post', l:'t_c post', u:'min', d:12, c:'Estimated'},
    {k:'T', sym:'T', l:'ARI', u:'yr', d:10, link:'IDF.Tmin'},
  ],
  run(I, S){
    const psd = S.v('PSD', 'Permissible site discharge', 'PSD = C_pre i(T, t_c,pre) A/360', `${I.Cp}×${f1(idfI(I.T, I.tp))}×${I.A}/360`, I.Cp * idfI(I.T, I.tp) * I.A / 360, 'm³/s', '', 3);
    let best = {S: 0, d: 0}; const rows = [];
    [10,15,20,30,45,60,90,120,180].forEach(d => { const Qin = I.Cq * idfI(I.T, d) * I.A / 360, St = (Qin * d - 0.5 * psd * (d + I.tq)) * 60; rows.push([d, f3(Qin), f0(St)]); if (St > best.S) best = {S: St, d}; });
    S.tbl('Critical duration', ['d (min)','Q_in (m³/s)','Storage (m³)'], rows);
    const V = S.v('SSR', 'Site storage requirement', 'max storage', `d_crit = ${best.d} min`, best.S, 'm³', '', 0);
    S.r('psd', 'PSD', psd, 'm³/s', 3); S.r('ssr', 'Storage', V, 'm³', 0); S.r('ssrHa', 'Storage per ha', V / I.A, 'm³/ha', 0);
    S.w('CLAUSE', 'MSMA OSD PSD/SSR relationships to be verified; OSD applicability for utility compounds to be agreed with JPS.');
    S.n(`OSD for compound: ${f0(V)} m³ (${f0(V / I.A)} m³/ha), PSD ${f3(psd)} m³/s. May be provided within the main detention pond if the compound drains to it.`);
  }});

/* ======================================================================
   RET — retention / infiltration screening
   ====================================================================== */
defCalc({id:'RET', no:'CS-HYD-013', title:'Retention / Infiltration Screening', module:'m18', req:[30],
  purpose:'Screen feasibility of infiltration / retention for water quality volume.',
  codes:['MSMA2'],
  assume:['Water quality volume V = C·P·A·10.','Drawdown t = d_max / (f/FS).'],
  criteria:['Drawdown ≤ t_max ; groundwater separation ≥ 1.0 m ; f ≥ f_min'],
  inputs:[
    {k:'A', sym:'A', l:'Contributing area', u:'ha', d:10, c:'Estimated'},
    {k:'C', sym:'C', l:'Runoff coefficient', u:'', d:0.8, c:'Consultant Assumption'},
    {k:'P', sym:'P_wq', l:'Water quality rainfall depth', u:'mm', d:40, c:'Consultant Assumption', s:'MSMA — VERIFY'},
    {k:'f', sym:'f', l:'Infiltration rate', u:'mm/hr', d:6, c:'Unknown', s:'Percolation tests required — SI REQUIRED'},
    {k:'FS', sym:'FS', l:'Safety factor on f', u:'', d:2, c:'Consultant Assumption'},
    {k:'dm', sym:'d_max', l:'Basin storage depth', u:'m', d:0.8, c:'Consultant Assumption'},
    {k:'gw', sym:'d_gw', l:'Groundwater depth', u:'m', d:1.8, link:'GEO.gwlMin'},
    {k:'tmax', sym:'t_max', l:'Max drawdown time', u:'hr', d:72, c:'Consultant Assumption'},
  ],
  run(I, S){
    const V = S.v('V_wq', 'Water quality volume', 'V = C P A ×10', `${I.C}×${I.P}×${I.A}×10`, I.C * I.P * I.A * 10, 'm³', '', 0);
    const Ab = S.v('A_b', 'Basin area', 'A = V/d_max', `${f0(V)}/${I.dm}`, V / I.dm, 'm²', '', 0);
    const t = S.v('t', 'Drawdown time', 't = d_max·1000/(f/FS)', `${I.dm}×1000/(${I.f}/${I.FS})`, I.dm * 1000 / (I.f / I.FS), 'hr', '', 1);
    S.chk({label:'Drawdown time', val: t, lim: I.tmax, rel:'<=', unit:'hr', dp:1, fix:'Infiltration not feasible — use detention with water-quality forebay / wetland.'});
    S.chk({label:'Groundwater separation', val: I.gw - I.dm, lim: 1.0, rel:'>=', unit:'m', dp:2, fix:'Infiltration not feasible — shallow groundwater.'});
    S.r('Vwq', 'WQ volume', V, 'm³', 0); S.r('t', 'Drawdown', t, 'hr', 1);
    S.n(t > I.tmax || I.gw - I.dm < 1 ? 'Infiltration screening indicates infiltration is NOT feasible (low permeability and/or shallow groundwater); retention via detention pond permanent pool / wetland recommended.' : 'Infiltration feasible subject to percolation tests.');
  }});

/* ======================================================================
   ESC — ESCP sizing
   ====================================================================== */
defCalc({id:'ESC', no:'CS-ESC-001', title:'ESCP — Sediment Basins, Silt Traps, Check Dams', module:'m20', req:[33],
  purpose:'Preliminary sizing of erosion and sediment control measures for the construction phase.',
  codes:['JPS_ESC','LDP2M2','MSMA2'],
  assume:['Sediment basin surface area A_s = 1.2 Q/v_s (settling of design particle).','Sediment storage = yield × disturbed area.','Check dam spacing s = h/S.'],
  criteria:['Sediment basin per contributing area ≤ A_basin; silt traps for small catchments'],
  inputs:[
    {k:'Ad', sym:'A_d', l:'Disturbed area (peak)', u:'ha', d:60, c:'Estimated', s:'Construction staging'},
    {k:'Ab', sym:'A_cb', l:'Contributing area per basin', u:'ha', d:5, c:'Consultant Assumption'},
    {k:'T', sym:'T', l:'ESC design ARI', u:'yr', d:2, c:'Consultant Assumption', s:'JPS ESC guideline — VERIFY'},
    {k:'tc', sym:'t_c', l:'Design t_c', u:'min', d:20, c:'Consultant Assumption'},
    {k:'C', sym:'C', l:'Runoff coefficient (bare soil)', u:'', d:0.6, c:'Consultant Assumption'},
    {k:'vs', sym:'v_s', l:'Settling velocity of design particle', u:'m/s', d:0.00081, c:'Consultant Assumption', s:'0.03 mm silt (Stokes) — VERIFY design particle'},
    {k:'dz', sym:'d_s', l:'Settling zone depth', u:'m', d:1.0, c:'Consultant Assumption'},
    {k:'Y', sym:'Y', l:'Sediment yield (construction period)', u:'m³/ha', d:120, c:'Estimated'},
    {k:'Ltd', sym:'L_td', l:'Temporary drains', u:'m', d:9000, c:'Estimated'},
    {k:'Sd', sym:'S', l:'Temporary drain gradient', u:'m/m', d:0.01, c:'Estimated'},
    {k:'hc', sym:'h', l:'Check dam height', u:'m', d:0.5, c:'Consultant Assumption'},
    {k:'Lsf', sym:'L_sf', l:'Silt fence length', u:'m', d:7500, c:'Estimated'},
    {k:'nst', sym:'n_st', l:'Silt traps per 10 ha disturbed', u:'no.', d:4, c:'Consultant Assumption'},
  ],
  run(I, S){
    const i = idfI(I.T, I.tc);
    const Q = S.v('Q', 'Design flow per basin', 'Q = C i A_cb/360', `${I.C}×${f1(i)}×${I.Ab}/360`, I.C * i * I.Ab / 360, 'm³/s', 'MSMA2', 3);
    const As = S.v('A_s', 'Basin surface area', 'A_s = 1.2 Q/v_s', `1.2×${f3(Q)}/${I.vs}`, 1.2 * Q / I.vs, 'm²', 'JPS ESC (VERIFY)', 0);
    const nB = S.v('n_B', 'Number of basins', 'n = ⌈A_d/A_cb⌉', `⌈${I.Ad}/${I.Ab}⌉`, Math.ceil(I.Ad / I.Ab), 'no.', '', 0);
    const Vss = S.v('V_sed', 'Sediment storage per basin', 'V = Y·A_cb', `${I.Y}×${I.Ab}`, I.Y * I.Ab, 'm³', '', 0);
    const Vb = S.v('V_b', 'Basin volume per basin', 'V_b = A_s d_s + V_sed', `${f0(As)}×${I.dz} + ${f0(Vss)}`, As * I.dz + Vss, 'm³', '', 0);
    const sp = S.v('s_cd', 'Check dam spacing', 's = h/S', `${I.hc}/${I.Sd}`, I.hc / I.Sd, 'm', '', 0);
    const ncd = S.v('n_cd', 'Check dams', 'n = L_td/s', `${I.Ltd}/${f0(sp)}`, Math.ceil(I.Ltd / sp), 'no.', '', 0);
    const nst = S.v('n_st', 'Silt traps', 'n = n_st·A_d/10', `${I.nst}×${I.Ad}/10`, Math.ceil(I.nst * I.Ad / 10), 'no.', '', 0);
    S.r('As', 'Basin area', As, 'm²', 0); S.r('nB', 'Basins', nB, 'no.', 0); S.r('Vb', 'Basin volume', Vb, 'm³', 0); S.r('ncd', 'Check dams', ncd, 'no.', 0);
    S.q('ES_BASIN', Vb * nB, `${nB} basins × ${f0(Vb)} m³`); S.q('ES_CHECK', ncd); S.q('ES_TRAP', nst); S.q('ES_TDRAIN', I.Ltd); S.q('ES_FENCE', I.Lsf);
    S.chk({label:'Basin area fraction of contributing area', val: As / (I.Ab * 1e4) * 100, lim: 3, rel:'<=', unit:'%', dp:2, fix:'Stage clearing to reduce contributing area; use flocculant-assisted settling.'});
    S.w('AUTH', 'ESCP / LD-P2M2 to be approved by JPS / DOE before site clearing.');
    S.n(`${nB} sediment basins of ${f0(Vb)} m³ each, ${ncd} check dams and ${nst} silt traps for ${I.Ad} ha peak disturbed area.`);
  }});

/* ======================================================================
   PAV — road pavement
   ====================================================================== */
defCalc({id:'PAV', no:'CS-RD-001', title:'Road Pavement — Granular Thickness (CBR) & Traffic', module:'m21', req:[35],
  purpose:'Determine granular pavement thickness for internal / construction roads and classify permanent traffic for JKR flexible pavement selection.',
  codes:['USACE_CBR','ATJ585','JKR_SPJ'],
  assume:['CBR method (USACE): t = α√(P/(0.05585·CBR) − A/π) mm; α = 0.23 log₁₀C + 0.15 (coverages).','Equivalent single wheel load = half axle load (dual wheels lumped).','ESA per axle = (P/80 kN)^4.'],
  criteria:['t_provided ≥ t_required over subgrade CBR','Flexible pavement for main access per JKR ATJ 5/85 (2013) catalogue — CLAUSE VERIFICATION REQUIRED'],
  inputs:[
    {k:'fun', sym:'—', l:'Road function', t:'s', o:['Internal / construction (granular)','Main access (flexible)'], d:'Internal / construction (granular)', c:'Client Provided'},
    {k:'Pa', sym:'P_axle', l:'Design axle load', u:'kN', d:100, c:'Consultant Assumption', s:'Heaviest construction axle'},
    {k:'p', sym:'p', l:'Tyre pressure', u:'kPa', d:700, c:'Consultant Assumption'},
    {k:'N', sym:'N', l:'Construction passes (design vehicle)', u:'no.', d:10000, c:'Estimated'},
    {k:'esal', sym:'ESA/day', l:'Permanent traffic (ESA per day)', u:'', d:2, c:'Estimated'},
    {k:'yrs', sym:'n', l:'Design life', u:'yr', d:25, c:'Client Provided'},
    {k:'cbr', sym:'CBR', l:'Subgrade CBR', u:'%', d:5, link:'GEO.cbrMin'},
    {k:'tb', sym:'t_base', l:'Crusher-run base (CBR ≥ 80)', u:'mm', d:150, c:'Consultant Assumption'},
    {k:'ts', sym:'t_sub', l:'Sub-base (CBR ≥ 30) provided', u:'mm', d:350, c:'Consultant Assumption'},
  ],
  run(I, S){
    const P = I.Pa / 2 * 1000, A = S.v('A_c', 'Contact area', 'A = P/p', `${f0(P)}/${I.p/1000}`, P / (I.p / 1000), 'mm²', '', 0);
    const Cv = I.N / 2, a = S.v('α', 'Repetition factor', 'α = 0.23 log₁₀(C) + 0.15, C = N/2', `C = ${f0(Cv)}`, Math.max(0.23 * Math.log10(Math.max(Cv, 10)) + 0.15, 0.4), '', 'USACE CBR', 3);
    const tq = cbr => a * Math.sqrt(Math.max(P / (0.05585 * cbr) - A / Math.PI, 0));
    const tr = S.v('t_req', 'Required granular thickness over subgrade', 't = α√(P/(0.05585·CBR) − A/π)', `${f3(a)}√(${f0(P)}/(0.05585×${I.cbr}) − ${f0(A)}/π)`, tq(I.cbr), 'mm', 'USACE CBR', 0);
    const t30 = S.v('t_30', 'Required cover over sub-base (CBR 30)', 'same, CBR = 30', '', tq(30), 'mm', '', 0);
    const tp = I.tb + I.ts;
    S.chk({label:'Total granular thickness', val: tp, lim: tr, rel:'>=', unit:'mm', dp:0, kind:'cap', what:'pavement thickness', dem:'required thickness', fix:'Increase sub-base thickness or improve subgrade (capping / stabilisation).'});
    S.chk({label:'Base thickness over sub-base', val: I.tb, lim: t30, rel:'>=', unit:'mm', dp:0});
    const esa = S.v('ESA', 'Design traffic (permanent)', 'ESA = ESA/day × 365 × n', `${I.esal}×365×${I.yrs}`, I.esal * 365 * I.yrs, 'ESA', '', 0);
    const cls = esa / 1e6 <= 1 ? 'T1' : esa / 1e6 <= 2 ? 'T2' : esa / 1e6 <= 10 ? 'T3' : esa / 1e6 <= 30 ? 'T4' : 'T5';
    S.v('Class', 'JKR traffic category (VERIFY boundaries)', 'msa bands', `${fmt(esa/1e6,3)} msa`, esa / 1e6, 'msa', 'ATJ585 — CLAUSE VERIFICATION REQUIRED', 3);
    S.r('treq', 'Required thickness', tr, 'mm', 0); S.r('tBase', 'Base thickness', I.tb, 'mm', 0); S.r('tSub', 'Sub-base thickness', I.ts, 'mm', 0); S.r('esa', 'Design ESA', esa, 'ESA', 0);
    S.curve = [2,3,4,5,6,8,10,15,20].map(c => [c, tq(c)]);
    S.p(`${I.tb} mm crusher-run base on ${I.ts} mm granular sub-base, geotextile separator on subgrade CBR ${I.cbr}%. Main access: bituminous surfacing per JKR catalogue for category ${cls}.`);
    S.n(`Required ${f0(tr)} mm total granular thickness for ${I.Pa} kN axle and ${I.N.toLocaleString()} passes on CBR ${I.cbr}%; ${f0(tp)} mm provided.`);
    S.w('SI', 'Subgrade CBR along road alignment to be confirmed by in-situ CBR / DCP.');
  }});

/* ======================================================================
   ACC — main access
   ====================================================================== */
defCalc({id:'ACC', no:'CS-RD-002', title:'Main Access — Geometry, Swept Path & Sight Distance', module:'m22', req:[],
  purpose:'Check main access gradient, swept width for the design vehicle and junction stopping sight distance.',
  codes:['ATJ886'],
  assume:['Off-tracking OT = R − √(R² − ΣL_i²).','SSD = 0.278Vt + V²/(254(f ± G)).'],
  criteria:['Gradient ≤ limit; swept width ≤ carriageway width at bend; SSD_available ≥ SSD_required'],
  inputs:[
    {k:'G', sym:'G', l:'Maximum access gradient', u:'%', d:4.5, c:'Surveyed'},
    {k:'Gl', sym:'G_lim', l:'Gradient limit (low-loader)', u:'%', d:8, c:'Consultant Assumption', s:'ATJ 8/86 / transporter — VERIFY'},
    {k:'R', sym:'R', l:'Outer turning radius at junction', u:'m', d:20, c:'Consultant Assumption'},
    {k:'L1', sym:'L₁', l:'Tractor wheelbase', u:'m', d:4.5, c:'Vendor Certified'},
    {k:'L2', sym:'L₂', l:'King-pin to trailer bogie centre', u:'m', d:12.0, c:'Vendor Certified'},
    {k:'wv', sym:'w_v', l:'Vehicle width', u:'m', d:3.0, c:'Vendor Certified'},
    {k:'wc', sym:'w_c', l:'Carriageway width at bend (incl. widening)', u:'m', d:9.0, c:'Consultant Assumption'},
    {k:'V', sym:'V', l:'Design speed on public road', u:'km/h', d:60, c:'Authority Data'},
    {k:'t', sym:'t', l:'Perception-reaction time', u:'s', d:2.5, c:'Consultant Assumption'},
    {k:'f', sym:'f', l:'Longitudinal friction', u:'', d:0.35, c:'Consultant Assumption'},
    {k:'SSDa', sym:'SSD_av', l:'Available sight distance', u:'m', d:120, c:'Estimated'},
  ],
  run(I, S){
    S.chk({label:'Access gradient', val: I.G, lim: I.Gl, rel:'<=', unit:'%', dp:1});
    const OT = S.v('OT', 'Off-tracking', 'OT = R − √(R² − L₁² − L₂²)', `${I.R} − √(${I.R}² − ${I.L1}² − ${I.L2}²)`, I.R - Math.sqrt(Math.max(I.R**2 - I.L1**2 - I.L2**2, 0)), 'm', '', 2);
    const sw = S.v('w_s', 'Swept width', 'w_s = w_v + OT + 0.6 clearance', `${I.wv} + ${f2(OT)} + 0.6`, I.wv + OT + 0.6, 'm', '', 2);
    S.chk({label:'Swept width ≤ carriageway at bend', val: sw, lim: I.wc, rel:'<=', unit:'m', dp:2, fix:'Increase curve widening / junction radius.'});
    const ssd = S.v('SSD', 'Stopping sight distance', 'SSD = 0.278Vt + V²/(254f)', `0.278×${I.V}×${I.t} + ${I.V}²/(254×${I.f})`, 0.278 * I.V * I.t + I.V**2 / (254 * I.f), 'm', 'ATJ886 (VERIFY)', 1);
    S.chk({label:'Sight distance at junction', val: I.SSDa, lim: ssd, rel:'>=', unit:'m', dp:0, kind:'cap', what:'available sight distance', dem:'required stopping sight distance', fix:'Clear sight lines / relocate access.'});
    S.r('OT', 'Off-tracking', OT, 'm', 2); S.r('ssd', 'SSD required', ssd, 'm', 1);
    S.w('AUTH', 'Access junction to public road requires JKR / PBT approval (junction layout per ATJ).');
  }});

/* ======================================================================
   RDQ — road quantity (internal & main access)
   ====================================================================== */
defCalc({id:'RDQ', no:'CS-RD-003', title:'Road Quantities (Main Access & Internal Roads)', module:'m23', req:[45],
  purpose:'Compute road pavement quantities from alignment lengths, widths and layer thicknesses.',
  codes:['JKR_SPJ','ATJ585'],
  assume:['Layer widths = carriageway + shoulders; geotextile under full width.'],
  criteria:['Crossfall 3% to road-side drains'],
  inputs:[
    {k:'Lm', sym:'L_m', l:'Main access length', u:'m', d:650, c:'Estimated'},
    {k:'wm', sym:'w_m', l:'Main access carriageway', u:'m', d:7.0, c:'Client Provided'},
    {k:'Li', sym:'L_i', l:'Internal road length', u:'m', d:9800, c:'Estimated', s:'From PV layout'},
    {k:'wi', sym:'w_i', l:'Internal road carriageway', u:'m', d:4.0, c:'Client Provided'},
    {k:'sh', sym:'s', l:'Shoulder width (each side)', u:'m', d:0.5, c:'Consultant Assumption'},
    {k:'tb', sym:'t_b', l:'Base', u:'mm', d:150, link:'PAV.tBase'},
    {k:'ts', sym:'t_s', l:'Sub-base', u:'mm', d:250, link:'PAV.tSub'},
    {k:'ac', sym:'—', l:'Bituminous surfacing on main access', t:'s', o:['Yes','No'], d:'Yes', c:'Client Provided'},
  ],
  run(I, S){
    const Am = S.v('A_m', 'Main access area', 'L_m(w_m + 2s)', `${I.Lm}(${I.wm} + 2×${I.sh})`, I.Lm * (I.wm + 2 * I.sh), 'm²', '', 0);
    const Ai = S.v('A_i', 'Internal road area', 'L_i(w_i + 2s)', `${I.Li}(${I.wi} + 2×${I.sh})`, I.Li * (I.wi + 2 * I.sh), 'm²', '', 0);
    const At = Am + Ai;
    const Vs = S.v('V_sb', 'Sub-base', '(A_m + A_i)·t_s', `${f0(At)}×${I.ts/1000}`, At * I.ts / 1000, 'm³', '', 0);
    const Vb = S.v('V_b', 'Base', '(A_m + A_i)·t_b', `${f0(At)}×${I.tb/1000}`, At * I.tb / 1000, 'm³', '', 0);
    S.r('area', 'Road area', At, 'm²', 0); S.r('Vsub', 'Sub-base', Vs, 'm³', 0); S.r('Vbase', 'Base', Vb, 'm³', 0); S.r('Lroad', 'Total road length', I.Lm + I.Li, 'm', 0);
    S.q('RD_SUBGRADE', At); S.q('RD_GEOTEX', At); S.q('RD_SUBBASE', Vs); S.q('RD_BASE', Vb); if (I.ac === 'Yes') S.q('RD_AC', I.Lm * I.wm);
    S.p(`Main access ${I.Lm} m × ${I.wm} m (bituminous), internal roads ${I.Li} m × ${I.wi} m (granular).`);
  }});

/* ======================================================================
   HVY — heavy transport
   ====================================================================== */
defCalc({id:'HVY', no:'CS-RD-004', title:'Heavy Transport Check (Main Transformer Delivery)', module:'m24', req:[36],
  purpose:'Check the transport route and site roads for the heaviest delivery: axle loads, crossings, gradients and clearances.',
  codes:['ATJ886','JKR_SPJ','TNB_TG'],
  assume:['Axle load uniformly distributed over axle lines of modular trailer.','Crossing ratings to be confirmed by structural assessment.'],
  criteria:['Axle load ≤ road / culvert rating; gradient ≤ limit; clearances ≥ vehicle + margin'],
  inputs:[
    {k:'GVW', sym:'GVW', l:'Gross vehicle weight', u:'kN', d:1900, c:'Contractor Provided', s:'Transformer 120 t + trailer'},
    {k:'na', sym:'n_a', l:'Number of trailer axle lines', u:'no.', d:12, c:'Contractor Provided'},
    {k:'tr', sym:'W_tr', l:'Tractor share of GVW', u:'kN', d:260, c:'Contractor Provided'},
    {k:'as', sym:'s_a', l:'Axle spacing', u:'m', d:1.5, c:'Contractor Provided'},
    {k:'p', sym:'p', l:'Tyre pressure', u:'kPa', d:800, c:'Contractor Provided'},
    {k:'Lv', sym:'L_v', l:'Vehicle length', u:'m', d:32, c:'Contractor Provided'},
    {k:'Wv', sym:'W_v', l:'Vehicle width', u:'m', d:3.5, c:'Contractor Provided'},
    {k:'Hv', sym:'H_v', l:'Loaded height', u:'m', d:4.9, c:'Contractor Provided'},
    {k:'R', sym:'R', l:'Tightest turning radius', u:'m', d:40, c:'Estimated'},
    {k:'Lwb', sym:'L_wb', l:'Effective wheelbase', u:'m', d:18, c:'Contractor Provided'},
    {k:'rate', sym:'P_rate', l:'Road / culvert crossing axle rating', u:'kN', d:160, c:'Estimated', s:'Crossing assessment required'},
    {k:'Gmax', sym:'G', l:'Steepest route gradient', u:'%', d:4.5, link:'ACC.G'},
    {k:'Gl', sym:'G_lim', l:'Gradient limit for transporter', u:'%', d:6, c:'Contractor Provided'},
    {k:'Hc', sym:'H_c', l:'Min. vertical clearance on route', u:'m', d:5.8, c:'Estimated', s:'Overhead lines — TNB'},
    {k:'Wc', sym:'W_c', l:'Min. horizontal clearance (gates, bends)', u:'m', d:9.0, c:'Estimated'},
  ],
  run(I, S){
    const ax = S.v('P_ax', 'Trailer axle-line load', 'P = (GVW − W_tr)/n_a', `(${I.GVW} − ${I.tr})/${I.na}`, (I.GVW - I.tr) / I.na, 'kN', '', 1);
    S.chk({label:'Axle load vs crossing rating', val: ax, lim: I.rate, rel:'<=', unit:'kN', dp:1, fix:'Increase axle lines, bridge crossings with steel plates / temporary bridge, or strengthen culverts.'});
    S.v('A_t', 'Tyre contact area per axle line', 'A = P/p', `${f1(ax)}/${I.p}`, ax / I.p, 'm²', '', 3);
    S.chk({label:'Route gradient', val: I.Gmax, lim: I.Gl, rel:'<=', unit:'%', dp:1});
    S.chk({label:'Vertical clearance', val: I.Hc, lim: I.Hv + 0.5, rel:'>=', unit:'m', dp:2, fix:'Coordinate TNB line lifting / route change.'});
    const OT = S.v('OT', 'Off-tracking at R', 'OT = R − √(R² − L_wb²)', `${I.R} − √(${I.R}² − ${I.Lwb}²)`, I.R - Math.sqrt(Math.max(I.R**2 - I.Lwb**2, 0)), 'm', '', 2);
    S.chk({label:'Horizontal clearance incl. off-tracking', val: I.Wc, lim: I.Wv + OT + 0.5, rel:'>=', unit:'m', dp:2, fix:'Widen bends / gate openings; steerable trailer.'});
    S.r('ax', 'Axle-line load', ax, 'kN', 1); S.r('OT', 'Off-tracking', OT, 'm', 2);
    S.w('AUTH', 'Abnormal load permit (JKR / JPJ / police escort) and route survey required.');
    S.n(`Axle-line load ${f0(ax)} kN vs crossing rating ${I.rate} kN; off-tracking ${f1(OT)} m at R = ${I.R} m.`);
  }});

/* ======================================================================
   CRN — crane hardstanding
   ====================================================================== */
defCalc({id:'CRN', no:'CS-RD-005', title:'Crane Access & Hardstanding', module:'m25', req:[],
  purpose:'Size granular crane working platform for the heaviest outrigger load.',
  codes:['BRE470','FMA','BOWEC'],
  assume:['Load spread through platform at angle α from the outrigger mat (screening); BRE 470 method recommended for design.'],
  criteria:['Pressure at formation ≤ allowable subgrade bearing; mat pressure ≤ platform capacity'],
  inputs:[
    {k:'F', sym:'F', l:'Max outrigger load (with dynamic factor)', u:'kN', d:1150, c:'Vendor Certified', s:'Crane lift plan'},
    {k:'Bm', sym:'B_m', l:'Outrigger mat size (square)', u:'m', d:2.0, c:'Contractor Provided'},
    {k:'qp', sym:'q_pl', l:'Allowable pressure on platform surface', u:'kPa', d:400, c:'Consultant Assumption'},
    {k:'qs', sym:'q_sub', l:'Allowable subgrade bearing', u:'kPa', d:100, c:'Consultant Assumption', s:'SI REQUIRED'},
    {k:'a', sym:'α', l:'Load spread angle from vertical', u:'°', d:30, c:'Consultant Assumption'},
    {k:'Ah', sym:'A_h', l:'Hardstanding area', u:'m²', d:900, c:'Estimated', s:'30 × 30 m at substation'},
  ],
  run(I, S){
    const qm = S.v('q_m', 'Mat pressure', 'q = F/B_m²', `${I.F}/${I.Bm}²`, I.F / I.Bm**2, 'kPa', '', 1);
    S.chk({label:'Mat pressure ≤ platform capacity', val: qm, lim: I.qp, rel:'<=', unit:'kPa', dp:0, fix:'Larger mats.'});
    const ta = Math.tan(rad(I.a));
    const t = bisect(t => I.F / (I.Bm + 2 * t * ta)**2 - I.qs, 0, 5) || 5;
    const tr = S.v('t', 'Required platform thickness', 'solve F/(B_m + 2t tanα)² = q_sub', 'bisection', Math.ceil(t * 20) / 20, 'm', 'Load spread (screening)', 2);
    S.r('t', 'Platform thickness', tr, 'm', 2);
    S.q('RD_HARD', I.Ah * tr, `${I.Ah} m² × ${f2(tr)} m`);
    S.w('DETAIL', 'Working platform to be designed by BRE 470 method and certified before crane use (BOWEC).');
    S.n(`Granular platform ${f2(tr)} m thick required over ${I.qs} kPa subgrade for ${I.F} kN outrigger load.`);
  }});

/* ======================================================================
   SUB — substation civil
   ====================================================================== */
defCalc({id:'SUB', no:'CS-SS-001', title:'Substation Civil Works', module:'m32', req:[],
  purpose:'Quantify substation yard civil works: platform surfacing, equipment foundations, fence and internal road.',
  codes:['TNB_TG','EN1992','CLIENT_ER'],
  assume:['Equipment foundations (gantries, CB, CT/VT, isolators) by average concrete volume per foundation.'],
  criteria:['Platform RL per flood platform calculation; yard crossfall ≥ 1%'],
  inputs:[
    {k:'A', sym:'A', l:'Substation yard area', u:'m²', d:()=>{const p=platforms().find(x=>x.id==='PF-SS'); const D=getDEM(); return p? p.w*p.h*D.dx*D.dx*0.85 : 12000;}, c:'Estimated'},
    {k:'tg', sym:'t_g', l:'Gravel thickness', u:'m', d:0.10, c:'Client Provided'},
    {k:'nf', sym:'n_f', l:'Equipment foundations', u:'no.', d:46, c:'Estimated', s:'Single-line diagram'},
    {k:'vf', sym:'v_f', l:'Average concrete per foundation', u:'m³', d:4.5, c:'Estimated'},
    {k:'rr', sym:'ρ', l:'Reinforcement ratio', u:'kg/m³', d:90, c:'Consultant Assumption'},
    {k:'rl', sym:'RL', l:'Platform RL (design)', u:'m RL', d:0, link:'CF.rl_PF-SS'},
  ],
  run(I, S){
    const Vc = S.v('V_c', 'Foundation concrete', 'n_f · v_f', `${I.nf}×${I.vf}`, I.nf * I.vf, 'm³', '', 1);
    const Wr = S.v('W_r', 'Reinforcement', 'V_c·ρ/1000', `${f1(Vc)}×${I.rr}/1000`, Vc * I.rr / 1000, 't', '', 2);
    const Lf = S.v('L_f', 'Yard fence', '4√A', `4√${f0(I.A)}`, 4 * Math.sqrt(I.A), 'm', '', 0);
    S.r('A', 'Yard area', I.A, 'm²', 0); S.r('Vc', 'Concrete', Vc, 'm³', 1); S.r('rl', 'Platform RL', I.rl, 'm RL', 2);
    S.q('SS_GRAVEL', I.A); S.q('CN_G30', Vc, 'Substation equipment foundations'); S.q('RF_Y', Wr); S.q('CN_LEAN', Vc * 0.08); S.q('FW_FORM', Vc * 3.2); S.q('EX_FDN', Vc * 1.8);
    S.q('FN_FENCE', Lf, 'Substation inner fence');
    S.w('VENDOR', 'Equipment foundation loads and layouts from TNB / substation contractor.');
    S.p(`Substation yard ${f0(I.A)} m² at RL ${f2(I.rl)} m, ${I.tg * 1000} mm gravel, ${I.nf} equipment foundations.`);
  }});

/* ======================================================================
   CTR — cable trench
   ====================================================================== */
defCalc({id:'CTR', no:'CS-CT-001', title:'Cable Trench — Geometry & Quantities', module:'m34', req:[37],
  purpose:'Check trench width/cover for cable arrangement and compute excavation, sand, backfill, protection and tape quantities.',
  codes:['TNB_TG','CLIENT_ER'],
  assume:['Cables laid flat in one layer; sand bed below and sand surround above cables.','Cable cover requirements per TNB / client — VERIFY.'],
  criteria:['Required width ≤ trench width; cover to cable ≥ minimum'],
  inputs:[
    {g:'MV (33 kV) trench'},
    {k:'Lm', sym:'L_MV', l:'Length', u:'m', d:14500, c:'Estimated'},
    {k:'wm', sym:'w_MV', l:'Width', u:'m', d:0.8, c:'Consultant Assumption'},
    {k:'dm', sym:'d_MV', l:'Depth', u:'m', d:1.2, c:'Consultant Assumption'},
    {k:'nm', sym:'n_MV', l:'Number of cables', u:'no.', d:3, c:'Client Provided'},
    {k:'Dm', sym:'Ø_MV', l:'Cable diameter', u:'mm', d:95, c:'Vendor Certified'},
    {k:'sm', sym:'s_MV', l:'Spacing between cables', u:'mm', d:95, c:'Client Provided'},
    {k:'cm', sym:'c_MV', l:'Minimum cover to cable', u:'m', d:0.9, c:'Consultant Assumption', s:'TNB / client — VERIFY'},
    {g:'LV / DC trench'},
    {k:'Ll', sym:'L_LV', l:'Length', u:'m', d:21000, c:'Estimated'},
    {k:'wl', sym:'w_LV', l:'Width', u:'m', d:0.5, c:'Consultant Assumption'},
    {k:'dl', sym:'d_LV', l:'Depth', u:'m', d:0.8, c:'Consultant Assumption'},
    {k:'nl', sym:'n_LV', l:'Number of cables', u:'no.', d:4, c:'Client Provided'},
    {k:'Dl', sym:'Ø_LV', l:'Cable diameter', u:'mm', d:45, c:'Vendor Certified'},
    {k:'sl', sym:'s_LV', l:'Spacing', u:'mm', d:45, c:'Client Provided'},
    {k:'cl', sym:'c_LV', l:'Minimum cover', u:'m', d:0.6, c:'Consultant Assumption'},
    {g:'Common'},
    {k:'bed', sym:'t_bed', l:'Sand bed below cables', u:'m', d:0.1, c:'Client Provided'},
    {k:'sur', sym:'t_sur', l:'Sand cover above cables', u:'m', d:0.15, c:'Client Provided'},
    {k:'ec', sym:'e', l:'Edge clearance each side', u:'mm', d:75, c:'Consultant Assumption'},
  ],
  run(I, S){
    const one = (tag, L, w, d, n, D, s, cmin) => {
      S.h(tag + ' trench');
      const wr = S.v('w_req', 'Required width', 'n·Ø + (n−1)s + 2e', `${n}×${D} + ${n-1}×${s} + 2×${I.ec}`, (n * D + (n - 1) * s + 2 * I.ec) / 1000, 'm', '', 3);
      S.chk({label: tag + ' trench width', val: w, lim: wr, rel:'>=', unit:'m', dp:3, kind:'cap', what: tag + ' trench width', dem:'required width'});
      const cov = S.v('c', 'Cover to top of cable', 'c = d − t_bed − Ø', `${d} − ${I.bed} − ${D/1000}`, d - I.bed - D / 1000, 'm', '', 3);
      S.chk({label: tag + ' cover to cable', val: cov, lim: cmin, rel:'>=', unit:'m', dp:2, fix:'Deepen trench / add protection slabs.'});
      const Ve = S.v('V_e', 'Excavation', 'w·d·L', `${w}×${d}×${L}`, w * d * L, 'm³', '', 0);
      const Vcab = n * Math.PI * (D / 2000)**2 * L;
      const Vs = S.v('V_s', 'Sand', 'w(t_bed + Ø + t_sur)L − V_cables', `${w}(${I.bed} + ${D/1000} + ${I.sur})${L} − ${f0(Vcab)}`, w * (I.bed + D / 1000 + I.sur) * L - Vcab, 'm³', '', 0);
      const Vb = S.v('V_b', 'Backfill', 'V_e − V_s − V_cables', '', Ve - Vs - Vcab, 'm³', '', 0);
      return {Ve, Vs, Vb};
    };
    const a = one('MV', I.Lm, I.wm, I.dm, I.nm, I.Dm, I.sm, I.cm), b = one('LV/DC', I.Ll, I.wl, I.dl, I.nl, I.Dl, I.sl, I.cl);
    S.r('Vexc', 'Total excavation', a.Ve + b.Ve, 'm³', 0); S.r('Vsand', 'Total sand', a.Vs + b.Vs, 'm³', 0); S.r('L', 'Total trench length', I.Lm + I.Ll, 'm', 0);
    S.q('CT_EXC', a.Ve + b.Ve); S.q('CT_SAND', a.Vs + b.Vs); S.q('CT_BACK', a.Vb + b.Vb); S.q('CT_SLAB', I.Lm, 'MV protection'); S.q('CT_TAPE', I.Lm * 2 + I.Ll);
    S.p(`MV trench ${I.wm} × ${I.dm} m (${I.Lm} m); LV/DC trench ${I.wl} × ${I.dl} m (${I.Ll} m).`);
  }});

/* ======================================================================
   UGS — underground services crossings
   ====================================================================== */
defCalc({id:'UGS', no:'CS-CT-002', title:'Underground Services — Road & Drain Crossings', module:'m35', req:[],
  purpose:'Quantify ducted crossings (roads/drains) and concrete encasement; check cover under roads.',
  codes:['TNB_TG','JKR_SPJ'],
  assume:['Ducts encased in concrete at road crossings.'],
  criteria:['Cover to duct under road ≥ 1.0 m (VERIFY)'],
  inputs:[
    {k:'nx', sym:'n_x', l:'Number of crossings', u:'no.', d:64, c:'Estimated'},
    {k:'nd', sym:'n_d', l:'Ducts per crossing', u:'no.', d:4, c:'Consultant Assumption'},
    {k:'Lx', sym:'L_x', l:'Crossing length', u:'m', d:9, c:'Estimated'},
    {k:'OD', sym:'OD', l:'Duct OD', u:'mm', d:160, c:'Vendor Certified'},
    {k:'cv', sym:'c', l:'Concrete cover around ducts', u:'mm', d:100, c:'Consultant Assumption'},
    {k:'dep', sym:'z', l:'Cover to top of encasement', u:'m', d:1.0, c:'Consultant Assumption'},
    {k:'zmin', sym:'z_min', l:'Minimum cover under road', u:'m', d:1.0, c:'Consultant Assumption', s:'VERIFY'},
  ],
  run(I, S){
    const w = (I.nd * I.OD + (I.nd - 1) * 50 + 2 * I.cv) / 1000, h = (I.OD + 2 * I.cv) / 1000;
    const Ae = S.v('A_e', 'Encasement section (net)', 'w·h − n_d πOD²/4', `${f3(w)}×${f3(h)} − ${I.nd}π${I.OD/1000}²/4`, w * h - I.nd * Math.PI * (I.OD / 1000)**2 / 4, 'm²', '', 4);
    const Vc = S.v('V_c', 'Encasement concrete', 'A_e·L_x·n_x', `${fmt(Ae,4)}×${I.Lx}×${I.nx}`, Ae * I.Lx * I.nx, 'm³', '', 1);
    S.chk({label:'Cover under road', val: I.dep, lim: I.zmin, rel:'>=', unit:'m', dp:2});
    S.q('CT_DUCT', I.nx * I.nd * I.Lx); S.q('CN_G30', Vc, 'Duct encasement');
    S.r('Vc', 'Encasement concrete', Vc, 'm³', 1);
  }});

/* ======================================================================
   RTW — retaining wall (RC cantilever)
   ====================================================================== */
defCalc({id:'RTW', no:'CS-RW-001', title:'Retaining Wall — RC Cantilever', module:'m36', req:[38],
  purpose:'Stability and structural design of RC cantilever retaining wall at raised platform edges.',
  codes:['EN1997','EN1992','JKR_SLOPE'],
  assume:['Rankine active pressure, vertical back; wall friction neglected.','Stability FS: sliding 1.5, overturning 2.0 (consultant) — EC7 GEO/EQU may be adopted.','Structural ULS: 1.35 on earth & water pressure, 1.5 on surcharge.'],
  criteria:['FS_s ≥ 1.5 ; FS_o ≥ 2.0 ; e ≤ B/6 ; q_max ≤ q_all'],
  inputs:[
    {k:'H', sym:'H', l:'Retained height (to underside of base)', u:'m', d:2.5, c:'Estimated'},
    {k:'ts', sym:'t_s', l:'Stem thickness', u:'m', d:0.30, c:'Consultant Assumption'},
    {k:'B', sym:'B', l:'Base width', u:'m', d:2.6, c:'Consultant Assumption'},
    {k:'tt', sym:'b_t', l:'Toe length', u:'m', d:0.6, c:'Consultant Assumption'},
    {k:'tb', sym:'t_b', l:'Base thickness', u:'m', d:0.35, c:'Consultant Assumption'},
    {k:'g', sym:'γ', l:'Backfill unit weight', u:'kN/m³', d:19, c:'Consultant Assumption'},
    {k:'phi', sym:'φ′', l:'Backfill friction angle', u:'°', d:30, c:'Consultant Assumption'},
    {k:'q', sym:'q', l:'Surcharge', u:'kPa', d:10, c:'Consultant Assumption'},
    {k:'hw', sym:'h_w', l:'Water height behind wall', u:'m', d:0.5, c:'Consultant Assumption'},
    {k:'mu', sym:'μ', l:'Base friction', u:'', d:0.45, c:'Consultant Assumption'},
    {k:'qa', sym:'q_all', l:'Allowable bearing', u:'kPa', d:150, link:'BRG.qa'},
    {k:'fck', sym:'f_ck', l:'Concrete', u:'MPa', d:30, c:'Consultant Assumption'},
    {k:'Lw', sym:'L_w', l:'Wall length', u:'m', d:180, c:'Estimated'},
  ],
  run(I, S){
    const ka = S.v('K_a', 'Active coefficient', 'K_a = (1 − sinφ′)/(1 + sinφ′)', `(1 − sin${I.phi})/(1 + sin${I.phi})`, Ka(I.phi), '', 'Rankine', 3);
    const gp = I.g - 9.81, hd = I.H - I.hw;
    const Ps = S.v('P_s', 'Soil thrust', 'P_s = ½K_aγh_d² + K_aγh_d h_w + ½K_aγ′h_w²', '', 0.5 * ka * I.g * hd * hd + ka * I.g * hd * I.hw + 0.5 * ka * gp * I.hw**2, 'kN/m', '', 2);
    const Pw = S.v('P_w', 'Water thrust', '½γ_w h_w²', `0.5×9.81×${I.hw}²`, 0.5 * 9.81 * I.hw**2, 'kN/m', '', 2);
    const Pq = S.v('P_q', 'Surcharge thrust', 'K_a q H', `${f3(ka)}×${I.q}×${I.H}`, ka * I.q * I.H, 'kN/m', '', 2);
    const Mo = S.v('M_O', 'Overturning moment (about toe)', 'P_s·H/3 + P_w·h_w/3 + P_q·H/2', '', Ps * I.H / 3 + Pw * I.hw / 3 + Pq * I.H / 2, 'kN·m/m', '', 2);
    const heel = I.B - I.tt - I.ts, Hs = I.H - I.tb;
    const W1 = 24 * I.ts * Hs, W2 = 24 * I.B * I.tb, W3 = I.g * heel * Hs;
    const V = S.v('ΣV', 'Vertical load', 'W_stem + W_base + W_soil,heel', `${f1(W1)} + ${f1(W2)} + ${f1(W3)}`, W1 + W2 + W3, 'kN/m', '', 1);
    const Mr = S.v('M_R', 'Restoring moment', 'ΣW·x', '', W1 * (I.tt + I.ts / 2) + W2 * I.B / 2 + W3 * (I.B - heel / 2), 'kN·m/m', '', 1);
    S.chk({label:'Overturning FS', val: Mr / Mo, lim: 2.0, rel:'>=', dp:2, fix:'Increase base width (heel).'});
    S.chk({label:'Sliding FS', val: I.mu * V / (Ps + Pw + Pq), lim: 1.5, rel:'>=', dp:2, fix:'Add shear key / widen base.'});
    const xr = (Mr - Mo) / V, e = S.v('e', 'Eccentricity', 'e = B/2 − (M_R − M_O)/ΣV', `${I.B}/2 − ${f2(xr)}`, I.B / 2 - xr, 'm', '', 3);
    const qmax = S.v('q_max', 'Max bearing', 'ΣV/B(1 + 6e/B)', '', e <= I.B / 6 ? V / I.B * (1 + 6 * e / I.B) : 2 * V / (3 * Math.max(xr, 0.05)), 'kPa', '', 1);
    S.chk({label:'Eccentricity ≤ B/6', val: e, lim: I.B / 6, rel:'<=', unit:'m', dp:3});
    S.chk({label:'Bearing', val: qmax, lim: I.qa, rel:'<=', unit:'kPa', dp:1});
    S.h('Stem design (ULS)');
    const Ms = S.v('M_stem', 'Stem moment at base', '1.35(K_aγHs³/6 + γ_w h_w³/6) + 1.5K_a q Hs²/2', '', 1.35 * (ka * I.g * Hs**3 / 6 + 9.81 * Math.min(I.hw, Hs)**3 / 6) + 1.5 * ka * I.q * Hs**2 / 2, 'kN·m/m', '', 2);
    const rc = rcFlex(S, {M: Ms, b: 1000, h: I.ts * 1000, c: 50, bar: 16, fck: I.fck, fyk: 500, tag: 'stem'});
    const Mh = S.v('M_heel', 'Heel moment (ULS, conservative)', '1.35 W_soil,heel·heel/2', `1.35×${f1(W3)}×${f2(heel)}/2`, 1.35 * W3 * heel / 2, 'kN·m/m', '', 2);
    const rh = rcFlex(S, {M: Mh, b: 1000, h: I.tb * 1000, c: 50, bar: 16, fck: I.fck, fyk: 500, tag: 'heel'});
    const Vc = (I.ts * Hs + I.B * I.tb) * I.Lw;
    S.q('CN_G30', Vc, `${I.Lw} m wall`); S.q('RF_Y', ((rc.Aprov + rh.Aprov) * 1e-6 * (Hs + I.B) * 1.8) * 7.85 * I.Lw * 1.1, 'Stem + base, both faces'); S.q('FW_FORM', 2 * Hs * I.Lw + 2 * I.tb * I.Lw); S.q('EX_FDN', I.B * 1.0 * I.Lw);
    S.r('FSo', 'Overturning FS', Mr / Mo, '', 2); S.r('FSs', 'Sliding FS', I.mu * V / (Ps + Pw + Pq), '', 2); S.r('qmax', 'Max bearing', qmax, 'kPa', 1);
    S.p(`RC cantilever wall H = ${I.H} m, base ${I.B} m, stem ${I.ts * 1000} mm with T16@${rc.s}; ${I.Lw} m length.`);
  }});

/* ======================================================================
   FEN — fence foundation
   ====================================================================== */
defCalc({id:'FEN', no:'CS-ANC-001', title:'Fence Post & Foundation', module:'m37', req:[39],
  purpose:'Check perimeter fence post bending and footing lateral capacity under wind.',
  codes:['EN1991_4','EN1993','LIT_BROMS'],
  assume:['Wind on fence area with effective solidity (mesh + debris allowance).','Footing as rigid short pile (Broms) in cohesionless soil.'],
  criteria:['Post σ ≤ f_y/γ_M0 ; H_u/F ≥ FS'],
  inputs:[
    {k:'h', sym:'h', l:'Fence height', u:'m', d:2.4, link:'WND.zf'},
    {k:'qp', sym:'q_p', l:'Peak pressure', u:'kPa', d:0.5, link:'WND.qp_fence'},
    {k:'cf', sym:'c_f', l:'Force coefficient', u:'', d:1.2, c:'Consultant Assumption'},
    {k:'sol', sym:'φ_s', l:'Effective solidity', u:'', d:0.3, c:'Consultant Assumption', s:'Chain-link incl. debris allowance'},
    {k:'s', sym:'s', l:'Post spacing', u:'m', d:3.0, c:'Client Provided'},
    {k:'OD', sym:'OD', l:'Post CHS OD', u:'mm', d:76.1, c:'Vendor Certified'},
    {k:'t', sym:'t', l:'Post wall thickness', u:'mm', d:3.2, c:'Vendor Certified'},
    {k:'fy', sym:'f_y', l:'Yield', u:'MPa', d:275, c:'Vendor Certified'},
    {k:'d', sym:'d', l:'Footing diameter', u:'m', d:0.3, c:'Consultant Assumption'},
    {k:'L', sym:'L', l:'Footing depth', u:'m', d:0.9, c:'Consultant Assumption'},
    {k:'phi', sym:'φ′', l:'Soil φ′', u:'°', d:28, link:'GEO.fdn_phi'},
    {k:'g', sym:'γ', l:'Soil γ', u:'kN/m³', d:18, link:'GEO.fdn_g'},
    {k:'cu', sym:'C_u', l:'Soil C_u (cohesive founding layer)', u:'kPa', d:0, link:'GEO.fdn_cu'},
    {k:'FS', sym:'FS', l:'Lateral FS', u:'', d:2.0, c:'Consultant Assumption'},
    {k:'Lf', sym:'L_f', l:'Fence length', u:'m', d:6250, link:'LAND.perim'},
  ],
  run(I, S, P, R){
    const F = S.v('F', 'Wind force per post', 'F = q_p c_f φ_s h s', `${f3(I.qp)}×${I.cf}×${I.sol}×${I.h}×${I.s}`, I.qp * I.cf * I.sol * I.h * I.s, 'kN', 'EN1991_4', 3);
    const M = S.v('M', 'Moment at ground', 'M = F h/2', `${f3(F)}×${I.h}/2`, F * I.h / 2, 'kN·m', '', 3);
    const Z = Math.PI * (I.OD**4 - (I.OD - 2 * I.t)**4) / (32 * I.OD);
    const sg = S.v('σ', 'Post bending stress', 'σ = 1.5M/Z (ULS)', `1.5×${f3(M)}×10⁶/${f0(Z)}`, 1.5 * M * 1e6 / Z, 'MPa', 'EN1993', 1);
    S.chk({label:'Post bending', val: sg, lim: I.fy, rel:'<=', unit:'MPa', dp:0, fix:'Larger post section.'});
    const phi = Math.max(I.phi, 20), e = I.h / 2, coh = I.cu > 0 && (R.GEO && R.GEO.res.fdn_type_clay);
    const HuF = L => coh ? bromsLateral({type:'coh', cu:I.cu, D:I.d, L, e, My:1e6}).Hs : 0.5 * I.g * I.d * L**3 * Kp(phi) / (e + L);
    const Hu = S.v('H_u', 'Footing lateral capacity (Broms short, ' + (coh ? 'cohesive' : 'cohesionless') + ')', coh ? 'solve H(e + 1.5d + 0.5f) = 2.25C_u d g², f = H/(9C_u d)' : 'H_u = ½γdL³K_p/(e + L)', coh ? `C_u = ${f0(I.cu)} kPa, d = ${I.d} m, L = ${I.L} m` : `0.5×${I.g}×${I.d}×${I.L}³×${f2(Kp(phi))}/(${e} + ${I.L})`, HuF(I.L), 'kN', 'LIT_BROMS', 3);
    S.chk({label:'Footing lateral FS', val: Hu / F, lim: I.FS, rel:'>=', dp:2, fix:'Increase footing depth / diameter.'});
    const Lreq = bisect(L => HuF(L) - I.FS * F, 0.3, 5);
    if (Lreq) S.v('L_req', 'Required depth (auto-size)', 'solve H_u(L) = FS·F', 'bisection', Math.ceil(Lreq * 20) / 20, 'm', '', 2);
    S.r('F', 'Wind per post', F, 'kN', 3); S.r('FSl', 'Lateral FS', Hu / F, '', 2); S.r('Lreq', 'Required footing depth', Lreq ? Math.ceil(Lreq * 20) / 20 : null, 'm', 2);
    const np = Math.ceil(I.Lf / I.s) + 1;
    S.q('FN_FENCE', I.Lf, 'Perimeter'); S.q('CN_G30', np * Math.PI * I.d**2 / 4 * I.L, `${np} footings`);
    S.p(`CHS ${I.OD}×${I.t} posts @ ${I.s} m in Ø${I.d * 1000} mm × ${I.L} m concrete footings; ${f0(I.Lf)} m fence.`);
  }});

/* ======================================================================
   GAT — gates
   ====================================================================== */
defCalc({id:'GAT', no:'CS-ANC-002', title:'Gate Post Foundation', module:'m38', req:[],
  purpose:'Check gate post pad foundation for leaf self-weight eccentricity and wind.',
  codes:['EN1991_4','EN1997'],
  assume:['Leaf cantilevered from post; wind on leaf with solidity.'],
  criteria:['Overturning FS ≥ 2.0; bearing ≤ q_all'],
  inputs:[
    {k:'w', sym:'w', l:'Leaf width', u:'m', d:4.0, c:'Client Provided'},
    {k:'h', sym:'h', l:'Leaf height', u:'m', d:2.4, c:'Client Provided'},
    {k:'W', sym:'W_l', l:'Leaf weight', u:'kN', d:3.0, c:'Vendor Certified'},
    {k:'qp', sym:'q_p', l:'Peak pressure', u:'kPa', d:0.5, link:'WND.qp_fence'},
    {k:'sol', sym:'φ_s', l:'Solidity', u:'', d:0.5, c:'Consultant Assumption'},
    {k:'B', sym:'B', l:'Pad size (square)', u:'m', d:1.5, c:'Consultant Assumption'},
    {k:'D', sym:'D', l:'Pad depth', u:'m', d:1.2, c:'Consultant Assumption'},
    {k:'qa', sym:'q_all', l:'Allowable bearing', u:'kPa', d:150, link:'BRG.qa'},
    {k:'n', sym:'n', l:'Number of gates', u:'no.', d:4, c:'Client Provided'},
  ],
  run(I, S){
    const Fw = S.v('F_w', 'Wind on leaf', 'q_p·1.2·φ_s·w·h', '', I.qp * 1.2 * I.sol * I.w * I.h, 'kN', '', 2);
    const M = S.v('M', 'Overturning at base', 'F_w(h/2 + D) + W_l w/2', '', Fw * (I.h / 2 + I.D) + I.W * I.w / 2, 'kN·m', '', 2);
    const Wf = S.v('W_f', 'Pad weight', '24B²D', '', 24 * I.B**2 * I.D, 'kN', '', 1);
    S.chk({label:'Overturning FS', val: (Wf + I.W) * I.B / 2 / M, lim: 2.0, rel:'>=', dp:2, fix:'Increase pad size or use combined footing with tie beam.'});
    const e = M / (Wf + I.W), q = (Wf + I.W) / I.B**2 * (1 + 6 * e / I.B);
    S.chk({label:'Bearing', val: q, lim: I.qa, rel:'<=', unit:'kPa', dp:0});
    S.r('M', 'Overturning moment', M, 'kN·m', 2); S.r('q', 'Bearing pressure', q, 'kPa', 1);
    S.q('FN_GATE', I.n);
    S.p(`Gate post pad ${I.B} × ${I.B} × ${I.D} m; ${I.n} gates.`);
  }});

/* ======================================================================
   WSP — water supply
   ====================================================================== */
defCalc({id:'WSP', no:'CS-ANC-003', title:'Water Supply Demand & Storage', module:'m40', req:[],
  purpose:'Estimate water demand (O&M staff, panel cleaning) and storage tank size.',
  codes:['SPAN_UTG','UBBL'],
  assume:['Panel cleaning water averaged over year.'],
  criteria:['Storage ≥ demand × storage days'],
  inputs:[
    {k:'st', sym:'n_s', l:'O&M staff', u:'no.', d:12, c:'Client Provided'},
    {k:'ls', sym:'q_s', l:'Domestic demand', u:'L/person/day', d:150, c:'Consultant Assumption', s:'Water operator — VERIFY'},
    {k:'mod', sym:'n_m', l:'PV modules', u:'no.', d:()=>Math.round((+P.info.mwp||0)*1e6/620), c:'Client Provided'},
    {k:'lm', sym:'q_m', l:'Water per module per wash', u:'L', d:1.0, c:'Consultant Assumption'},
    {k:'nw', sym:'n_w', l:'Washes per year', u:'no.', d:2, c:'Client Provided'},
    {k:'days', sym:'t_s', l:'Storage days', u:'day', d:2, c:'Consultant Assumption'},
    {k:'Lp', sym:'L_p', l:'Supply pipe length', u:'m', d:800, c:'Estimated'},
  ],
  run(I, S){
    const Qd = S.v('Q_d', 'Domestic', 'n_s q_s/1000', '', I.st * I.ls / 1000, 'm³/day', '', 2);
    const Qm = S.v('Q_m', 'Cleaning (average)', 'n_m q_m n_w/365/1000', '', I.mod * I.lm * I.nw / 365 / 1000, 'm³/day', '', 2);
    const V = S.v('V', 'Storage', '(Q_d + Q_m) t_s', '', (Qd + Qm) * I.days, 'm³', '', 1);
    S.r('Q', 'Average demand', Qd + Qm, 'm³/day', 2); S.r('V', 'Storage', V, 'm³', 1);
    S.q('WS_TANK', 1); S.q('WS_PIPE', I.Lp);
    S.n('Panel cleaning is seasonal — peak demand met by tanker / temporary storage during wash campaigns.');
  }});

/* ======================================================================
   SEW — sewerage
   ====================================================================== */
defCalc({id:'SEW', no:'CS-ANC-004', title:'Sewerage — Population Equivalent & Septic Screening', module:'m41', req:[],
  purpose:'Estimate population equivalent and sewage flow for O&M buildings; screen septic vs package plant.',
  codes:['MSIG'],
  assume:['PE and per-capita flow per Malaysian Sewerage Industry Guidelines — VERIFY values.'],
  criteria:['PE threshold for individual septic tank vs package plant — AUTHORITY CONFIRMATION REQUIRED'],
  inputs:[
    {k:'st', sym:'n', l:'Staff (incl. security)', u:'no.', d:16, c:'Client Provided'},
    {k:'pef', sym:'f_PE', l:'PE per staff (commercial / office)', u:'PE', d:1.0, c:'Consultant Assumption', s:'MSIG — VERIFY'},
    {k:'q', sym:'q', l:'Flow per PE', u:'L/PE/day', d:225, c:'Consultant Assumption', s:'MSIG — VERIFY'},
    {k:'hrt', sym:'HRT', l:'Septic hydraulic retention', u:'day', d:2, c:'Consultant Assumption'},
    {k:'pel', sym:'PE_lim', l:'Individual septic tank PE limit', u:'PE', d:150, c:'Consultant Assumption', s:'AUTHORITY CONFIRMATION REQUIRED'},
  ],
  run(I, S){
    const PE = S.v('PE', 'Population equivalent', 'n f_PE', '', Math.ceil(I.st * I.pef), 'PE', '', 0);
    const Q = S.v('Q', 'Sewage flow', 'PE·q/1000', '', PE * I.q / 1000, 'm³/day', '', 2);
    const V = S.v('V', 'Septic tank volume (screening)', 'Q·HRT + sludge 0.04 PE', '', Q * I.hrt + 0.04 * PE, 'm³', '', 1);
    S.chk({label:'PE within individual septic tank limit', val: PE, lim: I.pel, rel:'<=', unit:'PE', dp:0, fix:'Package sewage treatment plant required.'});
    S.q('SW_SEPTIC', 1); S.r('PE', 'PE', PE, 'PE', 0); S.r('V', 'Tank volume', V, 'm³', 1);
    S.w('AUTH', 'Sewerage approval (SPAN / IWK) — confirm design basis.');
  }});

/* ======================================================================
   FWC — fire-water civil
   ====================================================================== */
defCalc({id:'FWC', no:'CS-FW-001', title:'Fire-Water Civil Works', module:'m42', req:[],
  purpose:'Civil / structural support for fire-water system: tank foundation pressure, appliance hardstanding, hydrant main trench, pump house.',
  codes:['BOMBA_BESS','UBBL','NFPA855'],
  assume:['Specialist fire-system hydraulic design is SEPARATE from C&S design; demand values are inputs from the fire consultant.'],
  criteria:['Tank base pressure ≤ q_all; hardstanding for fire appliance axle load'],
  inputs:[
    {k:'V', sym:'V_fw', l:'Fire-water storage (from fire consultant)', u:'m³', d:()=>P.type==='B'?600:150, c:'Unknown', s:'Fire consultant / BOMBA — AUTHORITY CONFIRMATION REQUIRED'},
    {k:'Dt', sym:'D_t', l:'Tank diameter', u:'m', d:()=>P.type==='B'?14:8, c:'Vendor Certified'},
    {k:'Wt', sym:'W_t', l:'Tank self weight', u:'kN', d:()=>P.type==='B'?350:120, c:'Vendor Certified'},
    {k:'qa', sym:'q_all', l:'Allowable bearing', u:'kPa', d:150, link:'BRG.qa'},
    {k:'Ah', sym:'A_h', l:'Fire appliance hardstanding', u:'m²', d:()=>P.type==='B'?1800:600, c:'Estimated'},
    {k:'Lh', sym:'L_h', l:'Hydrant main trench length', u:'m', d:()=>P.type==='B'?900:350, c:'Estimated'},
  ],
  run(I, S){
    const A = Math.PI * I.Dt**2 / 4;
    const q = S.v('q', 'Tank base pressure', '(γ_w V + W_t)/A + 24×0.45', `(9.81×${I.V} + ${I.Wt})/${f1(A)} + 10.8`, (9.81 * I.V + I.Wt) / A + 24 * 0.45, 'kPa', '', 1);
    S.chk({label:'Tank foundation bearing', val: q, lim: I.qa, rel:'<=', unit:'kPa', dp:1, fix:'Increase raft area / ground improvement.'});
    S.q('FW_HARD', I.Ah); S.q('WS_PIPE', I.Lh, 'Hydrant main'); S.q('FW_TANK_FDN', 1);
    S.r('q', 'Tank base pressure', q, 'kPa', 1);
    S.w('AUTH', 'Fire-water quantity and access per BOMBA; specialist fire hydraulic design excluded from C&S scope.');
  }});

/* ======================================================================
   BESS — platform, drainage, containment (Type B only)
   ====================================================================== */
defCalc({id:'BPL', no:'CS-BES-001', title:'BESS Platform', module:'m43', types:['B'], req:[41],
  purpose:'Determine BESS platform footprint, level, fill, drainage fall and containment requirement.',
  codes:['BOMBA_BESS','NFPA855','FM533','MSMA2'],
  assume:['Container spacing and aisles per BOMBA / vendor / NFPA 855 guidance — VERIFY.'],
  criteria:['Footprint ≤ allocated compound; platform RL ≥ flood RL; crossfall ≥ 1%'],
  inputs:[
    {k:'n', sym:'n_c', l:'Number of BESS enclosures', u:'no.', d:()=>Math.ceil((+P.info.bessMWh||200)/5.0), c:'Vendor Certified'},
    {k:'Lc', sym:'L_c', l:'Enclosure length', u:'m', d:12.2, c:'Vendor Certified'},
    {k:'Wc', sym:'W_c', l:'Enclosure width', u:'m', d:2.6, c:'Vendor Certified'},
    {k:'sx', sym:'s_x', l:'Side spacing between enclosures', u:'m', d:3.0, c:'Consultant Assumption', s:'BOMBA / vendor — VERIFY'},
    {k:'sy', sym:'s_y', l:'End spacing / aisle', u:'m', d:6.0, c:'Consultant Assumption'},
    {k:'npcs', sym:'n_PCS', l:'PCS / MV skids', u:'no.', d:()=>Math.ceil((+P.info.bessMW||50)/4.0), c:'Vendor Certified'},
    {k:'pw', sym:'w_r', l:'Perimeter road width', u:'m', d:6.0, c:'Consultant Assumption'},
    {k:'rl', sym:'RL', l:'Platform RL (design)', u:'m RL', d:0, link:'CF.rl_PF-BESS'},
    {k:'egl', sym:'EGL', l:'Existing ground (avg)', u:'m RL', d:0, link:'FPL.egl_BESS'},
    {k:'cf', sym:'i', l:'Platform crossfall', u:'%', d:1.0, c:'Consultant Assumption'},
  ],
  run(I, S){
    const cols = Math.ceil(Math.sqrt(I.n / 2)) * 2, rows = Math.ceil(I.n / cols);
    const W = S.v('W', 'Array width', 'cols(W_c + s_x) + 2w_r', `${cols}(${I.Wc} + ${I.sx}) + 2×${I.pw}`, cols * (I.Wc + I.sx) + 2 * I.pw, 'm', '', 1);
    const L = S.v('L', 'Array length', 'rows(L_c + s_y) + PCS row + 2w_r', `${rows}(${I.Lc} + ${I.sy}) + 8 + 2×${I.pw}`, rows * (I.Lc + I.sy) + 8 + 2 * I.pw, 'm', '', 1);
    const A = S.v('A', 'Platform footprint', 'W·L', '', W * L, 'm²', '', 0);
    const pl = platforms().find(p => p.id === 'PF-BESS'), D = getDEM(); const Aal = pl ? pl.w * pl.h * D.dx * D.dx : A;
    S.chk({label:'Footprint within allocated BESS compound', val: A, lim: Aal, rel:'<=', unit:'m²', dp:0, fix:'Enlarge compound or reduce spacing (subject to BOMBA).'});
    const dh = S.v('Δh', 'Level difference across platform', 'i·W/100', `${I.cf}×${f1(W)}/100`, I.cf * W / 100, 'm', '', 2);
    const Vf = S.v('V_f', 'Platform fill (indicative)', 'A·max(0, RL − EGL + Δh/2)', '', A * Math.max(0, I.rl - I.egl + dh / 2), 'm³', 'Included in CS-EW-001', 0);
    S.r('area', 'Platform area', A, 'm²', 0); S.r('perim', 'Platform perimeter', 2 * (W + L), 'm', 0); S.r('W', 'Width', W, 'm', 1); S.r('L', 'Length', L, 'm', 1); S.r('rl', 'Platform RL', I.rl, 'm RL', 2);
    S.q('BS_GRAVEL', A); S.q('BS_KERB', 2 * (W + L));
    S.n(`BESS platform ${f0(W)} × ${f0(L)} m (${f2(A / 1e4)} ha) at RL ${f2(I.rl)} m; containment required for transformer oil, coolant and fire-water (see CS-BES-004).`);
    S.w('AUTH', 'BESS separation distances and fire access to be confirmed with BOMBA and client insurer.');
  }});
defCalc({id:'BDR', no:'CS-BES-003', title:'BESS Drainage', module:'m44', types:['B'], req:[],
  purpose:'Size BESS platform perimeter drain and route contaminated flows to containment / interceptor.',
  codes:['MSMA2','CIRIA736'],
  assume:['Clean surface water to site drainage; potentially contaminated areas via interceptor / isolation valve.'],
  criteria:['Perimeter drain capacity ≥ Q (minor ARI)'],
  inputs:[
    {k:'A', sym:'A', l:'Platform area', u:'m²', d:10000, link:'BPL.area'},
    {k:'C', sym:'C', l:'Runoff coefficient (gravel)', u:'', d:0.75, c:'Consultant Assumption'},
    {k:'tc', sym:'t_c', l:'t_c', u:'min', d:10, c:'Consultant Assumption'},
    {k:'T', sym:'T', l:'ARI', u:'yr', d:10, link:'IDF.Tmin'},
    {k:'b', sym:'b', l:'U-drain width', u:'m', d:0.6, c:'Consultant Assumption'},
    {k:'D', sym:'D', l:'U-drain depth', u:'m', d:0.6, c:'Consultant Assumption'},
    {k:'S', sym:'S', l:'Gradient', u:'m/m', d:0.003, c:'Consultant Assumption'},
    {k:'Lp', sym:'L', l:'Drain length', u:'m', d:400, link:'BPL.perim'},
  ],
  run(I, S){
    const Q = S.v('Q', 'Design flow', 'C i A/360 (A ha)', `${I.C}×${f1(idfI(I.T, I.tc))}×${f3(I.A/1e4)}/360`, I.C * idfI(I.T, I.tc) * I.A / 1e4 / 360, 'm³/s', 'MSMA2', 3);
    const Qc = S.v('Q_cap', 'U-drain capacity (0.1 m freeboard)', 'Manning, n = 0.015', '', manQ(trapG(I.b, 0, I.D - 0.1), 0.015, I.S), 'm³/s', '', 3);
    S.chk({label:'BESS drain capacity', val: Qc, lim: Q / 2, rel:'>=', unit:'m³/s', kind:'cap', what:'perimeter drain capacity (two outlets)', dem:'design flow per outlet', dp:3});
    S.q('DR_CONC', I.Lp, 'BESS perimeter U-drain');
    S.r('Q', 'Design flow', Q, 'm³/s', 3);
  }});
defCalc({id:'BCON', no:'CS-BES-004', title:'BESS / Transformer Containment', module:'m45', types:['B'], req:[42],
  purpose:'Calculate containment volume for transformer oil, coolant, fire-water and rainfall for a single fire / spill event.',
  codes:['CIRIA736','IEEE980','FM533','BOMBA_BESS'],
  assume:['Single-event basis: largest oil volume + coolant of affected enclosures + fire-water for design duration + rainfall on containment catchment.'],
  criteria:['V_provided ≥ V_required'],
  inputs:[
    {k:'oil', sym:'V_oil', l:'Largest transformer oil volume (PCS/MV)', u:'m³', d:3.5, c:'Vendor Certified', s:'VENDOR LOAD REQUIRED'},
    {k:'cool', sym:'V_cl', l:'Coolant per enclosure', u:'L', d:900, c:'Vendor Certified'},
    {k:'ne', sym:'n_e', l:'Enclosures affected per event', u:'no.', d:2, c:'Consultant Assumption'},
    {k:'fr', sym:'q_fw', l:'Fire-water application rate', u:'L/min', d:1900, c:'Unknown', s:'Fire consultant / BOMBA'},
    {k:'td', sym:'t_fw', l:'Fire-water duration', u:'min', d:120, c:'Unknown'},
    {k:'Ac', sym:'A_c', l:'Containment catchment area', u:'m²', d:1200, c:'Estimated'},
    {k:'P', sym:'P', l:'Rainfall during event', u:'mm', d:60, c:'Consultant Assumption'},
    {k:'fb', sym:'f', l:'Freeboard allowance', u:'%', d:10, c:'Consultant Assumption'},
    {k:'Ls', sym:'L×B×H', l:'Sump provided — L', u:'m', d:14, c:'Consultant Assumption'},
    {k:'Bs', sym:'B_s', l:'Sump provided — B', u:'m', d:8, c:'Consultant Assumption'},
    {k:'Hs', sym:'H_s', l:'Sump provided — effective depth', u:'m', d:3.2, c:'Consultant Assumption'},
    {k:'nsu', sym:'n_s', l:'Number of containment sumps', u:'no.', d:2, c:'Consultant Assumption'},
  ],
  run(I, S){
    const Vo = S.v('V_1', 'Oil', '1.0 × V_oil', '', I.oil, 'm³', '', 2);
    const Vc = S.v('V_2', 'Coolant', 'n_e V_cl/1000', `${I.ne}×${I.cool}/1000`, I.ne * I.cool / 1000, 'm³', '', 2);
    const Vf = S.v('V_3', 'Fire-water', 'q_fw t_fw/1000', `${I.fr}×${I.td}/1000`, I.fr * I.td / 1000, 'm³', 'CIRIA736', 1);
    const Vr = S.v('V_4', 'Rainfall', 'A_c P/1000', `${I.Ac}×${I.P}/1000`, I.Ac * I.P / 1000, 'm³', '', 1);
    const Vq = S.v('V_req', 'Required containment', '(V₁ + V₂ + V₃ + V₄)(1 + f)', '', (Vo + Vc + Vf + Vr) * (1 + I.fb / 100), 'm³', '', 1);
    const Vp = S.v('V_prov', 'Provided (per sump)', 'L·B·H', `${I.Ls}×${I.Bs}×${I.Hs}`, I.Ls * I.Bs * I.Hs, 'm³', '', 1);
    S.chk({label:'Containment volume', val: Vp, lim: Vq, rel:'>=', unit:'m³', kind:'cap', what:'containment sump volume', dem:'required containment volume', fix:'Increase sump size or provide additional containment / diversion to lined pond.', dp:1});
    S.r('Vreq', 'Required containment', Vq, 'm³', 1); S.r('Vprov', 'Provided containment', Vp, 'm³', 1);
    const Vconc = I.nsu * (2 * (I.Ls + I.Bs) * I.Hs * 0.3 + I.Ls * I.Bs * 0.35);
    S.q('BS_CONT', I.nsu); S.q('BS_OWS', 1); S.q('CN_G30', Vconc, 'Containment sumps'); S.q('RF_Y', Vconc * 0.12); S.q('EX_FDN', I.nsu * (I.Ls + 1) * (I.Bs + 1) * (I.Hs + 0.5));
    S.n(`Fire-water dominates containment (${f0(Vf / (Vo + Vc + Vf + Vr) * 100)}% of volume). Required ${f0(Vq)} m³ vs ${f0(Vp)} m³ per sump.`);
    S.w('AUTH', 'Fire-water demand and containment philosophy to be confirmed with BOMBA / fire consultant / insurer.');
  }});

/* ======================================================================
   TMP — temporary works ; LOG — construction logistics
   ====================================================================== */
defCalc({id:'TMP', no:'CS-TW-001', title:'Temporary Works', module:'m46', req:[],
  purpose:'Temporary facilities, laydown and excavation support screening.',
  codes:['BOWEC','OSHA'],
  assume:['Excavations deeper than the shoring threshold require designed support (BOWEC) — threshold VERIFY.'],
  criteria:['Excavation depth > threshold → temporary works design'],
  inputs:[
    {k:'mo', sym:'t', l:'Construction duration', u:'month', d:18, c:'Client Provided'},
    {k:'Al', sym:'A_l', l:'Laydown area', u:'m²', d:20000, c:'Estimated'},
    {k:'dx', sym:'d_max', l:'Deepest excavation (containment sump)', u:'m', d:()=>P.type==='B'?3.5:1.5, c:'Estimated'},
    {k:'dl', sym:'d_lim', l:'Shoring / battering threshold', u:'m', d:1.5, c:'Consultant Assumption', s:'BOWEC — VERIFY'},
  ],
  run(I, S){
    S.v('d_max', 'Deepest excavation', 'input', '', I.dx, 'm', '', 2);
    if (I.dx > I.dl){ S.w('DETAIL', `Excavation ${I.dx} m exceeds ${I.dl} m — designed temporary works (shoring / battering, dewatering) required under BOWEC.`); S.n('Temporary works design required for deep excavations (containment sumps / pits).'); }
    S.r('dmax', 'Deepest excavation', I.dx, 'm', 2);
    S.q('TW_OFFICE', I.mo); S.q('TW_LAYDOWN', I.Al);
  }});
defCalc({id:'LOG', no:'CS-TW-002', title:'Construction Logistics & Piling Productivity', module:'m47', req:[],
  purpose:'Estimate delivery trips and piling rig requirement against the programme window.',
  codes:['CLIENT_ER'],
  assume:['Productivity rates are planning assumptions.'],
  criteria:['Piling completed within programme window'],
  inputs:[
    {k:'np', sym:'n_p', l:'PV piles', u:'no.', d:0, link:'PVP.npile'},
    {k:'rate', sym:'r', l:'Piles per rig per day', u:'no.', d:180, c:'Contractor Provided'},
    {k:'win', sym:'T_w', l:'Piling window', u:'working days', d:120, c:'Client Provided'},
    {k:'mods', sym:'n_m', l:'PV modules', u:'no.', d:()=>Math.round((+P.info.mwp||0)*1e6/620), c:'Client Provided'},
    {k:'mpc', sym:'m/c', l:'Modules per 40 ft container', u:'no.', d:620, c:'Vendor Certified'},
    {k:'days', sym:'T_d', l:'Delivery period', u:'days', d:150, c:'Client Provided'},
  ],
  run(I, S){
    const rigs = S.v('n_rig', 'Piling rigs required', '⌈n_p/(r·T_w)⌉', `⌈${I.np}/(${I.rate}×${I.win})⌉`, Math.ceil(I.np / (I.rate * I.win)), 'no.', '', 0);
    const tr = S.v('n_tr', 'Module container trips', '⌈n_m/(m/c)⌉', '', Math.ceil(I.mods / I.mpc), 'trips', '', 0);
    S.v('q', 'Average module trips per day', 'n_tr/T_d', '', tr / I.days, 'trips/day', '', 1);
    S.r('rigs', 'Piling rigs', rigs, 'no.', 0); S.r('trips', 'Container trips', tr, 'no.', 0);
    S.n(`${rigs} piling rigs to install ${I.np.toLocaleString()} piles in ${I.win} working days; ${tr.toLocaleString()} module container deliveries (${f1(tr / I.days)}/day) — gate and internal road traffic management required.`);
  }});

/* ======================================================================
   Quantity summaries (Concrete, Reinforcement, Road, Drainage, Foundations)
   ====================================================================== */
function qtySummary(S, keys, title, R){
  const rows = []; let tot = 0; const unit = BOQ_LIB[keys[0]].unit;
  Object.keys(R).forEach(id => { const r = R[id]; if (!r || !r.qty) return; r.qty.forEach(q => { if (keys.includes(q.key)){ rows.push([CALCS[id].no, CALCS[id].title, q.key, q.basis || '', fmt(q.qty, 2)]); tot += q.qty; } }); });
  S.tbl(title, ['Calc','Source','BOQ item','Basis','Quantity'], rows.concat([['','Total','','',fmt(tot, 2)]]));
  return tot;
}
defCalc({id:'QDRN', no:'CS-QTY-004', title:'Drainage Quantity', module:'m16', req:[46],
  purpose:'Compute drain lengths by type and summarise all drainage quantities traceable to calculations.',
  codes:['MSMA2'], assume:['Drain lengths from preliminary layout.'], criteria:[],
  inputs:[
    {k:'Le', sym:'L_e', l:'Earth / collector drains', u:'m', d:9800, c:'Estimated', s:'Preliminary drainage layout'},
    {k:'Lc', sym:'L_c', l:'Concrete-lined drains (main outfall drains)', u:'m', d:1400, c:'Estimated'},
    {k:'Ls', sym:'L_s', l:'Grass swales (road-side)', u:'m', d:8200, c:'Estimated'},
  ],
  run(I, S, P, R){
    S.q('DR_EARTH', I.Le); S.q('DR_CONC', I.Lc, 'Main drains'); S.q('DR_SWALE', I.Ls);
    S.v('L', 'Total drain length', 'L_e + L_c + L_s', '', I.Le + I.Lc + I.Ls, 'm', '', 0);
    const own = new Sheet('x'); own.qty = S.qty; const RR = Object.assign({}, R, {QDRN: own});
    ['DR_EARTH','DR_CONC','DR_SWALE','DR_PIPE','DR_BOX','DR_RIPRAP','DR_POND_EXC'].forEach(k => { const t = qtySummary(S, [k], BOQ_LIB[k].desc + ' (' + BOQ_LIB[k].unit + ')', RR); S.r(k, BOQ_LIB[k].desc, t, BOQ_LIB[k].unit, 0); });
  }});
defCalc({id:'QCON', no:'CS-QTY-001', title:'Concrete Quantity', module:'m48', req:[43], purpose:'Summarise structural and lean concrete quantities from all calculations.', codes:['EN1992'], assume:['Quantities are net; wastage in rates.'], criteria:[], inputs:[],
  run(I, S, P, R){ const t = qtySummary(S, ['CN_G30'], 'Structural concrete C30/37 (m³)', R); const l = qtySummary(S, ['CN_LEAN'], 'Lean concrete (m³)', R); S.r('conc', 'Structural concrete', t, 'm³', 1); S.r('lean', 'Lean concrete', l, 'm³', 1); }});
defCalc({id:'QREB', no:'CS-QTY-002', title:'Reinforcement Quantity', module:'m48', req:[44], purpose:'Summarise reinforcement tonnage from all calculations and check average rate.', codes:['EN1992'], assume:['Reinforcement from designed As plus detailing allowances.'], criteria:['Average rate within 60–150 kg/m³ (sanity check)'], inputs:[],
  run(I, S, P, R){ const t = qtySummary(S, ['RF_Y'], 'Reinforcement (t)', R); const c = R.QCON ? R.QCON.res.conc : 1; const rt = S.v('ρ', 'Average reinforcement rate', 'ρ = W/V_c', `${f2(t)}×1000/${f1(c)}`, t * 1000 / c, 'kg/m³', '', 0); S.chk({label:'Average rate (sanity)', val: rt, lim: 150, rel:'<=', unit:'kg/m³', dp:0}); S.r('reb', 'Reinforcement', t, 't', 2); S.r('rate', 'Rate', rt, 'kg/m³', 0); }});
defCalc({id:'QRD', no:'CS-QTY-003', title:'Road Quantity Summary', module:'m48', req:[], purpose:'Summarise road and hardstanding quantities.', codes:['JKR_SPJ'], assume:[], criteria:[], inputs:[],
  run(I, S, P, R){ ['RD_SUBGRADE','RD_SUBBASE','RD_BASE','RD_AC','RD_HARD','FW_HARD'].forEach(k => S.r(k, BOQ_LIB[k].desc, qtySummary(S, [k], BOQ_LIB[k].desc + ' (' + BOQ_LIB[k].unit + ')', R), BOQ_LIB[k].unit, 0)); }});
defCalc({id:'QFDN', no:'CS-QTY-005', title:'Foundation Quantity', module:'m48', req:[47], purpose:'Summarise pile and foundation quantities.', codes:['EN1997'], assume:[], criteria:[], inputs:[],
  run(I, S, P, R){ ['PL_PV','PL_PREDRILL','PL_EQUIP','PL_TEST_C','PL_TEST_T','PL_TEST_L','EX_FDN','FW_FORM'].forEach(k => S.r(k, BOQ_LIB[k].desc, qtySummary(S, [k], BOQ_LIB[k].desc + ' (' + BOQ_LIB[k].unit + ')', R), BOQ_LIB[k].unit, 0)); }});

/* ---------- dependency ordering (calculation run sequence) ---------- */
(function reorder(){
  const mv = (id, beforeId) => { const i = CALC_ORDER.indexOf(id); if (i < 0) return; CALC_ORDER.splice(i, 1); const j = CALC_ORDER.indexOf(beforeId); CALC_ORDER.splice(j < 0 ? CALC_ORDER.length : j, 0, id); };
  mv('TC', 'IDF'); mv('CAT', 'TC');
  const o = CALC_ORDER.indexOf('OUT'); CALC_ORDER.splice(o, 1); CALC_ORDER.splice(CALC_ORDER.indexOf('DET') + 1, 0, 'OUT');
})();
