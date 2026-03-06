#!/usr/bin/env node
/**
 * Coverage Reader
 *
 * Reads test coverage data from coverage/coverage-summary.json
 * and returns formatted coverage data for updating tasks.json
 *
 * Usage:
 *   node read-coverage.js                    # Output JSON
 *   node read-coverage.js --by-file          # Group by test file
 */

const fs = require('fs');
const path = require('path');

// Scripts are globally deployed, but data is in the local project
const PROJECT_ROOT = process.cwd();

const DEFAULT_COVERAGE_FILES = [
  'coverage/coverage-summary.json',
  'coverage/json-summary.json',
  '.nyc_output/out.json'
];

/**
 * Read coverage data from the local project directory
 */
function readCoverageData() {
  for (const covFile of DEFAULT_COVERAGE_FILES) {
    const filePath = path.join(PROJECT_ROOT, covFile);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return normalizeCoverageData(data);
      } catch (e) {
        // Skip invalid files
        continue;
      }
    }
  }
  return null;
}

/**
 * Normalize coverage data from different formats
 */
function normalizeCoverageData(data) {
  // Handle istanbul/coverage-summary.json format
  if (data.total) {
    return {
      format: 'istanbul',
      total: {
        lines: data.total.lines?.pct || 0,
        statements: data.total.statements?.pct || 0,
        functions: data.total.functions?.pct || 0,
        branches: data.total.branches?.pct || 0
      },
      files: extractFileCoverage(data)
    };
  }

  // Handle vitest/nyc format
  if (data.coverage) {
    const total = data.coverage.total;
    return {
      format: 'vitest',
      total: {
        lines: total?.lines?.pct || total?.statements?.pct || 0,
        statements: total?.statements?.pct || 0,
        functions: total?.functions?.pct || 0,
        branches: total?.branches?.pct || 0
      },
      files: extractFileCoverage(data.coverage)
    };
  }

  return null;
}

/**
 * Extract file-level coverage data
 */
function extractFileCoverage(data) {
  const files = {};

  for (const [filePath, fileData] of Object.entries(data)) {
    if (filePath === 'total') continue;

    // Try to map to test file
    const testFile = mapToTestFile(filePath);

    files[testFile] = {
      lines: fileData.lines?.pct || 0,
      statements: fileData.statements?.pct || 0,
      functions: fileData.functions?.pct || 0,
      branches: fileData.branches?.pct || 0
    };
  }

  return files;
}

/**
 * Map source file to test file path
 */
function mapToTestFile(sourcePath) {
  // Common patterns:
  // src/lib/foo.ts → src/__tests__/lib/foo.test.ts
  // lib/bar.js → lib/__tests__/bar.test.js
  // app/baz.tsx → app/__tests__/baz.test.tsx

  const parts = sourcePath.split('/');

  // Find src/lib/app directory
  const srcIndex = parts.findIndex(p => ['src', 'lib', 'app'].includes(p));

  if (srcIndex === -1) {
    // No standard source dir, return as-is
    return sourcePath;
  }

  const srcDir = parts[srcIndex];
  const restPath = parts.slice(srcIndex + 1);

  // Remove extension and add .test.{ext}
  const filename = restPath[restPath.length - 1];
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);

  const testFilename = `${basename}.test${ext}`;
  restPath[restPath.length - 1] = testFilename;

  // Build test path: src/__tests__/rest...
  return [srcDir, '__tests__', ...restPath.slice(0, -1), testFilename].join('/');
}

/**
 * Get coverage for a specific test file
 */
function getCoverageForFile(testFile) {
  const coverage = readCoverageData();
  if (!coverage || !coverage.files) {
    return 0;
  }

  // Try exact match
  if (coverage.files[testFile]) {
    return coverage.files[testFile].lines;
  }

  // Try fuzzy match (same base name)
  const basename = path.basename(testFile);
  for (const [filePath, data] of Object.entries(coverage.files)) {
    if (path.basename(filePath) === basename) {
      return data.lines;
    }
  }

  return 0;
}

/**
 * Main execution
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const byFile = args.includes('--by-file');

  const coverage = readCoverageData();

  if (!coverage) {
    console.error('[Coverage] No coverage data found');
    console.error('[Coverage] Looked in:', DEFAULT_COVERAGE_FILES.join(', '));
    process.exit(1);
  }

  if (byFile) {
    console.log(JSON.stringify(coverage.files, null, 2));
  } else {
    console.log(JSON.stringify(coverage, null, 2));
  }
}

module.exports = {
  readCoverageData,
  getCoverageForFile,
  mapToTestFile
};
