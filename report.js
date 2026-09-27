'use strict';
/* ==========================================================================
   FIGURES (SVG) + REPORT GENERATOR (58-section order) + A4 HTML + DOCX
   ========================================================================== */
const SVGH = (w, h, body) => `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" font-family="Aptos, Arial, sans-serif" style="background:#fff">${body}</svg>`;
const T = (x, y, s, o) => `<text x="${x}" y="${y}" font-size="${(o && o.fs) || 10}" fill="${(o && o.c) || '#303030'}" ${o && o.a ? `text-anchor="${o.a}"` : ''} ${o && o.b ? 'font-weight="700"' : ''}>${esc(s)}</text>`;
function northArrow(x, y){ return `<path d="M${x} ${y} l-6 16 l6 -4 l6 4z" fill="#303030"/>${T(x, y - 3, 'N', {a:'middle', b:1, fs:11})}`; }

/* ---------- UTM (WGS84) ---------- */
function toUTM(lat, lon){
  const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), k0 = 0.9996, ep2 = e2 / (1 - e2);
  const zone = Math.floor((lon + 180) / 6) + 1, l0 = rad((zone - 1) * 6 - 180 + 3), p = rad(lat), l = rad(lon);
  const N = a / Math.sqrt(1 - e2 * Math.sin(p)**2), Tt = Math.tan(p)**2, C = ep2 * Math.cos(p)**2, A = Math.cos(p) * (l - l0);
  const M = a * ((1 - e2/4 - 3*e2*e2/64 - 5*e2**3/256) * p - (3*e2/8 + 3*e2*e2/32 + 45*e2**3/1024) * Math.sin(2*p) + (15*e2*e2/256 + 45*e2**3/1024) * Math.sin(4*p) - (35*e2**3/3072) * Math.sin(6*p));
  const E = k0 * N * (A + (1 - Tt + C) * A**3 / 6 + (5 - 18*Tt + Tt*Tt + 72*C - 58*ep2) * A**5 / 120) + 500000;
  let Nn = k0 * (M + N * Math.tan(p) * (A*A/2 + (5 - Tt + 9*C + 4*C*C) * A**4 / 24 + (61 - 58*Tt + Tt*Tt + 600*C - 330*ep2) * A**6 / 720)); if (lat < 0) Nn += 1e7;
  return {zone, E, N: Nn, epsg: (lat >= 0 ? 32600 : 32700) + zone};
}

/* ---------- figures ---------- */
function figLayout(){
  const pts = (P.coords || []).filter(c => isNum(+c.lat) && isNum(+c.lon) && c.lat !== '').map(c => Object.assign({}, c, toUTM(+c.lat, +c.lon)));
  if (!pts.length) return SVGH(520, 80, T(10, 40, 'No coordinates entered.'));
  const W = 560, H = 380, m = 40; const xs = pts.map(p => p.E), ys = pts.map(p => p.N);
  const x0 = Math.min(...xs) - 150, x1 = Math.max(...xs) + 150, y0 = Math.min(...ys) - 150, y1 = Math.max(...ys) + 150, sc = Math.min((W - 2*m) / (x1 - x0), (H - 2*m) / (y1 - y0));
  const X = e => m + (e - x0) * sc, Y = n => H - m - (n - y0) * sc;
  let b = `<rect x="${X(x0)}" y="${Y(y1)}" width="${(x1-x0)*sc}" height="${(y1-y0)*sc}" fill="#FBF6F0" stroke="#D99058" stroke-dasharray="6 4"/>`;
  const cen = pts.find(p => /centroid/i.test(p.label));
  if (cen){ const r = Math.sqrt((+P.info.landArea || 100) * 1e4 / Math.PI) * sc; b += `<circle cx="${X(cen.E)}" cy="${Y(cen.N)}" r="${r}" fill="none" stroke="#9E6035" stroke-width="1" stroke-dasharray="2 3"/>`; }
  pts.forEach((p, i) => { const c = /BESS/.test(p.label) ? '#5A4780' : /outfall|pond|crossing/i.test(p.label) ? '#4B6378' : /substation|POI/i.test(p.label) ? '#B0413E' : '#D99058';
    b += `<circle cx="${X(p.E)}" cy="${Y(p.N)}" r="5" fill="${c}" stroke="#fff"/>${T(X(p.E) + 8, Y(p.N) + 3 + (i % 2 ? 9 : 0), p.label, {fs:9.5})}`; });
  const sb = 500 * sc; b += `<rect x="${m}" y="${H - 22}" width="${sb}" height="4" fill="#303030"/>${T(m, H - 8, '0', {fs:9})}${T(m + sb, H - 8, '500 m', {fs:9, a:'middle'})}`;
  b += northArrow(W - 30, 30) + T(m, 18, `Key plan — UTM zone ${pts[0].zone}N (WGS84, EPSG:${pts[0].epsg}); indicative land extent`, {fs:10, b:1});
  return SVGH(W, H, b);
}
function figDEM(){
  const D = getDEM(); const zs = D.z.flat(), zn = Math.min(...zs), zx = Math.max(...zs);
  let svg = heatmap({grid: D.z, w: 520, colors: v => rampColor((v - zn) / (zx - zn)), title: `DTM (${D.nx}×${D.ny} @ ${D.dx} m) — ${f1(zn)} to ${f1(zx)} m RL`, legend: [[rampColor(0), f1(zn) + ' m'], [rampColor(0.5), f1((zn+zx)/2) + ' m'], [rampColor(1), f1(zx) + ' m'], ['#4B6378', 'platform']]});
  const c = (520 - 10) / D.nx; let ov = '';
  platforms().filter(p => p.id !== 'PF-BESS' || P.type === 'B').forEach(p => { ov += `<rect x="${5 + p.x0 * c}" y="${20 + p.y0 * c}" width="${p.w * c}" height="${p.h * c}" fill="none" stroke="#4B6378" stroke-width="2"/><text x="${5 + p.x0 * c + 2}" y="${20 + p.y0 * c - 2}" font-size="9" fill="#4B6378">${esc(p.id)}</text>`; });
  return svg.replace('</svg>', ov + '</svg>');
}
function figSlopeBands(){ const r = R.TOPO; if (!r) return ''; return barChart({labels: ['0–3°','3–5°','5–10°','10–15°','15–20°','>20°'], values: r.bands, unit: '%', title: 'Slope distribution (% of site area)', colors: r.bands.map((v, i) => rampColor(i / 5 * 0.9 + 0.1)), dp: 1}); }
function figGrading(){ const r = R.GRD; if (!r || !r.zone) return ''; const cols = {'-1':'#8FA3B5', 0:'#E6F1E8', 1:'#F2C98F', 2:'#B0413E'};
  return heatmap({grid: r.zone, w: 520, colors: v => cols[v], title: 'Grading zones vs mounting tolerance', legend: [['#E6F1E8','No grading'],['#F2C98F','Moderate'],['#B0413E','Major'],['#8FA3B5','Platform']]}); }
