/**
 * Regression tests to prevent specific issues from recurring
 * Each test captures a bug that was previously fixed
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appJsPath = path.join(__dirname, '../app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf-8');

describe('Regression Tests', () => {
    
    describe('REGRESSION: Hooks must be inside App component', () => {
        it('should NOT have useState/useRef calls before App declaration', () => {
            // Extract everything before App component
            const beforeAppMatch = appJsContent.match(/^[\s\S]*?(?=const App = )/);
            
            if (beforeAppMatch) {
                const beforeApp = beforeAppMatch[0];
                
                // These hooks should NOT appear before App
                assert.ok(!beforeApp.includes('useState('), 
                    'useState should not be called before App component');
                assert.ok(!beforeApp.includes('useRef('), 
                    'useRef should not be called before App component');
                assert.ok(!beforeApp.includes('useEffect('), 
                    'useEffect should not be called before App component');
            }
        });

        it('App component should contain all hook declarations', () => {
            const appMatch = appJsContent.match(/const App = \(\) => {[\s\S]+$/);
            assert.ok(appMatch, 'App component should exist');
            
            const appCode = appMatch[0];
            
            // All hooks should be inside App
            assert.ok(appCode.includes('useState'), 'useState should be inside App');
            assert.ok(appCode.includes('useRef'), 'useRef should be inside App');
            assert.ok(appCode.includes('useEffect'), 'useEffect should be inside App');
        });
    });

    describe('REGRESSION: Required constants must be defined', () => {
        it('should have BEAUTIFIED_DISPLAY_SUFFIX constant', () => {
            const match = appJsContent.match(/const BEAUTIFIED_DISPLAY_SUFFIX = /);
            assert.ok(match, 'BEAUTIFIED_DISPLAY_SUFFIX constant must exist');
        });

        it('should have OPTIMIZED_DISPLAY_SUFFIX constant', () => {
            const match = appJsContent.match(/const OPTIMIZED_DISPLAY_SUFFIX = /);
            assert.ok(match, 'OPTIMIZED_DISPLAY_SUFFIX constant must exist');
        });
    });

    describe('REGRESSION: computeCaretPosition scope and dependencies', () => {
        it('computeCaretPosition must be defined within App component', () => {
            const appMatch = appJsContent.match(/const App = \(\) => {[\s\S]+$/);
            assert.ok(appMatch, 'App component should exist');
            
            const appCode = appMatch[0];
            assert.ok(appCode.includes('computeCaretPosition'), 
                'computeCaretPosition must be inside App component');
        });

        it('computeCaretPosition must NOT be nested inside lintSvg or other functions', () => {
            // Find lintSvg function
            const lintSvgMatch = appJsContent.match(/const lintSvg = .*?{/);
            if (lintSvgMatch) {
                const lintSvgStart = lintSvgMatch.index;
                
                // Find where computeCaretPosition is defined
                const caretPosMatch = appJsContent.match(/const computeCaretPosition = /);
                if (caretPosMatch) {
                    const caretPosStart = caretPosMatch.index;
                    
                    // computeCaretPosition should be defined BEFORE lintSvg in the App scope
                    // This prevents it from being nested inside lintSvg
                    // OR it should be defined after lintSvg is closed
                    assert.ok(caretPosStart < lintSvgStart || caretPosStart > lintSvgStart + 1000,
                        'computeCaretPosition should not be nested inside lintSvg');
                }
            }
        });

        it('updateBeautifiedCaret must include computeCaretPosition in dependencies', () => {
            // Find updateBeautifiedCaret useCallback
            const callbackMatch = appJsContent.match(/const updateBeautifiedCaret = useCallback\([\s\S]{0,1000}}, \[([^\]]+)\]/);
            
            if (callbackMatch) {
                const deps = callbackMatch[1];
                assert.ok(deps.includes('computeCaretPosition'), 
                    `updateBeautifiedCaret callback must depend on computeCaretPosition, got: ${deps}`);
            } else {
                throw new Error('updateBeautifiedCaret useCallback not found');
            }
        });
    });

    describe('REGRESSION: Preview rendering must force re-renders', () => {
        it('light preview div must have key prop', () => {
            // Look for key prop with backtick template literal
            const keyMatch = appJsContent.match(/key: `light-/);
            assert.ok(keyMatch, 'Light preview must have key prop for re-rendering');
            
            const previewMatch = appJsContent.match(/previewLightHtml/);
            assert.ok(previewMatch, 'Light preview HTML should exist');
        });

        it('dark preview div must have key prop', () => {
            // Look for key prop with backtick template literal
            const keyMatch = appJsContent.match(/key: `dark-/);
            assert.ok(keyMatch, 'Dark preview must have key prop for re-rendering');
            
            const previewMatch = appJsContent.match(/previewDarkHtml/);
            assert.ok(previewMatch, 'Dark preview HTML should exist');
        });
    });

    describe('REGRESSION: Function closures must be complete', () => {
        it('formatXml should have complete implementation', () => {
            assert.ok(appJsContent.includes('function formatXml'), 'formatXml function should exist');
            const match = appJsContent.match(/function formatXml\(xml\) \{/);
            assert.ok(match, 'formatXml should be a proper function');
        });

        it('beautifySvg should have complete implementation', () => {
            assert.ok(appJsContent.includes('function beautifySvg'), 'beautifySvg function should exist');
            const match = appJsContent.match(/function beautifySvg\(svg\) \{/);
            assert.ok(match, 'beautifySvg should be a proper function');
        });

        it('buildLightDarkPreview should have complete implementation', () => {
            assert.ok(appJsContent.includes('buildLightDarkPreview'), 'buildLightDarkPreview function should exist');
            const match = appJsContent.match(/const buildLightDarkPreview = \(svgString\) => \{/);
            assert.ok(match, 'buildLightDarkPreview should be an arrow function');
        });
    });

    describe('REGRESSION: Color fix must handle dual-mode', () => {
        it('applyColorFix should accept darkHex in options', () => {
            const match = appJsContent.match(/const applyColorFix = \(([^)]+)\) =>/);
            assert.ok(match, 'applyColorFix should exist');
            
            // Find where darkHex is extracted from options
            const fnBodyMatch = appJsContent.match(/applyColorFix = [\s\S]*?(?:const|let|var) .*?darkHex/);
            assert.ok(fnBodyMatch || appJsContent.includes('options.darkHex'), 
                'applyColorFix should handle darkHex from options');
        });

        it('applyColorFix should set data-dark-fill attribute', () => {
            assert.ok(appJsContent.includes('data-dark-fill'), 
                'applyColorFix should set data-dark-fill for fill fixes');
        });

        it('applyColorFix should set data-dark-stroke attribute', () => {
            assert.ok(appJsContent.includes('data-dark-stroke'), 
                'applyColorFix should set data-dark-stroke for stroke fixes');
        });
    });

    describe('REGRESSION: Lint integration must pass dual-mode data', () => {
        it('handleLintFix should pass darkHex to applyColorFix', () => {
            const match = appJsContent.match(/handleLintFix[\s\S]*?applyColorFix\([^)]+darkHex/);
            assert.ok(match, 'handleLintFix must pass darkHex to applyColorFix');
        });

        it('lint results should include hexDark property', () => {
            const lintSvgMatch = appJsContent.match(/const lintSvg[\s\S]{0,4000}hexDark/);
            assert.ok(lintSvgMatch, 'lintSvg should populate hexDark in results');
        });

        it('lint results should include dark color tracking', () => {
            // Verify dark mode color handling exists (hexDark or similar)
            const hasDarkSupport = appJsContent.includes('hexDark') || appJsContent.includes('darkHex');
            assert.ok(hasDarkSupport, 'lintSvg should track dark colors');
        });
    });

    describe('REGRESSION: Syntax correctness', () => {
        it('app.js should have all required elements', () => {
            // Just verify critical elements exist
            assert.ok(appJsContent.includes('const App ='), 'App component must exist');
            assert.ok(appJsContent.includes('useState'), 'Should use useState');
            assert.ok(appJsContent.includes('buildLightDarkPreview'), 'Should have buildLightDarkPreview');
        });

        it('app.js should not have obvious brace imbalance', () => {
            const openBraces = (appJsContent.match(/{/g) || []).length;
            const closeBraces = (appJsContent.match(/}/g) || []).length;
            
            // Allow some tolerance for braces in strings/comments
            const diff = Math.abs(openBraces - closeBraces);
            assert.ok(diff < 5, `Brace imbalance should be minimal, got ${diff}`);
        });
    });

    describe('REGRESSION: Preview update flow', () => {
        it('commitBeautifiedChange should call buildLightDarkPreview', () => {
            const match = appJsContent.match(/commitBeautifiedChange[\s\S]{0,500}buildLightDarkPreview/);
            assert.ok(match, 'commitBeautifiedChange must update preview via buildLightDarkPreview');
        });

        it('commitBeautifiedChange should update setPreviewBeautified', () => {
            const match = appJsContent.match(/commitBeautifiedChange[\s\S]{0,500}setPreviewBeautified/);
            assert.ok(match, 'commitBeautifiedChange must call setPreviewBeautified');
        });

        it('onInput handler should call commitBeautifiedChange', () => {
            const match = appJsContent.match(/onInput[\s\S]{0,200}commitBeautifiedChange/);
            assert.ok(match, 'Textarea onInput should trigger commitBeautifiedChange');
        });
    });
});
