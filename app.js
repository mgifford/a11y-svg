import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'https://esm.sh/preact@10.19.3/hooks';
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
        const formatted = xmlFormatter(svg, { indentation: '  ', lineSeparator: '\n' });
        return formatted.endsWith('\n') ? formatted : `${formatted}\n`;
    } catch (e) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svg, 'image/svg+xml');
            if (doc.querySelector('parsererror')) return svg;
            const serializer = new XMLSerializer();
            const raw = serializer.serializeToString(doc);
            const formatted = formatXml(raw);
            return formatted.endsWith('\n') ? formatted : `${formatted}\n`;
        } catch (err) {
            return svg;
        }
    }
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
    const [previewOriginal, setPreviewOriginal] = useState({ light: '', dark: '' });
    const [previewBeautified, setPreviewBeautified] = useState({ light: '', dark: '' });
    const [intent, setIntent] = useState('decorative'); // Default!
    const [userHasInteracted, setUserHasInteracted] = useState(false);
    const dialogRef = useRef(null);
    const [tempMeta, setTempMeta] = useState({ title: '', desc: '' });
    const [tempIntent, setTempIntent] = useState('decorative'); // For Dialog
    const [meta, setMeta] = useState({ title: '', desc: '' });
    const metaIsDirtyRef = useRef(false);
    const [options, setOptions] = useState({
        useCurrentColor: false,
        injectDarkMode: false,
        useCssVars: false
    });
    const [colors, setColors] = useState([]); // [{ hex: '#...', isText: bool, isLarge: bool, count: num }]
    const [darkModeColors, setDarkModeColors] = useState({});

const extractMetaFromSvg = (svgString) => {
    try {
        const doc = new DOMParser().parseFromString(svgString || '', 'image/svg+xml');
        const tEl = doc.querySelector('title');
        const dEl = doc.querySelector('desc');
        return {
            title: (tEl && tEl.textContent) ? tEl.textContent.trim() : '',
            desc: (dEl && dEl.textContent) ? dEl.textContent.trim() : ''
        };
    } catch (err) {
        return { title: '', desc: '' };
    }
};

const BEAUTIFIED_DISPLAY_SUFFIX = '';
const OPTIMIZED_DISPLAY_SUFFIX = '';

