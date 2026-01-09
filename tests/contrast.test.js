const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('app.js', 'utf8');

// Extract helper functions by simple regex (not perfect, but fine for sanity checks)
const needed = [];
['getLuminance','getContrastRatio','getAPCAContrast','hexToRgb','rgbToHex','rgbToHsl','hslToRgb'].forEach(name => {
    const re = new RegExp(`function ${name}\\s*\\(([^)]*)\\)\\s*\\{`,'m');
    if (!re.test(code)) {
        console.error('Missing function', name);
        process.exit(2);
    }
});

console.log('Core contrast helper functions present. Running minimal functional checks...');

// Extract helper section up to the components marker to avoid DOM references
const parts = code.split('\n');
let endIdx = parts.findIndex(l => l.includes('// --- Components ---'));
if (endIdx === -1) endIdx = Math.min(parts.length, 400);
const helperLines = parts.slice(0, endIdx).filter(l => !l.trim().startsWith('import ')).join('\n');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(helperLines, sandbox, { filename: 'app-helpers.js' });

// Run a few sample checks
const { getContrastRatio, getAPCAContrast } = sandbox;
if (typeof getContrastRatio !== 'function' || typeof getAPCAContrast !== 'function') {
    console.error('Helpers not available in sandbox');
    process.exit(2);
}

const r1 = getContrastRatio('#000000','#ffffff');
const r2 = getContrastRatio('#ffffff','#ffffff');
// Black vs white should be ~21:1; identical colors = 1:1
if (r1 >= 21 && r2 === 1) {
    console.log('WCAG helper sanity checks passed');
    process.exit(0);
} else {
    console.error('WCAG helper sanity failed', r1, r2);
    process.exit(2);
}
