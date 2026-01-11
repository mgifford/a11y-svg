# SVG Optimization Best Practices

This document defines safe SVG optimization rules that DO NOT compromise accessibility.

Optimization must preserve meaning, structure, and behavior.

---

## 1. Optimization vs Beautification

### Beautification
Improves readability and maintainability.
Does not change behavior.

### Optimization
Reduces file size.
May affect structure or editability.

These must be treated separately.

---

## 2. Safe Optimizations (Default)

These MAY be applied by default:

- Remove comments
- Remove editor metadata
- Remove empty attributes
- Remove unused namespaces
- Sort attributes
- Sort `<defs>` children
- Remove XML processing instructions
- Conservative numeric rounding (2–3 decimals)

---

## 3. Conditional Optimizations (Opt-in)

These MAY be applied only in a “production” profile:

- Collapse groups
- Merge paths
- Convert transforms
- Convert shapes to paths
- Reuse paths via `<defs>/<use>`

Only apply when:
- SVG will not be further edited
- IDs and references are preserved
- Visual output is verified

---

## 4. Optimizations That Must Be Disabled

These MUST NOT be enabled in accessibility-safe workflows:

- Remove `<title>`
- Remove `<desc>`
- Remove `viewBox`
- Clean up IDs
- Remove `<style>`
- Remove referenced `<defs>`
- Remove hidden elements without manual review

---

## 5. Numeric Precision Guidelines

- Round where it does not affect alignment
- Preserve precision in:
  - `viewBox`
  - transform matrices
  - path `d` values that affect alignment

---

## 6. Dimensions and Responsiveness

Best practice for reusable SVGs:
- Keep `viewBox`
- Remove `width` and `height`
- Let layout define size

Only preserve dimensions when required for layout stability.

---

## 7. Verification Checklist

After optimization:
- Accessible name still announced
- Focus styles still visible
- Forced-colors mode still usable
- Light/dark mode still works
- IDs still resolve correctly
- Visual output unchanged

If any fail, rollback the optimization.

---

## 8. Optimization Is Not Neutral

Every optimization is a tradeoff.

Accessibility-preserving optimization favors:
- Stability
- Predictability
- Explicit structure

Small file size gains are never worth breaking meaning.
