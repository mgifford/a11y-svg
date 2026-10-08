#!/usr/bin/env bash
# Ensures every "maintenance:*" label the Dependabot Pilot workflow could
# ever apply already exists in the repository before trying to apply one.
# GitHub's `gh pr edit --add-label` (and the underlying API) never creates
# a missing label — it fails outright — so this must run before labeling.
# Idempotent: existing labels are left untouched, no --force overwrite.
set -euo pipefail

LABEL_NAMES=$(node "$(dirname "$0")/maintenance-label-names.cjs")
EXISTING=$(gh label list --json name -q '.[].name')

while IFS= read -r name; do
  if ! grep -qxF "$name" <<< "$EXISTING"; then
    echo "Creating missing label: $name"
    gh label create "$name" --description "Maintenance control plane: Dependabot PR classification" --color "c5def5"
  fi
done <<< "$LABEL_NAMES"
