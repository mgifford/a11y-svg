# A11y-SVG-Studio: Agent Instructions

## Core Mission
Maintain and evolve a browser-native SVG optimization tool that prioritizes WCAG 2.2 AA accessibility and dynamic theming (light/dark mode).

## Technical Guardrails
- Zero build step: All logic must run via ES Modules (ESM) and CDNs. Do not introduce Webpack, Vite, or end-user `npm install` requirements.
- License compliance: Every file must maintain the AGPL-3.0 header.
- A11y first: The UI must be keyboard-navigable and screen-reader friendly, using semantic HTML5 elements.
- SVG standards: Follow Carie Fisher's Accessible SVG patterns. Preserve `xmlns` namespaces for standalone SVG usage.
- Semantic integrity: Don't remove meaningful semantics; defer to the normative references below when deciding whether to strip or rewrite structure.
- Preserve metadata exactly as required by the normative accessibility spec; defer to automated helpers only when they satisfy those clauses.

## Normative References & Future Prompts
- [SVG_ACCESSIBILITY_BEST_PRACTICES.md](SVG_ACCESSIBILITY_BEST_PRACTICES.md) — normative accessibility specification for authoring, optimization, linting, and the "Generate prompt to improve this image" workflow.
- [SVG_OPTIMIZATION_BEST_PRACTICES.md](SVG_OPTIMIZATION_BEST_PRACTICES.md) — normative optimization specification governing default transforms, optional compression, and edit-safe guarantees.

Both documents supply authoritative requirements. Treat them as source-of-truth for any feature, regression test, or AI-assist prompt. The future "Generate prompt to improve this image" flow MUST quote the relevant clauses from these references when proposing changes.

## Design Philosophy
- Utility: Optimization must not strip accessibility tags (`<title>`, `<desc>`, `aria-*`).
- Interoperability: Output SVGs should work inline, in `<img>` tags, and as CSS backgrounds where possible.
- Theming: Prefer `currentColor` and CSS media queries within the SVG structure to support system-level dark mode.

## Implementation Prompt
Act as a Senior Frontend Engineer and Web Accessibility Specialist. Create a single-file web application called A11y-SVG-Studio designed to run on GitHub Pages (Vanilla JS/HTML/CSS or Preact via ESM) under the AGPL-3.0 license.

The tool must transform raw SVGs into WCAG 2.2 AA-compliant assets that are performance-optimized and theme-aware.

## Core Functional Requirements
- License: Include the AGPL-3.0 license header in the source.
- SVGO integration: Use a browser-compatible version of SVGO (via `esm.sh`) to minify SVGs without stripping accessibility attributes (e.g., `<title>`, `<desc>`, `aria-label`).

- Accessibility wizard (Carie Fisher patterns):
	- Force a choice: Decorative (apply `aria-hidden`/`role="presentation"`), Informational (require `<title>`/`<desc>` with unique linked IDs), or Interactive (manage focus and roles).
	- Automatically generate unique, collision-resistant IDs for all ARIA-linked elements.

- Advanced theming (light/dark mode):
	- `currentColor`: Toggle to replace hardcoded colors with `currentColor`.
	- Media query injection: Inject a `<style>` block inside the SVG using `@media (prefers-color-scheme: dark)` to allow user-defined color overrides.
	- CSS variables: Map unique hex codes to CSS variables for external styling.

- Visual contrast engine:
	- Parse and list all unique `fill`/`stroke` colors.
	- Provide a color picker for adjustments.
	- Real-time WCAG 2.2 contrast checker: Calculate the ratio between SVG elements and a configurable background color.
	- Apply APCA checks only to text per [SVG_ACCESSIBILITY_BEST_PRACTICES.md](SVG_ACCESSIBILITY_BEST_PRACTICES.md) to avoid false positives on purely decorative fills.

- UI/UX:
	- Benchmark-level accessibility: semantic HTML, high-contrast focus rings, and ARIA live regions for status changes.
	- Split-view preview: Show the SVG on light and dark backgrounds simultaneously to test theme-awareness.

