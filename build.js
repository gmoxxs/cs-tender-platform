const fs = require('fs');
const css = fs.readFileSync('src/styles.css', 'utf8');
const js = ['core','data','calcs_a','calcs_b','engine','modules','ui','report','attach','pages','cir','app'].map(f => `/* ---- ${f}.js ---- */\n` + fs.readFileSync(`src/${f}.js`, 'utf8')).join('\n');
const pdfMain = fs.existsSync('vendor/package/build/pdf.min.js') ? fs.readFileSync('vendor/package/build/pdf.min.js','utf8').replace(/<\/script/gi,'<\\/script') : '';
const pdfWorker = fs.existsSync('vendor/package/build/pdf.worker.min.js') ? fs.readFileSync('vendor/package/build/pdf.worker.min.js','utf8').replace(/<\/script/gi,'<\\/script') : '';
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>C&amp;S Tender Engineering Platform — Solar / Solar + BESS (Malaysia)</title>
<meta name="description" content="Civil & structural tender engineering, calculation, QTO/BOQ, tender reconciliation, risk and A4 report platform for utility-scale solar farms and solar + BESS projects in Malaysia.">
<style id="appcss">
${css}
</style>
</head>
<body>
<div id="app"><header id="top"></header><nav id="nav" aria-label="Modules"></nav><main id="main"><p style="padding:20px">Loading… If this message remains, JavaScript is blocked in this viewer — open the file in Chrome / Edge / Firefox, or host it and embed by URL.</p></main></div>
<noscript><p style="padding:20px;color:#B0413E">JavaScript is required. Open this file in a web browser (Chrome / Edge / Firefox).</p></noscript>
<div id="modal"></div><div id="toast" role="status"></div>
<script type="text/plain" id="pdfjs-main">${pdfMain}</script>
<script type="text/plain" id="pdfjs-worker">${pdfWorker}</script>
<script>
${js}
</script>
</body>
</html>`;
fs.mkdirSync('dist', {recursive: true});
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(1), 'KB');
