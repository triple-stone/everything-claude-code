#!/usr/bin/env node
/**
 * Detect Plan Changes
 *
 * Scans all plan directories and detects which plans have been added, modified, or deleted.
 * Compares content hash against status.json to determine changes.
 *
 * Usage:
 *   node detect-plan-changes.js
 *   node detect-plan-changes.js --json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Scripts are globally deployed, but data is in the local project
const PROJECT_ROOT = process.cwd();
const PLANS_DIR = path.join(PROJECT_ROOT, '.claude/plans');

function calculateFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (e) {
    return null;
  }
}

function readPlanStatus(planDir) {
  const statusPath = path.join(planDir, 'status.json');
  if (!fs.existsSync(statusPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function detectPlanChanges() {
  // Check if plans directory exists
  if (!fs.existsSync(PLANS_DIR)) {
    console.log('[Info] No plans directory found');
    return JSON.stringify({
      total_plans: 0,
      changed_plans: [],
      new_plans: [],
      unchanged_plans: []
    }, null, 2);
  }

  // Get all plan directories
  const entries = fs.readdirSync(PLANS_DIR, { withFileTypes: true });
  const planDirs = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => path.join(PLANS_DIR, e.name))
    .filter(dir => fs.existsSync(path.join(dir, 'plan.md')));

  const result = {
    total_plans: planDirs.length,
    changed_plans: [],
    new_plans: [],
    unchanged_plans: []
  };

  for (const planDir of planDirs) {
    const planId = path.basename(planDir);
    const planMdPath = path.join(planDir, 'plan.md');

    // Calculate current hash
    const currentHash = calculateFileHash(planMdPath);
    if (!currentHash) {
      console.warn(`[Warn] Failed to calculate hash for: ${planId}`);
      continue;
    }

    // Read status.json
    const status = readPlanStatus(planDir);

    if (!status) {
      // New plan (no status.json)
      result.new_plans.push({
        plan_id: planId,
        reason: 'new_plan',
        current_hash: currentHash
      });
      console.log(`[New] ${planId}`);
    } else if (status.content_hash !== currentHash) {
      // Modified plan
      result.changed_plans.push({
        plan_id: planId,
        reason: 'content_modified',
        previous_hash: status.content_hash,
        current_hash: currentHash
      });
      console.log(`[Modified] ${planId}`);
    } else {
      // Unchanged
      result.unchanged_plans.push(planId);
    }
  }

  return JSON.stringify(result, null, 2);
}

// CLI
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

try {
  const result = detectPlanChanges();

  if (jsonMode) {
    console.log(result);
  } else {
    const data = JSON.parse(result);
    console.log(`\n[Summary]`);
    console.log(`  Total Plans: ${data.total_plans}`);
    console.log(`  New Plans: ${data.new_plans.length}`);
    console.log(`  Changed Plans: ${data.changed_plans.length}`);
    console.log(`  Unchanged Plans: ${data.unchanged_plans.length}`);

    if (data.new_plans.length > 0 || data.changed_plans.length > 0) {
      console.log(`\n[Action Required] Process ${data.new_plans.length + data.changed_plans.length} plan(s)`);
    }
  }
} catch (e) {
  console.error('[Error]', e.message);
  process.exit(1);
}
