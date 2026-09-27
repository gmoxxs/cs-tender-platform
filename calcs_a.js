'use strict';
/* ==========================================================================
   CALCULATORS A — site, topography, geotechnical, earthworks, loads,
   PV piles, piles, shallow / equipment foundations, structural
   ========================================================================== */

/* ---------- shared engineering helpers ---------- */
const GAM_T = {CLAY:17, SILT:18, SAND:19, ROCK:21};
const Kp = phi => Math.pow(Math.tan(rad(45 + phi/2)), 2);
const Ka = phi => Math.pow(Math.tan(rad(45 - phi/2)), 2);
const fctm = fck => 0.30 * Math.pow(fck, 2/3);
function alphaTom(cu){ return cu <= 25 ? 1.0 : cu >= 70 ? 0.5 : 1.0 - 0.5 * (cu - 25) / 45; }
function ec3chi(lb, a){ const ph = 0.5 * (1 + a * (lb - 0.2) + lb*lb); return Math.min(1, 1 / (ph + Math.sqrt(Math.max(ph*ph - lb*lb, 0)))); }
const CURVE_A = {a0:0.13, a:0.21, b:0.34, c:0.49, d:0.76};
function vRdc(d, b, rho, fck){ const k = Math.min(1 + Math.sqrt(200/d), 2); const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck); const v = Math.max(0.12 * k * Math.pow(100 * Math.min(rho, 0.02) * fck, 1/3), vmin); return {k, vmin, v, V: v * b * d / 1000}; }
/* EC2 rectangular flexure with steps */
function rcFlex(S, o){
  const {M, b, h, c, bar, fck, fyk, tag} = o; const T = tag ? ` (${tag})` : '';
  const d = S.v('d', 'Effective depth'+T, 'd = h − c − φ/2', `${h} − ${c} − ${bar}/2`, h - c - bar/2, 'mm', 'EC2', 0);
  const K = S.v('K', 'Moment ratio'+T, 'K = M_Ed / (b d² f_ck)', `${f1(M)}×10⁶ / (${b} × ${f0(d)}² × ${fck})`, M * 1e6 / (b * d * d * fck), '', 'EC2 (rect. stress block)', 4);
  S.chk({label: 'K ≤ K′ (singly reinforced)'+T, val: K, lim: 0.167, rel: '<=', dp: 3, fix: 'Increase section depth or provide compression reinforcement.', ref: 'EC2 (K′ = 0.167, no redistribution)'});
  const z = S.v('z', 'Lever arm'+T, 'z = d[0.5 + √(0.25 − K/1.134)] ≤ 0.95d', `${f0(d)}[0.5 + √(0.25 − ${f3(K)}/1.134)]`, Math.min(d * (0.5 + Math.sqrt(Math.max(0.25 - K/1.134, 0))), 0.95 * d), 'mm', 'EC2', 0);
  const As = S.v('A_s', 'Tension steel required'+T, 'A_s = M_Ed / (0.87 f_yk z)', `${f1(M)}×10⁶ / (0.87 × ${fyk} × ${f0(z)})`, M * 1e6 / (0.87 * fyk * z), 'mm²' + (b === 1000 ? '/m' : ''), 'EC2', 0);
  const Asmin = S.v('A_s,min', 'Minimum steel'+T, 'A_s,min = max(0.26 f_ctm/f_yk, 0.0013) b d', `max(0.26×${f2(fctm(fck))}/${fyk}, 0.0013) × ${b} × ${f0(d)}`, Math.max(0.26 * fctm(fck) / fyk, 0.0013) * b * d, 'mm²' + (b === 1000 ? '/m' : ''), 'EC2 detailing', 0);
  const Areq = Math.max(As, Asmin), ab = Math.PI * bar * bar / 4;
  let s = null, Aprov, n = null;
  if (b === 1000){
    const smax = Math.min(250, 3 * h, 400);
    s = Math.max(75, Math.min(smax, Math.floor(1000 * ab / Areq / 25) * 25));
    Aprov = 1000 * ab / s;
    S.v('s', 'Bar spacing adopted'+T, 's = ⌊1000·(πφ²/4)/A_s,req⌋₂₅ ≤ s_max', `1000×${f1(ab)}/${f0(Areq)} → ≤ ${smax}`, s, 'mm', 'Detailing', 0);
    S.v('A_s,prov', 'Steel provided'+T, `T${bar} @ ${s}`, `1000×${f1(ab)}/${s}`, Aprov, 'mm²/m', '', 0);
  } else {
    n = Math.max(2, Math.ceil(Areq / ab)); Aprov = n * ab;
    S.v('n', 'Bars required'+T, 'n = ⌈A_s,req/(πφ²/4)⌉', `${f0(Areq)}/${f1(ab)}`, n, 'no.', '', 0);
  }
  S.chk({label: 'A_s,prov ≥ A_s,req'+T, val: Aprov, lim: Areq, rel: '>=', unit: 'mm²', dp: 0, kind: 'cap', what: 'reinforcement', dem: 'required steel area', fix: 'Increase bar size or reduce spacing.'});
  return {d, K, z, As, Asmin, Areq, Aprov, s, n, bar, rho: Aprov / (b * d)};
}

/* ---------- DEM (topography) ---------- */
let _demCache = null;
function genDEM(){
  const nx = 64, ny = 56, dx = 25, z = [];
  for (let i = 0; i < ny; i++){ const row = []; const y = (ny - 1 - i) * dx;
    for (let j = 0; j < nx; j++){ const x = j * dx;
      let v = 17.2 - 0.0030 * x - 0.0022 * y;
      v += 9.0 * Math.exp(-((x-300)**2 + (y-1050)**2) / (2 * 62**2));
      v += 11.0 * Math.exp(-((x-1250)**2 + (y-320)**2) / (2 * 34**2));
      v += 4.0 * Math.exp(-((x-820)**2 + (y-1180)**2) / (2 * 48**2));
      const t = ((x - 0) * 600 - (y - 700) * 1600) / Math.hypot(1600, 600); v -= 2.4 * Math.exp(-(t*t) / (2 * 32**2));
      v += 0.25 * Math.sin(x / 97) * Math.cos(y / 83);
      row.push(+v.toFixed(3)); }
    z.push(row); }
  return {nx, ny, dx, z, src: 'demo'};
}
function getDEM(){
  const t = P.tables.dem;
  if (t && t.z && t.z.length) return t;
  if (!_demCache) _demCache = genDEM();
  return _demCache;
}
function demSlope(D){ // returns per-cell {gx, gy (% ; +east, +north), s% , deg}
  const {nx, ny, dx, z} = D, out = [];
  for (let i = 0; i < ny; i++){ const r = [];
    for (let j = 0; j < nx; j++){
      const zl = z[i][Math.max(j-1,0)], zr = z[i][Math.min(j+1,nx-1)], zn = z[Math.max(i-1,0)][j], zs = z[Math.min(i+1,ny-1)][j];
      const gx = (zr - zl) / (dx * (Math.min(j+1,nx-1) - Math.max(j-1,0))) * 100, gy = (zn - zs) / (dx * (Math.min(i+1,ny-1) - Math.max(i-1,0))) * 100;
      const s = Math.hypot(gx, gy); r.push({gx, gy, s, deg: deg(Math.atan(s/100))}); }
    out.push(r); }
  return out;
}
function platCells(p, D){ const c = []; for (let i = p.y0; i < Math.min(p.y0 + p.h, D.ny); i++) for (let j = p.x0; j < Math.min(p.x0 + p.w, D.nx); j++) c.push([i, j]); return c; }
function platEGL(p){ const D = getDEM(); const c = platCells(p, D); return c.length ? sum(c.map(([i,j]) => D.z[i][j])) / c.length : null; }
function platforms(){ return (P.tables.platforms || []); }
function inPlatform(i, j){ return platforms().some(p => i >= p.y0 && i < p.y0 + p.h && j >= p.x0 && j < p.x0 + p.w); }

/* ======================================================================
   GEO — Borehole data & soil parameter interpretation
   ====================================================================== */
defCalc({id:'GEO', no:'CS-GEO-001', title:'Geotechnical Data & Soil Parameter Interpretation', module:'m10', req:[],
  purpose:'Interpret borehole data into engineering parameters, separating measured, interpreted and assumed values; identify governing ground conditions (hard strata, soft clay, groundwater, soil aggressivity).',
  codes:['EN1997','LIT_STROUD','LIT_HAT','BS8004'],
  assume:['Cu interpreted as f₁·N (Stroud) for cohesive layers; φ′ interpreted from N (Hatanaka & Uchida) for granular layers without overburden / energy correction — screening only.','Unit weights assumed from soil type where not measured.','Borehole data are representative of the zones between boreholes (to be confirmed by supplementary SI).'],
  criteria:['Hard stratum: SPT N ≥ N_hard','Soft clay: Cu < 25 kPa within upper 3 m','Aggressive soil screening: pH < pH_lim or resistivity < ρ_lim or chloride > Cl_lim'],
  inputs:[
    {g:'Interpretation'},
    {k:'bh', sym:'BH', l:'Design borehole — PV array piles', t:'s', o:()=>['AUTO (weakest)', ...(P.tables.bh||[]).map(b=>b.id)], d:'BH-01', c:'Consultant Assumption', s:'Representative of array zone 1; weakest BH checked separately'},
    {k:'bhf', sym:'BH_f', l:'Design borehole — platforms / shallow foundations', t:'s', o:()=>['AUTO (weakest)', ...(P.tables.bh||[]).map(b=>b.id)], d:'BH-03', c:'Consultant Assumption', s:'Borehole nearest substation / BESS platforms'},
    {k:'f1', sym:'f₁', l:'Cu–N correlation factor', u:'kPa/N', d:5.0, c:'Consultant Assumption', s:'Stroud (1974), typical 4.4–5'},
    {k:'kE', sym:'k_E', l:'Es–N correlation', u:'MPa/N', d:1.0, c:'Consultant Assumption'},
    {k:'Nhard', sym:'N_hard', l:'Hard stratum / refusal threshold', u:'blows', d:50, c:'Consultant Assumption'},
    {k:'topD', sym:'z_f', l:'Founding depth for shallow foundations', u:'m', d:1.0, c:'Consultant Assumption'},
    {g:'Aggressivity screening limits'},
    {k:'phLim', sym:'pH_lim', l:'pH lower limit', u:'', d:5.5, c:'Consultant Assumption', s:'Screening — confirm with corrosion specialist'},
    {k:'resLim', sym:'ρ_lim', l:'Resistivity lower limit', u:'Ω·cm', d:3000, c:'Consultant Assumption'},
    {k:'clLim', sym:'Cl_lim', l:'Chloride upper limit', u:'mg/kg', d:150, c:'Consultant Assumption'},
  ],
  run(I, S, P){
    const bhs = P.tables.bh || [];
    S.h('1. Borehole summary (measured)');
    S.tbl('Borehole summary', ['BH','RL (m)','Depth (m)','GWL (m bgl)','CBR (%)','Resist. (Ω·cm)','pH','SO₄ (mg/kg)','Cl (mg/kg)'],
      bhs.map(b => [b.id, f2(b.rl), f1(b.depth), f1(b.gwl), f0(b.cbr), f0(b.res), f1(b.ph), f0(b.so4), f0(b.cl)]));
    if (!bhs.length){ S.w('SI', 'No borehole data entered.'); return; }
    // interpreted layer parameters
    const interp = L => { const [from, to, desc, type, N] = L; const g = GAM_T[type] || 18;
      const cu = (type === 'CLAY' || type === 'SILT') ? I.f1 * N : 0;
      const phi = (type === 'SAND' || type === 'SILT' || type === 'ROCK') ? Math.min(Math.sqrt(20 * N) + 20, 42) : 0;
      return {from, to, desc, type, N, g, cu, phi, E: I.kE * N}; };
    S.h('2. Interpreted parameters (correlations)');
    S.v('C_u', 'Undrained shear strength (cohesive)', 'C_u = f₁ · N', `${I.f1} · N`, null, 'kPa', 'LIT_STROUD');
    S.v('φ′', 'Friction angle (granular)', 'φ′ = √(20N) + 20 ≤ 42°', '√(20N) + 20', null, '°', 'LIT_HAT');
    S.v('E_s', 'Soil modulus', 'E_s = k_E · N', `${I.kE} · N`, null, 'MPa', 'Consultant correlation');
    const rows = [];
    bhs.forEach(b => b.layers.forEach(L => { const p = interp(L); rows.push([b.id, `${f1(p.from)}–${f1(p.to)}`, p.desc, p.type, f0(p.N)+' (T)', f1(p.g)+' (A)', p.cu ? f0(p.cu)+' (I)' : '—', p.phi ? f1(p.phi)+' (I)' : '—', f1(p.E)+' (I)']); }));
    S.tbl('Layer parameters — (T) tested/measured, (I) interpreted, (A) assumed', ['BH','Depth (m)','Description','Type','SPT N','γ (kN/m³)','Cu (kPa)','φ′ (°)','Es (MPa)'], rows);
    // parameter summary by soil type
    const types = ['CLAY','SILT','SAND','ROCK'], sumRows = [];
    types.forEach(t => { const Ls = []; bhs.forEach(b => b.layers.forEach(L => { if (L[3] === t) Ls.push(interp(L)); }));
      if (!Ls.length) return; const Ns = Ls.map(l => l.N);
      sumRows.push([t, `${f0(Math.min(...Ns))}–${f0(Math.max(...Ns))}`, f1(Ls[0].g)+' A', t==='CLAY'?'0 A':t==='SILT'?'0–5 A':'0 A', Ls[0].phi ? f0(Math.min(...Ls.map(l=>l.phi)))+'–'+f0(Math.max(...Ls.map(l=>l.phi)))+' I' : '—', Ls[0].cu ? f0(Math.min(...Ls.map(l=>l.cu)))+'–'+f0(Math.max(...Ls.map(l=>l.cu)))+' I' : '—', f0(Math.min(...Ls.map(l=>l.E)))+'–'+f0(Math.max(...Ls.map(l=>l.E)))+' I']); });
    S.tbl('Engineering parameter summary (range; T = tested, I = interpreted, A = assumed)', ['Soil','SPT N (T)','γ','c′','φ′','Cu','Es (MPa)'], sumRows);
    // governing conditions
    S.h('3. Governing ground conditions');
    let hard = null, hardBH = '';
    bhs.forEach(b => b.layers.forEach(L => { if (L[4] >= I.Nhard && (hard === null || L[0] < hard)){ hard = L[0]; hardBH = b.id; } }));
    if (hard !== null) S.r('hardDepth', 'Shallowest hard stratum (N ≥ '+I.Nhard+')', hard, 'm bgl', 1);
    S.txt(hard !== null ? `Shallowest hard stratum at ${f1(hard)} m bgl in ${hardBH}.` : 'No hard stratum encountered within borehole depths.');
    const soft = []; bhs.forEach(b => b.layers.forEach(L => { const p = interp(L); if (p.type === 'CLAY' && p.cu < 25 && p.from < 3) soft.push(b.id); }));
    S.r('softTop', 'Soft clay (Cu<25 kPa) in upper 3 m — no. of BH', soft.length, 'no.', 0);
    const gwl = Math.min(...bhs.map(b => b.gwl)); S.r('gwlMin', 'Shallowest groundwater', gwl, 'm bgl', 1);
    const corr = bhs.filter(b => b.ph < I.phLim || b.res < I.resLim || b.cl > I.clLim);
    S.r('corrosive', 'Boreholes failing aggressivity screening', corr.length, 'no.', 0);
    S.tbl('Aggressivity screening', ['BH','pH','Resistivity','Chloride','Result'], bhs.map(b => [b.id, f1(b.ph), f0(b.res), f0(b.cl), (b.ph < I.phLim || b.res < I.resLim || b.cl > I.clLim) ? 'AGGRESSIVE' : 'Not aggressive']));
    const cbrMin = Math.min(...bhs.map(b => b.cbr)); S.r('cbrMin', 'Minimum subgrade CBR', cbrMin, '%', 0);
    const la = +P.info.landArea || 1; const dens = S.v('n/A', 'Borehole density', 'n_BH / A_site', `${bhs.length} / ${la}`, bhs.length / la, 'BH/ha', '', 3);
    S.r('bhPerHa', 'Borehole density', dens, 'BH/ha', 3);
    S.chk({label:'SI coverage (screening target 1 BH per 25 ha)', val: dens, lim: 1/25, rel:'>=', unit:'BH/ha', dp:3, fix:'Supplementary SI (boreholes / CPT / test pits) required for the array and platform areas.'});
    // design borehole
    const avgTop = b => { const Ls = b.layers.filter(L => L[0] < 6); return Ls.length ? sum(Ls.map(L => L[4] * (Math.min(L[1],6) - L[0]))) / 6 : 99; };
    let dbh = I.bh === 'AUTO (weakest)' ? bhs.slice().sort((a,b) => avgTop(a) - avgTop(b))[0] : (bhs.find(b => b.id === I.bh) || bhs[0]);
    S.h('4. Design profile');
    S.txt(`Design borehole: ${dbh.id}${I.bh === 'AUTO (weakest)' ? ' (lowest average SPT N over upper 6 m — governing)' : ' (user-selected)'}; GWL ${f1(dbh.gwl)} m bgl.`);
    S.profile = dbh.layers.map(interp); S.profileBH = dbh.id; S.profileGWL = dbh.gwl;
    S.tbl('Design profile', ['From (m)','To (m)','Type','N','γ','Cu','φ′','Es'], S.profile.map(p => [f1(p.from), f1(p.to), p.type, f0(p.N), f1(p.g), f0(p.cu), f1(p.phi), f1(p.E)]));
    S.r('gwlDesign', 'Design groundwater level', dbh.gwl, 'm bgl', 1);
    S.r('topD', 'Shallow founding depth', I.topD, 'm', 2);
    const fbh = I.bhf === 'AUTO (weakest)' ? bhs.slice().sort((a,b) => avgTop(a) - avgTop(b))[0] : (bhs.find(b => b.id === I.bhf) || bhs[0]);
    const fprof = fbh.layers.map(interp);
    const fl = fprof.find(p => I.topD >= p.from && I.topD < p.to) || fprof[0];
    S.txt(`Shallow foundation design borehole: ${fbh.id}; founding layer at ${I.topD} m: ${fl.desc} (${fl.type}, N = ${fl.N}).`);
    const weak = bhs.slice().sort((a,b) => avgTop(a) - avgTop(b))[0];
    if (weak.id !== dbh.id) S.n(`Weakest borehole ${weak.id} (average N over 6 m = ${f1(avgTop(weak))}) differs from the adopted PV design borehole ${dbh.id} — pile design to be zoned; weaker zones require longer piles (verify by pile tests).`);
    S.r('fdn_phi', 'Founding layer φ′ (shallow fdn.)', fl.phi || 0, '°', 1);
    S.r('fdn_cu', 'Founding layer Cu (shallow fdn.)', fl.cu || 0, 'kPa', 0);
    S.r('fdn_g', 'Founding layer γ', fl.g, 'kN/m³', 1);
    S.r('fdn_E', 'Founding layer Es', fl.E, 'MPa', 1);
    S.r('fdn_type_clay', 'Founding layer cohesive (1 = yes)', (fl.type === 'CLAY') ? 1 : 0, '', 0);
    S.r('fdn_gwl', 'Groundwater at shallow-foundation borehole', fbh.gwl, 'm bgl', 1);
    // warnings / interpretation
    S.w('SI', 'Parameters are correlation-based (SPT). Laboratory strength tests (UU / CIU / shear box) required for detailed design.');
    if (soft.length) S.n(`Soft clay (Cu < 25 kPa) within the upper 3 m at ${soft.join(', ')} — low lateral pile resistance and settlement-sensitive platforms in these zones.`);
    if (hard !== null) S.n(`Hard stratum (N ≥ ${I.Nhard}) from ${f1(hard)} m bgl (${hardBH}) — pile refusal risk where PV pile embedment exceeds this depth.`);
    if (corr.length) S.n(`${corr.length} of ${bhs.length} boreholes fail the aggressivity screening (${corr.map(b=>b.id).join(', ')}): corrosion allowance / coating class for steel piles must be confirmed.`);
    if (gwl < 1.5) S.n(`Groundwater as shallow as ${f1(gwl)} m bgl — dewatering for excavations and buoyancy of sumps / pits to be considered.`);
    S.p('Adopt design profile from '+dbh.id+' for PV pile screening; zone the site by geology for pile testing.');
    S.q('SI_BH', 0); // quantity for additional SI computed in ESC/QTO
    const addBH = Math.max(0, Math.ceil(la / 25) - bhs.length);
    if (addBH) { S.out(`${addBH} additional boreholes required to reach 1 BH / 25 ha screening density.`); S.q('SI_BH', addBH, `Additional boreholes to 1 per 25 ha: ⌈${la}/25⌉ − ${bhs.length}`); }
    S.q('SI_LAB', 1, 'Laboratory test lot');
    S.ti('Tender to include supplementary SI and pile driving / pull-out trials as priced items; ground risk allocation to be stated in the clarifications.');
  }});