function figSoil(){
  const bhs = P.tables.bh || []; if (!bhs.length) return '';
  const W = 560, H = 330, top = 40, dmax = Math.max(...bhs.map(b => b.depth)), sc = (H - top - 20) / dmax, cw = Math.min(70, (W - 60) / bhs.length - 14);
  const col = {CLAY:'#C9A27E', SILT:'#E3C99B', SAND:'#F2E2B8', ROCK:'#9A8F86'};
  let b = T(10, 16, 'Soil profiles (SPT N shown per layer; ▼ groundwater)', {b:1}); for (let d = 0; d <= dmax; d += 5) b += `<line x1="40" x2="${W - 10}" y1="${top + d * sc}" y2="${top + d * sc}" stroke="#eee"/>${T(34, top + d * sc + 3, d + ' m', {fs:9, a:'end'})}`;
  bhs.forEach((bh, i) => { const x = 50 + i * (cw + 18); b += T(x + cw / 2, top - 8, bh.id, {a:'middle', b:1, fs:10});
    bh.layers.forEach(L => { const y = top + L[0] * sc, h = (L[1] - L[0]) * sc; b += `<rect x="${x}" y="${y}" width="${cw}" height="${h}" fill="${col[L[3]] || '#ddd'}" stroke="#8a7a6a" stroke-width="0.6"/>`; if (h > 11) b += T(x + cw / 2, y + h / 2 + 3, `N=${L[4]}`, {a:'middle', fs:9}); });
    b += `<path d="M${x + cw + 2} ${top + bh.gwl * sc} l6 -5 h-12 z" fill="#4B6378"/>`; });
  let lx = 50; Object.entries(col).forEach(([k, c]) => { b += `<rect x="${lx}" y="${H - 14}" width="12" height="9" fill="${c}" stroke="#8a7a6a"/>${T(lx + 16, H - 6, k, {fs:9})}`; lx += 70; });
  return SVGH(W, H, b);
}
function figCatch(){
  const sc = subcatch(); if (!sc.length) return ''; const W = 560, H = 250; const tot = sum(sc.map(c => +c.area)); let x = 20, b = T(10, 16, 'Catchment schematic — sub-catchments to detention pond and outfall', {b:1});
  sc.forEach(c => { const w = (W - 180) * c.area / tot; b += `<rect x="${x}" y="40" width="${w - 4}" height="120" fill="${rampColor(0.15 + 0.6 * (c.cPost - 0.3))}" stroke="#9E6035"/>${T(x + (w - 4) / 2, 95, c.id, {a:'middle', b:1, fs: w < 50 ? 8 : 10})}` + (w >= 50 ? `${T(x + (w - 4) / 2, 110, f1(c.area) + ' ha', {a:'middle', fs:9})}${T(x + (w - 4) / 2, 123, 'C ' + f2(c.cPre) + '→' + f2(c.cPost), {a:'middle', fs:9})}` : `${T(x + (w - 4) / 2, 110, f0(c.area) + ' ha', {a:'middle', fs:8})}`);
    b += `<path d="M${x + (w - 4) / 2} 160 L${x + (w - 4) / 2} 190 L${W - 150} 190" fill="none" stroke="#4B6378" stroke-width="1.5"/>`; x += w; });
  b += `<rect x="${W - 150}" y="170" width="70" height="40" rx="6" fill="#DCE6EE" stroke="#4B6378"/>${T(W - 115, 188, 'Detention', {a:'middle', fs:9})}${T(W - 115, 200, 'pond', {a:'middle', fs:9})}<path d="M${W - 80} 190 L${W - 30} 190" stroke="#4B6378" stroke-width="2" marker-end="url(#ar)"/>${T(W - 30, 180, 'Outfall', {a:'end', fs:9})}`;
  b += `<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#4B6378"/></marker></defs>`;
  if (R.RAT) b += T(20, 235, `Q_pre = ${f2(R.RAT.res.Qpre)} m³/s → Q_post = ${f2(R.RAT.res.Qpost)} m³/s (+${f0(R.RAT.res.dQ)}%); detention storage ${R.DET ? f0(R.DET.res.Vreq) : '—'} m³`, {fs:10});
  return SVGH(W, H, b);
}
function figDrain(){
  const r = R.DSZ; if (!r || !r.res.b) return ''; const b0 = r.res.b, D = r.res.D, z = r.I.z, W = 460, H = 200, s = 110 / Math.max(D, 0.5), cx = W / 2;
  const tw = b0 + 2 * z * D; const p = (x, y) => `${cx + x * s},${170 - y * s}`;
  let g = `<polygon points="${p(-tw/2 - 0.3, D)} ${p(-tw/2, D)} ${p(-b0/2, 0)} ${p(b0/2, 0)} ${p(tw/2, D)} ${p(tw/2 + 0.3, D)} ${p(tw/2 + 0.3, -0.15)} ${p(-tw/2 - 0.3, -0.15)}" fill="#E5E2DE" stroke="#666"/>`;
  const y = D - r.I.fb, wt = b0 + 2 * z * y; g += `<polygon points="${p(-wt/2, y)} ${p(-b0/2, 0)} ${p(b0/2, 0)} ${p(wt/2, y)}" fill="#CFE0EC" stroke="#4B6378"/>`;
  g += T(cx, 190, `b = ${f2(b0)} m`, {a:'middle'}) + T(cx + tw / 2 * s + 10, 170 - D * s / 2, `D = ${f2(D)} m`, {}) + T(cx, 170 - D * s - 8, `Freeboard ${r.I.fb} m · 1V:${z}H · ${r.I.lin}`, {a:'middle', fs:9.5});
  return SVGH(W, H, T(10, 16, 'Typical drain section (auto-sized)', {b:1}) + g);
}
function figRoad(){
  const r = R.PAV; if (!r) return ''; const W = 520, H = 190, x0 = 60, w = 400, s = 0.18;
  const ly = [['Crusher-run base', r.I.tb, '#BFB6AA'], ['Granular sub-base', r.I.ts, '#D8CDB8'], ['Geotextile / subgrade (CBR ' + r.I.cbr + '%)', 60, '#E9DCC8']];
  let y = 40, g = T(10, 16, 'Typical road pavement section', {b:1});
  ly.forEach(([n, t, c]) => { const h = t * s; g += `<rect x="${x0}" y="${y}" width="${w}" height="${h}" fill="${c}" stroke="#777"/>${T(x0 + w + 8, y + h / 2 + 3, `${n}${t !== 60 ? ' — ' + t + ' mm' : ''}`, {fs:9.5})}`; y += h; });
  g += T(x0, y + 18, `Required granular thickness ${f0(r.res.treq)} mm (CBR method); provided ${r.I.tb + r.I.ts} mm`, {fs:9.5});
  return SVGH(W + 120, H, g);
}
function figFdn(cid){
  const r = R[cid || 'FDN_TX']; if (!r) return ''; const I = r.I, W = 520, H = 230, s = 150 / Math.max(I.B, I.D + I.hp), cx = 220, gl = 70;
  let g = T(10, 16, `${CALCS[cid || 'FDN_TX'].title} — section`, {b:1});
  g += `<line x1="20" x2="${W - 60}" y1="${gl}" y2="${gl}" stroke="#6b5b4b" stroke-dasharray="6 3"/>${T(W - 58, gl + 3, 'FGL', {fs:9})}`;
  const yb = gl + I.D * s; g += `<rect x="${cx - I.B / 2 * s}" y="${yb - I.h * s}" width="${I.B * s}" height="${I.h * s}" fill="#D6D1CB" stroke="#555"/>`;
  const ptop = yb - I.h * s - I.hp * s; g += `<rect x="${cx - I.c1 / 2 * s}" y="${ptop}" width="${I.c1 * s}" height="${I.hp * s}" fill="#E5E2DE" stroke="#555"/>`;
  g += `<rect x="${cx - I.c1 / 2 * s + 6}" y="${ptop - 40}" width="${I.c1 * s - 12}" height="40" fill="#F8E5D5" stroke="#9E6035"/>${T(cx, ptop - 16, 'Equipment', {a:'middle', fs:9})}`;
  g += T(cx, yb + 16, `B = ${I.B} m, h = ${I.h} m, D = ${I.D} m; pedestal ${I.c1} × ${I.c2} m`, {a:'middle', fs:9.5});
  g += T(cx + I.B / 2 * s + 12, yb - I.h * s / 2, `T${I.bar}@${r.steps.find(x => x.sym === 's') ? r.steps.find(x => x.sym === 's').val : '—'} B/W`, {fs:9.5});
  g += T(cx + I.B / 2 * s + 12, yb + 2, `q_max ${f0(r.res.qmax)} kPa ≤ ${f0(I.qa)} kPa`, {fs:9.5});
  return SVGH(W, H, g);
}
function figPile(){
  const r = R.PVP, G = R.GEO; if (!r || !G || !G.profile) return ''; const W = 460, H = 300, gl = 90, s = 180 / Math.max(r.I.L + 0.5, 3);
  const col = {CLAY:'#C9A27E', SILT:'#E3C99B', SAND:'#F2E2B8', ROCK:'#9A8F86'}; let g = T(10, 16, `PV pile — design profile ${G.profileBH}`, {b:1});
  G.profile.forEach(p => { if (p.from > r.I.L + 0.5) return; const y = gl + p.from * s, h = (Math.min(p.to, r.I.L + 0.5) - p.from) * s; g += `<rect x="40" y="${y}" width="360" height="${h}" fill="${col[p.type]}" opacity="0.7"/>${T(300, y + 12, `${p.type} N=${p.N}${p.cu ? ', Cu=' + f0(p.cu) : ''}`, {fs:9})}`; });
  g += `<line x1="20" x2="420" y1="${gl}" y2="${gl}" stroke="#6b5b4b" stroke-width="1.5"/>`;
  g += `<rect x="150" y="${gl - r.I.e * s}" width="8" height="${(r.I.e + r.I.L) * s}" fill="#555"/>`;
  g += `<rect x="90" y="${gl - r.I.e * s - 6}" width="130" height="6" fill="#4B6378"/>${T(155, gl - r.I.e * s - 12, 'PV module / torque tube', {a:'middle', fs:9})}`;
  g += T(170, gl + r.I.L * s / 2, `L = ${r.I.L} m`, {fs:9.5}) + T(170, gl - r.I.e * s / 2, `e = ${r.I.e} m`, {fs:9.5});
  g += T(20, H - 10, `Allowable: C ${f1(r.res.Qall)} kN, T ${f1(r.res.Tall)} kN, H ${f1(r.res.Hall)} kN`, {fs:9.5});
  return SVGH(W, H, g);
}
function figTrench(){
  const r = R.CTR; if (!r) return ''; const I = r.I, W = 480, H = 220, s = 140 / I.dm, x0 = 150, gl = 40; let g = T(10, 16, 'Typical MV cable trench section', {b:1});
  g += `<line x1="20" x2="460" y1="${gl}" y2="${gl}" stroke="#6b5b4b"/><rect x="${x0}" y="${gl}" width="${I.wm * s}" height="${I.dm * s}" fill="#EFE7DA" stroke="#777"/>`;
  const sy = gl + (I.dm - I.bed - I.Dm / 1000 - I.sur) * s; g += `<rect x="${x0}" y="${sy}" width="${I.wm * s}" height="${(I.bed + I.Dm / 1000 + I.sur) * s}" fill="#F7EBC8"/>`;
  for (let k = 0; k < I.nm; k++){ const cx = x0 + (I.ec / 1000 + I.Dm / 2000 + k * (I.Dm + I.sm) / 1000) * s; g += `<circle cx="${cx}" cy="${gl + (I.dm - I.bed - I.Dm / 2000) * s}" r="${I.Dm / 2000 * s}" fill="#303030"/>`; }
  g += `<rect x="${x0}" y="${sy - 6}" width="${I.wm * s}" height="5" fill="#B0413E"/>${T(x0 + I.wm * s + 10, sy - 1, 'Protection slab / tape', {fs:9})}${T(x0 + I.wm * s + 10, gl + I.dm * s / 2, `Backfill`, {fs:9})}${T(x0 + I.wm * s + 10, sy + 20, 'Sand bedding & surround', {fs:9})}`;
  g += T(x0 + I.wm * s / 2, gl + I.dm * s + 16, `${I.wm} m wide × ${I.dm} m deep, ${I.nm} cables Ø${I.Dm} mm`, {a:'middle', fs:9.5});
  return SVGH(W, H, g);
}
function figBESS(){
  const r = R.BPL; if (!r) return ''; const I = r.I, W = 540, H = 330, s = Math.min((W - 60) / r.res.W, (H - 60) / r.res.L);
  let g = T(10, 16, `BESS platform layout — ${I.n} enclosures (${f0(r.res.W)} × ${f0(r.res.L)} m)`, {b:1}), x0 = 30, y0 = 30;
  g += `<rect x="${x0}" y="${y0}" width="${r.res.W * s}" height="${r.res.L * s}" fill="#F1EEF6" stroke="#5A4780"/>`;
  const cols = Math.ceil(Math.sqrt(I.n / 2)) * 2; let k = 0;
  for (let i = 0; k < I.n; i++) for (let j = 0; j < cols && k < I.n; j++, k++){ g += `<rect x="${x0 + (I.pw + j * (I.Wc + I.sx)) * s}" y="${y0 + (I.pw + i * (I.Lc + I.sy)) * s}" width="${I.Wc * s}" height="${I.Lc * s}" fill="#8A7FB0"/>`; }
  g += T(x0, H - 10, `Enclosure spacing ${I.sx} m side / ${I.sy} m end; perimeter road ${I.pw} m; RL ${f2(r.res.rl)} m — spacing subject to BOMBA`, {fs:9.5});
  return SVGH(W, H, g);
}
function figRetain(){
  const r = R.RTW; if (!r) return ''; const I = r.I, W = 460, H = 260, s = 180 / I.H, x0 = 120, yb = 220; let g = T(10, 16, 'RC cantilever retaining wall — section', {b:1});
  g += `<rect x="${x0}" y="${yb - I.tb * s}" width="${I.B * s}" height="${I.tb * s}" fill="#D6D1CB" stroke="#555"/><rect x="${x0 + I.tt * s}" y="${yb - I.H * s}" width="${I.ts * s}" height="${(I.H - I.tb) * s}" fill="#D6D1CB" stroke="#555"/>`;
  g += `<rect x="${x0 + (I.tt + I.ts) * s}" y="${yb - I.H * s}" width="${(I.B - I.tt - I.ts) * s + 60}" height="${(I.H - I.tb) * s}" fill="#EFE7DA" opacity="0.8"/>${T(x0 + I.B * s - 10, yb - I.H * s / 2, 'Retained fill', {fs:9})}`;
  g += T(x0 + I.B * s / 2, yb + 16, `B = ${I.B} m, H = ${I.H} m; FS_s ${f2(r.res.FSs)}, FS_o ${f2(r.res.FSo)}`, {a:'middle', fs:9.5});
  return SVGH(W, H, g);
}
function figIDF(){ const r = R.IDF; if (!r || !r.idf) return ''; const d = Object.assign({}, r.idf, {durs: [5,10,15,20,30,45,60,90,120,180]}); return lineChart({xs: d.durs, series: d.aris.map(a => ({name: a + '-yr', ys: d.durs.map(x => d.i(a, x))})), xl: 'Duration (min)', yl: 'Intensity (mm/hr)', title: 'IDF curves (DEMONSTRATION coefficients)', legend: true}); }
function figARI(){ const r = R.RAT; if (!r || !r.ari) return ''; return lineChart({xs: r.ari.map(a => a[0]), series: [{name:'Pre-development', ys: r.ari.map(a => a[1])}, {name:'Post-development', ys: r.ari.map(a => a[2])}], xl: 'ARI (years)', yl: 'Peak discharge (m³/s)', title: 'ARI vs design discharge (whole site)', legend: true}); }
function figCBR(){ const r = R.PAV; if (!r || !r.curve) return ''; return lineChart({xs: r.curve.map(c => c[0]), series: [{name:'Required thickness', ys: r.curve.map(c => c[1])}], xl:'Subgrade CBR (%)', yl:'Granular thickness (mm)', title:'CBR vs pavement thickness', hl: {y: r.I.tb + r.I.ts, label:'provided'}}); }
function figStageStorage(){ const r = R.DET; if (!r) return ''; const W = r.res.W, I = r.I; const hs = []; for (let h = 0; h <= I.H + I.Hs + I.fb + 1e-6; h += 0.25) hs.push(+h.toFixed(2)); return lineChart({xs: hs, series: [{name:'Storage', ys: hs.map(h => pondVol(W, I.r, I.z, h))}], xl:'Stage above pond invert (m)', yl:'Storage (m³)', title:'Detention pond stage–storage', hl: {y: r.res.Vreq, label:'V required'}}); }

