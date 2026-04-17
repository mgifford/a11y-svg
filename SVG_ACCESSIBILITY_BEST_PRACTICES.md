# SVG Accessibility Best Practices

This document defines accessibility practices for SVG files used on the web.

Accessibility testing tools generate false positives when rules are enforced without context. The practices below are focused on actual outcomes: perceptible meaning, operability, and compatibility with assistive technologies.

---

## 1. Accessible Name and Description

### Required when the SVG conveys meaning or function

An SVG should expose an accessible name if it:

- Conveys information that is not redundant with adjacent text
- Is used as a standalone graphic or icon
- Functions as a button, link, or control

Use one of these patterns:

#### Preferred pattern: `<title>` + `<desc>` referenced via `aria-labelledby`

```svg
<svg role="img" aria-labelledby="svgTitle svgDesc">
  <title id="svgTitle">No DRM</title>
  <desc id="svgDesc">An emblem indicating content without digital rights management.</desc>
</svg>
```

#### Acceptable simpler pattern when only a single label is needed

```svg
<svg role="img" aria-label="Download icon">
```

Avoid:

- Empty or generic names (noise for screen reader users)
- Duplicating visible text as the accessible name unless it adds meaning
- Using CSS `content:` to provide accessible names

---

## 2. Preserve IDs Used by Accessibility and References

Do not remove or rename IDs that are referenced by:

- `aria-labelledby`
- `aria-describedby`
- `<use href="#...">`
- CSS selectors (when the SVG relies on internal styling for interaction or states)
- URL references like `clip-path="url(#...)"`, `mask="url(#...)"`, `filter="url(#...)"`

If an ID is referenced, it must remain consistent and resolvable after optimization.

---

## 3. Role and Decorative Handling

### Meaningful SVGs

Use `role="img"` when the SVG represents a complete meaningful graphic.

### Decorative SVGs

If an SVG is purely decorative and already accompanied by accessible text, hide it from assistive technology:

```svg
<svg aria-hidden="true" focusable="false">
```

Avoid using `role="presentation"` unless you are intentionally suppressing semantics and the SVG is truly decorative.

---

## 4. Keyboard and Focus Behavior

Only required when the SVG itself is interactive.

If an SVG is used as an interactive control, it must be:

- Focusable (prefer a semantic `<button>`/`<a>` wrapper; otherwise `tabindex="0"`)
- Operable by keyboard (activation handled by the surrounding control)
- Provided with a visible focus indication (do not rely solely on UA defaults)

If the SVG is not interactive (purely an image), do not force focus behavior into it.

---

## 5. Forced-Colors (High Contrast) Support

SVGs must remain perceivable in forced-colors mode.

Requirements:

- Do not rely solely on subtle transparency, gradients, or filters to convey meaning
- Ensure the icon remains understandable in monochrome
- If internal styles are used, provide a forced-colors mapping when necessary

Example:

```css
@media (forced-colors: active) {
  .icon { stroke: CanvasText; fill: CanvasText; }
  .accent { stroke: Highlight; fill: Highlight; }
}
```

If the SVG is still clearly perceivable without a special forced-colors block, do not add one just to satisfy a checklist.

---

## 6. Contrast Requirements (Graphical Objects)

For non-text graphical elements that convey meaning (including focus indicators):

- Maintain at least 3:1 contrast against adjacent colors.

This is a perceptual outcome, not a “pattern check.” A tool warning is not proof of failure.

---

## 7. ViewBox and Scaling

Include `viewBox` whenever the SVG is intended to scale responsively.

Do not remove `viewBox` for optimization unless you have a verified reason and you have tested responsive rendering.

---

## 8. What Must Not Be Removed During Optimization

Do not remove the following if they contribute to meaning or behavior:

- `viewBox`
- `<title>` when it contributes to the accessible name
- `<desc>` when it contributes to the accessible description
- IDs referenced by accessibility attributes or URL references (`url(#...)`)
- Internal `<style>` that implements interaction states, reduced-motion handling, or forced-colors handling

---

## 9. What Is Not Required (Avoiding False Positives)

To avoid chasing false positives, these are not blanket requirements:

