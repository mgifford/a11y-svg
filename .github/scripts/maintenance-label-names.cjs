#!/usr/bin/env node
/**
 * Derives every "maintenance:<value>" label name the Dependabot Pilot
 * workflow (dependabot-pilot.yml) could ever apply, from the policy
 * engine's own value lists plus the one extra value the classifier
 * produces that isn't a formal policy enum: update_type "unknown" (set
 * when a PR title can't be parsed; see parseDependabotTitle in
 * scripts/generate-maintenance-rollup.cjs).
 *
 * Deterministic, pure, no network access. Printed one name per line when
 * run directly, for ensure-maintenance-labels.sh to consume.
 *
 * POLICY_ROOT env var: see classify-dependabot-pr.js for the full
 * explanation. Defaults to this script's own repo root.
 */

const path = require('node:path');
const policyRoot = process.env.POLICY_ROOT || path.join(__dirname, '..', '..');
const { VALID_DEPENDENCY_CLASSES, VALID_UPDATE_TYPES, VALID_RISK_STATES } = require(path.join(policyRoot, 'policy', 'policy-engine.cjs'));

function getMaintenanceLabelNames() {
  const updateTypesIncludingUnknown = [...new Set([...VALID_UPDATE_TYPES, 'unknown'])];
  const values = [...new Set([...VALID_DEPENDENCY_CLASSES, ...updateTypesIncludingUnknown, ...VALID_RISK_STATES])];
  return values.map((v) => `maintenance:${v}`).sort();
}

if (require.main === module) {
  console.log(getMaintenanceLabelNames().join('\n'));
}

module.exports = { getMaintenanceLabelNames };
