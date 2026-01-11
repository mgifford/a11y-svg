import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useMemo } from 'https://esm.sh/preact@10.19.3/hooks';
import { optimize } from 'https://esm.sh/svgo@3.2.0/dist/svgo.browser.js';
import xmlFormatter from 'https://esm.sh/xml-formatter@3.6.0';

// --- Utils & Helpers ---

function generateId(prefix = 'id') {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatXml(xml) {
    const PADDING = '  ';
    let pad = 0;
    return xml
        .replace(/>\s+</g, '><')
        .replace(/</g, '\n<')
        .trim()
        .split('\n')
        .map(line => {
            if (line.match(/^<\//)) pad = Math.max(pad - 1, 0);
            const formatted = `${PADDING.repeat(pad)}${line}`;
            if (line.match(/^<[^!?][^>]*[^/]>/)) pad += 1;
            return formatted;
        })
        .join('\n')
        .replace(/^\s+/, '');
}

function beautifySvg(svg) {
    if (!svg) return '';
    try {
        // First try a dedicated XML formatter for stable indentation
        return xmlFormatter(svg, { indentation: '  ', lineSeparator: '\n' }).trim();
    } catch (e) {
        // Fallback to DOM parse + simple formatter
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svg, 'image/svg+xml');
            if (doc.querySelector('parsererror')) return svg;
            const serializer = new XMLSerializer();
            const raw = serializer.serializeToString(doc);
            return formatXml(raw);
        } catch (err) {
            return svg;
        }
    }
}

// Extract first <title> and <desc> text from an SVG string
function extractMetaFromSvg(svg) {
    try {
        const doc = new DOMParser().parseFromString(svg || '', 'image/svg+xml');
        const t = doc.querySelector('title');
        const d = doc.querySelector('desc');
        return {
            title: (t && t.textContent) ? t.textContent.trim() : '',
            desc: (d && d.textContent) ? d.textContent.trim() : ''
        };
    } catch (e) {
        return { title: '', desc: '' };
    }
}

const BEAUTIFIED_DISPLAY_SUFFIX = '\n\n\n\n\n';
const OPTIMIZED_DISPLAY_SUFFIX = '\n\n';

function normalizeHex(hex) {
    if (!hex) return null;
    const h = hex.trim().toLowerCase();
    if (/^#([0-9a-f]{3}){1,2}$/i.test(h)) {
        if (h.length === 4) {
            return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
        }
        return h;
    }
    return null;
}

function normalizeColorToken(token) {
    if (!token) return null;
    const direct = normalizeHex(token);
    if (direct) return direct;
    if (token === 'none') return null;
    try {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = token;
        const computed = ctx.fillStyle; // returns rgb(...)
        if (computed.startsWith('#')) return normalizeHex(computed);
        if (computed.startsWith('rgb')) {
            const nums = computed.match(/\d+/g);
            if (!nums) return null;
            const [r, g, b] = nums.map(n => Number(n));
            const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
            return hex;
        }
    } catch (e) {
        return null;
    }
    return null;
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
    const [elementOverrides, setElementOverrides] = useState({}); // data-a11y-id -> color
    const [elementMap, setElementMap] = useState({}); // data-a11y-id -> { orig, attr, isText, isLarge }
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
    const editorTimerRef = useRef(null);
    const [lintResults, setLintResults] = useState([]);
    const [lintPanelVisible, setLintPanelVisible] = useState(() => {
        try {
            const stored = localStorage.getItem('lintPanelVisible');
            if (stored === 'false') return false;
            if (stored === 'true') return true;
        } catch (e) {}
        return true;
    });
    const rawInputTimerRef = useRef(null);
    const [originalCode, setOriginalCode] = useState('');
    const [beautifiedCode, setBeautifiedCode] = useState('');
    const [optimizedCode, setOptimizedCode] = useState('');
    const [activeEditorTab, setActiveEditorTab] = useState('beautified');
    const [recentHighlightTokens, setRecentHighlightTokens] = useState([]);
    const highlightTimersRef = useRef({});
    const [hoveredColor, setHoveredColor] = useState(null);
    const beautifiedTextareaRef = useRef(null);
    const optimizedTextareaRef = useRef(null);
    const latestSvgRef = useRef('');
    const lintListRef = useRef(null);
    const fileInputRef = useRef(null);
    const [accordionState, setAccordionState] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('accordionState') || '{"finalize":true}');
        } catch (e) { return { finalize: true }; }
    });

    // Theme (system/light/dark)
    const [theme, setTheme] = useState(() => {
        try { return localStorage.getItem('theme') || 'system'; } catch (e) { return 'system'; }
    });

    // --- Helpers ---

    const addHighlightToken = (token) => {
        if (!token) return;
        const norm = normalizeHex(token) || token;
        if (!norm) return;
        setRecentHighlightTokens(prev => {
            const filtered = prev.filter(t => t !== norm);
            return [...filtered, norm];
        });
        if (highlightTimersRef.current[norm]) clearTimeout(highlightTimersRef.current[norm]);
        highlightTimersRef.current[norm] = setTimeout(() => {
            setRecentHighlightTokens(prev => prev.filter(t => t !== norm));
            delete highlightTimersRef.current[norm];
        }, 6000);
    };

    const combinedHighlightTokens = useMemo(() => {
        const set = new Set(recentHighlightTokens);
        if (hoveredColor) set.add(hoveredColor);
        return Array.from(set);
    }, [recentHighlightTokens, hoveredColor]);

    const onIntentChange = (newIntent) => {
        setIntent(newIntent);
        setUserHasInteracted(true);
    };

    // Filename-like detection: avoid using filenames as title/desc
    const looksLikeFilename = (s) => {
        if (!s) return false;
        const str = String(s).trim();
        if (/\.[a-z0-9]{2,4}$/i.test(str)) return true; // has extension
        if (/[\\/]/.test(str)) return true; // path-like
        const base = (currentFileName || '').replace(/\.[^/.]+$/, '').toLowerCase();
        if (base && str.toLowerCase() === base) return true; // matches file basename
        return false;
    };

    const countWords = (s) => (String(s || '').trim().split(/\s+/).filter(Boolean).length);

    const computeIntentDisplay = () => {
        const t = (meta.title || '').trim();
        const d = (meta.desc || '').trim();
        const hasTitle = t.length > 0;
        const hasDesc = d.length > 0;
        const titleWords = countWords(t);
        const descWords = countWords(d);
        const titleLooksFile = looksLikeFilename(t);
        const descLooksFile = looksLikeFilename(d);

        if (!hasTitle && !hasDesc) return { display: 'Decorative', statusClass: 'status-yellow' };
        if (hasDesc && !hasTitle) return { display: 'Error', statusClass: 'status-red' };
        const isGood = hasTitle && hasDesc && titleWords >= 1 && titleWords <= 3 && descWords >= 5 && !titleLooksFile && !descLooksFile;
        return { display: 'Informative', statusClass: isGood ? 'status-green' : '' };
    };

    const handleInlineMetaChange = (field, value) => {
        setUserHasInteracted(true);
        const nextMeta = { ...meta, [field]: value };
        setMeta(nextMeta);
        const hasTitle = String(nextMeta.title || '').trim().length > 0;
        setIntent(hasTitle ? 'informational' : 'decorative');
    };

    const triggerFilePicker = () => {
        if (fileInputRef.current) fileInputRef.current.click();
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
        const colorMap = new Map(); // key -> { hex, isText, isLarge, count, originals: Set }
        const elements = doc.querySelectorAll('*');

        // collect CSS variables from <style> blocks
        const cssVars = {};
        const styleEls = doc.querySelectorAll('style');
        styleEls.forEach(s => {
            const txt = s.textContent || '';
            // simple regex to capture --var: value;
            const re = /(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+)\s*;/g;
            let m;
            while ((m = re.exec(txt)) !== null) {
                cssVars[m[1].trim()] = m[2].trim();
            }
        });

        // helper to resolve color tokens (hex, var(), currentColor, color-mix)
        const resolveColorValue = (val, el) => {
            if (!val) return null;
            const v = val.trim();
            // direct hex
            const hexRe = /^#([0-9a-fA-F]{3,8})$/;
            const mhex = v.match(hexRe);
            if (mhex) {
                // normalize 3-char to 6-char
                let h = mhex[0].toLowerCase();
                if (h.length === 4) {
                    h = '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
                }
                return h;
            }
            // var(--name)
            const varRe = /^var\((--[a-zA-Z0-9-_]+)\)$/i;
            const mv = v.match(varRe);
            if (mv) {
                const name = mv[1];
                const resolved = cssVars[name];
                if (resolved) return resolveColorValue(resolved, el);
                return null;
            }
            // currentColor -> attempt to read from element or svg root styles
            if (v === 'currentColor') {
                // check inline style on element or nearest svg root
                let cur = null;
                const styleAttr = el.getAttribute && el.getAttribute('style');
                if (styleAttr) {
                    const m = styleAttr.match(/color\s*:\s*([^;]+)/);
                    if (m) cur = m[1].trim();
                }
                if (!cur) {
                    const svgRoot = doc.querySelector('svg');
                    if (svgRoot) {
                        const rootStyle = svgRoot.getAttribute && svgRoot.getAttribute('style');
                        if (rootStyle) {
                            const m2 = rootStyle.match(/color\s*:\s*([^;]+)/);
                            if (m2) cur = m2[1].trim();
                        }
                        // also check attribute color
                        if (!cur) cur = svgRoot.getAttribute('color');
                    }
                }
                if (cur) return resolveColorValue(cur, el);
                return null;
            }
            // color-mix(in srgb, A 70%, B) basic parser
            const mixRe = /color-mix\([^,]+,\s*([^\s,]+)\s*(\d+)%?\s*,\s*([^\)]+)\)/i;
            const mm = v.match(mixRe);
            if (mm) {
                const a = mm[1];
                const pct = parseFloat(mm[2]) / 100.0;
                const b = mm[3].trim();
                const ah = resolveColorValue(a, el);
                let bh = resolveColorValue(b, el);
                if (!bh) {
                    // if b is 'transparent' or not resolvable, choose white as fallback
                    bh = '#ffffff';
                }
                if (ah) {
                    return mixHex(ah, bh, pct);
                }
                return null;
            }
            // rgb(), rgba(), named colors basic handling: try to use canvas to convert
            try {
                const ctx = document.createElement('canvas').getContext('2d');
                ctx.fillStyle = v;
                const rgba = ctx.fillStyle; // returns rgb(...) or #rrggbb
                if (rgba) return resolveColorValue(rgba, el);
            } catch (e) {}
            return null;
        };

        const mixHex = (hexA, hexB, weightA) => {
            const a = hexToRgb(hexA);
            const b = hexToRgb(hexB);
            const r = Math.round(a.r * weightA + b.r * (1 - weightA));
            const g = Math.round(a.g * weightA + b.g * (1 - weightA));
            const bl = Math.round(a.b * weightA + b.b * (1 - weightA));
            return rgbToHex({ r, g, b: bl });
        };

        elements.forEach(el => {
            const isText = isTextElement(el);
            const isLarge = isText ? isLargeText(el) : false;

            // check fill and stroke attributes and inline styles
            const tryAttrs = [];
            ['fill', 'stroke'].forEach(attr => {
                const av = el.getAttribute(attr);
                if (av) tryAttrs.push({ token: av, attr });
            });
            // inline style string
            const styleAttr = el.getAttribute && el.getAttribute('style');
            if (styleAttr) {
                // find fill:... and stroke:...
                const mfill = styleAttr.match(/fill\s*:\s*([^;]+)/i);
                if (mfill) tryAttrs.push({ token: mfill[1].trim(), attr: 'fill', inline: true });
                const mstroke = styleAttr.match(/stroke\s*:\s*([^;]+)/i);
                if (mstroke) tryAttrs.push({ token: mstroke[1].trim(), attr: 'stroke', inline: true });
            }

            tryAttrs.forEach(item => {
                const orig = item.token;
                const hex = resolveColorValue(orig, el);
                if (!hex) return;
                const key = hex;
                if (colorMap.has(key)) {
                    const info = colorMap.get(key);
                    info.count++;
                    if (isText) info.isText = true;
                    if (isLarge) info.isLarge = true;
                    info.originals.add(orig);
                } else {
                    colorMap.set(key, { hex: key, isText: isText, isLarge: isLarge, count: 1, originals: new Set([orig]) });
                }
            });
        });

        // convert map to array
        return Array.from(colorMap.values()).map(v => ({ hex: v.hex, isText: v.isText, isLarge: v.isLarge, count: v.count, originals: Array.from(v.originals) }));
    };

    // Linting: parse SVG, report XML errors and accessibility issues (WCAG 2.2 AA + APCA)
    const lintSvg = (svgString) => {
        const issues = [];
        if (!svgString || svgString.trim().length === 0) return issues;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgString, 'image/svg+xml');
            // DOMParser places parse errors in <parsererror>
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                const txt = parserError.textContent || 'XML parse error';
                issues.push({ level: 'error', message: `XML parse error: ${txt.trim().slice(0,200)}` });
                return issues;
            }
            const svgEl = doc.querySelector('svg');
            if (!svgEl) {
                issues.push({ level: 'error', message: 'No <svg> element found' });
                return issues;
            }

            // Meta checks: title/desc for informational intent
            // Check user-provided meta (Accessibility Intent block), not raw SVG tags
            // This avoids false positives when user has filled in the form but hasn't clicked Save yet.
            if (intent === 'informational') {
                if (!meta.title) issues.push({ level: 'error', message: 'Missing Title in Accessibility Intent (required for informational SVG)' });
                if (!meta.desc) issues.push({ level: 'warning', message: 'Missing Description in Accessibility Intent (recommended for informational SVG)' });
            }

            // Color contrast checks
            const colorList = parseColors(svgString);
            colorList.forEach(c => {
                const hex = c.hex;
                const isText = !!c.isText;
                const isLarge = !!c.isLarge;
                const originals = c.originals || [];
                // WCAG: compute against both light and dark backgrounds
                const ratioLight = getContrastRatio(hex, bgLight);
                const ratioDark = getContrastRatio(hex, bgDark);
                const worstRatio = Math.min(ratioLight, ratioDark);
                const wcagLevel = getWCAGLevel(worstRatio, isText, isLarge);
                if (wcagLevel === 'Fail') {
                    // suggest a color using suggestAccessibleColor
                    const suggested = suggestAccessibleColor(hex, bgLight, bgDark, isText, contrastMode);
                    issues.push({ level: 'warning', message: `Color ${hex} fails WCAG contrast (ratios: ${ratioLight.toFixed(2)} / ${ratioDark.toFixed(2)}) for ${isText ? 'text' : 'graphics'}`, type: 'color', hex, originals, suggested });
                }

                // APCA: check signed Lc values
                const apcaLight = getAPCAContrast(hex, bgLight);
                const apcaDark = getAPCAContrast(hex, bgDark);
                const absLight = Math.abs(apcaLight);
                const absDark = Math.abs(apcaDark);
                // thresholds: AA ~75
                if (absLight < 75 && absDark < 75) {
                    const suggested2 = suggestAccessibleColor(hex, bgLight, bgDark, isText, 'apca');
                    issues.push({ level: 'warning', message: `Color ${hex} fails APCA (Lc: ${apcaLight.toFixed(1)} / ${apcaDark.toFixed(1)})`, type: 'color', hex, originals, suggested: suggested2 });
                }
            });

        } catch (e) {
            issues.push({ level: 'error', message: `Lint error: ${e && e.message ? e.message : String(e)}` });
        }
        return issues;
    };


    // Apply a color fix: replace original tokens in the editor code with newHex
    const applyColorFix = (originalToken, newHex) => {
        if (!originalToken || !newHex) return;
        const src = beautifiedCode || processedSvg.code || svgInput || '';
        const statusLabel = `Replaced ${originalToken} → ${newHex}`;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(src, 'image/svg+xml');
            const svgEl = doc.querySelector('svg');
            if (!svgEl) throw new Error('No <svg> root found');

            const replaceInStyleBlocks = (token, hex) => {
                const styleEls = doc.querySelectorAll('style');
                let changed = false;
                styleEls.forEach(s => {
                    let txt = s.textContent || '';
                    // replace CSS variable declaration --name: ...;
                    const varNameMatch = token.match(/^--[a-zA-Z0-9-_]+$/);
                    if (varNameMatch) {
                        const re = new RegExp(`(${token})\\s*:\\s*([^;]+);`, 'g');
                        if (re.test(txt)) {
                            txt = txt.replace(re, `$1: ${hex};`);
                            changed = true;
                        }
                    }
                    // replace var(--name) usages
                    const varUsageMatch = token.match(/^var\((--[a-zA-Z0-9-_]+)\)$/);
                    if (varUsageMatch) {
                        const vname = varUsageMatch[1];
                        const re2 = new RegExp(`var\\(\\s*${vname}\\s*\\)`, 'g');
                        if (re2.test(txt)) {
                            txt = txt.replace(re2, hex);
                            changed = true;
                        }
                    }
                    // replace direct occurrences of the token in style blocks (e.g., fill: token;)
                    const tokenEsc = token.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
                    const re3 = new RegExp(`(:\\s*)${tokenEsc}((\\s*;)|\\)|\\s)`, 'g');
                    if (re3.test(txt)) {
                        txt = txt.replace(re3, `$1${hex}$2`);
                        changed = true;
                    }
                    if (changed) s.textContent = txt;
                });
                return changed;
            };

            const replaceInAttributesAndStyles = (token, hex) => {
                const elements = doc.querySelectorAll('*');
                let changed = false;
                elements.forEach(el => {
                    ['fill', 'stroke'].forEach(attr => {
                        const val = el.getAttribute(attr);
                        if (val && val.trim() === token) {
                            el.setAttribute(attr, hex);
                            changed = true;
                        }
                    });
                    // inline style
                    const styleAttr = el.getAttribute('style');
                    if (styleAttr && styleAttr.indexOf(token) !== -1) {
                        const newStyle = styleAttr.replace(new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g'), hex);
                        el.setAttribute('style', newStyle);
                        changed = true;
                    }
                });
                return changed;
            };

            let didChange = false;
            // If token is a CSS var name (--name) or var(--name) prefer updating declarations/usages
            if (/^--[a-zA-Z0-9-_]+$/.test(originalToken) || /^var\(--[a-zA-Z0-9-_]+\)$/.test(originalToken)) {
                didChange = replaceInStyleBlocks(originalToken, newHex) || replaceInAttributesAndStyles(originalToken, newHex);
            } else {
                // handle color-mix or direct tokens: update style blocks and attributes
                didChange = replaceInStyleBlocks(originalToken, newHex) || replaceInAttributesAndStyles(originalToken, newHex);
                // also replace direct occurrences in CSS rules not captured above
                if (!didChange) didChange = replaceInStyleBlocks(originalToken, newHex);
            }

            let updated = null;
            if (didChange) {
                const serializer = new XMLSerializer();
                updated = serializer.serializeToString(doc);
            } else {
                // Fallback to global text replace
                const esc = originalToken.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
                const re = new RegExp(esc, 'g');
                updated = src.replace(re, newHex);
            }

            const beautified = beautifySvg(updated);
            addHighlightToken(originalToken);
            addHighlightToken(newHex);
            commitBeautifiedChange(beautified, statusLabel);
        } catch (e) {
            const esc = originalToken.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
            const re = new RegExp(esc, 'g');
            const updated = src.replace(re, newHex);
            const beautified = beautifySvg(updated);
            addHighlightToken(originalToken);
            addHighlightToken(newHex);
            commitBeautifiedChange(beautified, `${statusLabel} (fallback)`);
        }
    };

    async function handleOptimize(customSvg) {
        setA11yStatus(`Processing SVG... ${new Date().toLocaleTimeString()}`);
        
        try {
            const sourceCode = typeof customSvg === 'string' ? customSvg : svgInput;
            if (!sourceCode) return;

            let svgCode = sourceCode;

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
            // Annotate elements with data-a11y-id so we can target them individually
            const tempElementMap = {};
            let a11yCounter = 0;
            // Determine preview container computed colors for currentColor resolution
            const previewLightColor = '#000000'; // .preview-light color from CSS
            const previewDarkColor = '#ffffff'; // .preview-dark color from CSS

            allEls.forEach(el => {
                if (el.hasAttribute('fill') || el.hasAttribute('stroke')) {
                    const id = `a11y-${a11yCounter++}`;
                    el.setAttribute('data-a11y-id', id);
                    // Track original color(s for both previews) for this element
                    let fill = el.getAttribute('fill');
                    let stroke = el.getAttribute('stroke');

                    // Resolve currentColor for text-like elements
                    if (fill && fill === 'currentColor') {
                        // store placeholder — actual decision per-preview later
                        fill = { current: true, light: previewLightColor, dark: previewDarkColor };
                    }
                    if (stroke && stroke === 'currentColor') {
                        stroke = { current: true, light: previewLightColor, dark: previewDarkColor };
                    }

                    tempElementMap[id] = { fill, stroke, isText: isTextElement(el), isLarge: isTextElement(el) ? isLargeText(el) : false };
                }
            });
            allEls.forEach(el => {
                ['fill', 'stroke'].forEach(attr => {
                    const val = el.getAttribute(attr);
                    if (val && val.startsWith('#')) {
                        const lowerVal = val.toLowerCase();
                        uniqueC.add(lowerVal);

                        // Apply any user-specified dark mode / override mapping
                        // First apply element-specific override if present
                        const id = el.getAttribute('data-a11y-id');
                        if (id && elementOverrides[id] && elementOverrides[id][attr]) {
                            el.setAttribute(attr, elementOverrides[id][attr]);
                        } else if (darkModeColors[lowerVal]) {
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

            // Save element map state for UI reference
            setElementMap(tempElementMap);

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
            setOptimizedCode(finalCode);
            // Keep editable view in sync with optimized output
            const beautifiedFinal = beautifySvg(finalCode);
            setBeautifiedCode(beautifiedFinal);
            setSvgInput(beautifiedFinal);
            setA11yStatus(`SVG processed successfully at ${new Date().toLocaleTimeString()}`);

        } catch (e) {
            console.error(e);
            setA11yStatus(`Error: ${e.message}`);
        }
    }

    const commitBeautifiedChange = (newCode, statusMsg = 'Preview updated') => {
        const code = newCode || '';
        setBeautifiedCode(code);
        setSvgInput(code);
        // Keep meta in sync if user edits SVG code directly
        const parsedMeta = extractMetaFromSvg(code);
        const nextTitle = parsedMeta.title || '';
        const nextDesc = parsedMeta.desc || '';
        if (nextTitle !== meta.title || nextDesc !== meta.desc) {
            setMeta({ title: nextTitle, desc: nextDesc });
            setIntent(nextTitle ? 'informational' : 'decorative');
        }
        try {
            setLintResults(lintSvg(code));
        } catch (er) {
            setLintResults([{ level: 'error', message: String(er) }]);
        }
        if (editorTimerRef.current) clearTimeout(editorTimerRef.current);
        editorTimerRef.current = setTimeout(() => {
            handleOptimize(code);
            setA11yStatus(statusMsg);
            setTimeout(() => setA11yStatus(''), 900);
        }, 500);
    };

    const ingestOriginalInput = (rawCode, statusMsg = 'Source updated') => {
        const source = rawCode || '';
        // Seed meta & intent from existing SVG
        try {
            const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
            const svgEl = doc.querySelector('svg');
            const tEl = svgEl && svgEl.querySelector('title');
            const dEl = svgEl && svgEl.querySelector('desc');
            const tText = (tEl && tEl.textContent) ? tEl.textContent.trim() : '';
            const dText = (dEl && dEl.textContent) ? dEl.textContent.trim() : '';
            setMeta({ title: tText, desc: dText });
            setIntent(tText ? 'informational' : 'decorative');
        } catch (e) { /* ignore parse errors */ }

        setOriginalCode(source);
        const pretty = source ? beautifySvg(source) : '';
        setActiveEditorTab('beautified');
        commitBeautifiedChange(pretty, statusMsg);
    };

    // Keyboard navigation for lint list: Up/Down to move, Enter to trigger Fix
    const handleLintKeyDown = (e) => {
        const container = lintListRef.current;
        if (!container) return;
        const items = container.querySelectorAll('.lint-item');
        if (!items || items.length === 0) return;
        const active = document.activeElement;
        let idx = Array.prototype.indexOf.call(items, active);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(items.length - 1, Math.max(0, idx + 1));
            items[next].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = Math.max(0, (idx === -1 ? 0 : idx) - 1);
            items[prev].focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
            // trigger Fix button inside focused item
            if (active && active.classList && active.classList.contains('lint-item')) {
                const btn = active.querySelector('button.small');
                if (btn) btn.click();
            }
        }
    };

    // --- Effects ---

    // Lint after processing completes
    useEffect(() => {
        try {
            const l = lintSvg(processedSvg.code || '');
            setLintResults(l);
        } catch (e) { setLintResults([{ level: 'error', message: String(e) }]); }
    }, [processedSvg.code, intent, bgLight, bgDark]);

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
                            
                            setCurrentFileName(randomFile);
                            ingestOriginalInput(text, `Loaded sample SVG: ${randomFile}`);
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
        return () => {
            Object.values(highlightTimersRef.current || {}).forEach(timer => clearTimeout(timer));
            if (rawInputTimerRef.current) clearTimeout(rawInputTimerRef.current);
            if (editorTimerRef.current) clearTimeout(editorTimerRef.current);
        };
    }, []);

    useEffect(() => {
        latestSvgRef.current = svgInput || '';
    }, [svgInput]);

    // Apply selected theme
    useEffect(() => {
        const root = document.documentElement;
        if (!root) return;
        if (theme === 'light') {
            root.setAttribute('data-theme', 'light');
        } else if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
        } else {
            root.removeAttribute('data-theme'); // system
        }
        try { localStorage.setItem('theme', theme); } catch (e) {}
    }, [theme]);

    useEffect(() => {
        if (!latestSvgRef.current || !intent) return;
        handleOptimize(latestSvgRef.current);
    }, [intent, meta, options, darkModeColors, elementOverrides]);

    useEffect(() => {
        const styleId = 'hovered-color-style';
        let styleEl = document.getElementById(styleId);
        const norm = normalizeHex(hoveredColor);
        if (!norm) {
            if (styleEl) styleEl.remove();
            return;
        }
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        const upper = norm.toUpperCase();
        styleEl.textContent = `
            .preview-viewport svg [fill="${norm}"],
            .preview-viewport svg [stroke="${norm}"],
            .preview-viewport svg [fill="${upper}"],
            .preview-viewport svg [stroke="${upper}"] {
                outline: 2px solid #ff9800 !important;
                outline-offset: 2px;
            }
        `;
        return () => {
            if (styleEl) styleEl.remove();
        };
    }, [hoveredColor]);

    // Load persisted settings (overrides, split, filters)
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('darkModeColors') || '{}');
            setDarkModeColors(saved);
            const savedElem = JSON.parse(localStorage.getItem('elementOverrides') || '{}');
            setElementOverrides(savedElem);
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
            localStorage.setItem('elementOverrides', JSON.stringify(elementOverrides || {}));
            localStorage.setItem('previewSplit', String(previewSplit));
            localStorage.setItem('filterTextOnly', filterTextOnly ? 'true' : 'false');
        } catch (e) {
            // ignore storage errors
        }
    }, [darkModeColors, previewSplit, filterTextOnly]);

    useEffect(() => {
        try {
            localStorage.setItem('lintPanelVisible', lintPanelVisible ? 'true' : 'false');
        } catch (e) {
            // ignore
        }
    }, [lintPanelVisible]);

    useEffect(() => {
        if (processedSvg && processedSvg.code) {
            const foundColors = parseColors(processedSvg.code);
            setColors(foundColors);
        } else if (svgInput) {
            const foundColors = parseColors(svgInput);
            setColors(foundColors);
        }
    }, [svgInput, processedSvg.code]);

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
                setCurrentFileName(file.name);
                ingestOriginalInput(event.target.result, `Loaded file: ${file.name}`);
            };
            reader.readAsText(file);
        } else {
            setA11yStatus('Error: Please drop a valid SVG file.');
        }
    };

    const handleFileInputChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setCurrentFileName(file.name);
                ingestOriginalInput(event.target.result, `Loaded file: ${file.name}`);
            };
            reader.readAsText(file);
        } else {
            setA11yStatus('Error: Please choose a valid SVG file.');
        }
        e.target.value = '';
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

    // Sidebar resizer
    const handleSidebarResizerMouseDown = (e) => {
        e.preventDefault();
        const startX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        const startWidth = document.querySelector('.sidebar').getBoundingClientRect().width;
        const doMove = (moveEvent) => {
            const point = moveEvent.touches && moveEvent.touches.length ? moveEvent.touches[0] : moveEvent;
            const dx = point.clientX - startX;
            const newW = Math.max(200, Math.min(720, startWidth + dx));
            document.querySelector('.sidebar').style.width = newW + 'px';
        };
        const stop = () => {
            document.removeEventListener('mousemove', doMove);
            document.removeEventListener('mouseup', stop);
            document.removeEventListener('touchmove', doMove);
            document.removeEventListener('touchend', stop);
        };
        document.addEventListener('mousemove', doMove);
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchmove', doMove, { passive: false });
        document.addEventListener('touchend', stop);
    };

    // Editor resizer (resize bottom editor height)
    const handleEditorResizerMouseDown = (e) => {
        e.preventDefault();
        const editorEl = document.querySelector('.bottom-editor');
        if (!editorEl) return;
        const startY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
        const startH = editorEl.getBoundingClientRect().height;
        const doMove = (moveEvent) => {
            const point = moveEvent.touches && moveEvent.touches.length ? moveEvent.touches[0] : moveEvent;
            const dy = startY - point.clientY; // dragging up increases height
            const newH = Math.max(80, Math.min(window.innerHeight * 0.8, startH + dy));
            editorEl.style.height = newH + 'px';
        };
        const stop = () => {
            document.removeEventListener('mousemove', doMove);
            document.removeEventListener('mouseup', stop);
            document.removeEventListener('touchmove', doMove);
            document.removeEventListener('touchend', stop);
        };
        document.addEventListener('mousemove', doMove);
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchmove', doMove, { passive: false });
        document.addEventListener('touchend', stop);
    };


    // --- Render ---

    const getIntentLabel = () => {
        if (intent === 'decorative') return { label: 'Decorative', class: 'decorative', icon: 'Decor' };
        if (intent === 'informational') return { label: 'Informational', class: 'informational', icon: 'Info' };
        if (intent === 'interactive') return { label: 'Interactive', class: 'interactive', icon: 'Action' };
        return { label: 'Unknown', class: '', icon: '?' };
    };
    const currentIntent = getIntentLabel();
    const canonicalBeautified = beautifiedCode || svgInput || '';
    const canonicalOriginal = originalCode || svgInput || '';
    const canonicalOptimized = optimizedCode || processedSvg.code || '';
    const beautifiedDisplay = useMemo(() => (canonicalBeautified || '') + BEAUTIFIED_DISPLAY_SUFFIX, [canonicalBeautified]);
    const optimizedDisplay = useMemo(() => (canonicalOptimized || '') + OPTIMIZED_DISPLAY_SUFFIX, [canonicalOptimized]);
    // Size metrics
    const sizeOf = (s) => (s ? s.length : 0);
    const fmtKB = (n) => `${(n / 1024).toFixed(1)} KB`;
    const pctDiff = (base, val) => {
        if (!base) return null;
        const d = ((val - base) / base) * 100;
        const sign = d > 0 ? '+' : '';
        return `${sign}${d.toFixed(0)}%`;
    };
    const oSize = sizeOf(canonicalOriginal);
    const bSize = sizeOf(canonicalBeautified);
    const zSize = sizeOf(canonicalOptimized);
    const editorTabs = [
        { id: 'original', label: 'Original', hint: `Raw input • ${fmtKB(oSize)}` },
        { id: 'beautified', label: 'Beautified', hint: `Editable source • ${fmtKB(bSize)}${oSize ? ` (${pctDiff(oSize, bSize)})` : ''}` },
        { id: 'optimized', label: 'Optimized', hint: `SVGO output • ${fmtKB(zSize)}${oSize ? ` (${pctDiff(oSize, zSize)})` : ''}` }
    ];

    return h('div', { class: 'app-layout' }, [
        
        // --- Sidebar ---
        h('aside', { class: 'sidebar' }, [
            h('header', {}, [
                h('h1', {}, 'A11y-SVG-Studio'),
                h('div', { class: 'theme-control' }, [
                    h('label', { for: 'theme-select' }, 'Theme:'),
                    h('select', {
                        id: 'theme-select',
                        class: 'theme-select',
                        value: theme,
                        onChange: (e) => setTheme(e.target.value),
                        'aria-label': 'Interface theme'
                    }, [
                        h('option', { value: 'system' }, 'System'),
                        h('option', { value: 'light' }, 'Light'),
                        h('option', { value: 'dark' }, 'Dark')
                    ])
                ])
            ]),

            h('div', { class: 'sidebar-section input-card' }, [
                h('span', { class: 'sidebar-label' }, 'Input & Samples'),
                h('p', { class: 'sidebar-note' }, 'Drag an SVG here or click to pick a file.'),
                h('div', {
                    class: 'dropzone',
                    role: 'button',
                    tabIndex: 0,
                    onClick: triggerFilePicker,
                    onKeyDown: (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            triggerFilePicker();
                        }
                    },
                    onDragOver: handleDragOver,
                    onDrop: handleDrop,
                    'aria-label': 'Drop or pick an SVG file'
                }, [
                    h('div', { class: 'dropzone-title' }, 'Drop SVG to load'),
                    h('div', { class: 'dropzone-hint' }, 'Supports drag & drop, paste, or file picker')
                ]),
                h('div', { class: 'input-actions' }, [
                    h('button', { class: 'small secondary', onClick: fetchRandomSvg, title: 'Load new sample' }, 'Random')
                ]),
                h('input', { type: 'file', accept: 'image/svg+xml', ref: fileInputRef, style: 'display:none', onChange: handleFileInputChange })
            ]),

            (() => {
                const disp = computeIntentDisplay();
                const cardClass = `sidebar-section intent-card${disp.statusClass ? ' ' + disp.statusClass : ''}`;
                return h('div', { class: cardClass }, [
                    h('span', { class: 'sidebar-label' }, `Accessibility Intent: ${disp.display}`),
                    h('div', { class: 'intent-inline' }, [
                        h('div', { class: 'intent-status' }, [
                            h('div', { class: `status-dot ${disp.display.toLowerCase()}` }),
                            h('span', {}, disp.display)
                        ])
                    ]),
                    h('div', { class: 'meta-fields' }, [
                        h('label', { class: 'meta-field' }, [
                            h('span', {}, 'Title'),
                            h('input', {
                                type: 'text',
                                value: meta.title,
                                placeholder: 'Add a short, unique title',
                                onInput: (e) => handleInlineMetaChange('title', e.target.value)
                            })
                        ]),
                        h('label', { class: 'meta-field' }, [
                            h('span', {}, 'Description'),
                            h('textarea', {
                                rows: 2,
                                value: meta.desc,
                                placeholder: 'Describe the visual meaning',
                                onInput: (e) => handleInlineMetaChange('desc', e.target.value)
                            })
                        ])
                    ]),
                    looksLikeFilename(meta.title) && h('p', { class: 'meta-hint warning' }, 'Title looks like a filename. Use human-readable words.'),
                    looksLikeFilename(meta.desc) && h('p', { class: 'meta-hint warning' }, 'Description looks like a filename. Use a sentence.'),
                    (!meta.title || !meta.desc) && h('p', { class: 'meta-hint' }, 'If this image conveys meaning, add a title and description so screen readers announce it.'),
                    h('div', { style: 'margin-top:0.5rem;' }, [
                        h('button', { 
                            class: 'small', 
                            onClick: () => { 
                                const hasTitle = String(meta.title || '').trim().length > 0; 
                                setIntent(hasTitle ? 'informational' : 'decorative'); 
                                handleOptimize(latestSvgRef.current || svgInput || ''); 
                                setA11yStatus('Accessibility meta saved'); 
                                setTimeout(() => setA11yStatus(''), 1000); 
                            },
                            title: 'Save accessibility title/description into the SVG'
                        }, 'Save')
                    ])
                ]);
            })(),

            // 1. Theming
            h('div', { class: 'sidebar-section' }, [
                h('span', { class: 'sidebar-label' }, '1. Theming'),
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

            // 2. Colors & Contrast
            colors.length > 0 && h('div', { class: 'sidebar-section' }, [
                h('span', { class: 'sidebar-label' }, `2. Colors (${colors.length})`),
                
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
                
                (() => {
                    const hoveredHex = normalizeHex(hoveredColor);
                    return h('div', { class: 'color-list' }, colors.filter(ci => !filterTextOnly || ci.isText).map((colorInfo, idx) => {
                    const c = colorInfo.hex;
                    const isText = colorInfo.isText && !showTextAsNonText;
                    const isLarge = colorInfo.isLarge;
                    const isOverridden = !!darkModeColors[c];
                        const normalizedColor = normalizeHex(c);
                        const isHighlighted = hoveredHex && normalizedColor && hoveredHex === normalizedColor;
                    
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
                    
                        return h('div', { 
                            key: `${c}-${idx}`,
                            class: `color-item${isHighlighted ? ' is-highlighted' : ''}`,
                            onMouseEnter: () => setHoveredColor(c),
                            onMouseLeave: () => setHoveredColor(null),
                            onFocusCapture: () => setHoveredColor(c),
                            onBlurCapture: (e) => {
                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                    setHoveredColor(null);
                                }
                            }
                        }, [
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
                        // A11y button: only show if this color is used by text and fails the WCAG text threshold (4.5:1)
                        (colorInfo.isText && (
                            (contrastMode === 'wcag' && (lightLevel === 'Fail' || darkLevel === 'Fail')) ||
                            (contrastMode === 'apca' && (Math.abs(getAPCAContrast(c, bgLight)) < 75 || Math.abs(getAPCAContrast(c, bgDark)) < 75))
                        )) && h('button', {
                            class: 'small secondary',
                            style: 'margin-left:6px;',
                            title: 'Apply per-element accessible fix for problematic uses of this color',
                            onClick: () => {
                                // Find elements using this color and apply elementOverrides per-element
                                // Build a copy and apply suggestions only to elements that fail contrast in light or dark
                                const newElem = { ...elementOverrides };
                                Object.entries(elementMap).forEach(([id, info]) => {
                                    // Determine which attr (fill/stroke) matches this base color
                                    ['fill', 'stroke'].forEach(attr => {
                                        const val = info[attr];
                                        if (!val) return;

                                        // Resolve value: if currentColor placeholder, evaluate per preview
                                        const matchesBaseColor = (v) => {
                                            try { return v.toLowerCase() === c.toLowerCase(); } catch(e){ return false; }
                                        };

                                        // If this element uses currentColor, check both light and dark resolved colors
                                        if (typeof val === 'object' && val.current) {
                                            const testLight = val.light;
                                            const testDark = val.dark;
                                            const lightFail = (contrastMode === 'wcag') ? getWCAGLevel(getContrastRatio(testLight, bgLight), info.isText, info.isLarge) === 'Fail' : getAPCALevel(getAPCAContrast(testLight, bgLight)) === 'Fail';
                                            const darkFail = (contrastMode === 'wcag') ? getWCAGLevel(getContrastRatio(testDark, bgDark), info.isText, info.isLarge) === 'Fail' : getAPCALevel(getAPCAContrast(testDark, bgDark)) === 'Fail';
                                            if (lightFail || darkFail) {
                                                const suggested = suggestAccessibleColor(lightFail ? testLight : testDark, bgLight, bgDark, info.isText, contrastMode);
                                                if (!newElem[id]) newElem[id] = {};
                                                newElem[id][attr] = suggested;
                                            }
                                        } else {
                                            const sval = val.toLowerCase();
                                            if (sval === c.toLowerCase()) {
                                                const testColor = sval;
                                                const lightFail = (contrastMode === 'wcag') ? getWCAGLevel(getContrastRatio(testColor, bgLight), info.isText, info.isLarge) === 'Fail' : getAPCALevel(getAPCAContrast(testColor, bgLight)) === 'Fail';
                                                const darkFail = (contrastMode === 'wcag') ? getWCAGLevel(getContrastRatio(testColor, bgDark), info.isText, info.isLarge) === 'Fail' : getAPCALevel(getAPCAContrast(testColor, bgDark)) === 'Fail';
                                                if (lightFail || darkFail) {
                                                    const suggested = suggestAccessibleColor(testColor, lightFail ? bgLight : bgDark, darkFail ? bgDark : bgLight, info.isText, contrastMode);
                                                    if (!newElem[id]) newElem[id] = {};
                                                    newElem[id][attr] = suggested;
                                                }
                                            }
                                        }
                                    });
                                });
                                setElementOverrides(newElem);
                                setA11yStatus('Applied per-element suggestions');
                                setTimeout(() => setA11yStatus(''), 1400);
                            }
                        }, 'A11y'),

                        // Quick Toggle: apply/revert a color-level override (keeps older behavior)
                        h('button', {
                            class: 'small',
                            style: 'margin-left:6px;',
                            title: 'Quick toggle color-level override (fallback if needed)',
                            onClick: () => {
                                if (isOverridden) {
                                    const copy = { ...darkModeColors };
                                    delete copy[c];
                                    setDarkModeColors(copy);
                                    setA11yStatus(`Reverted override for ${c}`);
                                    setTimeout(() => setA11yStatus(''), 900);
                                } else {
                                    const suggested = suggestAccessibleColor(c, bgLight, bgDark, isText, contrastMode);
                                    const fallback = suggested && suggested !== c ? suggested : (isText ? '#000000' : '#ffffff');
                                    setPrevOverrides({ ...prevOverrides, [c]: null });
                                    setDarkModeColors({ ...darkModeColors, [c]: fallback });
                                    setA11yStatus(`Applied quick override ${fallback} for ${c}`);
                                    setTimeout(() => setA11yStatus(''), 1200);
                                }
                            }
                        }, isOverridden ? 'Revert' : 'Toggle Override'),
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
                }));
                })()
            ])

            ,
            // 3. Finalize (Accordion)
            h('div', { class: 'accordion', role: 'region', 'aria-expanded': accordionState.finalize ? 'true' : 'false', id: 'finalize-accordion' }, [
                h('div', { class: 'accordion-header', onClick: (e) => {
                    const next = { ...accordionState, finalize: !accordionState.finalize };
                    setAccordionState(next);
                    try { localStorage.setItem('accordionState', JSON.stringify(next)); } catch (err) {}
                } }, [
                    h('span', {}, 'Finalize'),
                    h('span', { class: 'chev' }, '▸')
                ]),
                h('div', { class: 'accordion-content' }, [
                    h('div', { style: 'display:flex; gap:0.5rem; align-items:center; justify-content:flex-start;' }, [
                        h('button', { class: 'small', onClick: () => {
                            if (!processedSvg || !processedSvg.code) return setA11yStatus('No optimized code to copy');
                            navigator.clipboard.writeText(processedSvg.code);
                            setA11yStatus('Optimized code copied');
                            setTimeout(() => setA11yStatus(''), 1200);
                        } }, 'Copy optimized code'),
                        h('button', { class: 'small secondary', onClick: () => {
                            if (!processedSvg || !processedSvg.code) return setA11yStatus('No optimized code to download');
                            const blob = new Blob([processedSvg.code], { type: 'image/svg+xml' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = (currentFileName && currentFileName.endsWith('.svg')) ? currentFileName.replace(/\.svg$/, '.optimized.svg') : 'optimized.svg';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                            setA11yStatus('Downloaded optimized SVG');
                            setTimeout(() => setA11yStatus(''), 1200);
                        } }, 'Download optimized code')
                    ])
                ])
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
        // resizer between sidebar and main content
        h('div', { class: 'sidebar-resizer', onMouseDown: handleSidebarResizerMouseDown, onTouchStart: handleSidebarResizerMouseDown }),

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

            // Editor resizer handle
            h('div', { class: 'editor-resizer', onMouseDown: handleEditorResizerMouseDown, onTouchStart: handleEditorResizerMouseDown }),
            // Bottom editor with tabbed layout (taller when viewing Optimized)
            h('div', { class: `bottom-editor${activeEditorTab === 'optimized' ? ' large' : ''}` }, [
                h('div', { class: 'editor-tabs', role: 'tablist' }, editorTabs.map(tab => h('button', {
                    key: tab.id,
                    type: 'button',
                    id: `tab-${tab.id}`,
                    role: 'tab',
                    'aria-selected': activeEditorTab === tab.id,
                    'aria-controls': `panel-${tab.id}`,
                    class: `editor-tab${activeEditorTab === tab.id ? ' active' : ''}`,
                    onClick: () => setActiveEditorTab(tab.id)
                }, [
                    h('span', { class: 'tab-label' }, tab.label),
                    h('span', { class: 'tab-hint' }, tab.hint)
                ]))),
                h('div', { class: 'editor-body' }, [
                    activeEditorTab === 'original' && h('div', { class: 'code-panel raw-input-panel', role: 'tabpanel', id: 'panel-original', 'aria-labelledby': 'tab-original' }, [
                        currentFileName && h('div', { class: 'loaded-file' }, `Loaded: ${currentFileName}`),
                        h('textarea', {
                            class: 'raw-input-textarea',
                            value: canonicalOriginal,
                            spellcheck: false,
                            onInput: (e) => {
                                const next = e.target.value;
                                setCurrentFileName('');
                                setOriginalCode(next);
                                if (rawInputTimerRef.current) clearTimeout(rawInputTimerRef.current);
                                rawInputTimerRef.current = setTimeout(() => {
                                    ingestOriginalInput(next, 'Source updated');
                                }, 400);
                            },
                            onDragOver: handleDragOver,
                            onDrop: handleDrop,
                            placeholder: 'Paste SVG or drag file here...',
                            'aria-label': 'Original raw SVG input'
                        })
                    ]),
                    activeEditorTab === 'beautified' && h('div', { class: 'code-panel is-editable', role: 'tabpanel', id: 'panel-beautified', 'aria-labelledby': 'tab-beautified' }, [
                        h('div', { class: 'code-shell' }, [
                            h('textarea', {
                                ref: beautifiedTextareaRef,
                                value: beautifiedDisplay,
                                onInput: (e) => {
                                    const incoming = e.target.value;
                                    const trimmed = incoming.endsWith(BEAUTIFIED_DISPLAY_SUFFIX)
                                        ? incoming.slice(0, -BEAUTIFIED_DISPLAY_SUFFIX.length)
                                        : incoming;
                                    commitBeautifiedChange(trimmed, 'Beautified updated');
                                },
                                spellcheck: false,
                                wrap: 'off',
                                'aria-label': 'Beautified SVG editor'
                            })
                        ])
                    ]),
                    activeEditorTab === 'optimized' && h('div', { class: 'code-panel is-optimized', role: 'tabpanel', id: 'panel-optimized', 'aria-labelledby': 'tab-optimized' }, [
                        h('div', { class: 'code-shell read-only' }, [
                            h('textarea', {
                                ref: optimizedTextareaRef,
                                value: optimizedDisplay,
                                readOnly: true,
                                spellcheck: false,
                                wrap: 'soft',
                                'aria-label': 'Optimized SVG output'
                            })
                        ])
                    ])
                ]),
                recentHighlightTokens.length > 0 && (() => {
                    const hoveredHex = normalizeHex(hoveredColor);
                    const tokensToShow = [...recentHighlightTokens].slice(-6).reverse();
                    return h('div', { class: 'editor-chips', role: 'group', 'aria-label': 'Recent color updates' }, [
                        h('span', { class: 'chip-label' }, 'Recent'),
                        ...tokensToShow.map(token => {
                            const tokenHex = normalizeHex(token);
                            const isActive = tokenHex && hoveredHex && tokenHex === hoveredHex;
                            return h('button', {
                                key: `${token}`,
                                class: `chip${isActive ? ' active' : ''}`,
                                onMouseEnter: () => setHoveredColor(token),
                                onMouseLeave: () => setHoveredColor(null),
                                onFocus: () => setHoveredColor(token),
                                onBlur: () => setHoveredColor(null)
                            }, String(token).toUpperCase());
                        })
                    ]);
                })()
            ]),

            lintPanelVisible ? (() => {
                const combined = [];
                const colorMap = new Map();
                lintResults.forEach(it => {
                    if (it && it.type === 'color' && it.hex) {
                        const key = it.hex.toLowerCase();
                        const entry = colorMap.get(key) || { type: 'color', hex: key, messages: [], originals: new Set(), suggested: null };
                        entry.messages.push(it.message || '');
                        (it.originals || []).forEach(o => entry.originals.add(o));
                        if (it.suggested && !entry.suggested) entry.suggested = it.suggested;
                        colorMap.set(key, entry);
                    } else if (it) {
                        combined.push(it);
                    }
                });
                for (const v of colorMap.values()) {
                    const hex = v.hex;
                    const isText = true;
                    const suggestedWCAG = suggestAccessibleColor(hex, bgLight, bgDark, isText, 'wcag');
                    const suggestedAPCA = suggestAccessibleColor(hex, bgLight, bgDark, isText, 'apca');
                    const passesBoth = (cand) => {
                        try {
                            const r1 = getWCAGLevel(Math.min(getContrastRatio(cand, bgLight), getContrastRatio(cand, bgDark)), isText, false);
                            const ap1 = Math.min(Math.abs(getAPCAContrast(cand, bgLight)), Math.abs(getAPCAContrast(cand, bgDark)));
                            return (r1 === 'AA' || r1 === 'AAA') && ap1 >= 75;
                        } catch (e) { return false; }
                    };
                    let chosen = v.suggested || suggestedWCAG || suggestedAPCA;
                    if (suggestedWCAG && passesBoth(suggestedWCAG)) chosen = suggestedWCAG;
                    else if (suggestedAPCA && passesBoth(suggestedAPCA)) chosen = suggestedAPCA;
                    v.suggested = chosen;
                    v.originals = Array.from(v.originals);
                    v.message = v.messages && v.messages.length ? v.messages.join(' — ') : `Color ${v.hex} has contrast issues`;
                    combined.push(v);
                }

                combined.sort((a, b) => {
                    const la = (a.level === 'error') ? 0 : 1;
                    const lb = (b.level === 'error') ? 0 : 1;
                    return la - lb;
                });

                return h('div', { class: 'lint-panel', role: 'region', 'aria-label': 'Lint results' }, [
                    h('div', { class: 'lint-header' }, [
                        h('span', { class: 'lint-title' }, `Lint: ${lintResults.length} issue${lintResults.length !== 1 ? 's' : ''}`),
                        h('button', { class: 'lint-close', onClick: () => setLintPanelVisible(false), 'aria-label': 'Hide lint panel' }, '×')
                    ]),
                    combined.length === 0 && h('div', { style: 'color: #2b8a3e; padding:0.5rem;' }, 'No issues found'),
                    h('div', { class: 'lint-top' }, combined.slice(0, 2).map((it, idx) => h('div', { key: `top-${idx}`, class: 'lint-item lint-top-item', role: 'listitem', tabIndex: 0, 'aria-label': `${it.hex || ''} issues`, onKeyDown: handleLintKeyDown }, [
                        h('div', { class: 'lint-message' }, Array.isArray(it.messages) ? it.messages.map((m, i) => h('div', { key: `m-${i}` }, m)) : (it.message || '')),
                        h('div', { class: 'lint-action' }, [
                            h('span', { class: 'suggest' }, it.suggested || ''),
                            h('button', { class: 'small', onClick: () => applyColorFix((it.originals && it.originals[0]) || it.hex, it.suggested || it.hex), 'aria-label': `Fix color ${it.hex || ''}` }, 'Fix')
                        ])
                    ]))),
                    h('div', { class: 'lint-list', role: 'list', ref: lintListRef, tabIndex: 0, onKeyDown: handleLintKeyDown }, combined.slice(2).map((it, idx) => h('div', { key: `rest-${idx}`, class: 'lint-item', role: 'listitem', tabIndex: 0, 'aria-label': `${it.hex || ''} issues` }, [
                        h('div', { class: 'lint-message' }, Array.isArray(it.messages) ? it.messages.map((m, i) => h('div', { key: `m-${i}` }, m)) : (it.message || '')),
                        h('div', { class: 'lint-action' }, [
                            h('span', { class: 'suggest' }, it.suggested || ''),
                            h('button', { class: 'small', onClick: () => applyColorFix((it.originals && it.originals[0]) || it.hex, it.suggested || it.hex), 'aria-label': `Fix color ${it.hex || ''}` }, 'Fix')
                        ])
                    ])))
                ]);
            })() : null,

            lintResults.length > 0 && !lintPanelVisible && h('button', {
                class: 'lint-indicator',
                onClick: () => setLintPanelVisible(true),
                'aria-pressed': lintPanelVisible,
                'aria-label': 'Show lint panel'
            }, [
                h('span', { class: 'lint-indicator-dot' }),
                h('span', { class: 'lint-indicator-text' }, `Lint issues: ${lintResults.length}`)
            ]),

            // (Optimized code moved to bottom editor)

            // Intent dialog removed — inline editing covers the workflow

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