- A `<desc>` for every SVG (if the name already communicates what is needed)
- A separate `<title>` when `aria-label` is sufficient and stable
- Focus styling inside every SVG (only for interactive SVGs)
- A forced-colors media query block when the SVG remains perceivable without it
- Forcing `role="img"` on decorative SVGs (they should be hidden instead)

Accessibility must be measured against real usage context, not static rules alone.

---

## 10. Accessible Flowcharts

Flowcharts and decision trees present a unique accessibility challenge: their meaning
lies in the *connections between nodes*, not just the individual shapes. A single
`<title>` is rarely sufficient.

### Minimum requirements

All accessible flowcharts must have:

- `role="img"` on the `<svg>` element
- A `<title id="...">` with a short, meaningful name
- A `<desc id="...">` that describes the entire flow in plain text (start-to-end
  narrative including all decision branches)
- `aria-labelledby` on `<svg>` referencing both the `<title>` id and the `<desc>` id

```svg
<svg role="img" aria-labelledby="fc-title fc-desc" viewBox="0 0 400 300"
     xmlns="http://www.w3.org/2000/svg">
  <title id="fc-title">Accessibility Pattern Decision Tree</title>
  <desc id="fc-desc">
    Start: Does the SVG convey meaning? If No, apply aria-hidden="true" (Decorative).
    If Yes: Is it interactive? If No, use role="img" with title and desc (Informational).
    If Yes, add tabindex, keyboard handlers, and ARIA roles (Interactive).
  </desc>
  <!-- flowchart shapes … -->
</svg>
```

### HTML text alternative for complex flowcharts

When a flowchart has more than two or three decision branches, a `<desc>` alone is
insufficient. Provide an equivalent HTML structure (ordered list, nested list, or
table) adjacent to or linked from the SVG.

Recommended approaches (see
[Ashley Sheridan — Creating Accessible Flowcharts](https://www.ashleysheridan.co.uk/blog/Creating+Accessible+Flowcharts)):

1. **`<figure>` + `<figcaption>` wrapping the SVG** — the `<figcaption>` holds the
   text alternative and is always visible.
2. **`<details>` / `<summary>` toggle** — hides the text alternative by default but
   exposes it to all users on demand.
3. **`aria-details`** — links the SVG to a separate element containing the full
   HTML description:

```html
<figure>
  <svg aria-details="fc-details" role="img" aria-labelledby="fc-title" …>
    <title id="fc-title">SVG Accessibility Decision Tree</title>
    <!-- shapes … -->
  </svg>
  <details id="fc-details">
    <summary>Text description of the flowchart</summary>
    <ol>
      <li>Does the SVG convey meaning?
        <ul>
          <li>No → Apply <code>aria-hidden="true"</code> (Decorative pattern)</li>
          <li>Yes → Continue to next step</li>
        </ul>
      </li>
      <li>Is the SVG interactive?
        <ul>
          <li>No → Use <code>role="img"</code> with <code>&lt;title&gt;</code> and
              <code>&lt;desc&gt;</code> (Informational pattern)</li>
          <li>Yes → Add <code>tabindex</code>, keyboard handlers, and ARIA roles
              (Interactive pattern)</li>
        </ul>
      </li>
    </ol>
  </details>
</figure>
```

### What not to do

- Do not rely on color alone to distinguish flowchart paths (use labels and arrow text).
- Do not use `aria-hidden` on a flowchart that conveys meaning with no alternative.
- Do not embed a flowchart as a CSS background image — it becomes completely
  inaccessible.

---

## 11. Outcome-Based Testing

Automated checks are useful, but they are not the source of truth.

Validate SVG accessibility by:

- Testing with a screen reader (NVDA/JAWS/VoiceOver)
- Verifying keyboard navigation and focus visibility
- Checking forced-colors/high-contrast modes
- Ensuring reduced-motion users are respected when animation exists

---

## Summary

- Add semantics when the SVG is meaningful.
- Hide SVGs that are decorative.
- Preserve IDs and references.
- Use contrast and forced-colors support as outcome-driven requirements.
- Prefer real testing over checklist-driven noise.
