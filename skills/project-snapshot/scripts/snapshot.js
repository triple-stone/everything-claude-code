#!/usr/bin/env node
/**
 * Project Snapshot Generator
 * 
 * Generates project state snapshots capturing iterations, tasks,
 * module status, and health metrics.
 * 
 * Usage:
 *   node snapshot.js                    # Generate snapshot
 *   node snapshot.js --output <path>   # Custom output path
 *   node snapshot.js --auto            # Auto mode (for hooks)
 *   node snapshot.js --track <module>  # Track a module
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const os = require('os');

const DEFAULT_SNAPSHOT_DIR = '.claude/snapshots';
const CONFIG_FILE = '.claude/project-snapshot.json';

function getConfig() {
  const defaultConfig = {
    snapshotDir: DEFAULT_SNAPSHOT_DIR,
    maxSnapshots: 30,
    trackOnSessionEnd: true,
    includePatterns: ['src/**', 'lib/**', 'app/**'],
    excludePatterns: ['node_modules/**', 'dist/**', '*.log', '.git/**', '*.pyc', '__pycache__/**']
  };
  
  try {
    const configPath = path.join(process.cwd(), CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      return { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
    }
  } catch (e) {
    // Use defaults
  }
  return defaultConfig;
}

function getProjectName() {
  try {
    const gitDir = path.join(process.cwd(), '.git');
    if (fs.existsSync(gitDir)) {
      const remoteUrl = execSync('git remote get-url origin 2>/dev/null', { encoding: 'utf-8' }).trim();
      const match = remoteUrl.match(/\/([^\/]+?)(?:\.git)?$/);
      if (match) return match[1];
    }
  } catch (e) {
    // Ignore
  }
  return path.basename(process.cwd());
}

function getGitInfo() {
  const info = { branch: null, commit: null, status: 'unknown', dirty: false };
  
  try {
    info.branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
    info.commit = execSync('git rev-parse HEAD 2>/dev/null', { encoding: 'utf-8' }).trim().slice(0, 7);
    const status = execSync('git status --porcelain 2>/dev/null', { encoding: 'utf-8' }).trim();
    info.dirty = status.length > 0;
    info.status = info.dirty ? 'dirty' : 'clean';
  } catch (e) {
    info.status = 'not-a-repo';
  }
  
  return info;
}

function getDependencies() {
  const deps = { production: {}, dev: {} };
  const pkgPaths = ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle'];
  
  try {
    if (fs.existsSync('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      deps.production = pkg.dependencies || {};
      deps.dev = pkg.devDependencies || {};
      deps.packageManager = detectPackageManager();
    } else if (fs.existsSync('Cargo.toml')) {
      const cargo = fs.readFileSync('Cargo.toml', 'utf-8');
      const nameMatch = cargo.match(/name\s*=\s*"([^"]+)"/);
      const versionMatch = cargo.match(/version\s*=\s*"([^"]+)"/);
      deps.cargo = { name: nameMatch ? nameMatch[1] : 'unknown', version: versionMatch ? versionMatch[1] : 'unknown' };
    } else if (fs.existsSync('go.mod')) {
      const gomod = fs.readFileSync('go.mod', 'utf-8');
      const moduleMatch = gomod.match(/module\s+([^\s]+)/);
      const versionMatch = gomod.match(/go\s+(\d+\.\d+)/);
      deps.go = { module: moduleMatch ? moduleMatch[1] : 'unknown', goVersion: versionMatch ? versionMatch[1] : 'unknown' };
    }
  } catch (e) {
    deps.error = e.message;
  }
  
  return deps;
}

function detectPackageManager() {
  if (fs.existsSync('bun.lockb')) return 'bun';
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (fs.existsSync('yarn.lock')) return 'yarn';
  if (fs.existsSync('package-lock.json')) return 'npm';
  return 'unknown';
}

function getTestStatus() {
  const status = { passed: 0, failed: 0, skipped: 0, total: 0 };

  try {
    // Read coverage files directly instead of running tests
    const coverageFiles = [
      'coverage/coverage-summary.json',
      'coverage/json-summary.json',
      '.nyc_output/out.json'
    ];

    for (const covFile of coverageFiles) {
      if (fs.existsSync(covFile)) {
        try {
          const covData = JSON.parse(fs.readFileSync(covFile, 'utf-8'));

          // Handle istanbul/coverage-summary.json format
          if (covData.total) {
            status.coverage = covData.total.lines?.pct || 0;
            status.passed = 0;  // Not available in coverage files
            status.failed = 0;
            status.total = 0;
            break;
          }

          // Handle vitest/nyc format
          if (covData.coverage) {
            const total = covData.coverage.total;
            if (total) {
              status.coverage = total.lines?.pct || total.statements?.pct || 0;
              status.passed = 0;
              status.failed = 0;
              status.total = 0;
              break;
            }
          }
        } catch (e) {
          // Skip invalid coverage files
          continue;
        }
      }
    }
  } catch (e) {
    status.error = e.message;
  }

  return status;
}

function getLintStatus() {
  const status = { passed: false, errors: 0 };

  // Skip running lint checks - just return default status
  // This avoids timeout issues when linting takes too long
  return status;
}

function getModules(config) {
  const modules = [];
  const srcDirs = ['src', 'lib', 'app', 'src/main', 'src/app'];
  
  for (const dir of srcDirs) {
    if (!fs.existsSync(dir)) continue;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !config.excludePatterns.some(p => entry.name.match(p.replace('**', '.*')))) {
          const modulePath = path.join(dir, entry.name);
          const stats = fs.statSync(modulePath);
          const files = countFiles(modulePath);
          
          modules.push({
            name: entry.name,
            path: modulePath,
            files,
            status: 'pending',
            lastModified: stats.mtime.toISOString()
          });
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  return modules;
}

function countFiles(dir) {
  let count = 0;
  const skipDirs = [
    'node_modules', 'dist', 'build', 'target', '.git', '__pycache__', 'venv',
    '.vscode', '.idea', 'uni_modules', 'coverage', '.nuxt', '.output', '.turbo',
    'miniprogram_npm', 'vendor', 'bower_components',
    '.ai', '.claude', '.gemini', '.cursor', '.copilot', '.trae'
  ];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.includes(entry.name)) {
          count += countFiles(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        count++;
      }
    }
  } catch (e) {
    // Ignore
  }
  return count;
}

function getLanguageStats() {
  const stats = {};
  const extensions = {
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.jsx': 'JavaScript',
    '.tsx': 'TypeScript',
    '.wxml': 'WXML',
    '.wxss': 'WXSS',
    '.vue': 'Vue',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.kt': 'Kotlin',
    '.swift': 'Swift',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.cs': 'C#',
    '.cpp': 'C++',
    '.c': 'C'
  };

  // Skip directories for performance
  const skipDirs = [
    'node_modules', 'dist', 'build', 'target', '.git', '__pycache__', 'venv',
    '.vscode', '.idea', 'uni_modules', 'coverage', '.nuxt', '.output', '.turbo',
    'miniprogram_npm', 'vendor', 'bower_components',
    '.ai', '.claude', '.gemini', '.cursor', '.copilot', '.trae'
  ];

  let filesScanned = 0;

  function walkDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!skipDirs.includes(entry.name)) {
            walkDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions[ext]) {
            if (!stats[extensions[ext]]) {
              stats[extensions[ext]] = { files: 0, lines: 0 };
            }
            stats[extensions[ext]].files++;
            // Skip line counting for performance
            // stats[extensions[ext]].lines += countLines(fullPath);

            filesScanned++;
            // Show progress every 500 files
            if (filesScanned % 500 === 0) {
              console.log(`[Snapshot] Scanned ${filesScanned} files...`);
            }
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  console.log('[Snapshot] Scanning files for language stats...');
  walkDir('.');
  console.log(`[Snapshot] Total files scanned: ${filesScanned}`);
  return stats;
}

function generateSnapshotId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = String(now.getTime()).slice(-6);
  return `snap-${date}-${time}`;
}

function createSnapshot(options = {}) {
  const config = getConfig();
  const projectName = getProjectName();
  const snapshotId = options.id || generateSnapshotId();

  console.log(`[Snapshot] Generating snapshot for: ${projectName}`);

  // Collect requirements, modules, tasks, and iterations
  let requirements = [];
  let modules = [];
  let tasks = [];
  let iterations = [];

  // Collect requirements
  try {
    const { collectRequirements } = require('./requirement-parser');
    requirements = collectRequirements();
    if (requirements.length > 0) {
      console.log(`[Snapshot] Found ${requirements.length} requirement(s)`);
    }
  } catch (e) {
    console.log(`[Snapshot] No requirements found: ${e.message}`);
  }

  // Collect modules
  try {
    const { collectModules } = require('./module-analyzer');
    modules = collectModules();
    if (modules.length > 0) {
      console.log(`[Snapshot] Found ${modules.length} module(s)`);
    }
  } catch (e) {
    console.log(`[Snapshot] No modules found: ${e.message}`);
  }

  // Collect tasks and iterations
  try {
    const { collectTasks } = require('./task-collector');
    const taskData = collectTasks();
    tasks = taskData.tasks;
    iterations = taskData.iterations;
    if (tasks.length > 0) {
      console.log(`[Snapshot] Found ${tasks.length} task(s)`);
    }
    if (iterations.length > 0) {
      console.log(`[Snapshot] Found ${iterations.length} iteration(s)`);
    }
  } catch (e) {
    console.log(`[Snapshot] No tasks found: ${e.message}`);
  }

  // Get current iteration (most recent in_progress or completed)
  const currentIteration = iterations.find(i => i.status === 'in_progress')?.iteration_id ||
                           iterations[iterations.length - 1]?.iteration_id ||
                           null;

  const snapshot = {
    project_name: projectName,
    snapshot_id: snapshotId,
    timestamp: new Date().toISOString(),
    git: getGitInfo(),
    dependencies: getDependencies(),
    requirements,
    modules,
    iterations,
    tasks,
    current_iteration: currentIteration,
    health: {
      tests: getTestStatus(),
      lint: getLintStatus()
    },
    languages: getLanguageStats(),
    metadata: {
      generated_by: 'project-snapshot',
      version: '2.0.0',
      hostname: os.hostname()
    }
  };
  
  // Ensure snapshot directory exists
  const snapshotDir = path.resolve(config.snapshotDir);
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }
  
  // Save snapshot
  const outputPath = options.output || path.join(snapshotDir, `${snapshotId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
  
  console.log(`[Snapshot] Saved to: ${outputPath}`);
  
  // Cleanup old snapshots
  cleanupOldSnapshots(snapshotDir, config.maxSnapshots);
  
  return { snapshot, outputPath };
}

function cleanupOldSnapshots(dir, maxSnapshots) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(dir, f),
        mtime: fs.statSync(path.join(dir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (files.length > maxSnapshots) {
      const toDelete = files.slice(maxSnapshots);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`[Snapshot] Cleaned up old snapshot: ${file.name}`);
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

function getLatestSnapshot(config) {
  const snapshotDir = path.resolve(config.snapshotDir);
  try {
    const files = fs.readdirSync(snapshotDir)
      .filter(f => f.endsWith('.json') && f.startsWith('snap-'))
      .map(f => ({
        name: f,
        path: path.join(snapshotDir, f),
        mtime: fs.statSync(path.join(snapshotDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (files.length > 0) {
      return JSON.parse(fs.readFileSync(files[0].path, 'utf-8'));
    }
  } catch (e) {
    // No snapshots yet
  }
  return null;
}

function trackModule(moduleName, status) {
  const config = getConfig();
  const snapshot = getLatestSnapshot(config);
  
  if (!snapshot) {
    console.log('[Snapshot] No existing snapshot found. Creating new one...');
    createSnapshot();
  }
  
  const snapshotDir = path.resolve(config.snapshotDir);
  const files = fs.readdirSync(snapshotDir)
    .filter(f => f.endsWith('.json') && f.startsWith('snap-'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.error('[Snapshot] Failed to track module: no snapshots found');
    process.exit(1);
  }
  
  const latestFile = files[0];
  const latestPath = path.join(snapshotDir, latestFile);
  const data = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
  
  // Update or add module
  const existingModule = data.modules.find(m => m.name === moduleName);
  if (existingModule) {
    existingModule.status = status;
    existingModule.lastModified = new Date().toISOString();
  } else {
    data.modules.push({
      name: moduleName,
      path: moduleName,
      files: 0,
      status,
      lastModified: new Date().toISOString()
    });
  }
  
  fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
  console.log(`[Snapshot] Module '${moduleName}' status set to: ${status}`);
}

// CLI
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && args[i + 1]) {
    options.output = args[i + 1];
    i++;
  } else if (args[i] === '--auto') {
    options.auto = true;
  } else if (args[i] === '--track' && args[i + 1]) {
    const moduleName = args[i + 1];
    const status = args[i + 2] === '--status' ? args[i + 3] : 'in_progress';
    trackModule(moduleName, status);
    process.exit(0);
  } else if (args[i] === '--id' && args[i + 1]) {
    options.id = args[i + 1];
    i++;
  }
}

try {
  createSnapshot(options);
  process.exit(0);
} catch (e) {
  console.error('[Snapshot] Error:', e.message);
  process.exit(1);
}