/* ======================================================================
   TOPO — slope statistics
   ====================================================================== */
defCalc({id:'TOPO', no:'CS-TOP-001', title:'Topographical Analysis & Slope Statistics', module:'m8', req:[3],
  purpose:'Determine elevation statistics, slope distribution and developable area from the DTM grid.',
  codes:['CLIENT_ER','PLAN_GP'],
  assume:['Slope computed by central differences on the gridded DTM.','Developable area excludes cells steeper than the developable slope limit.'],
  criteria:['Slope bands 0–3°, 3–5°, 5–10°, 10–15°, 15–20°, >20°','Developable slope limit (layout constraint)'],
  inputs:[
    {k:'sdev', sym:'θ_dev', l:'Developable slope limit', u:'°', d:10, c:'Consultant Assumption'},
    {k:'haMWp', sym:'a', l:'Land required per MWp', u:'ha/MWp', d:1.25, c:'Consultant Assumption', s:'Tracker layout benchmark — confirm with layout'},
  ],
  run(I, S, P){
    const D = getDEM(), sl = demSlope(D), zs = D.z.flat(), sv = sl.flat();
    const ca = D.dx * D.dx / 1e4;
    S.h('1. DTM');
    S.v('n', 'Grid cells', 'n = n_x × n_y', `${D.nx} × ${D.ny}`, D.nx * D.ny, 'cells', '', 0);
    S.v('A_cell', 'Cell area', 'A = Δx²', `${D.dx}²`, D.dx * D.dx, 'm²', '', 0);
    if (D.src === 'demo') S.w('TOPO', 'DTM is a synthetic demonstration grid. Replace with surveyed DTM (GDM2000) before design.');
    S.h('2. Elevation statistics');
    const zmin = S.r('zmin', 'Minimum elevation', Math.min(...zs), 'm RL', 2);
    const zmax = S.r('zmax', 'Maximum elevation', Math.max(...zs), 'm RL', 2);
    S.r('zrange', 'Elevation range', zmax - zmin, 'm', 2);
    S.r('zavg', 'Average elevation', sum(zs) / zs.length, 'm RL', 2);
    S.h('3. Slope statistics');
    S.v('s', 'Cell slope', 's = √(g_x² + g_y²) ; θ = atan(s)', 'central differences', null, '%', '');
    S.r('savg', 'Average slope', sum(sv.map(c => c.deg)) / sv.length, '°', 2);
    S.r('smax', 'Maximum slope', Math.max(...sv.map(c => c.deg)), '°', 2);
    const bands = [[0,3],[3,5],[5,10],[10,15],[15,20],[20,90]], cnt = bands.map(([a,b]) => sv.filter(c => c.deg >= a && c.deg < b).length);
    S.tbl('Slope distribution', ['Band','Cells','Area (ha)','%'], bands.map((b, k) => [b[1] === 90 ? '>20°' : `${b[0]}–${b[1]}°`, f0(cnt[k]), f2(cnt[k] * ca), f1(cnt[k] / sv.length * 100)]));
    S.bands = cnt.map(c => c / sv.length * 100);
    bands.forEach((b, k) => S.r('band' + k, 'Slope band ' + (b[1] === 90 ? '>20°' : `${b[0]}–${b[1]}°`), cnt[k] / sv.length * 100, '%', 1));
    S.h('4. Developable area');
    const gridA = S.v('A_grid', 'DTM area', 'A = n · A_cell', `${sv.length} × ${f3(ca)}`, sv.length * ca, 'ha', '', 1);
    const devC = sv.filter(c => c.deg <= I.sdev).length;
    const land = +P.info.landArea || gridA;
    const dev = S.v('A_dev', 'Developable area (θ ≤ θ_dev), scaled to land area', 'A_dev = A_land × n(θ≤θ_dev)/n', `${land} × ${devC}/${sv.length}`, land * devC / sv.length, 'ha', '', 1);
    S.r('adev', 'Developable area', dev, 'ha', 1);
    const req = S.v('A_req', 'Area required for PV', 'A_req = a · MWp', `${I.haMWp} × ${P.info.mwp}`, I.haMWp * (+P.info.mwp || 0), 'ha', '', 1);
    S.chk({label:'Developable area vs required', val: dev, lim: req, rel:'>=', unit:'ha', dp:1, kind:'cap', what:'developable area', dem:'area required for the PV capacity', fix:'Layout optimisation, grading of steep zones or capacity reduction required.'});
    const steep = cnt[3] + cnt[4] + cnt[5], sp = steep / sv.length * 100;
    const rate = sp < 2 ? 'LOW' : sp < 8 ? 'MODERATE' : 'HIGH';
    S.r('steepPct', 'Area steeper than 10°', sp, '%', 1);
    S.n(`Site elevation ranges ${f2(zmin)}–${f2(zmax)} m RL; ${f1(S.bands[0])}% of the site is ≤3° and ${f1(sp)}% exceeds 10°. Topographic suitability rating: ${rate}.`);
    S.n(`Grading risk ${rate}; drainage risk ${S.res.savg < 1 ? 'HIGH (flat — ponding)' : 'MODERATE'}; foundation risk (slope-related) ${sp > 5 ? 'MODERATE' : 'LOW'}; access risk ${S.res.smax > 15 ? 'MODERATE (local steep zones)' : 'LOW'}.`);
    S.suit = {rate, grading: rate, drainage: S.res.savg < 1 ? 'HIGH' : 'MODERATE', foundation: sp > 5 ? 'MODERATE' : 'LOW', access: S.res.smax > 15 ? 'MODERATE' : 'LOW'};
    S.q('SURV_TOPO', land, 'Site area (ha)');
    S.q('AS_BUILT', land, 'Site area (ha)');
    S.q('EW_CLEAR', land * 0.9, 'Clearing assumed 90% of site area');
    S.p('Avoid PV blocks in zones > '+I.sdev+'°; locate substation/BESS on flattest high ground above flood level.');
  }});

/* ======================================================================
   GRD — grading analysis (tracker / fixed-tilt)
   ====================================================================== */
defCalc({id:'GRD', no:'CS-TOP-002', title:'Grading Analysis (Tracker / Fixed-Tilt Tolerance)', module:'m12', req:[],
  purpose:'Classify the array area into grading zones against mounting-system slope tolerances and estimate array grading volumes.',
  codes:['CLIENT_ER'],
  assume:['Grading within array assumed balanced cut-to-fill over a tracker row length about the row centre.','Mean cut depth over graded area = Δs·L_r/8 (linear wedge).'],
  criteria:['No grading: N–S and E–W slopes within tolerance','Moderate: ≤ 1.5 × tolerance','Major: > 1.5 × tolerance'],
  inputs:[
    {k:'sys', sym:'—', l:'Mounting system', t:'s', o:['Single-axis tracker','Fixed-tilt'], d:'Single-axis tracker', c:'Client Provided'},
    {k:'sNS', sym:'s_NS', l:'N–S (along row) slope tolerance', u:'%', d:10, c:'Vendor Certified', s:'Tracker vendor data (demo) — VENDOR LOAD REQUIRED'},
    {k:'sEW', sym:'s_EW', l:'E–W (row-to-row) slope tolerance', u:'%', d:15, c:'Vendor Certified'},
    {k:'Lr', sym:'L_r', l:'Row length (N–S)', u:'m', d:90, c:'Client Provided'},
  ],
  run(I, S, P){
    const D = getDEM(), sl = demSlope(D), ca = D.dx * D.dx;
    let n0 = 0, n1 = 0, n2 = 0, tot = 0, V = 0; const zone = [];
    for (let i = 0; i < D.ny; i++){ const r = []; for (let j = 0; j < D.nx; j++){
      if (inPlatform(i, j)){ r.push(-1); continue; } tot++;
      const c = sl[i][j], ns = Math.abs(c.gy), ew = Math.abs(c.gx), rns = ns / I.sNS, rew = ew / I.sEW, rm = Math.max(rns, rew);
      const z = rm <= 1 ? 0 : rm <= 1.5 ? 1 : 2; r.push(z); if (z === 0) n0++; else if (z === 1) n1++; else n2++;
      if (ns > I.sNS) V += ca * (ns - I.sNS) / 100 * I.Lr / 8; } zone.push(r); }
    S.zone = zone;
    S.h('1. Zone classification');
    S.v('r', 'Slope ratio per cell', 'r = max(|s_NS|/s_NS,lim , |s_EW|/s_EW,lim)', `limits ${I.sNS}% / ${I.sEW}%`, null, '', 'Vendor tolerance');
    const pct = x => x / tot * 100;
    S.tbl('Grading zones (array area, excl. platforms)', ['Zone','Criterion','Cells','Area (ha)','%'], [
      ['No grading','r ≤ 1.0', f0(n0), f2(n0*ca/1e4), f1(pct(n0))], ['Moderate grading','1.0 < r ≤ 1.5', f0(n1), f2(n1*ca/1e4), f1(pct(n1))], ['Major grading','r > 1.5', f0(n2), f2(n2*ca/1e4), f1(pct(n2))]]);
    S.r('nogradePct', 'No-grading zone', pct(n0), '%', 1); S.r('modPct', 'Moderate grading zone', pct(n1), '%', 1); S.r('majorPct', 'Major grading zone', pct(n2), '%', 1);
    S.h('2. Array grading volume (balanced)');
    S.v('V', 'Grading cut (= fill) volume', 'V = Σ A_cell · (s_NS − s_lim)/100 · L_r/8', `Σ over ${n1+n2} cells`, V, 'm³', 'Linear wedge about row centre', 0);
    S.r('gradeV', 'Array grading cut (≈ fill)', V, 'm³', 0);
    S.r('gradeArea', 'Area requiring grading', (n1 + n2) * ca / 1e4, 'ha', 2);
    S.chk({label:'Major grading zone fraction', val: pct(n2), lim: 5, rel:'<=', unit:'%', dp:1, fix:'Re-layout PV blocks away from major grading zones or confirm extended tolerance with vendor.'});
    S.n(`${f1(pct(n0))}% of the array area is within ${I.sys.toLowerCase()} tolerances without grading; ${f1(pct(n1+n2))}% (${f2((n1+n2)*ca/1e4)} ha) requires local grading, estimated at ${f0(V)} m³ balanced cut/fill.`);
    S.w('VENDOR', 'Tracker slope tolerances (N–S, E–W and row-to-row) to be confirmed by vendor.');
    S.p('Grade only moderate/major zones; retain vegetation elsewhere to limit erosion; drainage direction to follow natural fall (N–E).');
  }});

/* ======================================================================
   LAND — land / boundary & developable area after setbacks
   ====================================================================== */
defCalc({id:'LAND', no:'CS-LND-001', title:'Land / Boundary & Setback Area', module:'m9', req:[],
  purpose:'Check land area against lot data and compute developable area after boundary setbacks and reserves.',
  codes:['PLAN_GP','JPS_RR','PBT_REQ'],
  assume:['Setback applied uniformly along the perimeter: A_net = A − P·s + 4s² (convex boundary approximation).'],
  criteria:['Boundary setback (PBT / planning)','River reserve (JPS)'],
  inputs:[
    {k:'A', sym:'A', l:'Land area (title)', u:'ha', d:()=>+P.info.landArea||0, c:'Client Provided'},
    {k:'Pm', sym:'P', l:'Site perimeter', u:'m', d:6250, c:'Estimated'},
    {k:'s', sym:'s', l:'Boundary setback', u:'m', d:10, c:'Consultant Assumption', s:'AUTHORITY CONFIRMATION REQUIRED'},
    {k:'rr', sym:'A_rr', l:'River / drain reserve area', u:'ha', d:2.4, c:'Estimated'},
    {k:'oth', sym:'A_o', l:'Other exclusions (TNB wayleave, graves, etc.)', u:'ha', d:1.5, c:'Estimated'},
  ],
  run(I, S, P){
    const lots = P.tables.lots || [], lotA = sum(lots.map(l => +l.area));
    S.h('1. Lot areas');
    S.tbl('Lot schedule', ['Lot','Title','Area (ha)','Status'], lots.map(l => [l.lot, l.title, f2(+l.area), l.status]).concat([['Total','',f2(lotA),'']]));
    S.chk({label:'Σ lot area vs project land area (±2%)', val: Math.abs(lotA - I.A) / Math.max(I.A,1) * 100, lim: 2, rel:'<=', unit:'%', dp:1, fix:'Reconcile land area in RFP with title documents.'});
    S.h('2. Developable area after setbacks');
    const sb = S.v('A_sb', 'Setback area', 'A_sb = P·s − 4s²', `${I.Pm}×${I.s} − 4×${I.s}²`, (I.Pm * I.s - 4 * I.s * I.s) / 1e4, 'ha', 'Geometric', 2);
    const net = S.v('A_net', 'Net developable land', 'A_net = A − A_sb − A_rr − A_o', `${I.A} − ${f2(sb)} − ${I.rr} − ${I.oth}`, I.A - sb - I.rr - I.oth, 'ha', '', 2);
    S.r('anet', 'Net developable land', net, 'ha', 2);
    S.r('perim', 'Site perimeter', I.Pm, 'm', 0);
    S.n(`Setbacks and reserves remove ${f2(sb + I.rr + I.oth)} ha (${f1((sb + I.rr + I.oth)/I.A*100)}%) of the land area.`);
    S.w('AUTH', 'Setback and reserve widths to be confirmed with PBT / PLANMalaysia / JPS.');
  }});

/* ======================================================================
   FPL — flood platform level (defined early: used by cut & fill)
   ====================================================================== */
defCalc({id:'FPL', no:'CS-HYD-011', title:'Flood Platform Level', module:'m19', req:[31],
  purpose:'Determine minimum platform RL for flood-sensitive facilities and the resulting fill depths.',
  codes:['MSMA2','JPS_FLOOD','CLIENT_ER'],
  assume:['Platform RL = DFL + freeboard + settlement allowance + construction tolerance.','Inverter/MV skid plinths assessed at the 10th-percentile ground level of the array (low areas).'],
  criteria:['Freeboard above design flood level per facility (client / authority)'],
  inputs:[
    {k:'dfl', sym:'DFL', l:'Design flood level', u:'m RL', d:11.80, c:'Estimated', s:'JPS DATA REQUIRED — official flood level'},
    {k:'fbSS', sym:'FB_SS', l:'Freeboard — substation / control room', u:'m', d:0.50, c:'Consultant Assumption', s:'Client / TNB requirement'},
    {k:'fbB', sym:'FB_B', l:'Freeboard — BESS', u:'m', d:0.50, c:'Consultant Assumption'},
    {k:'fbI', sym:'FB_I', l:'Freeboard — inverter / MV skid', u:'m', d:0.30, c:'Consultant Assumption'},
    {k:'st', sym:'Δs', l:'Settlement allowance', u:'m', d:0.10, c:'Consultant Assumption'},
    {k:'tol', sym:'Δt', l:'Construction tolerance', u:'m', d:0.05, c:'Consultant Assumption'},
  ],
  run(I, S, P){
    S.h('1. Required platform levels');
    const D = getDEM(), zs = D.z.flat().slice().sort((a,b) => a-b), p10 = zs[Math.floor(zs.length * 0.10)];
    const fac = [['SS','Substation','PF-SS',I.fbSS],['OM','Control / O&M building','PF-OM',I.fbSS],['INV','Inverter / MV skid (array low zone)',null,I.fbI]];
    if (P.type === 'B') fac.splice(1, 0, ['BESS','BESS compound','PF-BESS',I.fbB]);
    const rows = []; let fmax = 0;
    fac.forEach(([k, name, pid, fb]) => {
      const rl = S.v('RL_'+k, name, 'RL = DFL + FB + Δs + Δt', `${I.dfl} + ${fb} + ${I.st} + ${I.tol}`, I.dfl + fb + I.st + I.tol, 'm RL', 'JPS / client', 2);
      const pl = pid ? platforms().find(p => p.id === pid) : null; const egl = pl ? platEGL(pl) : p10;
      const fd = Math.max(0, rl - egl); fmax = Math.max(fmax, fd);
      S.r('rl_' + k, 'Required RL — ' + name, rl, 'm RL', 2); S.r('egl_' + k, 'Existing ground — ' + name, egl, 'm RL', 2); S.r('fill_' + k, 'Raise above EGL — ' + name, fd, 'm', 2);
      rows.push([name, f2(egl), f2(rl), f2(fd)]);
    });
    S.tbl('Platform levels', ['Facility','EGL (avg) m RL','Required RL','Raise (m)'], rows);
    S.r('fillMax', 'Maximum platform raise', fmax, 'm', 2);
    S.chk({label:'Maximum platform raise (screening limit for fill without retaining walls)', val: fmax, lim: 1.5, rel:'<=', unit:'m', dp:2, fix:'Consider retaining walls / relocate facility to higher ground.'});
    S.w('JPS', 'Design flood level is not from official JPS data. Obtain flood level / flood map before freezing platform levels.');
    S.n(`Required platform RLs range ${f2(Math.min(...fac.map(f=>S.res['rl_'+f[0]])))}–${f2(Math.max(...fac.map(f=>S.res['rl_'+f[0]])))} m RL; maximum raise ${f2(fmax)} m above existing ground.`);
    S.p('Adopt platform RLs above as minimum; inverter skids on raised plinths where local ground is below required RL.');
    S.ti('Platform fill and plinth heights depend on unconfirmed flood level — carry provisional quantity in tender.');
  }});

/* ======================================================================
   CF — cut & fill (grid method)
   ====================================================================== */
