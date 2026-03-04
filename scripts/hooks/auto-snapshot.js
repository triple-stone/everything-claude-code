#!/usr/bin/env node
/**
 * Auto-Snapshot Hook
 *
 * Automatically generates project snapshot when plan files are saved.
 *
 * This hook monitors Write operations to .claude/plans/ directory and
 * automatically runs snapshot.js to capture the updated project state.
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

// Read hook input from stdin
const MAX_STDIN = 1024 * 1024;
let stdinData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  if (stdinData.length < MAX_STDIN) {
    const remaining = MAX_STDIN - stdinData.length;
    stdinData += chunk.substring(0, remaining);
  }
});

process.stdin.on('end', () => {
  runMain();
});

function runMain() {
  main().catch(err => {
    // Silently ignore errors - don't block the workflow
    console.log(stdinData);
    process.exit(0);
  });
}

async function main() {
  let input = {};
  try {
    input = JSON.parse(stdinData);
  } catch {
    // Not valid JSON, just pass through
    console.log(stdinData);
    process.exit(0);
  }

  const toolName = input.tool_name || input.name || '';
  const toolInput = input.tool_input || input.input || {};

  // Only trigger on Write operations to .claude/plans/
  if (toolName === 'Write') {
    const filePath = toolInput.file_path || '';

    // Check if writing a plan file
    if (filePath.includes('.claude/plans/') && filePath.endsWith('.md')) {
      try {
        // Get the project root directory
        const projectRoot = process.cwd();

        // Run snapshot generation
        const snapshotScript = path.join(
          __dirname,
          '..',
          'skills',
          'project-snapshot',
          'scripts',
          'snapshot.js'
        );

        if (fs.existsSync(snapshotScript)) {
          console.error('[AutoSnapshot] Generating project snapshot...');
          execSync(`node "${snapshotScript}"`, {
            cwd: projectRoot,
            stdio: 'inherit',
            timeout: 30000
          });
          console.error('[AutoSnapshot] ✓ Snapshot generated');
        }
      } catch (err) {
        // Don't fail - just log the error
        console.error(`[AutoSnapshot] ⚠️  Snapshot generation skipped: ${err.message}`);
      }
    }
  }

  // Pass through the stdin data
  console.log(stdinData);
  process.exit(0);
}
