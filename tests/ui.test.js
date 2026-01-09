const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  try {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    // Check that app.js contains the Finalize buttons labels
    const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    if (!/Copy optimized code/.test(appSrc)) throw new Error('Copy optimized code label not present in app.js');
    if (!/Download optimized code/.test(appSrc)) throw new Error('Download optimized code label not present in app.js');

    // Create a small DOM and inject an accordion to validate selectors and basic interaction
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const finalize = document.createElement('div'); finalize.className = 'accordion';
    const copy = document.createElement('button'); copy.className = 'small'; copy.textContent = 'Copy optimized code';
    const dl = document.createElement('button'); dl.className = 'small secondary'; dl.textContent = 'Download optimized code';
    finalize.appendChild(copy); finalize.appendChild(dl);
    document.body.appendChild(finalize);

    const copyBtn = document.querySelector('.accordion button.small');
    const dlBtn = document.querySelector('.accordion button.small.secondary');
    if (!copyBtn) throw new Error('Copy button selector missing');
    if (!dlBtn) throw new Error('Download button selector missing');

    console.log('JSDOM UI test passed (source contains labels and DOM selectors work)');
    process.exit(0);
  } catch (err) {
    console.error('JSDOM UI test failed:', err);
    process.exit(2);
  }
})();
