#!/usr/bin/env python3
"""
collect_svgviewer.py

Server-side collector for svgviewer.dev samples.

Usage examples:
  python collect_svgviewer.py --start 13341 --limit 50 --batch 25
  python collect_svgviewer.py --start 10000 --end 14000 --limit 25 --random

This script fetches raw SVGs from https://www.svgviewer.dev/s/:id, heuristically
checks for SVG validity and license keywords, and saves qualifying files to
svg/remote/. It keeps an index file svg/remote/index.json to avoid duplicates
and enable resuming.

Note: Run locally; GitHub Pages only serves static files and cannot run this.
"""
import argparse
import hashlib
import json
import os
import random
import sys
import time
from datetime import datetime

try:
    # prefer requests if available
    import requests
    http_get = lambda url, timeout=15: requests.get(url, timeout=timeout)
except Exception:
    import urllib.request as _ur
    import urllib.error as _ue

    class SimpleResp:
        def __init__(self, status, text):
            self.status_code = status
            self.text = text

    def http_get(url, timeout=15):
        try:
            with _ur.urlopen(url, timeout=timeout) as res:
                body = res.read()
                try:
                    text = body.decode('utf-8')
                except Exception:
                    text = body.decode('latin1', errors='replace')
                return SimpleResp(res.getcode(), text)
        except _ue.HTTPError as e:
            return SimpleResp(e.code, '')
        except Exception:
            return SimpleResp(0, '')


OUT_DIR = os.path.join(os.path.dirname(__file__), 'svg', 'remote')
INDEX_FILE = os.path.join(OUT_DIR, 'index.json')
# local (curated) index in /svg
LOCAL_DIR = os.path.join(os.path.dirname(__file__), 'svg')
LOCAL_INDEX = os.path.join(LOCAL_DIR, 'index.json')
os.makedirs(OUT_DIR, exist_ok=True)

LICENSE_KEYWORDS = [
    'cc-by', 'cc0', 'creativecommons', 'public domain', 'cc-by-sa', 'cc-by-nc',
    'mit', 'apache', 'bsd', 'mozilla public', 'mpl', 'gpl', 'lgpl'
]


