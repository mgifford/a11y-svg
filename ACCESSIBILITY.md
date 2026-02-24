# Accessibility Commitment

> **A11y-SVG-Studio is built with accessibility at its core.**  
> This document defines our commitment to WCAG 2.2 AA standards and documents how accessibility is embedded throughout the project.

## 1. Our Commitment

We believe **accessibility is a subset of quality**. A11y-SVG-Studio is designed to create accessible SVG assets while itself being fully accessible. This project commits to:

- **WCAG 2.2 AA** conformance for the application UI
- **WCAG 2.2 AA** output for all SVG optimizations
- **Zero build step** philosophy that preserves accessibility
- **Keyboard navigation** and screen reader compatibility
- **Theme awareness** with light/dark mode support
- **Real-time contrast checking** against WCAG standards

## 2. Current Status & Health Metrics

| Metric | Status / Value |
| :--- | :--- |
| **WCAG Level** | 2.2 AA (Target & Maintained) |
| **Test Suite** | ✅ 35/35 tests passing (23 regression, 12 features) |
| **Automated Testing** | axe-core (WCAG 2.2 AA), Pa11y (WCAG 2.0 AA) |
| **Test Coverage** | `npm test` + `npm run qa` required before merge |
| **Known Issues** | [View open accessibility issues](https://github.com/mgifford/a11y-svg/issues?q=is%3Aissue+is%3Aopen+label%3Aaccessibility) |
| **CI/CD Enforcement** | ✅ Strict (PRs fail if tests don't pass) |

## 3. Technical Architecture for Accessibility

### Zero Build Step Philosophy
- Pure ES Modules (ESM) loaded via CDN
- No npm install required for end users
- Runs directly in the browser on GitHub Pages
- Maintains compatibility without compilation barriers

### Keyboard Navigation
- Full keyboard operability via semantic HTML5
- High-contrast focus indicators
- ARIA live regions for dynamic status updates
- No keyboard traps

### Screen Reader Support
- Semantic HTML structure (`<main>`, `<section>`, `<button>`, etc.)
- ARIA labels and live regions
- Descriptive text for all controls
- Accessible name detection for SVGs with detailed feedback

### Visual Accessibility
- Theme awareness with automatic light/dark mode
- Real-time WCAG 2.2 contrast ratio calculation
- Support for `currentColor` and CSS media queries in SVG output
- Forced-colors mode compatibility

## 4. SVG Accessibility Standards

This project follows comprehensive SVG accessibility guidelines defined in our normative documentation:

### Primary References
- **[SVG_ACCESSIBILITY_BEST_PRACTICES.md](SVG_ACCESSIBILITY_BEST_PRACTICES.md)** — Normative specification for authoring accessible SVGs
  - Accessible naming patterns (`<title>`, `<desc>`, `aria-labelledby`)
  - Role and decorative handling
  - Keyboard and focus behavior
  - Forced-colors (high contrast) support
  - Contrast requirements for graphical objects
  - Outcome-based testing approach

- **[SVG_OPTIMIZATION_BEST_PRACTICES.md](SVG_OPTIMIZATION_BEST_PRACTICES.md)** — Edit-safe SVGO rules
  - Preservation of accessibility metadata
  - ID and reference integrity
  - ViewBox and namespace handling
  - Verification checklist for post-optimization

### Key Principles
1. **Preservation-First Optimization**: Never strip accessibility attributes (`<title>`, `<desc>`, `aria-*`, `role`, `viewBox`, IDs)
2. **Intent-Based Handling**: Support decorative, informational, and interactive SVG patterns
3. **Unique ID Generation**: Automatic collision-resistant IDs for ARIA linkage
4. **Context-Aware Validation**: False-positive-aware linting that respects decorative intent

### Carie Fisher Patterns
We implement [Carie Fisher's Accessible SVG patterns](https://www.smashingmagazine.com/2021/05/accessible-svg-patterns-comparison/):
- **Decorative**: `aria-hidden="true"` / `role="presentation"`
- **Meaningful**: Proper accessible names via `<title>` + `aria-labelledby`
- **Interactive**: Focus management and keyboard operability

## 5. Testing & Quality Assurance

### Required Testing Before Merge
All changes must pass the comprehensive test and QA suite:

```bash
npm test      # Run full 35-test suite (required)
npm run qa    # Run linting + accessibility audit (required)
```

### Test Suite Structure
- **`tests/regression.test.js`** (23 tests) — Prevents known bugs
- **`tests/features.test.js`** (12 tests) — Validates workflows
- **`tests/ui.test.js`** — DOM structure validation
- **`tests/check-syntax.js`** — Quick diagnostic utility

See [tests/README.md](tests/README.md) for comprehensive test documentation.

### QA Scripts
- `npm run test:regression` — Quick smoke test for known issues
- `npm run test:features` — Feature integration validation
- `npm run test:jsdom` — Contrast calculation validation
- `npm run svgo` — Optimize SVGs preserving accessibility
- `npm run svg:lint` — Structural SVG validation
- `npm run axe` — WCAG 2.2 AA automated testing
- `npm run pa11y` — WCAG 2.0 AA accessibility audit

### Automated Coverage
Our automated testing covers:
- Semantic HTML structure
- ARIA attributes and roles
- Color contrast ratios (WCAG and APCA)
- Keyboard navigation
- Focus management
- SVG accessible name detection
- Dark mode preservation
- Hook scoping and function boundaries
- Preview rendering and event flow

## 6. Contributor Guidelines

### Definition of Done for Accessibility
All contributions must:
1. ✅ Pass `npm test` (35/35 tests)
2. ✅ Pass `npm run qa` (linting + accessibility)
3. ✅ Maintain AGPL-3.0 license headers
4. ✅ Preserve zero-build philosophy
5. ✅ Follow existing accessibility patterns
6. ✅ Include accessibility metadata in SVG output

### Coding Standards for A11y
- Use semantic HTML5 elements
- Include ARIA labels for dynamic content
- Add ARIA live regions for status changes
- Comment complex contrast calculations with WCAG references
- Test with keyboard navigation
- Test with screen reader (NVDA/JAWS/VoiceOver recommended)
- Verify in forced-colors mode

### AI Agent Instructions
This project includes comprehensive instructions for AI agents in [AGENTS.md](AGENTS.md). All AI-assisted development must:
- Follow the normative accessibility specifications
- Preserve metadata required by WCAG 2.2 AA
- Run test suite after changes
- Never introduce build step requirements
- Maintain accessibility-first principles

## 7. Reporting Accessibility Issues

### How to Report
Please report accessibility barriers through:
- **GitHub Issues**: [Create an accessibility issue](https://github.com/mgifford/a11y-svg/issues/new?labels=accessibility)
- **Include**:
  - Description of the barrier
  - Steps to reproduce
  - Assistive technology used (if applicable)
  - Browser and OS information
  - Expected behavior

### Severity Classification
We prioritize accessibility issues using:
- **Critical**: Prevents completing core functionality (e.g., cannot paste SVG, cannot copy output)
- **High**: Significant barrier but workaround exists
- **Medium**: Reduced experience or inconsistency
- **Low**: Minor enhancement or polish

### Response Commitment
- Critical issues: Addressed within 7 days
- High priority: Addressed within 30 days
- Medium/Low: Addressed based on roadmap priority

## 8. Assistive Technology Testing

### Actively Tested With
- **Screen Readers**: NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS)
- **Browsers**: Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Keyboard Navigation**: Full testing without mouse
- **Zoom**: Testing up to 200% zoom
- **High Contrast Mode**: Windows High Contrast and forced-colors mode

### Known Compatibility
- ✅ Keyboard-only navigation fully supported
- ✅ Screen reader announcements for all controls
- ✅ High contrast mode compatibility
- ✅ Text zoom up to 200%
- ✅ Light and dark theme support

## 9. Trusted Sources & References

This project relies on vetted accessibility resources. For a comprehensive machine-readable list of trusted sources, see:

**[Trusted Sources Registry](https://github.com/mgifford/ACCESSIBILITY.md/blob/main/examples/TRUSTED_SOURCES.yaml)**

### Key References Used
- **W3C Web Accessibility Initiative (WAI)**
  - [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
  - [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
  - [SVG Accessibility Features](https://www.w3.org/TR/SVG2/access.html)

- **Accessibility Experts**
  - [Carie Fisher - Accessible SVG Patterns](https://www.smashingmagazine.com/2021/05/accessible-svg-patterns-comparison/)
  - [Deque - Creating Accessible SVGs](https://www.deque.com/blog/creating-accessible-svgs/)
  - [Sara Soueidan - Accessible SVG Blog Posts](https://www.sarasoueidan.com/blog/)

- **Testing Tools**
  - [axe DevTools](https://www.deque.com/axe/devtools/)
  - [Pa11y](https://pa11y.org/)
  - [WAVE Web Accessibility Evaluation Tool](https://wave.webaim.org/)

- **Standards & Specifications**
  - [SVGO Documentation](https://github.com/svg/svgo)
  - [APCA Contrast Algorithm](https://github.com/Myndex/SAPC-APCA)
  - [Polypane Forced Colors Guide](https://polypane.app/blog/forced-colors-explained-a-practical-guide/)

### Structured Standards Data
- **[wai-yaml-ld](https://github.com/mgifford/wai-yaml-ld)** — Machine-readable WCAG/ARIA/ATAG standards
- **[CivicActions Open Requirements Library](https://github.com/CivicActions/open-practice/blob/main/open-requirements-library/accessibility.md)** — Section 508 procurement requirements

## 10. Continuous Improvement

### Our Approach
- **Test-Driven Development**: All changes validated by comprehensive test suite
- **Outcome-Based Testing**: Real user testing with assistive technology
- **Public Transparency**: Accessibility status tracked in open GitHub issues
- **Community Input**: Welcoming feedback from accessibility community

### Future Enhancements
- Expand automated testing coverage
- Add more SVG accessibility patterns
- Enhance contrast checking algorithms
- Improve screen reader announcements for complex interactions
- Additional assistive technology testing

### Stay Connected
- [GitHub Repository](https://github.com/mgifford/a11y-svg)
- [Live Demo](https://mgifford.github.io/a11y-svg/)
- [Issue Tracker](https://github.com/mgifford/a11y-svg/issues)
- [Discussions](https://github.com/mgifford/a11y-svg/discussions)

---

## License
This document is part of A11y-SVG-Studio, licensed under the **GNU Affero General Public License v3.0** ([AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt)).

---

**Last Updated**: February 2026  
**Maintained By**: Mike Gifford and contributors