defCalc({id:'CF', no:'CS-EW-001', title:'Cut & Fill (Grid Method)', module:'m13', req:[1],
  purpose:'Compute cut and fill volumes for platforms and array grading from the DTM grid and design surfaces, with bulking/shrinkage adjustment.',
  codes:['BS6031','JKR_SPJ'],
  assume:['Platform design surface: plane through centroid RL with cross-fall g_x (fall to east).','Platform RL = max(average EGL, flood RL) where set to AUTO.','Array grading volume from grading analysis (balanced).'],
  criteria:['Adjusted Cut = Raw Cut × Bulking/Shrinkage Adjustment','Required Fill = Compacted Fill Requirement','Net Balance = Adjusted Cut − Required Fill'],
  inputs:[
    {k:'sf', sym:'SF', l:'Shrinkage factor (bank → compacted)', u:'', d:0.90, c:'Consultant Assumption', s:'Confirm by compaction trials'},
    {k:'datum', sym:'z₀', l:'Volume datum', u:'m RL', d:10.0, c:'Consultant Assumption'},
    {k:'gradeV', sym:'V_g', l:'Array grading cut (= fill)', u:'m³', d:0, link:'GRD.gradeV'},
    {k:'rate', sym:'r', l:'Blended earthworks rate (preliminary)', u:'RM/m³', d:9.0, c:'Estimated'},
  ],
  run(I, S, P, R){
    const D = getDEM(), ca = D.dx * D.dx; let cutT = 0, fillT = 0, exV = 0, prV = 0, pa = 0;
    const map = {'PF-SS':'SS','PF-BESS':'BESS','PF-OM':'OM'};
    const rows = [];
    S.h('1. Platforms');
    S.v('Δz', 'Cell depth', 'Δz = z_design − z_existing (+ fill, − cut)', 'per cell', null, 'm');
    S.v('V', 'Cell volume', 'V = Δz · A_cell', `Δz × ${ca}`, null, 'm³');
    platforms().forEach(p => {
      if (p.id === 'PF-BESS' && P.type !== 'B') return;
      const cells = platCells(p, D); if (!cells.length) return;
      const egl = platEGL(p), fk = map[p.id]; const frl = fk && R.FPL ? R.FPL.res['rl_' + fk] : null;
      const rl = p.auto ? Math.max(egl, frl || -1e9) : +p.rl; p._rl = rl;
      const jc = p.x0 + (p.w - 1) / 2; let c = 0, f = 0;
      cells.forEach(([i, j]) => { const zd = rl - (j - jc) * D.dx * (p.gx || 0) / 100; const dz = zd - D.z[i][j]; if (dz > 0) f += dz * ca; else c += -dz * ca; exV += (D.z[i][j] - I.datum) * ca; prV += (zd - I.datum) * ca; });
      cutT += c; fillT += f; pa += cells.length * ca;
      rows.push([p.name, f2(cells.length * ca / 1e4), f2(egl), f2(rl) + (p.auto ? (frl && frl > egl ? ' (flood)' : ' (balanced)') : ' (user)'), f0(c), f0(f)]);
      S.r('rl_' + p.id, 'Design RL — ' + p.name, rl, 'm RL', 2);
    });
    S.tbl('Platform cut & fill', ['Platform','Area (ha)','EGL avg (m RL)','Design RL','Cut (m³)','Fill (m³)'], rows);
    S.v('V_ex', 'Existing surface volume above datum (platforms)', 'V_ex = Σ (z_e − z₀)·A', `z₀ = ${I.datum}`, exV, 'm³', '', 0);
    S.v('V_pr', 'Proposed surface volume above datum (platforms)', 'V_pr = Σ (z_d − z₀)·A', `z₀ = ${I.datum}`, prV, 'm³', '', 0);
    S.h('2. Array grading');
    S.v('V_g', 'Array grading cut = fill', 'from grading analysis', 'linked', I.gradeV, 'm³', 'CS-TOP-002', 0);
    S.h('3. Totals & balance');
    const cut = S.v('V_c', 'Raw cut (bank)', 'V_c = Σ cut + V_g', `${f0(cutT)} + ${f0(I.gradeV)}`, cutT + I.gradeV, 'm³', '', 0);
    const fill = S.v('V_f', 'Required fill (compacted)', 'V_f = Σ fill + V_g', `${f0(fillT)} + ${f0(I.gradeV)}`, fillT + I.gradeV, 'm³', '', 0);
    const adj = S.v('V_c,adj', 'Adjusted cut (compacted equivalent)', 'Adjusted Cut = Raw Cut × SF', `${f0(cut)} × ${I.sf}`, cut * I.sf, 'm³', 'BS6031', 0);
    const net = S.v('ΔV', 'Net balance', 'Net = Adjusted Cut − Required Fill', `${f0(adj)} − ${f0(fill)}`, adj - fill, 'm³', '', 0);
    S.r('cut', 'Raw cut (bank)', cut, 'm³', 0); S.r('fillReq', 'Required fill (compacted)', fill, 'm³', 0); S.r('adjCut', 'Adjusted cut', adj, 'm³', 0); S.r('net', 'Net balance (+surplus / −deficit)', net, 'm³', 0);
    S.r('sf', 'Shrinkage factor', I.sf, '', 2);
    S.r('platArea', 'Platform area', pa / 1e4, 'ha', 2); S.r('platCut', 'Platform cut', cutT, 'm³', 0); S.r('platFill', 'Platform fill', fillT, 'm³', 0);
    S.r('import', 'Imported fill (compacted)', Math.max(0, -net), 'm³', 0); S.r('surplus', 'Surplus cut (compacted eq.)', Math.max(0, net), 'm³', 0);
    const cost = S.v('C', 'Preliminary earthworks cost', 'C = (V_c + V_f) · r', `(${f0(cut)} + ${f0(fill)}) × ${I.rate}`, (cut + fill) * I.rate, 'RM', 'Preliminary', 0);
    S.r('cost', 'Preliminary earthworks cost', cost, 'RM', 0);
    S.n(net < 0 ? `Earthworks are in deficit by ${f0(-net)} m³ (compacted): imported fill required, driven mainly by raising platforms to flood-free levels.` : `Earthworks show a surplus of ${f0(net)} m³ (compacted equivalent) for disposal or re-use in landscaping bunds.`);
    S.w('TOPO', 'Volumes depend on DTM accuracy; confirm with surveyed DTM and final platform levels.');
    S.p('Platforms set at the higher of balanced level and flood RL; cross-fall 0.5% to perimeter drains.');
  }});

/* ======================================================================
   EWB — earthwork quantity & balance
   ====================================================================== */
defCalc({id:'EWB', no:'CS-EW-002', title:'Earthwork Quantities & Balance', module:'m11', req:[2],
  purpose:'Derive stripping, unsuitable removal, cut, fill, imported fill, disposal and haulage quantities for BOQ.',
  codes:['BS6031','JKR_SPJ'],
  assume:['Topsoil stripped under platforms, roads and graded array zones only; vegetation retained elsewhere.','Unsuitable material replaced with compacted suitable fill.','Disposal measured as loose volume (bank × bulking factor).'],
  criteria:['Fill compacted to 95% MDD (JKR specification — VERIFY clause)'],
  inputs:[
    {g:'Areas & depths'},
    {k:'aPlat', sym:'A_p', l:'Platform area', u:'ha', d:0, link:'CF.platArea'},
    {k:'aGrade', sym:'A_g', l:'Graded array area', u:'ha', d:0, link:'GRD.gradeArea'},
    {k:'aRoad', sym:'A_r', l:'Road footprint area', u:'ha', d:3.2, c:'Estimated'},
    {k:'ts', sym:'t_s', l:'Topsoil stripping depth', u:'m', d:0.15, c:'Consultant Assumption', s:'Test pits required'},
    {k:'au', sym:'A_u', l:'Area of unsuitable material (soft zones under platforms/roads)', u:'ha', d:2.5, c:'Estimated'},
    {k:'tu', sym:'t_u', l:'Unsuitable thickness', u:'m', d:0.6, c:'Estimated', s:'SI REQUIRED'},
    {g:'Volumes (linked)'},
    {k:'cut', sym:'V_c', l:'Raw cut (bank)', u:'m³', d:0, link:'CF.cut'},
    {k:'fill', sym:'V_f', l:'Design fill (compacted)', u:'m³', d:0, link:'CF.fillReq'},
    {g:'Factors'},
    {k:'sf', sym:'SF', l:'Shrinkage factor bank → compacted', u:'', d:0.90, link:'CF.sf'},
    {k:'bf', sym:'BF', l:'Bulking factor bank → loose', u:'', d:1.25, c:'Consultant Assumption'},
    {k:'dd', sym:'d_d', l:'Disposal haul distance', u:'km', d:8, c:'Estimated'},
    {k:'di', sym:'d_i', l:'Import haul distance', u:'km', d:15, c:'Estimated'},
    {k:'fh', sym:'d_f', l:'Free-haul distance', u:'km', d:1, c:'Consultant Assumption'},
  ],
  run(I, S){
    S.h('1. Stripping & unsuitable');
    const As = S.v('A_s', 'Stripping area', 'A_s = A_p + A_g + A_r', `${f2(I.aPlat)} + ${f2(I.aGrade)} + ${f2(I.aRoad)}`, I.aPlat + I.aGrade + I.aRoad, 'ha', '', 2);
    const Vs = S.v('V_s', 'Topsoil stripping', 'V_s = A_s · 10⁴ · t_s', `${f2(As)}×10⁴×${I.ts}`, As * 1e4 * I.ts, 'm³', '', 0);
    const Vu = S.v('V_u', 'Unsuitable removal', 'V_u = A_u · 10⁴ · t_u', `${I.au}×10⁴×${I.tu}`, I.au * 1e4 * I.tu, 'm³', '', 0);
    S.h('2. Balance');
    const Vf = S.v('V_f,tot', 'Total compacted fill', 'V_f,tot = V_f + V_u + V_s(reinstatement under fill)', `${f0(I.fill)} + ${f0(Vu)} + 0`, I.fill + Vu, 'm³', '', 0);
    const Vca = S.v('V_c,adj', 'Adjusted cut (compacted eq.)', 'V_c,adj = V_c · SF', `${f0(I.cut)} × ${I.sf}`, I.cut * I.sf, 'm³', '', 0);
    const net = S.v('ΔV', 'Net balance', 'ΔV = V_c,adj − V_f,tot', `${f0(Vca)} − ${f0(Vf)}`, Vca - Vf, 'm³', '', 0);
    const Vi = S.v('V_imp', 'Imported fill (compacted)', 'V_imp = max(0, −ΔV)', '', Math.max(0, -net), 'm³', '', 0);
    const surplusBank = Math.max(0, net) / I.sf;
    const Vd = S.v('V_disp', 'Disposal (loose)', 'V_disp = (V_u + V_s,surplus + max(0,ΔV)/SF) · BF', `(${f0(Vu)} + 0 + ${f0(surplusBank)}) × ${I.bf}`, (Vu + surplusBank) * I.bf, 'm³', '', 0);
    S.h('3. Haulage');
    const H = S.v('H', 'Overhaul', 'H = V_disp·(d_d − d_f) + V_imp·(d_i − d_f)', `${f0(Vd)}×(${I.dd}−${I.fh}) + ${f0(Vi)}×(${I.di}−${I.fh})`, Vd * Math.max(0, I.dd - I.fh) + Vi * Math.max(0, I.di - I.fh), 'm³·km', '', 0);
    S.r('strip', 'Topsoil stripping', Vs, 'm³', 0); S.r('unsuit', 'Unsuitable removal', Vu, 'm³', 0); S.r('cut', 'Cut (bank)', I.cut, 'm³', 0);
    S.r('fill', 'Fill (compacted, from site-won)', Math.min(Vf, Vca), 'm³', 0); S.r('importV', 'Imported fill', Vi, 'm³', 0); S.r('disposal', 'Disposal (loose)', Vd, 'm³', 0); S.r('haul', 'Overhaul', H, 'm³·km', 0);
    S.v('r_imp', 'Imported fill as proportion of total fill', 'V_imp / V_f,tot', `${f0(Vi)}/${f0(Vf)}`, Vf ? Vi / Vf * 100 : 0, '%', '', 1);
    if (Vf && Vi / Vf > 0.5) S.n('More than half of the compacted fill must be imported — borrow source, haul route and programme to be confirmed at tender.');
    S.q('EW_STRIP', Vs, 'Stripping'); S.q('EW_UNSUIT', Vu, 'Unsuitable'); S.q('EW_CUT', I.cut, 'Cut (bank)'); S.q('EW_FILL', Math.min(Vf, Vca), 'Site-won fill'); S.q('EW_IMPORT', Vi, 'Import'); S.q('EW_DISP', Vd, 'Disposal (loose)'); S.q('EW_HAUL', H, 'Overhaul');
    S.q('EW_TURF', (I.aGrade + I.aPlat * 0.25) * 1e4, 'Turfing to graded areas and platform slopes (25% of platform area)');
    S.n(`Imported fill ${f0(Vi)} m³ and disposal ${f0(Vd)} m³ (loose). Balance is sensitive to shrinkage factor and unsuitable thickness (both unconfirmed).`);
    S.w('SI', 'Topsoil and unsuitable thickness to be confirmed by test pits.');
    S.ti('Earthworks quantities are re-measurable; state shrink/bulk basis and provisional unsuitable quantity in tender.');
  }});

/* ======================================================================
   SLP — slope stability screening
   ====================================================================== */
defCalc({id:'SLP', no:'CS-GEO-006', title:'Slope Stability Screening', module:'m14', req:[34],
  purpose:'Screen cut/fill slope stability using planar (Culmann) and infinite-slope methods.',
  codes:['JKR_SLOPE','EN1997'],
  assume:['Planar wedge through the toe; critical plane found by search between φ′ and β.','Pore pressure represented by r_u.','Screening only — circular / non-circular limit-equilibrium analysis required for design.'],
  criteria:['Minimum FS for permanent slopes (JKR guideline — VERIFY value)'],
  inputs:[
    {k:'H', sym:'H', l:'Slope height', u:'m', d:4.0, c:'Estimated'},
    {k:'b', sym:'β', l:'Slope angle', u:'°', d:26.6, c:'Consultant Assumption', s:'1V:2H'},
    {k:'c', sym:'c′', l:'Effective cohesion', u:'kPa', d:5, c:'Consultant Assumption'},
    {k:'phi', sym:'φ′', l:'Effective friction angle', u:'°', d:28, c:'Consultant Assumption'},
    {k:'g', sym:'γ', l:'Unit weight', u:'kN/m³', d:18.5, c:'Consultant Assumption'},
    {k:'ru', sym:'r_u', l:'Pore pressure ratio', u:'', d:0.15, c:'Consultant Assumption'},
    {k:'q', sym:'q', l:'Crest surcharge', u:'kPa', d:10, c:'Consultant Assumption'},
    {k:'z', sym:'z', l:'Shallow slip depth (infinite slope)', u:'m', d:1.2, c:'Consultant Assumption'},
    {k:'FSreq', sym:'FS_req', l:'Required FS', u:'', d:1.4, c:'Consultant Assumption', s:'JKR slope guideline — CLAUSE VERIFICATION REQUIRED'},
  ],
  run(I, S){
    const b = rad(I.b), f = rad(I.phi);
    S.h('1. Planar wedge (Culmann) — critical plane search');
    S.v('W', 'Wedge weight (+surcharge)', 'W = ½γH²(cotθ − cotβ) + qH(cotθ − cotβ)', '', null, 'kN/m');
    S.v('FS', 'Factor of safety', 'FS = [c′L + W(cosθ − r_u secθ)tanφ′] / (W sinθ), L = H/sinθ', '', null, '');
    let best = {fs: 1e9, th: 0}; const rows = [];
    for (let th = Math.max(I.phi * 0.5, 5); th < I.b - 0.25; th += 1){
      const t = rad(th), k = 1/Math.tan(t) - 1/Math.tan(b), W = 0.5 * I.g * I.H * I.H * k + I.q * I.H * k, L = I.H / Math.sin(t);
      const fs = (I.c * L + W * (Math.cos(t) - I.ru / Math.cos(t)) * Math.tan(f)) / (W * Math.sin(t));
      if (fs < best.fs) best = {fs, th, W, L}; if (Math.round(th) % 2 === 0) rows.push([f0(th), f1(W), f2(L), f3(fs)]);
    }
    S.tbl('Iteration — trial planes', ['θ (°)','W (kN/m)','L (m)','FS'], rows);
    const fsP = S.v('FS_p', 'Minimum FS (planar)', 'min over θ', `θ_crit = ${f0(best.th)}°`, best.fs, '', 'Culmann', 2);
    S.h('2. Infinite slope (shallow)');
    const fsI = S.v('FS_i', 'Infinite slope FS', 'FS = [c′ + γz cos²β (1 − r_u) tanφ′] / (γ z sinβ cosβ)', `[${I.c} + ${I.g}×${I.z}×cos²${I.b}°×(1−${I.ru})×tan${I.phi}°] / (${I.g}×${I.z}×sin${I.b}°×cos${I.b}°)`, (I.c + I.g * I.z * Math.cos(b)**2 * (1 - I.ru) * Math.tan(f)) / (I.g * I.z * Math.sin(b) * Math.cos(b)), '', 'Infinite slope', 2);
    const fs = Math.min(fsP, fsI); S.r('fs', 'Governing FS', fs, '', 2); S.r('fsP', 'Planar FS', fsP, '', 2); S.r('fsI', 'Infinite-slope FS', fsI, '', 2);
    S.chk({label:'Governing slope FS', val: fs, lim: I.FSreq, rel:'>=', dp:2, fix:'Flatten slope, add drainage (reduce r_u), berms or reinforcement.'});
    if (I.H > 6 || fs < 1.5) S.w('DETAIL', 'Detailed slope stability analysis using geotechnical software (Bishop / Morgenstern-Price, with seepage) is required.');
    S.n(`Governing FS = ${f2(fs)} (${fsP <= fsI ? 'planar wedge' : 'shallow infinite slope'}) for a ${I.H} m high slope at ${I.b}°.`);
    S.p(`Adopt ${I.b <= 26.6 ? '1V:2H' : 'flatter than current'} slopes with turfing, crest/toe drains and berm at 6 m height intervals.`);
  }});

/* ======================================================================
   WND — wind load (MS EN 1991-1-4 + Malaysian NA)
   ====================================================================== */