def compute_hash(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def load_index():
    if not os.path.exists(INDEX_FILE):
        return {'items': []}
    try:
        with open(INDEX_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'items': []}


def save_index(idx):
    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump(idx, f, indent=2)


def save_local_index(idx):
    # ensure svg/ exists
    os.makedirs(LOCAL_DIR, exist_ok=True)
    try:
        with open(LOCAL_INDEX, 'w', encoding='utf-8') as f:
            json.dump(idx, f, indent=2)
    except Exception:
        print('Warning: failed to write local index', LOCAL_INDEX)


def looks_like_svg(text):
    return '<svg' in text.lower()


def find_license_keywords(text):
    t = text.lower()
    found = [k for k in LICENSE_KEYWORDS if k in t]
    if found:
        return found
    return []


def save_svg(id_val, text, out_dir=OUT_DIR):
    fname = f'svgviewer-{id_val}.svg'
    path = os.path.join(out_dir, fname)
    # avoid overwriting if file exists with different content
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
            existing = fh.read()
        if existing == text:
            return fname
        # different content - write with timestamp suffix
        ts = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        fname = f'svgviewer-{id_val}-{ts}.svg'
        path = os.path.join(out_dir, fname)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return fname


def collect(start=13341, limit=50, batch=25, max_checks=5000, random_mode=False, end=None, sleep=0.2):
    idx = load_index()
    known_hashes = {item.get('hash') for item in idx.get('items', [])}
    known_ids = {item.get('id') for item in idx.get('items', [])}
    # ensure local index exists
    try:
        local_idx = {'items': []}
        if os.path.exists(LOCAL_INDEX):
            with open(LOCAL_INDEX, 'r', encoding='utf-8') as f:
                local_idx = json.load(f)
    except Exception:
        local_idx = {'items': []}

    collected = 0
    checked = 0
    id_cursor = int(start)
    attempts = 0

    def next_id():
        nonlocal id_cursor
        if random_mode:
            low = int(start)
            high = int(end) if end else low + 100000
            return random.randint(low, high)
        else:
            val = id_cursor
            id_cursor += 1
            return val

    while collected < limit and checked < max_checks:
        id_val = next_id()
        if id_val in known_ids:
            checked += 1
            continue

        url = f'https://www.svgviewer.dev/s/{id_val}'
        print(f'Fetching {url} ...')
        try:
            res = http_get(url)
            status = getattr(res, 'status_code', getattr(res, 'status', 0))
            text = getattr(res, 'text', '')
        except Exception as e:
            print('Error fetching:', e)
            checked += 1
            time.sleep(sleep)
            continue

        checked += 1
        if status != 200:
            print(f'  Skipped (status {status})')
            time.sleep(sleep)
            continue

        if not looks_like_svg(text):
            print('  Not an SVG or invalid content')
            time.sleep(sleep)
            continue

        # If the response is an HTML page that contains inline <svg> elements,
        # extract all <svg>...</svg> fragments and pick the largest one. This
        # avoids choosing small site chrome (logo) and picks the main graphic.
        lower = text.lower()
        svg_text = text
        if '<svg' in lower and '</svg>' in lower:
            frags = []
            off = 0
            while True:
                s = lower.find('<svg', off)
                if s == -1:
                    break
                e = lower.find('</svg>', s)
                if e == -1:
                    break
                frag = text[s:e + len('</svg>')]
                frags.append(frag)
                off = e + len('</svg>')
            if frags:
                # pick largest fragment as likely main asset
                svg_text = max(frags, key=len)

        h = compute_hash(svg_text)
        if h in known_hashes:
            print('  Duplicate content (hash match). Skipping.')
            known_ids.add(id_val)
            time.sleep(sleep)
            continue

        # Check license keywords first in the extracted SVG, then fall back to
        # the original page text if needed.
        licenses = find_license_keywords(svg_text) or find_license_keywords(text)
        if not licenses:
            print('  No license keywords found — skipping by default')
            # still record checked id to avoid re-checking
            known_ids.add(id_val)
            time.sleep(sleep)
            continue

        # Passed heuristics — save
        fname = save_svg(id_val, svg_text)
        entry = {
            'id': id_val,
            'url': url,
            'filename': fname,
            'hash': h,
            'licenses': licenses,
            'collected_at': datetime.utcnow().isoformat() + 'Z'
        }
        idx.setdefault('items', []).append(entry)
        save_index(idx)
        known_hashes.add(h)
        known_ids.add(id_val)
        collected += 1
        print(f'  Saved to {fname} ({len(licenses)} license keywords found)')
        # Append a lightweight local index entry so curated/validated items
        # are visible under /svg/index.json for human review. This behavior
        # can be suppressed with --no-local-sync.
        try:
            local_entry = {
                'id': id_val,
                'url': url,
                'filename': fname,
                'hash': h,
                'licenses': licenses,
                'collected_at': entry['collected_at'],
                '_origin': 'remote'
            }
            # avoid duplicates by filename
            existing_local_filenames = {it.get('filename') for it in local_idx.get('items', [])}
            if fname not in existing_local_filenames:
                local_idx.setdefault('items', []).append(local_entry)
                save_local_index(local_idx)
        except Exception:
            print('Warning: failed to update local index')
        time.sleep(sleep)

    print(f'Done. Collected {collected} items, checked {checked} ids.')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--start', type=int, default=13341)
    p.add_argument('--end', type=int, default=None)
    p.add_argument('--limit', type=int, default=50)
    p.add_argument('--batch', type=int, default=25)
    p.add_argument('--max-checks', type=int, default=5000)
    p.add_argument('--normalize', action='store_true', help='Normalize index entries to basenames and prune missing files')
    p.add_argument('--repair', action='store_true', help='Repair existing saved files by extracting inline SVG from HTML wrappers')
    p.add_argument('--recollect-id', type=int, default=None, help='Re-fetch a specific index id and save its SVG')
    p.add_argument('--sync-local', action='store_true', help='Mirror remote index entries into svg/index.json for testing/validation')
    p.add_argument('--no-local-sync', action='store_true', help="Don't auto-append collected items to svg/index.json")
    p.add_argument('--random', action='store_true')
    p.add_argument('--sleep', type=float, default=0.2)
    args = p.parse_args()
    if getattr(args, 'normalize', False):
        # Normalize existing index entries to use basenames and drop missing files
        idx = load_index()
        changed = False
        new_items = []
        for item in idx.get('items', []):
            fname = item.get('filename') or ''
            base = os.path.basename(fname)
            fpath = os.path.join(OUT_DIR, base)
            if os.path.exists(fpath):
                if item.get('filename') != base:
                    item['filename'] = base
                    changed = True
                new_items.append(item)
            else:
                print('Removing missing file from index:', fname)
                changed = True
        idx['items'] = new_items
        if changed:
            save_index(idx)
            print('Index normalized and saved.')
        else:
            print('Index already normalized.')
        # Also scan svg/ for curated local files and write a local index.json
        try:
            local_items = []
            for entry in os.listdir(LOCAL_DIR):
                if not entry.lower().endswith('.svg'):
                    continue
                # create a minimal index entry for local curated assets
                local_items.append({
                    'id': None,
                    'url': None,
                    'filename': entry,
                    'hash': None,
                    'licenses': [],
                    'collected_at': None
                })
            local_idx = {'items': local_items}
            save_local_index(local_idx)
            print('Local svg/index.json written with', len(local_items), 'entries')
        except Exception as e:
            print('Failed to write local index:', e)
        return
    if getattr(args, 'repair', False):
        idx = load_index()
        changed = False
        for item in idx.get('items', []):
            fname = item.get('filename') or ''
            fpath = os.path.join(OUT_DIR, fname)
            if not os.path.exists(fpath):
                print('Missing file, skipping:', fname)
                continue
            try:
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as fh:
                    content = fh.read()
            except Exception as e:
                print('Error reading', fname, e)
                continue
            lower = content.lower()
            # If file contains an <svg> and a closing </svg>, ensure the saved
            # file contains exactly the first SVG fragment and nothing after it.
            if '<svg' in lower and '</svg>' in lower:
                frags = []
                off = 0
                while True:
                    s = lower.find('<svg', off)
                    if s == -1:
                        break
                    e = lower.find('</svg>', s)
                    if e == -1:
                        break
                    frag = content[s:e + len('</svg>')]
                    frags.append(frag)
                    off = e + len('</svg>')
                if frags:
                    svg_text = max(frags, key=len)
                    if svg_text.strip() != content.strip():
                        try:
                            with open(fpath, 'w', encoding='utf-8') as outfh:
                                outfh.write(svg_text)
                            item['hash'] = compute_hash(svg_text)
                            item['repaired_at'] = datetime.utcnow().isoformat() + 'Z'
                            changed = True
                            print('Rewrote', fname, 'with extracted largest SVG fragment')
                        except Exception as e:
                            print('Error writing', fname, e)
        if changed:
            save_index(idx)
            print('Index updated after repair.')
        else:
            print('No repairs necessary.')
        return
    if getattr(args, 'recollect_id', None) is not None:
        target = int(args.recollect_id)
        idx = load_index()
        found = False
        for item in idx.get('items', []):
            if item.get('id') == target:
                found = True
                url = item.get('url')
                print('Re-fetching', url)
                try:
                    res = http_get(url)
                    status = getattr(res, 'status_code', getattr(res, 'status', 0))
                    text = getattr(res, 'text', '')
                except Exception as e:
                    print('  Error fetching:', e)
                    break
                if status != 200:
                    print('  Got status', status)
                    break
                # extract svg fragments
                lower = text.lower()
                if '<svg' in lower and '</svg>' in lower:
                    frags = []
                    off = 0
                    while True:
                        s = lower.find('<svg', off)
                        if s == -1:
                            break
                        e = lower.find('</svg>', s)
                        if e == -1:
                            break
                        frag = text[s:e + len('</svg>')]
                        frags.append(frag)
                        off = e + len('</svg>')
                    if frags:
                        svg_text = max(frags, key=len)
                    else:
                        print('  No svg fragment found')
                        break
                else:
                    print('  No svg found in response')
                    break
                fname = item.get('filename') or f'svgviewer-{target}.svg'
                path = os.path.join(OUT_DIR, fname)
                # ensure unique filename if exists with different content
                if os.path.exists(path):
                    with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
                        existing = fh.read()
                    if existing != svg_text:
                        ts = datetime.utcnow().strftime('%Y%m%d%H%M%S')
                        fname = f'svgviewer-{target}-{ts}.svg'
                        path = os.path.join(OUT_DIR, fname)
                with open(path, 'w', encoding='utf-8') as outfh:
                    outfh.write(svg_text)
                item['filename'] = fname
                item['hash'] = compute_hash(svg_text)
                item['repaired_at'] = datetime.utcnow().isoformat() + 'Z'
                save_index(idx)
                print('  Saved', fname)
                break
        if not found:
            print('No index entry for id', target)
        return

    if getattr(args, 'sync_local', False):
        # load remote index and mirror entries that exist into svg/index.json
        idx = load_index()
        local_items = []
        for item in idx.get('items', []):
            fname = item.get('filename') or ''
            base = os.path.basename(fname)
            remote_path = os.path.join(OUT_DIR, base)
            if os.path.exists(remote_path):
                # create a copy adapted for local index; reference remote filename
                local_items.append({
                    'id': item.get('id'),
                    'url': item.get('url'),
                    'filename': base,
                    'hash': item.get('hash'),
                    'licenses': item.get('licenses', []),
                    'collected_at': item.get('collected_at')
                })
        local_idx = {'items': local_items}
        save_local_index(local_idx)
        print('Wrote local svg/index.json with', len(local_items), 'entries')
        return

    collect(start=args.start, limit=args.limit, batch=args.batch, max_checks=args.max_checks, random_mode=args.random, end=args.end, sleep=args.sleep)


if __name__ == '__main__':
    main()
