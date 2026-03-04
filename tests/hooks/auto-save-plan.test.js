#!/usr/bin/env node
/**
 * Tests for auto-save-plan hook
 *
 * Validates that:
 * 1. Plan files are validated for correct format
 * 2. Required sections are checked
 * 3. Status indicators are present
 * 4. Hook passes through stdin data correctly
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '../../scripts/hooks/auto-save-plan.js');

function runHook(toolName, toolInput) {
  const input = JSON.stringify({ tool_name: toolName, tool_input: toolInput });
  try {
    const result = execSync(`node ${HOOK_PATH}`, {
      input,
      encoding: 'utf-8',
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    // Combine stdout and stderr for validation
    return { success: true, output: result };
  } catch (error) {
    // Hook doesn't exit with error, so this shouldn't happen
    return { success: false, error: error.message, stderr: error.stderr };
  }
}

function testPlanValidation() {
  console.log('\n📋 Testing plan validation...');

  // Test 1: Correct plan format
  console.log('  ✓ Test 1: Correct plan format');
  const result1 = runHook('Write', {
    file_path: '.claude/plans/plan-20260302-feature.md',
    content: `**Status: confirmed**

# Implementation Plan: Test Feature

## Overview
Test overview

## Requirements
- Requirement 1

## Implementation Steps
Step 1

## Success Criteria
- [ ] Criterion 1`
  });

  if (!result1.output.includes('Plan saved to:')) {
    console.log('  ❌ Failed: Should confirm plan save');
    return false;
  }

  // Test 2: Wrong filename format
  console.log('  ✓ Test 2: Wrong filename format detection');
  const result2 = runHook('Write', {
    file_path: '.claude/plans/wrong-format.md',
    content: '**Status: confirmed**\n\n# Plan'
  });

  if (!result2.output.includes('filename format incorrect')) {
    console.log('  ❌ Failed: Should detect wrong filename format');
    return false;
  }

  // Test 3: Missing status
  console.log('  ✓ Test 3: Missing status indicator');
  const result3 = runHook('Write', {
    file_path: '.claude/plans/plan-20260302-test.md',
    content: '# Implementation Plan: Test'
  });

  if (!result3.output.includes('missing status indicator')) {
    console.log('  ❌ Failed: Should detect missing status');
    return false;
  }

  // Test 4: Missing required sections
  console.log('  ✓ Test 4: Missing required sections');
  const result4 = runHook('Write', {
    file_path: '.claude/plans/plan-20260302-test.md',
    content: '**Status: confirmed**\n\n# Random Title'
  });

  if (!result4.output.includes('missing required sections')) {
    console.log('  ❌ Failed: Should detect missing sections');
    return false;
  }

  console.log('✅ All plan validation tests passed!\n');
  return true;
}

function testPlannerAgentDetection() {
  console.log('\n🤖 Testing planner agent detection...');

  const result = runHook('Task', {
    subagent_type: 'planner',
    description: 'Test plan',
    prompt: 'Create a test plan'
  });

  if (!result.output.includes('Planner agent invoked')) {
    console.log('  ❌ Failed: Should detect planner agent');
    return false;
  }

  console.log('✅ Planner agent detection test passed!\n');
  return true;
}

function testStdinPassthrough() {
  console.log('\n🔄 Testing stdin passthrough...');

  const testInput = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo test' } });
  try {
    const result = execSync(`node ${HOOK_PATH}`, {
      input: testInput,
      encoding: 'utf-8'
    });

    const passthrough = JSON.parse(result);
    if (passthrough.tool_name !== 'Bash') {
      console.log('  ❌ Failed: Stdin not passed through correctly');
      return false;
    }

    console.log('✅ Stdin passthrough test passed!\n');
    return true;
  } catch (error) {
    console.log('  ❌ Failed:', error.message);
    return false;
  }
}

function main() {
  console.log('\n🧪 Running auto-save-plan hook tests...\n');

  const allPassed =
    testPlanValidation() &&
    testPlannerAgentDetection() &&
    testStdinPassthrough();

  if (allPassed) {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed!\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runHook, testPlanValidation, testPlannerAgentDetection, testStdinPassthrough };