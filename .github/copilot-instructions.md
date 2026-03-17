# GitHub Copilot Custom Instructions — A11y-SVG-Studio

> **Start here.** Read [AGENTS.md](../AGENTS.md) first — it is the authoritative
> guide for every agent working in this repository.  This file is a concise
> orientation that points you to the right places; AGENTS.md contains the full
> detail.
>
> See the [Getting started with agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/)
> guide for how Copilot uses this file.

---

## Primary References

Read these documents **before making any changes**:

| Document | Purpose |
|----------|---------|
| **[AGENTS.md](../AGENTS.md)** | **Primary** — full agent instructions, technical guardrails, dev workflow |
| [ACCESSIBILITY.md](../ACCESSIBILITY.md) | Project-wide WCAG 2.2 AA commitment and contributor guidelines |
| [SVG_ACCESSIBILITY_BEST_PRACTICES.md](../SVG_ACCESSIBILITY_BEST_PRACTICES.md) | Normative SVG accessibility spec (Carie Fisher three-pattern model) |
| [SVG_OPTIMIZATION_BEST_PRACTICES.md](../SVG_OPTIMIZATION_BEST_PRACTICES.md) | Safe SVGO transform rules (edit-safety guarantees) |
| [tests/README.md](../tests/README.md) | Test suite documentation and failure guide |

---

## Quick-Start Checklist

1. **Read [AGENTS.md](../AGENTS.md)** — covers zero-build constraint, AGPL-3.0
   headers, SVG a11y preservation, SVGO profiles, and full dev workflow.
2. **Run the baseline tests** before touching any code:
   ```bash
   npm test          # must pass 35/35
   ```
3. **After your changes**, run the full QA gate:
   ```bash
   npm test          # 35/35 tests (23 regression + 12 feature + DOM)
   npm run qa        # svg:lint + axe (WCAG 2.0 AA) + pa11y (WCAG2AA)
   ```
4. **Never commit** if `npm test` fails — fix the code (or update the test with
   a documented justification) first.

---

## Non-Negotiable Constraints (summary — see AGENTS.md for detail)

- **Zero build step** — no Webpack, Vite, Rollup, or bundler.  CDN + ESM only.
- **AGPL-3.0 header** — every new/modified `.js` or `.html` file must carry it.
- **Preserve SVG a11y attributes** — never strip `<title>`, `<desc>`, `aria-*`,
  `role`, `viewBox`, or IDs referenced by `aria-labelledby`/`aria-describedby`.
- **SVGO edit-safety** — keep `collapseGroups` and `mergePaths` disabled;
  numeric precision at 3 decimal places.

When in doubt about a structural SVG change, quote the relevant clause from
[SVG_ACCESSIBILITY_BEST_PRACTICES.md](../SVG_ACCESSIBILITY_BEST_PRACTICES.md)
or [SVG_OPTIMIZATION_BEST_PRACTICES.md](../SVG_OPTIMIZATION_BEST_PRACTICES.md)
in the PR description.
