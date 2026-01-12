#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appPath = path.join(__dirname, '../app.js');
const app = fs.readFileSync(appPath, 'utf-8');

console.log('=== SYNTAX DIAGNOSTICS ===\n');

// Check constants
console.log('--- Constants ---');
const c1 = app.match(/const BEAUTIFIED_DISPLAY_SUFFIX = ['"]/);
console.log('BEAUTIFIED_DISPLAY_SUFFIX:', c1 ? '✓ FOUND' : '✗ NOT FOUND');
const c2 = app.match(/const OPTIMIZED_DISPLAY_SUFFIX = ['"]/);
console.log('OPTIMIZED_DISPLAY_SUFFIX:', c2 ? '✓ FOUND' : '✗ NOT FOUND');

// Check functions
console.log('\n--- Functions ---');
console.log('formatXml:', app.includes('function formatXml') ? '✓ FOUND' : '✗ NOT FOUND');
console.log('beautifySvg:', app.includes('function beautifySvg') ? '✓ FOUND' : '✗ NOT FOUND');
console.log('buildLightDarkPreview:', app.includes('buildLightDarkPreview') ? '✓ FOUND' : '✗ NOT FOUND');

// Check key props
console.log('\n--- Preview Keys ---');
console.log('Light key:', app.includes('key: `light-') ? '✓ FOUND' : '✗ NOT FOUND');
console.log('Dark key:', app.includes('key: `dark-') ? '✓ FOUND' : '✗ NOT FOUND');

// Check parentheses balance (skip strings)
console.log('\n--- Syntax Balance ---');
const cleaned = app
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)* `/g, '``')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

let parenDepth = 0;
let braceDepth = 0;

for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '(') parenDepth++;
    if (cleaned[i] === ')') parenDepth--;
    if (cleaned[i] === '{') braceDepth++;
    if (cleaned[i] === '}') braceDepth--;
    
    if (parenDepth < 0) {
        console.log('✗ Unmatched ) at position', i);
        const lineNumber = app.substring(0, i).split('\n').length;
        console.log('  Line:', lineNumber);
        console.log('  Context:', app.substring(Math.max(0, i-80), i+80));
        break;
    }
    if (braceDepth < 0) {
        console.log('✗ Unmatched } at position', i);
        const lineNumber = app.substring(0, i).split('\n').length;
        console.log('  Line:', lineNumber);
        console.log('  Context:', app.substring(Math.max(0, i-80), i+80));
        break;
    }
}

console.log('Parenthesis depth:', parenDepth === 0 ? `✓ ${parenDepth}` : `✗ ${parenDepth}`);
console.log('Brace depth:', braceDepth === 0 ? `✓ ${braceDepth}` : `✗ ${braceDepth}`);

// Check dependency array
console.log('\n--- Dependency Arrays ---');
const updateCaretMatch = app.match(/useEffect\(\(\) => {[\s\S]{0,1000}updateBeautifiedCaret[\s\S]{0,200}}, \[([^\]]+)\]/);
if (updateCaretMatch) {
    const deps = updateCaretMatch[1];
    console.log('updateBeautifiedCaret deps:', deps.includes('computeCaretPosition') ? '✓ Has computeCaretPosition' : '✗ Missing computeCaretPosition');
    console.log('  All deps:', deps);
} else {
    console.log('✗ updateBeautifiedCaret useEffect not found');
}

console.log('\n');
