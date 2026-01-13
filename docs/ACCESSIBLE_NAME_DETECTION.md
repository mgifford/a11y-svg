# Accessible Name Detection

## Overview

A11y-SVG-Studio implements sophisticated accessible name detection that follows WCAG 2.2 requirements while avoiding false positives. This guide explains how the detection works, when to use each approach, and how we prevent unnecessary warnings.

## WCAG Requirements

According to WCAG 2.2 Success Criterion 1.1.1 (Non-text Content), all non-text content that is presented to the user must have a text alternative that serves the equivalent purpose, **except** when the content is purely decorative.

For SVGs, this means:
- **Meaningful SVGs** must have an accessible name
- **Decorative SVGs** should be hidden from assistive technology

## Three Mechanisms for Accessible Names

The linter checks three different ways to provide an accessible name, in order of reliability:

### 1. `aria-label` on `<svg>` (Most Direct)

```xml
<svg aria-label="Company logo" xmlns="http://www.w3.org/2000/svg">
  <!-- SVG content -->
</svg>
```

**Pros:**
- Universally supported by all screen readers
- Simple and direct
- No need for additional IDs

**Cons:**
- Content is embedded in attribute (harder to maintain)
- Cannot include rich text or multiple paragraphs

**When to use:** Short, simple descriptions (1-10 words)

### 2. `aria-labelledby` Referencing `<title>` (Best Practice)

```xml
<svg aria-labelledby="svg-title svg-desc" role="img" xmlns="http://www.w3.org/2000/svg">
  <title id="svg-title">Company Logo</title>
  <desc id="svg-desc">A circular logo with a blue background and white text</desc>
  <!-- SVG content -->
</svg>
```

**Pros:**
- Explicit linking ensures screen readers announce the content
- Supports multiple elements (title + description)
- Content is easier to maintain
- Works in all modern browsers

**Cons:**
- Requires unique IDs (collision risk in complex pages)
- More verbose

**When to use:** Most cases, especially when you need both a short title and longer description

### 3. `<title>` Without `aria-labelledby` (Suboptimal)

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <title>Company Logo</title>
  <!-- SVG content -->
</svg>
```

**Pros:**
- Simple HTML structure
- May work in some screen readers

**Cons:**
- **Inconsistent support** - some screen readers ignore `<title>` without explicit linking
- Not guaranteed to be announced
- SVG spec doesn't require screen readers to treat `<title>` as accessible name

**When to use:** Only as a fallback - the linter will show a **warning** for this pattern

## Detection Logic

The linter uses a three-tier severity system:

### ❌ Error: No Accessible Name

**Trigger:** SVG is marked "Meaningful" AND has no:
- `aria-label` on `<svg>`
- `aria-labelledby` on `<svg>`
- `<title>` element

**Message:** "Meaningful SVG missing accessible name"

**Fix:** Add one of the three mechanisms above

### ⚠️ Warning: Title Without Linking

**Trigger:** SVG has `<title>` but no `aria-labelledby` and no `aria-label`

**Message:** "SVG has `<title>` but no aria-labelledby"

**Explanation:** While this *might* work in some screen readers, it's not guaranteed. The best practice is to add an `id` to the `<title>` and reference it with `aria-labelledby`.

**Fix:** 
```xml
<!-- Before -->
<svg>
  <title>Logo</title>
</svg>

<!-- After -->
<svg aria-labelledby="title-logo" role="img">
  <title id="title-logo">Logo</title>
</svg>
```

### ✅ Pass: Proper Accessible Name

**Trigger:** SVG has either:
- `aria-label` with non-empty value, OR
- `aria-labelledby` referencing elements that exist

**No warning shown** - accessible name is properly configured.

## Avoiding False Positives

### Decorative Intent Toggle

The most important false-positive prevention mechanism is the **Decorative/Meaningful toggle**:

- **Decorative**: All accessible name checks are **skipped**
  - Use for: Purely decorative graphics, icons next to text labels, background patterns
  - Result: SVG gets `aria-hidden="true"` and `role="presentation"`
  
- **Meaningful**: Accessible name checks are **enabled**
  - Use for: Logos, infographics, data visualizations, standalone icons
  - Result: SVG gets `role="img"` and must have accessible name

**This is an explicit user choice** - the linter never guesses intent.

### Why This Matters

Many automated accessibility checkers produce false positives by:
1. Flagging ALL SVGs without accessible names (ignoring decorative use cases)
2. Not distinguishing between different accessible name mechanisms
3. Failing SVGs that have `<title>` but no `aria-labelledby` (even though it might work)

A11y-SVG-Studio avoids these issues by:
- **Requiring explicit decorative/meaningful choice** (no guessing)
- **Using graded severity** (error vs warning vs pass)
- **Providing actionable suggestions** (exactly what to add/fix)

## Real-World Examples

### Example 1: Logo (Meaningful)

```xml
<svg aria-labelledby="logo-title" role="img" xmlns="http://www.w3.org/2000/svg">
  <title id="logo-title">Acme Corporation</title>
  <circle cx="50" cy="50" r="40" fill="blue"/>
  <text x="50" y="55" text-anchor="middle" fill="white">ACME</text>
