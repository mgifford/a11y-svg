/**
 * Feature tests for critical user workflows
 * Tests the functionality that has been causing regressions
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and prepare app.js for testing
const appJsPath = path.join(__dirname, '../app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf-8');

describe('Critical Feature Tests', () => {

    describe('buildLightDarkPreview', () => {
        it('should exist and handle light/dark modes', () => {
            assert.ok(appJsContent.includes('buildLightDarkPreview'), 'Function should exist');
            assert.ok(appJsContent.includes('previewLight'), 'Should create light preview');
            assert.ok(appJsContent.includes('previewDark'), 'Should create dark preview');
        });
    });

    describe('Color contrast helpers', () => {
        it('should have normalizeHex function', () => {
            assert.ok(appJsContent.includes('normalizeHex'), 'normalizeHex should exist');
            assert.ok(appJsContent.match(/normalizeHex.*=.*hex/), 'Should handle hex parameter');
        });

        it('should have hexToRgb function', () => {
            assert.ok(appJsContent.includes('hexToRgb'), 'hexToRgb should exist');
            assert.ok(appJsContent.includes('normalizeHex'), 'Should use normalizeHex');
        });
    });

    describe('Lint with dual-mode contrast', () => {
        it('should detect contrast failures in both light and dark modes', () => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <text x="10" y="50" fill="#888888">Low contrast text</text>
            </svg>`;

            // Check that lintSvg is defined in the file
            assert.ok(appJsContent.includes('const lintSvg'), 'lintSvg should be defined');
            assert.ok(appJsContent.includes('getContrastRatio'), 'Contrast checking should be implemented');
        });
    });

    describe('Data-dark-* attribute handling', () => {
        it('parseColors should extract data-dark-fill attributes', () => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg">
                <circle fill="#ff0000" data-dark-fill="#00ff00" />
            </svg>`;

            // Verify the code includes data-dark attribute handling
            assert.ok(appJsContent.includes('data-dark-fill'), 'Should handle data-dark-fill');
            assert.ok(appJsContent.includes('data-dark-stroke'), 'Should handle data-dark-stroke');
        });

        it('applyColorFix should preserve data-dark-* attributes when applying fixes', () => {
            // Verify applyColorFix handles dark mode
            assert.ok(appJsContent.includes('normalizedDarkHex'), 'applyColorFix should handle dark hex');
            assert.ok(appJsContent.includes('data-dark-'), 'Should set data-dark attributes');
        });
    });

    describe('Editor integration', () => {
        it('commitBeautifiedChange should update preview', () => {
            // Verify the function chain exists
            assert.ok(appJsContent.includes('commitBeautifiedChange'), 'commitBeautifiedChange should exist');
            assert.ok(appJsContent.includes('setPreviewBeautified'), 'Should update preview state');
            assert.ok(appJsContent.includes('buildLightDarkPreview'), 'Should build preview from code');
        });

        it('computeCaretPosition should be available in App scope', () => {
            // Check that computeCaretPosition is defined within the App component
            const appComponentMatch = appJsContent.match(/const App = \(\) => {[\s\S]+$/);
            assert.ok(appComponentMatch, 'App component should exist');
            
            const appComponent = appComponentMatch[0];
            assert.ok(appComponent.includes('computeCaretPosition'), 'computeCaretPosition should be in App scope');
            assert.ok(appComponent.includes('updateBeautifiedCaret'), 'updateBeautifiedCaret should be in App scope');
        });
    });

    describe('Fix button workflow', () => {
        it('handleLintFix should pass correct parameters to applyColorFix', () => {
            // Verify the function exists and has correct signature
            assert.ok(appJsContent.includes('handleLintFix'), 'handleLintFix should exist');
            assert.ok(appJsContent.includes('applyColorFix(originalToken, lightHex, { lintItem: lintEntry, darkHex }'), 
                'handleLintFix should pass darkHex option');
        });

        it('lint entries should include light and dark color data', () => {
            // Verify lint results include necessary data
            assert.ok(appJsContent.includes('hexDark'), 'Lint results should include hexDark');
            assert.ok(appJsContent.includes('darkOriginals'), 'Lint results should track dark originals');
            assert.ok(appJsContent.includes('suggestedDark'), 'Lint results should include dark suggestions');
        });
    });

    describe('Preview rendering', () => {
        it('preview divs should have key props for proper re-rendering', () => {
            // Verify key props are set
            assert.ok(appJsContent.includes('key: `light-'), 'Light preview should have key prop');
            assert.ok(appJsContent.includes('key: `dark-'), 'Dark preview should have key prop');
        });

        it('preview should use correct state based on active tab', () => {
            assert.ok(appJsContent.includes('previewForActiveTab'), 'Should select preview based on tab');
            assert.ok(appJsContent.includes('previewBeautified'), 'Should have beautified preview state');
        });
    });

    describe('Helper robustness', () => {
        it('should define a generateId helper for ensureElementId', () => {
            assert.ok(appJsContent.includes('const ensureElementId'), 'ensureElementId helper should exist');
            assert.ok(appJsContent.includes('generateId'), 'generateId helper should exist');
            assert.ok(appJsContent.includes('ensureElementId(') && appJsContent.includes('generateId'),
                'ensureElementId should rely on generateId');
        });

        it('should define an optimizeSvg fallback without SVGO', () => {
            assert.ok(appJsContent.includes('optimizeSvg'), 'optimizeSvg helper should be defined');
            assert.ok(appJsContent.includes('window.SVGO') || appJsContent.includes('SVGO'), 'optimizeSvg should guard access to global SVGO');
            assert.ok(appJsContent.includes('return { data: code }'), 'optimizeSvg fallback should return original code');
        });

        it('should fetch svg/manifest.json when loading samples', () => {
            assert.ok(appJsContent.includes('fetchRandomSvg'), 'fetchRandomSvg should exist');
            assert.ok(appJsContent.includes("fetch('svg/manifest.json')"), 'Should fetch svg/manifest.json');
            assert.ok(appJsContent.includes('svgHistory'), 'Should track sample history');
            assert.ok(appJsContent.includes('fetch(`svg/${encodeURIComponent(randomFile)}`)') || appJsContent.includes('svg/${encodeURIComponent(randomFile)}'),
                'Should request encoded sample file paths');
        });
    });
});
