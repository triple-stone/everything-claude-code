#!/usr/bin/env node
/**
 * Auto-Save Plan Hook
 *
 * Automatically saves confirmed implementation plans from the planner agent.
 *
 * This hook monitors Write operations to .claude/plans/ directory and validates
 * that plan files follow the correct format with proper status indicators.
 *
 * Also monitors Task tool invocations for planner agent and detects user
 * confirmation responses to automatically save the plan.
 */

const path = require('path');
const fs = require('fs');
const {
  getDateString,
  ensureDir,
  writeFile,
  log
} = require('../lib/utils');

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
    console.error('[AutoSavePlan] Error:', err.message);
    // Don't exit on error - pass through the stdin data
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

  // Monitor Write operations to .claude/plans/
  if (toolName === 'Write') {
    const filePath = toolInput.file_path || '';
    const content = toolInput.content || '';

    // Check if writing a plan file
    if (filePath.includes('.claude/plans/') && filePath.endsWith('.md')) {
      const fileName = path.basename(filePath);
      const expectedFormat = /^plan-\d{8}-/.test(fileName);

      if (!expectedFormat) {
        log(`[AutoSavePlan] ⚠️  Plan filename format incorrect`);
        log(`[AutoSavePlan] Expected: plan-YYYYMMDD-description.md`);
        log(`[AutoSavePlan] Got: ${fileName}`);
      }

      // Check for required status indicator
      if (!content.includes('**Status:')) {
        log(`[AutoSavePlan] ⚠️  Plan missing status indicator`);
        log(`[AutoSavePlan] Add at top: **Status: confirmed**`);
      }

      // Check for required sections
      const requiredSections = ['# Implementation Plan', '## Overview', '## Requirements', '## Implementation Steps'];
      const missingSections = requiredSections.filter(section => !content.includes(section));

      if (missingSections.length > 0) {
        log(`[AutoSavePlan] ⚠️  Plan missing required sections: ${missingSections.join(', ')}`);
      }

      console.error(`[AutoSavePlan] ✓ Plan saved to: ${filePath}`);
    }
  }

  // Monitor Task tool for planner agent
  if (toolName === 'Task') {
    const subagentType = toolInput.subagent_type || '';
    const toolOutput = input.tool_output || {};

    if (subagentType === 'planner' || subagentType === 'architect') {
      const output = toolOutput.output || '';

      // Check if planner output contains plan but no evidence of saving
      const hasPlanHeader = output.includes('# Implementation Plan') ||
                           output.includes('# 实施计划');
      const alreadySaved = output.includes('.claude/plans/plan-') ||
                          output.includes('SavePlan');

      // Backup: If planner forgot to save, do it automatically
      if (hasPlanHeader && !alreadySaved) {
        const planMatch = output.match(/(?:# Implementation Plan|# 实施计划)[\s\S]+/);

        if (planMatch) {
          try {
            // Generate filename
            const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const timestamp = Date.now().toString().slice(-6);
            const planFile = `.claude/plans/plan-${date}-${timestamp}.md`;

            // Create directory
            const planDir = path.join(process.cwd(), '.claude', 'plans');
            if (!fs.existsSync(planDir)) {
              fs.mkdirSync(planDir, { recursive: true });
            }

            // Add status header if missing
            let planContent = planMatch[0];
            if (!planContent.startsWith('**Status:')) {
              planContent = `**Status: confirmed**\n\n${planContent}`;
            }

            // Save plan
            const fullPath = path.join(process.cwd(), planFile);
            fs.writeFileSync(fullPath, planContent, 'utf-8');

            console.error(`\n[AutoSavePlan] Plan automatically saved to: ${planFile}\n`);
            console.error(`[AutoSavePlan] Note: The planner agent should call SavePlan tool directly.\n`);
          } catch (e) {
            // Silent fail
          }
        }
      }

      log(`[AutoSavePlan] Planner agent invoked - monitoring for plan save`);
    }
  }

  // Pass through the stdin data
  console.log(stdinData);
  process.exit(0);
}