const TERR = {'0':[0.003,1],'I':[0.01,1],'II':[0.05,2],'III':[0.3,5],'IV':[1.0,10]};
function qpAt(z, W){ // W: wind inputs
  const [z0, zmin] = TERR[W.terr] || TERR.II; const kr = 0.19 * Math.pow(z0 / 0.05, 0.07); const ze = Math.max(z, zmin);
  const vb = W.cdir * W.cseas * W.cprob * W.vb0, cr = kr * Math.log(ze / z0), vm = cr * W.co * vb, Iv = 1 / (W.co * Math.log(ze / z0));
  return {z0, zmin, kr, vb, cr, vm, Iv, qp: (1 + 7 * Iv) * 0.5 * W.rho * vm * vm / 1000};
}
defCalc({id:'WND', no:'CS-STR-001', title:'Wind Load (MS EN 1991-1-4 + Malaysian NA)', module:'m26', req:[20],
  purpose:'Determine peak velocity pressure and design wind pressures for PV structures, fences, BESS enclosures and poles.',
  codes:['EN1991_4','MS1553','EN1990'],
  assume:['Flat terrain (c_o = 1.0) unless orography assessed.','PV net pressure coefficients from vendor / wind-tunnel data (not code).'],
  criteria:['q_p(z) = [1 + 7 I_v(z)] · ½ ρ v_m²(z)'],
  inputs:[
    {g:'Basic wind'},
    {k:'vb0', sym:'v_b,0', l:'Fundamental basic wind velocity', u:'m/s', d:25.0, c:'Consultant Assumption', s:'MS EN 1991-1-4 Malaysian NA — VERIFY zone value'},
    {k:'cdir', sym:'c_dir', l:'Directional factor', u:'', d:1.0, c:'Consultant Assumption'},
    {k:'cseas', sym:'c_season', l:'Season factor', u:'', d:1.0, c:'Consultant Assumption'},
    {k:'cprob', sym:'c_prob', l:'Probability factor (design life)', u:'', d:1.0, c:'Consultant Assumption'},
    {k:'terr', sym:'—', l:'Terrain category', t:'s', o:['0','I','II','III','IV'], d:'II', c:'Consultant Assumption'},
    {k:'co', sym:'c_o', l:'Orography factor', u:'', d:1.0, c:'Consultant Assumption'},
    {k:'rho', sym:'ρ', l:'Air density', u:'kg/m³', d:1.226, c:'Consultant Assumption'},
    {g:'PV array'},
    {k:'zpv', sym:'z_PV', l:'Reference height (panel top)', u:'m', d:2.6, c:'Client Provided'},
    {k:'cpd', sym:'c_p,net↓', l:'Net pressure coeff. — downward', u:'', d:1.1, c:'Vendor Certified', s:'VENDOR LOAD REQUIRED (wind tunnel)'},
    {k:'cpu', sym:'c_p,net↑', l:'Net pressure coeff. — uplift', u:'', d:1.3, c:'Vendor Certified', s:'VENDOR LOAD REQUIRED (wind tunnel)'},
    {k:'At', sym:'A_t', l:'Tributary panel area per pile', u:'m²', d:16.8, c:'Client Provided', s:'Pile span 7.0 m × chord 2.4 m'},
    {g:'Other structures'},
    {k:'zf', sym:'z_f', l:'Fence height', u:'m', d:2.4, c:'Client Provided'},
    {k:'zb', sym:'z_B', l:'BESS enclosure height', u:'m', d:2.9, c:'Vendor Certified'},
    {k:'zp', sym:'z_pole', l:'Lighting / CCTV pole height', u:'m', d:10, c:'Client Provided'},
  ],
  run(I, S){
    const W = I; const w = qpAt(I.zpv, W);
    S.h('1. Basic wind velocity');
    S.v('v_b', 'Basic wind velocity', 'v_b = c_dir · c_season · c_prob · v_b,0', `${I.cdir}×${I.cseas}×${I.cprob}×${I.vb0}`, w.vb, 'm/s', 'EN1991-1-4', 2);
    S.h('2. Mean wind & turbulence at z = ' + I.zpv + ' m (terrain ' + I.terr + ')');
    S.v('z₀', 'Roughness length / z_min', `terrain ${I.terr}`, `z₀ = ${w.z0} m, z_min = ${w.zmin} m`, w.z0, 'm', 'EN1991-1-4 terrain table');
    S.v('k_r', 'Terrain factor', 'k_r = 0.19 (z₀/0.05)^0.07', `0.19 × (${w.z0}/0.05)^0.07`, w.kr, '', '', 4);
    S.v('c_r', 'Roughness factor', 'c_r = k_r ln(max(z,z_min)/z₀)', `${f4(w.kr)} × ln(${Math.max(I.zpv, w.zmin)}/${w.z0})`, w.cr, '', '', 4);
    S.v('v_m', 'Mean wind velocity', 'v_m = c_r c_o v_b', `${f4(w.cr)} × ${I.co} × ${f2(w.vb)}`, w.vm, 'm/s', '', 2);
    S.v('I_v', 'Turbulence intensity', 'I_v = 1/(c_o ln(z/z₀))', `1/(${I.co} × ln(${Math.max(I.zpv,w.zmin)}/${w.z0}))`, w.Iv, '', '', 4);
    const qp = S.v('q_p', 'Peak velocity pressure', 'q_p = [1 + 7I_v] · ½ρv_m²', `[1 + 7×${f4(w.Iv)}] × 0.5 × ${I.rho} × ${f2(w.vm)}²`, w.qp, 'kPa', 'EN1991-1-4', 3);
    S.h('3. PV design pressures');
    const pd = S.v('w_d', 'Downward net pressure', 'w_d = q_p · c_p,net↓', `${f3(qp)} × ${I.cpd}`, qp * I.cpd, 'kPa', 'Vendor coeff.', 3);
    const pu = S.v('w_u', 'Uplift net pressure (suction)', 'w_u = q_p · c_p,net↑', `${f3(qp)} × ${I.cpu}`, qp * I.cpu, 'kPa', 'Vendor coeff.', 3);
    const Fd = S.v('F_d', 'Downward force per pile', 'F_d = w_d · A_t', `${f3(pd)} × ${I.At}`, pd * I.At, 'kN', '', 2);
    const Fu = S.v('F_u', 'Uplift force per pile', 'F_u = w_u · A_t', `${f3(pu)} × ${I.At}`, pu * I.At, 'kN', '', 2);
    S.h('4. Other structures');
    const qf = qpAt(I.zf, W).qp, qb = qpAt(I.zb, W).qp, qpo = qpAt(I.zp, W).qp;
    S.v('q_p,fence', 'Peak pressure — fence', 'q_p(z_f)', `z = ${I.zf} m`, qf, 'kPa', '', 3);
    S.v('q_p,BESS', 'Peak pressure — BESS enclosure', 'q_p(z_B)', `z = ${I.zb} m`, qb, 'kPa', '', 3);
    S.v('q_p,pole', 'Peak pressure — poles', 'q_p(z_pole)', `z = ${I.zp} m`, qpo, 'kPa', '', 3);
    S.r('qp', 'Peak velocity pressure (PV)', qp, 'kPa', 3); S.r('wd', 'PV downward pressure', pd, 'kPa', 3); S.r('wu', 'PV uplift pressure', pu, 'kPa', 3);
    S.r('Fd', 'Downward wind per pile', Fd, 'kN', 2); S.r('Fu', 'Uplift wind per pile', Fu, 'kN', 2);
    S.r('qp_fence', 'q_p fence', qf, 'kPa', 3); S.r('qp_bess', 'q_p BESS', qb, 'kPa', 3); S.r('qp_pole', 'q_p pole', qpo, 'kPa', 3);
    S.w('CLAUSE', 'Basic wind velocity and NA parameters to be verified against the current MS EN 1991-1-4 Malaysian National Annex.');
    S.w('VENDOR', 'PV net pressure coefficients (incl. stow position and array edge zones) from tracker vendor wind-tunnel report.');
    S.n(`Peak velocity pressure at panel height ${f3(qp)} kPa; uplift per pile ${f2(Fu)} kN governs pile tension design.`);
  }});
const f4 = v => fmt(v, 4);

/* ======================================================================
   LCB — load combinations (MS EN 1990 + NA)
   ====================================================================== */
defCalc({id:'LCB', no:'CS-STR-002', title:'Structural Load Combinations — PV Pile', module:'m33', req:[],
  purpose:'Combine permanent, imposed and wind actions on a PV pile for ULS (STR/EQU) and SLS.',
  codes:['EN1990','EN1991_1','EN1991_4'],
  assume:['Partial factors entered as inputs — values shown are commonly adopted and must be verified against the Malaysian NA.','Wind acts normal to panel at stow tilt θ: vertical = F cosθ, horizontal = F sinθ.'],
  criteria:['ULS STR: γ_G,sup·G + γ_Q·Q ; γ_G,sup·G + γ_Q·W + γ_Q·ψ₀·Q','ULS uplift: γ_G,inf·G + γ_Q·W_up','SLS characteristic'],
  inputs:[
    {k:'G', sym:'G_k', l:'Permanent load per pile (modules + structure)', u:'kN', d:3.2, c:'Vendor Certified', s:'VENDOR LOAD REQUIRED'},
    {k:'Q', sym:'Q_k', l:'Imposed / maintenance load per pile', u:'kN', d:0.5, c:'Consultant Assumption'},
    {k:'Wd', sym:'W_d', l:'Wind downward force per pile', u:'kN', d:0, link:'WND.Fd'},
    {k:'Wu', sym:'W_u', l:'Wind uplift force per pile', u:'kN', d:0, link:'WND.Fu'},
    {k:'th', sym:'θ', l:'Panel tilt for wind case', u:'°', d:15, c:'Vendor Certified', s:'Tracker wind stow angle — vendor'},
    {k:'e', sym:'e', l:'Height of load application above ground', u:'m', d:1.5, c:'Client Provided'},
    {g:'Partial factors (NA — VERIFY)'},
    {k:'gGs', sym:'γ_G,sup', l:'Permanent (unfavourable)', u:'', d:1.35, c:'Consultant Assumption', s:'MS EN 1990 NA — VERIFY'},
    {k:'gGi', sym:'γ_G,inf', l:'Permanent (favourable)', u:'', d:1.0, c:'Consultant Assumption'},
    {k:'gQ', sym:'γ_Q', l:'Variable', u:'', d:1.5, c:'Consultant Assumption'},
    {k:'psi', sym:'ψ₀', l:'Combination factor (imposed)', u:'', d:0.7, c:'Consultant Assumption'},
  ],
  run(I, S){
    const c = Math.cos(rad(I.th)), s = Math.sin(rad(I.th));
    S.h('1. Characteristic actions');
    const Wdv = S.v('W_d,v', 'Wind down — vertical', 'W_d cosθ', `${f2(I.Wd)} × cos${I.th}°`, I.Wd * c, 'kN', '', 2);
    const Wuv = S.v('W_u,v', 'Wind up — vertical', 'W_u cosθ', `${f2(I.Wu)} × cos${I.th}°`, I.Wu * c, 'kN', '', 2);
    const Wh = S.v('W_h', 'Wind horizontal (max)', 'max(W_d, W_u) sinθ', `${f2(Math.max(I.Wd, I.Wu))} × sin${I.th}°`, Math.max(I.Wd, I.Wu) * s, 'kN', '', 2);
    S.h('2. Combinations');
    const rows = [];
    const add = (id, t, eq, N, H) => { rows.push([id, t, eq, f2(N), f2(H), f2(H * I.e)]); return {N, H}; };
    const u1 = add('ULS-1','STR','1.35G + 1.5Q', I.gGs*I.G + I.gQ*I.Q, 0);
    const u2 = add('ULS-2','STR','1.35G + 1.5W↓ + 1.5ψ₀Q', I.gGs*I.G + I.gQ*Wdv + I.gQ*I.psi*I.Q, I.gQ*Wh);
    const u3 = add('ULS-3','STR/EQU uplift','1.0G − 1.5W↑', I.gGi*I.G - I.gQ*Wuv, I.gQ*Wh);
    const s1 = add('SLS-1','Char.','G + Q', I.G + I.Q, 0);
    const s2 = add('SLS-2','Char.','G + W↓', I.G + Wdv, Wh);
    const s3 = add('SLS-3','Char.','G − W↑', I.G - Wuv, Wh);
    S.tbl('Load combinations (N + compression, − tension)', ['Combo','Type','Expression','N (kN)','H (kN)','M_g (kN·m)'], rows);
    const Nu = S.r('Nult', 'ULS max compression', Math.max(u1.N, u2.N), 'kN', 2);
    const Tu = S.r('Tult', 'ULS max tension', Math.max(0, -u3.N), 'kN', 2);
    const Hu = S.r('Hult', 'ULS lateral', Math.max(u2.H, u3.H), 'kN', 2);
    S.r('Mult', 'ULS moment at ground', Hu * I.e, 'kN·m', 2);
    S.r('Pw', 'SLS compression (working)', Math.max(s1.N, s2.N), 'kN', 2);
    S.r('Tw', 'SLS tension (working)', Math.max(0, -s3.N), 'kN', 2);
    S.r('Hw', 'SLS lateral (working)', Math.max(s2.H, s3.H), 'kN', 2);
    S.r('e', 'Load height', I.e, 'm', 2);
    S.w('CLAUSE', 'Partial and combination factors to be verified against MS EN 1990 Malaysian National Annex (6.10 vs 6.10a/b).');
    S.n(`Uplift governs: SLS tension ${f2(S.res.Tw)} kN, ULS tension ${f2(Tu)} kN; ULS lateral ${f2(Hu)} kN at ${I.e} m.`);
  }});

/* ======================================================================
   PVP — PV pile geotechnical (compression / uplift / lateral)
   ====================================================================== */
function pileShaft(profile, L, D, perim, kd, S, label){ // returns {Qs, rows, toe}
  let Qs = 0; const rows = [];
  for (const p of profile){ if (p.from >= L) break; const t = Math.min(p.to, L) - p.from; if (t <= 0) continue;
    let fs, how;
    if (p.type === 'CLAY'){ const a = alphaTom(p.cu); fs = a * p.cu; how = `α·Cu = ${f2(a)}×${f0(p.cu)}`; }
    else if (p.type === 'SILT'){ const a = alphaTom(p.cu); const f1v = a * p.cu, f2v = 2 * p.N * kd; fs = Math.min(f1v, f2v); how = `min(α·Cu=${f1(f1v)}, 2N·k_d=${f1(f2v)})`; }
    else { fs = Math.min(2 * p.N * kd, 100); how = `2N·k_d = 2×${f0(p.N)}×${kd} ≤ 100`; }
    const q = fs * perim * t; Qs += q; rows.push([`${f2(p.from)}–${f2(p.from + t)}`, p.type, f0(p.N), how, f1(fs), f2(t), f2(q)]); }
  const toe = profile.find(p => L >= p.from && L < p.to) || profile[profile.length - 1];
  return {Qs, rows, toe};
}
function pileBase(toe, L, D, Ab, S){
  let qb, how;
  if (toe.type === 'CLAY'){ qb = 9 * toe.cu; how = `9·Cu = 9×${f0(toe.cu)}`; }
  else { const emb = Math.max(L - toe.from, 0.1); qb = Math.min(40 * toe.N * emb / D, 400 * toe.N); how = `min(40N·L_b/D, 400N) = min(40×${f0(toe.N)}×${f2(emb)}/${D}, 400×${f0(toe.N)})`; }
  return {qb, how, Qb: qb * Ab};
}
function bromsLateral(o){ // o: {type:'coh'|'nc', cu, g, phi, D, L, e, My}
  const {D, L, e, My} = o;
  if (o.type === 'nc'){ const kp = Kp(o.phi);
    const Hs = 0.5 * o.g * D * L**3 * kp / (e + L);
    const fL = H => H * (e + 0.54 * Math.sqrt(H / (o.g * D * kp))) - My;
    const Hl = bisect(fL, 1e-6, 1e4) || 0; return {kp, Hs, Hl, Hu: Math.min(Hs, Hl), mode: Hs <= Hl ? 'short (rigid) pile — soil failure' : 'long pile — structural yield'}; }
  const cu = o.cu;
  const fS = H => { const f = H / (9 * cu * D), g = L - 1.5 * D - f; if (g <= 0) return 1; return H * (e + 1.5 * D + 0.5 * f) - 2.25 * cu * D * g * g; };
  const Hs = bisect(fS, 1e-6, 9 * cu * D * Math.max(L - 1.5*D, 0.01)) || 0;
  const fL = H => { const f = H / (9 * cu * D); return H * (e + 1.5 * D + 0.5 * f) - My; };
  const Hl = bisect(fL, 1e-6, 1e4) || 0; return {Hs, Hl, Hu: Math.min(Hs, Hl), mode: Hs <= Hl ? 'short (rigid) pile — soil failure' : 'long pile — structural yield'};
}
defCalc({id:'PVP', no:'CS-FDN-001', title:'PV Pile — Compression, Uplift & Lateral', module:'m26', req:[6,7,8],
  purpose:'Screen geotechnical capacity of driven steel PV piles in compression, uplift and lateral loading.',
  codes:['EN1997','LIT_MEY','LIT_TOML','LIT_BROMS','CLIENT_GEO'],
  assume:['Shaft friction: cohesive α-method (Tomlinson), granular Meyerhof f_s = 2N·k_d (kPa) ≤ 100 kPa; silt = lower of both.','Base: 9Cu (clay) or Meyerhof q_b = 40N·L_b/D ≤ 400N kPa.','Uplift shaft = k_u × compression shaft; self weight added.','Lateral: Broms (1964), free head; short/long governs.','Global factors of safety applied to working (SLS) loads.'],
  criteria:['Q_all = Q_ult / FS_c ≥ P_w','T_all = k_u·Q_s/FS_t + W_p ≥ T_w','H_all = H_u / FS_h ≥ H_w'],
  inputs:[
    {g:'Pile section (W6×9 / C-section equivalent)'},
    {k:'sec', sym:'—', l:'Section designation', t:'x', d:'W150×100 (W6×9) S355 HDG', c:'Vendor Certified'},
    {k:'D', sym:'D', l:'Section depth (lateral width)', u:'m', d:0.150, c:'Vendor Certified'},
    {k:'bf', sym:'b_f', l:'Flange width', u:'m', d:0.100, c:'Vendor Certified'},
    {k:'As', sym:'A_st', l:'Steel area', u:'mm²', d:1710, c:'Vendor Certified'},
    {k:'Wel', sym:'W_el', l:'Elastic modulus (bending axis)', u:'cm³', d:91.1, c:'Vendor Certified'},
    {k:'fy', sym:'f_y', l:'Yield strength', u:'MPa', d:355, c:'Vendor Certified'},
    {k:'plug', sym:'—', l:'Base condition', t:'s', o:['Unplugged (steel area)','Plugged (box area)'], d:'Unplugged (steel area)', c:'Consultant Assumption'},
    {k:'kd', sym:'k_d', l:'Low-displacement shaft factor', u:'', d:0.8, c:'Consultant Assumption'},
    {k:'ku', sym:'k_u', l:'Uplift / compression shaft ratio', u:'', d:0.75, c:'Consultant Assumption'},
    {g:'Geometry'},
    {k:'L', sym:'L', l:'Embedment length', u:'m', d:3.5, c:'Client Provided'},
    {k:'e', sym:'e', l:'Load height above ground', u:'m', d:1.5, link:'LCB.e'},
    {g:'Working loads (SLS)'},
    {k:'Pw', sym:'P_w', l:'Compression', u:'kN', d:0, link:'LCB.Pw'},
    {k:'Tw', sym:'T_w', l:'Uplift', u:'kN', d:0, link:'LCB.Tw'},
    {k:'Hw', sym:'H_w', l:'Lateral', u:'kN', d:0, link:'LCB.Hw'},
    {g:'Factors of safety'},
    {k:'FSc', sym:'FS_c', l:'Compression', u:'', d:2.5, c:'Consultant Assumption', s:'Client geotechnical spec — VERIFY'},
    {k:'FSt', sym:'FS_t', l:'Uplift', u:'', d:2.5, c:'Consultant Assumption'},
    {k:'FSh', sym:'FS_h', l:'Lateral', u:'', d:2.5, c:'Consultant Assumption'},
    {g:'Quantities'},
    {k:'ppm', sym:'n/MWp', l:'Piles per MWp', u:'no./MWp', d:310, c:'Client Provided', s:'From PV layout'},
    {k:'pd', sym:'p_pd', l:'Pre-drilling provision (if refusal risk)', u:'%', d:8, c:'Consultant Assumption'},
  ],
  run(I, S, P, R){
    const G = R.GEO; if (!G || !G.profile){ S.w('SI', 'No design profile — enter boreholes.'); return; }
    const prof = G.profile, gw = G.profileGWL;
    const perim = S.v('P_p', 'Shaft perimeter (box)', 'P_p = 2(D + b_f)', `2(${I.D} + ${I.bf})`, 2 * (I.D + I.bf), 'm', '', 3);
    const Ab = S.v('A_b', 'Base area', I.plug.startsWith('Plug') ? 'A_b = D·b_f' : 'A_b = A_st', I.plug.startsWith('Plug') ? `${I.D}×${I.bf}` : `${I.As}×10⁻⁶`, I.plug.startsWith('Plug') ? I.D * I.bf : I.As * 1e-6, 'm²', '', 5);
    S.h('1. Compression');
    const sh = pileShaft(prof, I.L, I.D, perim, I.kd, S);
    S.tbl(`Shaft resistance — design profile ${G.profileBH}`, ['Depth (m)','Soil','N','f_s method','f_s (kPa)','Δz (m)','Q_s,i (kN)'], sh.rows);
    const Qs = S.v('Q_s', 'Shaft resistance', 'Q_s = Σ f_s·P_p·Δz', `Σ = ${f2(sh.Qs)}`, sh.Qs, 'kN', 'LIT_MEY / LIT_TOML', 2);
    const bs = pileBase(sh.toe, I.L, I.D, Ab, S);
    S.v('q_b', 'Unit base resistance', bs.how.split('=')[0], bs.how, bs.qb, 'kPa', 'LIT_MEY', 0);
    const Qb = S.v('Q_b', 'Base resistance', 'Q_b = q_b · A_b', `${f0(bs.qb)} × ${fmt(Ab,5)}`, bs.Qb, 'kN', '', 2);
    const Qu = S.v('Q_ult', 'Ultimate compression', 'Q_ult = Q_s + Q_b', `${f2(Qs)} + ${f2(Qb)}`, Qs + Qb, 'kN', '', 2);
    const Qa = S.v('Q_all', 'Allowable compression', 'Q_all = Q_ult / FS_c', `${f2(Qu)} / ${I.FSc}`, Qu / I.FSc, 'kN', '', 2);
    S.chk({label:'Compression', val: Qa, lim: I.Pw, rel:'>=', unit:'kN', kind:'cap', what:'allowable pile compression capacity', dem:'working compression load', fix:'Increase embedment or pile section.'});
    S.h('2. Uplift');
    const Wp = S.v('W_p', 'Pile self weight', 'W_p = A_st·L·78.5', `${I.As}×10⁻⁶ × ${I.L+I.e} × 78.5`, I.As * 1e-6 * (I.L + I.e) * 78.5, 'kN', '', 3);
    const Tu = S.v('T_ult', 'Ultimate uplift (shaft)', 'T_ult = k_u · Q_s', `${I.ku} × ${f2(Qs)}`, I.ku * Qs, 'kN', '', 2);
    const Ta = S.v('T_all', 'Allowable uplift', 'T_all = T_ult/FS_t + W_p', `${f2(Tu)}/${I.FSt} + ${f3(Wp)}`, Tu / I.FSt + Wp, 'kN', '', 2);
    S.chk({label:'Uplift', val: Ta, lim: I.Tw, rel:'>=', unit:'kN', kind:'cap', what:'allowable uplift capacity', dem:'working uplift load', fix:'Increase embedment, use helical/screw pile or larger section; confirm by pull-out tests.'});
    S.h('3. Lateral (Broms, free head)');
    const top = prof[0], coh = top.type === 'CLAY';
    const My = S.v('M_y', 'Yield moment of section', 'M_y = W_el · f_y', `${I.Wel}×10⁻⁶ × ${I.fy}×10³`, I.Wel * 1e-6 * I.fy * 1e3, 'kN·m', '', 2);
    const gEff = gw < 1.5 ? top.g - 9.81 : top.g;
    const br = bromsLateral({type: coh ? 'coh' : 'nc', cu: top.cu, g: gEff, phi: top.phi || 28, D: I.D, L: I.L, e: I.e, My});
    if (coh){ S.txt(`Top layer cohesive (Cu = ${f0(top.cu)} kPa): Broms cohesive, f = H/(9CuD), g = L − 1.5D − f, H(e + 1.5D + 0.5f) = 2.25·Cu·D·g².`); }
    else { S.v('K_p', 'Passive coefficient', 'K_p = tan²(45 + φ′/2)', `tan²(45 + ${f1(top.phi)}/2)`, br.kp, '', 'Rankine', 3); S.txt(`γ used = ${f1(gEff)} kN/m³ (${gw < 1.5 ? 'submerged — GWL shallow' : 'bulk'}).`); }
    const Hs = S.v('H_u,short', 'Short-pile capacity', coh ? 'solve H(e+1.5D+0.5f) = 2.25CuDg²' : 'H = ½γDL³K_p/(e+L)', coh ? 'iterative (bisection)' : `0.5×${f1(gEff)}×${I.D}×${I.L}³×${f2(br.kp)}/(${I.e}+${I.L})`, br.Hs, 'kN', 'LIT_BROMS', 2);
    const Hl = S.v('H_u,long', 'Long-pile capacity', coh ? 'solve M_y = H(e+1.5D+0.5f)' : 'solve M_y = H(e + 0.54√(H/(γDK_p)))', 'iterative (bisection)', br.Hl, 'kN', 'LIT_BROMS', 2);
    const Hu = S.v('H_u', 'Ultimate lateral', 'H_u = min(short, long)', br.mode, br.Hu, 'kN', '', 2);
    const Ha = S.v('H_all', 'Allowable lateral', 'H_all = H_u / FS_h', `${f2(Hu)} / ${I.FSh}`, Hu / I.FSh, 'kN', '', 2);
    S.chk({label:'Lateral', val: Ha, lim: I.Hw, rel:'>=', unit:'kN', kind:'cap', what:'allowable lateral capacity', dem:'working lateral load', fix:'Increase embedment or section; confirm by lateral load test (deflection criterion).'});
    S.r('Qall', 'Allowable compression', Qa, 'kN', 2); S.r('Tall', 'Allowable uplift', Ta, 'kN', 2); S.r('Hall', 'Allowable lateral', Ha, 'kN', 2);
    S.r('Qult', 'Ultimate compression', Qu, 'kN', 2); S.r('Tult', 'Ultimate uplift', Tu, 'kN', 2); S.r('Hu', 'Ultimate lateral', Hu, 'kN', 2);
    S.r('L', 'Embedment length', I.L, 'm', 2);
    S.r('As', 'Steel area', I.As, 'mm²', 0); S.r('Wel', 'Elastic modulus', I.Wel, 'cm³', 1); S.r('fy', 'Yield strength', I.fy, 'MPa', 0);
    const np =Math.round(I.ppm * (+P.info.mwp || 0)); S.r('npile', 'Number of PV piles', np, 'no.', 0);
    S.q('PL_PV', np, `${I.ppm} piles/MWp × ${P.info.mwp} MWp`);
    if (G.res.hardDepth != null && G.res.hardDepth < I.L + 0.5){ S.q('PL_PREDRILL', Math.round(np * I.pd / 100), `${I.pd}% provisional pre-drilling`); S.w('SI', `Hard stratum at ${f1(G.res.hardDepth)} m is within 0.5 m of pile toe — refusal risk; pre-drilling provisional quantity included.`); }
    S.w('DETAIL', 'Lateral serviceability (pile head deflection vs tracker tolerance) requires p–y analysis or lateral load tests.');
    S.w('PRELIM', 'SPT-based screening; pile design shall be confirmed by pre-construction pull-out, compression and lateral load tests.');
    const lim = [['compression', Qa / Math.max(I.Pw, 1e-6)], ['uplift', Ta / Math.max(I.Tw, 1e-6)], ['lateral', Ha / Math.max(I.Hw, 1e-6)]].sort((a,b) => a[1]-b[1])[0];
    S.n(`${lim[0][0].toUpperCase() + lim[0].slice(1)} governs pile embedment (capacity/demand = ${f2(lim[1])}) at L = ${I.L} m in ${G.profileBH}.`);
    S.p(`${I.sec}, embedment ${I.L} m; ${np.toLocaleString()} piles.`);
    S.ti('Pile quantity is layout-driven; pile length risk (refusal / extension) to be priced as rates per metre of extension and per pre-drilled pile.');
    S.rk({t:'Pile embedment governed by '+lim[0][0], mod:'m26'});
  }});

