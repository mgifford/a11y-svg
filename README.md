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
   git clone https://github.com/yourusername/a11y-svg.git
   cd a11y-svg
   ```

2. Open `index.html` in your browser or serve via GitHub Pages

No build process required! All dependencies are loaded via CDN.

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

## 🛠️ Technical Stack

- **Framework**: Vanilla JS / Preact (via ESM)
- **Optimization**: SVGO (browser-compatible via esm.sh)
- **Styling**: CSS with custom properties
- **Hosting**: GitHub Pages ready

## 📝 License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](LICENSE) for full details.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All code maintains AGPL-3.0 license headers
- Zero build step requirement is preserved
- Accessibility standards (WCAG 2.2 AA) are met
- SVG standards compliance

## 📚 Resources

- [Accessible SVG Patterns](https://www.smashingmagazine.com/2021/05/accessible-svg-patterns-comparison/) by Carie Fisher
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [SVGO Documentation](https://github.com/svg/svgo)

## 🔗 Links

- [Live Demo](https://yourusername.github.io/a11y-svg/)
- [Report Issues](https://github.com/yourusername/a11y-svg/issues)
- [Discussions](https://github.com/yourusername/a11y-svg/discussions)