const FIGS = {m8:[['DTM & platforms', figDEM], ['Slope distribution', figSlopeBands]], m12:[['Grading zones', figGrading]], m10:[['Soil profiles', figSoil]], m15:[['IDF curves', figIDF], ['Catchment schematic', figCatch], ['ARI vs discharge', figARI]], m16:[['Drain section', figDrain]], m18:[['Stage–storage', figStageStorage]], m21:[['Road section', figRoad], ['CBR vs thickness', figCBR]], m26:[['PV pile', figPile]], m30:[['Transformer foundation', () => figFdn('FDN_TX')]], m29:[['Inverter foundation', () => figFdn('FDN_INV')]], m34:[['Cable trench', figTrench]], m36:[['Retaining wall', figRetain]], m43:[['BESS platform', figBESS]], m31:[['BESS foundation', () => figFdn('BFDN')]]};

/* ==========================================================================
   REPORT MODEL
   ========================================================================== */
const ABBR = [['ARI','Average Recurrence Interval'],['BESS','Battery Energy Storage System'],['BOQ','Bill of Quantities'],['BOMBA','Jabatan Bomba dan Penyelamat Malaysia'],['CBR','California Bearing Ratio'],['C&S','Civil & Structural'],['DFL','Design Flood Level'],['DOE','Department of Environment (JAS)'],['DOSH','Department of Occupational Safety and Health (JKKP)'],['DTM','Digital Terrain Model'],['EC','Eurocode'],['EPC','Engineering, Procurement & Construction'],['ESCP','Erosion & Sediment Control Plan'],['FS','Factor of Safety'],['GDM2000','Geocentric Datum of Malaysia 2000'],['IDF','Intensity–Duration–Frequency'],['JKR','Jabatan Kerja Raya'],['JPS','Jabatan Pengairan dan Saliran (DID)'],['MSMA','Urban Stormwater Management Manual for Malaysia'],['NA','National Annex'],['OSD','On-Site Detention'],['PBT','Pihak Berkuasa Tempatan (Local Authority)'],['PCS','Power Conversion System'],['POI','Point of Interconnection'],['QTO','Quantity Take-Off'],['RL','Reduced Level'],['SI','Site Investigation'],['SLS','Serviceability Limit State'],['SPT','Standard Penetration Test'],['ST','Suruhanjaya Tenaga'],['TNB','Tenaga Nasional Berhad'],['ULS','Ultimate Limit State']];