/* ======================================================================
   PVS — PV pile structural check (EC3)
   ====================================================================== */
defCalc({id:'PVS', no:'CS-FDN-002', title:'PV Pile — Structural Check (Axial, Bending, Combined, Buckling)', module:'m26', req:[11],
  purpose:'Check the steel PV pile section for ULS axial, bending, shear, combined actions and flexural buckling.',
  codes:['EN1993','EN1990'],
  assume:['Section class 3 (elastic) conservatively; corrosion allowance by section property reduction factor.','Effective length L_cr = k(e + z_f), cantilever k = 2.0, fixity depth z_f below ground.','Interaction N/N_b + M/M_el ≤ 1.0 (simplified, conservative).'],
  criteria:['N_Ed/N_b,Rd + M_Ed/M_el,Rd ≤ 1.0'],
  inputs:[
    {k:'As', sym:'A', l:'Steel area', u:'mm²', d:1710, link:'PVP.As'},
    {k:'Wel', sym:'W_el', l:'Elastic modulus', u:'cm³', d:91.1, link:'PVP.Wel'},
    {k:'Iw', sym:'I_min', l:'Second moment (buckling axis)', u:'cm⁴', d:91.8, c:'Vendor Certified', s:'Weak axis W6×9'},
    {k:'Av', sym:'A_v', l:'Shear area', u:'mm²', d:650, c:'Vendor Certified'},
    {k:'fy', sym:'f_y', l:'Yield strength', u:'MPa', d:355, link:'PVP.fy'},
    {k:'kc', sym:'k_c', l:'Corrosion reduction factor on properties', u:'', d:0.90, c:'Consultant Assumption', s:'25-yr design life; confirm coating'},
    {k:'gM0', sym:'γ_M0', l:'Partial factor', u:'', d:1.0, c:'Consultant Assumption', s:'NA — VERIFY'},
    {k:'gM1', sym:'γ_M1', l:'Partial factor (buckling)', u:'', d:1.0, c:'Consultant Assumption'},
    {k:'crv', sym:'—', l:'Buckling curve', t:'s', o:['a','b','c','d'], d:'c', c:'Consultant Assumption'},
    {k:'e', sym:'e', l:'Height above ground', u:'m', d:1.5, link:'LCB.e'},
    {k:'zf', sym:'z_f', l:'Depth to fixity', u:'m', d:0.75, c:'Consultant Assumption', s:'≈5D (screening)'},
    {k:'k', sym:'k', l:'Effective length factor', u:'', d:2.0, c:'Consultant Assumption'},
    {k:'N', sym:'N_Ed', l:'ULS axial compression', u:'kN', d:0, link:'LCB.Nult'},
    {k:'M', sym:'M_Ed', l:'ULS moment at fixity', u:'kN·m', d:0, link:'LCB.Mult'},
    {k:'V', sym:'V_Ed', l:'ULS shear', u:'kN', d:0, link:'LCB.Hult'},
  ],
  run(I, S){
    const A = I.As * I.kc, W = I.Wel * I.kc * 1e3, Iz = I.Iw * I.kc * 1e4, Av = I.Av * I.kc;
    S.h('1. Section resistance');
    S.v('A_eff', 'Effective area (corrosion)', 'A_eff = k_c A', `${I.kc}×${I.As}`, A, 'mm²', '', 0);
    const Npl = S.v('N_c,Rd', 'Axial resistance', 'N_c,Rd = A f_y / γ_M0', `${f0(A)}×${I.fy}/${I.gM0}/10³`, A * I.fy / I.gM0 / 1e3, 'kN', 'EN1993', 1);
    const Mstep = S.v('M_Ed,fix', 'Moment at fixity', 'M = M_Ed + V_Ed·z_f', `${f2(I.M)} + ${f2(I.V)}×${I.zf}`, I.M + I.V * I.zf, 'kN·m', '', 2);
    const Mel = S.v('M_el,Rd', 'Elastic moment resistance', 'M_el,Rd = W_el f_y / γ_M0', `${f0(W)}×${I.fy}/10⁶`, W * I.fy / I.gM0 / 1e6, 'kN·m', 'EN1993', 2);
    const Vpl = S.v('V_pl,Rd', 'Shear resistance', 'V_pl,Rd = A_v f_y/(√3 γ_M0)', `${f0(Av)}×${I.fy}/(√3)/10³`, Av * I.fy / Math.sqrt(3) / I.gM0 / 1e3, 'kN', 'EN1993', 1);
    S.h('2. Flexural buckling');
    const Lcr = S.v('L_cr', 'Buckling length', 'L_cr = k(e + z_f)', `${I.k}(${I.e} + ${I.zf})`, I.k * (I.e + I.zf), 'm', '', 2);
    const Ncr = S.v('N_cr', 'Euler load', 'N_cr = π²EI/L_cr²', `π²×210000×${f0(Iz)}/(${f2(Lcr)}×10³)²/10³`, Math.PI**2 * 210000 * Iz / (Lcr * 1e3)**2 / 1e3, 'kN', '', 1);
    const lb = S.v('λ̄', 'Non-dimensional slenderness', 'λ̄ = √(A f_y / N_cr)', `√(${f0(A)}×${I.fy}/10³/${f1(Ncr)})`, Math.sqrt(A * I.fy / 1e3 / Ncr), '', '', 3);
    const a = CURVE_A[I.crv];
    const chi = S.v('χ', 'Reduction factor', 'χ = 1/[Φ + √(Φ² − λ̄²)], Φ = 0.5[1 + α(λ̄ − 0.2) + λ̄²]', `α = ${a} (curve ${I.crv})`, ec3chi(lb, a), '', 'EN1993', 3);
    const Nb = S.v('N_b,Rd', 'Buckling resistance', 'N_b,Rd = χ A f_y / γ_M1', `${f3(chi)}×${f0(A)}×${I.fy}/10³`, chi * A * I.fy / I.gM1 / 1e3, 'kN', 'EN1993', 1);
    S.h('3. Checks');
    S.chk({label:'Axial stress N/N_c,Rd', val: I.N / Npl, lim: 1, rel:'<=', dp:3});
    S.chk({label:'Bending M/M_el,Rd', val: Mstep / Mel, lim: 1, rel:'<=', dp:3, fix:'Increase section or reduce load height.'});
    S.chk({label:'Shear V/V_pl,Rd', val: I.V / Vpl, lim: 1, rel:'<=', dp:3});
    const u = S.v('U', 'Combined utilisation', 'U = N_Ed/N_b,Rd + M/M_el,Rd', `${f2(I.N)}/${f1(Nb)} + ${f2(Mstep)}/${f2(Mel)}`, I.N / Nb + Mstep / Mel, '', '', 3);
    S.chk({label:'Combined axial + bending (incl. buckling)', val: u, lim: 1, rel:'<=', dp:3, fix:'Increase section size / grade or embedment (reduce fixity depth).'});
    S.r('util', 'Combined utilisation', u, '', 3); S.r('Nb', 'Buckling resistance', Nb, 'kN', 1); S.r('Mel', 'Moment resistance', Mel, 'kN·m', 2);
    S.n(`Combined utilisation ${f2(u)} with bending the dominant term (${f2(Mstep/Mel)}); axial ${f2(I.N/Nb)} incl. buckling (λ̄ = ${f2(lb)}).`);
    S.w('VENDOR', 'Tracker vendor to confirm pile section, grade, coating and connection loads.');
  }});

/* ======================================================================
   HEL — helical / screw pile
   ====================================================================== */
defCalc({id:'HEL', no:'CS-FDN-003', title:'Helical / Screw Pile (Alternative)', module:'m27', req:[9],
  purpose:'Assess helical pile capacity by individual bearing method and torque correlation, with structural shaft check.',
  codes:['LIT_HOYT','EN1997','EN1993'],
  assume:['Individual bearing: Q_h = A_h (C_u N_c + q′ N_q), N_c = 9; N_q (Meyerhof) for granular.','Deep helices (H/D > 5): uplift ≈ compression bearing.','Torque correlation Q = K_t·T is vendor-specific.'],
  criteria:['Q_all ≥ P_w ; T_all ≥ T_w ; torque capacity ≥ FS·T_w'],
  inputs:[
    {k:'OD', sym:'OD', l:'Shaft outside diameter', u:'mm', d:76.1, c:'Vendor Certified'},
    {k:'t', sym:'t', l:'Shaft wall thickness', u:'mm', d:5.0, c:'Vendor Certified'},
    {k:'Dh', sym:'D_h', l:'Helix diameter', u:'mm', d:250, c:'Vendor Certified'},
    {k:'nh', sym:'n_h', l:'Number of helices', u:'no.', d:2, c:'Vendor Certified'},
    {k:'sp', sym:'s', l:'Helix spacing (× D_h)', u:'', d:3, c:'Vendor Certified'},
    {k:'H', sym:'H', l:'Depth to lowest helix', u:'m', d:2.4, c:'Client Provided'},
    {k:'e', sym:'e', l:'Stick-up above ground', u:'m', d:1.5, link:'LCB.e'},
    {k:'T', sym:'T', l:'Final installation torque', u:'kN·m', d:4.5, c:'Contractor Provided'},
    {k:'Kt', sym:'K_t', l:'Torque factor (vendor)', u:'1/m', d:33, c:'Vendor Certified', s:'Vendor-specific correlation (Hoyt & Clemence form)'},
    {k:'fy', sym:'f_y', l:'Shaft yield strength', u:'MPa', d:355, c:'Vendor Certified'},
    {k:'Pw', sym:'P_w', l:'Working compression', u:'kN', d:0, link:'LCB.Pw'},
    {k:'Tw', sym:'T_w', l:'Working uplift', u:'kN', d:0, link:'LCB.Tw'},
    {k:'FS', sym:'FS', l:'Factor of safety', u:'', d:2.5, c:'Consultant Assumption'},
  ],
  run(I, S, P, R){
    const prof = R.GEO && R.GEO.profile; if (!prof){ S.w('SI', 'No profile'); return; }
    const Ah = S.v('A_h', 'Helix net area', 'A_h = π(D_h² − OD²)/4', `π(${I.Dh}² − ${I.OD}²)/4/10⁶`, Math.PI * (I.Dh**2 - I.OD**2) / 4 / 1e6, 'm²', '', 4);
    let Qh = 0; const rows = [];
    for (let k = 0; k < I.nh; k++){
      const z = I.H - k * I.sp * I.Dh / 1000; const L = prof.find(p => z >= p.from && z < p.to) || prof[prof.length-1];
      let sv = 0; for (const p of prof){ if (p.from >= z) break; sv += (Math.min(p.to, z) - p.from) * (p.g - (Math.min(p.to,z) > R.GEO.profileGWL ? 9.81 * 0 : 0)); }
      const gwl = R.GEO.profileGWL; const u = z > gwl ? 9.81 * (z - gwl) : 0; const qe = Math.max(sv - u, 0);
      let q, how; if (L.type === 'CLAY'){ q = 9 * L.cu + qe; how = `9×${f0(L.cu)} + ${f1(qe)}`; } else { const ph = rad(L.phi || 28); const Nq = Math.exp(Math.PI * Math.tan(ph)) * Math.tan(rad(45 + (L.phi||28)/2))**2; q = qe * Nq + (L.type === 'SILT' ? 9 * L.cu * 0.5 : 0); how = `${f1(qe)}×N_q(${f1(Nq)})`; }
      const Qi = q * Ah; Qh += Qi; rows.push([k+1, f2(z), L.type, how, f0(q), f2(Qi)]);
    }
    S.tbl('Individual helix bearing', ['Helix','Depth (m)','Soil','q_u expression','q_u (kPa)','Q_h,i (kN)'], rows);
    const Qhs = S.v('Q_h', 'Total helix capacity', 'Q_h = Σ A_h·q_u', '', Qh, 'kN', 'Individual bearing method', 2);
    const ztop = I.H - (I.nh - 1) * I.sp * I.Dh / 1000 - I.Dh / 1000;
    const sh = pileShaft(prof, Math.max(ztop, 0), I.OD/1000, Math.PI * I.OD / 1000, 1.0, S);
    const Qs = S.v('Q_s', 'Shaft friction above top helix', 'Q_s = Σ f_s·πOD·Δz', `to ${f2(ztop)} m`, sh.Qs, 'kN', '', 2);
    const Qa = S.v('Q_all', 'Allowable compression', 'Q_all = (Q_h + Q_s)/FS', `(${f2(Qhs)} + ${f2(Qs)})/${I.FS}`, (Qhs + Qs) / I.FS, 'kN', '', 2);
    const HD = I.H / (I.Dh / 1000);
    S.v('H/D', 'Embedment ratio', 'H/D_h', `${I.H}/${I.Dh/1000}`, HD, '', '', 1);
    const Ta = S.v('T_all', 'Allowable uplift', HD > 5 ? 'T_all = (Q_h + Q_s)/FS (deep helix)' : 'T_all = 0.7(Q_h + Q_s)/FS (shallow helix)', '', (HD > 5 ? 1 : 0.7) * (Qhs + Qs) / I.FS, 'kN', '', 2);
    const Qt = S.v('Q_T', 'Torque-correlated ultimate capacity', 'Q_T = K_t · T', `${I.Kt} × ${I.T}`, I.Kt * I.T, 'kN', 'VENDOR-SPECIFIC correlation', 2);
    S.chk({label:'Compression', val: Qa, lim: I.Pw, rel:'>=', unit:'kN', kind:'cap', what:'helical pile compression capacity', dem:'working compression'});
    S.chk({label:'Uplift', val: Ta, lim: I.Tw, rel:'>=', unit:'kN', kind:'cap', what:'helical pile uplift capacity', dem:'working uplift'});
    S.chk({label:'Torque verification Q_T/FS', val: Qt / I.FS, lim: I.Tw, rel:'>=', unit:'kN', kind:'cap', what:'torque-verified capacity', dem:'working uplift', fix:'Increase installation torque / helix size; confirm vendor K_t.'});
    S.h('Structural shaft');
    const As = Math.PI * (I.OD**2 - (I.OD - 2*I.t)**2) / 4, Is = Math.PI * (I.OD**4 - (I.OD - 2*I.t)**4) / 64;
    const Npl = S.v('N_pl', 'Shaft axial resistance', 'N_pl = A f_y', `${f0(As)}×${I.fy}/10³`, As * I.fy / 1e3, 'kN', 'EN1993', 1);
    const Lcr = 2 * (I.e + 0.75); const Ncr = Math.PI**2 * 210000 * Is / (Lcr*1e3)**2 / 1e3; const lb = Math.sqrt(As * I.fy / 1e3 / Ncr);
    const Nb = S.v('N_b', 'Buckling resistance (L_cr = 2(e+0.75))', 'N_b = χ A f_y', `λ̄ = ${f2(lb)}, curve a`, ec3chi(lb, 0.21) * As * I.fy / 1e3, 'kN', 'EN1993', 1);
    S.chk({label:'Shaft buckling vs ULS compression (1.5 P_w)', val: Nb, lim: 1.5 * I.Pw, rel:'>=', unit:'kN', kind:'cap', what:'shaft buckling resistance', dem:'ULS compression'});
    S.r('Qall', 'Allowable compression', Qa, 'kN', 2); S.r('Tall', 'Allowable uplift', Ta, 'kN', 2); S.r('QT', 'Torque capacity', Qt, 'kN', 2);
    S.w('VENDOR', 'Torque factor K_t is vendor-specific — obtain vendor correlation and verify by load tests.');
    S.n(`Helical alternative: allowable uplift ${f2(Ta)} kN vs demand ${f2(I.Tw)} kN; suited to soft upper soils and reduces refusal risk in dense layers only if torque can be achieved.`);
  }});

