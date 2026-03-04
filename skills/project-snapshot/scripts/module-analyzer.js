#!/usr/bin/env node
/**
 * Module Analyzer
 *
 * Analyzes project modules from various sources:
 * - .claude/modules.json (module definitions)
 * - Plan files (extracts modules mentioned in implementation steps)
 * - Code structure (detects modules from directory structure)
 *
 * Output: Array of modules with status, completion rate, and relationships
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_MODULES_FILE = '.claude/modules.json';
const DEFAULT_PLANS_DIR = '.claude/plans';

/**
 * Load modules from configuration file
 */
function loadModulesFromFile() {
  const modules = [];

  try {
    const filePath = path.join(process.cwd(), DEFAULT_MODULES_FILE);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (Array.isArray(data)) {
        return data.map(m => normalizeModule(m));
      } else if (data.modules && Array.isArray(data.modules)) {
        return data.modules.map(m => normalizeModule(m));
      }
    }
  } catch (e) {
    // File doesn't exist or is invalid
  }

  return modules;
}

/**
 * Extract modules from plan files
 */
function extractModulesFromPlans() {
  const modulesMap = new Map();
  const plansDir = path.join(process.cwd(), DEFAULT_PLANS_DIR);

  try {
    if (!fs.existsSync(plansDir)) {
      return [];
    }

    const planFiles = fs.readdirSync(plansDir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(plansDir, f));

    for (const planFile of planFiles) {
      const content = fs.readFileSync(planFile, 'utf-8');
      const stats = fs.statSync(planFile);

      // Extract modules mentioned in the plan
      const moduleMatches = content.match(/(?:模块|模块|module):\s*([^\n,]+)/gi);
      if (moduleMatches) {
        moduleMatches.forEach(match => {
          const moduleName = match.replace(/(?:模块|模块|module):\s*/i, '').trim();
          const moduleId = 'MOD-' + moduleName.toUpperCase().replace(/\s+/g, '-');

          if (!modulesMap.has(moduleId)) {
            modulesMap.set(moduleId, {
              module_id: moduleId,
              module_name: moduleName,
              status: 'pending',
              completion_rate: 0.0,
              owner: 'Unknown',
              last_update: stats.mtime.toISOString(),
              notes: `从计划文件提取: ${path.basename(planFile)}`,
              related_requirements: [],
              related_tasks: [],
              related_iterations: []
            });
          }
        });
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return Array.from(modulesMap.values());
}

/**
 * Detect modules from code structure
 */
function detectModulesFromCode() {
  const modules = [];
  const srcDirs = ['src', 'lib', 'app', 'components'];

  for (const srcDir of srcDirs) {
    const srcPath = path.join(process.cwd(), srcDir);

    if (!fs.existsSync(srcPath)) {
      continue;
    }

    try {
      const entries = fs.readdirSync(srcPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const moduleName = entry.name;
          const moduleId = 'MOD-' + moduleName.toUpperCase().replace(/_/g, '-');

          // Check if module has files
          const modulePath = path.join(srcPath, moduleName);
          const stats = getModuleStats(modulePath);

          if (stats.fileCount > 0) {
            modules.push({
              module_id: moduleId,
              module_name: moduleName,
              status: 'confirmed',
              completion_rate: Math.min(stats.fileCount / 10, 1.0), // 假设10个文件为完整模块
              owner: 'Auto-detected',
              last_update: new Date().toISOString(),
              notes: `从代码结构检测: ${stats.fileCount} 个文件`,
              related_requirements: [],
              related_tasks: [],
              related_iterations: []
            });
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  return modules;
}

/**
 * Get module statistics
 */
function getModuleStats(modulePath) {
  let fileCount = 0;
  let lineCount = 0;

  try {
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and similar
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java'].includes(ext)) {
            fileCount++;
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              lineCount += content.split('\n').length;
            } catch (e) {
              // Ignore
            }
          }
        }
      }
    };

    walk(modulePath);
  } catch (e) {
    // Ignore errors
  }

  return { fileCount, lineCount };
}

/**
 * Normalize module data
 */
function normalizeModule(module) {
  return {
    module_id: module.module_id || module.id || 'MOD-UNKNOWN',
    module_name: module.module_name || module.name || 'Unknown Module',
    status: normalizeStatus(module.status),
    completion_rate: module.completion_rate || module.completion || 0,
    owner: module.owner || module.assignee || 'Unknown',
    last_update: module.last_update || module.updated_at || new Date().toISOString(),
    notes: module.notes || module.description || '',
    related_requirements: module.related_requirements || [],
    related_tasks: module.related_tasks || [],
    related_iterations: module.related_iterations || [],
    issue_description: module.issue_description || ''
  };
}

/**
 * Normalize status value
 */
function normalizeStatus(status) {
  const statusMap = {
    'pending': 'pending',
    'confirmed': 'confirmed',
    'in_progress': 'in_progress',
    'done': 'confirmed',
    'completed': 'confirmed',
    'optimized': 'optimized',
    'has_issue': 'has_issue',
    'issue': 'has_issue'
  };

  const key = (status || 'pending').toLowerCase().replace(/[-\s]/g, '_');
  return statusMap[key] || status || 'pending';
}

/**
 * Merge modules from different sources
 */
function mergeModules(fileModules, planModules, detectedModules) {
  const modulesMap = new Map();

  // Add file modules (highest priority)
  fileModules.forEach(m => modulesMap.set(m.module_id, m));

  // Add plan modules
  planModules.forEach(m => {
    if (modulesMap.has(m.module_id)) {
      // Merge with existing
      const existing = modulesMap.get(m.module_id);
      modulesMap.set(m.module_id, {
        ...existing,
        ...m,
        notes: existing.notes + (m.notes ? `\n${m.notes}` : '')
      });
    } else {
      modulesMap.set(m.module_id, m);
    }
  });

  // Add detected modules
  detectedModules.forEach(m => {
    if (modulesMap.has(m.module_id)) {
      // Update existing with detected data
      const existing = modulesMap.get(m.module_id);
      if (existing.status === 'pending') {
        existing.status = m.status;
        existing.completion_rate = m.completion_rate;
      }
    } else {
      modulesMap.set(m.module_id, m);
    }
  });

  return Array.from(modulesMap.values());
}

/**
 * Main function: collect all modules
 */
function collectModules() {
  const fileModules = loadModulesFromFile();
  const planModules = extractModulesFromPlans();
  const detectedModules = detectModulesFromCode();

  const allModules = mergeModules(fileModules, planModules, detectedModules);

  return allModules;
}

/**
 * Calculate overall module health
 */
function calculateModuleHealth(modules) {
  const total = modules.length;
  const confirmed = modules.filter(m => m.status === 'confirmed' || m.status === 'optimized').length;
  const inProgress = modules.filter(m => m.status === 'in_progress').length;
  const hasIssues = modules.filter(m => m.status === 'has_issue').length;

  const avgCompletion = modules.reduce((sum, m) => sum + (m.completion_rate || 0), 0) / (total || 1);

  return {
    total,
    confirmed,
    inProgress,
    hasIssues,
    avgCompletion: avgCompletion * 100
  };
}

module.exports = {
  collectModules,
  loadModulesFromFile,
  extractModulesFromPlans,
  detectModulesFromCode,
  calculateModuleHealth,
  normalizeModule
};
