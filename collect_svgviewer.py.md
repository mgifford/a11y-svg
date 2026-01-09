# collect_svgviewer.py

This document describes how to use `collect_svgviewer.py` — a server-side collector that fetches SVG samples from https://www.svgviewer.dev/s/:id and saves qualifying SVG files into `svg/remote/` together with an `index.json`.

## Overview

- The script fetches the URL `https://www.svgviewer.dev/s/<id>` for provided id(s).
- It heuristically validates whether the response contains an SVG and tests for license keywords (e.g., `cc-by`, `cc0`, `mit`, etc.).
- It extracts the primary `<svg>...</svg>` fragment (prefers the largest fragment on the page to avoid site chrome) and saves it as a standalone `.svg` file in `svg/remote/`.
- The script maintains `svg/remote/index.json` with entries that include `id`, `url`, `filename`, `hash`, `licenses`, and timestamps.

## Requirements

- Python 3.8+ (the script uses standard library modules and optionally `requests` if available).
- Network access to `https://www.svgviewer.dev/`.

## Installation

No dependencies are strictly required, but installing `requests` will use it for faster HTTP fetching:

```bash
python3 -m pip install requests
```

## Usage

Basic collection (default start id 13341):

```bash
python3 collect_svgviewer.py --start 13341 --limit 50
```

Options

- `--start N` : starting id to scan (default: 13341)
- `--end N` : upper bound when used with `--random` (optional)
- `--limit N` : number of successful saves to collect
- `--batch N` : internal batching; default 25
- `--max-checks N` : maximum id checks before giving up (default 5000)
- `--random` : pick ids randomly (from `--start` up to `--start+100000` or `--end` if provided)
- `--sleep S` : seconds to sleep between requests (default 0.2)
- `--normalize` : normalize existing `index.json` entries to basenames and prune missing files
- `--repair` : examine existing saved files and extract/truncate to the primary `<svg>...</svg>` fragment; updates `hash` and `repaired_at` in the index
- `--recollect-id <ID>` : re-fetch a single `id` from the index and save its main SVG fragment (useful for missing files)

## Examples

- Collect 50 SVGs starting at id 14000 (random sampling):

```bash
python3 collect_svgviewer.py --start 14000 --limit 50 --random --sleep 0.1
```

- Normalize the index (replace filenames with basenames, prune missing files):

```bash
python3 collect_svgviewer.py --normalize
```

- Repair saved files (extract first `<svg>` or the largest fragment and rewrite the file):

```bash
python3 collect_svgviewer.py --repair
```

- Recollect a single id (useful when `index.json` references a filename but the file was deleted):

```bash
python3 collect_svgviewer.py --recollect-id 13749
```

## Notes & Caveats

- The script uses simple keyword heuristics to detect license text; it's not a legal license detector. Review each SVG's provenance before using it.
- The collector picks the largest inline `<svg>` fragment found on the page to avoid saving the site logo or sidebar icons.
- Saved `.svg` files are intended for static hosting (GitHub Pages). Ensure you have the right to redistribute any asset you publish.
- The script attempts to avoid saving duplicates using SHA-256 of the SVG fragment.

## Troubleshooting

- If many index entries refer to missing files, use `--recollect-id` or re-run the collector to fill gaps, or run `--normalize` to prune the index.
- If a saved `.svg` renders the site chrome, run `--repair` to extract the primary `<svg>` fragment.

## License

This collector is part of A11y-SVG-Studio and is distributed under the same project license.
