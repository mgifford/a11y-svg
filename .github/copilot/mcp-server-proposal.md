# Issue Proposal: MCP Server for WCAG Contrast & Accessible-Name Validation

<!--
  This document captures the design for Issue #3 of the "Getting started with
  agents" improvement set.  Once the MCP server is implemented it should be
  registered in .github/copilot/mcp.yml (see the references below).

  References:
  - Extending Copilot with MCP: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agent-with-mcp
  - Getting started with agents: https://accessibility.github.com/documentation/guide/getting-started-with-agents/
  - Project contrast logic: ../../app.js  (getRelativeLuminance, getContrastRatio, getWCAGLevel)
  - Accessible-name detection: ../../docs/ACCESSIBLE_NAME_DETECTION.md
-->

## Summary

Expose the project's existing WCAG 2.2 / APCA contrast calculations and
accessible-name detection logic as a **Model Context Protocol (MCP) server**
so that GitHub Copilot Coding Agent can validate its SVG changes in real-time
during task completion—before opening a pull request.

## Motivation

When Copilot coding agent works on issues such as #7 (independent light/dark
colors) or #1 (incorrect title/description formatting), it currently has no
programmatic way to verify that the SVG it produces meets WCAG 2.2 AA contrast
thresholds or has a valid accessible name.  The project already contains the
necessary calculation logic in `app.js` (`getRelativeLuminance`,
`getContrastRatio`, `getWCAGLevel`, `detectAccessibleName`); wrapping it as MCP
tools makes that logic available to the agent itself.

## Proposed MCP Tools

### 1. `check_contrast`

| Parameter | Type | Description |
|-----------|------|-------------|
| `foreground` | `string` | Hex color of the foreground element (`fill` / `stroke`) |
| `background` | `string` | Hex color of the background |
| `isText` | `boolean` | `true` → apply APCA threshold; `false` → WCAG 2.2 AA non-text (3:1) |

Returns:

```json
{
  "ratio": 4.71,
  "wcagLevel": "AA",
  "passes": true,
  "recommendation": null
}
```

### 2. `detect_accessible_name`

| Parameter | Type | Description |
|-----------|------|-------------|
| `svgString` | `string` | Raw SVG markup to inspect |

Returns:

```json
{
  "hasTitle": true,
  "hasDesc": false,
  "ariaLabelledby": "icon-title",
  "role": "img",
  "issues": [],
  "pattern": "informational"
}
```

### 3. `lint_svg_accessibility`

| Parameter | Type | Description |
|-----------|------|-------------|
| `svgString` | `string` | Raw SVG markup |
| `intent` | `"decorative" \| "informational" \| "interactive"` | Intended usage pattern |

Returns a structured list of WCAG violations and suggested fixes, following
the same rules as `npm run svg:lint`.

## Implementation Path

1. Extract the pure-function contrast and accessible-name helpers from
   `app.js` into a new `lib/a11y-validators.js` module (no browser APIs, so
   it can run in Node.js).
2. Create `mcp-server/index.js` — a lightweight MCP server (using the
   `@modelcontextprotocol/sdk` package) that registers the three tools above.
3. Add a startup script to `package.json`:
   ```json
   "mcp": "node mcp-server/index.js"
   ```
4. Register the server in `.github/copilot/mcp.yml`:
   ```yaml
   servers:
     a11y-svg-validator:
       command: node
       args: [mcp-server/index.js]
       description: >
         WCAG 2.2 contrast checker, APCA text validator, and accessible-name
         linter for SVG assets produced by A11y-SVG-Studio.
   ```

## Acceptance Criteria

- [ ] `lib/a11y-validators.js` exports `checkContrast`, `detectAccessibleName`,
      and `lintSvgAccessibility` as pure functions with no browser-only APIs.
- [ ] `mcp-server/index.js` registers all three tools and passes a smoke-test
      (`node mcp-server/index.js --test`).
- [ ] `.github/copilot/mcp.yml` registers the server so Copilot coding agent
      can call the tools automatically.
- [ ] Existing `tests/contrast.test.js` continues to pass (the extracted
      helpers must be identical to the inline ones in `app.js`).
- [ ] `npm test` (35/35) still passes after the refactor.

## References

- [Extending Copilot coding agent with MCP](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agent-with-mcp)
- [Model Context Protocol specification](https://spec.modelcontextprotocol.io/)
- [SVG_ACCESSIBILITY_BEST_PRACTICES.md — Section 5: Contrast](../../SVG_ACCESSIBILITY_BEST_PRACTICES.md)
- [docs/ACCESSIBLE_NAME_DETECTION.md](../../docs/ACCESSIBLE_NAME_DETECTION.md)
