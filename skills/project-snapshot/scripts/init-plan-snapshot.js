#!/usr/bin/env node
/**
 * Initialize or Finalize Plan Snapshot Data
 *
 * Usage:
 *   node init-plan-snapshot.js <plan-directory>            # Initialize templates
 *   node init-plan-snapshot.js <plan-directory> --complete # Finalize stats and status
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = process.cwd();
const args = process.argv.slice(2);
const isCompleteAction = args.includes('--complete');
const planDirArg = args.find(arg => arg !== '--complete');

// Empty templates based on dashboard/index.html requirements
const EMPTY_TEMPLATES = {
  'requirements.json': {
    "project_name": "",
    "requirements": []
  },
  'tasks.json': {
    "project_name": "",
    "current_iteration": "ITER-001",
    "iterations": [
      {
        "iteration_id": "ITER-001",
        "iteration_name": "核心功能开发",
        "status": "in_progress",
        "timeline": "",
        "tasks": []
      }
    ]
  },
  'modules.json': {
    "project_name": "",
    "modules": []
  }
};

function calculateFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (e) {
    return null;
  }
}

function extractPlanInfo(planMdPath) {
  try {
    const content = fs.readFileSync(planMdPath, 'utf-8');
    const lines = content.split('\n');
    const firstHeading = lines.find(line => line.startsWith('# '));
    const planName = firstHeading ? firstHeading.substring(2).trim() : 'Unknown Plan';
    const planId = path.basename(path.dirname(planMdPath));
    return { plan_id: planId, plan_name: planName };
  } catch (e) {
    return { plan_id: 'unknown', plan_name: 'Unknown Plan' };
  }
}

function ensureTemplates(planDirectory, projectName) {
  for (const [filename, template] of Object.entries(EMPTY_TEMPLATES)) {
    const filePath = path.join(planDirectory, filename);
    if (!fs.existsSync(filePath)) {
      const data = { ...template, project_name: projectName };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`  - Initialized: ${filename}`);
    }
  }
}

function processSnapshot(planDirectory) {
  const planMdPath = path.join(planDirectory, 'plan.md');
  const statusPath = path.join(planDirectory, 'status.json');

  if (!fs.existsSync(planMdPath)) {
    console.error(`[Error] plan.md not found in: ${planDirectory}`);
    process.exit(1);
  }

  const planInfo = extractPlanInfo(planMdPath);
  const contentHash = calculateFileHash(planMdPath);
  const stats = fs.statSync(planMdPath);

  // 1. Ensure templates exist (only on init or if missing)
  ensureTemplates(planDirectory, planInfo.plan_name);

  // 2. Load existing status
  let status = {
    plan_id: planInfo.plan_id,
    plan_name: planInfo.plan_name,
    created_at: new Date().toISOString(),
    updated_at: stats.mtime.toISOString(),
    content_hash: contentHash,
    last_processed_at: null,
    processing_status: 'pending',
    completion_rate: 0.0,
    total_tasks: 0,
    completed_tasks: 0
  };

  if (fs.existsSync(statusPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
      status = { ...status, ...existing, updated_at: stats.mtime.toISOString(), content_hash: contentHash };
    } catch (e) {}
  }

  // 3. Update stats if finalizing
  if (isCompleteAction) {
    const tasksPath = path.join(planDirectory, 'tasks.json');
    if (fs.existsSync(tasksPath)) {
      try {
        const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
        let total = 0, completed = 0;
        (tasksData.iterations || []).forEach(iter => {
          (iter.tasks || []).forEach(task => {
            total++;
            if (['completed', 'done'].includes(task.status?.toLowerCase())) completed++;
          });
        });
        status.total_tasks = total;
        status.completed_tasks = completed;
        status.completion_rate = total > 0 ? parseFloat((completed / total).toFixed(2)) : 0;
      } catch (e) {}
    }
    status.processing_status = 'completed';
    status.last_processed_at = new Date().toISOString();
  } else {
    status.processing_status = 'processing';
  }

  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
  const actionName = isCompleteAction ? 'Finalized' : 'Initialized';
  console.log(`[Success] ${actionName} snapshot for: ${planInfo.plan_id}`);
  if (isCompleteAction) {
    console.log(`  - Progress: ${status.completed_tasks}/${status.total_tasks} (${Math.round(status.completion_rate * 100)}%)`);
  }
}

if (!planDirArg) {
  console.error('Usage: node init-plan-snapshot.js <plan-directory> [--complete]');
  process.exit(1);
}

let planDir = path.isAbsolute(planDirArg) ? planDirArg : path.join(PROJECT_ROOT, planDirArg);
try {
  processSnapshot(planDir);
} catch (e) {
  console.error('[Error]', e.message);
  process.exit(1);
}
