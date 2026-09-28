'use strict';
/* ==========================================================================
   ATTACHMENTS — photos, PDF (pages pasted as images) and Word .docx
   (content pasted: headings, paragraphs, tables, images) per report section,
   and cover photo. Binary data kept in IndexedDB (fallback: memory) — project
   JSON keeps metadata only; Export JSON embeds the data for portability.
   ========================================================================== */
const ATT = {};                       // id -> dataURL
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const MAX_PDF_PAGES = 40;

/* ---------- IndexedDB ---------- */
let _idb = null;
function idb(){
  if (_idb) return _idb;
  _idb = new Promise(res => { try { const r = indexedDB.open('cs_platform_att', 1); r.onupgradeneeded = () => r.result.createObjectStore('att'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch(e){ res(null); } });
  return _idb;
}
async function attPut(id, data){ ATT[id] = data; const db = await idb(); if (!db) return false; return new Promise(res => { try { const tx = db.transaction('att', 'readwrite'); tx.objectStore('att').put(data, id); tx.oncomplete = () => res(true); tx.onerror = () => res(false); } catch(e){ res(false); } }); }
async function attDel(id){ delete ATT[id]; const db = await idb(); if (!db) return; try { db.transaction('att', 'readwrite').objectStore('att').delete(id); } catch(e){} }
async function attLoadAll(){ const db = await idb(); if (!db) return 0; const ids = attIdsUsed(); let n = 0;
  await Promise.all(ids.filter(id => !ATT[id]).map(id => new Promise(res => { try { const q = db.transaction('att').objectStore('att').get(id); q.onsuccess = () => { if (q.result){ ATT[id] = q.result; n++; } res(); }; q.onerror = () => res(); } catch(e){ res(); } })));
  return n; }
function attIdsUsed(){ const ids = []; if (P.coverPhoto) ids.push(P.coverPhoto.img); (P.attach || []).forEach(a => { if (a.img) ids.push(a.img); (a.pages || []).forEach(p => ids.push(p.img)); (a.blocks || []).forEach(b => { if (b.img) ids.push(b.img); }); }); return ids; }

/* ---------- helpers ---------- */
const readAsDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
function loadImg(src){ return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image format not supported by this browser')); i.src = src; }); }
async function imageToJpeg(src, maxPx, q){
  const im = await loadImg(src); const k = Math.min(1, (maxPx || 1600) / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
  return {data: cv.toDataURL('image/jpeg', q || 0.82), w, h};
}
function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load PDF reader (internet connection required for PDF pages)')); document.head.appendChild(s); }); }
function dataURLtoBytes(d){ const b = atob(d.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

/* ---------- PDF → page images ---------- */
async function pdfToPages(file, onProg){
  const emb = id => { const el = document.getElementById(id); return el && el.textContent.length > 1000 ? URL.createObjectURL(new Blob([el.textContent], {type: 'text/javascript'})) : null; };
  if (!window.pdfjsLib){ const u = emb('pdfjs-main'); try { await loadScript(u || PDFJS_URL); } catch(e){ if (u) await loadScript(PDFJS_URL); else throw e; } }
  const lib = window.pdfjsLib; if (!lib) throw new Error('PDF reader unavailable');
  if (!lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = emb('pdfjs-worker') || PDFJS_WORKER;
  const doc = await lib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
  const n = Math.min(doc.numPages, MAX_PDF_PAGES), out = [];
  for (let i = 1; i <= n; i++){
    const pg = await doc.getPage(i); const vp0 = pg.getViewport({scale: 1}); const sc = Math.min(2.0, 1400 / Math.max(vp0.width, vp0.height)); const vp = pg.getViewport({scale: sc});
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({canvasContext: cx, viewport: vp}).promise;
    out.push({data: cv.toDataURL('image/jpeg', 0.8), w: cv.width, h: cv.height}); if (onProg) onProg(i, n);
  }
  return {pages: out, total: doc.numPages};
}

/* ---------- minimal unzip (store / deflate via DecompressionStream) ---------- */
async function unzip(buf){
  const u = new Uint8Array(buf), dv = new DataView(buf); let e = u.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('Not a valid .docx (zip) file');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {}; const td = new TextDecoder();
  for (let k = 0; k < n; k++){
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = td.decode(u.subarray(p + 46, p + 46 + nlen)); files[name] = {method, csize, off}; p += 46 + nlen + xlen + clen; }
  const get = async name => { const f = files[name]; if (!f) return null; const lh = f.off, ln = dv.getUint16(lh + 26, true), lx = dv.getUint16(lh + 28, true); const data = u.subarray(lh + 30 + ln + lx, lh + 30 + ln + lx + f.csize);
    if (f.method === 0) return data.slice(); if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read .docx (update the browser)');
    const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(ds).arrayBuffer()); };
  return {names: Object.keys(files), get};
}
/* ---------- Word .docx → blocks ---------- */
async function docxToBlocks(file, onImg){
  const z = await unzip(await file.arrayBuffer()); const td = new TextDecoder();
  const docXml = await z.get('word/document.xml'); if (!docXml) throw new Error('word/document.xml not found');
  const relsXml = await z.get('word/_rels/document.xml.rels'); const rels = {};
  if (relsXml){ const rd = new DOMParser().parseFromString(td.decode(relsXml), 'application/xml'); [...rd.getElementsByTagName('Relationship')].forEach(r => rels[r.getAttribute('Id')] = r.getAttribute('Target')); }
  const doc = new DOMParser().parseFromString(td.decode(docXml), 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', Rn = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', An = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const body = doc.getElementsByTagNameNS(W, 'body')[0]; const out = [];
  const textOf = el => { let t = ''; const walk = n => { for (const c of n.childNodes){ if (c.namespaceURI === W && c.localName === 't') t += c.textContent; else if (c.namespaceURI === W && (c.localName === 'tab')) t += '\t'; else if (c.namespaceURI === W && (c.localName === 'br' || c.localName === 'cr')) t += '\n'; else if (c.nodeType === 1) walk(c); } }; walk(el); return t; };
  const imgs = async el => { const res = []; for (const bl of [...el.getElementsByTagNameNS(An, 'blip')]){ const rid = bl.getAttributeNS(Rn, 'embed'); const tgt = rels[rid]; if (!tgt) continue; const path = 'word/' + tgt.replace(/^\/?word\//, '').replace(/^\.\//, '');
      const ext = (path.split('.').pop() || '').toLowerCase(); if (!['png','jpg','jpeg','gif','bmp','webp'].includes(ext)){ res.push({skip: ext}); continue; }
      const bytes = await z.get(path); if (!bytes) continue; try { const url = await readAsDataURL(new Blob([bytes], {type: ext === 'jpg' ? 'image/jpeg' : 'image/' + ext})); const j = await imageToJpeg(url, 1400, 0.82); res.push(j); if (onImg) onImg(); } catch(e){ res.push({skip: ext}); } } return res; };
  for (const el of [...body.children]){
    if (el.localName === 'p'){
      const st = el.getElementsByTagNameNS(W, 'pStyle')[0]; const sty = st ? st.getAttributeNS(W, 'val') || '' : '';
      const t = textOf(el).trim(); const im = await imgs(el);
      im.forEach(x => out.push(x.skip ? {t:'p', text:`[Embedded ${x.skip.toUpperCase()} image not supported — insert as PNG/JPEG]`} : {t:'img', data:x.data, w:x.w, h:x.h}));
      if (!t) continue;
      if (/^(Heading|Title)/i.test(sty)) out.push({t:'hx', text:t});
      else if (el.getElementsByTagNameNS(W, 'numPr').length || /List/i.test(sty)) out.push({t:'li', text:t});
      else out.push({t:'p', text:t});
    } else if (el.localName === 'tbl'){
      const rows = [...el.children].filter(r => r.localName === 'tr').map(r => [...r.children].filter(c => c.localName === 'tc').map(c => textOf(c).replace(/\s+/g, ' ').trim()));
      if (rows.length){ const nc = Math.max(...rows.map(r => r.length)); rows.forEach(r => { while (r.length < nc) r.push(''); }); out.push({t:'tbl', head: rows[0], rows: rows.slice(1)}); }
    }
  }
  return out;
}

/* ---------- add / remove ---------- */
function attChapters(){ return reportChapters().map(c => ({key: c.title, label: `${c.num}  ${properTitle(c.title)}`})); }
async function addFiles(files, ch, kind){
  if (!can('edit')){ toast('Your role cannot add attachments'); return; }
  P.attach = P.attach || []; const T = String(ch).toUpperCase(); let added = 0;
  for (const f of files){
    const nm = f.name, ext = (nm.split('.').pop() || '').toLowerCase();
    try {
      if (kind === 'cover'){ const j = await imageToJpeg(await readAsDataURL(f), 1800, 0.85); const id = 'img_' + uid(); await attPut(id, j.data); if (P.coverPhoto) attDel(P.coverPhoto.img); P.coverPhoto = {img: id, w: j.w, h: j.h, name: nm, caption: P.coverPhoto ? P.coverPhoto.caption : 'Site photograph'}; added++; continue; }
      if (/^image\//.test(f.type) || ['jpg','jpeg','png','gif','bmp','webp','heic'].includes(ext)){
        toast(`Processing photo ${nm}…`); const j = await imageToJpeg(await readAsDataURL(f), 1600, 0.82); const id = 'img_' + uid(); await attPut(id, j.data);
        P.attach.push({id: uid(), ch: T, kind: 'photo', name: nm, caption: nm.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), img: id, w: j.w, h: j.h, date: today()}); added++;
      } else if (ext === 'pdf'){
        toast(`Reading PDF ${nm}…`); const r = await pdfToPages(f, (i, n) => toast(`PDF ${nm}: page ${i} / ${n}`)); const pages = [];
        for (const pg of r.pages){ const id = 'img_' + uid(); await attPut(id, pg.data); pages.push({img: id, w: pg.w, h: pg.h}); }
        P.attach.push({id: uid(), ch: T, kind: 'pdf', name: nm, caption: nm.replace(/\.[^.]+$/, ''), pages, total: r.total, date: today()}); added++;
        if (r.total > MAX_PDF_PAGES) toast(`Only the first ${MAX_PDF_PAGES} of ${r.total} pages were inserted`);
      } else if (ext === 'docx'){
        toast(`Reading Word document ${nm}…`); const bl = await docxToBlocks(f);
        for (const b of bl) if (b.t === 'img'){ const id = 'img_' + uid(); await attPut(id, b.data); b.img = id; delete b.data; }
        P.attach.push({id: uid(), ch: T, kind: 'docx', name: nm, caption: nm.replace(/\.[^.]+$/, ''), blocks: bl, date: today()}); added++;
      } else if (ext === 'doc'){ toast('Old .doc format is not supported — save it as .docx or PDF and add again'); }
      else toast(`${nm}: unsupported file type`);
    } catch(e){ console.error(e); toast(`${nm}: ${e.message}`); }
  }
  if (added){ audit('Attachment added', `${added} file(s) → ${T}`); commit(`${added} file(s) added to ${properTitle(T)}`); }
}
function removeAttach(id){ const i = (P.attach || []).findIndex(a => a.id === id); if (i < 0) return; const a = P.attach[i];
  [a.img, ...(a.pages || []).map(p => p.img), ...(a.blocks || []).map(b => b.img)].filter(Boolean).forEach(attDel);
  P.attach.splice(i, 1); audit('Attachment removed', a.name); commit('Removed ' + a.name); }
function moveAttach(id, d){ const L = P.attach, i = L.findIndex(a => a.id === id), j = i + d; if (i < 0 || j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; commit(); }

/* ---------- UI panel ---------- */
function attThumb(a){
  const src = a.kind === 'photo' ? ATT[a.img] : a.kind === 'pdf' ? ATT[(a.pages[0] || {}).img] : ((a.blocks || []).find(b => b.img) ? ATT[a.blocks.find(b => b.img).img] : null);
  return src ? `<img src="${src}" alt="" style="width:74px;height:56px;object-fit:cover;border:1px solid var(--bd);border-radius:3px">` : `<div style="width:74px;height:56px;border:1px solid var(--bd);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--tx2)">${a.kind.toUpperCase()}</div>`;
}
function attachPanel(ch, title){
  const T = String(ch).toUpperCase(); const items = (P.attach || []).filter(a => a.ch === T); const ro = !can('edit');
  const idx = id => P.attach.findIndex(x => x.id === id);
  return `<div class="card"><h3>Photos &amp; attachments — ${esc(title || properTitle(T))} <span class="badge info">${items.length}</span></h3>
    <p class="small muted">Photos are inserted as numbered figures. PDF pages are pasted into the report as page images; Word (.docx) content (headings, text, tables, images) is pasted as text. They appear under "Photographs &amp; Attachments" at the end of this section, in the full report and in the section report.</p>
    ${items.length ? `<div class="tw"><table class="t"><thead><tr><th></th><th>File</th><th>Type</th><th style="min-width:240px">Caption / title in report</th><th>Content</th><th></th></tr></thead><tbody>${items.map(a => `<tr><td>${attThumb(a)}</td><td class="small">${esc(a.name)}<br><span class="muted">${esc(a.date || '')}</span></td><td>${badge('info', a.kind === 'photo' ? 'PHOTO' : a.kind.toUpperCase())}</td>
      <td><input data-bind="attach.${idx(a.id)}.caption" value="${esc(a.caption || '')}"${ro ? ' disabled' : ''}></td><td class="small">${a.kind === 'pdf' ? `${a.pages.length} page(s)${a.total > a.pages.length ? ` of ${a.total}` : ''}` : a.kind === 'docx' ? `${(a.blocks || []).length} paragraphs / tables / images` : `${a.w}×${a.h} px`}${(a.kind === 'photo' ? !ATT[a.img] : a.kind === 'pdf' ? a.pages.some(p => !ATT[p.img]) : false) ? '<br><span style="color:var(--ng)">image data missing in this browser — re-import JSON</span>' : ''}</td>
      <td style="white-space:nowrap">${ro ? '' : `<button class="sm" data-act="attup" data-id="${a.id}" title="Move up">↑</button><button class="sm" data-act="attdown" data-id="${a.id}" title="Move down">↓</button><button class="sm" data-act="attdel" data-id="${a.id}" title="Remove">✕</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">No attachments for this section.</p>'}
    ${ro ? '' : `<div class="row" style="margin-top:6px"><button class="sm" data-act="attpick" data-ch="${esc(T)}" data-accept="image/*">+ Add photo(s)</button><button class="sm" data-act="attpick" data-ch="${esc(T)}" data-accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document">+ Add PDF / Word (.docx)</button></div>`}</div>`;
}
function coverPanel(){
  const c = P.coverPhoto, ro = !can('edit');
  return `<div class="card"><h3>Report cover photo</h3><div class="row" style="align-items:flex-start">${c && ATT[c.img] ? `<img src="${ATT[c.img]}" alt="Cover photo" style="max-width:260px;max-height:170px;border:1px solid var(--bd);border-radius:3px">` : '<div class="small muted" style="width:260px;height:120px;border:1px dashed var(--bd2);display:flex;align-items:center;justify-content:center">No cover photo</div>'}
    <div style="flex:1;min-width:220px">${c ? `<label class="small muted">Caption</label><input data-bind="coverPhoto.caption" value="${esc(c.caption || '')}"${ro ? ' disabled' : ''}>` : ''}<p class="small muted">Shown on the cover of the full report and every section report.</p>
    ${ro ? '' : `<div class="row"><button class="sm" data-act="attpick" data-ch="COVER" data-kind="cover" data-accept="image/*">${c ? 'Replace' : '+ Add'} cover photo</button>${c ? '<button class="sm" data-act="coverdel">Remove</button>' : ''}</div>`}</div></div></div>`;
}
function allAttachPanel(){
  const chs = attChapters(); const used = [...new Set((P.attach || []).map(a => a.ch))];
  return `<div class="card"><h3>Photos &amp; attachments by section</h3><div class="row"><select id="attsec" style="max-width:420px">${chs.map(c => `<option value="${esc(c.key)}">${esc(c.label)}${used.includes(c.key) ? '  ●' : ''}</option>`).join('')}</select>
    ${can('edit') ? `<button class="sm" data-act="attpick" data-chsel="1" data-accept="image/*">+ Add photo(s)</button><button class="sm" data-act="attpick" data-chsel="1" data-accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document">+ Add PDF / Word (.docx)</button>` : ''}</div>
    ${used.length ? `<table class="t" style="margin-top:8px"><thead><tr><th>Section</th><th>Photos</th><th>PDF</th><th>Word</th></tr></thead><tbody>${used.map(k => { const it = P.attach.filter(a => a.ch === k); return `<tr><td>${esc(properTitle(k))}</td><td>${it.filter(a => a.kind === 'photo').length}</td><td>${it.filter(a => a.kind === 'pdf').length}</td><td>${it.filter(a => a.kind === 'docx').length}</td></tr>`; }).join('')}</tbody></table>` : '<p class="small muted">No attachments yet. Attachments can also be added in each technical module (section B).</p>'}</div>`;
}

/* ---------- report injection ---------- */
function injectAttachments(B){
  const list = P.attach || []; if (!list.length) return B;
  const out = []; let i = 0;
  while (i < B.length){
    const b = B[i]; out.push(b); i++;
    if (b.t !== 'h1') continue;
    let j = i; while (j < B.length && B[j].t !== 'h1') j++;
    const seg = B.slice(i, j); out.push(...seg); i = j;
    const items = list.filter(a => a.ch === b.text); if (!items.length) continue;
    const ch = b.num.split('.')[0]; let sub = seg.filter(x => x.t === 'h2').length, fno = seg.filter(x => x.t === 'fig' || x.t === 'img').length, tno = seg.filter(x => x.t === 'table').length, s3 = 0;
    sub++; out.push({t:'h2', num:`${ch}.${sub}`, text:'Photographs & Attachments'});
    const photos = items.filter(a => a.kind === 'photo');
    photos.forEach(a => { fno++; out.push({t:'img', num:`${ch}.${fno}`, cap: a.caption || a.name, img: a.img, w: a.w, h: a.h, photo: true}); });
    items.filter(a => a.kind !== 'photo').forEach(a => {
      s3++; out.push({t:'h3', num:`${ch}.${sub}.${s3}`, text:`Attachment — ${a.caption || a.name}`});
      out.push({t:'p', text:`Source document: ${a.name}${a.kind === 'pdf' ? ` (${a.pages.length} page${a.pages.length > 1 ? 's' : ''}${a.total > a.pages.length ? ` of ${a.total}` : ''})` : ''}.`});
      if (a.kind === 'pdf') a.pages.forEach((pg, k) => { fno++; out.push({t:'img', num:`${ch}.${fno}`, cap:`${a.caption || a.name} — page ${k + 1}`, img: pg.img, w: pg.w, h: pg.h, page: true}); });
      else (a.blocks || []).forEach(x => {
        if (x.t === 'img'){ fno++; out.push({t:'img', num:`${ch}.${fno}`, cap:`${a.caption || a.name} — image`, img: x.img, w: x.w, h: x.h}); }
        else if (x.t === 'tbl'){ tno++; out.push({t:'table', num:`${ch}.${tno}`, cap:`${a.caption || a.name}`, head: x.head, rows: x.rows}); }
        else if (x.t === 'hx') out.push({t:'hx', text: x.text});
        else if (x.t === 'li') out.push({t:'ul', items:[x.text]});
        else out.push({t:'p', text: x.text});
      });
    });
  }
  return out;
}