/* ======================================================================
   DRV — driven / spun pile (equipment)
   ====================================================================== */
defCalc({id:'DRV', no:'CS-FDN-004', title:'Driven / Spun Pile (Equipment & Substation)', module:'m27', req:[10],
  purpose:'Screen capacity, driveability and structural adequacy of driven spun (PHC) / steel H / RC piles for heavy equipment.',
  codes:['EN1997','LIT_MEY','LIT_TOML','JKR_SSBW'],
  assume:['Layered design profile from geotechnical interpretation.','Spun pile structural capacities from manufacturer class (vendor).','Handling: two-point lift at 0.207L, M = 0.0214 w L².'],
  criteria:['Q_all ≥ P_w ; P_w ≤ P_a,struct ; M_handling ≤ M_cr'],
  inputs:[
    {k:'type', sym:'—', l:'Pile type', t:'s', o:['Spun PHC','Steel H','RC square'], d:'Spun PHC', c:'Consultant Assumption'},
    {k:'D', sym:'D', l:'Pile diameter / width', u:'m', d:0.40, c:'Consultant Assumption'},
    {k:'tw', sym:'t', l:'Spun pile wall thickness', u:'m', d:0.075, c:'Vendor Certified'},
    {k:'L', sym:'L', l:'Pile length (penetration)', u:'m', d:14, c:'Consultant Assumption'},
    {k:'Pw', sym:'P_w', l:'Working compression per pile', u:'kN', d:450, c:'Vendor Certified', s:'Substation / transformer loads — VENDOR LOAD REQUIRED'},
    {k:'Tw', sym:'T_w', l:'Working uplift per pile', u:'kN', d:60, c:'Estimated'},
    {k:'Pa', sym:'P_a', l:'Structural allowable axial (manufacturer)', u:'kN', d:1100, c:'Vendor Certified', s:'Manufacturer class table'},
    {k:'Mcr', sym:'M_cr', l:'Cracking moment (manufacturer)', u:'kN·m', d:55, c:'Vendor Certified'},
    {k:'FS', sym:'FS', l:'Factor of safety', u:'', d:2.5, c:'Consultant Assumption'},
    {k:'np', sym:'n', l:'Number of equipment piles', u:'no.', d:24, c:'Estimated'},
  ],
  run(I, S, P, R){
    const prof = R.GEO && R.GEO.profile; if (!prof){ S.w('SI', 'No profile'); return; }
    const spun = I.type === 'Spun PHC';
    const per = S.v('P', 'Perimeter', I.type === 'RC square' ? '4D' : spun ? 'πD' : '2(D + b)', '', I.type === 'RC square' ? 4 * I.D : spun ? Math.PI * I.D : 4 * I.D, 'm', '', 3);
    const Ab = S.v('A_b', 'Base area', spun ? 'πD²/4 (plugged)' : I.type === 'RC square' ? 'D²' : 'D² (plugged box)', '', spun ? Math.PI * I.D**2 / 4 : I.D**2, 'm²', '', 4);
    const sh = pileShaft(prof, Math.min(I.L, prof[prof.length-1].to), I.D, per, 1.0, S);
    S.tbl('Shaft resistance', ['Depth (m)','Soil','N','f_s method','f_s (kPa)','Δz (m)','Q_s,i (kN)'], sh.rows);
    const Qs = S.v('Q_s', 'Shaft', 'Σ f_s P Δz', '', sh.Qs, 'kN', '', 1);
    const bs = pileBase(sh.toe, I.L, I.D, Ab);
    const Qb = S.v('Q_b', 'Base', 'q_b A_b', bs.how, bs.Qb, 'kN', 'LIT_MEY', 1);
    const Qa = S.v('Q_all', 'Allowable', '(Q_s + Q_b)/FS', `(${f1(Qs)} + ${f1(Qb)})/${I.FS}`, (Qs + Qb) / I.FS, 'kN', '', 1);
    S.chk({label:'Geotechnical compression', val: Qa, lim: I.Pw, rel:'>=', unit:'kN', kind:'cap', what:'allowable pile capacity', dem:'working load', fix:'Increase pile length/diameter or number of piles.'});
    const Ta = S.v('T_all', 'Allowable uplift', '0.7 Q_s/FS + W_p', '', 0.7 * Qs / I.FS + (spun ? Math.PI * (I.D**2 - (I.D - 2*I.tw)**2) / 4 : I.D * I.D) * I.L * (spun ? 25 : 25) * (I.type === 'Steel H' ? 0.3 : 1), 'kN', '', 1);
    S.chk({label:'Uplift', val: Ta, lim: I.Tw, rel:'>=', unit:'kN', kind:'cap', what:'uplift capacity', dem:'working uplift'});
    S.chk({label:'Structural axial (manufacturer)', val: I.Pa, lim: I.Pw, rel:'>=', unit:'kN', kind:'cap', what:'structural pile capacity', dem:'working load'});
    S.h('Handling & driveability');
    const w = (spun ? Math.PI * (I.D**2 - (I.D - 2*I.tw)**2) / 4 : I.D**2) * 25 * 1.5;
    const seg = Math.min(I.L, 12);
    const Mh = S.v('M_h', 'Handling moment (2-point lift, 12 m segment, 1.5 impact)', 'M = 0.0214 w L²', `0.0214 × ${f2(w)} × ${seg}²`, 0.0214 * w * seg * seg, 'kN·m', '', 2);
    S.chk({label:'Handling moment ≤ M_cr', val: Mh, lim: I.Mcr, rel:'<=', unit:'kN·m', dp:1, fix:'Use 3-point lift / shorter segments.'});
    const hard = prof.find(p => p.N >= 50 && p.from < I.L);
    if (hard) { S.w('SI', `Hard stratum (N ≥ 50) from ${f1(hard.from)} m above pile toe ${I.L} m — driving refusal expected; set toe at refusal / consider pre-boring.`); S.n(`Refusal likely at ~${f1(hard.from)} m; design length to be confirmed by driving records (set criteria).`); }
    S.r('Qall', 'Allowable compression', Qa, 'kN', 1); S.r('Tall', 'Allowable uplift', Ta, 'kN', 1); S.r('np', 'Number of piles', I.np, 'no.', 0); S.r('Pw', 'Working load', I.Pw, 'kN', 0);
    S.q('PL_EQUIP', I.np * I.L, `${I.np} piles × ${I.L} m`);
    S.p(`${I.type} Ø${I.D * 1000} mm × ${I.L} m, ${I.np} no.`);
  }});

/* ======================================================================
   PTS — pile test schedule
   ====================================================================== */
defCalc({id:'PTS', no:'CS-FDN-005', title:'Pile Test Schedule', module:'m27', req:[12],
  purpose:'Recommend preliminary and working pile test quantities and test loads based on project criteria.',
  codes:['CLIENT_GEO','JKR_SSBW','EN1997'],
  assume:['Test frequencies are project criteria entered by the Engineer — ENGINEER CONFIRMATION REQUIRED.','Test load = test factor × working load.'],
  criteria:['Minimum tests per geological zone; working tests as % of production piles'],
  inputs:[
    {k:'npv', sym:'n_PV', l:'PV production piles', u:'no.', d:0, link:'PVP.npile'},
    {k:'neq', sym:'n_eq', l:'Equipment piles', u:'no.', d:0, link:'DRV.np'},
    {k:'nz', sym:'n_z', l:'Geological zones', u:'no.', d:3, c:'Consultant Assumption'},
    {k:'pc', sym:'n_pc', l:'Preliminary compression tests per zone', u:'no.', d:2, c:'Consultant Assumption'},
    {k:'pt', sym:'n_pt', l:'Preliminary uplift tests per zone', u:'no.', d:3, c:'Consultant Assumption'},
    {k:'pl', sym:'n_pl', l:'Preliminary lateral tests per zone', u:'no.', d:3, c:'Consultant Assumption'},
    {k:'wr', sym:'r_w', l:'Working tests (PV) per 1,000 piles', u:'no.', d:0.5, c:'Consultant Assumption'},
    {k:'we', sym:'r_e', l:'Working tests (equipment piles) — % of piles', u:'%', d:2, c:'Consultant Assumption'},
    {k:'tfP', sym:'f_P', l:'Preliminary test factor', u:'', d:2.0, c:'Consultant Assumption'},
    {k:'tfW', sym:'f_W', l:'Working test factor', u:'', d:1.5, c:'Consultant Assumption'},
    {k:'Tw', sym:'T_w', l:'PV working uplift', u:'kN', d:0, link:'LCB.Tw'},
    {k:'Pw', sym:'P_w', l:'PV working compression', u:'kN', d:0, link:'LCB.Pw'},
    {k:'Hw', sym:'H_w', l:'PV working lateral', u:'kN', d:0, link:'LCB.Hw'},
  ],
  run(I, S){
    const C = S.v('n_C', 'Compression tests', 'n_z·n_pc + ⌈r_w·n_PV/1000⌉/3 + ⌈r_e·n_eq⌉', `${I.nz}×${I.pc} + ⌈${I.wr}×${I.npv}/1000⌉/3 + ⌈${I.we}%×${I.neq}⌉`, I.nz * I.pc + Math.ceil(Math.ceil(I.wr * I.npv / 1000) / 3) + Math.ceil(I.we / 100 * I.neq), 'no.', 'Project criteria', 0);
    const T = S.v('n_T', 'Uplift tests', 'n_z·n_pt + ⌈r_w·n_PV/1000⌉·(2/3)', '', I.nz * I.pt + Math.ceil(Math.ceil(I.wr * I.npv / 1000) * 2 / 3), 'no.', '', 0);
    const L = S.v('n_L', 'Lateral tests', 'n_z·n_pl + ⌈r_w·n_PV/2000⌉', '', I.nz * I.pl + Math.ceil(I.wr * I.npv / 2000), 'no.', '', 0);
    S.tbl('Test loads', ['Test','Working load (kN)','Preliminary (×'+I.tfP+')','Working (×'+I.tfW+')'], [
      ['PV compression', f2(I.Pw), f2(I.Pw * I.tfP), f2(I.Pw * I.tfW)], ['PV uplift', f2(I.Tw), f2(I.Tw * I.tfP), f2(I.Tw * I.tfW)], ['PV lateral', f2(I.Hw), f2(I.Hw * I.tfP), f2(I.Hw * I.tfW)]]);
    S.r('nC', 'Compression tests', C, 'no.', 0); S.r('nT', 'Uplift tests', T, 'no.', 0); S.r('nL', 'Lateral tests', L, 'no.', 0);
    S.q('PL_TEST_C', C); S.q('PL_TEST_T', T); S.q('PL_TEST_L', L);
    S.w('ENG', 'Pile test quantities and acceptance criteria require Engineer confirmation against client specification.');
    S.n(`Recommended ${C} compression, ${T} uplift and ${L} lateral tests (preliminary + working) for ${I.npv.toLocaleString()} PV piles in ${I.nz} zones.`);
  }});

/* ======================================================================
   BRG — bearing capacity (shallow foundations)
   ====================================================================== */
defCalc({id:'BRG', no:'CS-GEO-002', title:'Bearing Capacity — Shallow Foundations', module:'m28', req:[4],
  purpose:'Ultimate and allowable bearing capacity of shallow equipment foundations (general bearing capacity equation).',
  codes:['EN1997','LIT_BOWLES'],
  assume:['Drained: N_q = e^{πtanφ}tan²(45+φ/2), N_c = (N_q−1)cotφ, N_γ = 2(N_q−1)tanφ (EC7 informative annex).','Shape & inclination factors per EC7 informative annex; depth factors (Hansen).','Undrained: q_u = (π+2)C_u s_c i_c + q.','Global FS on net ultimate bearing.'],
  criteria:['q_all = (q_ult − q)/FS + q'],
  inputs:[
    {k:'mode', sym:'—', l:'Analysis', t:'s', o:['AUTO (from founding layer)','Drained (c′, φ′)','Undrained (Cu)'], d:'AUTO (from founding layer)', c:'Consultant Assumption'},
    {k:'B', sym:'B', l:'Footing width', u:'m', d:3.0, c:'Consultant Assumption'},
    {k:'L', sym:'L', l:'Footing length', u:'m', d:4.0, c:'Consultant Assumption'},
    {k:'D', sym:'D', l:'Founding depth', u:'m', d:1.0, link:'GEO.topD'},
    {k:'c', sym:'c′', l:'Effective cohesion', u:'kPa', d:2, c:'Consultant Assumption'},
    {k:'phi', sym:'φ′', l:'Friction angle', u:'°', d:26, link:'GEO.fdn_phi'},
    {k:'cu', sym:'C_u', l:'Undrained strength', u:'kPa', d:40, link:'GEO.fdn_cu'},
    {k:'g', sym:'γ', l:'Unit weight', u:'kN/m³', d:18, link:'GEO.fdn_g'},
    {k:'dw', sym:'d_w', l:'Groundwater depth', u:'m', d:1.8, link:'GEO.fdn_gwl'},
    {k:'V', sym:'V', l:'Vertical load', u:'kN', d:900, c:'Estimated'},
    {k:'H', sym:'H', l:'Horizontal load', u:'kN', d:40, c:'Estimated'},
    {k:'FS', sym:'FS', l:'Factor of safety', u:'', d:3.0, c:'Consultant Assumption'},
  ],
  run(I, S){
    let phi = I.phi; const mode = I.mode.startsWith('AUTO') ? ((R.GEO && R.GEO.res.fdn_type_clay) ? 'Undrained' : 'Drained') : I.mode;
    if (I.mode.startsWith('AUTO')) S.txt(`Analysis mode: ${mode} (founding layer ${(R.GEO && R.GEO.res.fdn_type_clay) ? 'cohesive' : 'granular'}).`);
    if (mode.startsWith('Drained') && phi < 1) phi = 1;
    const gw = 9.81, gp = I.g - gw;
    S.h('1. Overburden & groundwater');
    const q = S.v('q', 'Effective overburden at founding level', I.dw >= I.D ? 'q = γD' : 'q = γd_w + γ′(D − d_w)', I.dw >= I.D ? `${I.g}×${I.D}` : `${I.g}×${I.dw} + ${f2(gp)}×(${I.D} − ${I.dw})`, I.dw >= I.D ? I.g * I.D : I.g * I.dw + gp * (I.D - I.dw), 'kPa', '', 2);
    const ge = S.v('γ_eff', 'Effective γ below base', 'γ_eff = γ′ + (d_w − D)/B·(γ − γ′), bounded', `d_w = ${I.dw}`, I.dw <= I.D ? gp : I.dw >= I.D + I.B ? I.g : gp + (I.dw - I.D) / I.B * (I.g - gp), 'kN/m³', 'Groundwater correction', 2);
    let qu;
    if (mode.startsWith('Undrained')){
      S.h('2. Undrained bearing');
      const sc = S.v('s_c', 'Shape', 's_c = 1 + 0.2B/L', `1 + 0.2×${I.B}/${I.L}`, 1 + 0.2 * I.B / I.L, '', 'EC7 annex', 3);
      const ic = S.v('i_c', 'Inclination', 'i_c = ½[1 + √(1 − H/(A′C_u))]', `½[1 + √(1 − ${I.H}/(${I.B*I.L}×${I.cu}))]`, 0.5 * (1 + Math.sqrt(Math.max(0, 1 - I.H / (I.B * I.L * I.cu)))), '', 'EC7 annex', 3);
      qu = S.v('q_ult', 'Ultimate bearing', 'q_ult = (π+2)C_u s_c i_c + q', `5.14×${I.cu}×${f3(sc)}×${f3(ic)} + ${f1(q)}`, 5.14 * I.cu * sc * ic + q, 'kPa', 'EC7 annex', 1);
    } else {
      S.h('2. Bearing capacity factors (φ′ = ' + f1(phi) + '°)');
      const t = Math.tan(rad(phi)), s = Math.sin(rad(phi));
      const Nq = S.v('N_q', '', 'N_q = e^{π tanφ′} tan²(45 + φ′/2)', `e^{π tan${f1(phi)}} tan²(${f2(45+phi/2)})`, Math.exp(Math.PI * t) * Math.tan(rad(45 + phi/2))**2, '', 'EC7 annex', 3);
      const Nc = S.v('N_c', '', 'N_c = (N_q − 1) cotφ′', `(${f3(Nq)} − 1)/tan${f1(phi)}`, (Nq - 1) / t, '', 'EC7 annex', 3);
      const Ng = S.v('N_γ', '', 'N_γ = 2(N_q − 1) tanφ′', `2(${f3(Nq)} − 1)tan${f1(phi)}`, 2 * (Nq - 1) * t, '', 'EC7 annex', 3);
      S.h('3. Shape, depth & inclination factors');
      const r = I.B / I.L;
      const sq = S.v('s_q', 'Shape', 's_q = 1 + (B/L) sinφ′', `1 + ${f3(r)}×${f3(s)}`, 1 + r * s, '', 'EC7 annex', 3);
      const sg = S.v('s_γ', 'Shape', 's_γ = 1 − 0.3 B/L', `1 − 0.3×${f3(r)}`, 1 - 0.3 * r, '', 'EC7 annex', 3);
      const sc = S.v('s_c', 'Shape', 's_c = (s_q N_q − 1)/(N_q − 1)', '', (sq * Nq - 1) / (Nq - 1), '', 'EC7 annex', 3);
      const k = Math.min(I.D / I.B, 1);
      const dq = S.v('d_q', 'Depth', 'd_q = 1 + 2tanφ′(1 − sinφ′)²·(D/B)', `D/B = ${f3(k)}`, 1 + 2 * t * (1 - s)**2 * k, '', 'Hansen', 3);
      const dc = S.v('d_c', 'Depth', 'd_c = d_q − (1 − d_q)/(N_c tanφ′)', '', dq - (1 - dq) / (Nc * t), '', 'Hansen', 3);
      const m = (2 + r) / (1 + r), base = Math.max(0, 1 - I.H / (I.V + I.B * I.L * I.c / t));
      const iq = S.v('i_q', 'Inclination', 'i_q = [1 − H/(V + A′c′cotφ′)]^m, m = (2 + B/L)/(1 + B/L)', `m = ${f3(m)}`, Math.pow(base, m), '', 'EC7 annex', 3);
      const ig = S.v('i_γ', 'Inclination', 'i_γ = [1 − H/(V + A′c′cotφ′)]^(m+1)', '', Math.pow(base, m + 1), '', 'EC7 annex', 3);
      const ic = S.v('i_c', 'Inclination', 'i_c = i_q − (1 − i_q)/(N_c tanφ′)', '', iq - (1 - iq) / (Nc * t), '', 'EC7 annex', 3);
      S.h('4. Ultimate bearing');
      qu = S.v('q_ult', 'Ultimate bearing', 'q_ult = c′N_c s_c d_c i_c + qN_q s_q d_q i_q + ½γ′BN_γ s_γ i_γ', `${I.c}×${f2(Nc)}×${f3(sc)}×${f3(dc)}×${f3(ic)} + ${f1(q)}×${f2(Nq)}×${f3(sq)}×${f3(dq)}×${f3(iq)} + ½×${f2(ge)}×${I.B}×${f2(Ng)}×${f3(sg)}×${f3(ig)}`,
        I.c * Nc * sc * dc * ic + q * Nq * sq * dq * iq + 0.5 * ge * I.B * Ng * sg * ig, 'kPa', 'EC7 annex / Hansen', 1);
    }
    const qa = S.v('q_all', 'Allowable bearing (gross)', 'q_all = (q_ult − q)/FS + q', `(${f1(qu)} − ${f1(q)})/${I.FS} + ${f1(q)}`, (qu - q) / I.FS + q, 'kPa', 'Global FS', 1);
    const qapp = S.v('q_app', 'Applied pressure', 'q = V/(BL)', `${I.V}/(${I.B}×${I.L})`, I.V / (I.B * I.L), 'kPa', '', 1);
    S.chk({label:'Bearing pressure', val: qapp, lim: qa, rel:'<=', unit:'kPa', dp:1, fix:'Increase footing size or found deeper.'});
    S.r('qult', 'Ultimate bearing capacity', qu, 'kPa', 1); S.r('qa', 'Allowable bearing capacity', qa, 'kPa', 1);
    S.w('SI', 'Bearing parameters are SPT-correlated; confirm with plate load tests / laboratory strength tests.');
    S.n(`Allowable bearing ${f0(qa)} kPa at ${I.D} m depth (FS ${I.FS}); adopted as the design value for equipment pads unless SI indicates otherwise.`);
  }});

