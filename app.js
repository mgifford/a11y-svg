import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import { optimize } from 'https://esm.sh/svgo@3.2.0/dist/svgo.browser.js';

// --- Utils & Helpers ---

function generateId(prefix = 'id') {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// ===== WCAG 2.2 CONTRAST RATIO (Relative Luminance Method) =====
function getContrastRatio(hex1, hex2) {
    const lum1 = getLuminance(hex1);
    const lum2 = getLuminance(hex2);
    const bright = Math.max(lum1, lum2);
    const dark = Math.min(lum1, lum2);
    return (bright + 0.05) / (dark + 0.05);
}

function getLuminance(hex) {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;
    
    const [sr, sg, sb] = [r, g, b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
}

// ===== APCA CONTRAST (Accessible Perceptual Contrast Algorithm) =====
// More perceptually accurate than WCAG 2.2, used in WCAG 3.0 (draft)
// Returns Lc (Lightness Contrast) value
function getAPCAContrast(hex1, hex2) {
    const y1 = getRelativeLuminanceAPCA(hex1);
    const y2 = getRelativeLuminanceAPCA(hex2);
    
    const lighter = Math.max(y1, y2);
    const darker = Math.min(y1, y2);
    
    // APCA formula: (lighter - darker) * 0.37
    const lc = (lighter - darker) * 0.37;
    
    // Return signed value: positive if hex1 is lighter, negative if darker
    return y1 > y2 ? Math.abs(lc) : -Math.abs(lc);
}

function getRelativeLuminanceAPCA(hex) {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;
    
    const [sr, sg, sb] = [r, g, b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    // APCA uses BT.2020 coefficients (more accurate than WCAG 2.2)
    return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
}

// Color helpers: hex <-> rgb, rgb <-> hsl
function hexToRgb(hex) {
    const parsed = parseInt(hex.slice(1), 16);
    return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
}

function rgbToHex({ r, g, b }) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) {
        const v = Math.round(l * 255);
        return { r: v, g: v, b: v };
    }
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    return { r, g, b };
}

// Suggest an accessible color by adjusting lightness toward black/white until contrast passes
function suggestAccessibleColor(hex, bgLight, bgDark, isText, contrastMode) {
    const thresholds = { wcag: isText ? 4.5 : 3, apca: isText ? 75 : 60 };
    const start = hexToRgb(hex);
    const hsl = rgbToHsl(start);

    // Prefer hue-preserving adjustments: adjust lightness first, then saturation, then small hue nudges.

    // Prefer hue-preserving adjustments: adjust lightness first, then saturation if needed.
    const maxSteps = 30;
    for (let step = 1; step <= maxSteps; step++) {
        // subtle lightness moves (both directions)
        const delta = step * 1.5; // small increments
        const tryLs = [Math.min(100, hsl.l + delta), Math.max(0, hsl.l - delta)];
        for (let tryL of tryLs) {
            const tryHex = rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l: tryL }));
            if (contrastMode === 'wcag') {
                const r = Math.min(getContrastRatio(tryHex, bgLight), getContrastRatio(tryHex, bgDark));
                if (r >= thresholds.wcag) return tryHex;
            } else {
                const lc = Math.min(Math.abs(getAPCAContrast(tryHex, bgLight)), Math.abs(getAPCAContrast(tryHex, bgDark)));
                if (lc >= thresholds.apca) return tryHex;
            }
        }
    }

    // If lightness-only adjustments fail, try reducing saturation (toward gray) while preserving hue
    for (let step = 1; step <= 20; step++) {
        const newS = Math.max(0, hsl.s - step * 4);
        const tryHex = rgbToHex(hslToRgb({ h: hsl.h, s: newS, l: hsl.l }));
        if (contrastMode === 'wcag') {
            const r = Math.min(getContrastRatio(tryHex, bgLight), getContrastRatio(tryHex, bgDark));
            if (r >= thresholds.wcag) return tryHex;
        } else {
            const lc = Math.min(Math.abs(getAPCAContrast(tryHex, bgLight)), Math.abs(getAPCAContrast(tryHex, bgDark)));
            if (lc >= thresholds.apca) return tryHex;
        }
    }

    // Next: try small hue nudges with preserved saturation/lightness
    for (let dh = -18; dh <= 18; dh += 3) {
        for (let dl = -12; dl <= 12; dl += 3) {
            const tryH = (hsl.h + dh + 360) % 360;
            const tryL = Math.min(100, Math.max(0, hsl.l + dl));
            const tryHex = rgbToHex(hslToRgb({ h: tryH, s: hsl.s, l: tryL }));
            if (contrastMode === 'wcag') {
                const r = Math.min(getContrastRatio(tryHex, bgLight), getContrastRatio(tryHex, bgDark));
                if (r >= thresholds.wcag) return tryHex;
            } else {
                const lc = Math.min(Math.abs(getAPCAContrast(tryHex, bgLight)), Math.abs(getAPCAContrast(tryHex, bgDark)));
                if (lc >= thresholds.apca) return tryHex;
            }
        }
    }

    // Last resort: try black/white fallback
    const white = '#ffffff';
    const black = '#000000';
    if (contrastMode === 'wcag') {
        const wr = Math.min(getContrastRatio(white, bgLight), getContrastRatio(white, bgDark));
        if (wr >= thresholds.wcag) return white;
        const br = Math.min(getContrastRatio(black, bgLight), getContrastRatio(black, bgDark));
        if (br >= thresholds.wcag) return black;
    } else {
        const wl = Math.min(Math.abs(getAPCAContrast(white, bgLight)), Math.abs(getAPCAContrast(white, bgDark)));
        if (wl >= thresholds.apca) return white;
        const bl = Math.min(Math.abs(getAPCAContrast(black, bgLight)), Math.abs(getAPCAContrast(black, bgDark)));
        if (bl >= thresholds.apca) return black;
    }
    for (let dh = -30; dh <= 30; dh += 6) {
        for (let dl = -20; dl <= 20; dl += 4) {
            const tryH = (hsl.h + dh + 360) % 360;
            const tryL = Math.min(100, Math.max(0, hsl.l + dl));
            const tryHex = rgbToHex(hslToRgb({ h: tryH, s: hsl.s, l: tryL }));
            if (contrastMode === 'wcag') {
                const r = Math.min(getContrastRatio(tryHex, bgLight), getContrastRatio(tryHex, bgDark));
                if (r >= thresholds.wcag) return tryHex;
            } else {
                const lc = Math.min(Math.abs(getAPCAContrast(tryHex, bgLight)), Math.abs(getAPCAContrast(tryHex, bgDark)));
                if (lc >= thresholds.apca) return tryHex;
            }
        }
    }

    return hex; // no good suggestion found
}

