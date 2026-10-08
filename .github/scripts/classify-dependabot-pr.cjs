#!/usr/bin/env node
/**
 * Classifies a single Dependabot PR (from environment variables set by the
 * dependabot-pilot workflow) and writes dependency_class, update_type, and
 * risk_state to $GITHUB_OUTPUT. Reuses the exact same parsing and policy
 * logic as scripts/generate-maintenance-rollup.cjs and policy/policy-engine.cjs
 * so labeling and the rollup can never disagree.
 *
 * Reads PR metadata (title, labels) from env vars plus the PR's actually
 * changed files (fetched live via the GitHub API) to classify ecosystem
 * and dependency class — the same manifest-aware logic
 * scripts/generate-maintenance-rollup.cjs uses, not a label-only
 * shortcut. This matters because different repositories use different
 * label conventions (tune-my-repos uses "devDependencies"; a11y-svg uses
 * "javascript" for the same thing), so label-only detection silently
 * failed to classify anything as "development" outside tune-my-repos.
 * Still never executes or inspects the PR branch's own code — only
 * reads file names and package.json content via the API.
 *
 * POLICY_ROOT env var: the directory containing policy/, scripts/, and
 * maintenance-policy.json. Defaults to this script's own repo root (the
 * tune-my-repos pilot, where those files live alongside this one). A
 * pilot repo other than tune-my-repos sets POLICY_ROOT to wherever its
 * workflow checked out a read-only copy of tune-my-repos (the single
 * source of truth for policy logic — see dependabot-pilot.yml's
 * "Checkout shared policy engine" step) rather than duplicating these
 * files into every pilot repo.
 *
 * GITHUB_TOKEN / GH_TOKEN env var: used for the changed-files and
 * package.json API calls (read-only). Falls back to "unknown"
 * ecosystem/class if absent rather than failing the whole run.
 */

const fs = require('node:fs');
const path = require('node:path');

const policyRoot = process.env.POLICY_ROOT || path.join(__dirname, '..', '..');

const {
  parseDependabotTitle,
  inferUpdateType,
  inferDependencyClass,
  detectEcosystemFromFiles,
} = require(path.join(policyRoot, 'scripts', 'generate-maintenance-rollup.cjs'));
const { classifyUpdate } = require(path.join(policyRoot, 'policy', 'policy-engine.cjs'));

/**
 * Pure classification step, factored out for unit testing.
 * @param {object} policy - parsed maintenance-policy.json
 * @param {{title: string, labelNames: string[], repository: string, changedFiles: string[], baseRef: string, prNumber: number}} pr
 * @returns {Promise<{dependency_class: string, update_type: string, risk_state: string}>}
 */
async function classifyPrMetadata(policy, pr) {
  const labels = pr.labelNames.map((name) => ({ name }));
  const ecosystem = detectEcosystemFromFiles(pr.changedFiles || []);

  const parsed = parseDependabotTitle(pr.title);
  const dependencyName = parsed?.dependencyName || 'unknown';
  const versionFrom = parsed?.versionFrom || 'unknown';
  const versionTo = parsed?.versionTo || 'unknown';
  const updateType = parsed ? inferUpdateType(versionFrom, versionTo) : 'unknown';
  const dependencyClass = await inferDependencyClass(
    { labels },
    ecosystem,
    pr.repository,
    dependencyName,
    pr.baseRef
  );

  // IMPORTANT: risk_state here answers "is this class of update ever
  // eligible for auto-merge" (a policy question, computed as if CI had
  // already passed), NOT "has CI passed yet" (a fact question). The
  // auto-merge job in dependabot-pilot.yml treats this as necessary but not
  // sufficient: it still calls `gh pr merge --auto`, which defers the
  // actual merge until GitHub's own branch ruleset reports the required
  // "npm test" check green on this PR's head commit. This script never
  // has, and must never be given, the authority to merge directly.
  const classificationIfCiPasses = classifyUpdate(policy, {
    repository: pr.repository,
    dependency_class: dependencyClass,
    update_type: updateType,
    dependency_name: dependencyName,
    ecosystem,
    required_ci_passed: true,
    touches_workflow_permissions: false,
    is_lockfile_only: false,
    is_generated_output_only: false,
    requires_new_secret_or_elevated_access: false,
    required_check_failed: false,
  });

  return {
    dependency_class: dependencyClass,
    update_type: updateType,
    risk_state: classificationIfCiPasses.risk_state,
  };
}

async function fetchChangedFiles(repoFullName, prNumber, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(
    `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files?per_page=100`,
    { headers }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return data.map((f) => f.filename);
}

async function main() {
  const policy = JSON.parse(
    fs.readFileSync(path.join(policyRoot, 'maintenance-policy.json'), 'utf8')
  );

  const repository = process.env.REPO_FULL_NAME || '';
  const prNumber = parseInt(process.env.PR_NUMBER || '0', 10);
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const changedFiles = prNumber ? await fetchChangedFiles(repository, prNumber, token) : [];

  const result = await classifyPrMetadata(policy, {
    title: process.env.PR_TITLE || '',
    labelNames: JSON.parse(process.env.PR_LABELS || '[]'),
    repository,
    changedFiles,
    baseRef: process.env.PR_BASE_REF || 'main',
  });

  const lines = [
    `dependency_class=${result.dependency_class}`,
    `update_type=${result.update_type}`,
    `risk_state=${result.risk_state}`,
  ];

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, lines.join('\n') + '\n');
  }
  console.log(lines.join('\n'));
}

module.exports = { classifyPrMetadata };

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to classify Dependabot PR:', error.message);
    process.exit(1);
  });
}
