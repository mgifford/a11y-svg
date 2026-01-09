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
    const [a11yStatus, setA11yStatus] = useState('');
    const [currentFileName, setCurrentFileName] = useState('');
    const [contrastMode, setContrastMode] = useState('wcag'); // 'wcag' or 'apca'
    const [bgLight, setBgLight] = useState('#ffffff');
    const [bgDark, setBgDark] = useState('#121212');
    const [showTextAsNonText, setShowTextAsNonText] = useState(false);

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
                        
                        // Replace with currentColor?
                        if (options.useCurrentColor) {
                            el.setAttribute(attr, 'currentColor');
                        } 
                        // Replace with CSS Vars?
                        else if (options.useCssVars) {
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
                
                h('div', { class: 'color-list' }, colors.map(colorInfo => {
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
                         h('span', { style: 'font-size: 0.65rem; color: #666;' }, `(${colorInfo.isText ? 'T' : 'G'}${colorInfo.isLarge ? 'L' : ''})`),
                         options.injectDarkMode && h('input', { 
                                type: 'color', 
                                style: 'width:20px; height:20px; padding:0; border:none; background:none;',
                                title: 'Dark mode color override',
                                onChange: (e) => setDarkModeColors({ ...darkModeColors, [c]: e.target.value })
                         }),
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
        ]),

        // --- Main Content ---
        h('main', { class: 'main-content' }, [
            
            // Preview Section
            h('div', { class: 'preview-container' }, [
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
                ])
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