</svg>
```

**Lint Result:** ✅ Pass (has aria-labelledby + title)

### Example 2: Decorative Icon Next to Text

```xml
<button>
  <svg aria-hidden="true" role="presentation">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
  Home
</button>
```

**Intent:** Decorative  
**Lint Result:** ✅ Pass (decorative intent, no check needed)  
**Note:** Button has visible text "Home", so SVG is redundant for screen readers

### Example 3: Standalone Icon (Meaningful)

```xml
<button aria-label="Close dialog">
  <svg aria-labelledby="close-icon-title" role="img">
    <title id="close-icon-title">Close</title>
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
</button>
```

**Intent:** Meaningful  
**Lint Result:** ✅ Pass (has aria-labelledby + title)  
**Note:** Button also has aria-label for redundancy

### Example 4: Warning Case - Title Only

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <title>Settings Gear</title>
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10..."/>
</svg>
```

**Intent:** Meaningful  
**Lint Result:** ⚠️ Warning (has title but no aria-labelledby)  
**Recommendation:** Add `id` to `<title>` and add `aria-labelledby` to `<svg>`

## Integration with Other Checks

Accessible name detection is the **first** check in the linting pipeline:

1. ✅ **Accessible Name** (this check)
2. Title/Description field validation
3. Color contrast checks
4. Motion detection (future)
5. Forced colors compliance (future)

By checking accessible names first, we ensure that:
- Decorative SVGs skip all subsequent semantic checks
- Meaningful SVGs get comprehensive accessibility validation
- Users get clear, prioritized feedback (fix accessible name before worrying about contrast)

## Testing Your SVG

To test accessible name detection:

1. **Open A11y-SVG-Studio**
2. **Load your SVG** (paste, drag, or use sample)
3. **Choose intent**:
   - Select "Decorative" if SVG is purely visual
   - Select "Meaningful" if SVG conveys information
4. **Check lint panel**:
   - ❌ Red error = no accessible name
   - ⚠️ Orange warning = suboptimal accessible name
   - ✅ No warning = properly configured

## Common Questions

### Q: Why does the linter warn about `<title>` without `aria-labelledby`?

**A:** While `<title>` alone *might* work in some screen readers, the SVG Accessibility API Mapping spec doesn't guarantee it. `aria-labelledby` provides explicit, reliable linking.

### Q: Should I add both `aria-label` and `<title>`?

**A:** No - use one or the other. If you use `aria-label`, `<title>` is ignored. If you use `aria-labelledby`, it overrides `aria-label`.

### Q: When should I mark an icon as decorative?

**A:** If the icon is next to visible text that conveys the same meaning (e.g., a trash icon next to "Delete" text), mark it decorative. If the icon stands alone or adds information not in the text, mark it meaningful.

### Q: Can I use `<desc>` without `<title>`?

**A:** No - the linter will show an error. Screen readers expect `<title>` as the primary accessible name, with `<desc>` providing additional context.

## References

- [WCAG 2.2 Success Criterion 1.1.1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html)
- [SVG Accessibility API Mappings](https://www.w3.org/TR/svg-aam-1.0/)
- [Carie Fisher: Accessible SVG Patterns](https://www.smashingmagazine.com/2021/05/accessible-svg-patterns-comparison/)
- [Deque: Creating Accessible SVGs](https://www.deque.com/blog/creating-accessible-svgs/)
- [MDN: aria-labelledby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-labelledby)

## Changelog

- **2026-01-12**: Initial implementation with three-tier severity system and decorative/meaningful toggle
