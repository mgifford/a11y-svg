// Suggests a color with good contrast for both light and dark backgrounds
function suggestDualContrastColor(bgLight, bgDark, isText = true, isLarge = false) {
    // Example: return black or white depending on which has better contrast for both backgrounds
    const candidates = ['#000000', '#ffffff'];
    let best = candidates[0];
    let bestScore = 0;
    candidates.forEach(color => {
        let score = 0;
        // Use your existing getContrastRatio and getWCAGLevel functions
        const lightRatio = getContrastRatio(color, bgLight);
        const darkRatio = getContrastRatio(color, bgDark);
        const lightLevel = getWCAGLevel(lightRatio, isText, isLarge);
        const darkLevel = getWCAGLevel(darkRatio, isText, isLarge);
        if (lightLevel === 'AAA') score += 2;
        else if (lightLevel === 'AA') score += 1;
        if (darkLevel === 'AAA') score += 2;
        else if (darkLevel === 'AA') score += 1;
        if (score > bestScore) {
            bestScore = score;
            best = color;
        }
    });
    return best;
}
// Returns true if the SVG text element is considered large for WCAG contrast
function isLargeText(el) {
    if (!el || !el.tagName) return false;
    if (!isTextElement(el)) return false;
    const fontSize = parseFloat(el.getAttribute('font-size') || '');
    const fontWeight = (el.getAttribute('font-weight') || '').toLowerCase();
    // WCAG: large text is ≥ 24px normal or ≥ 18.66px bold
    if (fontSize >= 24) return true;
    if (fontSize >= 18.66 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700)) return true;
    return false;
}
// Returns true if the SVG element is a text element
function isTextElement(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'text' || tag === 'tspan' || tag === 'textpath' || tag === 'altglyph' || tag === 'altglyphdef' || tag === 'altglyphitem';
}
/*
 * A11y-SVG-Studio
 * Copyright (C) 2026 Mike Gifford and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
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

const optimizeSvg = (code, options = {}) => {
    try {
        if (typeof window !== 'undefined' && window.SVGO && typeof window.SVGO.optimize === 'function') {
            return window.SVGO.optimize(code, options);
        }
    } catch (err) {
        console.warn('SVGO global lookup failed, falling back to bundled optimize()', err);
    }
    if (typeof optimize === 'function') {
        return optimize(code, options);
    }
    return { data: code };
};

function getWCAGLevel(ratio, isText = false, isLarge = false) {
    if (isText) {
        const aaThreshold = isLarge ? 3 : 4.5;
        const aaaThreshold = isLarge ? 4.5 : 7;
        if (ratio >= aaaThreshold) return 'AAA';
        if (ratio >= aaThreshold) return 'AA';
        return 'Fail';
    } else {
        if (ratio >= 4.5) return 'AAA';
        if (ratio >= 3) return 'AA';
        return 'Fail';
    }
}

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

// Check if a value is a valid hex color for type="color" input
const isValidHexForColorInput = (hex) => {
    if (!hex) return false;
    const normalized = normalizeHex(hex);
    return normalized !== null;
};

// Get a valid hex value for color picker, falling back to a default
const getSafeColorPickerValue = (colorValue, fallback = '#000000') => {
    const normalized = normalizeHex(colorValue);
    return normalized || fallback;
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

// Auto-fix color to meet WCAG contrast threshold by adjusting lightness
const autoFixContrast = (fgHex, bgHex, targetRatio) => {
    const bgRgb = hexToRgb(bgHex);
    const bgL = getLuminance(bgRgb);
    
    // Calculate target foreground luminance
    // ratio = (lighter + 0.05) / (darker + 0.05)
    // We need to solve for fg luminance that gives us targetRatio
    let targetFgL;
    if (bgL > 0.5) {
        // Light background - make text darker
        targetFgL = (bgL + 0.05) / targetRatio - 0.05;
    } else {
        // Dark background - make text lighter
        targetFgL = (bgL + 0.05) * targetRatio - 0.05;
    }
    
    // Clamp to valid range
    targetFgL = Math.max(0, Math.min(1, targetFgL));
    
    // Convert target luminance to approximate RGB
    // Use grayscale for simplicity (keep hue from original)
    const fgHsl = rgbToHsl(hexToRgb(fgHex));
    
    // Binary search for lightness that achieves target luminance
    let minL = 0;
    let maxL = 100;
    let bestL = fgHsl.l;
    let bestRatio = 0;
    
    for (let i = 0; i < 20; i++) {
        const testL = Math.round((minL + maxL) / 2);
        const testRgb = hslToRgb({ h: fgHsl.h, s: fgHsl.s, l: testL });
        const testHex = rgbToHex(testRgb);
        const ratio = getContrastRatio(testHex, bgHex);
        
        if (Math.abs(ratio - targetRatio) < 0.1) {
            return testHex;
        }
        
        if (ratio > bestRatio) {
            bestRatio = ratio;
            bestL = testL;
        }
        
        if (ratio < targetRatio) {
            // Need more contrast
            if (bgL > 0.5) {
                maxL = testL - 1; // Darker
            } else {
                minL = testL + 1; // Lighter
            }
        } else {
            // Too much contrast, can back off
            if (bgL > 0.5) {
                minL = testL + 1; // Lighter
            } else {
                maxL = testL - 1; // Darker
            }
        }
    }
    
    return rgbToHex(hslToRgb({ h: fgHsl.h, s: fgHsl.s, l: bestL }));
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
            // Remove data-dark-* attributes from light mode
            clone.querySelectorAll('[data-dark-fill], [data-dark-stroke]').forEach(el => {
                el.removeAttribute('data-dark-fill');
                el.removeAttribute('data-dark-stroke');
            });
        };

        const forceDarkMode = (clone) => {
            const style = clone.querySelector('#dark-mode-style');
            if (style && style.textContent.includes('@media')) {
                const match = style.textContent.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*{([\s\S]*)}$/);
                if (match && match[1]) {
                    style.textContent = match[1].replace(/}\s*$/, '').trim();
                }
            }
            // Apply data-dark-* attributes to actual fill/stroke in dark mode
            clone.querySelectorAll('[data-dark-fill]').forEach(el => {
                const darkFill = el.getAttribute('data-dark-fill');
                if (darkFill) {
                    el.setAttribute('fill', darkFill);
                    el.removeAttribute('data-dark-fill');
                }
            });
            clone.querySelectorAll('[data-dark-stroke]').forEach(el => {
                const darkStroke = el.getAttribute('data-dark-stroke');
                if (darkStroke) {
                    el.setAttribute('stroke', darkStroke);
                    el.removeAttribute('data-dark-stroke');
                }
            });
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

const BEAUTIFIED_DISPLAY_SUFFIX = '';
const OPTIMIZED_DISPLAY_SUFFIX = '';

const App = () => {
    const [svgInput, setSvgInput] = useState('');
        const [processedSvg, setProcessedSvg] = useState({ code: '', light: '', dark: '' });
        const [previewOriginal, setPreviewOriginal] = useState({ light: '', dark: '' });
        const [previewBeautified, setPreviewBeautified] = useState({ light: '', dark: '' });
        const [intent, setIntent] = useState('decorative');
        const [userHasInteracted, setUserHasInteracted] = useState(false);
        const dialogRef = useRef(null);
        const [tempMeta, setTempMeta] = useState({ title: '', desc: '' });
        const [tempIntent, setTempIntent] = useState('decorative');
        const [meta, setMeta] = useState({ title: '', desc: '' });
        const metaIsDirtyRef = useRef(false);
        const [colors, setColors] = useState([]);
        const [darkModeColors, setDarkModeColors] = useState({});
        const prevColorsRef = useRef([]);
        const prevDarkModeColorsRef = useRef({});
        const applyingColorsRef = useRef(false);

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

        const [prevOverrides, setPrevOverrides] = useState({}); // store previous override for revert
        const [elementOverrides, setElementOverrides] = useState({}); // data-a11y-id -> color
        const [elementMap, setElementMap] = useState({}); // data-a11y-id -> { orig, attr, isText, isLarge }
        const [a11yStatus, setA11yStatus] = useState('');
        const [currentFileName, setCurrentFileName] = useState('');
        const [contrastMode, setContrastMode] = useState('wcag'); // 'wcag' or 'apca'
        const [bgLight, setBgLight] = useState('#ffffff');
        const [bgDark, setBgDark] = useState('#121212');
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
        const [theme, setTheme] = useState(() => {
            try { return localStorage.getItem('theme') || 'system'; } catch (e) { return 'system'; }
        });

        let latestClassStyles = new Map();

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

        const looksLikeFilename = (s) => {
            if (!s) return false;
            const str = String(s).trim();
            if (/\.[a-z0-9]{2,4}$/i.test(str)) return true;
            if (/[\\/]/.test(str)) return true;
            const base = (currentFileName || '').replace(/\.[^/.]+$/, '').toLowerCase();
            if (base && str.toLowerCase() === base) return true;
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
            // Instantly sync changes to SVG and preview
            const updatedMeta = { ...meta, [field]: value };
            setMeta(updatedMeta);
            const hasTitle = String(updatedMeta.title || '').trim().length > 0;
            const nextIntent = hasTitle ? 'informational' : 'decorative';
            setIntent(nextIntent);
            skipNextAutoOptimizeRef.current = true;
            handleOptimize(
                latestSvgRef.current || svgInput || '',
                { intent: nextIntent, meta: updatedMeta }
            );
            metaIsDirtyRef.current = false;
        };

        const triggerFilePicker = () => {
            if (fileInputRef.current) fileInputRef.current.click();
        };

        const openMetaDialog = () => {
            setTempMeta({ ...meta });
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

        const parseColors = (svgString) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgString, 'image/svg+xml');
            const colorMap = new Map();
            const elements = doc.querySelectorAll('*');

            const cssVars = {};
            const capturedClassStyles = new Map();
            const cleanDecl = (value) => value.replace(/!important\s*$/i, '').trim();
            const styleEls = doc.querySelectorAll('style');
            styleEls.forEach(styleEl => {
                const txt = styleEl.textContent || '';
                const re = /(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+)\s*;/g;
                let match;
                while ((match = re.exec(txt)) !== null) {
                    cssVars[match[1].trim()] = cleanDecl(match[2]);
                }

                const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
                let ruleMatch;
                while ((ruleMatch = ruleRe.exec(txt)) !== null) {
                    const selectors = ruleMatch[1].split(',').map(sel => sel.trim()).filter(Boolean);
                    if (selectors.length === 0) continue;
                    const body = ruleMatch[2];
                    const fillMatch = body.match(/fill\s*:\s*([^;!]+)(?:!important)?/i);
                    const strokeMatch = body.match(/stroke\s*:\s*([^;!]+)(?:!important)?/i);
                    const colorMatch = body.match(/color\s*:\s*([^;!]+)(?:!important)?/i);
                    if (!fillMatch && !strokeMatch && !colorMatch) continue;
                    selectors.forEach(sel => {
                        if (/^\.[a-zA-Z0-9_-]+$/.test(sel)) {
                            const name = sel.slice(1);
                            const existing = capturedClassStyles.get(name) || {};
                            if (fillMatch) existing.fill = cleanDecl(fillMatch[1]);
                            if (strokeMatch) existing.stroke = cleanDecl(strokeMatch[1]);
                            if (colorMatch) existing.color = cleanDecl(colorMatch[1]);
                            capturedClassStyles.set(name, existing);
                        }
                    });
                }
            });

            latestClassStyles = capturedClassStyles;

            const resolveColorValue = (val, el) => {
                if (!val) return null;
                const v = val.trim();
                if (!v || v === 'none' || v.toLowerCase() === 'transparent') return null;
                const hexRe = /^#([0-9a-fA-F]{3,8})$/;
                const mhex = v.match(hexRe);
                if (mhex) {
                    let h = mhex[0].toLowerCase();
                    if (h.length === 4) {
                        h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
                    }
                    return h;
                }
                const varRe = /^var\((--[a-zA-Z0-9-_]+)\)$/i;
                const mv = v.match(varRe);
                if (mv) {
                    const name = mv[1];
                    const resolved = cssVars[name];
                    if (resolved) return resolveColorValue(resolved, el);
                    return null;
                }
                if (v === 'currentColor') {
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
                            if (!cur) cur = svgRoot.getAttribute('color');
                        }
                    }
                    if (!cur) {
                        const classAttr = el.getAttribute && el.getAttribute('class');
                        if (classAttr) {
                            classAttr.split(/\s+/).some(cls => {
                                const info = latestClassStyles && latestClassStyles.get(cls.trim());
                                if (info && info.color) {
                                    cur = info.color;
                                    return true;
                                }
                                return false;
                            });
                        }
                    }
                    if (cur) return resolveColorValue(cur, el);
                    return null;
                }
                const mixRe = /color-mix\([^,]+,\s*([^\s,]+)\s*(\d+)%?\s*,\s*([^\)]+)\)/i;
                const mm = v.match(mixRe);
                if (mm) {
                    const a = mm[1];
                    const pct = parseFloat(mm[2]) / 100.0;
                    const b = mm[3].trim();
                    const ah = resolveColorValue(a, el);
                    let bh = resolveColorValue(b, el);
                    if (!bh) {
                        bh = '#ffffff';
                    }
                    if (ah) {
                        return mixHex(ah, bh, pct);
                    }
                    return null;
                }
                try {
                    const ctx = document.createElement('canvas').getContext('2d');
                    ctx.fillStyle = v;
                    const rgba = ctx.fillStyle;
                    if (rgba) return resolveColorValue(rgba, el);
                } catch (err) {}
                return null;
            };

            const mixHex = (hexA, hexB, weightA) => {
                const a = hexToRgb(hexA);
                const b = hexToRgb(hexB);
                const r = Math.round(a.r * weightA + b.r * (1 - weightA));
                const g = Math.round(a.g * weightA + b.g * (1 - weightA));
                const bComp = Math.round(a.b * weightA + b.b * (1 - weightA));
                return rgbToHex({ r, g, b: bComp });
            };

            const classStyles = latestClassStyles || capturedClassStyles || new Map();

            elements.forEach(el => {
                const isText = isTextElement(el);
                const isLarge = isText ? isLargeText(el) : false;
                const tryAttrs = [];
                ['fill', 'stroke'].forEach(attr => {
                    const attrVal = el.getAttribute(attr);
                    if (attrVal) tryAttrs.push({ token: attrVal, attr });
                });

                const styleAttr = el.getAttribute && el.getAttribute('style');
                if (styleAttr) {
                    const mfill = styleAttr.match(/fill\s*:\s*([^;]+)/i);
                    if (mfill) tryAttrs.push({ token: mfill[1].trim(), attr: 'fill', inline: true });
                    const mstroke = styleAttr.match(/stroke\s*:\s*([^;]+)/i);
                    if (mstroke) tryAttrs.push({ token: mstroke[1].trim(), attr: 'stroke', inline: true });
                }

                const classAttr = el.getAttribute && el.getAttribute('class');
                if (classAttr) {
                    classAttr.split(/\s+/).filter(Boolean).forEach(cls => {
                        const info = classStyles.get(cls);
                        if (!info) return;
                        if (info.fill) tryAttrs.push({ token: info.fill, attr: 'fill', className: cls });
                        if (info.stroke) tryAttrs.push({ token: info.stroke, attr: 'stroke', className: cls });
                        if (info.color) {
                            tryAttrs.push({ token: info.color, attr: 'fill', className: cls, implied: true });
                            tryAttrs.push({ token: info.color, attr: 'stroke', className: cls, implied: true });
                        }
                    });
                }

                const darkOverrides = {
                    fill: el.getAttribute('data-dark-fill'),
                    stroke: el.getAttribute('data-dark-stroke')
                };

                tryAttrs.forEach(item => {
                    const orig = item.token;
                    const hex = resolveColorValue(orig, el);
                    if (!hex) return;
                    const darkToken = darkOverrides[item.attr] || null;
                    const darkHex = darkToken ? resolveColorValue(darkToken, el) : null;
                    const key = `${item.attr}|${hex}|${darkHex || ''}`;
                    if (colorMap.has(key)) {
                        const info = colorMap.get(key);
                        info.count++;
                        if (isText) info.isText = true;
                        if (isLarge) info.isLarge = true;
                        info.originals.add(orig);
                        if (darkToken) info.darkOriginals.add(darkToken);
                        info.attrs.add(item.attr);
                    } else {
                        colorMap.set(key, {
                            key,
                            hex,
                            hexDark: darkHex,
                            isText,
                            isLarge,
                            count: 1,
                            originals: new Set([orig]),
                            darkOriginals: darkToken ? new Set([darkToken]) : new Set(),
                            attrs: new Set([item.attr])
                        });
                    }
                });
            });

            return Array.from(colorMap.values()).map(v => ({
                hex: v.hex,
                originalHex: v.hex,
                hexDark: v.hexDark || null,
                isText: v.isText,
                isLarge: v.isLarge,
                count: v.count,
                originals: Array.from(v.originals),
                darkOriginals: Array.from(v.darkOriginals || []),
                attrs: Array.from(v.attrs || [])
            }));
        };

        const lintSvg = (svgString) => {
            const issues = [];
            if (!svgString || svgString.trim().length === 0) return issues;
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgString, 'image/svg+xml');
                const parserError = doc.querySelector('parsererror');
                if (parserError) {
                    const txt = parserError.textContent || 'XML parse error';
                    issues.push({ level: 'error', message: `XML parse error: ${txt.trim().slice(0, 200)}` });
                    return issues;
                }
                const svgEl = doc.querySelector('svg');
                if (!svgEl) {
                    issues.push({ level: 'error', message: 'No <svg> element found' });
                    return issues;
                }

                // Check for accessible name (only if meaningful)
                if (intent !== 'decorative') {
                    const ariaLabel = svgEl.getAttribute('aria-label');
                    const ariaLabelledby = svgEl.getAttribute('aria-labelledby');
                    const titleEl = svgEl.querySelector('title');
                    const hasAriaLabel = ariaLabel && ariaLabel.trim().length > 0;
                    const hasAriaLabelledby = ariaLabelledby && ariaLabelledby.trim().length > 0;
                    const hasTitle = titleEl && titleEl.textContent && titleEl.textContent.trim().length > 0;
                    
                    // ERROR: No accessible name at all
                    if (!hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
                        issues.push({
                            level: 'error',
                            type: 'accessible-name',
                            message: 'Meaningful SVG missing accessible name',
                            detail: 'Add one of: aria-label on <svg>, aria-labelledby referencing <title> id, or <title> element',
                            suggestion: 'Add a <title> element with descriptive text, or use aria-label attribute'
                        });
                    }
                    // WARNING: Has title but no aria-labelledby (works but not ideal)
                    else if (hasTitle && !hasAriaLabelledby && !hasAriaLabel) {
                        issues.push({
                            level: 'warning',
                            type: 'accessible-name',
                            message: 'SVG has <title> but no aria-labelledby',
                            detail: 'Some screen readers may not announce <title> without aria-labelledby linking to its id',
                            suggestion: 'Add id to <title> and reference it with aria-labelledby on <svg>'
                        });
                    }
                }

                if (intent === 'informational') {
                    if (!meta.title) issues.push({ level: 'error', message: 'Missing Title in Accessibility Intent (required for informational SVG)' });
                    if (!meta.desc) issues.push({ level: 'warning', message: 'Missing Description in Accessibility Intent (recommended for informational SVG)' });
                }

                const colorList = parseColors(svgString);
                colorList.forEach(c => {
                    const hex = c.hex;
                    const hexDark = c.hexDark || hex;
                    const isText = !!c.isText;
                    const isLarge = !!c.isLarge;
                    const originals = c.originals || [];
                    const targetLabel = isText ? (isLarge ? 'large text' : 'text') : 'non-text graphics';

                    const ratioLight = getContrastRatio(hex, bgLight);
                    const ratioDark = getContrastRatio(hexDark, bgDark);
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
                        issues.push({ level: 'warning', type: 'color', hex, hexDark, originals, darkOriginals: c.darkOriginals || [], attrs: c.attrs || [], suggested, heading, detail: wcagDetail, findingCount: 1, isText, isLarge });
                    }

                    if (isText) {
                        const apcaLight = getAPCAContrast(hex, bgLight);
                        const apcaDark = getAPCAContrast(hexDark, bgDark);
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
                            issues.push({ level: 'warning', type: 'color', hex, hexDark, originals, darkOriginals: c.darkOriginals || [], attrs: c.attrs || [], suggested: suggested2, heading, detail: apcaDetail, findingCount: 1, isText, isLarge });
                        }
                    }
                });

            } catch (err) {
                issues.push({ level: 'error', message: `Lint error: ${err && err.message ? err.message : String(err)}` });
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
        const applyColorFix = (originalToken, newHex, options = {}) => {
        if (!originalToken || !newHex) return;
        const src = beautifiedCode || processedSvg.code || svgInput || '';
        const normalizedNewHex = normalizeHex(newHex) || newHex;
        const normalizedDarkHex = options && options.darkHex ? (normalizeHex(options.darkHex) || options.darkHex) : null;
        const lintEntry = options && options.lintItem ? options.lintItem : null;
        const targetAttrs = lintEntry && Array.isArray(lintEntry.attrs) && lintEntry.attrs.length
            ? Array.from(new Set(lintEntry.attrs.map(a => String(a || '').toLowerCase()))).filter(Boolean)
            : null;
        const statusParts = [`Replaced ${originalToken} → ${normalizedNewHex}`];
        if (normalizedDarkHex && normalizedDarkHex !== normalizedNewHex) {
            statusParts.push(`dark → ${normalizedDarkHex}`);
        }
        const statusLabel = statusParts.join(' ');

        const highlightInBeautified = (token) => {
            const normalized = normalizeHex(token) || token;
            if (!normalized) return;
            setActiveEditorTab('beautified');
            setHoveredColor(normalized);
            setTimeout(() => {
                const textarea = beautifiedTextareaRef.current;
                if (!textarea) return;
                const needle = normalized.toLowerCase();
                const haystack = textarea.value ? textarea.value.toLowerCase() : '';
                const idx = haystack.indexOf(needle);
                if (idx === -1) return;
                try {
                    textarea.focus({ preventScroll: false });
                } catch (focusErr) {
                    textarea.focus();
                }
                textarea.setSelectionRange(idx, idx + needle.length, 'forward');
                snapshotBeautifiedSelection(textarea, false);
                updateBeautifiedCaret();
            }, 120);
        };

        const escapeForRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(src, 'image/svg+xml');
            const svgEl = doc.querySelector('svg');
            if (!svgEl) throw new Error('No <svg> root found');

            const replaceInStyleBlocks = (token, hex) => {
                const styleEls = doc.querySelectorAll('style');
                let changed = false;
                const tokenEsc = escapeForRegex(token);
                styleEls.forEach(styleEl => {
                    let txt = styleEl.textContent || '';
                    let localChanged = false;

                    const varNameMatch = token.match(/^--[a-zA-Z0-9-_]+$/);
                    if (varNameMatch) {
                        const reDecl = new RegExp(`(${tokenEsc})\\s*:\\s*([^;]+);`, 'g');
                        if (reDecl.test(txt)) {
                            txt = txt.replace(reDecl, `$1: ${hex};`);
                            localChanged = true;
                        }
                    }

                    const varUsageMatch = token.match(/^var\(\s*(--[a-zA-Z0-9-_]+)\s*\)$/);
                    if (varUsageMatch) {
                        const vname = escapeForRegex(varUsageMatch[1]);
                        const reUsage = new RegExp(`var\\(\\s*${vname}\\s*\\)`, 'g');
                        if (reUsage.test(txt)) {
                            txt = txt.replace(reUsage, hex);
                            localChanged = true;
                        }
                    }

                    const reToken = new RegExp(`(:\\s*)${tokenEsc}((\\s*;)|\)|\\s)`, 'g');
                    if (reToken.test(txt)) {
                        txt = txt.replace(reToken, `$1${hex}$2`);
                        localChanged = true;
                    }

                    if (localChanged) {
                        styleEl.textContent = txt;
                        changed = true;
                    }
                });
                return changed;
            };

            const replaceInAttributesAndStyles = (token, hex) => {
                const elements = doc.querySelectorAll('*');
                const affected = [];
                let changed = false;
                const tokenEsc = escapeForRegex(token);
                elements.forEach(el => {
                    const attrsToCheck = targetAttrs || ['fill', 'stroke'];
                    attrsToCheck.forEach(attr => {
                        const current = el.getAttribute(attr);
                        if (current && current.trim() === token) {
                            el.setAttribute(attr, hex);
                            affected.push({ node: el, attr });
                            changed = true;
                        }
                    });

                    const styleAttr = el.getAttribute('style');
                    if (styleAttr && styleAttr.includes(token)) {
                        const re = new RegExp(tokenEsc, 'g');
                        const nextStyle = styleAttr.replace(re, hex);
                        if (nextStyle !== styleAttr) {
                            el.setAttribute('style', nextStyle);
                            changed = true;
                        }
                    }
                });
                return { changed, affected };
            };

            let updated = null;
            let didChange = false;
            let affectedNodes = [];

            const attrResult = replaceInAttributesAndStyles(originalToken, normalizedNewHex);
            affectedNodes = affectedNodes.concat(attrResult.affected);
            if (attrResult.changed) didChange = true;

            const styleChanged = replaceInStyleBlocks(originalToken, normalizedNewHex);
            if (styleChanged) didChange = true;

            if (normalizedDarkHex) {
                const darkTokens = Array.isArray(lintEntry && lintEntry.darkOriginals) ? lintEntry.darkOriginals.filter(Boolean) : [];
                const uniqueDarkTokens = Array.from(new Set(darkTokens));
                uniqueDarkTokens.forEach(token => {
                    const darkAttrResult = replaceInAttributesAndStyles(token, normalizedDarkHex);
                    if (darkAttrResult.changed) didChange = true;
                    const darkStyleChanged = replaceInStyleBlocks(token, normalizedDarkHex);
                    if (darkStyleChanged) didChange = true;
                });
            }

            if (!didChange) {
                const esc = escapeForRegex(originalToken);
                const re = new RegExp(esc, 'g');
                const fallback = src.replace(re, normalizedNewHex);
                if (fallback === src) {
                    throw new Error(`Unable to locate token ${originalToken}`);
                }
                const beautified = beautifySvg(fallback);
                addHighlightToken(originalToken);
                addHighlightToken(normalizedNewHex);
                if (normalizedDarkHex) addHighlightToken(normalizedDarkHex);
                commitBeautifiedChange(beautified, `${statusLabel} (text replace)`);
                highlightInBeautified(normalizedNewHex);
                return;
            }

            if (normalizedDarkHex !== null && affectedNodes.length) {
                const perNode = new Map();
                affectedNodes.forEach(({ node, attr }) => {
                    if (!attr) return;
                    if (!perNode.has(node)) perNode.set(node, new Set());
                    perNode.get(node).add(attr);
                });
                perNode.forEach((attrs, node) => {
                    attrs.forEach(attr => {
                        if (normalizedDarkHex && normalizedDarkHex !== normalizedNewHex) {
                            node.setAttribute(`data-dark-${attr}`, normalizedDarkHex);
                        } else {
                            node.removeAttribute(`data-dark-${attr}`);
                        }
                    });
                });
            }

            const serializer = new XMLSerializer();
            updated = serializer.serializeToString(doc);

            const beautified = beautifySvg(updated);
            addHighlightToken(originalToken);
            addHighlightToken(normalizedNewHex);
            if (normalizedDarkHex) addHighlightToken(normalizedDarkHex);
            commitBeautifiedChange(beautified, statusLabel);
            highlightInBeautified(normalizedNewHex);
            if (normalizedDarkHex && normalizedDarkHex !== normalizedNewHex) {
                highlightInBeautified(normalizedDarkHex);
            }
        } catch (err) {
            const esc = escapeForRegex(originalToken);
            const re = new RegExp(esc, 'g');
            const fallback = src.replace(re, normalizedNewHex);
            const beautified = beautifySvg(fallback);
            addHighlightToken(originalToken);
            addHighlightToken(normalizedNewHex);
            if (normalizedDarkHex) addHighlightToken(normalizedDarkHex);
            commitBeautifiedChange(beautified, `${statusLabel} (fallback)`);
            highlightInBeautified(normalizedNewHex);
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
                        }
                    }
                });
            });

            // Save element map state for UI reference
            setElementMap(tempElementMap);

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
        // Only update meta from SVG if user has NOT edited sidebar fields
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
    }, [activeEditorTab, computeCaretPosition]);

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
    }, [intent, meta, darkModeColors, elementOverrides]);

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
    }, []);

    // Persist overrides and split choices
    useEffect(() => {
        try {
            localStorage.setItem('darkModeColors', JSON.stringify(darkModeColors || {}));
            localStorage.setItem('elementOverrides', JSON.stringify(elementOverrides || {}));
            localStorage.setItem('previewSplit', String(previewSplit));
        } catch (e) {
            // ignore storage errors
        }
    }, [darkModeColors, previewSplit]);

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
            prevColorsRef.current = foundColors;
        } else if (svgInput) {
            const foundColors = parseColors(svgInput);
            setColors(foundColors);
            prevColorsRef.current = foundColors;
        }
    }, [svgInput, processedSvg.code]);

    // Apply color changes to SVG when colors or darkModeColors change
    useEffect(() => {
        if (applyingColorsRef.current) return; // Prevent infinite loop
        
        const prevColors = prevColorsRef.current;
        const prevDarkColors = prevDarkModeColorsRef.current;
        
        // Check if colors have actually changed
        let hasChanges = false;
        
        // Check for color changes
        for (let i = 0; i < colors.length; i++) {
            const current = colors[i];
            const prev = prevColors[i];
            if (!prev || current.hex !== prev.hex) {
                hasChanges = true;
                break;
            }
        }
        
        // Check for dark mode color changes
        if (!hasChanges) {
            for (const hex in darkModeColors) {
                if (darkModeColors[hex] !== prevDarkColors[hex]) {
                    hasChanges = true;
                    break;
                }
            }
        }
        
        if (!hasChanges) return;
        
        // Debounce the application
        const timer = setTimeout(() => {
            applyingColorsRef.current = true;
            
            try {
                let currentSvg = beautifiedCode || svgInput;
                if (!currentSvg) return;
                
                // Apply each color change
                for (let i = 0; i < colors.length; i++) {
                    const current = colors[i];
                    const prev = prevColors[i];
                    
                    if (prev && current.hex !== prev.hex) {
                        // Color changed - apply the change
                        const originalToken = prev.originals && prev.originals[0] || prev.hex;
                        const darkHex = darkModeColors[current.hex] || null;
                        
                        // Parse and update the SVG
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(currentSvg, 'image/svg+xml');
                        const svgEl = doc.querySelector('svg');
                        if (!svgEl) continue;
                        
                        // Find and replace the color
                        const elements = doc.querySelectorAll('*');
                        const normalizedOld = normalizeHex(prev.hex);
                        const normalizedNew = normalizeHex(current.hex);
                        
                        elements.forEach(el => {
                            ['fill', 'stroke'].forEach(attr => {
                                const value = el.getAttribute(attr);
                                if (value && normalizeHex(value) === normalizedOld) {
                                    el.setAttribute(attr, normalizedNew);
                                    // Add dark mode override if exists
                                    if (darkHex && normalizeHex(darkHex) !== normalizedNew) {
                                        el.setAttribute(`data-dark-${attr}`, darkHex);
                                    }
                                }
                            });
                        });
                        
                        const serializer = new XMLSerializer();
                        currentSvg = serializer.serializeToString(doc);
                    }
                }
                
                // Apply dark mode changes
                for (const hex in darkModeColors) {
                    const darkValue = darkModeColors[hex];
                    const prevDarkValue = prevDarkColors[hex];
                    
                    if (darkValue !== prevDarkValue) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(currentSvg, 'image/svg+xml');
                        const svgEl = doc.querySelector('svg');
                        if (!svgEl) continue;
                        
                        const elements = doc.querySelectorAll('*');
                        const normalizedLight = normalizeHex(hex);
                        const normalizedDark = normalizeHex(darkValue);
                        
                        elements.forEach(el => {
                            ['fill', 'stroke'].forEach(attr => {
                                const value = el.getAttribute(attr);
                                if (value && normalizeHex(value) === normalizedLight) {
                                    if (normalizedDark && normalizedDark !== normalizedLight) {
                                        el.setAttribute(`data-dark-${attr}`, normalizedDark);
                                    } else {
                                        el.removeAttribute(`data-dark-${attr}`);
                                    }
                                }
                            });
                        });
                        
                        const serializer = new XMLSerializer();
                        currentSvg = serializer.serializeToString(doc);
                    }
                }
                
                // Update the SVG content
                const beautified = beautifySvg(currentSvg);
                commitBeautifiedChange(beautified, 'Colors updated', { optimize: false });
                
                // Update refs
                prevColorsRef.current = [...colors];
                prevDarkModeColorsRef.current = { ...darkModeColors };
            } finally {
                applyingColorsRef.current = false;
            }
        }, 500); // 500ms debounce
        
        return () => clearTimeout(timer);
    }, [colors, darkModeColors, beautifiedCode, svgInput]);

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

            // Accessibility Intent Card
            h('div', { class: 'sidebar-section intent-card' }, [
                h('span', { class: 'sidebar-label' }, 'Accessibility Intent'),
                h('div', { class: 'intent-toggle-group', role: 'radiogroup', 'aria-label': 'SVG accessibility intent' }, [
                    h('label', { class: `intent-option${intent === 'decorative' ? ' selected' : ''}` }, [
                        h('input', {
                            type: 'radio',
                            name: 'intent',
                            value: 'decorative',
                            checked: intent === 'decorative',
                            onChange: (e) => {
                                if (e.target.checked) {
                                    setIntent('decorative');
                                    setMeta({ title: '', desc: '' });
                                    metaIsDirtyRef.current = true;
                                    setUserHasInteracted(true);
                                }
                            }
                        }),
                        h('span', { class: 'intent-label' }, 'Decorative'),
                        h('small', {}, 'No meaning, purely visual')
                    ]),
                    h('label', { class: `intent-option${intent !== 'decorative' ? ' selected' : ''}` }, [
                        h('input', {
                            type: 'radio',
                            name: 'intent',
                            value: 'meaningful',
                            checked: intent !== 'decorative',
                            onChange: (e) => {
                                if (e.target.checked) {
                                    setIntent('informational');
                                    metaIsDirtyRef.current = false;
                                    setUserHasInteracted(true);
                                }
                            }
                        }),
                        h('span', { class: 'intent-label' }, 'Meaningful'),
                        h('small', {}, 'Conveys information or function')
                    ])
                ]),
                
                // Show title/desc fields ONLY when meaningful
                intent !== 'decorative' && h('div', { class: 'meta-fields', style: 'margin-top: 1rem;' }, [
                    h('label', { class: 'meta-field' }, [
                        h('span', {}, 'Title *'),
                        h('input', {
                            type: 'text',
                            value: meta.title,
                            placeholder: 'Short, unique title (1-3 words)',
                            required: true,
                            'aria-required': 'true',
                            onInput: (e) => handleInlineMetaChange('title', e.target.value)
                        })
                    ]),
                    h('label', { class: 'meta-field' }, [
                        h('span', {}, 'Description'),
                        h('textarea', {
                            rows: 3,
                            value: meta.desc,
                            placeholder: 'Detailed description (5+ words)',
                            onInput: (e) => handleInlineMetaChange('desc', e.target.value)
                        })
                    ]),
                    
                    // Helpful hints
                    (!meta.title || looksLikeFilename(meta.title)) && 
                        h('p', { class: 'meta-hint warning' }, '⚠ Title should be human-readable, not a filename'),
                    
                    meta.title && !meta.desc && 
                        h('p', { class: 'meta-hint' }, 'ℹ️ Add a description for better accessibility'),
                        
                    meta.title && meta.desc && countWords(meta.desc) < 5 &&
                        h('p', { class: 'meta-hint' }, 'ℹ️ Description should be 5+ words for clarity')
                ])
            ]),

            // 1. Colors with background controls
            h('div', { class: 'sidebar-section' }, [
                h('span', { class: 'sidebar-label' }, `1. Colors${colors.length > 0 ? ` (${colors.length})` : ''}`),
                h('div', { style: 'margin-top: 0.5rem;' }, [
                    h('div', { style: 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;' }, [
                        h('label', { style: 'font-size: 0.85rem; min-width: 60px;' }, 'Light:'),
                        h('input', { 
                            type: 'color',
                            value: bgLight,
                            onChange: (e) => setBgLight(e.target.value),
                            title: 'Light mode background color',
                            style: 'width: 32px; height: 32px; padding: 0; border: 1px solid #ccc; cursor: pointer;'
                        }),
                        h('input', {
                            type: 'text',
                            value: bgLight,
                            onChange: (e) => setBgLight(e.target.value),
                            placeholder: '#ffffff',
                            style: 'flex: 1; padding: 0.25rem; font-family: monospace; font-size: 0.8rem; border: 1px solid var(--border);'
                        })
                    ]),
                    h('div', { style: 'display: flex; gap: 0.5rem; align-items: center;' }, [
                        h('label', { style: 'font-size: 0.85rem; min-width: 60px;' }, 'Dark:'),
                        h('input', { 
                            type: 'color',
                            value: bgDark,
                            onChange: (e) => setBgDark(e.target.value),
                            title: 'Dark mode background color',
                            style: 'width: 32px; height: 32px; padding: 0; border: 1px solid #ccc; cursor: pointer;'
                        }),
                        h('input', {
                            type: 'text',
                            value: bgDark,
                            onChange: (e) => setBgDark(e.target.value),
                            placeholder: '#121212',
                            style: 'flex: 1; padding: 0.25rem; font-family: monospace; font-size: 0.8rem; border: 1px solid var(--border);'
                        })
                    ])
                ]),

                // Text Colors (always show both WCAG + APCA)
                (() => {
                    const textColors = colors.filter(ci => ci.isText);
                    if (textColors.length === 0) return null;
                    
                    const hoveredHex = normalizeHex(hoveredColor);
                    return h('div', { style: 'margin-top: 1rem;' }, [
                        h('div', { style: 'font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem;' }, `Text Colors (${textColors.length})`),
                        h('div', { class: 'color-list' }, textColors.map((colorInfo, idx) => {
                            const c = colorInfo.hex;
                            const isText = true;
                            const isLarge = colorInfo.isLarge;
                            const normalizedColor = normalizeHex(c);
                            const isHighlighted = hoveredHex && normalizedColor && hoveredHex === normalizedColor;
                        
                            // Always calculate both WCAG and APCA for text colors
                            const lightRatio = getContrastRatio(c, bgLight);
                            const lightLevel = getWCAGLevel(lightRatio, isText, isLarge);
                            const lightLc = getAPCAContrast(c, bgLight);
                            const lightLcLevel = getAPCALevel(lightLc);
                            
                            const darkModeColor = darkModeColors[c] || c;
                            const darkRatio = getContrastRatio(darkModeColor, bgDark);
                            const darkLevel = getWCAGLevel(darkRatio, isText, isLarge);
                            const darkLc = getAPCAContrast(darkModeColor, bgDark);
                            const darkLcLevel = getAPCALevel(darkLc);
                        
                            return h('div', { 
                                key: `text-${idx}`,
                                class: `color-item${isHighlighted ? ' is-highlighted' : ''}`,
                                style: 'flex-wrap: wrap;',
                                onMouseEnter: () => setHoveredColor(c),
                                onMouseLeave: () => setHoveredColor(null),
                                onFocusCapture: () => setHoveredColor(c),
                                onBlurCapture: (e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        setHoveredColor(null);
                                    }
                                }
                            }, [
                             // Light | Color | Dark preview row
                             h('div', { style: 'display: flex; gap: 0.25rem; align-items: center; width: 100%;' }, [
                                h('div', { 
                                    style: `width:20px; height:20px; background:${bgLight}; border:1px solid #999; border-radius: 2px;`,
                                    title: `Light background: ${bgLight}`
                                }),
                                h('div', { 
                                    style: `position: relative; width:24px; height:24px;`,
                                }, [
                                    h('div', { 
                                        style: `width:24px; height:24px; background:${c}; border:2px solid #333; border-radius: 2px; cursor: pointer;`,
                                        title: `${c} (text${isLarge ? ', large' : ''}) - click to set BOTH light & dark modes${colorInfo.originalHex && c !== colorInfo.originalHex ? ` (original: ${colorInfo.originalHex})` : ''}`,
                                    onClick: () => {
                                        // Create a temporary color input to pick color
                                        const tempInput = document.createElement('input');
                                        tempInput.type = 'color';
                                        tempInput.value = getSafeColorPickerValue(c, '#000000');
                                        tempInput.style.position = 'absolute';
                                        tempInput.style.left = '-9999px';
                                        tempInput.style.opacity = '0';
                                        tempInput.style.pointerEvents = 'none';
                                        
                                        // Handle color change when user commits selection
                                        const handleColorChange = (e) => {
                                            const newColor = tempInput.value;
                                            const colorIndex = colors.indexOf(colorInfo);
                                            if (colorIndex !== -1 && newColor && newColor !== c) {
                                                const oldColor = colors[colorIndex].hex;
                                                const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : oldColor;
                                                
                                                // Apply color fix to update SVG code and preview (set both light and dark to same color)
                                                applyColorFix(originalToken, newColor, { 
                                                    darkHex: newColor,
                                                    lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                                });
                                                
                                                // Update state
                                                const newColors = [...colors];
                                                newColors[colorIndex] = { ...newColors[colorIndex], hex: newColor };
                                                setColors(newColors);
                                                
                                                // Set dark mode to same color (unified mode)
                                                const newDarkModeColors = { ...darkModeColors };
                                                newDarkModeColors[newColor] = newColor;
                                                if (oldColor !== newColor && darkModeColors[oldColor]) {
                                                    delete newDarkModeColors[oldColor];
                                                }
                                                setDarkModeColors(newDarkModeColors);
                                            }
                                            // Clean up
                                            if (tempInput.parentNode) {
                                                document.body.removeChild(tempInput);
                                            }
                                        };
                                        
                                        // Only use change event (fires when color picker closes)
                                        tempInput.addEventListener('change', handleColorChange, { once: true });
                                        
                                        document.body.appendChild(tempInput);
                                        tempInput.click();
                                    }
                                    }),
                                    colorInfo.originalHex && c !== colorInfo.originalHex ? h('div', {
                                        style: `position: absolute; bottom: -2px; right: -2px; width: 8px; height: 8px; background: ${colorInfo.originalHex}; border: 1px solid #fff; border-radius: 50%; box-shadow: 0 0 2px rgba(0,0,0,0.5);`,
                                        title: `Original: ${colorInfo.originalHex}`
                                    }) : null
                                ]),
                                h('div', { 
                                    style: `width:20px; height:20px; background:${bgDark}; border:1px solid #999; border-radius: 2px;`,
                                    title: `Dark background: ${bgDark}`
                                }),
                                h('span', { style: 'font-size: 0.65rem; color: #666; margin-left: auto;' }, `(T${isLarge ? 'L' : ''})`),
                             ]),
                             // Light color row
                             h('div', { style: 'display: flex; gap: 0.25rem; align-items: center; width: 100%;' }, [
                                h('strong', { style: 'font-size: 0.7rem; min-width: 35px;' }, 'Light:'),
                                h('input', { 
                                       type: 'color', 
                                       style: 'width:24px; height:24px; padding:0; border:1px solid #ccc; background:none; cursor: pointer;',
                                       title: 'Light mode color (only affects light mode)',
                                       value: getSafeColorPickerValue(c, '#000000'),
                                       onInput: (e) => {
                                           const newColor = e.target.value;
                                           const colorIndex = colors.indexOf(colorInfo);
                                           if (colorIndex !== -1) {
                                               const oldColor = colors[colorIndex].hex;
                                               const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : oldColor;
                                               
                                               // Apply color fix to update ONLY light mode color (no darkHex = don't touch data-dark-* attributes)
                                               applyColorFix(originalToken, newColor, { 
                                                   lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                               });
                                               
                                               // Update state - only the light mode color
                                               const newColors = [...colors];
                                               newColors[colorIndex] = { ...newColors[colorIndex], hex: newColor };
                                               setColors(newColors);
                                               
                                               // Update dark mode mapping key to preserve dark override with new light key
                                               if (darkModeColors[oldColor] !== undefined) {
                                                   const darkValue = darkModeColors[oldColor];
                                                   const newDarkModeColors = { ...darkModeColors };
                                                   delete newDarkModeColors[oldColor];
                                                   newDarkModeColors[newColor] = darkValue;
                                                   setDarkModeColors(newDarkModeColors);
                                               }
                                           }
                                       }
                                }),
                                h('input', {
                                       type: 'text',
                                       style: 'flex: 1; min-width: 80px; padding: 0.25rem; font-family: monospace; font-size: 0.75rem; border: 1px solid var(--border);',
                                       placeholder: 'light color',
                                       value: c,
                                       onBlur: (e) => {
                                           const newColor = e.target.value;
                                           if (!newColor || newColor === c) return;
                                           const colorIndex = colors.indexOf(colorInfo);
                                           if (colorIndex !== -1) {
                                               const oldColor = colors[colorIndex].hex;
                                               const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : oldColor;
                                               
                                               // Apply color fix to update ONLY light mode color (no darkHex = don't touch data-dark-* attributes)
                                               applyColorFix(originalToken, newColor, { 
                                                   lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                               });
                                               
                                               // Update state - only the light mode color
                                               const newColors = [...colors];
                                               newColors[colorIndex] = { ...newColors[colorIndex], hex: newColor };
                                               setColors(newColors);
                                               
                                               // Update dark mode mapping key to preserve dark override with new light key
                                               if (darkModeColors[oldColor] !== undefined) {
                                                   const darkValue = darkModeColors[oldColor];
                                                   const newDarkModeColors = { ...darkModeColors };
                                                   delete newDarkModeColors[oldColor];
                                                   newDarkModeColors[newColor] = darkValue;
                                                   setDarkModeColors(newDarkModeColors);
                                               }
                                           }
                                       }
                                }),
                                h('div', { style: 'margin-left:auto; display:flex; gap:2px; align-items:center;' }, [
                                    h('div', { 
                                        class: `contrast-badge ${lightLevel === 'Fail' ? 'fail' : lightLevel === 'AAA' ? 'aaa' : 'aa'}`,
                                        title: `${c} on ${bgLight}: W ${lightRatio.toFixed(2)}:1 (need ${isLarge ? '3:1' : '4.5:1'})${lightLevel === 'Fail' ? ' - Click to auto-fix!' : ''}`,
                                        style: lightLevel === 'Fail' ? 'cursor: pointer;' : '',
                                        onClick: lightLevel === 'Fail' ? () => {
                                            const targetRatio = isLarge ? 3 : 4.5;
                                            const fixed = autoFixContrast(c, bgLight, targetRatio);
                                            const colorIndex = colors.indexOf(colorInfo);
                                            if (colorIndex !== -1) {
                                                const newColors = [...colors];
                                                newColors[colorIndex] = { ...newColors[colorIndex], hex: fixed };
                                                setColors(newColors);
                                                // Preserve dark mode override
                                                if (darkModeColors[c]) {
                                                    const newDarkModeColors = { ...darkModeColors };
                                                    newDarkModeColors[fixed] = newDarkModeColors[c];
                                                    delete newDarkModeColors[c];
                                                    setDarkModeColors(newDarkModeColors);
                                                }
                                            }
                                        } : undefined
                                    }, `W:${lightRatio.toFixed(1)}`),
                                    h('div', { 
                                        class: `contrast-badge ${lightLcLevel === 'Fail' ? 'fail' : lightLcLevel === 'AAA' ? 'aaa' : 'aa'}`,
                                        title: `${c} on ${bgLight}: A ${lightLc.toFixed(1)} Lc (need 75+ Lc)`
                                    }, `A:${lightLc.toFixed(0)}`)
                                ])
                             ]),
                             // Dark mode color row
                             h('div', { style: 'display: flex; gap: 0.25rem; align-items: center; width: 100%; border-top: 1px solid var(--border); padding-top: 0.25rem; margin-top: 0.25rem;' }, [
                                h('strong', { style: 'font-size: 0.7rem; min-width: 35px;' }, 'Dark:'),
                                h('input', { 
                                       type: 'color', 
                                       style: 'width:24px; height:24px; padding:0; border:1px solid #ccc; background:none; cursor: pointer;',
                                       title: 'Dark mode color (only affects dark mode)',
                                       value: getSafeColorPickerValue(darkModeColor, getSafeColorPickerValue(c, '#000000')),
                                       onInput: (e) => {
                                           const newDarkColor = e.target.value;
                                           const colorIndex = colors.indexOf(colorInfo);
                                           if (colorIndex !== -1) {
                                               const currentColor = colors[colorIndex].hex;
                                               const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : currentColor;
                                               
                                               // Apply color fix to update data-dark-* attributes
                                               applyColorFix(originalToken, currentColor, { 
                                                   darkHex: newDarkColor,
                                                   lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                               });
                                               
                                               // Update state
                                               setDarkModeColors({ ...darkModeColors, [currentColor]: newDarkColor });
                                           }
                                       }
                                }),
                                h('input', {
                                       type: 'text',
                                       style: 'flex: 1; min-width: 80px; padding: 0.25rem; font-family: monospace; font-size: 0.75rem; border: 1px solid var(--border);',
                                       placeholder: 'dark color',
                                       value: darkModeColor,
                                       onBlur: (e) => {
                                           const newDarkColor = e.target.value;
                                           if (!newDarkColor || newDarkColor === darkModeColor) return;
                                           const colorIndex = colors.indexOf(colorInfo);
                                           if (colorIndex !== -1) {
                                               const currentColor = colors[colorIndex].hex;
                                               const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : currentColor;
                                               
                                               // Apply color fix to update data-dark-* attributes
                                               applyColorFix(originalToken, currentColor, { 
                                                   darkHex: newDarkColor,
                                                   lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                               });
                                               
                                               // Update state
                                               setDarkModeColors({ ...darkModeColors, [currentColor]: newDarkColor });
                                           }
                                       }
                                }),
                                h('div', { style: 'margin-left:auto; display:flex; gap:2px; align-items:center;' }, [
                                    h('div', { 
                                        class: `contrast-badge ${darkLevel === 'Fail' ? 'fail' : darkLevel === 'AAA' ? 'aaa' : 'aa'}`,
                                        title: `${darkModeColor} on ${bgDark}: W ${darkRatio.toFixed(2)}:1 (need ${isLarge ? '3:1' : '4.5:1'})${darkLevel === 'Fail' ? ' - Click to auto-fix!' : ''}`,
                                        style: darkLevel === 'Fail' ? 'cursor: pointer;' : '',
                                        onClick: darkLevel === 'Fail' ? () => {
                                            const targetRatio = isLarge ? 3 : 4.5;
                                            const fixed = autoFixContrast(darkModeColor, bgDark, targetRatio);
                                            const colorIndex = colors.indexOf(colorInfo);
                                            if (colorIndex !== -1) {
                                                const currentColor = colors[colorIndex].hex;
                                                setDarkModeColors({ ...darkModeColors, [currentColor]: fixed });
                                            }
                                        } : undefined
                                    }, `W:${darkRatio.toFixed(1)}`),
                                    h('div', { 
                                        class: `contrast-badge ${darkLcLevel === 'Fail' ? 'fail' : darkLcLevel === 'AAA' ? 'aaa' : 'aa'}`,
                                        title: `${darkModeColor} on ${bgDark}: A ${darkLc.toFixed(1)} Lc (need 75+ Lc)`
                                    }, `A:${darkLc.toFixed(0)}`)
                                ])
                             ])
                        ]);
                    }))
                ])
                })(),
                
                // Graphic Colors (show WCAG only, no APCA for graphics)
                (() => {
                    const graphicColors = colors.filter(ci => !ci.isText);
                    if (graphicColors.length === 0) return null;
                    
                    const hoveredHex = normalizeHex(hoveredColor);
                    return h('div', { style: 'margin-top: 1rem;' }, [
                        h('div', { style: 'font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem;' }, `Graphic Colors (${graphicColors.length})`),
                        h('div', { class: 'color-list' }, graphicColors.map((colorInfo, idx) => {
                            const c = colorInfo.hex;
                            const isText = false;
                            const normalizedColor = normalizeHex(c);
                            const isHighlighted = hoveredHex && normalizedColor && hoveredHex === normalizedColor;
                        
                            // Graphics only use WCAG 3:1 threshold
                            const lightRatio = getContrastRatio(c, bgLight);
                            const darkRatio = getContrastRatio(c, bgDark);
                            const lightLevel = getWCAGLevel(lightRatio, false, false);
                            const darkLevel = getWCAGLevel(darkRatio, false, false);
                            const darkModeColor = darkModeColors[c] || c;
                            const darkRatioDark = getContrastRatio(darkModeColor, bgDark);
                            const darkLevelDark = getWCAGLevel(darkRatioDark, false, false);
                        
                            return h('div', { 
                                key: `graphic-${idx}`,
                                class: `color-item${isHighlighted ? ' is-highlighted' : ''}`,
                                style: 'flex-wrap: wrap;',
                                onMouseEnter: () => setHoveredColor(c),
                                onMouseLeave: () => setHoveredColor(null),
                                onFocusCapture: () => setHoveredColor(c),
                                onBlurCapture: (e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        setHoveredColor(null);
                                    }
                                }
                            }, [
                             // Light | Color | Dark preview row
                             h('div', { style: 'display: flex; gap: 0.25rem; align-items: center; width: 100%;' }, [
                                h('div', { 
                                    style: `width:20px; height:20px; background:${bgLight}; border:1px solid #999; border-radius: 2px;`,
                                    title: `Light background: ${bgLight}`
                                }),
                                h('div', { 
                                    style: `position: relative; width:24px; height:24px;`,
                                }, [
                                    h('div', { 
                                        style: `width:24px; height:24px; background:${c}; border:2px solid #333; border-radius: 2px; cursor: pointer;`,
                                        title: `${c} (graphic) - click to set BOTH light & dark modes${colorInfo.originalHex && c !== colorInfo.originalHex ? ` (original: ${colorInfo.originalHex})` : ''}`,
                                    onClick: () => {
                                        // Create a temporary color input to pick color
                                        const tempInput = document.createElement('input');
                                        tempInput.type = 'color';
                                        tempInput.value = getSafeColorPickerValue(c, '#ffffff');
                                        tempInput.style.position = 'absolute';
                                        tempInput.style.left = '-9999px';
                                        tempInput.style.opacity = '0';
                                        tempInput.style.pointerEvents = 'none';
                                        
                                        // Handle color change when user commits selection
                                        const handleColorChange = (e) => {
                                            const newColor = tempInput.value;
                                            const colorIndex = colors.indexOf(colorInfo);
                                            if (colorIndex !== -1 && newColor && newColor !== c) {
                                                const oldColor = colors[colorIndex].hex;
                                                const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : oldColor;
                                                
                                                // Apply color fix to update SVG code and preview (set both light and dark to same color)
                                                applyColorFix(originalToken, newColor, { 
                                                    darkHex: newColor,
                                                    lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                                });
                                                
                                                // Update state
                                                const newColors = [...colors];
                                                newColors[colorIndex] = { ...newColors[colorIndex], hex: newColor };
                                                setColors(newColors);
                                                
                                                // Set dark mode to same color (unified mode)
                                                const newDarkModeColors = { ...darkModeColors };
                                                newDarkModeColors[newColor] = newColor;
                                                if (oldColor !== newColor && darkModeColors[oldColor]) {
                                                    delete newDarkModeColors[oldColor];
                                                }
                                                setDarkModeColors(newDarkModeColors);
                                            }
                                            // Clean up
                                            if (tempInput.parentNode) {
                                                document.body.removeChild(tempInput);
                                            }
                                        };
                                        
                                        // Only use change event (fires when color picker closes)
                                        tempInput.addEventListener('change', handleColorChange, { once: true });
                                        
                                        document.body.appendChild(tempInput);
                                        tempInput.click();
                                    }
                                    }),
                                    colorInfo.originalHex && c !== colorInfo.originalHex ? h('div', {
                                        style: `position: absolute; bottom: -2px; right: -2px; width: 8px; height: 8px; background: ${colorInfo.originalHex}; border: 1px solid #fff; border-radius: 50%; box-shadow: 0 0 2px rgba(0,0,0,0.5);`,
                                        title: `Original: ${colorInfo.originalHex}`
                                    }) : null
                                ]),
                                h('div', { 
                                    style: `width:20px; height:20px; background:${bgDark}; border:1px solid #999; border-radius: 2px;`,
                                    title: `Dark background: ${bgDark}`
                                }),
                                h('span', { style: 'font-size: 0.65rem; color: #666; margin-left: auto;' }, '(G)'),
                             ]),
                             // Light color row
                             h('div', { style: 'display: flex; gap: 0.25rem; align-items: center; width: 100%;' }, [
                                h('strong', { style: 'font-size: 0.7rem; min-width: 35px;' }, 'Light:'),
                                h('input', { 
                                       type: 'color', 
                                       style: 'width:24px; height:24px; padding:0; border:1px solid #ccc; background:none; cursor: pointer;',
                                       title: 'Light mode color (only affects light mode)',
                                       value: getSafeColorPickerValue(c, '#ffffff'),
                                       onInput: (e) => {
                                           const newColor = e.target.value;
                                           const colorIndex = colors.indexOf(colorInfo);
                                           if (colorIndex !== -1) {
                                               const oldColor = colors[colorIndex].hex;
                                               const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : oldColor;
                                               
                                               // Apply color fix to update ONLY light mode color (no darkHex = don't touch data-dark-* attributes)
                                               applyColorFix(originalToken, newColor, { 
                                                   lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                               });
                                               
                                               // Update state - only the light mode color
                                               const newColors = [...colors];
                                               newColors[colorIndex] = { ...newColors[colorIndex], hex: newColor };
                                               setColors(newColors);
                                               
                                               // Update dark mode mapping key to preserve dark override with new light key
                                               if (darkModeColors[oldColor] !== undefined) {
                                                   const darkValue = darkModeColors[oldColor];
                                                   const newDarkModeColors = { ...darkModeColors };
                                                   delete newDarkModeColors[oldColor];
                                                   newDarkModeColors[newColor] = darkValue;
                                                   setDarkModeColors(newDarkModeColors);
                                               }
                                           }
                                       }
                                }),
                                h('input', {
                                       type: 'text',
                                       style: 'flex: 1; min-width: 80px; padding: 0.25rem; font-family: monospace; font-size: 0.75rem; border: 1px solid var(--border);',
                                       placeholder: 'light color',
                                       value: c,
                                       onBlur: (e) => {
                                           const newColor = e.target.value;
                                           if (!newColor || newColor === c) return;
                                           const colorIndex = colors.indexOf(colorInfo);
                                           if (colorIndex !== -1) {
                                               const oldColor = colors[colorIndex].hex;
                                               const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : oldColor;
                                               
                                               // Apply color fix to update ONLY light mode color (no darkHex = don't touch data-dark-* attributes)
                                               applyColorFix(originalToken, newColor, { 
                                                   lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                               });
                                               
                                               // Update state - only the light mode color
                                               const newColors = [...colors];
                                               newColors[colorIndex] = { ...newColors[colorIndex], hex: newColor };
                                               setColors(newColors);
                                               
                                               // Update dark mode mapping key to preserve dark override with new light key
                                               if (darkModeColors[oldColor] !== undefined) {
                                                   const darkValue = darkModeColors[oldColor];
                                                   const newDarkModeColors = { ...darkModeColors };
                                                   delete newDarkModeColors[oldColor];
                                                   newDarkModeColors[newColor] = darkValue;
                                                   setDarkModeColors(newDarkModeColors);
                                               }
                                           }
                                       }
                                }),
                                h('div', { style: 'margin-left:auto; display:flex; gap:2px; align-items:center;' }, [
                                    h('div', { 
                                        class: `contrast-badge ${lightLevel === 'Fail' ? 'fail' : lightLevel === 'AAA' ? 'aaa' : 'aa'}`,
                                        title: `${c} on ${bgLight}: ${lightRatio.toFixed(2)}:1 (need 3:1)${lightLevel === 'Fail' ? ' - Click to auto-fix!' : ''}`,
                                        style: lightLevel === 'Fail' ? 'cursor: pointer;' : '',
                                        onClick: lightLevel === 'Fail' ? () => {
                                            const fixed = autoFixContrast(c, bgLight, 3.0);
                                            const colorIndex = colors.indexOf(colorInfo);
                                            if (colorIndex !== -1) {
                                                const newColors = [...colors];
                                                newColors[colorIndex] = { ...newColors[colorIndex], hex: fixed };
                                                setColors(newColors);
                                                // Preserve dark mode override
                                                if (darkModeColors[c]) {
                                                    const newDarkModeColors = { ...darkModeColors };
                                                    newDarkModeColors[fixed] = newDarkModeColors[c];
                                                    delete newDarkModeColors[c];
                                                    setDarkModeColors(newDarkModeColors);
                                                }
                                            }
                                        } : undefined
                                    }, 
                                    lightRatio.toFixed(1))
                                ])
                             ]),
                             // Dark mode color row
                             h('div', { style: 'display: flex; gap: 0.25rem; align-items: center; width: 100%; border-top: 1px solid var(--border); padding-top: 0.25rem; margin-top: 0.25rem;' }, [
                                h('strong', { style: 'font-size: 0.7rem; min-width: 35px;' }, 'Dark:'),
                                h('input', { 
                                       type: 'color', 
                                       style: 'width:24px; height:24px; padding:0; border:1px solid #ccc; background:none; cursor: pointer;',
                                       title: 'Dark mode color (only affects dark mode)',
                                       value: getSafeColorPickerValue(darkModeColor, getSafeColorPickerValue(c, '#ffffff')),
                                       onInput: (e) => {
                                           const newDarkColor = e.target.value;
                                           const colorIndex = colors.indexOf(colorInfo);
                                           if (colorIndex !== -1) {
                                               const currentColor = colors[colorIndex].hex;
                                               const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : currentColor;
                                               
                                               // Apply color fix to update data-dark-* attributes
                                               applyColorFix(originalToken, currentColor, { 
                                                   darkHex: newDarkColor,
                                                   lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                               });
                                               
                                               // Update state
                                               setDarkModeColors({ ...darkModeColors, [currentColor]: newDarkColor });
                                           }
                                       }
                                }),
                                h('input', {
                                       type: 'text',
                                       style: 'flex: 1; min-width: 80px; padding: 0.25rem; font-family: monospace; font-size: 0.75rem; border: 1px solid var(--border);',
                                       placeholder: 'dark color',
                                       value: darkModeColor,
                                       onBlur: (e) => {
                                           const newDarkColor = e.target.value;
                                           if (!newDarkColor || newDarkColor === darkModeColor) return;
                                           const colorIndex = colors.indexOf(colorInfo);
                                           if (colorIndex !== -1) {
                                               const currentColor = colors[colorIndex].hex;
                                               const originalToken = colorInfo.originals && colorInfo.originals.length > 0 ? colorInfo.originals[0] : currentColor;
                                               
                                               // Apply color fix to update data-dark-* attributes
                                               applyColorFix(originalToken, currentColor, { 
                                                   darkHex: newDarkColor,
                                                   lintItem: { attrs: Array.from(colorInfo.attrs || ['fill', 'stroke']) }
                                               });
                                               
                                               // Update state
                                               setDarkModeColors({ ...darkModeColors, [currentColor]: newDarkColor });
                                           }
                                       }
                                }),
                                h('div', { style: 'margin-left:auto; display:flex; gap:2px; align-items:center;' }, [
                                    h('div', { 
                                        class: `contrast-badge ${darkLevelDark === 'Fail' ? 'fail' : darkLevelDark === 'AAA' ? 'aaa' : 'aa'}`,
                                        title: `${darkModeColor} on ${bgDark}: ${darkRatioDark.toFixed(2)}:1 (need 3:1)${darkLevelDark === 'Fail' ? ' - Click to auto-fix!' : ''}`,
                                        style: darkLevelDark === 'Fail' ? 'cursor: pointer;' : '',
                                        onClick: darkLevelDark === 'Fail' ? () => {
                                            const fixed = autoFixContrast(darkModeColor, bgDark, 3.0);
                                            const colorIndex = colors.indexOf(colorInfo);
                                            if (colorIndex !== -1) {
                                                const currentColor = colors[colorIndex].hex;
                                                setDarkModeColors({ ...darkModeColors, [currentColor]: fixed });
                                            }
                                        } : undefined
                                    }, 
                                    darkRatioDark.toFixed(1))
                                ])
                             ])
                        ]);
                    }))
                ])
                })()
            ]),
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
            ]),
            
            // Resources Accordion
            h('div', { class: 'accordion', role: 'region', 'aria-expanded': accordionState.resources ? 'true' : 'false' }, [
                h('div', { class: 'accordion-header', onClick: (e) => {
                    const next = { ...accordionState, resources: !accordionState.resources };
                    setAccordionState(next);
                    try { localStorage.setItem('accordionState', JSON.stringify(next)); } catch (err) {}
                } }, [
                    h('span', {}, 'Resources'),
                    h('span', { class: 'chev' }, '▸')
                ]),
                h('div', { class: 'accordion-content' }, [
                    h('ul', { class: 'resources-list' }, [
                        h('li', {}, [
                            h('a', {
                                href: 'https://www.smashingmagazine.com/2021/05/accessible-svg-patterns-comparison/',
                                target: '_blank',
                                rel: 'noopener noreferrer'
                            }, 'Accessible SVG Patterns (Carie Fisher)')
                        ]),
                        h('li', {}, [
                            h('a', {
                                href: 'https://www.deque.com/blog/creating-accessible-svgs/',
                                target: '_blank',
                                rel: 'noopener noreferrer'
                            }, 'Creating Accessible SVGs (Deque)')
                        ]),
                        h('li', {}, [
                            h('a', {
                                href: 'https://polypane.app/blog/forced-colors-explained-a-practical-guide/',
                                target: '_blank',
                                rel: 'noopener noreferrer'
                            }, 'Forced Colors Guide (Polypane)')
                        ]),
                        h('li', {}, [
                            h('a', {
                                href: 'https://www.w3.org/WAI/WCAG22/quickref/',
                                target: '_blank',
                                rel: 'noopener noreferrer'
                            }, 'WCAG 2.2 Quick Reference')
                        ])
                    ])
                ])
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
                    h('div', { class: 'preview-viewport preview-light', style: `background-color: ${bgLight} !important;` }, [
                         h('div', { 
                             key: `light-${previewLightHtml.length}`,
                             style: 'width:100%; height:100%; display:flex; align-items:center; justify-content:center;',
                             dangerouslySetInnerHTML: { __html: previewLightHtml } 
                         })
                    ])
                ]),
                // Dark
                h('div', { class: 'preview-pane' }, [
                    h('div', { class: 'preview-header' }, `Dark Mode • ${activeTabMeta.label}`),
                     h('div', { class: 'preview-viewport preview-dark', style: `background-color: ${bgDark} !important;` }, [
                         h('div', { 
                             key: `dark-${previewDarkHtml.length}`,
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
                        const lightHex = normalizeHex(it.hex) || String(it.hex || '').toLowerCase();
                        const darkHex = normalizeHex(it.hexDark) || normalizeHex(it.hex) || String(it.hexDark || it.hex || '').toLowerCase();
                        const key = `${lightHex}|${darkHex}`;
                        const entry = colorMap.get(key) || {
                            type: 'color',
                            hex: lightHex,
                            hexDark: darkHex,
                            heading: null,
                            target: null,
                            details: [],
                            originals: new Set(),
                            darkOriginals: new Set(),
                            attrs: new Set(),
                            suggested: null,
                            suggestedDark: null,
                            fallbackMessages: [],
                            findingCount: 0,
                            isText: false,
                            isLarge: false
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
                        (it.darkOriginals || []).forEach(o => entry.darkOriginals.add(o));
                        (it.attrs || []).forEach(a => entry.attrs.add(a));
                        if (it.suggested && !entry.suggested) entry.suggested = it.suggested;
                        if (it.suggestedDark && !entry.suggestedDark) entry.suggestedDark = it.suggestedDark;
                        if (typeof it.isText === 'boolean') entry.isText = entry.isText || it.isText;
                        if (typeof it.isLarge === 'boolean') entry.isLarge = entry.isLarge || it.isLarge;
                        colorMap.set(key, entry);
                    } else if (it) {
                        combined.push(it);
                    }
                });
                const formatBg = (bg) => (typeof bg === 'string' ? bg.toUpperCase() : String(bg || ''));
                const formatRatio = (val) => (typeof val === 'number' && Number.isFinite(val) ? val.toFixed(2) : 'n/a');
                const formatLc = (val) => (typeof val === 'number' && Number.isFinite(val) ? val.toFixed(1) : 'n/a');

                const meetsSingleBackground = (color, background, isText, isLarge) => {
                    if (!color) return false;
                    const ratio = getContrastRatio(color, background);
                    if (getWCAGLevel(ratio, isText, isLarge) === 'Fail') return false;
                    if (!isText) return true;
                    return Math.abs(getAPCAContrast(color, background)) >= 75;
                };

                const refineForBackground = (baseColor, background, isText, isLarge) => {
                    const base = normalizeHex(baseColor) || baseColor;
                    if (meetsSingleBackground(base, background, isText, isLarge)) return base;
                    const wcagCandidate = normalizeHex(suggestAccessibleColor(base, background, background, isText, 'wcag')) || null;
                    if (wcagCandidate && meetsSingleBackground(wcagCandidate, background, isText, isLarge)) return wcagCandidate;
                    if (isText) {
                        const apcaCandidate = normalizeHex(suggestAccessibleColor(base, background, background, isText, 'apca')) || null;
                        if (apcaCandidate && meetsSingleBackground(apcaCandidate, background, isText, isLarge)) return apcaCandidate;
                    }
                    return base;
                };

                const meetsPair = (lightColor, darkColor, isText, isLarge) => (
                    meetsSingleBackground(lightColor, bgLight, isText, isLarge) &&
                    meetsSingleBackground(darkColor, bgDark, isText, isLarge)
                );

                for (const v of colorMap.values()) {
                    const hexLight = normalizeHex(v.hex) || v.hex;
                    const hexDark = normalizeHex(v.hexDark) || hexLight;
                    const isText = v.isText;
                    const isLarge = v.isLarge;

                    const dual = normalizeHex(suggestDualContrastColor(hexLight, bgLight, bgDark, isText, isLarge)) || null;
                    let chosenLight = null;
                    let chosenDark = null;

                    if (dual && meetsPair(dual, dual, isText, isLarge)) {
                        chosenLight = dual;
                        chosenDark = dual;
                    } else {
                        const refinedLight = refineForBackground(hexLight, bgLight, isText, isLarge);
                        const refinedDark = refineForBackground(hexDark, bgDark, isText, isLarge);
                        if (meetsPair(refinedLight, refinedDark, isText, isLarge)) {
                            chosenLight = refinedLight;
                            chosenDark = refinedDark;
                        } else if (dual && meetsSingleBackground(dual, bgLight, isText, isLarge)) {
                            chosenLight = dual;
                            chosenDark = refineForBackground(dual, bgDark, isText, isLarge);
                        } else {
                            chosenLight = refinedLight;
                            chosenDark = refinedDark;
                        }
                    }

                    v.suggested = chosenLight || hexLight;
                    v.suggestedDark = chosenDark && chosenDark !== v.suggested ? chosenDark : null;
                    v.hex = typeof hexLight === 'string' ? hexLight.toUpperCase() : hexLight;
                    v.hexDarkDisplay = typeof hexDark === 'string' ? hexDark.toUpperCase() : hexDark;
                    const detailLines = [];
                    const wcagDetails = v.details.filter(detail => detail && detail.check === 'WCAG 2.2');
                    const apcaDetails = v.details.filter(detail => detail && detail.check === 'APCA');
                    const backgrounds = [
                        { key: 'light', label: 'light', background: bgLight },
                        { key: 'dark', label: 'dark', background: bgDark }
                    ];
                    backgrounds.forEach(({ key, label, background }) => {
                        const wcagInfo = wcagDetails.find(detail => detail[key]);
                        const apcaInfo = apcaDetails.find(detail => detail[key]);
                        const metrics = [];
                        if (wcagInfo && wcagInfo[key]) {
                            metrics.push(`WCAG ${formatRatio(wcagInfo[key].ratio)}:1 (${wcagInfo[key].status}; needs ${wcagInfo.requirement})`);
                        }
                        if (apcaInfo && apcaInfo[key]) {
                            metrics.push(`APCA Lc ${formatLc(apcaInfo[key].lc)} (${apcaInfo[key].status}; needs ${apcaInfo.requirement})`);
                        }
                        if (metrics.length > 0) {
                            detailLines.push(`Foreground ${v.hex} on ${label} background ${formatBg(background)} — ${metrics.join('; ')}`);
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
                    v.darkOriginals = Array.from(v.darkOriginals || []);
                    v.attrs = Array.from(v.attrs || []);
                    v.findingCount = v.findingCount || v.details.length || 1;
                    delete v.fallbackMessages;
                    combined.push(v);
                }

                combined.sort((a, b) => {
                    const la = (a.level === 'error') ? 0 : 1;
                    const lb = (b.level === 'error') ? 0 : 1;
                    return la - lb;
                });

                if (combined.length === 0) {
                    return null;
                }

                const handleLintFix = (lintEntry) => {
                    if (!lintEntry) return;
                    const originalToken = (lintEntry.originals && lintEntry.originals[0]) || lintEntry.hex;
                    const lightHex = lintEntry.suggested || lintEntry.hex;
                    const darkHex = lintEntry.suggestedDark || null;
                    applyColorFix(originalToken, lightHex, { lintItem: lintEntry, darkHex });
                };

                const renderLintItem = (it, keyPrefix) => {
                    const baseLabel = it.hex ? `Color ${it.hex}` : 'Lint issue';
                    const accessibleLabel = it.findingCount && it.findingCount > 1
                        ? `${baseLabel} (${it.findingCount} findings)`
                        : baseLabel;
                    const messageContent = Array.isArray(it.messages)
                        ? it.messages.map((m, i) => h('div', { key: `${keyPrefix}-msg-${i}` }, m))
                        : (it.message || '');
                    return h('div', {
                        key: `${keyPrefix}-${it.hex || it.message || 'lint'}`,
                        class: 'lint-item',
                        'data-type': it.type || 'general',
                        role: 'listitem',
                        tabIndex: 0,
                        'aria-label': accessibleLabel,
                        onKeyDown: handleLintKeyDown
                    }, [
                        h('div', { class: 'lint-message' }, messageContent),
                        h('div', { class: 'lint-action' }, [
                            it.findingCount && it.findingCount > 1 && h('span', { class: 'lint-count' }, `${it.findingCount} findings`),
                            it.type === 'color' && (it.suggestedDark
                                ? h('span', { class: 'suggest' }, `Light: ${(it.suggested || '').toUpperCase()} / Dark: ${it.suggestedDark.toUpperCase()}`)
                                : h('span', { class: 'suggest' }, (it.suggested || '').toUpperCase())),
                            it.type === 'color' && h('button', {
                                class: 'small',
                                onClick: () => handleLintFix(it),
                                'aria-label': `Fix color ${it.hex || ''}`
                            }, 'Fix')
                        ])
                    ]);
                };

                return h('div', { class: 'lint-panel', role: 'region', 'aria-label': 'Lint results' }, [
                    h('div', { class: 'lint-header' }, [
                        h('span', { class: 'lint-title' }, `Lint: ${combined.length} item${combined.length !== 1 ? 's' : ''}${lintResults.length !== combined.length ? ` (${lintResults.length} finding${lintResults.length !== 1 ? 's' : ''})` : ''}`),
                        h('button', { class: 'lint-close', onClick: () => setLintPanelVisible(false), 'aria-label': 'Hide lint panel' }, '×')
                    ]),
                    h('div', { class: 'lint-list', role: 'list', ref: lintListRef, tabIndex: 0 },
                        combined.map((it, idx) => renderLintItem(it, `lint-${idx}`))
                    )
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