// Helper: Detect if an element contains text
function isTextElement(element) {
    const tagName = element.tagName.toLowerCase();
    // Direct text elements
    if (tagName === 'text' || tagName === 'tspan') return true;
    
    // Check if element contains text nodes or has text content
    if (element.childNodes.length > 0) {
        for (let node of element.childNodes) {
            if (node.nodeType === 3 && node.textContent.trim().length > 0) return true; // Text node
            if (node.nodeType === 1 && isTextElement(node)) return true; // Recursive check
        }
    }
    return false;
}

// Helper: Get font size from element (in pixels)
function getFontSize(element) {
    const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    if (style && style.fontSize) {
        const size = parseFloat(style.fontSize);
        return size;
    }
    
    // Fallback: check font-size attribute
    const sizeAttr = element.getAttribute('font-size');
    if (sizeAttr) {
        return parseFloat(sizeAttr);
    }
    
    return 12; // Default
}

// Helper: Is text large (18pt or 14pt bold)
function isLargeText(element) {
    const fontSize = getFontSize(element);
    const fontWeight = element.getAttribute('font-weight') || '';
    const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 700;
    
    // 18pt = ~24px, 14pt = ~18.67px
    return (fontSize >= 24) || (fontSize >= 18 && isBold);
}

// Helper: Get APCA level (based on Lc value)
// APCA levels (absolute value): 90+ AAA, 75+ AA, 60+ Fail
function getAPCALevel(lc) {
    const absLc = Math.abs(lc);
    if (absLc >= 90) return 'AAA';
    if (absLc >= 75) return 'AA';
    return 'Fail';
}

// Helper: Get WCAG 2.2 AA level (text vs non-text)
function getWCAGLevel(ratio, isText = false, isLarge = false) {
    if (isText) {
        // Text: 4.5:1 = AA, 7:1 = AAA (normal)
        // Large text: 3:1 = AA, 4.5:1 = AAA
        const aaThreshold = isLarge ? 3 : 4.5;
        const aaaThreshold = isLarge ? 4.5 : 7;
        
        if (ratio >= aaaThreshold) return 'AAA';
        if (ratio >= aaThreshold) return 'AA';
        return 'Fail';
    } else {
        // Non-text (graphics, UI): 3:1 = AA, 4.5:1 = AAA
        if (ratio >= 4.5) return 'AAA';
        if (ratio >= 3) return 'AA';
        return 'Fail';
    }
}

// --- Components ---

