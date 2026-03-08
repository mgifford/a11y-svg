# GitHub Copilot Custom Instructions — A11y-SVG-Studio

> These instructions are automatically read by GitHub Copilot Coding Agent when
> it works on issues in this repository.  They summarise the full guidance in
> [AGENTS.md](../AGENTS.md) and the normative references listed there.
> See the [Getting started with agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/)
> guide for how Copilot uses this file.

---

## Mission

A11y-SVG-Studio is a **browser-native, zero-build SVG optimization and
accessibility tool** published under **AGPL-3.0**. Every change must advance
WCAG 2.2 AA compliance for both the tool's own UI and the SVG assets it
produces.

---

## Non-Negotiable Constraints

1. **Zero build step** — Do not introduce Webpack, Vite, Rollup, or any bundler.
   All runtime dependencies must be loaded via ES Modules from a CDN (esm.sh,
   unpkg, cdnjs).

2. **AGPL-3.0 license headers** — Every new or modified `.js` or `.html` file
   must begin with the AGPL-3.0 header already present in `app.js` and
   `index.html`.

3. **Preserve SVG accessibility attributes** — Never strip or rewrite
   `<title>`, `<desc>`, `aria-*` attributes, `role`, `viewBox`, or any element
   ID that is referenced by `aria-labelledby` / `aria-describedby`.  Treat
   [SVG_ACCESSIBILITY_BEST_PRACTICES.md](../SVG_ACCESSIBILITY_BEST_PRACTICES.md)
   as the authoritative specification.

4. **Follow Carie Fisher's three-pattern model** for SVG intent:
   - *Decorative* → add `aria-hidden="true"` and `role="presentation"`.
   - *Informational* → require `<title>` + (optionally) `<desc>` with unique,
     collision-resistant IDs linked via `aria-labelledby`.
   - *Interactive* → manage keyboard focus, roles, and state.

5. **No SVGO transforms that harm edit-safety** — Keep `collapseGroups` and
   `mergePaths` **disabled**; keep numeric precision at **3 decimal places**.
   See Sections 2 & 4 of
   [SVG_OPTIMIZATION_BEST_PRACTICES.md](../SVG_OPTIMIZATION_BEST_PRACTICES.md).

---

## Test & QA Requirements

Before opening a pull request, every change **must** pass:

```bash
npm test          # 35/35 tests (23 regression + 12 feature + DOM)
npm run qa        # svg:lint + axe (WCAG 2.0 AA) + pa11y (WCAG2AA)
```

If `npm test` fails, fix the code (or the test with a documented justification)
before proceeding.  See [tests/README.md](../tests/README.md) for a guide to
each test's intent.

---

## Accessibility Standards for the UI Itself

- Use semantic HTML5 elements (`<button>`, `<nav>`, `<main>`, `<section>`…).
- Provide high-contrast focus rings for every interactive element.
- Announce dynamic status changes via ARIA live regions
  (`role="status"` / `aria-live="polite"`).
- Support keyboard-only operation (no mouse-only interactions).
- Support forced-colors / high-contrast mode.
- Test with NVDA + Chrome and VoiceOver + Safari before marking a PR ready.

---

## Normative References

| Document | Purpose |
|----------|---------|
| [AGENTS.md](../AGENTS.md) | Full agent instructions (superset of this file) |
| [SVG_ACCESSIBILITY_BEST_PRACTICES.md](../SVG_ACCESSIBILITY_BEST_PRACTICES.md) | Authoritative SVG a11y spec |
| [SVG_OPTIMIZATION_BEST_PRACTICES.md](../SVG_OPTIMIZATION_BEST_PRACTICES.md) | Safe SVGO transform rules |
| [ACCESSIBILITY.md](../ACCESSIBILITY.md) | Project-wide a11y commitment |
| [tests/README.md](../tests/README.md) | Test suite documentation |

When in doubt about a structural SVG change, quote the relevant clause from
one of the documents above in the PR description.