/* ======================================================================
   SET — settlement screening
   ====================================================================== */
defCalc({id:'SET', no:'CS-GEO-003', title:'Settlement Screening', module:'m28', req:[5],
  purpose:'Preliminary immediate (elastic) and consolidation settlement of equipment foundations.',
  codes:['EN1997','LIT_BOWLES'],
  assume:['Immediate: s_i = q B (1 − ν²) I_s / E_s (rigid footing I_s interpolated from L/B).','Consolidation: s_c = m_v Δσ H, Δσ by 2:1 spread at mid-layer.'],
  criteria:['Total settlement ≤ limit (equipment tolerance)'],
  inputs:[
    {k:'q', sym:'q_n', l:'Net applied pressure', u:'kPa', d:60, c:'Estimated', s:'Transformer pad (CS-FDN-011) net pressure'},
    {k:'B', sym:'B', l:'Footing width', u:'m', d:3.0, c:'Consultant Assumption'},
    {k:'L', sym:'L', l:'Footing length', u:'m', d:4.0, c:'Consultant Assumption'},
    {k:'E', sym:'E_s', l:'Soil modulus', u:'MPa', d:8, link:'GEO.fdn_E'},
    {k:'nu', sym:'ν', l:'Poisson ratio', u:'', d:0.3, c:'Consultant Assumption'},
    {k:'Hc', sym:'H_c', l:'Compressible clay thickness', u:'m', d:2.0, c:'Estimated', s:'SI REQUIRED'},
    {k:'zc', sym:'z', l:'Depth to mid-layer below base', u:'m', d:1.5, c:'Estimated'},
    {k:'mv', sym:'m_v', l:'Coefficient of volume compressibility', u:'m²/MN', d:0.12, c:'Estimated', s:'Oedometer tests required'},
    {k:'lim', sym:'s_lim', l:'Settlement limit', u:'mm', d:25, c:'Consultant Assumption', s:'Equipment vendor tolerance'},
  ],
  run(I, S){
    const r = I.L / I.B;
    const Is = S.v('I_s', 'Influence factor (rigid)', 'I_s(L/B) interpolated', `L/B = ${f2(r)}`, lerpTable([[1,0.82],[1.5,1.06],[2,1.20],[5,1.70],[10,2.10]], r), '', 'LIT_BOWLES', 3);
    const si = S.v('s_i', 'Immediate settlement', 's_i = q B (1 − ν²) I_s / E_s', `${I.q}×${I.B}×(1 − ${I.nu}²)×${f3(Is)}/${I.E}`, I.q * I.B * (1 - I.nu**2) * Is / I.E, 'mm', '', 1);
    const ds = S.v('Δσ', 'Stress increase at mid-layer', 'Δσ = q B L/((B + z)(L + z))', `${I.q}×${I.B}×${I.L}/((${I.B}+${I.zc})(${I.L}+${I.zc}))`, I.q * I.B * I.L / ((I.B + I.zc) * (I.L + I.zc)), 'kPa', '2:1 method', 1);
    const sc = S.v('s_c', 'Consolidation settlement', 's_c = m_v Δσ H', `${I.mv}×${f1(ds)}×${I.Hc}`, I.mv * ds * I.Hc, 'mm', '', 1);
    const st = S.v('s', 'Total settlement', 's = s_i + s_c', `${f1(si)} + ${f1(sc)}`, si + sc, 'mm', '', 1);
    S.chk({label:'Total settlement', val: st, lim: I.lim, rel:'<=', unit:'mm', dp:1, fix:'Increase footing size, pile the foundation or pre-load the platform.'});
    S.r('s', 'Total settlement', st, 'mm', 1); S.r('si', 'Immediate settlement', si, 'mm', 1); S.r('sc', 'Consolidation settlement', sc, 'mm', 1);
    if (I.mv > 0.3 || sc > 0.5 * I.lim || I.Hc > 3) S.w('DETAIL', 'DETAILED SETTLEMENT ANALYSIS REQUIRED — compressible clay present; simplified method insufficient (oedometer data, time-settlement).');
    S.n(`Estimated total settlement ${f1(st)} mm (${f0(sc / st * 100)}% consolidation).`);
  }});

/* ======================================================================
   FDN factory — equipment shallow foundations
   ====================================================================== */
function defFoundation(o){
  const base = [
    {g:'Equipment loads (characteristic)'},
    {k:'G', sym:'G_k', l:'Equipment weight', u:'kN', d:o.G, c:'Vendor Certified', s:'VENDOR LOAD REQUIRED'},
    {k:'Q', sym:'Q_k', l:'Imposed / maintenance', u:'kN', d:o.Q || 5, c:'Consultant Assumption'},
    {k:'H', sym:'H_k', l:'Lateral (wind / seismic)', u:'kN', d:o.H, c:o.Hc || 'Estimated'},
    {k:'hH', sym:'h_H', l:'Height of lateral load above top of pedestal', u:'m', d:o.hH, c:'Vendor Certified'},
    {k:'M', sym:'M_k', l:'Vendor overturning moment', u:'kN·m', d:o.M || 0, c:'Vendor Certified'},
    {k:'U', sym:'U_k', l:'Vendor uplift', u:'kN', d:o.U || 0, c:'Vendor Certified'},
    {k:'dyn', sym:'φ_d', l:'Dynamic factor on G', u:'', d:o.dyn || 1.0, c:'Consultant Assumption'},
    {g:'Foundation geometry'},
    {k:'B', sym:'B', l:'Footing width (moment direction)', u:'m', d:o.B, c:'Consultant Assumption'},
    {k:'L', sym:'L', l:'Footing length', u:'m', d:o.L, c:'Consultant Assumption'},
    {k:'h', sym:'h', l:'Footing thickness', u:'m', d:o.h, c:'Consultant Assumption'},
    {k:'D', sym:'D', l:'Depth to underside', u:'m', d:o.D, c:'Consultant Assumption'},
    {k:'c1', sym:'c₁', l:'Pedestal / plinth dimension (B dir.)', u:'m', d:o.c1, c:'Consultant Assumption'},
    {k:'c2', sym:'c₂', l:'Pedestal / plinth dimension (L dir.)', u:'m', d:o.c2, c:'Consultant Assumption'},
    {k:'hp', sym:'h_p', l:'Pedestal height (total)', u:'m', d:o.hp, c:'Consultant Assumption'},
    {g:'Materials & soil'},
    {k:'fck', sym:'f_ck', l:'Concrete strength', u:'MPa', d:30, c:'Consultant Assumption'},
    {k:'fyk', sym:'f_yk', l:'Steel yield', u:'MPa', d:500, c:'Consultant Assumption'},
    {k:'cov', sym:'c', l:'Cover', u:'mm', d:50, c:'Consultant Assumption'},
    {k:'bar', sym:'φ', l:'Bottom bar diameter', u:'mm', d:o.bar || 16, c:'Consultant Assumption'},
    {k:'qa', sym:'q_all', l:'Allowable bearing', u:'kPa', d:150, link:'BRG.qa'},
    {k:'mu', sym:'μ', l:'Base friction coefficient', u:'', d:0.40, c:'Consultant Assumption'},
    {k:'gs', sym:'γ_s', l:'Backfill unit weight', u:'kN/m³', d:18, c:'Consultant Assumption'},
    {g:'Factors'},
    {k:'FSs', sym:'FS_s', l:'Sliding', u:'', d:1.5, c:'Consultant Assumption'},
    {k:'FSo', sym:'FS_o', l:'Overturning', u:'', d:2.0, c:'Consultant Assumption'},
    {k:'FSu', sym:'FS_u', l:'Uplift', u:'', d:1.5, c:'Consultant Assumption'},
    {k:'nos', sym:'n', l:'Number of foundations', u:'no.', d:o.nos, c:'Client Provided'},
  ].concat(o.extraInputs || []);
  return defCalc({id:o.id, no:o.no, title:o.title, module:o.module, types:o.types, req:o.req || [13,14,15,16,17,18],
    purpose:o.purpose || `Design check of ${o.name} pad foundation: bearing, sliding, overturning, uplift, punching, one-way shear and flexure.`,
    codes:['EN1997','EN1992','EN1990','CLIENT_ER'],
    assume:['Rigid pad; linear bearing pressure; soil above footing included in stabilising weight.','Stability FS values are consultant assumptions (EC7 EQU/GEO partial factors may be adopted instead — ENGINEER CONFIRMATION).','ULS factors 1.35 (G) and 1.5 (Q, H) — verify NA.'].concat(o.assume || []),
    criteria:['q_max ≤ q_all','FS_sliding ≥ '+ '1.5','FS_overturning ≥ 2.0','FS_uplift ≥ 1.5','v_Ed ≤ v_Rd,c (punching at 2d)'],
    inputs: base,
    run(I, S, P, R){
      if (o.pre) o.pre(I, S, P, R);
      const gc = 24;
      S.h('1. Weights & loads (SLS)');
      const Wf = S.v('W_f', 'Footing + pedestal weight', 'W_f = γ_c(BLh + c₁c₂h_p)', `24(${I.B}×${I.L}×${I.h} + ${I.c1}×${I.c2}×${I.hp})`, gc * (I.B * I.L * I.h + I.c1 * I.c2 * I.hp), 'kN', '', 1);
      const Ws = S.v('W_s', 'Soil over footing', 'W_s = γ_s(BL − c₁c₂)(D − h)', `${I.gs}(${f2(I.B*I.L)} − ${f2(I.c1*I.c2)})(${I.D} − ${I.h})`, I.gs * Math.max(I.B * I.L - I.c1 * I.c2, 0) * Math.max(I.D - I.h, 0), 'kN', '', 1);
      const N = S.v('N', 'Total vertical (SLS)', 'N = φ_d G_k + Q_k + W_f + W_s − U_k', `${I.dyn}×${I.G} + ${I.Q} + ${f1(Wf)} + ${f1(Ws)} − ${I.U}`, I.dyn * I.G + I.Q + Wf + Ws - I.U, 'kN', '', 1);
      const lev = I.hH + (I.hp - (I.D - I.h)) + I.h; // lever from lateral load to underside
      const M = S.v('M', 'Moment at underside', 'M = M_k + H_k·(h_H + h_above + D)', `${I.M} + ${I.H}×${f2(lev)}`, I.M + I.H * lev, 'kN·m', '', 1);
      const e = S.v('e', 'Eccentricity', 'e = M/N', `${f1(M)}/${f1(N)}`, N > 0 ? M / N : 99, 'm', '', 3);
      S.h('2. Bearing pressure');
      let qmax;
      if (e <= I.B / 6){ qmax = S.v('q_max', 'Max pressure (e ≤ B/6)', 'q_max = N/(BL)(1 + 6e/B)', `${f1(N)}/(${I.B}×${I.L})(1 + 6×${f3(e)}/${I.B})`, N / (I.B * I.L) * (1 + 6 * e / I.B), 'kPa', '', 1); }
      else { qmax = S.v('q_max', 'Max pressure (e > B/6, partial contact)', 'q_max = 2N/(3L(B/2 − e))', `2×${f1(N)}/(3×${I.L}(${I.B/2} − ${f3(e)}))`, e < I.B / 2 ? 2 * N / (3 * I.L * (I.B/2 - e)) : 1e6, 'kPa', '', 1); }
      const Bp = S.v('B′', 'Effective width', 'B′ = B − 2e', `${I.B} − 2×${f3(e)}`, I.B - 2 * e, 'm', 'EC7 effective area', 2);
      S.chk({label:'Bearing q_max ≤ q_all', val: qmax, lim: I.qa, rel:'<=', unit:'kPa', dp:1, fix:'Increase footing plan dimensions.'});
      S.chk({label:'Eccentricity e ≤ B/6 (full contact)', val: e, lim: I.B / 6, rel:'<=', unit:'m', dp:3, fix:'Increase B or add dead weight.'});
      S.h('3. Stability');
      const Wst = I.G + Wf + Ws;
      if (I.H > 0){ const Rs = S.v('R_s', 'Sliding resistance', 'R_s = μ(G_k + W_f + W_s − U_k)', `${I.mu}×(${I.G} + ${f1(Wf)} + ${f1(Ws)} − ${I.U})`, I.mu * (Wst - I.U), 'kN', '', 1);
        S.chk({label:'Sliding FS', val: Rs / I.H, lim: I.FSs, rel:'>=', dp:2, fix:'Add shear key or increase weight.'}); }
      const MR = S.v('M_R', 'Restoring moment', 'M_R = (G_k + W_f + W_s − U_k)·B/2', `(${f1(Wst)} − ${I.U})×${I.B}/2`, (Wst - I.U) * I.B / 2, 'kN·m', '', 1);
      if (M > 0) S.chk({label:'Overturning FS', val: MR / M, lim: I.FSo, rel:'>=', dp:2, fix:'Increase footing width / weight.'});
      if (I.U > 0) S.chk({label:'Uplift FS', val: Wst / I.U, lim: I.FSu, rel:'>=', dp:2, fix:'Increase dead weight or anchor to piles.'});
      S.h('4. Structural (ULS)');
      const Nu = S.v('N_Ed', 'ULS column load', 'N_Ed = 1.35 φ_d G_k + 1.5 Q_k', `1.35×${I.dyn}×${I.G} + 1.5×${I.Q}`, 1.35 * I.dyn * I.G + 1.5 * I.Q, 'kN', 'EN1990 — VERIFY NA', 1);
      const Mu = S.v('M_Ed', 'ULS moment at underside', 'M_Ed = 1.5 M', `1.5×${f1(M)}`, 1.5 * M, 'kN·m', '', 1);
      const eu = Mu / Math.max(Nu, 1e-6);
      const qu = S.v('q_Ed', 'ULS net pressure (max)', 'q_Ed = N_Ed/(BL)(1 + 6e/B)', `e = ${f3(eu)} m`, eu <= I.B / 6 ? Nu / (I.B * I.L) * (1 + 6 * eu / I.B) : 2 * Nu / (3 * I.L * Math.max(I.B/2 - eu, 0.05)), 'kPa', '', 1);
      const a = S.v('a', 'Cantilever from pedestal face', 'a = (B − c₁)/2', `(${I.B} − ${I.c1})/2`, (I.B - I.c1) / 2, 'm', '', 3);
      const MEd = S.v('m_Ed', 'Design moment per metre', 'm_Ed = q_Ed a²/2', `${f1(qu)}×${f3(a)}²/2`, qu * a * a / 2, 'kN·m/m', '', 2);
      const rc = rcFlex(S, {M: MEd, b: 1000, h: I.h * 1000, c: I.cov, bar: I.bar, fck: I.fck, fyk: I.fyk});
      const dm = rc.d / 1000;
      const VEd = S.v('v_Ed', 'One-way shear at d from face (per m)', 'V = q_Ed (a − d)', `${f1(qu)}×(${f3(a)} − ${f3(dm)})`, Math.max(0, qu * (a - dm)), 'kN/m', '', 1);
      const vr = vRdc(rc.d, 1000, rc.rho, I.fck);
      const VRd = S.v('V_Rd,c', 'Shear resistance (per m)', 'V_Rd,c = max[0.12k(100ρf_ck)^⅓, v_min] b d', `k = ${f3(vr.k)}, ρ = ${fmt(rc.rho,4)}`, vr.V, 'kN/m', 'EC2', 1);
      S.chk({label:'One-way shear', val: VEd, lim: VRd, rel:'<=', unit:'kN/m', dp:1, fix:'Increase footing thickness.'});
      const u0 = 2 * (I.c1 + I.c2), nu = 0.6 * (1 - I.fck / 250), vmax = 0.5 * nu * I.fck / 1.5;
      const v0 = S.v('v_Ed,0', 'Shear stress at pedestal face', 'v_Ed,0 = β N_Ed/(u₀ d), u₀ = 2(c₁ + c₂)', `1.15×${f1(Nu)}×10³/(${f3(u0)}×10³×${f0(rc.d)})`, 1.15 * Nu * 1e3 / (u0 * 1e3 * rc.d), 'MPa', 'EC2', 3);
      S.chk({label:'Punching at pedestal face (v_Rd,max)', val: v0, lim: vmax, rel:'<=', unit:'MPa', dp:3, fix:'Increase pedestal size or footing depth.'});
      S.txt('Footing punching (EC2 footing rule): control perimeters at a = 0.25d … 2d; v_Rd = v_Rd,c·2d/a; critical a maximises v_Ed/v_Rd.');
      let crit = {r: 0, a: 2 * dm, v: 0, vR: vr.v, u: 0, V: 0};
      for (let k = 1; k <= 8; k++){ const aa = k * 0.25 * dm, u = u0 + 2 * Math.PI * aa, Acp = I.c1 * I.c2 + u0 * aa + Math.PI * aa * aa;
        const Vr = Math.max(0, Nu * (1 - Acp / (I.B * I.L))), v = 1.15 * Vr * 1e3 / (u * 1e3 * rc.d), vR = vr.v * 2 * dm / aa; if (v / vR > crit.r) crit = {r: v / vR, a: aa, v, vR, u, V: Vr}; }
      const vEd = S.v('v_Ed', 'Punching stress at critical perimeter', 'v_Ed = β V_Ed,red/(u d), V_Ed,red = N_Ed(1 − A(a)/BL)', `a = ${f3(crit.a)} m, u = ${f3(crit.u)} m, V_red = ${f1(crit.V)} kN`, crit.v, 'MPa', 'EC2', 3);
      const vRp = S.v('v_Rd', 'Punching resistance at a', 'v_Rd = v_Rd,c · 2d/a', `${f3(vr.v)} × 2×${f3(dm)}/${f3(crit.a)}`, crit.vR, 'MPa', 'EC2', 3);
      S.chk({label:'Punching shear (critical perimeter)', val: vEd, lim: vRp, rel:'<=', unit:'MPa', dp:3, fix:'Increase footing thickness or pedestal size.'});
      S.h('5. Quantities (per foundation × n)');
      const Vc = I.B * I.L * I.h + I.c1 * I.c2 * I.hp, Vl = I.B * I.L * 0.075;
      const reb = (rc.Aprov * 1e-6 * I.B * I.L * 2 * 1.5 + 0.012 * I.c1 * I.c2 * I.hp) * 7.85 * 1.10;
      S.v('V_c', 'Concrete per foundation', 'BLh + c₁c₂h_p', '', Vc, 'm³', '', 2);
      S.v('m_s', 'Reinforcement per foundation', '(A_s,prov·B·L·2 dirs·1.5 top/bottom + 1.2% pedestal)·7.85·1.10 laps', '', reb, 't', '', 3);
      S.q('CN_G30', Vc * I.nos, `${f2(Vc)} m³ × ${I.nos}`); S.q('CN_LEAN', Vl * I.nos); S.q('RF_Y', reb * I.nos, `${f3(reb)} t × ${I.nos}`);
      S.q('FW_FORM', (2 * (I.B + I.L) * I.h + 2 * (I.c1 + I.c2) * I.hp) * I.nos); S.q('EX_FDN', (I.B + 0.6) * (I.L + 0.6) * I.D * I.nos);
      S.r('qmax', 'Maximum bearing pressure', qmax, 'kPa', 1); S.r('e', 'Eccentricity', e, 'm', 3); S.r('As', 'Bottom steel', rc.Aprov, 'mm²/m', 0);
      S.r('Vc', 'Concrete per foundation', Vc, 'm³', 2); S.r('nos', 'Number of foundations', I.nos, 'no.', 0); S.r('vEd', 'Punching stress', vEd, 'MPa', 3);
      S.p(`${o.name}: pad ${I.B} × ${I.L} × ${I.h} m, pedestal ${I.c1} × ${I.c2} m, bottom reinforcement T${I.bar}@${rc.s} both ways; ${I.nos} no.`);
      S.w('VENDOR', `${o.name} loads (weight, COG, anchor loads, dynamic factors) to be confirmed by vendor.`);
      S.n(`Bearing utilisation ${f2(qmax / I.qa)}, eccentricity ${f3(e)} m (B/6 = ${f3(I.B/6)} m); reinforcement T${I.bar}@${rc.s}.`);
      if (o.extra) o.extra(I, S, P, R);
    }});
}
defFoundation({id:'FDN_INV', no:'CS-FDN-010', title:'Inverter / MV Skid Foundation', name:'Inverter / MV skid', module:'m29', G:220, H:18, hH:1.6, M:0, U:15, B:3.2, L:7.0, h:0.45, D:0.8, c1:2.6, c2:6.4, hp:1.0, nos:()=>Math.ceil((+P.info.mwac||100)/4.4)});
defFoundation({id:'FDN_TX', no:'CS-FDN-011', title:'Main Power Transformer Foundation & Oil Bund', name:'Main power transformer', module:'m30', G:1150, Q:10, H:60, hH:2.5, B:6.5, L:8.0, h:0.8, D:1.2, c1:4.6, c2:6.0, hp:1.0, bar:20, nos:2,
  extraInputs:[{g:'Oil containment (bund)'},{k:'oil', sym:'V_oil', l:'Transformer oil volume', u:'m³', d:38, c:'Vendor Certified', s:'VENDOR LOAD REQUIRED'},{k:'bl', sym:'L_b×B_b', l:'Bund internal area', u:'m²', d:110, c:'Consultant Assumption'},{k:'rain', sym:'P', l:'Rainfall allowance', u:'mm', d:100, c:'Consultant Assumption'},{k:'bh', sym:'h_b', l:'Bund wall height (effective)', u:'m', d:0.80, c:'Consultant Assumption'}],
  extra(I, S){ S.h('6. Oil containment (bund)');
    const Vr = S.v('V_req', 'Required bund volume', 'V_req = 1.1 V_oil + A_b·P', `1.1×${I.oil} + ${I.bl}×${I.rain}/1000`, 1.1 * I.oil + I.bl * I.rain / 1000, 'm³', 'IEEE980 / client (VERIFY)', 1);
    const Vp = S.v('V_prov', 'Provided (net of plinth & stone)', 'V = A_b h_b − V_plinth − 0.6·V_stone', `${I.bl}×${I.bh} − ${f2(I.c1*I.c2*I.bh)}`, I.bl * I.bh - I.c1 * I.c2 * I.bh, 'm³', '', 1);
    S.chk({label:'Bund volume', val: Vp, lim: Vr, rel:'>=', unit:'m³', kind:'cap', what:'bund volume', dem:'required containment', fix:'Increase bund area or wall height; add oil sump.', dp:1});
    S.q('TX_OWS', 1, 'Oil-water separator for main transformer bunds'); S.q('CN_G30', (Math.sqrt(I.bl) * 4 * 0.2 * (I.bh + 0.3)) * I.nos, 'Bund walls'); }});