const App = () => {
    const [svgInput, setSvgInput] = useState('');
    const [processedSvg, setProcessedSvg] = useState({ code: '', light: '', dark: '' });
    const [intent, setIntent] = useState('decorative'); // Default!
    const [userHasInteracted, setUserHasInteracted] = useState(false);
    const dialogRef = useRef(null);
    const [tempMeta, setTempMeta] = useState({ title: '', desc: '' });
    const [tempIntent, setTempIntent] = useState('decorative'); // For Dialog
    const [meta, setMeta] = useState({ title: '', desc: '' });
    const [options, setOptions] = useState({
        useCurrentColor: false,
        injectDarkMode: false,
        useCssVars: false
    });
    const [colors, setColors] = useState([]); // [{ hex: '#...', isText: bool, isLarge: bool, count: num }]
    const [darkModeColors, setDarkModeColors] = useState({});
    const [prevOverrides, setPrevOverrides] = useState({}); // store previous override for revert
    const [a11yStatus, setA11yStatus] = useState('');
    const [currentFileName, setCurrentFileName] = useState('');
    const [contrastMode, setContrastMode] = useState('wcag'); // 'wcag' or 'apca'
    const [bgLight, setBgLight] = useState('#ffffff');
    const [bgDark, setBgDark] = useState('#121212');
    const [showTextAsNonText, setShowTextAsNonText] = useState(false);
    const [filterTextOnly, setFilterTextOnly] = useState(false);
    const [previewSplit, setPreviewSplit] = useState(50); // 50/50 split percentage
    const previewContainerRef = useRef(null);
    const isResizingRef = useRef(false);

    // --- Helpers ---

    const onIntentChange = (newIntent) => {
        setIntent(newIntent);
        setUserHasInteracted(true);
    };

    const openMetaDialog = () => {
        setTempMeta({ ...meta }); // Copy current meta
        setTempIntent(intent);
        if (dialogRef.current) dialogRef.current.showModal();
    };

    const closeMetaDialog = (save) => {
        if (save) {
            setIntent(tempIntent);
            if (tempIntent === 'informational') {
                setMeta(tempMeta);
            } else {
                 setMeta({ title: '', desc: '' });
            }
            setUserHasInteracted(true);
        }
        if (dialogRef.current) dialogRef.current.close();
    };

    // --- Parsers & Processors ---

    const parseColors = (svgString) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const colorMap = new Map(); // hex -> { isText, isLarge, count }
        const elements = doc.querySelectorAll('*');
        
        elements.forEach(el => {
            const isText = isTextElement(el);
            const isLarge = isText ? isLargeText(el) : false;
            
            ['fill', 'stroke'].forEach(attr => {
                const val = el.getAttribute(attr);
                if (val && val.startsWith('#')) {
                    const hex = val.toLowerCase();
                    if (colorMap.has(hex)) {
                        const info = colorMap.get(hex);
                        info.count++;
                        // Mark as text if ANY element using this color is text
                        if (isText) info.isText = true;
                        if (isLarge) info.isLarge = true;
                    } else {
                        colorMap.set(hex, { hex, isText, isLarge, count: 1 });
                    }
                }
            });
        });
        
        return Array.from(colorMap.values());
    };

    const handleOptimize = async () => {
        setA11yStatus(`Processing SVG... ${new Date().toLocaleTimeString()}`);
        
        try {
            if (!svgInput) return;

            let svgCode = svgInput;

            // 1. SVGO Optimization (Safe config with a11y preservation)
            try {
                const result = optimize(svgCode, {
                    plugins: [
                        {
                            name: 'preset-default',
                            params: {
                                overrides: {
                                    // Preserve accessibility attributes
                                    removeViewBox: false,
                                    removeTitle: false,
                                    removeDesc: false
                                }
                            }
                        },
                        'removeDimensions',
                        {
                            name: 'removeAttrs',
                            params: { 
                                attrs: '(data-.*)',
                                // Preserve all ARIA and accessibility attributes
                                preserveCurrentColor: true
                            } 
                        }
                    ]
                });
                if (result.data) svgCode = result.data;
            } catch (optErr) {
                console.warn('SVGO Optimization failed, using raw input:', optErr);
                // Continue with raw SVG if optimization fails
            }
            
            let doc = new DOMParser().parseFromString(svgCode, 'image/svg+xml');
            let svgEl = doc.querySelector('svg');

            if (!svgEl) throw new Error("Invalid SVG: Could not parse <svg> element.");

            // Force namespace if missing (fix for some browsers)
            if (!svgEl.getAttribute('xmlns')) {
                svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }

            // 2. A11y Wizard
            const titleId = generateId('title');
            const descId = generateId('desc');

            if (intent === 'decorative') {
                svgEl.setAttribute('role', 'presentation');
                svgEl.setAttribute('aria-hidden', 'true');
                // Remove existing a11y tags
                svgEl.querySelectorAll('title, desc').forEach(e => e.remove());
                svgEl.removeAttribute('aria-label');
                svgEl.removeAttribute('aria-labelledby');
            } else if (intent === 'informational') {
                svgEl.setAttribute('role', 'img');
                svgEl.removeAttribute('aria-hidden');
                
                // Handle Title
                let titleEl = svgEl.querySelector('title');
                if (!titleEl) {
                    titleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'title');
                    svgEl.prepend(titleEl);
                }
                titleEl.textContent = meta.title;
                titleEl.id = titleId;

                // Handle Desc
                let descEl = svgEl.querySelector('desc');
                if (meta.desc) {
                        if (!descEl) {
                        descEl = doc.createElementNS('http://www.w3.org/2000/svg', 'desc');
                        titleEl.after(descEl);
                    }
                    descEl.textContent = meta.desc;
                    descEl.id = descId;
                    svgEl.setAttribute('aria-labelledby', `${titleId} ${descId}`);
                } else {
                    if(descEl) descEl.remove();
                    svgEl.setAttribute('aria-labelledby', titleId);
                }
                
            } else if (intent === 'interactive') {
                // Minimal base for interactive - usually requires manual verification, 
                // but we can ensure it's not hidden.
                svgEl.removeAttribute('aria-hidden');
                svgEl.removeAttribute('role'); // Or specific role if known
                
                // Ensure focusable
                if(!svgEl.hasAttribute('tabindex')) {
                    svgEl.setAttribute('tabindex', '0');
                }
            }

            // 3. Theming & Colors
            // Collect unique colors for CSS vars
            const allEls = svgEl.querySelectorAll('*');
            const uniqueC = new Set();
            const colorMap = new Map(); // hex -> var name

            allEls.forEach(el => {
                ['fill', 'stroke'].forEach(attr => {
                    const val = el.getAttribute(attr);
                    if (val && val.startsWith('#')) {
                        const lowerVal = val.toLowerCase();
                        uniqueC.add(lowerVal);

                        // Apply any user-specified dark mode / override mapping
                        if (darkModeColors[lowerVal]) {
                            el.setAttribute(attr, darkModeColors[lowerVal]);
                        } else if (options.useCurrentColor) {
                            el.setAttribute(attr, 'currentColor');
                        } else if (options.useCssVars) {
                            const varName = `--svg-color-${lowerVal.replace('#', '')}`;
                            colorMap.set(lowerVal, varName);
                        }
                    }
                });
            });

            // Inject CSS Variables style block if enabled
            if (options.useCssVars && colorMap.size > 0) {
                const varsStyleId = 'css-vars-style';
                let varsStyleEl = svgEl.querySelector(`#${varsStyleId}`);
                if (!varsStyleEl) {
                    varsStyleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
                    varsStyleEl.id = varsStyleId;
                    svgEl.prepend(varsStyleEl);
                }
                
                // Define CSS variables
                let varsCss = ':root {\n';
                colorMap.forEach((varName, hex) => {
                    varsCss += `  ${varName}: ${hex};\n`;
                });
                varsCss += '}\n';
                
                // Apply variables to elements
                allEls.forEach(el => {
                    ['fill', 'stroke'].forEach(attr => {
                        const val = el.getAttribute(attr);
                        if (val && val.startsWith('#')) {
                            const varName = colorMap.get(val.toLowerCase());
                            if (varName) {
                                el.setAttribute(attr, `var(${varName})`);
                            }
                        }
                    });
                });
                
                varsStyleEl.textContent = varsCss;
            }

            // Inject Dark Mode Style Block
            if (options.injectDarkMode) {
                    const styleId = 'dark-mode-style';
                    let styleEl = svgEl.querySelector(`#${styleId}`);
                    if (!styleEl) {
                        styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
                        styleEl.id = styleId;
                        svgEl.append(styleEl);
                    }
                    
                    let cssContent = `@media (prefers-color-scheme: dark) { \n`;
                    const definedColors = Object.keys(darkModeColors);
                    
                    if (definedColors.length > 0) {
                        // This is a naive implementation: it assumes we want to map ALL instances of a color
                        // To do this robustly, we'd need to add classes to elements matching the color.
                        // For this 'single-file' scope, we will try to target by attribute selector or class
                        
                        // Strategy: Add classes to elements with specific colors
                        allEls.forEach(el => {
                            ['fill', 'stroke'].forEach(attr => {
                                const val = el.getAttribute(attr);
                                if(val && darkModeColors[val.toLowerCase()]) {
                                    const colorKey = val.toLowerCase().replace('#', '');
                                    el.classList.add(`${attr}-${colorKey}`);
                                }
                            });
                        });

                        // Write CSS rules (separate fill and stroke)
                        Object.entries(darkModeColors).forEach(([src, target]) => {
                            if(target) {
                                const colorKey = src.toLowerCase().replace('#', '');
                                cssContent += `  .fill-${colorKey} { fill: ${target}; }\n`;
                                cssContent += `  .stroke-${colorKey} { stroke: ${target}; }\n`;
                            }
                        });
                    }
                    cssContent += `}`;
                    styleEl.textContent = cssContent;
            }

            const serializer = new XMLSerializer();
            const finalCode = serializer.serializeToString(svgEl);

            // Generate Previews
            // 1. Light Preview: Must disable dark mode styles (remove the style block)
            const lightClone = svgEl.cloneNode(true);
            const lightStyle = lightClone.querySelector('#dark-mode-style');
            if (lightStyle) lightStyle.remove();
            
            // 2. Dark Preview: Must force dark mode styles (unwrap @media if present)
            const darkClone = svgEl.cloneNode(true);
            const darkStyle = darkClone.querySelector('#dark-mode-style');
            if (darkStyle && darkStyle.textContent.includes('@media')) {
               const css = darkStyle.textContent;
               const match = css.match(/@media[^{]+\{([\s\S]*)\}\s*$/);
               if (match && match[1]) {
                   darkStyle.textContent = match[1];
               }
            } else if (!darkStyle && options.useCurrentColor) {
               // If Using CurrentColor but no specific dark mode overrides,
               // we want the dark preview to show white strokes/fills so it's visible on black bg.
               // The container is .preview-dark { color: #fff; } so currentColor works automatically.
            }
            
            const lightCode = serializer.serializeToString(lightClone);
            const darkCode = serializer.serializeToString(darkClone);

            // Debug
            console.log('Generated Preview Light:', lightCode.slice(0, 50) + '...');
            console.log('Generated Preview Dark:', darkCode.slice(0, 50) + '...');

            setProcessedSvg({ code: finalCode, light: lightCode, dark: darkCode });
            setA11yStatus(`SVG processed successfully at ${new Date().toLocaleTimeString()}`);

        } catch (e) {
            console.error(e);
            setA11yStatus(`Error: ${e.message}`);
        }
    };

    // --- Effects ---

    const fetchRandomSvg = async (attemptsLeft = 3) => {
        try {
            setA11yStatus('Loading random sample...');
            const manifestRes = await fetch('svg/manifest.json');
            if (manifestRes.ok) {
                const files = await manifestRes.json();
                if (files.length > 0) {
                    // Get the last 3 loaded SVGs from localStorage
                    const history = JSON.parse(localStorage.getItem('svgHistory') || '[]');
                    
                    // Filter out files that were loaded in the last 3 sessions
                    const availableFiles = files.filter(f => !history.includes(f));
                    
                    // If all files have been used recently, reset history and use all files
                    const filesToChooseFrom = availableFiles.length > 0 ? availableFiles : files;
                    
                    // Select a random file from available options
                    const randomFile = filesToChooseFrom[Math.floor(Math.random() * filesToChooseFrom.length)];
                    
                    // Use encodeURIComponent to handle spaces/special chars in filename
                    const svgRes = await fetch(`svg/${encodeURIComponent(randomFile)}`);
                    if (svgRes.ok) {
                        const text = await svgRes.text();
                        if (text.trim().length > 0) {
                            // Update history: add to front, keep only last 3
                            const newHistory = [randomFile, ...history].slice(0, 3);
                            localStorage.setItem('svgHistory', JSON.stringify(newHistory));
                            
                            setSvgInput(text);
                            setCurrentFileName(randomFile);
                            setA11yStatus(`Loaded sample SVG: ${randomFile}`);
                        } else {
                            console.error(`SVG file is empty: ${randomFile}`);
                            if (attemptsLeft > 0) {
                                setA11yStatus(`${randomFile} is empty, trying another...`);
                                fetchRandomSvg(attemptsLeft - 1);
                            } else {
                                setA11yStatus('Error: All random attempts failed.');
                            }
                        }
                    } else {
                         console.error(`Failed to load ${randomFile}: ${svgRes.statusText}`);
                         if (attemptsLeft > 0) {
                             setA11yStatus(`Failed to load ${randomFile}, trying another...`);
                             fetchRandomSvg(attemptsLeft - 1);
                         } else {
                             setA11yStatus('Error: All random attempts failed.');
                         }
                    }
                }
            }
        } catch (err) {
            console.warn('Could not load sample SVG:', err);
            setA11yStatus(`Error loading sample: ${err.message}`);
        }
    };

    // Load random SVG on mount
    useEffect(() => {
        fetchRandomSvg();
    }, []);

    // Load persisted settings (overrides, split, filters)
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('darkModeColors') || '{}');
            setDarkModeColors(saved);
        } catch (e) {
            // ignore
        }
        const savedSplit = parseFloat(localStorage.getItem('previewSplit'));
        if (!Number.isNaN(savedSplit)) setPreviewSplit(savedSplit);
        const savedFilter = localStorage.getItem('filterTextOnly');
        if (savedFilter !== null) setFilterTextOnly(savedFilter === 'true');
    }, []);

    // Persist overrides, split and filter choices
    useEffect(() => {
        try {
            localStorage.setItem('darkModeColors', JSON.stringify(darkModeColors || {}));
            localStorage.setItem('previewSplit', String(previewSplit));
            localStorage.setItem('filterTextOnly', filterTextOnly ? 'true' : 'false');
        } catch (e) {
            // ignore storage errors
        }
    }, [darkModeColors, previewSplit, filterTextOnly]);

    useEffect(() => {
        if (svgInput && intent) {
            handleOptimize();
        }
    }, [svgInput, intent, meta, options, darkModeColors]);

    useEffect(() => {
        if(svgInput) {
                const foundColors = parseColors(svgInput);
                setColors(foundColors);
        }
    }, [svgInput]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const file = e.dataTransfer.files[0];
        // Basic validation: check mime type or extension
        if (file && (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg'))) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setSvgInput(event.target.result);
                setCurrentFileName(file.name);
                setA11yStatus(`Loaded file: ${file.name}`);
            };
            reader.readAsText(file);
        } else {
            setA11yStatus('Error: Please drop a valid SVG file.');
        }
    };

    const handleResizerMouseDown = (e) => {
        e.preventDefault();
        const container = previewContainerRef.current;
        if (!container) return;

        isResizingRef.current = true;

        const handleMouseMove = (moveEvent) => {
            if (!isResizingRef.current) return;
            if (moveEvent.cancelable) moveEvent.preventDefault();

            const point = moveEvent.touches && moveEvent.touches.length
                ? moveEvent.touches[0]
                : moveEvent;

            const rect = container.getBoundingClientRect();
            const newSplit = ((point.clientX - rect.left) / rect.width) * 100;

            if (newSplit >= 20 && newSplit <= 80) {
                setPreviewSplit(newSplit);
            }
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleMouseMove);
            document.removeEventListener('touchend', handleMouseUp);
            document.removeEventListener('touchcancel', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleMouseMove, { passive: false });
        document.addEventListener('touchend', handleMouseUp);
        document.addEventListener('touchcancel', handleMouseUp);
    };


    // --- Render ---

    const getIntentLabel = () => {
        if (intent === 'decorative') return { label: 'Decorative', class: 'decorative', icon: 'Decor' };
        if (intent === 'informational') return { label: 'Informational', class: 'informational', icon: 'Info' };
        if (intent === 'interactive') return { label: 'Interactive', class: 'interactive', icon: 'Action' };
        return { label: 'Unknown', class: '', icon: '?' };
    };
    const currentIntent = getIntentLabel();

    return h('div', { class: 'app-layout' }, [
        
        // --- Sidebar ---
        h('aside', { class: 'sidebar' }, [
            h('header', {}, [
                h('h1', {}, 'A11y-SVG-Studio'),
                h('p', {}, 'Optimize & Accessify')
            ]),

            // 1. Input & Intent Widget
            h('div', { class: 'sidebar-section' }, [
                h('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
                    h('span', { class: 'sidebar-label' }, '1. Input & Intent'),
                    h('button', { class: 'small secondary', onClick: fetchRandomSvg, title: 'Load new sample' }, 'Random')
                ]),
                
                // Intent Status Widget
                h('div', { class: 'intent-widget' }, [
                    h('div', { class: 'intent-status' }, [
                        h('div', { class: `status-dot ${currentIntent.class}` }),
                        h('span', {}, currentIntent.label)
                    ]),
                    h('button', { 
                        class: 'icon-btn', 
                        title: 'Edit Accessibility Settings',
                        onClick: openMetaDialog
                    }, '⚙️')
                ]),
                
                currentFileName && h('div', { 
                    style: 'font-size: 0.75rem; color: #666; margin-bottom: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' 
                }, `Loaded: ${currentFileName}`),

                h('textarea', { 
                    id: 'svg-code', 
                    value: svgInput, 
                    onInput: (e) => {
                        setSvgInput(e.target.value);
                        setCurrentFileName(''); // Clear filename on manual edit
                    },
                    onDragOver: handleDragOver,
                    onDrop: handleDrop,
                    placeholder: 'Paste SVG or drag file here...'
                })
            ]),

            // 2. Theming
            h('div', { class: 'sidebar-section' }, [
                h('span', { class: 'sidebar-label' }, '2. Theming'),
                h('label', { class: 'radio-item' }, [
                    h('input', { 
                        type: 'checkbox', 
                        checked: options.useCurrentColor,
                        onChange: (e) => setOptions({ ...options, useCurrentColor: e.target.checked })
                    }),
                    ' Use currentColor'
                ]),
                h('label', { class: 'radio-item' }, [
                    h('input', { 
                        type: 'checkbox', 
                        checked: options.injectDarkMode,
                        onChange: (e) => setOptions({ ...options, injectDarkMode: e.target.checked })
                    }),
                    ' Inject Media Query'
                ])
            ]),

            // 3. Colors & Contrast
            colors.length > 0 && h('div', { class: 'sidebar-section' }, [
                h('span', { class: 'sidebar-label' }, `Colors (${colors.length})`),
                
                // Contrast Mode Selector
                h('div', { style: 'margin-bottom: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;' }, [
                    h('label', { class: 'radio-item', style: 'margin: 0;' }, [
                        h('input', { type: 'radio', name: 'contrast-mode', checked: contrastMode === 'wcag', onChange: () => setContrastMode('wcag'), style: 'margin: 0;' }),
                        'WCAG'
                    ]),
                    h('label', { class: 'radio-item', style: 'margin: 0;' }, [
                        h('input', { type: 'radio', name: 'contrast-mode', checked: contrastMode === 'apca', onChange: () => setContrastMode('apca'), style: 'margin: 0;' }),
                        'APCA'
                    ])
                ]),
                
                // Text Evaluation Option
                h('label', { class: 'radio-item', style: 'font-size: 0.8rem;' }, [
                    h('input', { 
                        type: 'checkbox',
                        checked: showTextAsNonText,
                        onChange: (e) => setShowTextAsNonText(e.target.checked),
                        style: 'margin: 0;'
                    }),
                    ' Override: Treat text as graphics'
                ]),
                h('label', { class: 'radio-item', style: 'font-size: 0.8rem;' }, [
                    h('input', { type: 'checkbox', checked: filterTextOnly, onChange: (e) => setFilterTextOnly(e.target.checked), style: 'margin:0;' }),
                    ' Show only text colors'
                ]),
                
                // Background Color Configuration
                h('div', { style: 'margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border);' }, [
                    h('div', { style: 'font-size: 0.75rem; font-weight: bold; margin-bottom: 0.3rem;' }, 'Test Backgrounds'),
                    
                    h('div', { style: 'display: flex; gap: 0.3rem; align-items: center; margin-bottom: 0.3rem;' }, [
                        h('label', { style: 'font-size: 0.75rem;' }, 'Light:'),
                        h('input', { 
                            type: 'color',
                            value: bgLight,
                            onChange: (e) => setBgLight(e.target.value),
                            title: 'Light mode background color',
                            style: 'width: 24px; height: 24px; padding: 0; border: 1px solid #ccc; cursor: pointer;'
                        }),
                        h('code', { style: 'font-size: 0.65rem;' }, bgLight)
                    ]),
                    
                    h('div', { style: 'display: flex; gap: 0.3rem; align-items: center;' }, [
                        h('label', { style: 'font-size: 0.75rem;' }, 'Dark:'),
                        h('input', { 
                            type: 'color',
                            value: bgDark,
                            onChange: (e) => setBgDark(e.target.value),
                            title: 'Dark mode background color',
                            style: 'width: 24px; height: 24px; padding: 0; border: 1px solid #ccc; cursor: pointer;'
                        }),
                        h('code', { style: 'font-size: 0.65rem;' }, bgDark)
                    ])
                ]),
                
                h('div', { class: 'color-list' }, colors.filter(ci => !filterTextOnly || ci.isText).map(colorInfo => {
                    const c = colorInfo.hex;
                    const isText = colorInfo.isText && !showTextAsNonText;
                    const isLarge = colorInfo.isLarge;
                    
                    let lightRatio, darkRatio, lightLc, darkLc, lightLevel, darkLevel;
                    
                    if (contrastMode === 'wcag') {
                        lightRatio = getContrastRatio(c, bgLight);
                        darkRatio = getContrastRatio(c, bgDark);
                        lightLevel = getWCAGLevel(lightRatio, isText, isLarge);
                        darkLevel = getWCAGLevel(darkRatio, isText, isLarge);
                    } else {
                        lightLc = getAPCAContrast(c, bgLight);
                        darkLc = getAPCAContrast(c, bgDark);
                        lightLevel = getAPCALevel(lightLc);
                        darkLevel = getAPCALevel(darkLc);
                    }
                    
                    return h('div', { class: 'color-item' }, [
                         h('div', { 
                             style: `width:16px; height:16px; background:${c}; border:1px solid #ccc; flex-shrink:0; border-radius: 2px;`,
                             title: `${c} (${colorInfo.isText ? 'text' : 'graphic'}${colorInfo.isLarge ? ', large' : ''})`
                         }),
                         h('code', { style: 'font-size:0.75rem;' }, c),
                         h('span', { style: `font-size: 0.65rem; color: #666; font-weight: ${colorInfo.isText ? 700 : 400};` }, `(${colorInfo.isText ? 'T' : 'G'}${colorInfo.isLarge ? 'L' : ''})`),
                        options.injectDarkMode && h('input', { 
                               type: 'color', 
                               style: 'width:20px; height:20px; padding:0; border:none; background:none; cursor: pointer;',
                               title: 'Dark mode color override',
                               value: darkModeColors[c] || '',
                               onInput: (e) => setDarkModeColors({ ...darkModeColors, [c]: e.target.value })
                        }),
                        // Single Toggle Override: apply suggested accessible color (or revert if already applied)
                        h('button', { 
                            class: 'small',
                            style: 'margin-left:6px;',
                            title: 'Apply or revert an accessible override',
                            onClick: () => {
                                const current = darkModeColors[c];
                                if (current) {
                                    // revert
                                    const copy = { ...darkModeColors };
                                    delete copy[c];
                                    setDarkModeColors(copy);
                                    // keep prevOverrides for possible re-apply
                                    setA11yStatus(`Reverted override for ${c}`);
                                    setTimeout(() => setA11yStatus(''), 1200);
                                } else {
                                    // compute suggestion and apply
                                    const suggested = suggestAccessibleColor(c, bgLight, bgDark, isText, contrastMode);
                                    if (suggested && suggested !== c) {
                                        setPrevOverrides({ ...prevOverrides, [c]: null });
                                        setDarkModeColors({ ...darkModeColors, [c]: suggested });
                                        setA11yStatus(`Applied suggestion ${suggested} for ${c}`);
                                        setTimeout(() => setA11yStatus(''), 1600);
                                    } else {
                                        // Fallback quick swap (black or white)
                                        const fallback = isText ? '#000000' : '#ffffff';
                                        setPrevOverrides({ ...prevOverrides, [c]: null });
                                        setDarkModeColors({ ...darkModeColors, [c]: fallback });
                                        setA11yStatus(`Applied fallback ${fallback} for ${c}`);
                                        setTimeout(() => setA11yStatus(''), 1600);
                                    }
                                }
                            }
                        }, current ? 'Revert' : 'Toggle Override'),
                         h('div', { style: 'margin-left:auto; display:flex; gap:2px; align-items:center;' }, [
                            // Light Mode
                            h('div', { 
                                class: `contrast-badge ${lightLevel === 'Fail' ? 'fail' : lightLevel === 'AAA' ? 'aaa' : 'aa'}`,
                                title: contrastMode === 'wcag' 
                                    ? `Light: ${lightRatio.toFixed(2)}:1 (need ${isText ? isLarge ? '3:1' : '4.5:1' : '3:1'})` 
                                    : `Light: ${lightLc.toFixed(1)} Lc (need ${isText ? '75+' : '60+'} Lc)`
                            }, 
                            contrastMode === 'wcag' ? lightRatio.toFixed(1) : lightLc.toFixed(0)),
                            
                            // Dark Mode
                            h('div', { 
                                class: `contrast-badge ${darkLevel === 'Fail' ? 'fail' : darkLevel === 'AAA' ? 'aaa' : 'aa'}`,
                                title: contrastMode === 'wcag'
                                    ? `Dark: ${darkRatio.toFixed(2)}:1 (need ${isText ? isLarge ? '3:1' : '4.5:1' : '3:1'})`
                                    : `Dark: ${darkLc.toFixed(1)} Lc (need ${isText ? '75+' : '60+'} Lc)`
                            }, 
                            contrastMode === 'wcag' ? darkRatio.toFixed(1) : darkLc.toFixed(0))
                        ])
                    ]);
                }))
            ])
            ,
            // Revert All Overrides
            h('div', { class: 'sidebar-section' }, [
                h('button', {
                    class: 'small',
                    onClick: () => {
                        if (!confirm('Revert ALL color overrides? This will remove dark-mode overrides.')) return;
                        // Move current overrides into prevOverrides so per-color revert can still work
                        setPrevOverrides({ ...prevOverrides, ...darkModeColors });
                        setDarkModeColors({});
                        setA11yStatus('All overrides reverted');
                        setTimeout(() => setA11yStatus(''), 2000);
                    }
                }, 'Revert All Overrides')
            ])
        ]),

        // --- Main Content ---
        h('main', { class: 'main-content' }, [
            
            // Preview Section with Resizer
            h('div', { class: 'preview-container', ref: previewContainerRef, style: `display: grid; grid-template-columns: ${previewSplit}% ${100 - previewSplit}%;` }, [
                // Light
                h('div', { class: 'preview-pane' }, [
                    h('div', { class: 'preview-header' }, 'Light Mode'),
                    h('div', { class: 'preview-viewport preview-light' }, [
                         h('div', { 
                             style: 'width:100%; height:100%; display:flex; align-items:center; justify-content:center;',
                             dangerouslySetInnerHTML: { __html: processedSvg.light || '' } 
                         })
                    ])
                ]),
                // Dark
                h('div', { class: 'preview-pane' }, [
                    h('div', { class: 'preview-header' }, 'Dark Mode'),
                     h('div', { class: 'preview-viewport preview-dark' }, [
                         h('div', { 
                             style: 'width:100%; height:100%; display:flex; align-items:center; justify-content:center;',
                             dangerouslySetInnerHTML: { __html: processedSvg.dark || '' } 
                         })
                    ])
                ]),
                // Resizer Handle
                h('div', { 
                    class: 'preview-resizer', 
                    style: `left: ${previewSplit}%;`,
                    onMouseDown: handleResizerMouseDown,
                    onTouchStart: handleResizerMouseDown,
                    role: 'separator',
                    'aria-orientation': 'vertical',
                    'aria-label': 'Resize preview split'
                })
            ]),

            // Output Section
            h('div', { class: 'code-output-section' }, [
                h('div', { class: 'code-output-header' }, [
                    h('strong', {}, 'Optimized Code'),
                    h('button', { 
                        class: 'small',
                        onClick: () => {
                            navigator.clipboard.writeText(processedSvg.code);
                            setA11yStatus('Copied!');
                            setTimeout(() => setA11yStatus(''), 2000);
                        }
                    }, 'Copy Code')
                ]),
                h('pre', { class: 'code-content' }, processedSvg.code)
            ]),

            // Dialog for Intent & Meta
            h('dialog', { ref: dialogRef }, [
                h('h3', {}, 'Accessibility Settings'),
                
                h('div', { class: 'form-group' }, [
                    h('label', {}, 'Intent:'),
                    h('div', { class: 'radio-group' }, [
                        h('div', { class: 'radio-item' }, [
                            h('input', { type: 'radio', name: 'd-intent', checked: tempIntent === 'decorative', onChange: () => setTempIntent('decorative') }),
                            ' Decorative (Hidden)'
                        ]),
                        h('div', { class: 'radio-item' }, [
                            h('input', { type: 'radio', name: 'd-intent', checked: tempIntent === 'informational', onChange: () => setTempIntent('informational') }),
                            ' Informational (Title & Desc)'
                        ]),
                        h('div', { class: 'radio-item' }, [
                            h('input', { type: 'radio', name: 'd-intent', checked: tempIntent === 'interactive', onChange: () => setTempIntent('interactive') }),
                            ' Interactive (Focusable)'
                        ])
                    ])
                ]),

                tempIntent === 'informational' && h('div', { style: 'margin-top:1rem;' }, [
                    h('div', { class: 'form-group' }, [
                        h('label', { for: 'popup-title' }, 'Title (Required)'),
                        h('input', { 
                            type: 'text', id: 'popup-title', 
                            value: tempMeta.title,
                            onInput: (e) => setTempMeta({ ...tempMeta, title: e.target.value })
                        })
                    ]),
                    h('div', { class: 'form-group' }, [
                        h('label', { for: 'popup-desc' }, 'Description'),
                        h('textarea', { 
                            id: 'popup-desc', rows: 2, 
                            value: tempMeta.desc,
                            onInput: (e) => setTempMeta({ ...tempMeta, desc: e.target.value })
                        })
                    ])
                ]),

                h('div', { class: 'btn-group', style: 'justify-content: flex-end; margin-top:1.5rem;' }, [
                    h('button', { class: 'secondary', onClick: () => closeMetaDialog(false) }, 'Cancel'),
                    h('button', { 
                        onClick: () => closeMetaDialog(true),
                        disabled: tempIntent === 'informational' && !tempMeta.title
                    }, 'Save Changes')
                ])
            ]),

            // Status Messages (Top right toast or similar? Let's keep visually hidden mainly unless error)
             a11yStatus.startsWith('Error') && h('div', { 
                style: 'position:absolute; bottom:1rem; right:1rem; padding: 1rem; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index:100;' 
            }, a11yStatus),
             h('div', { role: 'status', 'aria-live': 'polite', class: 'visually-hidden' }, a11yStatus)

        ])
    ]);
};

// Clear loading state and render
const root = document.getElementById('app');
if (root) root.innerHTML = '';
render(h(App), root);
