#!/bin/bash

# Script to auto-generate manifest.json with only valid, non-empty SVG files

SVG_DIR="./svg"
MANIFEST_FILE="$SVG_DIR/manifest.json"

# Check if svg directory exists
if [ ! -d "$SVG_DIR" ]; then
    echo "Error: $SVG_DIR directory not found"
    exit 1
fi

# Function to validate SVG file
validate_svg() {
    local file="$1"
    local filename=$(basename "$file")
    
    # Check if file contains <svg tag
    if ! grep -q '<svg' "$file"; then
        echo "⚠️  Skipped (no <svg> tag): $filename"
        return 1
    fi
    
    # Check if file is valid XML using xmllint (if available)
    if command -v xmllint &> /dev/null; then
        if ! xmllint --noout "$file" 2>/dev/null; then
            echo "⚠️  Skipped (invalid XML): $filename"
            return 1
        fi
    fi
    
    return 0
}

# Create the manifest as a JSON array
echo "[" > "$MANIFEST_FILE"

# Find all SVG files, exclude those with 0 bytes, and add to manifest
first=true
valid_count=0
skipped_count=0

for file in $(find "$SVG_DIR" -maxdepth 1 -name "*.svg" -type f ! -size 0 | sort); do
    filename=$(basename "$file")
    
    # Validate SVG before adding
    if ! validate_svg "$file"; then
        ((skipped_count++))
        continue
    fi
    
    # Add comma before entry (except for first)
    if [ "$first" = true ]; then
        first=false
        echo "  \"$filename\"" >> "$MANIFEST_FILE"
    else
        echo ",  \"$filename\"" >> "$MANIFEST_FILE"
    fi
    
    echo "✓ Added: $filename"
    ((valid_count++))
done

echo "]" >> "$MANIFEST_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Manifest updated: $MANIFEST_FILE"
echo "Total valid files: $valid_count"
if [ $skipped_count -gt 0 ]; then
    echo "Skipped invalid files: $skipped_count"
fi
