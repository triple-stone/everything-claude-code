#!/usr/bin/env node
/**
 * Project Snapshot Dashboard Server
 *
 * Starts a local HTTP server that serves the dashboard interface
 * and provides API endpoints to access plan data.
 *
 * Usage:
 *   node dashboard-server.js
 *   node dashboard-server.js --port 3000
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const DEFAULT_PORT = 3847;

// Scripts are globally deployed, but data is in the local project
const PROJECT_ROOT = process.cwd();
const PLANS_DIR = path.join(PROJECT_ROOT, '.claude/plans');
const DASHBOARD_DIR = path.join(PROJECT_ROOT, '.claude/dashboard');

/**
 * Read all plan data and merge
 */
function loadAllPlans() {
  if (!fs.existsSync(PLANS_DIR)) {
    return {
      project_name: 'Unknown Project',
      timestamp: new Date().toISOString(),
      requirements: [],
      iterations: [],
      modules: [],
      plans: []
    };
  }

  const entries = fs.readdirSync(PLANS_DIR, { withFileTypes: true });
  const planDirs = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => path.join(PLANS_DIR, e.name));

  const mergedData = {
    project_name: 'Project',
    timestamp: new Date().toISOString(),
    requirements: [],
    iterations: [],
    modules: [],
    plans: []
  };

  for (const planDir of planDirs) {
    const planId = path.basename(planDir);
    const statusPath = path.join(planDir, 'status.json');

    // Read plan status
    let status = null;
    if (fs.existsSync(statusPath)) {
      try {
        status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
      } catch (e) {
        // Skip invalid status files
      }
    }

    // Read requirements.json
    const reqPath = path.join(planDir, 'requirements.json');
    if (fs.existsSync(reqPath)) {
      try {
        const reqData = JSON.parse(fs.readFileSync(reqPath, 'utf-8'));
        mergedData.project_name = reqData.project_name || mergedData.project_name;
        mergedData.requirements.push(...(reqData.requirements || []));
      } catch (e) {
        // Skip invalid files
      }
    }

    // Read tasks.json
    const tasksPath = path.join(planDir, 'tasks.json');
    if (fs.existsSync(tasksPath)) {
      try {
        const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
        mergedData.iterations.push(...(tasksData.iterations || []));
      } catch (e) {
        // Skip invalid files
      }
    }

    // Read modules.json
    const modulesPath = path.join(planDir, 'modules.json');
    if (fs.existsSync(modulesPath)) {
      try {
        const modulesData = JSON.parse(fs.readFileSync(modulesPath, 'utf-8'));
        mergedData.modules.push(...(modulesData.modules || []));
      } catch (e) {
        // Skip invalid files
      }
    }

    // Add plan info
    mergedData.plans.push({
      plan_id: planId,
      plan_name: status?.plan_name || planId,
      status: status?.processing_status || 'unknown',
      created_at: status?.created_at || null,
      updated_at: status?.updated_at || null
    });
  }

  return mergedData;
}

/**
 * Read a single plan's data
 */
function loadPlan(planId) {
  const planDir = path.join(PLANS_DIR, planId);

  if (!fs.existsSync(planDir)) {
    return null;
  }

  const data = {
    plan_id: planId,
    requirements: null,
    tasks: null,
    modules: null,
    status: null
  };

  // Read status.json
  const statusPath = path.join(planDir, 'status.json');
  if (fs.existsSync(statusPath)) {
    try {
      data.status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    } catch (e) {
      // Skip
    }
  }

  // Read requirements.json
  const reqPath = path.join(planDir, 'requirements.json');
  if (fs.existsSync(reqPath)) {
    try {
      data.requirements = JSON.parse(fs.readFileSync(reqPath, 'utf-8'));
    } catch (e) {
      // Skip
    }
  }

  // Read tasks.json
  const tasksPath = path.join(planDir, 'tasks.json');
  if (fs.existsSync(tasksPath)) {
    try {
      data.tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
    } catch (e) {
      // Skip
    }
  }

  // Read modules.json
  const modulesPath = path.join(planDir, 'modules.json');
  if (fs.existsSync(modulesPath)) {
    try {
      data.modules = JSON.parse(fs.readFileSync(modulesPath, 'utf-8'));
    } catch (e) {
      // Skip
    }
  }

  return data;
}

/**
 * Serve static file
 */
function serveStaticFile(res, filePath) {
  const fullPath = path.join(DASHBOARD_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json'
  }[ext] || 'text/plain';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end('Internal Server Error');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
}

/**
 * Create HTTP server
 */
function createServer(port) {
  const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);

    // API: GET /api/plans
    if (url.pathname === '/api/plans') {
      const data = loadAllPlans();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return;
    }

    // API: GET /api/plan/:id
    if (url.pathname.startsWith('/api/plan/')) {
      const planId = url.pathname.substring('/api/plan/'.length);
      const data = loadPlan(planId);

      if (data) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      } else {
        res.statusCode = 404;
        res.end('Plan not found');
      }
      return;
    }

    // Static files
    if (url.pathname === '/' || url.pathname === '/index.html') {
      serveStaticFile(res, 'index.html');
      return;
    }

    if (url.pathname.startsWith('/css/')) {
      serveStaticFile(res, url.pathname.substring(1));
      return;
    }

    if (url.pathname.startsWith('/js/')) {
      serveStaticFile(res, url.pathname.substring(1));
      return;
    }

    // 404
    res.statusCode = 404;
    res.end('Not Found');
  });

  return server;
}

/**
 * Main execution
 */
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex !== -1 && args[portIndex + 1]
  ? parseInt(args[portIndex + 1], 10)
  : DEFAULT_PORT;

const server = createServer(port);

server.listen(port, () => {
  console.log(`\n[Dashboard] Server running at http://localhost:${port}`);
  console.log('[Dashboard] Press Ctrl+C to stop\n');
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n[Dashboard] Shutting down server...');
  server.close(() => {
    console.log('[Dashboard] Server stopped');
    process.exit(0);
  });
});