function reportBlocks(opt){
  opt = Object.assign({calcSheets: true, appendices: true}, opt || {});
  const B = []; let ch = 0, sub = 0, sub3 = 0, tno = 0, fno = 0;
  const h1 = t => { ch++; sub = 0; tno = 0; fno = 0; B.push({t:'h1', num: ch + '.0', text: t.toUpperCase()}); };
  const h2 = t => { sub++; sub3 = 0; B.push({t:'h2', num: `${ch}.${sub}`, text: t}); };
  const h3 = t => { sub3++; B.push({t:'h3', num: `${ch}.${sub}.${sub3}`, text: t}); };
  const p = t => B.push({t:'p', text: t});
  const ul = items => { if (items.length) B.push({t:'ul', items}); };
  const tbl = (cap, head, rows, align) => { tno++; B.push({t:'table', num: `${ch}.${tno}`, cap, head, rows, align}); };
  const fig = (cap, svg) => { if (!svg) return; fno++; B.push({t:'fig', num: `${ch}.${fno}`, cap, svg}); };
  const info = P.info, cs = costSummary(), mi = missingInfo(), allC = Object.keys(R), fails = allC.filter(c => R[c].status === 'fail');
  const cen = (P.coords || []).find(c => /centroid/i.test(c.label));
  // front matter
  B.push({t:'cover'}); B.push({t:'doccontrol'}); B.push({t:'revhist'}); B.push({t:'toc'}); B.push({t:'lof'}); B.push({t:'lot'}); B.push({t:'abbr'});
  // 1 project information
  h1('Project Information');
  tbl('Project information', ['Item','Information'], [['Project', info.name], ['Project No.', info.number], ['Client', info.client], ['Developer', info.developer], ['EPC', info.epc], ['C&S Consultant', info.consultant], ['Location', info.location], ['State', info.state], ['District', info.district], ['Mukim', info.mukim], ['PBT', pbtName()], ['Lot', info.lot], ['Coordinates', cen ? `${(+cen.lat).toFixed(5)}° N, ${(+cen.lon).toFixed(5)}° E (${toDMS(+cen.lat,'N','S')}, ${toDMS(+cen.lon,'E','W')})` : '—'], ['Site Area', fmt(+info.landArea, 1) + ' ha'], ['Solar MWp', fmt(+info.mwp, 1)], ['Solar MWac', fmt(+info.mwac, 1)], ['BESS MW', P.type === 'B' ? fmt(+info.bessMW, 1) : 'Not applicable (Type A)'], ['BESS MWh', P.type === 'B' ? fmt(+info.bessMWh, 1) : 'Not applicable (Type A)'], ['Grid Voltage', info.gridV], ['Substation / POI', `${info.substation} / ${info.poi}`], ['Project Stage', info.stage], ['COD', info.cod], ['Project Type', P.type === 'B' ? 'Type B — Solar Farm + BESS' : 'Type A — Solar Farm']]);
  // 2 site location
  h1('Site Location'); p(`The site is located at ${info.location}, Mukim ${info.mukim}, Daerah ${info.district}, ${info.state}, within the jurisdiction of ${pbtName()}. The land area is ${fmt(+info.landArea, 1)} ha over ${info.lot}.`); fig('Key plan and principal features', figLayout());
  // 3 coordinates
  h1('Coordinates'); p('Coordinates are given in WGS84 geographic (EPSG:4326) with derived UTM projected coordinates. GDM2000 Peninsular RSO (EPSG:3375) coordinates shall be provided by the licensed land surveyor — no conversion is performed by the platform.');
  tbl('Key coordinates', ['Feature','Lat (DD)','Lon (DD)','Lat (DMS)','Lon (DMS)','UTM E','UTM N','Zone','Source'], (P.coords || []).map(c => { const u = toUTM(+c.lat, +c.lon); return [c.label, (+c.lat).toFixed(5), (+c.lon).toFixed(5), toDMS(+c.lat,'N','S'), toDMS(+c.lon,'E','W'), fmt(u.E, 1), fmt(u.N, 1), u.zone + 'N', c.src]; }), ['l','n','n','l','l','n','n','c','l']);
  // 4 executive summary
  h1('Executive Summary');
  h2('Project Overview'); p(`${info.name} is a ${fmt(+info.mwac, 0)} MWac / ${fmt(+info.mwp, 0)} MWp ground-mounted solar PV farm${P.type === 'B' ? ` with a ${fmt(+info.bessMW, 0)} MW / ${fmt(+info.bessMWh, 0)} MWh battery energy storage system` : ''}, connected at ${info.gridV} via ${info.substation}. This report presents the civil & structural tender engineering assessment at ${info.stage} stage.`);
  h3('Project Location'); p(`${info.location}, ${info.district}, ${info.state}${cen ? ` (centroid ${(+cen.lat).toFixed(5)}° N, ${(+cen.lon).toFixed(5)}° E)` : ''}; site area ${fmt(+info.landArea, 1)} ha.`);
  h2('Site Condition'); p(R.TOPO ? R.TOPO.notes.join(' ') : ''); p(R.GEO ? R.GEO.notes.slice(0, 3).join(' ') : '');
  h2('Principal Findings'); ul(allC.flatMap(c => R[c].notes.slice(0, 1).map(n => `${CALCS[c].title}: ${n}`)).slice(0, 14));
  h2('Proposed Solutions'); ul(allC.flatMap(c => R[c].prop).slice(0, 14));
  h2('Major Risks'); ul(RISKS.filter(r => r.level !== 'Low').slice(0, 8).map(r => `${r.id} ${r.title} (score ${r.score}): ${r.chain.join(' → ')}`));
  h2('Design Non-Compliances Requiring Action'); ul(fails.flatMap(c => R[c].checks.filter(k => !k.pass).map(k => `${CALCS[c].no}: ${k.msg}`)));
  h2('Missing Data'); ul([...Object.entries(mi.tags).map(([t, ws]) => `${WARN[t]} — ${ws.length} item(s)`), ...mi.docs.map(d => `${d.title} — ${d.status}`)]);
  h2('Tender Scope Gaps & Quantity Risks'); ul([...TENDER.gaps.map(g => `${g.name}: ${g.gap ? 'not priced' : 'partially priced'}`), ...TENDER.issues.filter(r => r.issues.some(i => /Under|Omitted/.test(i))).slice(0, 8).map(r => `${r.desc}: ${r.issues.join(', ')}`)]);
  h2('Commercial Exposure'); p(`Engineering estimate of C&S works: RM ${fmt(cs.total, 0)} (direct RM ${fmt(cs.direct, 0)}). Contractor quotation (reconciled items): RM ${fmt(TENDER.totT, 0)} against engineering-required RM ${fmt(TENDER.totReq, 0)} — variance RM ${fmt(TENDER.totT - TENDER.totReq, 0)} (${fmt((TENDER.totT / Math.max(TENDER.totReq, 1) - 1) * 100, 1)}%). Rates are demonstration values.`);
  h2('Authority Issues'); ul(AUTH_ROWS.filter(r => !r[4] || r[4] === P.type).slice(0, 10).map((r, i) => `${r[0]} — ${r[1]} (${(P.authority['A' + AUTH_ROWS.indexOf(r)] || {}).status || 'Not started'})`));
  h2('Immediate Actions'); ul(['Obtain official JPS IDF coefficients and design flood level.', 'Supplementary SI and pre-construction pile tests (compression / uplift / lateral) per geological zone.', 'Obtain certified vendor loads (tracker, inverter skid, transformer' + (P.type === 'B' ? ', BESS enclosures, fire-water demand' : '') + ').', 'Issue tender clarifications for scope gaps and quantity discrepancies.', 'Confirm governing design criteria with JPS / JKR / PBT / Client (Engineer confirmation).']);
  // 5–10
  h1('Project Description'); p(`The development comprises PV arrays on ${R.GRD ? R.GRD.I.sys.toLowerCase() : 'trackers'} supported on driven steel piles (${R.PVP ? fmt(R.PVP.res.npile, 0) : '—'} no.), inverter / MV skids, a ${info.gridV} intake substation, O&M building, internal roads (${R.RDQ ? fmt(R.RDQ.res.Lroad, 0) : '—'} m), drainage with detention, perimeter fencing${P.type === 'B' ? ', and a BESS compound with containment and fire-water civil works' : ''}.`);
  h1('Objective'); p('To establish the civil & structural engineering basis, verify the engineering adequacy of proposed works by calculation, quantify the works, reconcile the tender against engineering requirements, and identify design, authority and commercial risks prior to contract award.');
  h1('Scope'); ul(['Site, topographical and geotechnical assessment', 'Earthworks, grading, cut & fill and slopes', 'MSMA hydrology, drainage, culverts, detention, flood platform and ESCP', 'Roads, access, heavy transport and crane hardstanding', 'PV, equipment, substation' + (P.type === 'B' ? ', BESS' : '') + ' foundations and structural works', 'Cable trenches, services and ancillary civil works', 'QTO, BOQ, cost estimate, tender reconciliation and scope gap analysis', 'Design risk, constructability, authority compliance and standards register']);
  h1('Basis of Assessment'); p('All results are traceable Source → Input → Formula → Result → Report. Calculations are preliminary / screening level and shall be verified at detailed design. Input confidence is classified (Surveyed, Tested, Vendor Certified, Authority Data, Client Provided, Contractor Provided, Consultant Assumption, Estimated, Unknown). Where a clause cannot be confirmed it is marked CLAUSE VERIFICATION REQUIRED.'); if (P.sample) B.push({t:'demo'});
  h1('Information Reviewed'); tbl('Documents reviewed', ['Ref','Document','Category','From','Status'], (P.docs || []).map(d => [d.id, d.title, d.cat, d.from, d.status]));
  h1('Missing Information'); tbl('Outstanding information', ['Category','Item','Calculation'], allWarnings().filter(w => ['SI','TOPO','JPS','VENDOR','AUTH'].includes(w.tag)).map(w => [WARN[w.tag], w.text, CALCS[w.calc].no]));
  // 11 design basis
  h1('Design Basis'); tbl('Design basis summary', ['Parameter','Value','Source / confidence'], designBasisRows());
  tbl('Design criteria conflict — governing requirement (Engineer confirmation)', ['Criterion','MSMA','JKR','PBT','Client','Governing','Engineer'], (P.criteria || []).map(c => [c.item, c.msma, c.jkr, c.pbt, c.client, c.gov || '—', c.eng || 'Pending']));
  // 12 codes
  h1('Codes & Standards'); STD_GROUPS.forEach(g => { const ss = P.standards.filter(s => s.group === g && (!/SESB|SEB/.test(s.id) || true)); if (!ss.length) return; h2(g); tbl(g + ' references', ['Ref','Title','No.','Edition','Status','Clause'], ss.map(s => [s.id, s.title, s.number, s.edition, s.status, s.clause])); });
  h2('MSMA reference mapping'); tbl('MSMA requirement mapping', ['Topic','Source','Requirement','Applied in','Note'], MSMA_MAP.map(r => r.slice(0, 5)));
  // 13 authority
  h1('Authority Jurisdiction'); p(`Local authority (PBT): ${pbtName()}. State: ${info.state}. The following authorities have jurisdiction over the C&S works.`); tbl('Authority jurisdiction', ['Authority','Requirement','Stage','Reference'], AUTH_ROWS.filter(r => !r[4] || r[4] === P.type).map(r => r.slice(0, 4)));
  // 14 site constraints
  h1('Site Constraints'); tbl('Site constraint assessment', ['Category','Constraint','Rating','Notes'], SITE_ITEMS.map(s => [s[1], s[2], (P.site[s[0]] || {}).rating || '—', (P.site[s[0]] || {}).note || '']));
  // technical chapters
  REPORT_TECH.forEach(([n, title, mods, ty]) => { if (ty && ty !== P.type) return; techChapter(title, mods, {h1, h2, h3, p, ul, tbl, fig}); });
  // constructability
  h1('Constructability'); ul(constructItems().map(c => `${c.t}: ${c.flag ? 'FLAG — ' : ''}${c.note}`));
  // QTO
  h1('Quantity Take-Off'); p('Quantities are generated automatically from calculation results; each quantity is traceable to the originating calculation.'); tbl('Quantity take-off', ['Item','Description','Unit','Quantity','Calculation reference'], boqRows().map(r => [r.key, r.desc, r.unit, fmt(r.qty, r.qty < 100 ? 2 : 0), r.calcs]), ['l','l','c','n','l']);
  // BOQ
  h1('BOQ'); const br = boqRows(); tbl('Bill of Quantities (demonstration rates)', ['Item','Description','Unit','Qty','Rate (RM)','Amount (RM)','Calc ref','Dwg ref','Confidence'], br.map(r => [r.key, r.desc, r.unit, fmt(r.qty, r.qty < 100 ? 2 : 0), fmt(r.rate, 2), fmt(r.amount, 0), r.calcs, r.dwg, r.conf]), ['l','l','c','n','n','n','l','l','c']);
  tbl('Cost summary', ['Component','Amount (RM)'], [...Object.entries(cs.bills).map(([b, v]) => [b, fmt(v, 0)]), ['Direct cost', fmt(cs.direct, 0)], [`Preliminaries (${P.costCfg.prelimPct}%)`, fmt(cs.prelim, 0)], [`Design (${P.costCfg.designPct}%)`, fmt(cs.design, 0)], [`Contingency (${P.costCfg.contPct}%)`, fmt(cs.cont, 0)], ['TOTAL', fmt(cs.total, 0)]], ['l','n']);
  // tender recon
  h1('Tender Reconciliation'); tbl('Tender reconciliation', ['Item','Required Qty','Tender Qty','Difference','Required Scope','Tender Scope','Rate (T)','Variance (RM)','Issues'], TENDER.rows.map(r => [r.desc, fmt(r.rq, 0), fmt(r.tq, 0), fmt(r.diff, 0), r.rscope, r.tscope, fmt(r.trate, 2), fmt(r.variance, 0), r.issues.join(', ') || 'OK']), ['l','n','n','n','l','l','n','n','l']);
  tbl('Scope gap analysis', ['Scope area','Required','Priced','Status'], TENDER.gaps.map(g => [g.name, 'Yes', g.priced ? 'Partial' : 'No', g.gap ? 'GAP — not priced' : 'PARTIAL']));
  // risk
  h1('Design Risk'); tbl('Design risk register (Technical → Construction → Cost → Programme)', ['ID','Issue','Construction','Cost','Programme','L','C','Score','Mitigation'], RISKS.map(r => [r.id, r.title, r.chain[1], r.chain[2], r.chain[3], r.L, r.C, r.score, r.mit]), ['l','l','l','l','l','c','c','c','l']);
  // authority compliance
  h1('Authority Compliance'); tbl('Authority compliance matrix', ['Authority','Requirement','Stage','Status','Responsible'], AUTH_ROWS.map((r, i) => [r, i]).filter(([r]) => !r[4] || r[4] === P.type).map(([r, i]) => [r[0], r[1], r[2], (P.authority['A' + i] || {}).status || '—', (P.authority['A' + i] || {}).resp || '—']));
  // clarifications
  h1('Tender Clarifications'); tbl('Tender clarifications', ['Ref','Subject','Clarification','Category'], [...autoClarifications(), ...(P.reg.clarifications || []).map(c => ({id:c.id, ref:c.ref, q:c.q, cat:c.cat || 'User'}))].map(c => [c.id, c.ref, c.q, c.cat]));
  // recommendations / conclusion
  h1('Recommendations'); ul([...MODULES.filter(m => m.tech && modApplies(m)).flatMap(m => m.rec || []), ...fails.flatMap(c => R[c].checks.filter(k => !k.pass).map(k => `${CALCS[c].no}: ${k.fix || 'Revise design.'}`))]);
  h1('Conclusion'); p(`${allC.length} calculations were executed: ${allC.filter(c => R[c].status === 'pass').length} compliant, ${fails.length} with non-compliances requiring design revision, and ${allC.filter(c => R[c].status === 'info').length} quantity / information calculations. The engineering estimate of C&S works is RM ${fmt(cs.total, 0)}. ${TENDER.gaps.length} scope gap(s) and ${TENDER.issues.length} tender line issue(s) were identified and should be resolved through tender clarifications. The design remains subject to the outstanding information listed in Chapter "Missing Information", in particular official JPS data, supplementary SI and certified vendor loads.`);
  // appendices
  if (opt.appendices){
    h1('Appendices'); ul(['Appendix A — Full calculation sheets', 'Appendix B — Drawing register', 'Appendix C — Registers (assumptions, queries, deliverables)']);
    if (opt.calcSheets){ h1('Full Calculation Sheets'); allC.forEach(c => B.push({t:'calc', id:c})); }
    h1('Drawings'); tbl('Drawing register (required drawings)', ['No.','Title','Discipline','Rev','Status'], (P.reg.drawings || []).map(d => [d.no, d.title, d.disc, d.rev, d.status]));
    h1('Registers'); h2('Assumption register'); tbl('Assumptions', ['Source','Assumption','Type'], [...autoAssumptions().map(a => [a.src, a.text, a.type]), ...(P.reg.assumptions || []).map(a => [a.mod || 'User', a.text, a.type || 'User'])]);
    h2('Engineering query register'); tbl('Engineering queries', ['ID','To','Subject','Status'], (P.reg.queries || []).map(q => [q.id, q.to, q.subject, q.status]));
    h2('Deliverables'); tbl('Deliverables', ['Deliverable','Stage','Status'], (P.reg.deliverables || []).map(d => [d.title, d.stage, d.status]));
  }
  return B;
}
function designBasisRows(){
  const rw = []; const add = (cid, k, label) => { const r = R[cid]; if (!r) return; const d = CALCS[cid].inputs.find(x => x.k === k); if (!d) return; const m = r.meta[k] || {}; rw.push([label || d.l, `${isNum(r.I[k]) ? fmt(r.I[k]) : r.I[k]} ${d.u || ''}`, `${inputConf(cid, d, m.linked)}${inputSrc(cid, d, m) ? ' — ' + inputSrc(cid, d, m) : ''}`]); };
  add('WND','vb0'); add('WND','terr','Terrain category'); add('LCB','gGs'); add('LCB','gQ'); add('IDF','Tmin'); add('IDF','Tmaj'); add('IDF','Tdet'); add('IDF','lam'); add('FPL','dfl'); add('FPL','fbSS'); if (P.type === 'B') add('FPL','fbB');
  add('PVP','FSc'); add('PVP','FSt'); add('PVP','FSh'); add('BRG','FS','Bearing FS'); add('SLP','FSreq'); add('PAV','Pa'); add('CF','sf'); add('EWB','bf'); add('SET','lim');
  return rw;
}
function techChapter(title, mods, f){
  const ms = mods.map(id => MOD[id]).filter(m => m && modApplies(m)); const cs = [...new Set(ms.flatMap(m => (m.calcs || []).filter(calcApplies)))]; const rs = cs.map(c => R[c]).filter(Boolean);
  f.h1(title);
  f.h2('Objective'); f.p(ms.map(m => m.ov).join(' '));
  f.h2('Available Information'); const docs = (P.docs || []).filter(d => mods.includes(d.mod)); f.ul(docs.length ? docs.map(d => `${d.id} ${d.title} — ${d.status}`) : ms.flatMap(m => m.avail || []));
  f.h2('Design Criteria'); f.ul([...new Set(cs.flatMap(c => CALCS[c].criteria).concat(ms.flatMap(m => m.crit || [])))]);
  f.h2('Standards'); f.ul([...new Set(cs.flatMap(c => CALCS[c].codes))].map(id => stdTitle(id) + ' — ' + CVR));
  f.h2('Inputs'); if (cs.length) f.tbl(title + ' — key inputs', ['Calc','Parameter','Value','Unit','Confidence'], cs.flatMap(c => CALCS[c].inputs.filter(d => d.k && d.t !== 'x').slice(0, 9).map(d => { const m = R[c].meta[d.k] || {}; const v = R[c].I[d.k]; return [CALCS[c].no, `${d.l}${d.sym ? ' (' + d.sym + ')' : ''}`, isNum(v) ? fmt(v) : String(v), d.u || '', inputConf(c, d, m.linked)]; })), ['l','l','n','c','l']);
  if (ms.some(m => m.id === 'm10')) f.tbl('Borehole summary', ['BH','RL','Depth','GWL','pH','Resistivity'], (P.tables.bh || []).map(b => [b.id, f2(b.rl), f1(b.depth), f1(b.gwl), f1(b.ph), f0(b.res)]));
  f.h2('Assumptions'); f.ul(cs.flatMap(c => CALCS[c].assume));
  f.h2('Proposed Works'); f.ul(rs.flatMap(r => r.prop));
  f.h2('Calculation Method'); f.ul(cs.map(c => `${CALCS[c].no} ${CALCS[c].title}: ${CALCS[c].purpose}`));
  f.h2('Detailed Calculation'); rs.forEach((r, i) => { const eq = r.steps.filter(s => s.t === 'e' && s.val != null).slice(0, 10); if (eq.length) f.tbl(`${CALCS[cs[i]].no} — principal calculation steps (full sheet in appendix)`, ['Symbol','Description','Equation','Substitution','Result'], eq.map(s => [s.sym, s.desc || '', s.formula || '', s.subst || '', `${fmt(s.val, s.dp)} ${s.unit || ''}`]), ['l','l','l','l','n']); });
  ms.forEach(m => (FIGS[m.id] || []).forEach(([cap, fn]) => { try { f.fig(cap, fn()); } catch(e){} }));
  f.h2('Results'); if (rs.length) f.tbl(title + ' — results', ['Calc','Result','Value','Unit'], rs.flatMap((r, i) => r.resList.map(x => [CALCS[cs[i]].no, x.label, fmt(x.val, x.dp), x.unit || ''])), ['l','l','n','c']);
  f.h2('Compliance Check'); const ch = rs.flatMap((r, i) => r.checks.map(k => [CALCS[cs[i]].no, k.label, `${fmt(k.val, k.dp == null ? 2 : k.dp)} ${k.unit || ''}`, `${k.rel === '<=' ? '≤' : '≥'} ${fmt(k.lim, k.dp == null ? 2 : k.dp)}`, k.pass ? 'PASS' : 'FAIL']));
  if (ch.length) f.tbl(title + ' — engineering checks', ['Calc','Check','Value','Limit','Result'], ch, ['l','l','n','n','c']); else f.p('No numerical code checks in this chapter.');
  rs.forEach(r => r.checks.filter(k => !k.pass).forEach(k => f.p(k.msg)));
  f.h2('Sensitivity'); const sens = ms.flatMap(m => m.sens || []).filter(s => calcApplies(s.calc));
  if (sens.length) sens.forEach(s => { const ys = sensitivity(s.calc, s.key, s.vals, s.out.map(o => o[0])); f.fig(`Sensitivity — ${s.yl} vs ${s.xl}`, lineChart({xs: s.vals, series: s.out.map((o, j) => ({name:o[1], ys: ys.map(r => r[j])})), xl: s.xl, yl: s.yl, hl: s.hl ? s.hl(R) : null, legend: true})); });
  else f.p('Sensitivity not critical for this chapter at tender stage.');
  f.h2('Risk'); const rk = RISKS.filter(r => mods.includes(r.mod)); f.ul(rk.map(r => `${r.id} ${r.title}: ${r.chain.join(' → ')} (L${r.L} × C${r.C} = ${r.score}).`).concat(rs.flatMap(r => r.warns.map(w => `${WARN[w.tag]}: ${w.text}`))).slice(0, 14));
  f.h2('Quantity'); const qs = rs.flatMap((r, i) => r.qty.map(q => [BOQ_LIB[q.key].desc, BOQ_LIB[q.key].unit, fmt(q.qty, q.qty < 100 ? 2 : 0), CALCS[cs[i]].no])); if (qs.length) f.tbl(title + ' — quantities', ['Item','Unit','Quantity','Calc'], qs, ['l','c','n','l']); else f.p('No direct BOQ quantities.');
  f.h2('Tender Impact'); const keys = rs.flatMap(r => r.qty.map(q => q.key)); const ti = TENDER.rows.filter(r => keys.includes(r.key) && r.issues.length);
  f.ul([...rs.flatMap(r => r.tender), ...ti.map(r => `${r.desc}: ${r.issues.join(', ')} (required ${fmt(r.rq, 0)} ${r.unit}, tender ${fmt(r.tq, 0)} ${r.unit}).`)]);
  if (!ti.length && !rs.some(r => r.tender.length)) f.p('Tender quantities for this chapter are consistent with engineering requirements (±10%).');
  f.h2('Recommendation'); f.ul([...ms.flatMap(m => m.rec || []), ...rs.flatMap(r => r.checks.filter(k => !k.pass).map(k => k.fix || 'Revise design.'))]);
  f.h2('Conclusion'); const nf = rs.filter(r => r.status === 'fail').length;
  f.p(nf ? `${nf} of ${rs.length} calculations in this chapter show non-compliance that must be resolved before design freeze; the remaining calculations satisfy the adopted criteria at screening level.` : `All ${rs.length} calculation(s) in this chapter satisfy the adopted criteria at screening level, subject to the outstanding information and verification noted.`);
}
function constructItems(){
  const g = R.GEO ? R.GEO.res : {};
  return [
    {t:'Pile installation', flag: g.hardDepth != null && R.PVP && g.hardDepth < R.PVP.I.L + 1, note: g.hardDepth != null ? `Hard stratum from ${f1(g.hardDepth)} m bgl — driving trials and pre-drilling contingency.` : 'No hard stratum identified.'},
    {t:'Groundwater', flag: g.gwlMin < 1.5, note: `Shallowest groundwater ${f1(g.gwlMin)} m bgl — excavation dewatering and wet-season sequencing.`},
    {t:'Soft ground trafficability', flag: g.softTop > 0, note: `${g.softTop || 0} borehole(s) with soft clay near surface — haul roads and working platforms required early.`},
    {t:'Earthworks balance', flag: R.EWB && R.EWB.res.importV > 10000, note: R.EWB ? `Import ${fmt(R.EWB.res.importV, 0)} m³; disposal ${fmt(R.EWB.res.disposal, 0)} m³.` : ''},
    {t:'Heavy transport', flag: R.HVY && R.HVY.status === 'fail', note: R.HVY ? R.HVY.notes.join(' ') : ''},
    {t:'Piling productivity', flag: false, note: R.LOG ? R.LOG.notes.join(' ') : ''},
    {t:'Temporary works', flag: R.TMP && R.TMP.warns.length > 0, note: R.TMP && R.TMP.warns.length ? R.TMP.warns[0].text : 'No deep excavations identified.'},
    {t:'Drainage during construction', flag: true, note: R.ESC ? R.ESC.notes.join(' ') : ''},
  ].concat(Object.entries(P.constructability || {}).map(([k, v]) => ({t: k, flag: !!v.flag, note: v.note || ''})));
}
function pbtName(){ return P.info.pbt || (PBT_DB[`${P.info.state}|${P.info.district}`] || {}).pbt || 'PBT to be confirmed'; }
function chapterPreview(m){
  const B = []; const n = {ch: 0};
  const f = {h1: t => B.push(`<h1>${esc(t.toUpperCase())}</h1>`), h2: t => B.push(`<h2>${esc(t)}</h2>`), h3: t => B.push(`<h3>${esc(t)}</h3>`), p: t => B.push(`<p>${esc(t)}</p>`), ul: it => { if (it.length) B.push('<ul>' + it.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'); },
    tbl: (cap, head, rows, al) => B.push(`<div class="cap">${esc(cap)}</div>` + htmlTable(head, rows, al)), fig: (cap, svg) => { if (svg) B.push(`<div class="fig">${svg}<div class="cap" style="text-align:center">${esc(cap)}</div></div>`); }};
  try { techChapter(m.name, [m.id], f); } catch(e){ B.push('<p>Preview unavailable: ' + esc(e.message) + '</p>'); }
  return B.join('');
}
function htmlTable(head, rows, al){ return `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${al && al[i] === 'n' ? 'n' : al && al[i] === 'c' ? 'c' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }

/* ---------- calculation sheet model (shared by HTML & DOCX) ---------- */
function calcSheetModel(cid){
  const c = CALCS[cid], r = R[cid], m = P.calcMeta[cid] || {};
  const last = (m.revs || []).slice(-1)[0];
  return {c, r, hdr: [['Project', P.info.name], ['Calculation Title', c.title], ['Calculation No.', c.no], ['Revision', calcRev(cid) + (calcModified(cid) ? ' (modified since issue)' : '')], ['Date', last ? last.date : today()], ['Prepared', last ? last.by : P.user + ' (' + P.role + ')'], ['Checked', m.checkedBy || '—']],
    inputs: c.inputs.filter(d => d.k).map(d => { const mm = r.meta[d.k] || {}; const v = r.I[d.k]; return [d.sym || '', d.l, isNum(v) ? fmt(v) : String(v), d.u || '', inputSrc(cid, d, mm) || '—', inputConf(cid, d, mm.linked)]; }),
    forms: [...new Set(r.steps.filter(s => s.t === 'e' && s.formula).map(s => `${s.sym}: ${s.formula}`))]};
}
function calcSheetHTML(cid){
  const s = calcSheetModel(cid), r = s.r;
  let h = `<table class="calchdr"><tbody>${s.hdr.map(([k, v]) => `<tr><th style="width:32%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
  if (P.sample) h += `<div class="demo-flag">${DEMO_FLAG}</div>`;
  h += `<h3>Section 1 — Purpose</h3><p>${esc(s.c.purpose)}</p>`;
  h += `<h3>Section 2 — Input</h3>` + htmlTable(['Symbol','Parameter','Value','Unit','Source','Confidence'], s.inputs, ['l','l','n','c','l','l']);
  h += `<h3>Section 3 — Assumptions</h3><ul>${s.c.assume.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`;
  h += `<h3>Section 4 — Codes / Standards</h3><ul>${s.c.codes.map(x => `<li>${esc(stdTitle(x))} — ${CVR}</li>`).join('')}</ul>`;
  h += `<h3>Section 5 — Formula</h3><div class="calcs">${s.forms.map(f => `<div>${esc(f)}</div>`).join('')}</div>`;
  h += `<h3>Section 6 — Detailed Calculation</h3><div class="calcs">${r.steps.map(st => {
    if (st.t === 'h') return `<div style="font-weight:700;margin-top:6pt">${esc(st.title)}</div>`;
    if (st.t === 'x') return `<div>${esc(st.text)}</div>`;
    if (st.t === 'tb') return `<div class="cap">${esc(st.title)}</div>` + htmlTable(st.head, st.rows);
    if (st.t === 'c') return `<div class="${st.chk.pass ? 'pass' : 'fail'}">Check — ${esc(st.chk.label)}: ${st.chk.pass ? 'PASS' : 'FAIL'}</div>`;
    return `<div class="eqr"><div><b><i>${esc(st.sym)}</i></b> ${esc(st.desc || '')}<br>${esc(st.formula || '')}${st.subst ? `<div class="s">= ${esc(st.subst)}</div>` : ''}${st.ref ? `<div class="ref">${esc(st.ref)}</div>` : ''}</div><div class="r">${st.val == null ? '' : fmt(st.val, st.dp) + ' ' + esc(st.unit || '')}</div></div>`; }).join('')}</div>`;
  h += `<h3>Section 7 — Results</h3>` + htmlTable(['Result','Value','Unit'], r.resList.map(x => [x.label, fmt(x.val, x.dp), x.unit || '']), ['l','n','c']);
  h += `<h3>Section 8 — Compliance</h3>` + (r.checks.length ? htmlTable(['Check','Value','Limit','Utilisation','Result'], r.checks.map(k => [k.label, `${fmt(k.val, k.dp == null ? 2 : k.dp)} ${k.unit || ''}`, `${k.rel === '<=' ? '≤' : '≥'} ${fmt(k.lim, k.dp == null ? 2 : k.dp)}`, fmt(k.util, 2), k.pass ? 'PASS' : 'FAIL']), ['l','n','n','n','c']) + r.checks.map(k => `<p class="${k.pass ? '' : 'fail'}" style="font-size:10pt">${esc(k.msg)}</p>`).join('') : '<p>No code checks.</p>');
  h += `<h3>Section 9 — Engineering Interpretation</h3><ul>${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}${r.warns.map(w => `<li><b>${esc(WARN[w.tag])}</b> — ${esc(w.text)}</li>`).join('')}</ul>`;
  h += `<h3>Section 10 — Conclusion</h3><p>${esc(r.status === 'fail' ? 'NOT COMPLIANT — ' + r.checks.filter(k => !k.pass).map(k => k.label).join('; ') + '. Design revision required.' : r.status === 'pass' ? 'All checks satisfied at screening level, subject to verification of inputs marked Estimated / Unknown and clause references.' : 'Quantity / information calculation — results carried to QTO and report.')} ${esc(r.prop.join(' '))}</p>`;
  return h;
}

/* ---------- HTML report ---------- */
function reportHTML(opt){
  const B = reportBlocks(opt), figs = B.filter(b => b.t === 'fig'), tbls = B.filter(b => b.t === 'table'), heads = B.filter(b => b.t === 'h1' || b.t === 'h2');
  const info = P.info; let pages = [], cur = [];
  const flush = () => { if (cur.length) pages.push(cur.join('')); cur = []; };
  B.forEach(b => {
    switch (b.t){
      case 'cover': cur.push(`<div class="cover"><div class="band"></div><div class="small" style="color:#9E6035;font-weight:700;letter-spacing:1pt">CIVIL &amp; STRUCTURAL TENDER ENGINEERING REPORT</div><div class="t1">${esc(info.name)}</div><div class="t2">${P.type === 'B' ? 'Solar Farm + Battery Energy Storage System (Type B)' : 'Solar Farm (Type A)'}<br>${esc(info.location)}, ${esc(info.district)}, ${esc(info.state)}</div>
        <table style="width:70%"><tbody>${[['Project No.', info.number], ['Client', info.client], ['Prepared by', info.consultant], ['Document No.', (P.reg.reports[0] || {}).no || 'RPT-CS-001'], ['Revision', (P.reg.reports[0] || {}).rev || 'P0'], ['Date', today()]].map(([k, v]) => `<tr><th style="width:35%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
        ${P.sample ? `<div class="demo-flag" style="margin-top:30pt">${DEMO_FLAG}</div>` : ''}<div style="flex:1"></div><p class="small" style="font-size:9pt;text-align:left">All results are preliminary / screening-level engineering calculations for tender purposes and shall be verified at detailed design. Clause references marked "${CVR}" have not been confirmed.</p></div>`); flush(); break;
      case 'doccontrol': cur.push(`<h1>DOCUMENT CONTROL</h1>` + htmlTable(['Role','Name','Signature / Date'], [['Prepared', info.prepared || P.user, ''], ['Checked', info.checked || '', ''], ['Approved (PE / PEPC)', info.approved || '', '']])); break;
      case 'revhist': cur.push(`<h2 style="margin-top:18pt">REVISION HISTORY</h2>` + htmlTable(['Rev','Date','Description','By'], (P.revisions || []).map(r => [r.rev, r.date, r.desc, r.by]))); flush(); break;
      case 'toc': cur.push(`<h1>TABLE OF CONTENTS</h1><div class="toc">${heads.map(h => `<div class="${h.t === 'h2' ? 'l2' : ''}"><span>${esc(h.num)}&nbsp;&nbsp;${esc(h.text)}</span></div>`).join('')}</div>`); flush(); break;
      case 'lof': cur.push(`<h1>LIST OF FIGURES</h1><div class="toc">${figs.map(f => `<div><span>Figure ${esc(f.num)}&nbsp;&nbsp;${esc(f.cap)}</span></div>`).join('')}</div>`); break;
      case 'lot': cur.push(`<h1 style="margin-top:18pt">LIST OF TABLES</h1><div class="toc">${tbls.map(t => `<div><span>Table ${esc(t.num)}&nbsp;&nbsp;${esc(t.cap)}</span></div>`).join('')}</div>`); flush(); break;
      case 'abbr': cur.push(`<h1>ABBREVIATIONS</h1>` + htmlTable(['Abbreviation','Meaning'], ABBR)); flush(); break;
      case 'h1': flush(); cur.push(`<h1>${esc(b.num)}&nbsp;&nbsp;${esc(b.text)}</h1>`); break;
      case 'h2': cur.push(`<h2>${esc(b.num)}&nbsp;&nbsp;${esc(b.text)}</h2>`); break;
      case 'h3': cur.push(`<h3>${esc(b.num)}&nbsp;&nbsp;${esc(b.text)}</h3>`); break;
      case 'p': cur.push(`<p>${esc(b.text)}</p>`); break;
      case 'demo': cur.push(`<div class="demo-flag">${DEMO_FLAG}</div>`); break;
      case 'ul': cur.push('<ul>' + b.items.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'); break;
      case 'table': cur.push(`<div class="cap">Table ${esc(b.num)}: ${esc(b.cap)}</div>` + htmlTable(b.head, b.rows, b.align)); break;
      case 'fig': cur.push(`<div class="fig">${b.svg}<div class="cap" style="text-align:center">Figure ${esc(b.num)}: ${esc(b.cap)}</div></div>`); break;
      case 'calc': flush(); cur.push(`<h2>${esc(CALCS[b.id].no)} — ${esc(CALCS[b.id].title)}</h2>` + calcSheetHTML(b.id)); flush(); break;
    }
  });
  flush();
  return `<div class="report-body">${pages.map(pg => `<div class="rpage">${pg}</div>`).join('')}</div>`;
}

/* ==========================================================================
   DOCX EXPORT (WordprocessingML, zipped client-side)
   ========================================================================== */
const xe = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const wr = (t, o) => { o = o || {}; return `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}${o.c ? `<w:color w:val="${o.c}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xe(t)}</w:t></w:r>`; };
const wp = (runs, o) => { o = o || {}; return `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.pb ? '<w:pageBreakBefore/>' : ''}${o.keep ? '<w:keepNext/>' : ''}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}${o.num ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>` : ''}</w:pPr>${runs}</w:p>`; };
function wtable(head, rows, al, widthsPct){
  const n = head.length, tw = 9355, cw = Math.floor(tw / n);
  const cell = (t, i, hdr) => `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/>${hdr ? '<w:shd w:val="clear" w:color="auto" w:fill="F8E5D5"/>' : ''}</w:tcPr><w:p><w:pPr><w:pStyle w:val="TableText"/><w:jc w:val="${al && al[i] === 'n' ? 'right' : al && al[i] === 'c' ? 'center' : 'left'}"/></w:pPr>${wr(t, {b: hdr})}</w:p></w:tc>`;
  return `<w:tbl><w:tblPr><w:tblStyle w:val="EngTable"/><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="autofit"/></w:tblPr><w:tblGrid>${head.map(() => `<w:gridCol w:w="${cw}"/>`).join('')}</w:tblGrid>
    <w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${head.map((h, i) => cell(h, i, true)).join('')}</w:tr>${rows.map(r => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => cell(c, i, false)).join('')}</w:tr>`).join('')}</w:tbl>${wp('', {style:'TableGap'})}`;
}
function svgToPng(svg, scale){
  return new Promise(res => {
    try {
      const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const w = m ? +m[1] : 520, h = m ? +m[2] : 250; scale = scale || 2;
      const s2 = svg.includes('width=') ? svg : svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
      const img = new Image(); img.onload = () => { try { const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale; const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(b => { if (!b) return res(null); b.arrayBuffer().then(ab => res({data: new Uint8Array(ab), w, h})); }, 'image/png'); } catch(e){ res(null); } };
      img.onerror = () => res(null); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s2);
    } catch(e){ res(null); }
  });
}
function wimage(rid, id, w, h, name){
  const maxW = 15.9, cmW = Math.min(maxW, w * 0.0264 * 1.25), emuW = Math.round(cmW * 360000), emuH = Math.round(emuW * h / w);
  return `<w:p><w:pPr><w:jc w:val="center"/><w:keepNext/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emuW}" cy="${emuH}"/><wp:docPr id="${id}" name="${xe(name)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${xe(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}
const fld = (instr, placeholder) => `<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${xe(placeholder || '')}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
async function exportDocx(opt){
  const B = reportBlocks(opt), info = P.info; const media = []; let body = '', img = 0;
  for (const b of B){
    switch (b.t){
      case 'cover':
        body += wp(wr('CIVIL & STRUCTURAL TENDER ENGINEERING REPORT', {b:1, c:'9E6035', sz:20})) + wp(wr(info.name), {style:'Title'}) + wp(wr((P.type === 'B' ? 'Solar Farm + BESS (Type B)' : 'Solar Farm (Type A)') + ' — ' + info.location + ', ' + info.district + ', ' + info.state, {sz:28, c:'9E6035'}));
        body += wtable(['Item','Detail'], [['Project No.', info.number], ['Client', info.client], ['Prepared by', info.consultant], ['Document No.', (P.reg.reports[0] || {}).no || 'RPT-CS-001'], ['Revision', (P.reg.reports[0] || {}).rev || 'P0'], ['Date', today()]]);
        if (P.sample) body += wp(wr(DEMO_FLAG, {b:1, c:'9E6035'}), {jc:'center'});
        body += wp(wr(`All results are preliminary / screening-level engineering calculations for tender purposes. Clause references marked "${CVR}" have not been confirmed.`, {sz:18})); break;
      case 'doccontrol': body += wp(wr('DOCUMENT CONTROL'), {style:'TitleFront', pb:1}) + wtable(['Role','Name','Signature / Date'], [['Prepared', info.prepared || P.user, ''], ['Checked', info.checked || '', ''], ['Approved (PE / PEPC)', info.approved || '', '']]); break;
      case 'revhist': body += wp(wr('REVISION HISTORY'), {style:'TitleFront'}) + wtable(['Rev','Date','Description','By'], (P.revisions || []).map(r => [r.rev, r.date, r.desc, r.by])); break;
      case 'toc': body += wp(wr('TABLE OF CONTENTS'), {style:'TitleFront', pb:1}) + `<w:p>${fld('TOC \\o "1-3" \\h \\z \\u', 'Right-click → Update Field to build the table of contents.')}</w:p>`; break;
      case 'lof': body += wp(wr('LIST OF FIGURES'), {style:'TitleFront', pb:1}) + `<w:p>${fld('TOC \\h \\z \\c "Figure"', 'Update field to build list of figures.')}</w:p>`; break;
      case 'lot': body += wp(wr('LIST OF TABLES'), {style:'TitleFront'}) + `<w:p>${fld('TOC \\h \\z \\c "Table"', 'Update field to build list of tables.')}</w:p>`; break;
      case 'abbr': body += wp(wr('ABBREVIATIONS'), {style:'TitleFront', pb:1}) + wtable(['Abbreviation','Meaning'], ABBR); break;
      case 'h1': body += wp(wr(`${b.num}  ${b.text}`), {style:'Heading1', pb:1}); break;
      case 'h2': body += wp(wr(`${b.num}  ${b.text}`), {style:'Heading2'}); break;
      case 'h3': body += wp(wr(`${b.num}  ${b.text}`), {style:'Heading3'}); break;
      case 'p': body += wp(wr(b.text)); break;
      case 'demo': body += wp(wr(DEMO_FLAG, {b:1, c:'9E6035'}), {jc:'center'}); break;
      case 'ul': b.items.forEach(x => body += wp(wr(x), {style:'ListBullet', num:1})); break;
      case 'table': { const [c1, c2] = b.num.split('.'); body += `<w:p><w:pPr><w:pStyle w:val="Caption"/><w:keepNext/></w:pPr>${wr('Table ')}${fld(`SEQ Table \\* ARABIC`, `${b.num}`)}${wr(': ' + b.cap)}</w:p>` + wtable(b.head, b.rows, b.align); break; }
      case 'fig': { const png = await svgToPng(b.svg, 1.5); if (png){ img++; const rid = 'rIdImg' + img; media.push({name: `media/fig${img}.png`, data: png.data, rid}); body += wimage(rid, img, png.w, png.h, 'Figure ' + b.num); } else body += wp(wr('[Figure could not be rendered in this browser]', {i:1}));
        body += `<w:p><w:pPr><w:pStyle w:val="Caption"/><w:jc w:val="center"/></w:pPr>${wr('Figure ')}${fld('SEQ Figure \\* ARABIC', b.num)}${wr(': ' + b.cap)}</w:p>`; break; }
      case 'calc': { const s = calcSheetModel(b.id), r = s.r;
        body += wp(wr(`${s.c.no} — ${s.c.title}`), {style:'Heading2', pb:1}) + wtable(['Field','Detail'], s.hdr);
        if (P.sample) body += wp(wr(DEMO_FLAG, {b:1, c:'9E6035'}), {jc:'center'});
        body += wp(wr('Section 1 — Purpose'), {style:'Heading3'}) + wp(wr(s.c.purpose));
        body += wp(wr('Section 2 — Input'), {style:'Heading3'}) + wtable(['Symbol','Parameter','Value','Unit','Source','Confidence'], s.inputs, ['l','l','n','c','l','l']);
        body += wp(wr('Section 3 — Assumptions'), {style:'Heading3'}); s.c.assume.forEach(a => body += wp(wr(a), {style:'ListBullet', num:1}));
        body += wp(wr('Section 4 — Codes / Standards'), {style:'Heading3'}); s.c.codes.forEach(x => body += wp(wr(stdTitle(x) + ' — ' + CVR), {style:'ListBullet', num:1}));
        body += wp(wr('Section 5 — Formula'), {style:'Heading3'}); s.forms.forEach(f => body += wp(wr(f), {style:'CalcText'}));
        body += wp(wr('Section 6 — Detailed Calculation'), {style:'Heading3'});
        r.steps.forEach(st => { if (st.t === 'h') body += wp(wr(st.title, {b:1}), {style:'CalcText', keep:1}); else if (st.t === 'x') body += wp(wr(st.text), {style:'CalcText'}); else if (st.t === 'tb') body += wp(wr(st.title, {b:1}), {style:'CalcText'}) + wtable(st.head, st.rows); else if (st.t === 'c') body += wp(wr(`Check — ${st.chk.label}: ${st.chk.pass ? 'PASS' : 'FAIL'}`, {b:1, c: st.chk.pass ? '3E7D4F' : 'B0413E'}), {style:'CalcText'});
          else body += wp(wr(`${st.sym}  `, {b:1, i:1}) + wr(`${st.desc || ''}   ${st.formula || ''}${st.subst ? '  =  ' + st.subst : ''}`) + (st.val == null ? '' : wr(`   →  ${fmt(st.val, st.dp)} ${st.unit || ''}`, {b:1})) + (st.ref ? wr(`   [${st.ref}]`, {c:'4B6378', sz:18}) : ''), {style:'CalcText'}); });
        body += wp(wr('Section 7 — Results'), {style:'Heading3'}) + wtable(['Result','Value','Unit'], r.resList.map(x => [x.label, fmt(x.val, x.dp), x.unit || '']), ['l','n','c']);
        body += wp(wr('Section 8 — Compliance'), {style:'Heading3'}) + (r.checks.length ? wtable(['Check','Value','Limit','Utilisation','Result'], r.checks.map(k => [k.label, `${fmt(k.val, k.dp == null ? 2 : k.dp)} ${k.unit || ''}`, `${k.rel === '<=' ? '≤' : '≥'} ${fmt(k.lim, k.dp == null ? 2 : k.dp)}`, fmt(k.util, 2), k.pass ? 'PASS' : 'FAIL']), ['l','n','n','n','c']) : wp(wr('No code checks.')));
        r.checks.forEach(k => body += wp(wr(k.msg, {c: k.pass ? '303030' : 'B0413E'}), {style:'CalcText'}));
        body += wp(wr('Section 9 — Engineering Interpretation'), {style:'Heading3'}); r.notes.forEach(n => body += wp(wr(n), {style:'ListBullet', num:1})); r.warns.forEach(w => body += wp(wr(`${WARN[w.tag]} — ${w.text}`), {style:'ListBullet', num:1}));
        body += wp(wr('Section 10 — Conclusion'), {style:'Heading3'}) + wp(wr(r.status === 'fail' ? 'NOT COMPLIANT — design revision required: ' + r.checks.filter(k => !k.pass).map(k => k.label).join('; ') + '.' : r.status === 'pass' ? 'All checks satisfied at screening level, subject to verification of inputs and clause references.' : 'Quantity / information calculation.'));
        break; }
    }
  }
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdH1"/><w:footerReference w:type="default" r:id="rIdF1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1417" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
  const font = `<w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos" w:cs="Arial"/>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${font}<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="1200" w:after="240" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="48"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TitleFront"><w:name w:val="Front Matter Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="120"/><w:jc w:val="left"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="60" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:b/><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableGap"><w:name w:val="Table Gap"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="12"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CalcText"><w:name w:val="Calculation Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:ind w:left="360" w:hanging="360"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="20" w:line="240" w:lineRule="auto"/><w:ind w:left="220"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="table" w:styleId="EngTable"><w:name w:val="Engineering Table"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B9ADA2"/><w:left w:val="single" w:sz="4" w:color="B9ADA2"/><w:bottom w:val="single" w:sz="4" w:color="B9ADA2"/><w:right w:val="single" w:sz="4" w:color="B9ADA2"/><w:insideH w:val="single" w:sz="4" w:color="CFC7BF"/><w:insideV w:val="single" w:sz="4" w:color="CFC7BF"/></w:tblBorders><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${wr(info.name + (P.sample ? '  |  ' + DEMO_FLAG : ''), {sz:16, c:'666666'})}</w:p></w:hdr>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${wr('C&S Tender Engineering Report — Page ', {sz:16, c:'666666'})}<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdSe" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdF1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${media.map(m => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.name}"/>`).join('')}</Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const root = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(info.name)} — C&amp;S Tender Engineering Report</dc:title><dc:creator>${xe(info.consultant || 'C&S Consultant')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`;
  const files = [{name:'[Content_Types].xml', data:ct}, {name:'_rels/.rels', data:root}, {name:'docProps/core.xml', data:core}, {name:'word/document.xml', data:doc}, {name:'word/styles.xml', data:styles}, {name:'word/numbering.xml', data:numbering}, {name:'word/settings.xml', data:settings}, {name:'word/header1.xml', data:header}, {name:'word/footer1.xml', data:footer}, {name:'word/_rels/document.xml.rels', data:rels}, ...media.map(m => ({name:'word/' + m.name, data:m.data}))];
  return makeZip(files);
}
