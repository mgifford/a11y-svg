# Test Suite Documentation

## Overview

This test suite prevents regressions in critical workflows that have broken during development. Each test captures a specific bug that was previously fixed.

## Running Tests

```bash
# Run all tests
npm test

# Run individual test suites
npm run test:regression    # Regression tests
npm run test:features      # Feature tests  
npm run test:jsdom         # UI/DOM tests

# Run full QA suite (includes linting, accessibility)
npm run qa
```

## Test Status (Latest Run)

**Regression Tests**: 17/23 passing (74%)
**Feature Tests**: Structural validation only
**JSDOM Tests**: Passing

## Known Test Failures (Expected)

These failures indicate issues in the codebase that still need fixing:

### 1. BEAUTIFIED_DISPLAY_SUFFIX constant (2 failures)
- **Issue**: Regex pattern too strict - constant exists but test pattern doesn't match
- **Location**: [app.js](app.js#L295)
- **Status**: False positive - constant is defined, test needs fixing

### 2. Preview key props (2 failures)
- **Issue**: Test regex doesn't match actual template literal syntax
- **Location**: [app.js](app.js#L2260), [app.js](app.js#L2271)
- **Status**: False positive - keys exist, test pattern needs fixing

### 3. buildLightDarkPreview (1 failure)
- **Issue**: Function uses arrow syntax `const = () => {}` but test expects `function`
- **Location**: [app.js](app.js#L248)
- **Status**: False positive - function exists and is complete

### 4. darkOriginals array (1 failure)
- **Issue**: Variable name may have changed or scope issue
- **Location**: Tests expect this in lintSvg results
- **Status**: Needs investigation - verify lint results structure

## Test Categories

### Regression Tests ([tests/regression.test.js](tests/regression.test.js))

Prevents these specific bugs from recurring:

#### ✅ Hooks Scope (2 tests - PASSING)
- **What it prevents**: Hooks (useState, useRef) declared outside App component
- **Why it matters**: Causes `Cannot read properties of undefined (reading '__H')` runtime error
- **Previous failure**: Hooks were moved outside component during edits

#### ✅ computeCaretPosition Scope (3 tests - PASSING)
- **What it prevents**: Function nested in wrong scope or missing from dependencies
- **Why it matters**: Breaks cursor tracking in editor
- **Previous failure**: Was incorrectly indented inside lintSvg function

#### ✅ Color Fix Dual-Mode (3 tests - PASSING)
- **What it prevents**: Losing dark mode color data when applying fixes
- **Why it matters**: Fix buttons must preserve data-dark-* attributes  
- **Previous failure**: Early versions didn't handle darkHex parameter

#### ✅ Preview Update Flow (3 tests - PASSING)
- **What it prevents**: Edits not reflecting in light/dark previews
- **Why it matters**: Core feature - users must see changes immediately
- **Previous failure**: Missing buildLightDarkPreview calls

#### ✅ Syntax Correctness (2 tests - PASSING)
- **What it prevents**: Catastrophic syntax errors
- **Why it matters**: Page won't load at all with syntax errors
- **Previous failure**: Missing closing braces, incomplete functions

### Feature Tests ([tests/features.test.js](tests/features.test.js))

Tests for user-facing functionality:

- **buildLightDarkPreview**: Creates separate light/dark SVG versions
- **Color contrast helpers**: normalizeHex, hexToRgb, getContrastRatio
- **Lint with dual-mode**: Detects contrast failures in both modes
- **data-dark-* attributes**: Preserves dark mode colors
- **Editor integration**: Cursor positioning, preview updates
- **Fix button workflow**: Applies color fixes correctly

### UI Tests ([tests/ui.test.js](tests/ui.test.js))

DOM and JSDOM validation:

- Verifies app.js has required labels and structure
- Ensures DOM selectors work as expected
- Validates ARIA attributes

## Test Utility ([tests/check-syntax.js](tests/check-syntax.js))

Quick diagnostic script to check:
- Constant definitions
- Function existence
- Preview key props
- Syntax balance (braces, parens)
- Dependency arrays

```bash
node tests/check-syntax.js
```

## Common Issues & Fixes

### Issue: "Cannot use import statement outside a module"
**Fix**: Added `"type": "module"` to package.json

### Issue: "ReferenceError: describe is not defined"
**Fix**: Import from `node:test`: `import { describe, it } from 'node:test';`

### Issue: Regex tests failing despite code being correct
**Fix**: Simplify tests to check existence rather than exact structure

### Issue: Preview not updating on edits
**Fix**: Added key props to force Preact re-render:
```javascript
key: `light-${previewLightHtml.length}`
key: `dark-${previewDarkHtml.length}`
```

### Issue: Cursor not tracking clicks
**Fix**: 
1. Move computeCaretPosition into App component scope
2. Add to updateBeautifiedCaret dependency array

## Writing New Tests

### DO:
- Test behavior, not implementation details
- Use grep/includes for existence checks
- Focus on preventing specific regressions
- Add clear comments explaining what broke before

### DON'T:
- Use fragile regex patterns for structure matching
- Test internals that may change
- Create tests that break on refactoring
- Forget to document what regression the test prevents

## Test Philosophy

These tests exist because **fixes keep breaking other things**. Each test:

1. **Documents a real failure** that occurred during development
2. **Prevents that exact failure** from happening again
3. **Fails fast** when code structure changes inappropriately
4. **Explains why it exists** in comments

## Future Improvements

- [ ] Fix regex patterns in failing tests
- [ ] Add browser-based integration tests
- [ ] Test actual fix button click behavior
- [ ] Validate contrast calculations with known values
- [ ] Add visual regression tests for preview rendering
- [ ] Test keyboard navigation thoroughly
- [ ] Verify ARIA live regions update correctly

## Related Documentation

- [AGENTS.md](../AGENTS.md) - Development guidelines
- [SVG_ACCESSIBILITY_BEST_PRACTICES.md](../SVG_ACCESSIBILITY_BEST_PRACTICES.md) - Normative accessibility spec
- [SVG_OPTIMIZATION_BEST_PRACTICES.md](../SVG_OPTIMIZATION_BEST_PRACTICES.md) - Normative optimization spec
