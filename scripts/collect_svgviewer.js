#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const outDir = path.join(__dirname, '..', 'svg', 'remote');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function looksLikeSvg(text) {
  return /<svg[\s>]/i.test(text);
}

function hasOpenLicense(text) {
  // heuristic: search for common license markers — refine as needed
  const l = text.toLowerCase();
  const keywords = ['cc-by', 'cc0', 'creativecommons', 'public domain', 'cc-by-sa', 'cc-by-nc', 'mit', 'apache', 'bsd'];
  return keywords.some(k => l.includes(k));
}

async function collect(start = 13341, limit = 50, maxCheck = 2000) {
  let collected = 0;
  let checked = 0;
  let id = Number(start);
  while (collected < limit && checked < maxCheck) {
    const url = `https://www.svgviewer.dev/s/${id}`;
    try {
      const res = await fetchUrl(url);
      checked++;
      if (res.status === 200 && looksLikeSvg(res.body)) {
        if (hasOpenLicense(res.body)) {
          const fname = path.join(outDir, `svgviewer-${id}.svg`);
          fs.writeFileSync(fname, res.body, 'utf8');
          console.log(`Saved ${fname}`);
          collected++;
        } else {
          console.log(`ID ${id} is SVG but no license keyword found`);
        }
      } else {
        console.log(`ID ${id} fetch status ${res.status}`);
      }
    } catch (err) {
      console.warn(`Error fetching ${url}: ${err.message}`);
    }
    id++;
  }
  console.log(`Done. Collected ${collected} items from ${checked} checked.`);
}

// CLI
const argv = process.argv.slice(2);
const start = argv[0] ? Number(argv[0]) : 13341;
const limit = argv[1] ? Number(argv[1]) : 50;
collect(start, limit).catch(err => { console.error(err); process.exit(1); });
