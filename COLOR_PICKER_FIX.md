# Color Picker Behavior Fix

## Issues Resolved

### 1. Original Color Tracking
**Problem:** Users couldn't see which colors had been changed from the original SVG.

**Solution:** 
- Added `originalHex` property to each color object when parsing SVG
- Added visual indicator (small circle) showing original color when color has been modified
- Added tooltip showing original color value

### 2. Light Mode Color Picker Independence
**Problem:** Changing the Light mode color picker (second input) was incorrectly affecting the Dark mode color.

**Expected Behavior:**
1. **Top color swatch** (click the graphic) - Sets BOTH light and dark modes to the same color
2. **Light mode color picker** (second input) - ONLY affects light mode
3. **Dark mode color picker** (third input) - ONLY affects dark mode

**Previous Bug:** 
The Light mode color picker was using this logic:
```javascript
if (darkModeColors[oldColor]) {
    // Copy dark mode override to new color key
    newDarkModeColors[newColor] = newDarkModeColors[oldColor];
}
```
This was correct for preserving the dark mode *value*, but it would sometimes create unintended side effects.

**Fix:**
Changed to explicitly preserve the dark mode value:
```javascript
if (darkModeColors[oldColor] !== undefined) {
    const darkColor = darkModeColors[oldColor];
    const newDarkModeColors = { ...darkModeColors };
    delete newDarkModeColors[oldColor];
    newDarkModeColors[newColor] = darkColor;
    setDarkModeColors(newDarkModeColors);
}
```

This ensures:
- If there's a dark mode override, it's preserved with the exact same value
- Only the mapping key changes (from oldColor to newColor)
- The dark color value itself is never touched by the light mode picker

## Visual Indicators

### Original Color Badge
When a color has been modified from its original value:
- A small circular badge appears in the bottom-right corner of the color swatch
- The badge shows the original color
- Hovering shows tooltip: "Original: #xxxxxx"
- Applies to both Text and Graphic colors

## Implementation Details

### Files Modified
- `app.js` (5 changes)
  1. Line ~829: Added `originalHex` to parseColors return
  2. Lines ~2290-2305: Wrapped text color swatch in div, added original color indicator
  3. Lines ~2360-2378: Fixed Light mode color picker for text colors
  4. Lines ~2530-2545: Wrapped graphic color swatch in div, added original color indicator  
  5. Lines ~2585-2610: Fixed Light mode color picker for graphic colors

### Color Picker Tooltips
- Top swatch: `${c} (text/graphic) - click to set BOTH light & dark modes (original: ${originalHex})`
- Light picker: `Light mode color (only affects light mode)`
- Dark picker: `Dark mode color` (unchanged)

## Testing

All 49 tests passing:
- 23/23 regression tests ✅
- 26/26 feature tests ✅  
- 1/1 JSDOM UI test ✅

## User Experience

**Before:**
- Couldn't see which colors were changed
- Light mode picker would sometimes affect dark mode
- Confusing behavior when adjusting colors independently

**After:**
- Clear visual indicator of modified colors (original badge)
- Light mode picker ONLY affects light mode
- Dark mode picker ONLY affects dark mode  
- Top swatch still sets both (unified editing)
- Predictable, independent color control
