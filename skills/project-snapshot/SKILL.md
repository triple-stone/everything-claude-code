---
name: project-snapshot
description: Generate and visualize project state from plan files - track requirements, iterations, tasks, modules, and test coverage
origin: ECC (Everything Claude Code)
version: 2.1
---

# Project Snapshot Skill (V2.1)

Generate project state snapshots by analyzing plan files with LLM. Track requirements, iterations, tasks, modules, and test coverage through an interactive dashboard.

## core Workflow: Initialize -> Analyze -> Finalize

The snapshot process follows a template-driven approach to ensure JSON data integrity:

1. **Initialize Environment**: Run `init-plan-snapshot.js` to create standard JSON templates for any new or modified plans.
2. **LLM Extraction**: Analyze `plan.md` and populate `requirements.json`, `tasks.json`, and `modules.json` using the initialized templates.
3. **Finalize Stats**: Run `init-plan-snapshot.js --complete` to calculate task completion rates and mark the plan processing as finished.

## Commands

### `/snapshot`

Generate project snapshot by analyzing all plan files:

**Execution Flow:**
1. **Scan** for changes using `detect-plan-changes.js`.
2. **Initialize** templates with `init-plan-snapshot.js`.
3. **Extract** data into JSON (LLM Step).
4. **Finalize** stats and status with `init-plan-snapshot.js --complete`.
5. **Launch** dashboard via `dashboard-server.js`.

## Data Structure (Per-Plan)

Files located in `.claude/plans/{plan-id}/`:

| File | Description |
| :--- | :--- |
| `requirements.json` | Extracted requirements, priority, and status |
| `tasks.json` | Iterations and tasks with TDD and coverage data |
| `modules.json` | Module completion rates and feature list |
| `status.json` | Snapshot metadata, hash, and overall progress |

## Dashboard Access

URL: `http://localhost:3847`

The dashboard provides real-time visualization of all plans, automatically refreshing every 30 seconds as long as the server is running.

## Available Scripts

All scripts support global deployment via `${CLAUDE_PLUGIN_ROOT}`:

```bash
# Detect plan changes
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/detect-plan-changes.js"

# Initialize or Finalize snapshot data
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/init-plan-snapshot.js" <plan-dir> [--complete]

# Read test coverage
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/read-coverage.js"

# Start dashboard server
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/dashboard-server.js"
```

## Performance & Safety

- **Incremental Processing**: Content-hash based detection skips unchanged plans, saving 70%+ tokens.
- **Template-First Approach**: Ensures LLM maintains the specific JSON schema required for the dashboard.
- **Scripted Stats**: Completion rates are calculated by script rather than LLM to ensure mathematical accuracy.