defFoundation({id:'FDN_LGT', no:'CS-FDN-012', title:'Lighting Mast Foundation', name:'Lighting mast', module:'m28', G:8, Q:0, H:3.2, hH:5, B:1.8, L:1.8, h:0.8, D:1.2, c1:0.5, c2:0.5, hp:0.8, bar:12, nos:40, Hc:'Consultant Assumption'});
defFoundation({id:'FDN_CCTV', no:'CS-FDN-013', title:'CCTV Pole Foundation', name:'CCTV pole', module:'m39', G:6, Q:0, H:2.4, hH:5, B:1.6, L:1.6, h:0.7, D:1.2, c1:0.45, c2:0.45, hp:0.8, bar:12, nos:()=>Math.ceil(6250/120), Hc:'Consultant Assumption'});
defFoundation({id:'FDN_FWT', no:'CS-FDN-014', title:'Fire-Water Tank Foundation (Raft)', name:'Fire-water tank', module:'m42', G:()=>P.type==='B'?4300:1450, Q:5, H:25, hH:3, B:()=>P.type==='B'?16:10, L:()=>P.type==='B'?16:10, h:0.45, D:0.6, c1:()=>P.type==='B'?14.5:8.5, c2:()=>P.type==='B'?14.5:8.5, hp:0.3, bar:16, nos:1});
defFoundation({id:'BFDN', no:'CS-BES-002', title:'BESS Enclosure Foundation', name:'BESS enclosure', module:'m31', types:['B'], req:[40], G:392, Q:5, H:0, hH:1.45, B:3.2, L:12.8, h:0.45, D:0.6, c1:2.6, c2:12.2, hp:0.5, bar:16, nos:()=>Math.ceil((+P.info.bessMWh||200)/5.0),
  extraInputs:[{g:'Lateral actions (computed)'},{k:'qpb', sym:'q_p', l:'Peak velocity pressure (BESS)', u:'kPa', d:0, link:'WND.qp_bess'},{k:'cf', sym:'c_f', l:'Force coefficient (enclosure)', u:'', d:1.3, c:'Consultant Assumption'},{k:'Aw', sym:'A_ref', l:'Wind area (long face)', u:'m²', d:35.1, c:'Vendor Certified'},{k:'kh', sym:'k_h', l:'Seismic coefficient (if required)', u:'', d:0.0, c:'Consultant Assumption', s:'MS EN 1998-1 NA — if required'}],
  pre(I, S){ S.h('0. Lateral actions on enclosure');
    const Fw = S.v('F_w', 'Wind force', 'F_w = q_p c_f A_ref', `${f3(I.qpb)}×${I.cf}×${I.Aw}`, I.qpb * I.cf * I.Aw, 'kN', 'EN1991_4', 2);
    const Fs = S.v('F_s', 'Seismic force', 'F_s = k_h G_k', `${I.kh}×${I.G}`, I.kh * I.G, 'kN', 'EN1998', 2);
    I.H = S.v('H_k', 'Governing lateral (adopted)', 'H_k = max(F_w, F_s)', '', Math.max(Fw, Fs), 'kN', '', 2); }});

/* ======================================================================
   RCF — RC section design (generic)
   ====================================================================== */
defCalc({id:'RCF', no:'CS-STR-003', title:'RC Section Design — Flexure, Shear & Crack Control', module:'m33', req:[18,17],
  purpose:'Design RC slab / pad / wall / beam section for bending, shear and crack control (bar spacing).',
  codes:['EN1992','EN1990'],
  assume:['Rectangular stress block; singly reinforced.','Crack control by maximum bar spacing for w_k = 0.3 mm (EC2 table approach) using estimated SLS steel stress.'],
  criteria:['K ≤ 0.167 ; V_Ed ≤ V_Rd,c ; s ≤ s_max(σ_s)'],
  inputs:[
    {k:'el', sym:'—', l:'Element', t:'s', o:['Slab','Pad','Pedestal','Wall','Beam','Retaining wall stem'], d:'Slab', c:'Consultant Assumption'},
    {k:'desc', sym:'—', l:'Description', t:'x', d:'Control building ground slab / cable pit roof slab', c:'Consultant Assumption'},
    {k:'b', sym:'b', l:'Section width', u:'mm', d:1000, c:'Consultant Assumption'},
    {k:'h', sym:'h', l:'Section depth', u:'mm', d:250, c:'Consultant Assumption'},
    {k:'c', sym:'c', l:'Cover', u:'mm', d:40, c:'Consultant Assumption'},
    {k:'bar', sym:'φ', l:'Bar diameter', u:'mm', d:12, c:'Consultant Assumption'},
    {k:'M', sym:'M_Ed', l:'ULS moment', u:'kN·m', d:42, c:'Estimated'},
    {k:'V', sym:'V_Ed', l:'ULS shear', u:'kN', d:65, c:'Estimated'},
    {k:'Mq', sym:'M_qp', l:'Quasi-permanent SLS moment', u:'kN·m', d:18, c:'Estimated'},
    {k:'fck', sym:'f_ck', l:'Concrete', u:'MPa', d:30, c:'Consultant Assumption'},
    {k:'fyk', sym:'f_yk', l:'Steel', u:'MPa', d:500, c:'Consultant Assumption'},
  ],
  run(I, S){
    S.txt(`${I.el}: ${I.desc}`);
    const rc = rcFlex(S, {M: I.M, b: I.b, h: I.h, c: I.c, bar: I.bar, fck: I.fck, fyk: I.fyk});
    const vr = vRdc(rc.d, I.b, rc.rho, I.fck);
    const VRd = S.v('V_Rd,c', 'Shear resistance (no links)', 'V_Rd,c = max[0.12k(100ρf_ck)^⅓, 0.035k^1.5√f_ck] b d', `k = ${f3(vr.k)}, ρ = ${fmt(rc.rho,4)}`, vr.V, 'kN', 'EC2', 1);
    S.chk({label:'Shear V_Ed ≤ V_Rd,c', val: I.V, lim: VRd, rel:'<=', unit:'kN', dp:1, fix:'Increase depth or provide shear links.'});
    const ss = S.v('σ_s', 'SLS steel stress (estimate)', 'σ_s = (f_yk/1.15)(M_qp/M_Ed)(A_s,req/A_s,prov)', `(${I.fyk}/1.15)(${I.Mq}/${I.M})(${f0(rc.Areq)}/${f0(rc.Aprov)})`, (I.fyk / 1.15) * (I.Mq / I.M) * (rc.Areq / rc.Aprov), 'MPa', 'EC2 crack control', 0);
    const smax = S.v('s_max', 'Max bar spacing (w_k = 0.3 mm)', 's_max(σ_s) table: 160→300, 200→250, 240→200, 280→150, 320→100, 360→50', `σ_s = ${f0(ss)}`, lerpTable([[160,300],[200,250],[240,200],[280,150],[320,100],[360,50]], ss), 'mm', 'EC2 table (VERIFY)', 0);
    if (rc.s) S.chk({label:'Bar spacing for crack control', val: rc.s, lim: smax, rel:'<=', unit:'mm', dp:0, fix:'Reduce spacing / use smaller bars.'});
    S.r('As', 'Steel provided', rc.Aprov, 'mm²' + (I.b === 1000 ? '/m' : ''), 0); S.r('K', 'K', rc.K, '', 3);
    S.p(rc.s ? `T${I.bar} @ ${rc.s} mm (${f0(rc.Aprov)} mm²/m)` : `${rc.n} T${I.bar}`);
  }});

/* ======================================================================
   STL — steel member check (EC3)
   ====================================================================== */
defCalc({id:'STL', no:'CS-STR-004', title:'Steel Member Check (EC3)', module:'m33', req:[19],
  purpose:'Check a steel member for axial, bending, shear, combined utilisation, flexural buckling and deflection.',
  codes:['EN1993','EN1990'],
  assume:['Class 1/2 section (plastic resistance); lateral-torsional buckling prevented (restrained) — else DETAILED.','Interaction per EC3 Annex B (simplified k_yy with C_my).'],
  criteria:['N/N_b + k_yy M/M_c ≤ 1.0 ; δ ≤ L/limit'],
  inputs:[
    {k:'name', sym:'—', l:'Member / section', t:'x', d:'Cable tray support frame — UB 203×133×25 S355', c:'Consultant Assumption'},
    {k:'A', sym:'A', l:'Area', u:'cm²', d:32.0, c:'Vendor Certified'},
    {k:'Wpl', sym:'W_pl,y', l:'Plastic modulus', u:'cm³', d:258, c:'Vendor Certified'},
    {k:'Iy', sym:'I_y', l:'Second moment (strong)', u:'cm⁴', d:2340, c:'Vendor Certified'},
    {k:'iz', sym:'i_z', l:'Radius of gyration (weak)', u:'cm', d:3.10, c:'Vendor Certified'},
    {k:'iy', sym:'i_y', l:'Radius of gyration (strong)', u:'cm', d:8.56, c:'Vendor Certified'},
    {k:'Av', sym:'A_v', l:'Shear area', u:'cm²', d:13.0, c:'Vendor Certified'},
    {k:'fy', sym:'f_y', l:'Yield', u:'MPa', d:355, c:'Vendor Certified'},
    {k:'L', sym:'L', l:'Span / length', u:'m', d:4.0, c:'Consultant Assumption'},
    {k:'k', sym:'k', l:'Effective length factor', u:'', d:1.0, c:'Consultant Assumption'},
    {k:'N', sym:'N_Ed', l:'Axial compression', u:'kN', d:60, c:'Estimated'},
    {k:'M', sym:'M_Ed', l:'Major-axis moment', u:'kN·m', d:38, c:'Estimated'},
    {k:'V', sym:'V_Ed', l:'Shear', u:'kN', d:40, c:'Estimated'},
    {k:'cm', sym:'C_my', l:'Equivalent moment factor', u:'', d:0.95, c:'Consultant Assumption'},
    {k:'w', sym:'w', l:'SLS UDL (deflection)', u:'kN/m', d:9, c:'Estimated'},
    {k:'lim', sym:'L/δ', l:'Deflection limit ratio', u:'', d:200, c:'Consultant Assumption'},
  ],
  run(I, S){
    const E = 210000;
    const Npl = S.v('N_pl,Rd', 'Axial resistance', 'A f_y', `${I.A}×10²×${I.fy}/10³`, I.A * 100 * I.fy / 1e3, 'kN', 'EN1993', 1);
    const Mc = S.v('M_c,Rd', 'Moment resistance', 'W_pl f_y', `${I.Wpl}×10³×${I.fy}/10⁶`, I.Wpl * 1e3 * I.fy / 1e6, 'kN·m', 'EN1993', 1);
    const Vpl = S.v('V_pl,Rd', 'Shear resistance', 'A_v f_y/√3', `${I.Av}×10²×${I.fy}/√3/10³`, I.Av * 100 * I.fy / Math.sqrt(3) / 1e3, 'kN', 'EN1993', 1);
    const l1 = 93.9 * Math.sqrt(235 / I.fy);
    const lz = S.v('λ̄_z', 'Slenderness (weak axis)', 'λ̄ = kL/(i λ₁), λ₁ = 93.9ε', `${I.k}×${I.L*100}/(${I.iz}×${f1(l1)})`, I.k * I.L * 100 / (I.iz * l1), '', '', 3);
    const ly = I.k * I.L * 100 / (I.iy * l1);
    const cz = S.v('χ_z', 'Reduction (curve c)', 'χ = 1/[Φ + √(Φ² − λ̄²)]', '', ec3chi(lz, 0.49), '', '', 3);
    const cy = ec3chi(ly, 0.21);
    const Nb = S.v('N_b,Rd', 'Buckling resistance', 'χ_min A f_y', `${f3(Math.min(cz,cy))}×${f1(Npl)}`, Math.min(cz, cy) * Npl, 'kN', '', 1);
    const kyy = S.v('k_yy', 'Interaction factor', 'k_yy = C_my[1 + (λ̄_y − 0.2) N/(χ_y N_Rk)] ≤ C_my[1 + 0.8N/(χ_y N_Rk)]', `λ̄_y = ${f3(ly)}`, I.cm * Math.min(1 + (ly - 0.2) * I.N / (cy * Npl), 1 + 0.8 * I.N / (cy * Npl)), '', 'EC3 Annex B', 3);
    S.chk({label:'Axial', val: I.N / Npl, lim: 1, rel:'<=', dp:3});
    S.chk({label:'Bending', val: I.M / Mc, lim: 1, rel:'<=', dp:3});
    S.chk({label:'Shear', val: I.V / Vpl, lim: 1, rel:'<=', dp:3});
    const U = S.v('U', 'Combined', 'N/N_b,Rd + k_yy M/M_c,Rd', `${I.N}/${f1(Nb)} + ${f3(kyy)}×${I.M}/${f1(Mc)}`, I.N / Nb + kyy * I.M / Mc, '', '', 3);
    S.chk({label:'Combined utilisation (incl. buckling)', val: U, lim: 1, rel:'<=', dp:3, fix:'Increase section size.'});
    const dl = S.v('δ', 'Deflection (simply supported)', 'δ = 5wL⁴/(384EI)', `5×${I.w}×${I.L*1000}⁴/(384×${E}×${I.Iy}×10⁴)`, 5 * I.w * (I.L * 1000)**4 / (384 * E * I.Iy * 1e4), 'mm', '', 1);
    S.chk({label:'Deflection', val: dl, lim: I.L * 1000 / I.lim, rel:'<=', unit:'mm', dp:1});
    S.r('U', 'Combined utilisation', U, '', 3); S.r('defl', 'Deflection', dl, 'mm', 1);
    S.w('DETAIL', 'Lateral-torsional buckling not checked — member assumed laterally restrained.');
    S.p(I.name);
  }});
