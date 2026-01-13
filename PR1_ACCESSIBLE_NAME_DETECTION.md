# PR #1: Improved Accessible Name Detection + Resources Block

## Summary
Adds sophisticated accessible name detection that avoids false positives, formalizes decorative/meaningful distinction, and adds resources section linking to authoritative accessibility guidance.

## Changes

### 1. Accessible Name Detection (False-Positive-Aware)

**New Lint Rule Logic:**

```javascript
// In lintSvg() function, add BEFORE color contrast checks:

// 1. Check for accessible name (only if meaningful)
if (intent !== 'decorative') {
    const ariaLabel = svgEl.getAttribute('aria-label');
    const ariaLabelledby = svgEl.getAttribute('aria-labelledby');
    const titleEl = svgEl.querySelector('title');
    const hasAriaLabel = ariaLabel && ariaLabel.trim().length > 0;
    const hasAriaLabelledby = ariaLabelledby && ariaLabelledby.trim().length > 0;
    const hasTitle = titleEl && titleEl.textContent && titleEl.textContent.trim().length > 0;
    
    // ERROR: No accessible name at all
    if (!hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
        issues.push({
            level: 'error',
            type: 'accessible-name',
            message: 'Meaningful SVG missing accessible name',
            detail: 'Add one of: aria-label on <svg>, aria-labelledby referencing <title> id, or <title> element',
            suggestion: 'Add a <title> element with descriptive text, or use aria-label attribute'
        });
    }
    // WARNING: Has title but no aria-labelledby (works but not ideal)
    else if (hasTitle && !hasAriaLabelledby && !hasAriaLabel) {
        issues.push({
            level: 'warning',
            type: 'accessible-name',
            message: 'SVG has <title> but no aria-labelledby',
            detail: 'Some screen readers may not announce <title> without aria-labelledby linking to its id',
            suggestion: 'Add id to <title> and reference it with aria-labelledby on <svg>'
        });
    }
    // INFO: All good!
    else if (hasAriaLabel || (hasAriaLabelledby && hasTitle)) {
        // Optionally add info-level confirmation
        // issues.push({ level: 'info', message: 'Accessible name present' });
    }
}
```

### 2. UI Changes

**Simplify Intent Selector:**

Current code has `decorative`, `informational`, `interactive`. 

**Change to:**
- **"Decorative"**: SVG conveys no information (aria-hidden, no title/desc)
- **"Meaningful"**: SVG conveys information (combines informational + interactive)

**Update in app.js sidebar:**

```javascript
// Replace current intent card with:
h('div', { class: 'sidebar-section intent-card' }, [
    h('span', { class: 'sidebar-label' }, 'Accessibility Intent'),
    h('div', { class: 'intent-toggle-group', role: 'radiogroup', 'aria-label': 'SVG accessibility intent' }, [
        h('label', { class: `intent-option${intent === 'decorative' ? ' selected' : ''}` }, [
            h('input', {
                type: 'radio',
                name: 'intent',
                value: 'decorative',
                checked: intent === 'decorative',
                onChange: (e) => {
                    if (e.target.checked) {
                        setIntent('decorative');
                        setMeta({ title: '', desc: '' });
                        metaIsDirtyRef.current = true;
                    }
                }
            }),
            h('span', {}, 'Decorative'),
            h('small', {}, 'No meaning, purely visual')
        ]),
        h('label', { class: `intent-option${intent !== 'decorative' ? ' selected' : ''}` }, [
            h('input', {
                type: 'radio',
                name: 'intent',
                value: 'meaningful',
                checked: intent !== 'decorative',
                onChange: (e) => {
                    if (e.target.checked) {
                        setIntent('informational'); // Keep 'informational' internally for now
                        metaIsDirtyRef.current = false;
                    }
                }
            }),
            h('span', {}, 'Meaningful'),
            h('small', {}, 'Conveys information or has function')
        ])
    ]),
    
    // Show title/desc fields ONLY when meaningful
    intent !== 'decorative' && h('div', { class: 'meta-fields', style: 'margin-top: 1rem;' }, [
        h('label', { class: 'meta-field' }, [
            h('span', {}, 'Title *'),
            h('input', {
                type: 'text',
                value: meta.title,
                placeholder: 'Short, unique title (1-3 words)',
                required: true,
                'aria-required': 'true',
                onInput: (e) => handleInlineMetaChange('title', e.target.value)
            })
        ]),
        h('label', { class: 'meta-field' }, [
            h('span', {}, 'Description'),
            h('textarea', {
                rows: 3,
                value: meta.desc,
                placeholder: 'Detailed description (5+ words)',
                onInput: (e) => handleInlineMetaChange('desc', e.target.value)
            })
        ]),
        
        // Helpful hints
        (!meta.title || looksLikeFilename(meta.title)) && 
            h('p', { class: 'meta-hint warning' }, '⚠ Title should be human-readable, not a filename'),
        
        meta.title && !meta.desc && 
            h('p', { class: 'meta-hint' }, 'ℹ️ Add a description for better accessibility'),
            
        meta.title && meta.desc && countWords(meta.desc) < 5 &&
            h('p', { class: 'meta-hint' }, 'ℹ️ Description should be 5+ words for clarity')
    ])
])
```

### 3. Resources Section

**Add to sidebar, after Finalize accordion:**

