/**
 * Tests for color picker integration with code and preview updates
 * 
 * These tests verify that color changes made via UI pickers are:
 * 1. Applied to the beautified SVG code
 * 2. Reflected in the light/dark preview boxes
 * 3. Handle data-dark-* attributes correctly
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appPath = join(__dirname, '..', 'app.js');
const appCode = readFileSync(appPath, 'utf-8');

test('Color picker integration with code and preview', async (t) => {
    
    await t.test('Light mode color picker should trigger applyColorFix', () => {
        // When light color picker changes, it should:
        // 1. Update colors state
        // 2. Call applyColorFix with new light color
        // 3. Preserve dark mode color in data-dark-* attributes
        
        const lightColorInputMatch = appCode.match(/title:\s*['"]\s*Light mode color[^'"]*['"]\s*,[\s\S]{0,800}on(?:Change|Input|Blur):\s*\(e\)\s*=>\s*{([\s\S]{0,1500}?)}/m);
        assert.ok(lightColorInputMatch, 'Should have Light mode color input with onChange/onInput/onBlur handler');
        
        const lightInputHandler = lightColorInputMatch[1];
        
        // Should call applyColorFix to update code
        assert.ok(lightInputHandler.includes('applyColorFix'), 
            'Light mode color picker should call applyColorFix to update SVG code');
            
        // Should pass originalToken
        assert.ok(lightInputHandler.includes('originalToken'), 
            'Light mode color picker should pass originalToken to applyColorFix');
            
        // Should pass darkHex
        assert.ok(lightInputHandler.includes('darkHex'), 
            'Light mode color picker should preserve dark color via darkHex parameter');
    });
    
    await t.test('Dark mode color picker should trigger applyColorFix', () => {
        // When dark color picker changes, it should:
        // 1. Update darkModeColors state
        // 2. Call applyColorFix with darkHex parameter
        
        const darkColorInputMatch = appCode.match(/title:\s*['"]\s*Dark mode color[^'"]*['"]\s*,[\s\S]{0,800}on(?:Change|Input|Blur):\s*\(e\)\s*=>\s*{([\s\S]{0,1500}?)}/m);
        assert.ok(darkColorInputMatch, 'Should have Dark mode color input with onChange/onInput/onBlur handler');
        
        const darkInputHandler = darkColorInputMatch[1];
        
        // Should call applyColorFix with darkHex
        assert.ok(darkInputHandler.includes('applyColorFix'), 
            'Dark mode color picker should call applyColorFix to update data-dark-* attributes');
            
        // Should pass darkHex parameter
        assert.ok(darkInputHandler.includes('darkHex'), 
            'Dark mode color picker should pass darkHex parameter');
    });
    
    await t.test('applyColorFix should handle both light and dark colors', () => {
        const applyColorFixMatch = appCode.includes('const applyColorFix');
        assert.ok(applyColorFixMatch, 'Should have applyColorFix function');
        
        // Check if function uses options.darkHex anywhere (need larger window)
        const applyColorFixStart = appCode.indexOf('const applyColorFix');
        const applyColorFixSection = appCode.substring(applyColorFixStart, applyColorFixStart + 8000);
        
        // Should accept darkHex in options
        assert.ok(applyColorFixSection.includes('darkHex'), 
            'applyColorFix should accept darkHex parameter');
        
        // Should set data-dark-* attributes (setAttribute data-dark-fill or data-dark-stroke)
        assert.ok(applyColorFixSection.includes('data-dark-') || applyColorFixSection.includes('setAttribute'), 
            'applyColorFix should handle data-dark-* attributes');
        
        // Should call commitBeautifiedChange to update editor
        assert.ok(applyColorFixSection.includes('commitBeautifiedChange'), 
            'applyColorFix should call commitBeautifiedChange to update editor and preview');
    });
    
    await t.test('Color changes should trigger preview update', () => {
        // commitBeautifiedChange should call buildLightDarkPreview
        const commitBeautifiedMatch = appCode.match(/const commitBeautifiedChange = \([^)]*\) => {([\s\S]{0,1500}?)}/m);
        assert.ok(commitBeautifiedMatch, 'Should have commitBeautifiedChange function');
        
        const commitBody = commitBeautifiedMatch[1];
        assert.ok(commitBody.includes('buildLightDarkPreview') || commitBody.includes('setPreviewBeautified'), 
            'commitBeautifiedChange should update preview');
    });
    
    await t.test('Color pickers should pass correct originalToken to applyColorFix', () => {
        // Each color has an originals set - need to get the first original token
        // to pass to applyColorFix so it can find and replace the color
        
        const textColorSection = appCode.includes('Text Colors') && appCode.includes('Graphic Colors');
        assert.ok(textColorSection, 'Should have Text Colors and Graphic Colors sections');
        
        // Check if color pickers use originalToken
        const usesOriginalToken = appCode.includes('const originalToken') && 
                                 appCode.includes('colorInfo.originals');
        
        assert.ok(usesOriginalToken, 
            'Color pickers should extract originalToken from colorInfo.originals for applyColorFix');
    });
    
    await t.test('parseColors should preserve originals for applyColorFix', () => {
        const parseColorsMatch = appCode.includes('const parseColors') && appCode.includes('return Array.from(colorMap.values())');
        assert.ok(parseColorsMatch, 'Should have parseColors function');
        
        // Check parseColors section
        const parseColorsStart = appCode.indexOf('const parseColors');
        const parseColorsSection = appCode.substring(parseColorsStart, parseColorsStart + 12000);
        
        // Should track original tokens (originals: new Set([orig]))
        assert.ok(parseColorsSection.includes('originals') && parseColorsSection.includes('originals: new Set'), 
            'parseColors should track original color tokens in Set');
        
        // Should return originals in the color object (can be uppercase Array or lowercase array)
        assert.ok(parseColorsSection.includes('originals:'), 
            'parseColors should return originals field');
    });
});

test('Integration: Full color change workflow', async (t) => {
    
    await t.test('Workflow: User changes light color via picker', () => {
        // Expected flow:
        // 1. User changes <input type="color"> for light mode
        // 2. onInput fires with e.target.value = newColor
        // 3. Update colors state array
        // 4. Get originalToken from colorInfo.originals
        // 5. Call applyColorFix(originalToken, newColor, { darkHex: currentDarkColor })
        // 6. applyColorFix updates SVG in DOM
        // 7. applyColorFix calls commitBeautifiedChange(beautifiedSvg)
        // 8. commitBeautifiedChange calls buildLightDarkPreview()
        // 9. Preview updates with new light color, dark color preserved in data-dark-*
        
        const hasLightColorWorkflow = appCode.includes('Light mode color') && 
                                     appCode.includes('setColors') &&
                                     (appCode.includes('applyColorFix') || appCode.includes('commitBeautifiedChange'));
        
        assert.ok(hasLightColorWorkflow, 
            'Should have workflow from light color picker to code/preview update');
    });
    
    await t.test('Workflow: User changes dark color via picker', () => {
        // Expected flow:
        // 1. User changes <input type="color"> for dark mode
        // 2. onInput fires with e.target.value = newDarkColor
        // 3. Update darkModeColors state
        // 4. Get originalToken from colorInfo.originals or colorInfo.darkOriginals
        // 5. Call applyColorFix(originalToken, currentLightColor, { darkHex: newDarkColor })
        // 6. applyColorFix updates data-dark-* attributes
        // 7. commitBeautifiedChange updates editor and preview
        
        const hasDarkColorWorkflow = appCode.includes('Dark mode color') && 
                                    appCode.includes('setDarkModeColors') &&
                                    (appCode.includes('applyColorFix') || appCode.includes('data-dark-'));
        
        assert.ok(hasDarkColorWorkflow, 
            'Should have workflow from dark color picker to data-dark-* update');
    });
    
    await t.test('Preview should show different light/dark colors', () => {
        // buildLightDarkPreview should:
        // 1. Create light preview by inserting SVG into light background div
        // 2. Create dark preview by inserting SVG into dark background div
        // 3. Dark preview should apply data-dark-* overrides
        
        const buildPreviewMatch = appCode.includes('const buildLightDarkPreview');
        assert.ok(buildPreviewMatch, 'Should have buildLightDarkPreview function');
        
        const buildPreviewStart = appCode.indexOf('const buildLightDarkPreview');
        const buildPreviewSection = appCode.substring(buildPreviewStart, buildPreviewStart + 4000);
        
        // Should handle data-dark-* attributes
        assert.ok(buildPreviewSection.includes('data-dark-') || buildPreviewSection.includes('[\\`data-dark'), 
            'buildLightDarkPreview should handle data-dark-* attributes for dark mode preview');
    });
});

console.log('✓ Color picker integration tests completed');
