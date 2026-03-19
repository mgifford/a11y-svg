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

### Accessible Name Detection (False-Positive-Aware)
The linter checks for proper accessible names on meaningful SVGs:
- **Error**: No accessible name found (no aria-label, aria-labelledby, or title)
- **Warning**: Has title but no aria-labelledby (may not be announced by all screen readers)
- **Pass**: Has aria-label OR aria-labelledby referencing title

**Best Practice**: Use `<title>` with a unique `id`, and reference it with `aria-labelledby` on the `<svg>` element.

**Avoiding False Positives**: If your SVG is decorative, select "Decorative" intent and these checks will be skipped.

### Accessibility Wizard
Following [Carie Fisher's Accessible SVG patterns](https://www.smashingmagazine.com/2021/05/accessible-svg-patterns-comparison/):
- **Decorative**: Apply `aria-hidden` / `role="presentation"` (no accessible name required)
- **Meaningful**: Combines informational + interactive - requires proper accessible name via title/aria-label
- Smart intent detection based on presence of title/description

### Advanced Theming
- **currentColor**: Replace hardcoded colors with `currentColor` for theme inheritance
- **Media Query Injection**: Inject `@media (prefers-color-scheme: dark)` styles directly into SVG
- **CSS Variables**: Map unique hex codes to CSS variables for external styling

### Visual Contrast Engine
- Parse all `fill` / `stroke` colors
- Interactive color picker for adjustments
- Real-time WCAG 2.2 contrast ratio calculator
- Test against configurable background colors

### Resources
Direct links to authoritative accessibility guidance:
- Accessible SVG Patterns (Carie Fisher)
- Creating Accessible SVGs (Deque)
- Forced Colors Guide (Polypane)
- WCAG 2.2 Quick Reference

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

- **[ACCESSIBILITY.md](ACCESSIBILITY.md)** — our commitment to WCAG 2.2 AA, testing requirements, and contributor guidelines
- [SVG_ACCESSIBILITY_BEST_PRACTICES.md](SVG_ACCESSIBILITY_BEST_PRACTICES.md) — normative WCAG 2.2 AA guidance (naming, roles, contrast, dark mode)
- [SVG_OPTIMIZATION_BEST_PRACTICES.md](SVG_OPTIMIZATION_BEST_PRACTICES.md) — edit-safe SVGO rules and verification checklist
- All changes must preserve accessibility metadata (`<title>`, `<desc>`, `aria-*`, `role`, `viewBox`, IDs) and the zero-build guarantee

## 📝 License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

The full AGPL-3.0 license text is available at <https://www.gnu.org/licenses/agpl-3.0.txt>.

All source files include the AGPL-3.0 license header as required.

## 🤖 AI Disclosure

Transparency about AI use is a first-class concern for this project.

### Was AI used to build this project?

**Yes.** [GitHub Copilot Coding Agent](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/about-github-copilot-coding-agent) has been used throughout development to implement features, write tests, refactor code, and author documentation — including this file. The `.github/copilot-instructions.md` and `AGENTS.md` files provide the instructions and guardrails that govern how the agent operates in this repository.

### Is AI used when running the program?

**No.** The browser application (`index.html` / `app.js`) contains no AI API calls, no model inference, and no calls to any external LLM service. All SVG optimization, accessibility analysis, contrast checking, and theme generation are performed by deterministic, rule-based JavaScript running entirely in the user's browser.

### Is browser-based AI enabled in this application?

**No.** The application does not use the [Chrome Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in) (`window.ai`, Prompt API, Summarization API, etc.), WebLLM, Transformers.js, or any other browser-native or in-page inference engine. No model weights are downloaded or executed client-side.

### AI in CI/CD

The [Accessibility Scanner workflow](.github/workflows/accessibility-scanner.yml) sets `skip_copilot_assignment: false`, which means **GitHub Copilot** may be assigned to accessibility issues discovered by the scanner to suggest remediation. This is a CI/CD integration only and does not affect the runtime application.

### Summary table

| Context | AI used? | Tool |
|---------|----------|------|
| Building / coding the project | ✅ Yes | GitHub Copilot Coding Agent |
| Writing tests and documentation | ✅ Yes | GitHub Copilot Coding Agent |
| CI/CD accessibility issue triage | ✅ Yes | GitHub Copilot (issue assignment) |
| Running the browser application | ❌ No | — |
| Browser-based / client-side AI | ❌ No | — |

> **AGENTS.md instruction**: AI agents contributing to this project MUST keep this section accurate and up to date. Only list tools that were genuinely used. See the [AI Disclosure instruction in AGENTS.md](AGENTS.md#documentation-expectations) for the full requirement.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All code maintains AGPL-3.0 license headers
- Zero build step requirement is preserved
- Accessibility standards (WCAG 2.2 AA) are met — see [ACCESSIBILITY.md](ACCESSIBILITY.md)
- SVG standards compliance
- All tests pass (`npm test` and `npm run qa`)

## 🗂️ File Structure

```
a11y-svg/
├── index.html          # Main application entry point
├── app.js              # Preact application (ES modules via CDN)
├── styles.css          # Application styles with theme support
├── package.json        # Dev dependencies for QA scripts
├── svgo.config.mjs     # SVGO configuration preserving a11y attributes
├── ACCESSIBILITY.md    # Accessibility commitment and guidelines
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