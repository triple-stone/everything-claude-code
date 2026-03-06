#!/usr/bin/env node
/**
 * Update Coverage in Plan Tasks
 *
 * Reads coverage data and updates all plan tasks.json files
 * with actual coverage values.
 *
 * Usage:
 *   node update-coverage.js
 *   node update-coverage.js --plan <plan-id>
 */

const fs = require('fs');
const path = require('path');

// Use __dirname to support global deployment
const { readCoverageData, getCoverageForFile } = require(path.join(__dirname, './read-coverage.js'));

// Scripts are globally deployed, but data is in the local project
const PROJECT_ROOT = process.cwd();
const PLANS_DIR = path.join(PROJECT_ROOT, '.claude/plans');

/**
 * Update tasks.json with coverage data
 */
function updatePlanTasksCoverage(planDir) {
  const tasksPath = path.join(planDir, 'tasks.json');

  if (!fs.existsSync(tasksPath)) {
    console.log(`[Skip] No tasks.json in: ${planDir}`);
    return false;
  }

  try {
    const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
    let updated = false;

    // Update each iteration's tasks
    if (tasksData.iterations) {
      for (const iteration of tasksData.iterations) {
        if (!iteration.tasks) continue;

        for (const task of iteration.tasks) {
          if (!task.tdd || !task.tdd.test_file) continue;

          // Get coverage for this test file
          const coverage = getCoverageForFile(task.tdd.test_file);

          // Update if changed
          if (task.tdd.coverage_actual !== coverage) {
            task.tdd.coverage_actual = coverage;
            updated = true;
          }
        }
      }
    }

    if (updated) {
      fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
      console.log(`[Updated] ${path.basename(planDir)}`);
      return true;
    } else {
      console.log(`[Unchanged] ${path.basename(planDir)}`);
      return false;
    }
  } catch (e) {
    console.error(`[Error] Failed to update ${planDir}:`, e.message);
    return false;
  }
}

/**
 * Main execution
 */
function updateAllPlans(targetPlanId = null) {
  // Read coverage data once
  const coverage = readCoverageData();

  if (!coverage) {
    console.error('[Error] No coverage data found. Run tests first.');
    process.exit(1);
  }

  console.log(`[Coverage] Total coverage: ${coverage.total.lines}%`);

  // Get all plan directories
  if (!fs.existsSync(PLANS_DIR)) {
    console.log('[Info] No plans directory found');
    return;
  }

  const entries = fs.readdirSync(PLANS_DIR, { withFileTypes: true });
  const planDirs = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => path.join(PLANS_DIR, e.name))
    .filter(dir => fs.existsSync(path.join(dir, 'tasks.json')));

  // Filter by target plan if specified
  const targetDirs = targetPlanId
    ? planDirs.filter(dir => path.basename(dir) === targetPlanId)
    : planDirs;

  if (targetDirs.length === 0) {
    console.log('[Info] No matching plans found');
    return;
  }

  // Update each plan
  let updatedCount = 0;
  for (const planDir of targetDirs) {
    if (updatePlanTasksCoverage(planDir)) {
      updatedCount++;
    }
  }

  console.log(`\n[Summary] Updated ${updatedCount}/${targetDirs.length} plan(s)`);
}

// CLI
const args = process.argv.slice(2);
const planIndex = args.indexOf('--plan');
const targetPlanId = planIndex !== -1 && args[planIndex + 1]
  ? args[planIndex + 1]
  : null;

try {
  updateAllPlans(targetPlanId);
} catch (e) {
  console.error('[Error]', e.message);
  process.exit(1);
}