```javascript
// In app.js sidebar, add new accordion section:
h('div', { class: 'accordion', role: 'region', 'aria-expanded': accordionState.resources ? 'true' : 'false' }, [
    h('div', { class: 'accordion-header', onClick: (e) => {
        const next = { ...accordionState, resources: !accordionState.resources };
        setAccordionState(next);
        try { localStorage.setItem('accordionState', JSON.stringify(next)); } catch (err) {}
    } }, [
        h('span', {}, 'Resources'),
        h('span', { class: 'chev' }, '▸')
    ]),
    h('div', { class: 'accordion-content' }, [
        h('ul', { class: 'resources-list' }, [
            h('li', {}, [
                h('a', {
                    href: 'https://www.smashingmagazine.com/2021/05/accessible-svg-patterns-comparison/',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                }, 'Accessible SVG Patterns (Carie Fisher)')
            ]),
            h('li', {}, [
                h('a', {
                    href: 'https://www.deque.com/blog/creating-accessible-svgs/',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                }, 'Creating Accessible SVGs (Deque)')
            ]),
            h('li', {}, [
                h('a', {
                    href: 'https://polypane.app/blog/forced-colors-explained-a-practical-guide/',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                }, 'Forced Colors Guide (Polypane)')
            ]),
            h('li', {}, [
                h('a', {
                    href: 'https://www.w3.org/WAI/WCAG22/quickref/',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                }, 'WCAG 2.2 Quick Reference')
            ])
        ])
    ])
])
```

### 4. CSS Additions

**Add to styles.css:**

```css
/* Intent toggle styling */
.intent-toggle-group {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.intent-option {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    border: 2px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
}

.intent-option:hover {
    border-color: var(--primary);
    background: var(--bg-secondary);
}

.intent-option.selected {
    border-color: var(--primary);
    background: var(--primary-light, rgba(21, 101, 192, 0.1));
}

.intent-option input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.intent-option small {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

/* Resources list */
.resources-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.resources-list li {
    padding: 0;
}

.resources-list a {
    color: var(--primary);
    text-decoration: none;
    font-size: 0.9rem;
    display: block;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background 0.2s;
}

.resources-list a:hover,
.resources-list a:focus {
    background: var(--bg-secondary);
    text-decoration: underline;
}

/* Lint item type badges */
.lint-item[data-type="accessible-name"] {
    border-left: 4px solid var(--warning, #ff9800);
}

.lint-item[data-type="accessible-name"] .lint-message {
    font-weight: 500;
}
```

### 5. Update Lint Rendering

**Modify lint item rendering to show accessible-name issues prominently:**

```javascript
// In renderLintItem function, add data-type attribute:
return h('div', {
    key: `${keyPrefix}-${it.hex || it.message || 'lint'}`,
    class: 'lint-item',
    'data-type': it.type || 'general', // Add this
    role: 'listitem',
    tabIndex: 0,
    'aria-label': accessibleLabel,
    onKeyDown: handleLintKeyDown
}, [
    // ... existing content
]);
```

## Testing

### Manual Tests

1. **Decorative Toggle**:
   - Select "Decorative"
   - Verify no accessible name warnings appear
   - Verify title/desc fields hidden
   - Check optimized SVG has `aria-hidden="true"` and `role="presentation"`

2. **Meaningful - No Accessible Name**:
   - Select "Meaningful"
   - Remove title, aria-label, aria-labelledby
   - Verify **ERROR** level lint issue appears
   - Message should suggest adding title or aria-label

3. **Meaningful - Title Only (No aria-labelledby)**:
   - Select "Meaningful"
   - Add `<title>` but no aria-labelledby
   - Verify **WARNING** level lint issue appears
   - Message should suggest adding id and aria-labelledby

4. **Meaningful - Proper Accessible Name**:
   - Select "Meaningful"
   - Add title with id and aria-labelledby
   - OR add aria-label
   - Verify no accessible name errors/warnings

5. **Resources Section**:
   - Click "Resources" accordion
   - Verify 4 links render correctly
   - Click each link, verify opens in new tab
   - Check keyboard navigation works

### Regression Tests

- Verify existing color contrast checks still work
- Verify SVGO optimization still preserves accessibility attributes
- Verify light/dark preview still functions
- Check that title/desc changes sync properly

## Documentation Updates

### README.md

Add section:

```markdown
### Accessible Name Detection

The linter checks for proper accessible names on meaningful SVGs:

- **Error**: No accessible name found (no aria-label, aria-labelledby, or title)
- **Warning**: Has title but no aria-labelledby (may not be announced by all screen readers)
- **Pass**: Has aria-label OR aria-labelledby referencing title

**Best Practice**: Use `<title>` with a unique `id`, and reference it with `aria-labelledby` on the `<svg>` element.

**Avoiding False Positives**: If your SVG is decorative, select "Decorative" intent and these checks will be skipped.
```

### docs/ACCESSIBLE_NAME_DETECTION.md (new file)

Create comprehensive guide explaining:
- WCAG requirements for accessible names
- Why we check three different mechanisms
- When to use each approach
- How we avoid false positives with decorative toggle
- Examples of good and bad accessible names

## Notes on False Positive Avoidance

1. **Decorative toggle is explicit**: We don't guess intent, user declares it
2. **Three-tier severity**: Error → Warning → Info based on reliability
3. **Warning for title-only**: Acknowledges it *might* work but isn't guaranteed
4. **Clear actionable suggestions**: Each lint item tells user exactly what to add
5. **No nagging**: Once accessible name is present, no more warnings about it

## Files Changed

- `app.js` (~150 lines modified/added)
- `styles.css` (~80 lines added)
- `README.md` (~30 lines added)
- `docs/ACCESSIBLE_NAME_DETECTION.md` (new, ~200 lines)

## Dependencies

None - uses existing Preact and DOM APIs.

## Backward Compatibility

- Existing `intent` state values still work (decorative, informational, interactive)
- UI just groups informational+interactive as "Meaningful"
- No breaking changes to SVG output format
- SVGO config unchanged
