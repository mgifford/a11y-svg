# A11y-SVG-Studio

A browser-native SVG optimization tool that prioritizes **WCAG 2.2 AA accessibility** and **dynamic theming** (light/dark mode).

## 🎯 Core Features

- **Zero Build Step**: Pure ES Modules (ESM) and CDNs - no npm install required
- **Accessibility First**: WCAG 2.2 AA compliant with keyboard navigation and screen reader support
- **SVG Optimization**: SVGO integration that preserves accessibility attributes
- **Theme Awareness**: Dynamic light/dark mode support with `currentColor` and CSS media queries
- **Contrast Checking**: Real-time WCAG 2.2 contrast ratio validation
- **License**: AGPL-3.0

## 🚀 Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/mgifford/a11y-svg.git
   cd a11y-svg
   ```

2. Open `index.html` in your browser
   - Double-click to open in your default browser, or
   - Use any local server: `python3 -m http.server 8000`

No build process required! All dependencies are loaded via CDN.

### 🧪 Tests & QA

- `npm test` runs the full 35-test suite (23 regression, 12 features, UI/DOM) and must pass before shipping changes.
- `npm run qa` chains `svg:lint`, `axe`, and `pa11y` to ensure accessibility and structural integrity.
- `npm run test:regression`, `npm run test:features`, and `npm run test:jsdom` target specific suites when iterating.
- The browser runtime remains zero-build; CLI scripts are optional guardrails for maintainers preparing assets.

### Optional: CLI Guardrails

If you want to batch-optimize or audit source SVGs outside the browser UI, run the provided scripts:

```bash
npm install
npm run svgo       # batch optimize SVGs in ./svg folder
npm run svg:lint   # structural sanity checks via svglint
npm run axe        # axe-core WCAG 2.2 AA test against index.html
npm run pa11y      # Pa11y WCAG 2.0 AA audit of index.html
npm run test:jsdom # Node.js-based contrast function tests
npm run qa         # runs svg:lint, axe, and pa11y in sequence
```

`npm run svgo` reads every file in `./svg`, applies `svgo.config.mjs`, and writes the results back in-place while preserving accessibility metadata (IDs, `<title>`, `<desc>`, `viewBox`, etc.). The other scripts confirm the resulting markup stays accessible without needing to open a browser.

Need to process an individual file? Use the same config with `npx`:

```bash
npx svgo -c svgo.config.mjs input.svg -o output.svg
```

> GitHub Pages still serves the browser-only app; these CLI steps are purely optional for maintainers preparing assets.

### Accessibility QA Scripts

Each CLI command focuses on a different failure mode:

- `npm run svg:lint` catches malformed markup, duplicate IDs, and missing namespaces before the SVG reaches the editor.
- `npm run axe` exercises the shipped `index.html` with axe-core’s WCAG 2.2 AA rules to detect ARIA/semantics regressions.
- `npm run pa11y` performs a second accessibility pass (keyboard traps, color contrast, etc.) so issues get surfaced even if the UI hasn’t been opened manually.
- `npm run test:jsdom` validates contrast calculation functions (WCAG and APCA) using Node.js/VM without browser dependencies.

Use `npm run qa` any time you add new UI features or SVG samples—the combined run will fail fast if any of the guardrails trip. For comprehensive validation including unit tests, run both `npm run qa` and `npm run test:jsdom`.

## 📋 Features

### Accessibility Wizard
Following [Carie Fisher's Accessible SVG patterns](https://www.smashingmagazine.com/2021/05/accessible-svg-patterns-comparison/):
- **Decorative**: Apply `aria-hidden` / `role="presentation"`
- **Informational**: Require `<title>` / `<desc>` with unique linked IDs
- **Interactive**: Manage focus and roles for interactive elements

### Advanced Theming
- **currentColor**: Replace hardcoded colors with `currentColor` for theme inheritance
- **Media Query Injection**: Inject `@media (prefers-color-scheme: dark)` styles directly into SVG
- **CSS Variables**: Map unique hex codes to CSS variables for external styling

### Visual Contrast Engine
- Parse all `fill` / `stroke` colors
- Interactive color picker for adjustments
- Real-time WCAG 2.2 contrast ratio calculator
- Test against configurable background colors

### Output Options
- Minified, accessible SVG code
- Works inline, in `<img>` tags, and as CSS backgrounds
- Preserves `xmlns` namespaces for standalone usage

## 🎨 UI/UX

- Semantic HTML5 with ARIA live regions
- High-contrast focus indicators
- Split-view preview (light/dark backgrounds)
- Fully keyboard navigable

## 📦 SVG Collection

The `svg/` directory contains curated SVG examples for testing and demonstration:

- **Local samples**: Copyright, Creative Commons, and DRM-related icons showcasing various accessibility patterns
- **Remote examples**: `svg/remote/` contains SVGs fetched from external sources via `scripts/collect_svgviewer.js`
- **Metadata tracking**: `svg/manifest.json` catalogs all local SVG files with checksums and metadata
- **Index pages**: Both `svg/index.html` and `svg/remote/index.html` provide browsable galleries

To update the remote SVG collection:
```bash
node scripts/collect_svgviewer.js
```

## 🛠️ Technical Stack

- **Framework**: Vanilla JS / Preact (via ESM)
- **Optimization**: SVGO (browser-compatible via esm.sh)
- **Styling**: CSS with custom properties
- **Hosting**: GitHub Pages ready

## 📏 Accessibility & Optimization Specs

- [SVG_ACCESSIBILITY_BEST_PRACTICES.md](SVG_ACCESSIBILITY_BEST_PRACTICES.md) — normative WCAG 2.2 AA guidance (naming, roles, contrast, dark mode)
- [SVG_OPTIMIZATION_BEST_PRACTICES.md](SVG_OPTIMIZATION_BEST_PRACTICES.md) — edit-safe SVGO rules and verification checklist
- All changes must preserve accessibility metadata (`<title>`, `<desc>`, `aria-*`, `role`, `viewBox`, IDs) and the zero-build guarantee

## 📝 License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

The full AGPL-3.0 license text is available at <https://www.gnu.org/licenses/agpl-3.0.txt>.

All source files include the AGPL-3.0 license header as required.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All code maintains AGPL-3.0 license headers
- Zero build step requirement is preserved
- Accessibility standards (WCAG 2.2 AA) are met
- SVG standards compliance

## 🗂️ File Structure

```
a11y-svg/
├── index.html          # Main application entry point
├── app.js              # Preact application (ES modules via CDN)
├── styles.css          # Application styles with theme support
├── package.json        # Dev dependencies for QA scripts
├── svgo.config.mjs     # SVGO configuration preserving a11y attributes
├── AGENTS.md           # AI agent instructions for development
├── README.md           # This file
├── scripts/            # Helper scripts
│   └── collect_svgviewer.js  # Fetch remote SVG examples
├── svg/                # SVG test samples and examples
│   ├── manifest.json   # Catalog of local SVG files
│   └── remote/         # Remote SVG examples
└── tests/              # Test suites
   ├── contrast.test.js   # Contrast calculation validation
   ├── regression.test.js # Regression harness (23 tests)
   ├── features.test.js   # Feature and integration coverage
   └── ui.test.js         # DOM structure and JSDOM validation
```

## 📚 Resources

- [Accessible SVG Patterns](https://www.smashingmagazine.com/2021/05/accessible-svg-patterns-comparison/) by Carie Fisher
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [SVGO Documentation](https://github.com/svg/svgo)

## 🔗 Links

- [Live Demo](https://mgifford.github.io/a11y-svg/) (GitHub Pages)
- [Report Issues](https://github.com/mgifford/a11y-svg/issues)
- [Discussions](https://github.com/mgifford/a11y-svg/discussions)