- Output:
	- Provide a single Copy button for the finalized, accessible, and minified SVG code.

## QA & Tooling Expectations
- Keep the no-build GitHub Pages runtime, but maintainers may run local CLI helpers (`npm run svgo`, `npm run svg:lint`, `npm run axe`, `npm run pa11y`, `npm run test:jsdom`, or `npm run qa`) to vet incoming assets.
- Ensure SVG assets committed to `svg/` pass these scripts; treat failures as blockers before shipping UI changes.
- When documenting new features, mention which QA script protects that surface so contributors know how to validate their changes.
- All contrast calculation logic must be validated by `tests/contrast.test.js` which runs helper functions in a VM sandbox without browser dependencies.
- Linting checklist (derive from the normative specs above and keep tooling in sync):
	1. Accessible naming: `role="img"`, `aria-labelledby`, `<title>`, `<desc>` as per [SVG_ACCESSIBILITY_BEST_PRACTICES.md](SVG_ACCESSIBILITY_BEST_PRACTICES.md#1.-accessible-naming).
	2. Structural integrity: IDs, namespaces, and semantics preserved; reject any SVGO change that violates Sections 2 and 4 of [SVG_OPTIMIZATION_BEST_PRACTICES.md](SVG_OPTIMIZATION_BEST_PRACTICES.md).
	3. Theming guarantees: `currentColor` usage, dark-mode overrides, and forced-colors resilience validated against the accessibility spec.
	4. Contrast verification: WCAG AA/AAA thresholds for both light and dark backgrounds plus APCA thresholds for text.
	5. Post-optimization verification: Run the Section 7 checklist from [SVG_OPTIMIZATION_BEST_PRACTICES.md](SVG_OPTIMIZATION_BEST_PRACTICES.md#7.-verification-checklist) before accepting output.

## File Organization Rules
- Core application: `index.html`, `app.js`, `styles.css` form the single-page application
- Configuration: `svgo.config.mjs` must preserve accessibility attributes (`<title>`, `<desc>`, `aria-*`, `role`, `viewBox`, IDs)
- Test assets: Sample SVGs go in `svg/` with metadata tracked in `svg/manifest.json`
- Scripts: Utility scripts (remote SVG collection, manifest updates) belong in `scripts/`
- Tests: All test files belong in `tests/` directory
- Every JavaScript/HTML file must include the AGPL-3.0 license header

## SVGO Profiles Linked To Normative Specs
- `accessible-default` (implemented in [svgo.config.mjs](svgo.config.mjs)) maps to Sections 2 and 4 of [SVG_OPTIMIZATION_BEST_PRACTICES.md](SVG_OPTIMIZATION_BEST_PRACTICES.md). Keep `collapseGroups` and `mergePaths` disabled and numeric precision at 3 decimals to stay edit-safe.
- `production-opt-in` (future profile) aligns with Section 3 of [SVG_OPTIMIZATION_BEST_PRACTICES.md](SVG_OPTIMIZATION_BEST_PRACTICES.md#3.-conditional-optimizations-opt-in). Enable `collapseGroups` and `mergePaths` only when the verification checklist passes and the asset is locked for downstream editing.
- Both profiles MUST refuse to remove `<title>`, `<desc>`, `viewBox`, or IDs; if SVGO introduces new plugins, reconcile them against Sections 4 and 5 before adoption.

## Development Workflow
1. Make changes to `app.js`, `styles.css`, or `index.html`
2. Test locally by opening `index.html` in a browser
3. Run `npm run qa` to validate accessibility compliance
4. Run `npm run test:jsdom` to validate contrast calculations
5. Commit only if all tests pass and accessibility is maintained

## Code Style Guidelines
- Use ES modules with CDN imports (no bundler)
- Prefer functional components (Preact hooks)
- Use semantic HTML5 elements
- Include ARIA labels and live regions for dynamic content
- Comment complex contrast calculations with WCAG references
- Keep functions focused and testable outside the browser (see `tests/contrast.test.js`)