const normalizeHex = (hex) => {
    if (!hex) return null;
    const value = hex.trim().toLowerCase();
    if (/^#([0-9a-f]{3})$/i.test(value)) {
        const chars = value.slice(1).split('');
        return `#${chars.map(c => `${c}${c}`).join('')}`;
    }
    if (/^#([0-9a-f]{6})$/i.test(value)) return value;
    if (/^#([0-9a-f]{8})$/i.test(value)) return value.slice(0, 7);
    return null;
};

const normalizeColorToken = (token) => {
    if (!token) return null;
    const trimmed = token.trim().toLowerCase();
    const asHex = normalizeHex(trimmed);
    if (asHex) return asHex;
    if (trimmed === 'none') return null;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = trimmed;
        return normalizeHex(ctx.fillStyle);
    } catch (err) {
        return null;
    }
};

const hexToRgb = (hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return { r: 0, g: 0, b: 0 };
    const intVal = parseInt(normalized.slice(1), 16);
    return {
        r: (intVal >> 16) & 255,
        g: (intVal >> 8) & 255,
        b: intVal & 255
    };
};

const rgbToHex = ({ r, g, b }) => {
    const toHex = (val) => Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getLuminance = ({ r, g, b }) => {
    const srgb = [r, g, b].map((val) => {
        const channel = val / 255;
        return channel <= 0.03928
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const getContrastRatio = (fgHex, bgHex) => {
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    const fgL = getLuminance(fg);
    const bgL = getLuminance(bg);
    const ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);
    return Number(ratio.toFixed(2));
};

const getRelativeLuminanceAPCA = ({ r, g, b }) => {
    const [RsRGB, GsRGB, BsRGB] = [r, g, b].map(v => v / 255);
    const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const Rlin = toLinear(RsRGB);
    const Glin = toLinear(GsRGB);
    const Blin = toLinear(BsRGB);
    return 0.2126729 * Rlin + 0.7151522 * Glin + 0.0721750 * Blin;
};

const getAPCAContrast = (fgHex, bgHex) => {
    const fgL = getRelativeLuminanceAPCA(hexToRgb(fgHex));
    const bgL = getRelativeLuminanceAPCA(hexToRgb(bgHex));
    const contrast = Math.abs((fgL - bgL) * 100);
    return Number(contrast.toFixed(1));
};

const rgbToHsl = ({ r, g, b }) => {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case rNorm:
                h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
                break;
            case gNorm:
                h = (bNorm - rNorm) / d + 2;
                break;
            default:
                h = (rNorm - gNorm) / d + 4;
        }
        h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToRgb = ({ h, s, l }) => {
    const sNorm = s / 100;
    const lNorm = l / 100;

    if (s === 0) {
        const val = Math.round(lNorm * 255);
        return { r: val, g: val, b: val };
    }

    const hueToRgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    const q = lNorm < 0.5
        ? lNorm * (1 + sNorm)
        : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;

    const r = hueToRgb(p, q, h / 360 + 1 / 3);
    const g = hueToRgb(p, q, h / 360);
    const b = hueToRgb(p, q, h / 360 - 1 / 3);

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
};

const suggestAccessibleColor = (hex, bgLight, bgDark, isText, contrastMode) => {
    const targetRatio = contrastMode === 'apca'
        ? (isText ? 75 : 60)
        : (isText ? 4.5 : 3);

    const startRgb = hexToRgb(hex);
    const startHsl = rgbToHsl(startRgb);
    const maxSteps = 30;

    const meetsContrast = (candidate) => {
        if (contrastMode === 'apca') {
            const lightLc = Math.abs(getAPCAContrast(candidate, bgLight));
            const darkLc = Math.abs(getAPCAContrast(candidate, bgDark));
            return Math.min(lightLc, darkLc) >= targetRatio;
        }
        const ratioLight = getContrastRatio(candidate, bgLight);
        const ratioDark = getContrastRatio(candidate, bgDark);
        return Math.min(ratioLight, ratioDark) >= targetRatio;
    };

    for (let step = 1; step <= maxSteps; step++) {
        const delta = step * 1.5;
        const candidates = [
            Math.min(100, startHsl.l + delta),
            Math.max(0, startHsl.l - delta)
        ].map(lVal => rgbToHex(hslToRgb({ h: startHsl.h, s: startHsl.s, l: lVal })));
        for (const candidate of candidates) {
            if (meetsContrast(candidate)) return candidate;
        }
    }

    for (let step = 1; step <= 20; step++) {
        const newS = Math.max(0, startHsl.s - step * 4);
        const candidate = rgbToHex(hslToRgb({ h: startHsl.h, s: newS, l: startHsl.l }));
        if (meetsContrast(candidate)) return candidate;
    }

    for (let dh = -18; dh <= 18; dh += 3) {
        for (let dl = -12; dl <= 12; dl += 3) {
            const candidate = rgbToHex(hslToRgb({
                h: (startHsl.h + dh + 360) % 360,
                s: startHsl.s,
                l: Math.min(100, Math.max(0, startHsl.l + dl))
            }));
            if (meetsContrast(candidate)) return candidate;
        }
    }

    const white = '#ffffff';
    if (meetsContrast(white)) return white;
    const black = '#000000';
    if (meetsContrast(black)) return black;
    return hex;
};

const isTextElement = (el) => {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (['text', 'tspan', 'textpath', 'title'].includes(tag)) return true;
    if (el.childNodes && el.childNodes.length > 0) {
        for (const node of el.childNodes) {
            if (node.nodeType === 3 && node.textContent.trim().length > 0) return true;
            if (node.nodeType === 1 && isTextElement(node)) return true;
        }
    }
    return false;
};

const getFontSize = (el) => {
    const fontSizeAttr = el.getAttribute && el.getAttribute('font-size');
    if (fontSizeAttr) {
        const parsed = parseFloat(fontSizeAttr);
        if (!Number.isNaN(parsed)) return parsed;
    }
    const styleAttr = el.getAttribute && el.getAttribute('style');
    if (styleAttr) {
        const match = styleAttr.match(/font-size\s*:\s*([0-9.]+)(px|pt|rem|em)/i);
        if (match) {
            const val = parseFloat(match[1]);
            if (!Number.isNaN(val)) {
                const unit = match[2].toLowerCase();
                if (unit === 'px') return val;
                if (unit === 'pt') return val * (96 / 72);
                if (unit === 'rem' || unit === 'em') return val * 16;
            }
        }
    }
    return 12;
};

const isLargeText = (el) => {
    const size = getFontSize(el);
    const weightAttr = el.getAttribute && el.getAttribute('font-weight');
    const weight = weightAttr ? weightAttr.toLowerCase() : 'normal';
    const isBold = weight === 'bold' || parseInt(weight, 10) >= 700;
    return size >= 18 || (isBold && size >= 14);
};

const getAPCALevel = (contrast) => {
    const abs = Math.abs(contrast);
    if (abs >= 90) return 'AAA';
    if (abs >= 75) return 'AA';
    return 'Fail';
};

const ensureElementId = (element, prefix, doc) => {
    if (!element) return '';
    const existing = (element.getAttribute('id') || '').trim();
    if (existing) return existing;
    let candidate = '';
    do {
        candidate = generateId(prefix);
    } while (doc && doc.getElementById(candidate));
    element.setAttribute('id', candidate);
    return candidate;
};

const buildLightDarkPreview = (svgString) => {
    const empty = { light: '', dark: '' };
    if (!svgString || !svgString.trim()) return empty;
    try {
        const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (!svgEl) return empty;
        const serializer = new XMLSerializer();

        const ensureNamespace = (el) => {
            if (!el.getAttribute('xmlns')) {
                el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }
        };

        const stripDarkMode = (clone) => {
            const style = clone.querySelector('#dark-mode-style');
            if (style) style.remove();
        };

        const forceDarkMode = (clone) => {
            const style = clone.querySelector('#dark-mode-style');
            if (style && style.textContent.includes('@media')) {
                const match = style.textContent.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*{([\s\S]*)}$/);
                if (match && match[1]) {
                    style.textContent = match[1].replace(/}\s*$/, '').trim();
                }
            }
        };

        const lightClone = svgEl.cloneNode(true);
        ensureNamespace(lightClone);
        stripDarkMode(lightClone);

        const darkClone = svgEl.cloneNode(true);
        ensureNamespace(darkClone);
        forceDarkMode(darkClone);

        return {
            light: serializer.serializeToString(lightClone),
            dark: serializer.serializeToString(darkClone)
        };
    } catch (err) {
        return empty;
    }
};
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
    const beautifiedSelectionRef = useRef({ start: 0, end: 0, direction: 'none', scrollTop: 0, scrollLeft: 0, restore: false });
    const skipNextAutoOptimizeRef = useRef(false);
    const latestSvgRef = useRef('');
    const lintListRef = useRef(null);
    const fileInputRef = useRef(null);
    const [caretStyle, setCaretStyle] = useState({ top: 0, left: 0, height: 18, visible: false });
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
        metaIsDirtyRef.current = true;
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
            metaIsDirtyRef.current = true;
            setIntent(tempIntent);
            if (tempIntent === 'informational') {
                setMeta(tempMeta);
            } else {
                 setMeta({ title: '', desc: '' });
            }
            setUserHasInteracted(true);
        } else {
            metaIsDirtyRef.current = false;
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
                const targetLabel = isText ? (isLarge ? 'large text' : 'text') : 'non-text graphics';

                // WCAG: compute against both light and dark backgrounds
                const ratioLight = getContrastRatio(hex, bgLight);
                const ratioDark = getContrastRatio(hex, bgDark);
                const wcagLightLevel = getWCAGLevel(ratioLight, isText, isLarge);
                const wcagDarkLevel = getWCAGLevel(ratioDark, isText, isLarge);
                const wcagFail = wcagLightLevel === 'Fail' || wcagDarkLevel === 'Fail';
                if (wcagFail) {
                    const suggested = suggestAccessibleColor(hex, bgLight, bgDark, isText, contrastMode);
                    const wcagDetail = {
                        check: 'WCAG 2.2',
                        target: targetLabel,
                        requirement: isText ? (isLarge ? '≥ 3.0:1' : '≥ 4.5:1') : '≥ 3.0:1',
                        light: {
                            background: bgLight,
                            ratio: ratioLight,
                            status: wcagLightLevel === 'Fail' ? 'Fail' : wcagLightLevel
                        },
                        dark: {
                            background: bgDark,
                            ratio: ratioDark,
                            status: wcagDarkLevel === 'Fail' ? 'Fail' : wcagDarkLevel
                        }
                    };
                    const heading = `Color ${hex} fails WCAG contrast for ${targetLabel}`;
                    issues.push({ level: 'warning', type: 'color', hex, originals, suggested, heading, detail: wcagDetail, findingCount: 1 });
                }

                // APCA: check signed Lc values
                const apcaLight = getAPCAContrast(hex, bgLight);
                const apcaDark = getAPCAContrast(hex, bgDark);
                const absLight = Math.abs(apcaLight);
                const absDark = Math.abs(apcaDark);
                const apcaThreshold = isText ? 75 : 60;
                if (absLight < apcaThreshold || absDark < apcaThreshold) {
                    const suggested2 = suggestAccessibleColor(hex, bgLight, bgDark, isText, 'apca');
                    const apcaDetail = {
                        check: 'APCA',
                        target: targetLabel,
                        requirement: `≥ ${apcaThreshold} Lc`,
                        light: {
                            background: bgLight,
                            lc: apcaLight,
                            status: absLight >= apcaThreshold ? 'Pass' : 'Fail'
                        },
                        dark: {
                            background: bgDark,
                            lc: apcaDark,
                            status: absDark >= apcaThreshold ? 'Pass' : 'Fail'
                        }
                    };
                    const heading = `Color ${hex} fails APCA contrast for ${targetLabel}`;
                    issues.push({ level: 'warning', type: 'color', hex, originals, suggested: suggested2, heading, detail: apcaDetail, findingCount: 1 });
                }
            });

        } catch (e) {
            issues.push({ level: 'error', message: `Lint error: ${e && e.message ? e.message : String(e)}` });
        }
        return issues;
    };

    const computeCaretPosition = (textarea) => {
        if (!textarea || typeof textarea.selectionStart !== 'number') return null;
        const doc = textarea.ownerDocument || document;
        const win = doc.defaultView || window;
        const style = win.getComputedStyle(textarea);

        const mirror = doc.createElement('div');
        mirror.style.position = 'absolute';
        mirror.style.visibility = 'hidden';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.wordBreak = 'break-word';
        mirror.style.top = '0';
        mirror.style.left = '-9999px';
        mirror.style.boxSizing = 'border-box';
        mirror.style.padding = style.padding;
        mirror.style.border = style.border;
        mirror.style.fontFamily = style.fontFamily;
        mirror.style.fontSize = style.fontSize;
        mirror.style.fontWeight = style.fontWeight;
        mirror.style.fontStyle = style.fontStyle;
        mirror.style.letterSpacing = style.letterSpacing;
        mirror.style.textTransform = style.textTransform;
        mirror.style.textAlign = style.textAlign;
        mirror.style.lineHeight = style.lineHeight;
        mirror.style.tabSize = style.tabSize;
        mirror.style.width = `${textarea.clientWidth}px`;
        mirror.style.height = 'auto';
        mirror.style.overflow = 'hidden';

        const tabSize = Math.max(parseInt(style.tabSize, 10) || 2, 1);
        const replaceTabs = (value) => value.replace(/\t/g, ' '.repeat(tabSize));

        const selectionIndex = textarea.selectionStart;
        const before = replaceTabs(textarea.value.slice(0, selectionIndex));
        const beforeAdjusted = before.replace(/ /g, '\u00a0').replace(/\n$/g, '\n\u200b');
        mirror.textContent = beforeAdjusted;

        const caretMarker = doc.createElement('span');
        const remainder = textarea.value.slice(selectionIndex);
        caretMarker.textContent = remainder.length > 0 ? replaceTabs(remainder[0]) : '\u200b';
        mirror.appendChild(caretMarker);

        doc.body.appendChild(mirror);
        const mirrorRect = mirror.getBoundingClientRect();
        const caretRect = caretMarker.getBoundingClientRect();
        const top = caretRect.top - mirrorRect.top;
        const left = caretRect.left - mirrorRect.left;
        doc.body.removeChild(mirror);

        const borderLeft = parseFloat(style.borderLeftWidth) || 0;
        const borderTop = parseFloat(style.borderTopWidth) || 0;
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 16;

        return {
            top: top - textarea.scrollTop + borderTop,
            left: left - textarea.scrollLeft + borderLeft,
            height: lineHeight
        };
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

    async function handleOptimize(customSvg, override = {}) {
        setA11yStatus(`Processing SVG... ${new Date().toLocaleTimeString()}`);

        const currentIntent = override.intent ?? intent;
        const currentMeta = override.meta ?? meta;

        try {
            const sourceCode = typeof customSvg === 'string' ? customSvg : svgInput;
            if (!sourceCode) return;

            const doc = new DOMParser().parseFromString(sourceCode, 'image/svg+xml');
            const svgEl = doc.querySelector('svg');

            if (!svgEl) throw new Error('Invalid SVG: Could not parse <svg> element.');

            // Force namespace if missing (fix for some browsers)
            if (!svgEl.getAttribute('xmlns')) {
                svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }

            const existingMeta = extractMetaFromSvg(sourceCode);
            const effectiveMeta = {
                title: (currentMeta.title || '').trim() || existingMeta.title || '',
                desc: (currentMeta.desc || '').trim() || existingMeta.desc || ''
            };
            const effectiveIntent = (currentIntent === 'decorative' && (effectiveMeta.title || effectiveMeta.desc))
                ? 'informational'
                : currentIntent;

            if (!metaIsDirtyRef.current) {
                if (meta.title !== effectiveMeta.title || meta.desc !== effectiveMeta.desc) {
                    skipNextAutoOptimizeRef.current = true;
                    setMeta(effectiveMeta);
                }
                if (intent !== effectiveIntent) {
                    skipNextAutoOptimizeRef.current = true;
                    setIntent(effectiveIntent);
                }
            }

            // 2. A11y Wizard
            if (effectiveIntent === 'decorative') {
                svgEl.setAttribute('role', 'presentation');
                svgEl.setAttribute('aria-hidden', 'true');
                // Remove existing a11y tags
                svgEl.querySelectorAll('title, desc').forEach(e => e.remove());
                svgEl.removeAttribute('aria-label');
                svgEl.removeAttribute('aria-labelledby');
            } else if (effectiveIntent === 'informational') {
                svgEl.setAttribute('role', 'img');
                svgEl.removeAttribute('aria-hidden');

                // Handle Title
                let titleEl = svgEl.querySelector('title');
                if (!titleEl) {
                    titleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'title');
                    svgEl.prepend(titleEl);
                }
                titleEl.textContent = effectiveMeta.title;
                const titleId = ensureElementId(titleEl, 'title', doc);

                // Handle Desc
                let descEl = svgEl.querySelector('desc');
                if (effectiveMeta.desc) {
                    if (!descEl) {
                        descEl = doc.createElementNS('http://www.w3.org/2000/svg', 'desc');
                        titleEl.after(descEl);
                    }
                    descEl.textContent = effectiveMeta.desc;
                    const descId = ensureElementId(descEl, 'desc', doc);

                    const labelledTokens = new Set(
                        (svgEl.getAttribute('aria-labelledby') || '')
                            .split(/\s+/)
                            .filter(Boolean)
                    );
                    labelledTokens.delete(titleId);
                    labelledTokens.delete(descId);
                    labelledTokens.add(titleId);
                    labelledTokens.add(descId);
                    const joined = Array.from(labelledTokens).join(' ');
                    if (joined) svgEl.setAttribute('aria-labelledby', joined);
                    else svgEl.removeAttribute('aria-labelledby');
                } else {
                    if (descEl) {
                        const existingId = (descEl.getAttribute('id') || '').trim();
                        if (existingId) {
                            const labelledTokens = new Set(
                                (svgEl.getAttribute('aria-labelledby') || '')
                                    .split(/\s+/)
                                    .filter(Boolean)
                            );
                            labelledTokens.delete(existingId);
                            if (labelledTokens.size > 0) {
                                svgEl.setAttribute('aria-labelledby', Array.from(labelledTokens).join(' '));
                            } else {
                                svgEl.removeAttribute('aria-labelledby');
                            }
                        }
                        descEl.remove();
                    }
                    const labelledTokens = new Set(
                        (svgEl.getAttribute('aria-labelledby') || '')
                            .split(/\s+/)
                            .filter(Boolean)
                    );
                    labelledTokens.delete(titleId);
                    labelledTokens.add(titleId);
                    const joined = Array.from(labelledTokens).join(' ');
                    if (joined) svgEl.setAttribute('aria-labelledby', joined);
                    else svgEl.removeAttribute('aria-labelledby');
                }

            } else if (effectiveIntent === 'interactive') {
                // Minimal base for interactive - usually requires manual verification,
                // but we can ensure it's not hidden.
                svgEl.removeAttribute('aria-hidden');
                svgEl.removeAttribute('role'); // Or specific role if known

                // Ensure focusable
                if (!svgEl.hasAttribute('tabindex')) {
                    svgEl.setAttribute('tabindex', '0');
                }
            }

            // 3. Theming & Colors
            // Collect unique colors for CSS vars
            const allEls = svgEl.querySelectorAll('*');
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
            const enrichedCode = serializer.serializeToString(svgEl);

            // Keep beautified editor focused on enriched (pre-SVGO) markup
            const beautifiedReadable = beautifySvg(enrichedCode);
            skipNextAutoOptimizeRef.current = true;
            setBeautifiedCode(beautifiedReadable);
            setSvgInput(beautifiedReadable);
            setPreviewBeautified(buildLightDarkPreview(enrichedCode));

            // Prepare optimized output from an SVG clone without internal helper attributes
            const optimizeTarget = svgEl.cloneNode(true);
            optimizeTarget.querySelectorAll('[data-a11y-id]').forEach(node => node.removeAttribute('data-a11y-id'));
            let optimizedCode = new XMLSerializer().serializeToString(optimizeTarget);

            try {
                const result = optimize(optimizedCode, {
                    plugins: [
                        {
                            name: 'preset-default',
                            params: {
                                overrides: {
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
                                preserveCurrentColor: true
                            }
                        }
                    ]
                });
                if (result.data) optimizedCode = result.data;
            } catch (optErr) {
                console.warn('SVGO Optimization failed, using enriched SVG:', optErr);
            }

            const optimizedPreview = buildLightDarkPreview(optimizedCode);
            setProcessedSvg({ code: optimizedCode, light: optimizedPreview.light, dark: optimizedPreview.dark });
            setOptimizedCode(optimizedCode);
            setA11yStatus(`SVG processed successfully at ${new Date().toLocaleTimeString()}`);
            metaIsDirtyRef.current = false;

        } catch (e) {
            console.error(e);
            setA11yStatus(`Error: ${e.message}`);
        }
    }

    const commitBeautifiedChange = (newCode, statusMsg = 'Preview updated', { optimize = true } = {}) => {
        const code = newCode || '';
        setBeautifiedCode(code);
        setSvgInput(code);
        setPreviewBeautified(buildLightDarkPreview(code));
        // Keep meta in sync if user edits SVG code directly
        if (!metaIsDirtyRef.current) {
            const parsedMeta = extractMetaFromSvg(code);
            const nextTitle = parsedMeta.title || '';
            const nextDesc = parsedMeta.desc || '';
            if (nextTitle !== meta.title || nextDesc !== meta.desc) {
                setMeta({ title: nextTitle, desc: nextDesc });
                setIntent(nextTitle ? 'informational' : 'decorative');
            }
        }
        try {
            setLintResults(lintSvg(code));
        } catch (er) {
            setLintResults([{ level: 'error', message: String(er) }]);
        }
        if (editorTimerRef.current) clearTimeout(editorTimerRef.current);
        if (optimize) {
            editorTimerRef.current = setTimeout(() => {
                handleOptimize(code);
                setA11yStatus(statusMsg);
                setTimeout(() => setA11yStatus(''), 900);
            }, 500);
        } else {
            skipNextAutoOptimizeRef.current = true;
            setA11yStatus(statusMsg);
            setTimeout(() => setA11yStatus(''), 900);
        }
    };

    const snapshotBeautifiedSelection = (target, shouldRestore = false) => {
        if (!target || typeof target.selectionStart !== 'number') return;
        beautifiedSelectionRef.current = {
            start: target.selectionStart,
            end: target.selectionEnd,
            direction: target.selectionDirection || 'none',
            scrollTop: target.scrollTop,
            scrollLeft: target.scrollLeft,
            restore: shouldRestore
        };
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
            metaIsDirtyRef.current = false;
        } catch (e) { /* ignore parse errors */ }

        setOriginalCode(source);
        setPreviewOriginal(buildLightDarkPreview(source));
        const pretty = source ? beautifySvg(source) : '';
        setActiveEditorTab('beautified');
        commitBeautifiedChange(pretty, statusMsg);
    };

    const updateBeautifiedCaret = useCallback(() => {
        const textarea = beautifiedTextareaRef.current;
        if (!textarea || activeEditorTab !== 'beautified' || document.activeElement !== textarea) {
            setCaretStyle(prev => (prev.visible ? { ...prev, visible: false } : prev));
            return;
        }
        const coords = computeCaretPosition(textarea);
        if (!coords) {
            setCaretStyle(prev => (prev.visible ? { ...prev, visible: false } : prev));
            return;
        }
        setCaretStyle({ top: coords.top, left: coords.left, height: coords.height, visible: true });
    }, [activeEditorTab]);

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
        if (skipNextAutoOptimizeRef.current) {
            skipNextAutoOptimizeRef.current = false;
            return;
        }
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

    const canonicalBeautified = beautifiedCode || svgInput || '';
    const canonicalOriginal = originalCode || svgInput || '';
    const canonicalOptimized = optimizedCode || processedSvg.code || '';
    const beautifiedDisplay = useMemo(() => (canonicalBeautified || '') + BEAUTIFIED_DISPLAY_SUFFIX, [canonicalBeautified]);
    const optimizedDisplay = useMemo(() => (canonicalOptimized || '') + OPTIMIZED_DISPLAY_SUFFIX, [canonicalOptimized]);

    useEffect(() => {
        const textarea = beautifiedTextareaRef.current;
        if (!textarea) return;
        const update = () => updateBeautifiedCaret();
        const handleFocus = () => updateBeautifiedCaret();
        const handleBlur = () => {
            setCaretStyle(prev => (prev.visible ? { ...prev, visible: false } : prev));
        };
        const events = ['input', 'keyup', 'keydown', 'click', 'mouseup'];
        events.forEach(evt => textarea.addEventListener(evt, update));
        textarea.addEventListener('scroll', update);
        textarea.addEventListener('focus', handleFocus);
        textarea.addEventListener('blur', handleBlur);
        window.addEventListener('resize', update);
        updateBeautifiedCaret();
        return () => {
            events.forEach(evt => textarea.removeEventListener(evt, update));
            textarea.removeEventListener('scroll', update);
            textarea.removeEventListener('focus', handleFocus);
            textarea.removeEventListener('blur', handleBlur);
            window.removeEventListener('resize', update);
        };
    }, [updateBeautifiedCaret, beautifiedDisplay]);

    useEffect(() => {
        if (activeEditorTab !== 'beautified') {
            setCaretStyle(prev => (prev.visible ? { ...prev, visible: false } : prev));
        } else {
            updateBeautifiedCaret();
        }
    }, [activeEditorTab, updateBeautifiedCaret, beautifiedDisplay]);

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

    useLayoutEffect(() => {
        if (!beautifiedSelectionRef.current || !beautifiedSelectionRef.current.restore) return;
        const snapshot = beautifiedSelectionRef.current;
        const textarea = beautifiedTextareaRef.current;
        if (!textarea) {
            snapshot.restore = false;
            return;
        }
        const { start, end, direction, scrollTop, scrollLeft } = snapshot;
        snapshot.restore = false;
        requestAnimationFrame(() => {
            const ta = beautifiedTextareaRef.current;
            if (!ta) return;
            try {
                ta.setSelectionRange(start, end, direction || 'none');
            } catch (err) {
                /* ignore selection errors */
            }
            ta.scrollTop = scrollTop;
            ta.scrollLeft = scrollLeft;
        });
    }, [beautifiedDisplay]);
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

    const previewForActiveTab = activeEditorTab === 'original'
        ? previewOriginal
        : (activeEditorTab === 'beautified' ? previewBeautified : processedSvg);
    const previewLightHtml = previewForActiveTab.light || '';
    const previewDarkHtml = previewForActiveTab.dark || '';
    const activeTabMeta = editorTabs.find(tab => tab.id === activeEditorTab) || editorTabs[0];

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
                                const nextIntent = hasTitle ? 'informational' : 'decorative';
                                const overrideMeta = nextIntent === 'informational'
                                    ? { ...meta }
                                    : { title: '', desc: '' };
                                skipNextAutoOptimizeRef.current = true;
                                setIntent(nextIntent); 
                                metaIsDirtyRef.current = true;
                                handleOptimize(
                                    latestSvgRef.current || svgInput || '',
                                    { intent: nextIntent, meta: overrideMeta }
                                ); 
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
                    h('div', { class: 'preview-header' }, `Light Mode • ${activeTabMeta.label}`),
                    h('div', { class: 'preview-viewport preview-light' }, [
                         h('div', { 
                             style: 'width:100%; height:100%; display:flex; align-items:center; justify-content:center;',
                             dangerouslySetInnerHTML: { __html: previewLightHtml } 
                         })
                    ])
                ]),
                // Dark
                h('div', { class: 'preview-pane' }, [
                    h('div', { class: 'preview-header' }, `Dark Mode • ${activeTabMeta.label}`),
                     h('div', { class: 'preview-viewport preview-dark' }, [
                         h('div', { 
                             style: 'width:100%; height:100%; display:flex; align-items:center; justify-content:center;',
                             dangerouslySetInnerHTML: { __html: previewDarkHtml } 
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
                                wrap: 'off',
                                autocomplete: 'off',
                                autocapitalize: 'none',
                                autocorrect: 'off',
                                onInput: (e) => {
                                    const target = e.target;
                                    snapshotBeautifiedSelection(target, true);
                                    commitBeautifiedChange(target.value, 'Beautified updated', { optimize: false });
                                    updateBeautifiedCaret();
                                },
                                onFocus: () => updateBeautifiedCaret(),
                                onBlur: (e) => {
                                    snapshotBeautifiedSelection(e.target, false);
                                    commitBeautifiedChange(e.target.value, 'Beautified synced');
                                },
                                onSelect: (e) => {
                                    snapshotBeautifiedSelection(e.target, false);
                                    updateBeautifiedCaret();
                                },
                                onScroll: (e) => {
                                    snapshotBeautifiedSelection(e.target, false);
                                    updateBeautifiedCaret();
                                },
                                spellcheck: false,
                                wrap: 'off',
                                'aria-label': 'Beautified SVG editor'
                            }),
                            h('div', {
                                class: `custom-caret${caretStyle.visible ? ' is-visible' : ''}`,
                                style: {
                                    top: `${caretStyle.top}px`,
                                    left: `${caretStyle.left}px`,
                                    height: `${caretStyle.height}px`
                                }
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
                        const entry = colorMap.get(key) || {
                            type: 'color',
                            hex: key,
                            heading: null,
                            target: null,
                            details: [],
                            originals: new Set(),
                            suggested: null,
                            fallbackMessages: [],
                            findingCount: 0
                        };
                        if (it.heading && !entry.heading) entry.heading = it.heading;
                        if (!entry.target && it.detail && it.detail.target) entry.target = it.detail.target;
                        if (it.detail) entry.details.push(it.detail);
                        if (Array.isArray(it.messages) && it.messages.length) {
                            it.messages.forEach(msg => {
                                if (msg && !entry.fallbackMessages.includes(msg)) entry.fallbackMessages.push(msg);
                            });
                        } else if (it.message) {
                            if (!entry.fallbackMessages.includes(it.message)) entry.fallbackMessages.push(it.message);
                        }
                        entry.findingCount += it.findingCount || 1;
                        (it.originals || []).forEach(o => entry.originals.add(o));
                        if (it.suggested && !entry.suggested) entry.suggested = it.suggested;
                        colorMap.set(key, entry);
                    } else if (it) {
                        combined.push(it);
                    }
                });
                const formatBg = (bg) => (typeof bg === 'string' ? bg.toUpperCase() : String(bg || ''));
                const formatRatio = (val) => (typeof val === 'number' && Number.isFinite(val) ? val.toFixed(2) : 'n/a');
                const formatLc = (val) => (typeof val === 'number' && Number.isFinite(val) ? val.toFixed(1) : 'n/a');
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
                    v.hex = typeof hex === 'string' ? hex.toUpperCase() : hex;
                    const detailLines = [];
                    v.details.forEach(detail => {
                        if (!detail || !detail.check) return;
                        if (detail.check === 'WCAG 2.2') {
                            if (detail.light && typeof detail.light === 'object') {
                                detailLines.push(`WCAG light bg ${formatBg(detail.light.background)}: ${formatRatio(detail.light.ratio)}:1 (${detail.light.status}; needs ${detail.requirement})`);
                            }
                            if (detail.dark && typeof detail.dark === 'object') {
                                detailLines.push(`WCAG dark bg ${formatBg(detail.dark.background)}: ${formatRatio(detail.dark.ratio)}:1 (${detail.dark.status}; needs ${detail.requirement})`);
                            }
                        } else if (detail.check === 'APCA') {
                            if (detail.light && typeof detail.light === 'object') {
                                detailLines.push(`APCA light bg ${formatBg(detail.light.background)}: Lc ${formatLc(detail.light.lc)} (${detail.light.status}; needs ${detail.requirement})`);
                            }
                            if (detail.dark && typeof detail.dark === 'object') {
                                detailLines.push(`APCA dark bg ${formatBg(detail.dark.background)}: Lc ${formatLc(detail.dark.lc)} (${detail.dark.status}; needs ${detail.requirement})`);
                            }
                        }
                    });
                    const heading = v.heading || `Color ${v.hex} has contrast issues for ${v.target || 'this usage'}`;
                    const mergedLines = [heading, ...detailLines];
                    if (mergedLines.length === 1 && v.fallbackMessages.length) {
                        mergedLines.push(...v.fallbackMessages);
                    }
                    v.messages = mergedLines.filter((line, idx, arr) => line && arr.indexOf(line) === idx);
                    v.message = v.messages.length ? v.messages.join(' — ') : heading;
                    v.originals = Array.from(v.originals);
                    v.findingCount = v.findingCount || v.details.length || 1;
                    delete v.fallbackMessages;
                    combined.push(v);
                }

                combined.sort((a, b) => {
                    const la = (a.level === 'error') ? 0 : 1;
                    const lb = (b.level === 'error') ? 0 : 1;
                    return la - lb;
                });

                return h('div', { class: 'lint-panel', role: 'region', 'aria-label': 'Lint results' }, [
                    h('div', { class: 'lint-header' }, [
                        h('span', { class: 'lint-title' }, `Lint: ${combined.length} item${combined.length !== 1 ? 's' : ''}${lintResults.length !== combined.length ? ` (${lintResults.length} finding${lintResults.length !== 1 ? 's' : ''})` : ''}`),
                        h('button', { class: 'lint-close', onClick: () => setLintPanelVisible(false), 'aria-label': 'Hide lint panel' }, '×')
                    ]),
                    combined.length === 0 && h('div', { style: 'color: #2b8a3e; padding:0.5rem;' }, 'No issues found'),
                    h('div', { class: 'lint-top' }, combined.slice(0, 2).map((it, idx) => {
                        const baseLabel = it.hex ? `Color ${it.hex}` : 'Lint issue';
                        const accessibleLabel = it.findingCount && it.findingCount > 1 ? `${baseLabel} (${it.findingCount} findings)` : baseLabel;
                        return h('div', { key: `top-${idx}`, class: 'lint-item lint-top-item', role: 'listitem', tabIndex: 0, 'aria-label': accessibleLabel, onKeyDown: handleLintKeyDown }, [
                            h('div', { class: 'lint-message' }, Array.isArray(it.messages) ? it.messages.map((m, i) => h('div', { key: `m-${i}` }, m)) : (it.message || '')),
                            h('div', { class: 'lint-action' }, [
                                it.findingCount && it.findingCount > 1 && h('span', { class: 'lint-count' }, `${it.findingCount} findings`),
                                h('span', { class: 'suggest' }, it.suggested || ''),
                                h('button', { class: 'small', onClick: () => applyColorFix((it.originals && it.originals[0]) || it.hex, it.suggested || it.hex), 'aria-label': `Fix color ${it.hex || ''}` }, 'Fix')
                            ])
                        ]);
                    })),
                    h('div', { class: 'lint-list', role: 'list', ref: lintListRef, tabIndex: 0, onKeyDown: handleLintKeyDown }, combined.slice(2).map((it, idx) => {
                        const baseLabel = it.hex ? `Color ${it.hex}` : 'Lint issue';
                        const accessibleLabel = it.findingCount && it.findingCount > 1 ? `${baseLabel} (${it.findingCount} findings)` : baseLabel;
                        return h('div', { key: `rest-${idx}`, class: 'lint-item', role: 'listitem', tabIndex: 0, 'aria-label': accessibleLabel }, [
                            h('div', { class: 'lint-message' }, Array.isArray(it.messages) ? it.messages.map((m, i) => h('div', { key: `m-${i}` }, m)) : (it.message || '')),
                            h('div', { class: 'lint-action' }, [
                                it.findingCount && it.findingCount > 1 && h('span', { class: 'lint-count' }, `${it.findingCount} findings`),
                                h('span', { class: 'suggest' }, it.suggested || ''),
                                h('button', { class: 'small', onClick: () => applyColorFix((it.originals && it.originals[0]) || it.hex, it.suggested || it.hex), 'aria-label': `Fix color ${it.hex || ''}` }, 'Fix')
                            ])
                        ]);
                    }))
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
